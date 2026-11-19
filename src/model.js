export const normalizeTitle = value => String(value || '').trim().replace(/[\r\n]+/g, ' ').slice(0, 160) || '无标题笔记';
const withoutCode = value => String(value || '').replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, '');
const normalized = value => String(value || '').normalize('NFKC').toLocaleLowerCase().trim();
export function parseTasks(content) {
  const tasks = []; let fence = false;
  String(content || '').split('\n').forEach((value, line) => {
    if (/^\s*(```|~~~)/.test(value)) { fence = !fence; return; }
    if (fence) return;
    const found = value.replace(/\r$/, '').match(/^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]\s*(.*)$/);
    if (found) tasks.push({ line, text: found[2].trim(), done: found[1].toLowerCase() === 'x' });
  }); return tasks;
}
export function toggleTask(content, line) {
  const lines = String(content || '').split('\n');
  if (!parseTasks(content).some(task => task.line === line)) return content;
  lines[line] = lines[line].replace(/^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\])/, (_,before,state,after) => before + (state.toLowerCase() === 'x' ? ' ' : 'x') + after);
  return lines.join('\n');
}
export function extractLinks(content) {
  return [...new Set([...withoutCode(content).matchAll(/\[\[([^\]\n]+)\]\]/g)].map(match => match[1].split('|')[0].split('#')[0].trim()).filter(Boolean))];
}
export function tagsOf(content) { return [...new Set([...withoutCode(content).matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(match => match[1]))]; }
export function searchNotes(notes, query) {
  const tokens = normalized(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [...notes].sort((a,b) => b.updatedAt - a.updatedAt);
  return notes.map(note => { const title=normalized(note.title), body=normalized(note.content); return { note, score: tokens.every(token => title.includes(token) || body.includes(token)) ? tokens.reduce((score,token) => score+(title.includes(token)?10:1),0) : 0 }; }).filter(x=>x.score).sort((a,b)=>b.score-a.score || b.note.updatedAt-a.note.updatedAt).map(x=>x.note);
}
export function backlinksFor(notes, note) {
  const names = new Set([normalized(note.title), normalized(note.id?.replace(/\.md$/i,'').split('/').pop())]);
  return notes.filter(other=>other.id!==note.id && extractLinks(other.content).some(link=>names.has(normalized(link))));
}
export function resolveLink(notes, title) { return notes.find(note=>normalized(note.title)===normalized(title) || normalized(note.id?.replace(/\.md$/i,'').split('/').pop())===normalized(title)); }
export function dailyTitle(date = new Date()) { const two = n=>String(n).padStart(2,'0'); return `${date.getFullYear()}-${two(date.getMonth()+1)}-${two(date.getDate())}`; }
export function localDateLabel(date = new Date()) { return date.toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'}); }
export function safeFilename(title) { return normalizeTitle(title).replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').replace(/^\.+/g,'').replace(/[. ]+$/g,'').slice(0,100) || '笔记'; }
export function countWords(content) { const text=String(content||''); return (text.match(/[\p{Script=Han}]/gu)||[]).length + (text.replace(/[\p{Script=Han}]/gu,' ').match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu)||[]).length; }
export function importLegacyRecords(value) {
  if (!value || typeof value!=='object' || !Array.isArray(value.items) || !Array.isArray(value.notes)) throw new Error('不是眼前日程备份，请选择 Markdown 或原版 JSON 文件');
  const records=[...value.items.map(x=>({...x,task:true})),...value.notes];
  if(records.length>10000)throw new Error('备份条目过多，请分批导入');
  return records.filter(x=>x && typeof x.text==='string' && x.text.trim() && x.deletedAt==null).map(x=>({title:normalizeTitle(x.text.split('\n')[0]),content:(x.task?`- [${x.completed?'x':' '}] `:'')+x.text+(x.date?`\n\n日期：${x.date}${x.time?' '+x.time:''}`:'')+(x.location?`\n地点：${x.location}`:'')+(x.notes?`\n\n${x.notes}`:'')}));
}
