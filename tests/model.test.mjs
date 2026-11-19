import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseTasks,toggleTask,extractLinks,tagsOf,searchNotes,backlinksFor,dailyTitle,safeFilename,countWords} from '../src/model.js';

test('Markdown tasks are real list lines, not code samples or prose',()=>{
 const content='- [ ] 交报告\n- [x] 带电脑\n普通 [ ] 不是任务\n```md\n- [ ] 代码示例\n```\n  - [X] 子任务';
 assert.deepEqual(parseTasks(content).map(({line,text,done})=>({line,text,done})),[{line:0,text:'交报告',done:false},{line:1,text:'带电脑',done:true},{line:6,text:'子任务',done:true}]);
});
test('toggling a task modifies only the chosen checkbox and preserves every other character',()=>{
 const content='标题\r\n  - [ ] 交报告  \r\n正文与😀\r\n- [x] 完成项';
 assert.equal(toggleTask(content,1),'标题\r\n  - [x] 交报告  \r\n正文与😀\r\n- [x] 完成项');
 assert.equal(toggleTask(toggleTask(content,1),1),content);assert.equal(toggleTask(content,2),content);
});
test('links are optional, deduplicated and backed by notes rather than invented graph data',()=>{
 const notes=[{id:'a.md',title:'项目计划',content:'正文'},{id:'b.md',title:'会议纪要',content:'讨论 [[项目计划]]\n再次 [[项目计划]]'},{id:'c.md',title:'无关',content:'普通正文'}];
 assert.deepEqual(extractLinks(notes[1].content),['项目计划']);assert.deepEqual(backlinksFor(notes,notes[0]).map(note=>note.id),['b.md']);assert.deepEqual(backlinksFor(notes,notes[2]),[]);
});
test('tags and full text search use title/body and keep original notes unchanged',()=>{
 const notes=[{id:'a',title:'实验',content:'交报告 #课程 #课程'},{id:'b',title:'旅行',content:'把票放进抽屉'}],original=JSON.stringify(notes);
 assert.ok(tagsOf(notes[0].content).includes('课程'));assert.equal(tagsOf(notes[0].content).filter(tag=>tag==='课程').length,1);
 assert.deepEqual(searchNotes(notes,'报告').map(note=>note.id),['a']);assert.deepEqual(searchNotes(notes,'抽屉').map(note=>note.id),['b']);assert.equal(JSON.stringify(notes),original);
});
test('daily note title and filename are safe for normal cross-platform export',()=>{
 assert.match(dailyTitle(new Date(2026,10,19,12)),/2026.*11.*19/);
 for(const title of ['../secret','a/b\\c','CON:foo?*','\0bad\nname']){const result=safeFilename(title);assert.equal(typeof result,'string');assert.ok(result.length>0);assert.ok(!/[\\/\x00-\x1f]/.test(result));assert.ok(!result.startsWith('.'));}
 assert.equal(countWords(''),0);assert.ok(countWords('中文与English 😀')>0);
});
