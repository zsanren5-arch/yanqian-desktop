'use strict';
const { app, BrowserWindow, ipcMain, protocol, dialog, shell, Menu, session } = require('electron');
const fs = require('node:fs/promises');
const nativeFs = require('node:fs');
const path = require('node:path');
const { VaultStore, VaultError } = require('./vault-store.cjs');
protocol.registerSchemesAsPrivileged([{ scheme:'yanqian', privileges:{ standard:true, secure:true, supportFetchAPI:true, corsEnabled:true } }]);
if (!app.isPackaged && process.env.YANQIAN_TEST_USER_DATA && path.isAbsolute(process.env.YANQIAN_TEST_USER_DATA)) app.setPath('userData', process.env.YANQIAN_TEST_USER_DATA);
const ORIGIN = 'yanqian://app';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; media-src 'self' blob:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
let window = null, store = null, watcher = null, refreshTimer = null;
function emit(channel,value) { if(window && !window.isDestroyed()) window.webContents.send(channel,value); }
function watchWorkspace() {
  watcher?.close(); clearTimeout(refreshTimer);
  try { watcher = nativeFs.watch(store.root, { recursive:true }, (_event,name) => { if(name?.split(/[\\/]/).some(part=>part.startsWith('.'))) return; clearTimeout(refreshTimer); refreshTimer=setTimeout(()=>emit('yanqian:notes-changed',{external:true}),240); }); }
  catch { watcher = null; }
}
async function writeSettings(value) {
  const dir = app.getPath('userData'), target=path.join(dir,'workspace.json'); await fs.mkdir(dir,{recursive:true});
  const temp = target + '.tmp'; await fs.writeFile(temp,JSON.stringify(value),{mode:0o600}); await fs.rename(temp,target);
}
async function setWorkspace(folder, remember=true) {
  const next = await new VaultStore(folder).init(); store=next; watchWorkspace();
  if(remember) await writeSettings({path:store.root});
  emit('yanqian:workspace-changed',store.info()); return store.info();
}
async function initialWorkspace() {
  const dir=app.getPath('userData'); let folder=path.join(dir,'笔记本');
  try { const settings=JSON.parse(await fs.readFile(path.join(dir,'workspace.json'),'utf8')); if(typeof settings.path==='string' && path.isAbsolute(settings.path) && (await fs.stat(settings.path)).isDirectory()) folder=settings.path; } catch {}
  await setWorkspace(folder,false);
}
function trusted(event) {
  if(!window || event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame) return false;
  try { const url=new URL(event.senderFrame.url); return url.protocol==='yanqian:' && url.hostname==='app' && url.pathname==='/index.html'; } catch { return false; }
}
function register(method,action) {
  ipcMain.handle(`yanqian:${method}`, async(event,arg)=>{
    if(!trusted(event)) return {ok:false,error:{code:'ACCESS_DENIED',message:'当前页面不能访问笔记文件'}};
    try { return {ok:true,value:await action(arg)}; }
    catch(error) { return {ok:false,error:{code:error.code==='ENOENT'?'NOT_FOUND':error.code || 'OPERATION_FAILED',message:error instanceof VaultError ? error.message : error.code==='ENOENT' ? '文件已不存在，当前输入仍保留' : '操作未完成，原文件与当前输入仍保留',...(error instanceof VaultError && error.details?{details:error.details}:{})}}; }
  });
}
function handlers() {
  register('get-workspace',()=>store.info());
  register('choose-workspace',async()=>{ const result=await dialog.showOpenDialog(window,{title:'选择自己的Markdown笔记文件夹',properties:['openDirectory','createDirectory']}); return result.canceled?null:setWorkspace(result.filePaths[0]); });
  register('list-notes',()=>store.listNotes()); register('read-note',id=>store.readNote(id));
  register('create-note',async data=>{ const note=await store.createNote(data); emit('yanqian:notes-changed',{id:note.id}); return note; });
  register('save-note',async data=>{ const note=await store.saveNote(data); emit('yanqian:notes-changed',{id:note.id}); return note; });
  register('delete-note',async data=>{ const result=await store.deleteNote(data); emit('yanqian:notes-changed',{id:result.id}); return result; });
  register('list-trash',()=>store.listTrash());
  register('restore-note',async id=>{ const note=await store.restoreNote(id); emit('yanqian:notes-changed',{id:note.id}); return note; });
  register('reveal-note',async id=>{shell.showItemInFolder(await store.checked(id));return true;});
  register('export-markdown',async data=>{
    if (!data || data.id == null) {
      const result = await dialog.showOpenDialog(window, { title:'选择Markdown导出位置', properties:['openDirectory','createDirectory'] });
      if (result.canceled) return {canceled:true};
      const notes = await store.listNotes(), directory = path.join(result.filePaths[0], `眼前日程导出-${Date.now()}`);
      await fs.mkdir(directory, {mode:0o700});
      for (const note of notes) {
        const raw = await store.raw(note.id), title = note.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100);
        await fs.writeFile(path.join(directory, `${title}-${require('node:crypto').createHash('sha256').update(note.id).digest('hex').slice(0,12)}.md`), raw.bytes, {flag:'wx',mode:0o600});
      }
      return {canceled:false,path:directory,count:notes.length};
    }
    if(typeof data.id!=='string') throw new VaultError('INVALID_INPUT','请选择一篇笔记');
    const note=await store.readNote(data.id), raw=await store.raw(data.id), filename=note.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)+'.md';
    const result=await dialog.showSaveDialog(window,{title:'导出Markdown',defaultPath:filename,filters:[{name:'Markdown',extensions:['md']}]});
    if(result.canceled || !result.filePath) return {canceled:true};
    const destination=path.resolve(result.filePath), original=await store.checked(data.id);
    if(destination===original) throw new VaultError('INVALID_PATH','此文件已是本地Markdown，请选择其他导出位置');
    // The user chooses this exact external file in the system Save dialog.
    await fs.writeFile(destination,raw.bytes,{mode:0o600}); return {canceled:false,path:destination};
  });
  register('app-info',()=>({name:app.getName(),version:app.getVersion(),platform:process.platform,arch:process.arch,packaged:app.isPackaged,localFirst:true,vibeCredit:'由作者和 ChatGPT 一起 vibe coding 完成'}));
}
function external(url) { try { const parsed=new URL(url); if(['https:','http:'].includes(parsed.protocol)) shell.openExternal(parsed.href).catch(()=>{}); } catch {} }
async function installProtocol() {
  const base=app.getAppPath();
  protocol.handle('yanqian',async request=>{
    try {
      const url=new URL(request.url), decoded=decodeURIComponent(url.pathname);
      if(url.hostname!=='app' || !['GET','HEAD'].includes(request.method) || decoded.includes('\\') || decoded.includes('\0')) return new Response('Not found',{status:404});
      const relative=decoded==='/'?'index.html':decoded.slice(1);
      if(relative!=='index.html' && !/^(src|assets|vendor)\//.test(relative)) return new Response('Not found',{status:404});
      if(relative.split('/').some(part=>!part || part==='..' || part==='.' || part.startsWith('.'))) return new Response('Not found',{status:404});
      const file=path.resolve(base,relative); if(!file.startsWith(base+path.sep)) return new Response('Not found',{status:404});
      const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.json':'application/json; charset=utf-8'}[path.extname(file).toLowerCase()];
      if(!mime) return new Response('Not found',{status:404});
      const stat=await fs.lstat(file); if(!stat.isFile() || stat.isSymbolicLink() || stat.size>20*1024*1024) return new Response('Not found',{status:404});
      return new Response(request.method==='HEAD'?null:await fs.readFile(file),{headers:{'Content-Type':mime,'Content-Security-Policy':CSP,'X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-cache'}});
    } catch {return new Response('Not found',{status:404});}
  });
}
function createWindow() {
  window=new BrowserWindow({width:1280,height:840,minWidth:900,minHeight:620,backgroundColor:'#f6f8f7',title:'眼前日程',icon:path.join(app.getAppPath(),'assets/icon.png'),show:false,...(process.platform==='darwin'?{titleBarStyle:'hiddenInset',trafficLightPosition:{x:18,y:20}}:{}),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,allowRunningInsecureContent:false,spellcheck:true}});
  window.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'};});
  window.webContents.on('will-navigate',(event,url)=>{if(url!==ORIGIN+'/index.html'){event.preventDefault();external(url);}});
  window.webContents.on('will-attach-webview',event=>event.preventDefault());
  window.once('ready-to-show',()=>window.show());
  window.on('closed',()=>{window=null;}); window.loadURL(ORIGIN+'/index.html');
}
function installMenu() {
  const template=[...(process.platform==='darwin'?[{label:'眼前日程',submenu:[{role:'about'},{type:'separator'},{role:'hide'},{role:'hideOthers'},{role:'unhide'},{type:'separator'},{role:'quit'}]}]:[]),{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{role:'selectAll'}]},{label:'视图',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'},...(!app.isPackaged?[{role:'toggleDevTools'}]:[])]},{label:'窗口',submenu:[{role:'minimize'},{role:'close'}]}];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
const gotLock=app.requestSingleInstanceLock();
if(!gotLock) app.quit();
else {
  app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
  app.whenReady().then(async()=>{
    session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.defaultSession.setPermissionCheckHandler(()=>false);
    await installProtocol(); await initialWorkspace(); handlers(); installMenu(); createWindow();
    app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
  }).catch(error=>{dialog.showErrorBox('眼前日程未能打开','本地工作区无法打开。原文件没有被删除，请检查文件夹权限后重试。');app.quit();});
}
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
app.on('before-quit',()=>{watcher?.close();clearTimeout(refreshTimer);});
