import { normalizeTitle, tagsOf, safeFilename } from './model.js';
const KEY='yanqian-desktop-v1';
const error=(code,message)=>Object.assign(new Error(message),{code});
function read() {
  const raw=localStorage.getItem(KEY);if(!raw)return {notes:[],trash:[]};
  let value;try{value=JSON.parse(raw);}catch{throw error('CORRUPT','本机预览数据无法读取，原始内容未覆盖。请先导出浏览器数据。');}
  if(!Array.isArray(value.notes)||!Array.isArray(value.trash))throw error('CORRUPT','本机预览数据格式有误，原始内容未覆盖');return value;
}
function write(value){try{localStorage.setItem(KEY,JSON.stringify(value));}catch{throw error('STORAGE','本机空间不足，文字仍保留在编辑器中，请导出Markdown');}}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const listeners=new Set();window.addEventListener('storage',event=>{if(event.key===KEY)for(const fn of listeners)fn({external:true});});
export const browserStore={
 async getWorkspace(){return{name:'浏览器本地笔记',path:'当前浏览器独立保存',local:true,browser:true};},
 async chooseWorkspace(){throw error('DESKTOP_ONLY','请在电脑版中选择本地文件夹；当前网页预览保存在浏览器内');},
 async listNotes(){return read().notes;},
 async readNote(id){const note=read().notes.find(n=>n.id===id);if(!note)throw error('NOT_FOUND','笔记已被移动或删除');return note;},
 async createNote({title,content=''}){const state=read(),now=Date.now();const note={id:crypto.randomUUID()+'.md',title:normalizeTitle(title),content:String(content),createdAt:now,updatedAt:now,revision:crypto.randomUUID(),tags:tagsOf(content)};state.notes.push(note);write(state);return note;},
 async saveNote({id,title,content,expectedRevision}){const state=read(),index=state.notes.findIndex(n=>n.id===id);if(index<0)throw error('NOT_FOUND','笔记已被移动或删除，当前草稿仍保留');if(expectedRevision!==state.notes[index].revision)throw error('CONFLICT','这篇笔记在别处被修改了，当前草稿已保留');const note={...state.notes[index],title:normalizeTitle(title),content:String(content),updatedAt:Date.now(),revision:crypto.randomUUID(),tags:tagsOf(content)};state.notes[index]=note;write(state);return note;},
 async deleteNote({id,expectedRevision}){const state=read(),note=state.notes.find(n=>n.id===id);if(!note)throw error('NOT_FOUND','笔记不存在');if(note.revision!==expectedRevision)throw error('CONFLICT','笔记已有新的修改，请刷新后再删除');const item={...note,trashId:crypto.randomUUID(),deletedAt:Date.now()};state.trash.push(item);state.notes=state.notes.filter(n=>n.id!==id);write(state);return item;},
 async listTrash(){return read().trash;},
 async restoreNote(trashId){const state=read(),note=state.trash.find(n=>n.trashId===trashId);if(!note)throw error('NOT_FOUND','回收站条目不存在');const {deletedAt,trashId:unused,...original}=note;const restored={...original,id:state.notes.some(n=>n.id===original.id)?crypto.randomUUID()+'.md':original.id,revision:crypto.randomUUID(),updatedAt:Date.now()};state.notes.push(restored);state.trash=state.trash.filter(n=>n.trashId!==trashId);write(state);return restored;},
 async exportMarkdown({id}={}){const notes=id?read().notes.filter(n=>n.id===id):read().notes;for(const note of notes)download(`# ${note.title}\n\n${note.content}\n`,safeFilename(note.title)+'.md');return{canceled:false,path:'浏览器下载目录'};},
 async revealNote(){throw error('DESKTOP_ONLY','电脑版可在访达/资源管理器里打开真实Markdown文件');},
 async appInfo(){return{name:'眼前日程',version:'1.0.0-desktop',platform:'browser',vibe:'由用户与 ChatGPT 一起 vibe coding 完成'};},
 onNotesChanged(fn){listeners.add(fn);return()=>listeners.delete(fn);},onWorkspaceChanged(){return()=>{};}
};
