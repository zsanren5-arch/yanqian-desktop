import { marked } from '../vendor/marked.js';
import DOMPurify from '../vendor/purify.js';
import { browserStore } from './browser-store.js';
import { normalizeTitle,parseTasks,toggleTask,extractLinks,tagsOf,searchNotes,backlinksFor,resolveLink,dailyTitle,localDateLabel,countWords,importLegacyRecords } from './model.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], api=window.yanqianDesktop || browserStore;
const icon=name=>{const e=document.createElement('i');e.dataset.lucide=name;return e;};
const icons=()=>window.lucide?.createIcons({attrs:{'aria-hidden':'true'}});
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
let notes=[],trash=[],current=null,workspace=null,view='all',filterTag='',query='',preview=false,dirty=false,saving=null,timer=null,serial=0,errorState=false,selectedTrash=null,toastTimer,commandIndex=0,quickIndex=0;
const draftStorage=api===browserStore?sessionStorage:localStorage;
const draftKey=()=>`yanqian-desktop-editor-v1:${workspace?.path || ''}`;
const content=()=>$('#note-content').value, title=()=>$('#note-title').value;
const nowLabel=value=>new Date(value).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'})+' '+new Date(value).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function status(text,error=false){$('#save-status').textContent=text;$('#save-status').dataset.error=String(error);}
function toast(text,action){clearTimeout(toastTimer);$('#toast span').textContent=text;$('#toast').hidden=false;const button=$('#toast-action');button.hidden=!action;button.onclick=action?async()=>{button.hidden=true;await action();$('#toast').hidden=true;}:null;toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
function errorMessage(error){return error?.message || '操作失败，当前文字仍保留。';}
function showError(error){errorState=true;$('#error-banner').hidden=false;$('#error-message').textContent=errorMessage(error);status('尚未保存',true);}
function clearError(){errorState=false;$('#error-banner').hidden=true;}
function storeDraft(){try{draftStorage.setItem(draftKey(),JSON.stringify({id:current?.id || null,revision:current?.revision,title:title(),content:content(),at:Date.now()}));}catch{status('草稿缓存失败，正在尝试写入笔记库',true);}}
function clearDraft(){try{draftStorage.removeItem(draftKey());}catch{}}
function updateMeta(){
 const text=content();$('#word-count').textContent=`${countWords(text)} 字`;$('#note-tags').textContent=tagsOf(text).map(tag=>'#'+tag).join('  ');
 $('#note-breadcrumb').textContent=title().trim() || '新笔记';$('#document-empty-hint').hidden=!!text.trim() || !!title().trim();
 $('#note-meta').textContent=current?`修改于 ${nowLabel(current.updatedAt)}`:'Markdown 随写随存';
 $('#document-date').textContent=current?new Date(current.createdAt).toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'}):localDateLabel();
 $('#delete-note').disabled=!current;$('#export-note').disabled=!current && !text.trim() && !title().trim();$('#file-reveal').disabled=!current;
 if(!$('#relations-panel').hidden)renderRelations();
}
function upsert(note){const index=notes.findIndex(x=>x.id===note.id);if(index<0)notes.push(note);else notes[index]=note;}
function edited(){serial++;dirty=true;clearError();status('正在保存…');storeDraft();updateMeta();clearTimeout(timer);timer=setTimeout(()=>flush(),450);}
async function flush(){
 clearTimeout(timer);
 if(saving){await saving;return dirty&&!errorState?flush():!errorState;}
 if(!dirty)return true;
 const snapshot={id:current?.id,title:normalizeTitle(title() || content().split('\n').find(x=>x.trim())?.replace(/^#+\s*/,'')),content:content(),expectedRevision:current?.revision}, capturedSerial=serial;
 if(!snapshot.id&&!snapshot.content.trim()&&!title().trim()){dirty=false;clearDraft();status('打开即可写');return true;}
 status('正在保存…');
 saving=(async()=>{
  try{
   const note=await (snapshot.id?api.saveNote(snapshot):api.createNote(snapshot));upsert(note);current=note;
   if(capturedSerial===serial){dirty=false;clearDraft();clearError();status('已保存到本地');}
   else{storeDraft();status('正在保存…');}
   renderList();updateMeta();return true;
  }catch(error){showError(error);storeDraft();return false;}
 })();
 const result=await saving;saving=null;
 if(result&&dirty)return flush();return result;
}
function highlighted(text,term=query){const span=el('span');if(!term.trim()){span.textContent=text;return span;}const lower=text.toLocaleLowerCase(),needle=term.trim().toLocaleLowerCase();let at=0,index;while((index=lower.indexOf(needle,at))>=0){span.append(document.createTextNode(text.slice(at,index)),el('mark','',text.slice(index,index+needle.length)));at=index+needle.length;}span.append(document.createTextNode(text.slice(at)));return span;}
function shownNotes(){let list=searchNotes(notes,query);if(filterTag)list=list.filter(n=>tagsOf(n.content).includes(filterTag));if(view==='today')list=list.filter(n=>n.title===dailyTitle() || dailyTitle(new Date(n.updatedAt))===dailyTitle());return list;}
function renderList(){
 const list=$('#note-list');list.replaceChildren();const rows=view==='trash'?[...trash].sort((a,b)=>b.deletedAt-a.deletedAt):shownNotes();
 $('#list-title').textContent=filterTag?'#'+filterTag:({all:'全部笔记',today:'今天',tasks:'笔记与清单',trash:'最近删除'}[view]);$('#list-count').textContent=`${rows.length} 篇笔记`;
 $('#all-count').textContent=notes.length;$('#tasks-count').textContent=notes.reduce((sum,n)=>sum+parseTasks(n.content).filter(t=>!t.done).length,0);$('#trash-count').textContent=trash.length || '';
 $('#list-empty').hidden=!!rows.length;$('#list-empty p').textContent=query?'没有找到相关笔记':view==='trash'?'回收站是空的':'还没有笔记';$('#list-empty span').textContent=query?'换个关键词试试，标题和正文都能搜。':view==='trash'?'删除的笔记可以在这里找回。':'直接在右边写，内容会自动保存。';
 for(const note of rows){const button=el('button','note-item'+((view==='trash'?selectedTrash?.trashId===note.trashId:current?.id===note.id)?' active':''));button.dataset.noteId=note.id;const heading=el('strong');heading.append(highlighted(note.title));const excerpt=el('p','note-excerpt');excerpt.append(highlighted(note.content.replace(/[#*`\[\]]/g,'').slice(0,170)));const meta=el('span','note-item-meta');meta.append(el('time','',nowLabel(note.updatedAt || note.deletedAt)));const tag=tagsOf(note.content)[0];if(tag)meta.append(el('span','note-tag','#'+tag));button.append(heading,excerpt,meta);button.addEventListener('click',()=>view==='trash'?openTrash(note):openNote(note.id));list.append(button);}
 const tags=[...new Set(notes.flatMap(n=>tagsOf(n.content)))].sort();$('#tag-list').replaceChildren(...tags.map(tag=>{const b=el('button',filterTag===tag?'active':'','# '+tag);b.addEventListener('click',async()=>{if(!await flush())return;filterTag=filterTag===tag?'':tag;setView('all');});return b;}));$('#tags-empty').hidden=!!tags.length;
 $$('button[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
async function reloadNotes(){
 const [next,nextTrash]=await Promise.all([api.listNotes(),api.listTrash()]);notes=next;trash=nextTrash;
 if(!dirty&&!saving&&current){const fresh=notes.find(n=>n.id===current.id);if(fresh&&fresh.revision!==current.revision)fillEditor(fresh);}
 renderList();if(view==='tasks')renderTasks();if(!$('#relations-panel').hidden)renderRelations();
}
function fillEditor(note){current=note;$('#note-title').value=note?.title || '';$('#note-content').value=note?.content || '';dirty=false;clearError();status(note?'已保存到本地':'打开即可写');updateMeta();if(preview)renderPreview();}
function setView(next){view=next;document.body.dataset.view=view;$('#editor-panel').hidden=next==='tasks'||next==='trash';$('#tasks-panel').hidden=next!=='tasks';$('#trash-panel').hidden=next!=='trash';$('#preview-toggle').disabled=next==='tasks'||next==='trash';renderList();if(next==='tasks')renderTasks();if(next==='trash'){selectedTrash=null;$('#trash-detail').replaceChildren(el('p','related-empty','从左边选一篇笔记，查看并恢复。'));$('#restore-note').hidden=true;}try{history.replaceState(null,'','#'+view);}catch{}}
async function openNote(id){if(current?.id===id&&view!=='tasks'&&view!=='trash'){return;}if(!await flush())return;try{const note=await api.readNote(id);filterTag='';setView('all');fillEditor(note);renderList();$('#note-content').focus({preventScroll:true});}catch(error){showError(error);}}
async function newNote(){if(!await flush())return;clearDraft();filterTag='';query='';$('#note-search').value='';setView('all');fillEditor(null);setPreview(false);renderList();$('#note-content').focus({preventScroll:true});}
async function dailyNote(){if(!await flush())return;filterTag='';const name=dailyTitle(),existing=notes.find(n=>n.title===name);if(existing){setView('today');fillEditor(existing);}else{const note=await api.createNote({title:name,content:''});upsert(note);setView('today');fillEditor(note);}setPreview(false);renderList();$('#note-content').focus({preventScroll:true});}
async function saveCopy(){try{clearTimeout(timer);if(saving)await saving;const note=await api.createNote({title:normalizeTitle(title())+'（保留副本）',content:content()});upsert(note);serial++;fillEditor(note);clearDraft();renderList();toast('已保留为新笔记，原文件没有覆盖');}catch(error){showError(error);}}
async function deleteCurrent(){if(!current||!await flush())return;try{const removed=await api.deleteNote({id:current.id,expectedRevision:current.revision});notes=notes.filter(n=>n.id!==current.id);trash=await api.listTrash();fillEditor(null);renderList();toast('已移到最近删除',async()=>{const restored=await api.restoreNote(removed.trashId);upsert(restored);trash=await api.listTrash();fillEditor(restored);renderList();});}catch(error){showError(error);}}
function openTrash(note){selectedTrash=note;$('#trash-detail').replaceChildren(el('h3','',note.title),el('p','field-help',`删除于 ${nowLabel(note.deletedAt)}`),el('p','trash-detail-text',note.content));$('#restore-note').hidden=false;renderList();}
async function restoreSelected(){if(!selectedTrash)return;try{const note=await api.restoreNote(selectedTrash.trashId);upsert(note);trash=await api.listTrash();setView('all');fillEditor(note);renderList();toast('笔记已恢复');}catch(error){showError(error);}}
async function changeWorkspace(){if(!await flush())return;try{const selected=await api.chooseWorkspace();if(!selected)return;workspace=selected;fillEditor(null);await loadWorkspace();setView('all');$('#settings-dialog').close();toast('已打开本地笔记库');}catch(error){toast(errorMessage(error));}}
async function loadWorkspace(){workspace=await api.getWorkspace();$('#workspace-name').textContent=workspace.name;$('#workspace-heading').textContent=workspace.name;$('#workspace-path').textContent=workspace.path;$('#storage-label').textContent=workspace.browser?'本浏览器保存':'本地 Markdown';$('#app-status').textContent=workspace.browser?'本地网页预览':'本地笔记库';await reloadNotes();}
async function exportOne(){if(!await flush()||!current)return;try{const result=await api.exportMarkdown({id:current.id});if(!result.canceled)toast('已导出 Markdown');}catch(error){showError(error);}}
async function importFiles(files){
 if(!await flush())return;let count=0;const drafts=[];
 try{for(const file of files){if(file.size>4*1024*1024)throw new Error('单个文件最多4MB，请分批导入');const raw=await file.text();if(/\.json$/i.test(file.name))drafts.push(...importLegacyRecords(JSON.parse(raw)));else drafts.push({title:normalizeTitle(file.name.replace(/\.(md|markdown|txt)$/i,'')),content:raw});}
  if(drafts.length>10000)throw new Error('本次导入条目过多');
  for(const draft of drafts){const note=await api.createNote(draft);upsert(note);count++;}renderList();toast(`已导入 ${count} 篇笔记`);$('#settings-dialog').close();if(drafts.length)await openNote(notes[notes.length-1].id);
 }catch(error){toast(`${count?'已导入 '+count+' 篇；':''}${errorMessage(error)}`);}
}
// Raw HTML is displayed as text; only generated Markdown is sanitized and rendered.
marked.use({gfm:true,breaks:false,renderer:{html(token){return marked.parseInline(escapeHtml(token.text || token.raw || ''));},image(token){return `<span>图片：${escapeHtml(token.text || '本地附件')}</span>`;}},extensions:[{name:'wikilink',level:'inline',start:source=>source.indexOf('[['),tokenizer(source){const match=source.match(/^\[\[([^\]\n]+)\]\]/);if(!match)return;const [target,alias]=match[1].split('|');return{type:'wikilink',raw:match[0],title:target.split('#')[0].trim(),text:alias || target};},renderer(token){return `<button type="button" class="wiki-link" data-link-title="${escapeHtml(token.title)}">${escapeHtml(token.text)}</button>`;}}]});
function renderPreview(){
 const html=marked.parse(content());$('#note-preview').innerHTML=DOMPurify.sanitize(html,{ADD_TAGS:['button'],ADD_ATTR:['data-link-title'],FORBID_TAGS:['style','svg','math','iframe','form','object','script'],FORBID_ATTR:['style']});
 for(const button of $$('#note-preview [data-link-title]')){button.classList.toggle('missing',!resolveLink(notes,button.dataset.linkTitle));button.addEventListener('click',()=>followLink(button.dataset.linkTitle));}
 const tasks=parseTasks(content()),remaining=[...tasks];
 for(const checkbox of $$('#note-preview input[type="checkbox"]')){const li=checkbox.closest('li'),text=li?.cloneNode(true);text?.querySelectorAll('ul,ol').forEach(n=>n.remove());const label=text?.textContent?.trim();const index=remaining.findIndex(task=>task.text===label);if(index<0)continue;const task=remaining.splice(index,1)[0];checkbox.disabled=false;checkbox.dataset.taskLine=task.line;checkbox.addEventListener('change',async()=>{$('#note-content').value=toggleTask(content(),task.line);edited();await flush();renderPreview();});}
 $('#note-preview').querySelectorAll('a').forEach(a=>{let url;try{url=new URL(a.getAttribute('href'));}catch{a.removeAttribute('href');return;}if(!['https:','http:','mailto:'].includes(url.protocol))a.removeAttribute('href');else{a.target='_blank';a.rel='noopener noreferrer';}});
}
function setPreview(value){preview=value;$('#note-content').hidden=preview;$('#note-preview').hidden=!preview;$('#preview-toggle').setAttribute('aria-pressed',String(preview));$('#preview-toggle').setAttribute('aria-label',preview?'编辑 Markdown':'预览 Markdown');if(preview)renderPreview();else $('#note-content').focus({preventScroll:true});}
async function followLink(name){if(!name)return;const found=resolveLink(notes,name);if(found)return openNote(found.id);if(!await flush())return;try{const note=await api.createNote({title:name,content:''});upsert(note);setView('all');fillEditor(note);renderList();}catch(error){showError(error);}}
function renderRelations(){const note=current?{...current,title:title(),content:content()}:null;$('#outgoing-links').replaceChildren();$('#backlinks').replaceChildren();const links=extractLinks(content());for(const name of links){const b=el('button','related-note');b.dataset.noteTitle=name;b.append(icon('link'),el('span','',name));b.addEventListener('click',()=>followLink(name));$('#outgoing-links').append(b);}if(!links.length)$('#outgoing-links').append(el('p','related-empty','还没有主动关联的笔记。'));const incoming=note?backlinksFor(notes,note):[];for(const linked of incoming){const b=el('button','related-note');b.dataset.noteId=linked.id;b.append(icon('file-text'),el('span','',linked.title));b.addEventListener('click',()=>openNote(linked.id));$('#backlinks').append(b);}if(!incoming.length)$('#backlinks').append(el('p','related-empty','有笔记提到这里时，会自动出现。'));icons();}
function renderTasks(){
 const tasks=notes.flatMap(note=>parseTasks(note.content).map(task=>({...task,note}))).sort((a,b)=>Number(a.done)-Number(b.done)||b.note.updatedAt-a.note.updatedAt);$('#tasks-date').textContent=localDateLabel();$('#tasks-summary').textContent=`${tasks.filter(t=>!t.done).length} 件待办，${tasks.filter(t=>t.done).length} 件已完成。所有清单都来自你的笔记。`;$('#task-list').replaceChildren();$('#tasks-empty').hidden=!!tasks.length;
 for(const task of tasks){const row=el('div','task-row'+(task.done?' done':''));const checkbox=el('input');checkbox.type='checkbox';checkbox.checked=task.done;checkbox.dataset.taskLine=task.line;checkbox.dataset.noteId=task.note.id;checkbox.setAttribute('aria-label',(task.done?'恢复：':'完成：')+task.text);checkbox.addEventListener('change',()=>changeTask(task,checkbox));const text=el('div','task-text'),source=el('button','task-source',task.note.title);source.addEventListener('click',()=>openNote(task.note.id));text.append(el('strong','',task.text),source);row.append(checkbox,text);$('#task-list').append(row);}
}
async function changeTask(task,checkbox){checkbox.disabled=true;try{if(!await flush())return;const latest=await api.readNote(task.note.id);if(latest.revision!==task.note.revision)throw new Error('清单已在别处修改，请刷新后重试');const saved=await api.saveNote({...latest,content:toggleTask(latest.content,task.line),expectedRevision:latest.revision});upsert(saved);if(current?.id===saved.id&&!dirty)fillEditor(saved);renderList();renderTasks();}catch(error){toast(errorMessage(error));await reloadNotes();}finally{checkbox.disabled=false;}}
async function addTask(){const text=$('#task-input').value.trim();if(!text||!await flush())return;try{let note=notes.find(n=>n.title===dailyTitle());const line=`- [ ] ${text.replace(/\n/g,' ')}`;note=note?await api.saveNote({...note,content:note.content+(note.content?'\n':'')+line,expectedRevision:note.revision}):await api.createNote({title:dailyTitle(),content:line});upsert(note);$('#task-input').value='';renderList();renderTasks();}catch(error){toast(errorMessage(error));}}
function openDialog(id){$('#'+id).showModal();}
function showQuick(){quickIndex=0;$('#quick-open-input').value='';renderQuick();openDialog('quick-open-dialog');$('#quick-open-input').focus();}
function renderQuick(){const q=$('#quick-open-input').value;if(q.startsWith('>')){$('#quick-open-dialog').close();showCommands(q.slice(1));return;}const results=searchNotes(notes,q).slice(0,30);$('#quick-open-results').replaceChildren(...results.map((note,index)=>{const b=el('button','palette-result'+(index===quickIndex?' active':''));b.dataset.noteId=note.id;b.append(icon('file-text'),el('span','',note.title),el('small','',nowLabel(note.updatedAt)));b.addEventListener('click',async()=>{$('#quick-open-dialog').close();await openNote(note.id);});return b;}));if(!results.length)$('#quick-open-results').append(el('p','palette-empty',q?'没有找到相关笔记':'写下第一篇笔记后，可以在这里快速打开。'));icons();}
const commands=[{id:'new',name:'新建笔记',key:'⌘ N',icon:'plus',run:newNote},{id:'daily',name:'打开今天的日记',key:'',icon:'sun',run:dailyNote},{id:'tasks',name:'查看待办清单',key:'',icon:'circle-check',run:async()=>{if(await flush())setView('tasks');}},{id:'preview',name:'切换 Markdown 编辑与预览',key:'⌘ ⇧ P',icon:'book-open',run:()=>setPreview(!preview)},{id:'relations',name:'展开关联笔记',key:'',icon:'waypoints',run:()=>toggleRelations(true)},{id:'workspace',name:'打开本地笔记文件夹',key:'',icon:'folder-open',run:changeWorkspace},{id:'export',name:'导出当前 Markdown',key:'',icon:'download',run:exportOne},{id:'theme',name:'切换白天 / 夜晚',key:'',icon:'moon',run:()=>applyTheme(document.documentElement.dataset.theme==='dark'?'light':'dark')},{id:'settings',name:'打开设置',key:'',icon:'settings',run:()=>openDialog('settings-dialog')}];
function showCommands(value=''){commandIndex=0;$('#command-input').value=value;renderCommands();openDialog('command-dialog');$('#command-input').focus();}
function renderCommands(){const q=$('#command-input').value.toLowerCase(),rows=commands.filter(c=>c.name.toLowerCase().includes(q));$('#command-results').replaceChildren(...rows.map((command,index)=>{const b=el('button','palette-result'+(index===commandIndex?' active':''));b.dataset.command=command.id;b.append(icon(command.icon),el('span','',command.name),el('kbd','',command.key));b.addEventListener('click',async()=>{$('#command-dialog').close();await command.run();});return b;}));if(!rows.length)$('#command-results').append(el('p','palette-empty','没有找到这个命令'));icons();}
function paletteKeys(event,selector,kind){const buttons=$$(selector+' button');if(!buttons.length)return;let index=kind==='quick'?quickIndex:commandIndex;if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();index=(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;if(kind==='quick')quickIndex=index;else commandIndex=index;buttons.forEach((b,i)=>b.classList.toggle('active',i===index));buttons[index].scrollIntoView({block:'nearest'});}if(event.key==='Enter'){event.preventDefault();(buttons[index]||buttons[0]).click();}}
function toggleRelations(force){$('#relations-panel').hidden=typeof force==='boolean'?!force:!$('#relations-panel').hidden;$('#relations-toggle').setAttribute('aria-expanded',String(!$('#relations-panel').hidden));if(!$('#relations-panel').hidden)renderRelations();}
const media=matchMedia('(prefers-color-scheme:dark)');let theme='light';try{theme=localStorage.getItem('yanqian-desktop-theme') || 'light';}catch{}
function applyTheme(value,persist=true){theme=['light','dark','system'].includes(value)?value:'light';document.documentElement.dataset.theme=theme==='system'?(media.matches?'dark':'light'):theme;$('#theme-select').value=theme;if(persist)try{localStorage.setItem('yanqian-desktop-theme',theme);}catch{}}
media.addEventListener('change',()=>{if(theme==='system')applyTheme('system',false);});
$('#note-title').addEventListener('input',edited);$('#note-content').addEventListener('input',edited);
$('#note-content').addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();const target=event.target,start=target.selectionStart,end=target.selectionEnd;target.setRangeText('  ',start,end,'end');edited();}});
$('#new-note').addEventListener('click',newNote);$('#list-new').addEventListener('click',newNote);$('#daily-note').addEventListener('click',dailyNote);
$$('button[data-view]').filter(b=>b.id!=='daily-note').forEach(b=>b.addEventListener('click',async()=>{if(!await flush())return;filterTag='';setView(b.dataset.view);}));
$('#note-search').addEventListener('input',event=>{query=event.target.value;renderList();});
$('#preview-toggle').addEventListener('click',()=>setPreview(!preview));$('#relations-toggle').addEventListener('click',()=>toggleRelations());$('#relations-close').addEventListener('click',()=>toggleRelations(false));
$('#delete-note').addEventListener('click',deleteCurrent);$('#restore-note').addEventListener('click',restoreSelected);$('#save-copy').addEventListener('click',saveCopy);$('#retry-save').addEventListener('click',()=>{clearError();flush();});
$('#settings-open').addEventListener('click',()=>openDialog('settings-dialog'));$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));$('#theme-select').addEventListener('change',event=>applyTheme(event.target.value));$('#workspace-open').addEventListener('click',()=>openDialog('settings-dialog'));$('#choose-workspace').addEventListener('click',changeWorkspace);
$('#export-note').addEventListener('click',exportOne);$('#export-all').addEventListener('click',async()=>{if(!await flush())return;try{const result=await api.exportMarkdown({});if(!result.canceled)toast('已导出全部 Markdown');}catch(error){toast(errorMessage(error));}});
$('#import-open').addEventListener('click',()=>$('#import-file').click());$('#import-file').addEventListener('change',event=>{const files=[...event.target.files];event.target.value='';importFiles(files);});
$('#file-reveal').addEventListener('click',async()=>{if(!current||!await flush())return;try{await api.revealNote(current.id);}catch(error){toast(errorMessage(error));}});
$('#task-add').addEventListener('click',addTask);$('#task-input').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();addTask();}});
$('#sidebar-toggle').addEventListener('click',()=>document.body.classList.toggle('sidebar-collapsed'));$('#quick-open').addEventListener('click',showQuick);$('#quick-open-input').addEventListener('input',()=>{quickIndex=0;renderQuick();});$('#command-input').addEventListener('input',()=>{commandIndex=0;renderCommands();});$('#quick-open-input').addEventListener('keydown',event=>paletteKeys(event,'#quick-open-results','quick'));$('#command-input').addEventListener('keydown',event=>paletteKeys(event,'#command-results','command'));
document.addEventListener('keydown',event=>{if(event.isComposing||!(event.metaKey||event.ctrlKey))return;const key=event.key.toLowerCase();if(key==='k'){event.preventDefault();if(!$('#quick-open-dialog').open)showQuick();}else if(key==='p'){event.preventDefault();if(event.shiftKey)setPreview(!preview);else if(!$('#command-dialog').open)showCommands();}else if(key==='n'){event.preventDefault();newNote();}else if(key==='s'){event.preventDefault();flush();}});
window.addEventListener('pagehide',()=>{if(dirty)storeDraft();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty){storeDraft();flush();}});
window.__yanqianFlush=flush;
api.onNotesChanged?.(()=>reloadNotes().catch(showError));api.onWorkspaceChanged?.(async()=>{if(dirty){showError(new Error('笔记库发生变化，当前草稿仍保留，请先另存副本'));return;}await loadWorkspace();fillEditor(null);});
async function boot(){
 applyTheme(theme,false);icons();try{const info=await api.appInfo();document.body.classList.add('platform-'+info.platform);$('#app-version').textContent=info.version;$('#desktop-limit').textContent=info.platform==='browser'?'当前为浏览器预览，内容仅在此浏览器保存。电脑版可选择真实Markdown文件夹。':'本地 Markdown 笔记库。真实文件由你掌握，当前版本不自动同步到原网页私有云。';await loadWorkspace();
 let draft;try{draft=JSON.parse(draftStorage.getItem(draftKey())||'null');}catch{}
 if(draft&&(draft.title?.trim()||draft.content?.trim())){const existing=notes.find(n=>n.id===draft.id)||notes.find(n=>n.content===draft.content&&n.title===normalizeTitle(draft.title));fillEditor(existing||null);$('#note-title').value=String(draft.title||'');$('#note-content').value=String(draft.content||'');if(existing&&existing.content===content()&&existing.title===normalizeTitle(title()))clearDraft();else{if(current&&draft.revision)current={...current,revision:draft.revision};dirty=true;serial++;status('已恢复未保存草稿');storeDraft();}updateMeta();}
 else fillEditor(null);renderList();$('#note-content').focus({preventScroll:true});document.body.dataset.ready='true';
 }catch(error){$('#app-status').textContent='笔记库未能打开';showError(error);document.body.dataset.ready='error';}
}
boot();
