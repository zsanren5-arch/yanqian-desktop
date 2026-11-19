import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(process.env.YANQIAN_PLAYWRIGHT_PACKAGE || new URL('../package.json',import.meta.url));
export async function runDesktopBrowserChecks(browser, {sourceRoot=root,out=path.join(root,'tests/artifacts/browser'),only=''}={}) {
  await fs.mkdir(out,{recursive:true});
  sourceRoot=path.resolve(sourceRoot);
  const checks=[],errors=[],externalRequests=[],allRequests=[],contexts=[];
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost');
      if(url.pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
      const relative=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).slice(1);
      if(!['index.html'].includes(relative)&&!['src/','assets/','vendor/'].some(prefix=>relative.startsWith(prefix))){res.writeHead(404);res.end();return;}
      const file=path.resolve(sourceRoot,relative);if(!file.startsWith(sourceRoot+path.sep)){res.writeHead(403);res.end();return;}
      const body=await fs.readFile(file);const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':mime,'Content-Length':body.length,'Cache-Control':'no-store'});res.end(body);
    } catch {res.writeHead(404);res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  async function record(name,fn,{viewport={width:1440,height:1000},reduce=false,setup}={}) {
    if(only&&!name.includes(only))return;
    const context=await browser.newContext({viewport,acceptDownloads:true,reducedMotion:reduce?'reduce':'no-preference'});contexts.push(context);
    if(setup)await context.addInitScript(setup);
    const page=await context.newPage();page.setDefaultTimeout(7000);
    page.on('pageerror',error=>errors.push({name,message:String(error)}));
    page.on('request',request=>{const url=request.url();allRequests.push({method:request.method(),url});if(/^https?:/.test(url)&&!url.startsWith(origin+'/'))externalRequests.push(url);});
    try { await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>['true','error'].includes(document.body.dataset.ready));await page.locator('#note-content').waitFor({state:'visible'});await fn(page,context);checks.push({name,passed:true,fixture:setup?'isolated-error-fixture':'real-browser-store'}); }
    catch(error){checks.push({name,passed:false,fixture:setup?'isolated-error-fixture':'real-browser-store',error:String(error.stack||error)});await page.screenshot({path:path.join(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{});}
    finally {await context.close();}
    await writeReport();
  }
  async function writeReport(){await fs.writeFile(path.join(out,'browser-results.json'),JSON.stringify({checks,errors,externalRequests,requests:allRequests,environment:'fresh Chromium contexts, isolated localhost static source and browser-store; synthetic notes only',physicalDesktopPackageVerified:false,productionOrUserVaultAccessed:false},null,2)+'\n');}
  const input=page=>page.locator('#note-content');
  const title=page=>page.locator('#note-title');
  const noteRows=page=>page.locator('#note-list [data-note-id]');
  const saved=page=>page.waitForFunction(()=>{const n=document.querySelector('#save-status');return n?.dataset.state==='saved'||/已保存|已在本机|本机已保存/.test(n?.textContent||'');});
  async function create(page,name,body){await (await page.locator('#new-note').isVisible()?page.locator('#new-note'):page.locator('#list-new')).click();await title(page).fill(name);await input(page).fill(body);await saved(page);}
  const openNote=async(page,name)=>{await page.locator('#note-list [data-note-id]').filter({hasText:name}).first().click();await title(page).waitFor({state:'visible'});};
  const key=process.platform==='darwin'?'Meta':'Control';
  try {
    await record('正式默认空本，三栏及直接输入可达，不带示例内容',async page=>{
      assert.equal(await noteRows(page).count(),0);assert.equal(await title(page).inputValue(),'');assert.equal(await input(page).inputValue(),'');
      await input(page).fill('第一条直接写，不必先填表');await saved(page);assert.equal(await noteRows(page).count(),1);
      assert.equal(await input(page).inputValue(),'第一条直接写，不必先填表');
      await page.screenshot({path:path.join(out,'empty-first-note-desktop.png'),fullPage:true});
    });
    await record('标题正文自动保存，刷新与切换笔记保持原文及身份',async page=>{
      await create(page,'实验报告','## 实验内容\n第一版正文 #课程');const first=await noteRows(page).first().getAttribute('data-note-id');
      await create(page,'会议纪要','下午讨论原型');await openNote(page,'实验报告');await page.screenshot({path:path.join(out,'desktop-light.png'),fullPage:true});assert.equal(await input(page).inputValue(),'## 实验内容\n第一版正文 #课程');
      await input(page).fill('第二版正文，立即切换也应保留');await openNote(page,'会议纪要');await openNote(page,'实验报告');assert.equal(await input(page).inputValue(),'第二版正文，立即切换也应保留');
      await saved(page);await page.reload();await input(page).waitFor({state:'visible'});await openNote(page,'实验报告');assert.equal(await input(page).inputValue(),'第二版正文，立即切换也应保留');assert.equal(await page.locator(`#note-list [data-note-id="${first}"]`).count(),1);assert.equal(await noteRows(page).count(),2);
    });
    await record('Markdown待办勾选改回原文，原文改动也反映任务状态',async page=>{
      await create(page,'任务原文','- [ ] 交实验报告\n- [x] 带电脑\n普通正文不应丢');
      await page.locator('button[data-view="tasks"]').click();
      const task=page.locator('#task-list input[data-task-line="0"]');await task.waitFor({state:'visible'});assert.equal(await task.isChecked(),false);await task.check();await saved(page);await page.locator('button[data-view="all"]').click();await openNote(page,'任务原文');assert.match(await input(page).inputValue(),/^- \[x\] 交实验报告/m);
      await input(page).fill('- [ ] 交实验报告\n- [ ] 带电脑\n普通正文不应丢');await saved(page);await page.locator('button[data-view="tasks"]').click();assert.equal(await task.isChecked(),false);assert.equal(await page.locator('#task-list input[data-task-line="1"]').isChecked(),false);
    });
    await record('全文关键词检索和高亮；CmdK快速打开真实已有笔记',async page=>{
      await create(page,'旅行','把票放在抽屉里');await create(page,'实验记录','明天交实验报告');await page.locator('#note-search').fill('实验报告');
      assert.equal(await noteRows(page).count(),1);assert.match(await noteRows(page).first().textContent(),/实验/);assert.ok(await page.locator('#note-list mark').count()>0);
      await page.locator('#note-search').fill('');await page.keyboard.press(`${key}+k`);await page.locator('#quick-open-dialog').waitFor({state:'visible'});await page.locator('#quick-open-input').fill('旅行');await page.keyboard.press('Enter');await page.locator('#quick-open-dialog').waitFor({state:'hidden'});assert.equal(await title(page).inputValue(),'旅行');
    });
    await record('CmdP命令、新笔记与今日记录不依赖深层菜单',async page=>{
      await page.keyboard.press(`${key}+p`);await page.locator('#command-dialog').waitFor({state:'visible'});await page.locator('#command-input').fill('新');assert.ok(await page.locator('#command-results button').count()>0);await page.keyboard.press('Escape');
      await page.locator('#daily-note').click();await input(page).fill('今天先写下来');await saved(page);const daily=await title(page).inputValue();assert.match(daily,/\d{4}.*\d{1,2}.*\d{1,2}/);
      await page.locator('#daily-note').click();assert.equal(await input(page).inputValue(),'今天先写下来');assert.equal(await noteRows(page).count(),1);
      await page.keyboard.press(`${key}+n`);assert.equal(await title(page).inputValue(),'');assert.equal(await input(page).inputValue(),'');
    });
    await record('双链可导航，反向引用和标签来自实际正文',async page=>{
      await create(page,'项目计划','先交付桌面版 #工作');await create(page,'会议纪要','讨论 [[项目计划]]\n#工作 #原型');
      await page.locator('#preview-toggle').click();await page.locator('#note-preview').waitFor({state:'visible'});await page.locator('#note-preview [data-link-title="项目计划"], #note-preview [data-note-title="项目计划"]').first().click();assert.equal(await title(page).inputValue(),'项目计划');
      await page.locator('#relations-toggle').click();await page.locator('#relations-panel').waitFor({state:'visible'});assert.ok(await page.locator('#backlinks [data-note-id]').filter({hasText:'会议纪要'}).count()>0);
      await page.locator('#backlinks [data-note-id]').filter({hasText:'会议纪要'}).click();assert.equal(await title(page).inputValue(),'会议纪要');assert.match(await input(page).inputValue(),/#原型/);
    });
    await record('编辑预览保留正文，用户HTML与危险链接不执行',async page=>{
      await create(page,'安全预览','# 普通标题\n<img src=x onerror="window.__xss=1">\n<script>window.__xss=2</script>\n[危险](javascript:window.__xss=3)\n**正常加粗**');
      await page.locator('#preview-toggle').click();await page.locator('#note-preview').waitFor({state:'visible'});await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__xss),undefined);assert.equal(await page.locator('#note-preview script, #note-preview [onerror], #note-preview a[href^="javascript:"]').count(),0);assert.ok(await page.locator('#note-preview strong').filter({hasText:'正常加粗'}).count()>0);
      await page.locator('#preview-toggle').click();assert.match(await input(page).inputValue(),/<script>window\.__xss=2<\/script>/);
    });
    await record('预览中新建立即进入可输入正文，原笔记不丢失',async page=>{
      await create(page,'先前笔记','这是已经保存的原正文');await page.locator('#preview-toggle').click();await page.locator('#note-preview').waitFor({state:'visible'});
      await page.keyboard.press(`${key}+n`);await input(page).waitFor({state:'visible'});assert.equal(await input(page).inputValue(),'');await input(page).fill('新笔记可以直接写');await saved(page);
      await openNote(page,'先前笔记');assert.equal(await input(page).inputValue(),'这是已经保存的原正文');
    });
    await record('软删除可恢复，Markdown导出包含实际当前正文',async page=>{
      await create(page,'保存与恢复','## 原始正文\n- [ ] 待办事项');const current=await input(page).inputValue();const pending=page.waitForEvent('download');await page.locator('#export-note').click();const download=await pending;const file=await download.path();assert.match(await fs.readFile(file,'utf8'),/原始正文/);
      await page.locator('#delete-note').click();await page.locator('button[data-view="trash"]').click();assert.ok(await noteRows(page).filter({hasText:'保存与恢复'}).count()>0);await page.locator('#note-list [data-note-id]').filter({hasText:'保存与恢复'}).first().click();await page.locator('#restore-note').click();await page.locator('button[data-view="all"]').click();await openNote(page,'保存与恢复');assert.equal(await input(page).inputValue(),current);
    });
    await record('写入失败不假报已保存，输入完整保留并可另存副本',async page=>{
      await openNote(page,'磁盘原文');await input(page).fill('我正在写的新内容，写入失败也不能丢');
      await page.locator('#error-banner').waitFor({state:'visible'});assert.match(await page.locator('#error-message').textContent(),/失败|保留|未/);
      assert.equal(await input(page).inputValue(),'我正在写的新内容，写入失败也不能丢');assert.doesNotMatch(await page.locator('#save-status').textContent(),/已保存/);
      const before=await page.evaluate(()=>window.__qaNotes.map(note=>note.content));assert.deepEqual(before,['磁盘上原有内容']);
      await page.locator('#save-copy').click();await saved(page);assert.equal(await input(page).inputValue(),'我正在写的新内容，写入失败也不能丢');assert.equal((await page.evaluate(()=>window.__qaNotes)).length,2);
    },{setup:()=>{
      const now=Date.now();window.__qaNotes=[{id:'original.md',title:'磁盘原文',content:'磁盘上原有内容',createdAt:now,updatedAt:now,revision:'r1',tags:[]}];
      const clone=value=>JSON.parse(JSON.stringify(value));
      window.yanqianDesktop={getWorkspace:async()=>({name:'隔离合成测试库',path:'/synthetic-only',local:true}),listNotes:async()=>clone(window.__qaNotes),readNote:async id=>clone(window.__qaNotes.find(note=>note.id===id)),saveNote:async()=>{throw Object.assign(new Error('模拟写入失败，当前输入仍保留'),{code:'STORAGE'});},createNote:async data=>{const note={...data,id:crypto.randomUUID()+'.md',createdAt:Date.now(),updatedAt:Date.now(),revision:crypto.randomUUID(),tags:[]};window.__qaNotes.push(note);return clone(note);},listTrash:async()=>[],onNotesChanged:()=>()=>{},onWorkspaceChanged:()=>()=>{},appInfo:async()=>({name:'眼前日程',version:'QA',platform:'synthetic'}),exportMarkdown:async()=>({canceled:false}),revealNote:async()=>{}};
    }});
    await record('外部修订冲突不会覆盖正在输入，双方正文可各保留',async page=>{
      await openNote(page,'并发原文');await input(page).fill('当前窗口还没保存的正文');
      await page.evaluate(()=>{window.__qaNotes[0]={...window.__qaNotes[0],content:'外部编辑器刚写入的版本',revision:'external-r2'};for(const fn of window.__qaListeners)fn({external:true});});
      await page.locator('#error-banner').waitFor({state:'visible'});assert.equal(await input(page).inputValue(),'当前窗口还没保存的正文');assert.equal(await page.evaluate(()=>window.__qaNotes[0].content),'外部编辑器刚写入的版本');
      assert.doesNotMatch(await page.locator('#save-status').textContent(),/已保存/);await page.locator('#save-copy').click();await saved(page);
      const copies=await page.evaluate(()=>window.__qaNotes.map(note=>note.content));assert.ok(copies.includes('外部编辑器刚写入的版本'));assert.ok(copies.includes('当前窗口还没保存的正文'));
    },{setup:()=>{
      const now=Date.now();window.__qaNotes=[{id:'original.md',title:'并发原文',content:'磁盘原始内容',createdAt:now,updatedAt:now,revision:'r1',tags:[]}];window.__qaListeners=[];const clone=value=>JSON.parse(JSON.stringify(value));
      window.yanqianDesktop={getWorkspace:async()=>({name:'隔离合成冲突库',path:'/synthetic-only',local:true}),listNotes:async()=>clone(window.__qaNotes),readNote:async id=>clone(window.__qaNotes.find(note=>note.id===id)),saveNote:async data=>{const index=window.__qaNotes.findIndex(note=>note.id===data.id);if(index<0||window.__qaNotes[index].revision!==data.expectedRevision)throw Object.assign(new Error('外部修改冲突，当前输入仍保留'),{code:'CONFLICT'});window.__qaNotes[index]={...window.__qaNotes[index],...data,revision:crypto.randomUUID()};return clone(window.__qaNotes[index]);},createNote:async data=>{const note={...data,id:crypto.randomUUID()+'.md',createdAt:Date.now(),updatedAt:Date.now(),revision:crypto.randomUUID(),tags:[]};window.__qaNotes.push(note);return clone(note);},listTrash:async()=>[],onNotesChanged:fn=>{window.__qaListeners.push(fn);return()=>{};},onWorkspaceChanged:()=>()=>{},appInfo:async()=>({name:'眼前日程',version:'QA',platform:'synthetic'}),exportMarkdown:async()=>({canceled:false}),revealNote:async()=>{}};
    }});
    await record('损坏的本机存储明确报错，不自动清空或覆盖原始数据',async page=>{
      await page.locator('#error-banner').waitFor({state:'visible'});assert.match(await page.locator('#error-message').textContent(),/读取|格式|损坏|覆盖/);
      assert.equal(await page.evaluate(()=>localStorage.getItem('yanqian-desktop-v1')),'{ deliberately-broken-json');
      assert.doesNotMatch(await page.locator('#save-status').textContent(),/已保存/);
    },{setup:()=>localStorage.setItem('yanqian-desktop-v1','{ deliberately-broken-json')});
    await record('昼夜设置持久化，窄窗与减少动态效果可用',async page=>{
      await create(page,'窄窗记录','# 清楚地写\n正文不会被侧栏遮挡\n- [ ] 明天继续');await page.locator('#settings-open').click();await page.locator('#settings-dialog').waitFor({state:'visible'});await page.locator('#theme-select').selectOption('dark');await page.keyboard.press('Escape');
      await page.screenshot({path:path.join(out,'narrow-dark-before-reload.png'),fullPage:true});await page.reload();await input(page).waitFor({state:'visible'});assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme||document.body.dataset.theme),'dark');
      const bounds=await page.evaluate(()=>{const input=document.querySelector('#note-content').getBoundingClientRect();return {input:{left:input.left,right:input.right,top:input.top,bottom:input.bottom},width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}});assert.ok(bounds.input.left>=0&&bounds.input.right<=bounds.width+1);assert.ok(bounds.input.top>=0&&bounds.input.top<bounds.height);assert.ok(bounds.scrollWidth<=bounds.width+1);
      await page.screenshot({path:path.join(out,'narrow-dark.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(out,'desktop-dark.png'),fullPage:true});assert.equal(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches),true);
    },{viewport:{width:900,height:800},reduce:true});
  } finally {
    await Promise.allSettled(contexts.map(context=>context.close()));await new Promise(resolve=>server.close(resolve));await writeReport();
  }
  return {count:checks.length,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,errors,externalRequests};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const browser=await require('playwright').chromium.launch({headless:true});
  try{const result=await runDesktopBrowserChecks(browser,{sourceRoot:process.env.YANQIAN_DESKTOP_SOURCE||root,out:process.env.YANQIAN_DESKTOP_TEST_OUT||path.join(root,'tests/artifacts/browser'),only:process.env.YANQIAN_QA_ONLY||''});console.log(JSON.stringify(result,null,2));if(!result.count||result.failed||result.errors.length||result.externalRequests.length)process.exitCode=1;}finally{await browser.close();}
}
