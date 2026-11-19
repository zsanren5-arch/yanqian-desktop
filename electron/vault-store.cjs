'use strict';
const fs = require('node:fs/promises');
const constants = require('node:fs').constants;
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_NOTE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_NOTES = 10000;
class VaultError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const ownKeys = new Set(['yanqian', 'title', 'created', 'updated']);
function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]{0,65536}?)\r?\n---(?:\r?\n|$)/.exec(raw);
  if (!match) return { body: raw, extras: [], values: {} };
  const values = {}, extras = [];
  let currentKnown = false;
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([A-Za-z][\w-]*):(?:\s*(.*))?$/.exec(line);
    if (field) {
      currentKnown = ownKeys.has(field[1]);
      if (currentKnown) { try { values[field[1]] = JSON.parse(field[2]); } catch { values[field[1]] = field[2]?.trim(); } }
      else extras.push(line);
    } else if (!currentKnown) extras.push(line);
  }
  return { body: raw.slice(match[0].length).replace(/^\r?\n/, ''), extras, values };
}
function normalizedText(value, label, max, allowEmpty = true) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > max || value.includes('\0') || (!allowEmpty && !value.trim())) throw new VaultError('INVALID_INPUT', `${label}格式或长度不正确`);
  return value;
}
function titleOf(value) { return normalizedText(value ?? '', '标题', 1000).replace(/[\r\n]/g, ' ').trim().slice(0, 200) || '未命名笔记'; }
function validateId(id) {
  if (typeof id !== 'string' || !id || id.length > 1000 || id.includes('\\') || id.includes('\0') || path.posix.isAbsolute(id) || /^[A-Za-z]:/.test(id) || !/\.md$/i.test(id)) throw new VaultError('INVALID_PATH', '笔记路径不正确');
  const parts = id.split('/');
  if (parts.some(part => !part || part === '.' || part === '..' || part.startsWith('.') || part.length > 240)) throw new VaultError('INVALID_PATH', '不允许访问工作区之外或隐藏目录');
  return id;
}
function iso(value, fallback) { const n = Date.parse(value); return Number.isFinite(n) ? new Date(n).toISOString() : fallback; }
function serialize(title, body, { created, updated, extras = [] }) {
  return `---\nyanqian: 1\ntitle: ${JSON.stringify(title)}\ncreated: ${JSON.stringify(created)}\nupdated: ${JSON.stringify(updated)}${extras.length ? '\n' + extras.join('\n') : ''}\n---\n\n${body}`;
}
class VaultStore {
  constructor(root) { this.requestedRoot = path.resolve(root); this.root = null; this.queue = Promise.resolve(); }
  async init() {
    await fs.mkdir(this.requestedRoot, { recursive: true, mode: 0o700 });
    this.root = await fs.realpath(this.requestedRoot);
    const stat = await fs.stat(this.root); if (!stat.isDirectory()) throw new VaultError('INVALID_WORKSPACE', '请选择文件夹');
    return this;
  }
  info() { return { name: path.basename(this.root), path: this.root, local: true }; }
  async guardRoot() { const stat = await fs.lstat(this.root); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new VaultError('SYMLINK_REJECTED', '工作区位置已经变化，请重新选择'); }
  async checked(id, exists = true) {
    validateId(id);
    await this.guardRoot();
    const parts = id.split('/'); let cursor = this.root;
    for (let index = 0; index < parts.length; index++) {
      cursor = path.join(cursor, parts[index]);
      let stat;
      try { stat = await fs.lstat(cursor); } catch (error) { if (error.code === 'ENOENT' && index === parts.length - 1 && !exists) return cursor; throw error; }
      if (stat.isSymbolicLink()) throw new VaultError('SYMLINK_REJECTED', '为保护文件，不访问符号链接');
      if (index < parts.length - 1 && !stat.isDirectory() || index === parts.length - 1 && !stat.isFile()) throw new VaultError('INVALID_PATH', '请选择Markdown文件');
    }
    const parent = await fs.realpath(path.dirname(cursor));
    if (parent !== this.root && !parent.startsWith(this.root + path.sep)) throw new VaultError('INVALID_PATH', '文件不在当前工作区');
    return cursor;
  }
  async raw(id) {
    const file = await this.checked(id);
    const handle = await fs.open(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    try {
      const stat = await handle.stat(); if (!stat.isFile() || stat.size > MAX_NOTE_BYTES) throw new VaultError('NOTE_TOO_LARGE', '单篇笔记最多2MB');
      const bytes = await handle.readFile(); if (bytes.length > MAX_NOTE_BYTES) throw new VaultError('NOTE_TOO_LARGE', '单篇笔记最多2MB');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      return { bytes, text, stat };
    } finally { await handle.close(); }
  }
  async readNote(id) {
    const { bytes, text, stat } = await this.raw(id), meta = parseFrontmatter(text);
    const firstHeading = /^#\s+(.+)$/m.exec(meta.body)?.[1];
    const title = titleOf(typeof meta.values.title === 'string' ? meta.values.title : firstHeading || path.basename(id, path.extname(id)));
    const tags = [...new Set([...meta.body.matchAll(/(?:^|\s)#([\p{L}\p{N}_/-]+)/gu)].map(x => x[1]))].slice(0, 100);
    return { id, title, content: meta.body, createdAt: iso(meta.values.created, stat.birthtime.toISOString()), updatedAt: iso(meta.values.updated, stat.mtime.toISOString()), revision: hash(bytes), tags };
  }
  async listNotes() {
    await this.guardRoot();
    const ids = []; let total = 0;
    const scan = async (dir, prefix = '', depth = 0) => {
      if (depth > 16) throw new VaultError('WORKSPACE_TOO_DEEP', '目录层级过深，请选择更具体的笔记文件夹');
      for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
        const id = prefix + entry.name;
        if (entry.isDirectory()) await scan(path.join(dir, entry.name), id + '/', depth + 1);
        else if (entry.isFile() && /\.md$/i.test(entry.name)) { validateId(id); ids.push(id); if (ids.length > MAX_NOTES) throw new VaultError('WORKSPACE_TOO_LARGE', '此工作区超过10000篇，请选择更小的文件夹'); }
      }
    };
    await scan(this.root);
    const notes = [];
    for (const id of ids) {
      const note = await this.readNote(id); total += Buffer.byteLength(note.content, 'utf8');
      if (total > MAX_TOTAL_BYTES) throw new VaultError('WORKSPACE_TOO_LARGE', '此工作区超过64MB，请选择更小的文件夹');
      notes.push(note);
    }
    return notes.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  enqueue(operation) { const result = this.queue.then(operation); this.queue = result.catch(() => {}); return result; }
  async createNote(data = {}) { return this.saveNote({ ...data, id: undefined, expectedRevision: undefined }); }
  async saveNote(data = {}) {
    return this.enqueue(async () => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new VaultError('INVALID_INPUT', '笔记格式不正确');
      const title = titleOf(data.title), content = normalizedText(data.content ?? '', '正文', MAX_NOTE_BYTES - 65536);
      const isNew = !data.id, id = isNew ? crypto.randomUUID() + '.md' : validateId(data.id);
      const file = await this.checked(id, !isNew), now = new Date().toISOString(); let created = now, extras = [];
      if (!isNew) {
        const current = await this.raw(id);
        if (typeof data.expectedRevision !== 'string' || data.expectedRevision !== hash(current.bytes)) throw new VaultError('CONFLICT', '磁盘上的笔记已变化，当前输入仍保留，请先核对或另存副本', { id });
        const meta = parseFrontmatter(current.text); created = iso(meta.values.created, current.stat.birthtime.toISOString()); extras = meta.extras;
      }
      const serialized = serialize(title, content, { created, updated: now, extras });
      if (Buffer.byteLength(serialized,'utf8') > MAX_NOTE_BYTES) throw new VaultError('NOTE_TOO_LARGE','笔记与元数据合计最多2MB，原文件仍保留');
      const temp = path.join(path.dirname(file), `.yanqian-${crypto.randomUUID()}.tmp`); let handle;
      try {
        handle = await fs.open(temp, 'wx', 0o600); await handle.writeFile(serialized, 'utf8'); await handle.sync(); await handle.close(); handle = null;
        await this.checked(id, !isNew);
        if (!isNew) { const latest = await this.raw(id); if (hash(latest.bytes) !== data.expectedRevision) throw new VaultError('CONFLICT', '保存前检测到外部修改，请另存副本', { id }); }
        else { try { await fs.lstat(file); throw new VaultError('CONFLICT', '新笔记路径已存在'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
        await fs.rename(temp, file);
        return await this.readNote(id);
      } finally { if (handle) await handle.close(); await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    });
  }
  async privateDirectory(name) {
    await this.guardRoot();
    const parent = path.join(this.root, '.yanqian');
    for (const dir of [parent, path.join(parent, name)]) {
      await fs.mkdir(dir, { mode: 0o700 }).catch(error => { if (error.code !== 'EEXIST') throw error; });
      const stat = await fs.lstat(dir); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new VaultError('SYMLINK_REJECTED', '工作区内部存储路径异常');
    }
    return path.join(parent, name);
  }
  async deleteNote({ id, expectedRevision } = {}) {
    return this.enqueue(async () => {
      const note = await this.readNote(id);
      if (note.revision !== expectedRevision) throw new VaultError('CONFLICT', '文件已变化，未删除');
      const dir = await this.privateDirectory('trash'), trashId = crypto.randomUUID(), target = path.join(dir, trashId + '.json');
      const raw = await this.raw(id); if (hash(raw.bytes) !== expectedRevision) throw new VaultError('CONFLICT', '文件已变化，未删除');
      const record = { trashId, id, title: note.title, deletedAt: new Date().toISOString(), originalRevision: note.revision, markdown: raw.text };
      const handle = await fs.open(target, 'wx', 0o600); try { await handle.writeFile(JSON.stringify(record)); await handle.sync(); } finally { await handle.close(); }
      // Copy is durable before unlink; no permanent deletion route is exposed.
      await this.checked(id); const latest = await this.raw(id);
      if (hash(latest.bytes) !== expectedRevision) throw new VaultError('CONFLICT', '文件已变化，原文件保留');
      await fs.unlink(await this.checked(id));
      return { trashId, id, title: note.title, deletedAt: record.deletedAt };
    });
  }
  async trashRecord(trashId) {
    if (typeof trashId !== 'string' || !/^[0-9a-f-]{36}$/.test(trashId)) throw new VaultError('INVALID_PATH', '恢复编号不正确');
    const dir = await this.privateDirectory('trash'), file = path.join(dir, trashId + '.json'), stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_NOTE_BYTES * 6 + 65536) throw new VaultError('INVALID_PATH', '回收记录不正确');
    const record = JSON.parse(await fs.readFile(file, 'utf8')); validateId(record.id); normalizedText(record.markdown, '恢复内容', MAX_NOTE_BYTES + 65536);
    if (record.trashId !== trashId) throw new VaultError('INVALID_INPUT', '恢复记录不匹配');
    return { record, file };
  }
  async listTrash() {
    const dir = await this.privateDirectory('trash'), result = [];
    for (const name of await fs.readdir(dir)) { if (!/^[0-9a-f-]{36}\.json$/.test(name)) continue; const {record}=await this.trashRecord(name.slice(0,-5)); result.push({trashId:record.trashId,id:record.id,title:record.title,deletedAt:record.deletedAt}); }
    return result.sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  }
  async restoreNote(trashId) {
    return this.enqueue(async () => {
      const { record, file } = await this.trashRecord(trashId);
      // Restore under a fresh root ID if the old path has been reused or its parent moved.
      let id = record.id, destination;
      try { destination = await this.checked(id, false); try { await fs.lstat(destination); id = crypto.randomUUID() + '.md'; } catch(error) { if(error.code !== 'ENOENT') throw error; } }
      catch { id = crypto.randomUUID() + '.md'; }
      destination = await this.checked(id, false);
      const handle = await fs.open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW || 0), 0o600);
      try { await handle.writeFile(record.markdown, 'utf8'); await handle.sync(); } finally { await handle.close(); }
      await fs.unlink(file); return this.readNote(id);
    });
  }
}
module.exports = { VaultStore, VaultError, validateId, parseFrontmatter, MAX_NOTE_BYTES };
