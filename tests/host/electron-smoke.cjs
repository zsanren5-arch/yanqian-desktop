'use strict';
const assert=require('node:assert/strict');const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..');
const runtimeRequire=createRequire(process.env.YANQIAN_PLAYWRIGHT_PACKAGE||path.join(root,'package.json'));
(async()=>{
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'yanqian-electron-host-')),fixture=path.join(temp,'application'),userData=path.join(temp,'data');let electronApp;
 const checks=[];const check=async(name,fn)=>{await fn();checks.push({name,passed:true});};
 try{
  await fs.mkdir(path.join(fixture,'src'),{recursive:true});await fs.cp(path.join(root,'electron'),path.join(fixture,'electron'),{recursive:true});
  await fs.writeFile(path.join(fixture,'package.json'),JSON.stringify({name:'yanqian-host-test',version:'1.0.0',main:'electron/main.cjs'}));
  await fs.writeFile(path.join(fixture,'index.html'),'<!doctype html><html><head><meta charset="utf-8"><title>Host fixture</title></head><body><h1>Isolated host fixture</h1></body></html>');
  const {_electron}=runtimeRequire('playwright'),env={...process.env,YANQIAN_TEST_USER_DATA:userData};delete env.ELECTRON_RUN_AS_NODE;
  electronApp=await _electron.launch({executablePath:require('electron'),args:[fixture],env,timeout:60000});
  const page=await electronApp.firstWindow();await page.waitForFunction(()=>window.yanqianDesktop);
  await check('preload exposed only the fixed API in a sandboxed isolated renderer',async()=>{assert.deepEqual(await page.evaluate(()=>({require:typeof require,process:typeof process,api:typeof window.yanqianDesktop.saveNote})),{require:'undefined',process:'undefined',api:'function'});const prefs=await electronApp.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());assert.equal(prefs.contextIsolation,true);assert.equal(prefs.nodeIntegration,false);assert.equal(prefs.sandbox,true);});
  await check('empty default vault stays inside isolated userData',async()=>{const workspace=await page.evaluate(()=>window.yanqianDesktop.getWorkspace());assert.ok(workspace.path.startsWith((await fs.realpath(userData))+path.sep));assert.deepEqual(await page.evaluate(()=>window.yanqianDesktop.listNotes()),[]);});
  let note;
  await check('real IPC persists Markdown then detects a stale save without changing the file',async()=>{note=await page.evaluate(()=>window.yanqianDesktop.createNote({title:'Host note',content:'- [ ] actual IPC'}));const saved=await page.evaluate(n=>window.yanqianDesktop.saveNote({...n,content:'new body',expectedRevision:n.revision}),note);assert.equal(saved.content,'new body');assert.equal(await page.evaluate(async n=>{try{await window.yanqianDesktop.saveNote({...n,content:'stale',expectedRevision:n.revision});return 'overwritten';}catch(e){return e.code;}},note),'CONFLICT');note=saved;});
  await check('user-selected Markdown export writes the exact file',async()=>{const destination=path.join(temp,'exported.md');await electronApp.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},destination);const result=await page.evaluate(id=>window.yanqianDesktop.exportMarkdown({id}),note.id);assert.equal(result.canceled,false);assert.ok((await fs.readFile(destination,'utf8')).includes('new body'));});
  await check('path traversal IPC is rejected before a file read',async()=>{assert.equal(await page.evaluate(async()=>{try{await window.yanqianDesktop.readNote('../secret.md');return 'read';}catch(e){return e.code;}}),'INVALID_PATH');});
  await check('real delete, trash and restore keep the Markdown contents',async()=>{const trash=await page.evaluate(n=>window.yanqianDesktop.deleteNote({id:n.id,expectedRevision:n.revision}),note);assert.equal((await page.evaluate(()=>window.yanqianDesktop.listNotes())).length,0);const restored=await page.evaluate(id=>window.yanqianDesktop.restoreNote(id),trash.trashId);assert.equal(restored.content,'new body');});
  await check('custom protocol does not serve host source or traverse out of allowed assets',async()=>{assert.equal(await electronApp.evaluate(async({net})=> (await net.fetch('yanqian://app/electron/main.cjs')).status),404);assert.equal(await electronApp.evaluate(async({net})=> (await net.fetch('yanqian://app/src/..%2F..%2Felectron/main.cjs')).status),404);});
  await check('renderer connections are disabled by CSP and file popups are denied',async()=>{assert.equal(await page.evaluate(async()=>{try{await fetch('https://example.com');return 'connected';}catch{return 'blocked';}}),'blocked');await page.evaluate(()=>window.open('file:///etc/passwd'));assert.equal((await electronApp.windows()).length,1);});
  const report={passed:true,checks,productionDataReadOrWritten:false,isolatedTemporaryWorkspace:true,electronVersion:await electronApp.evaluate(()=>process.versions.electron)};
  await fs.mkdir(path.join(root,'tests/artifacts'),{recursive:true});await fs.writeFile(path.join(root,'tests/artifacts/electron-host-smoke.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
 }finally{if(electronApp)await electronApp.close();await fs.rm(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
