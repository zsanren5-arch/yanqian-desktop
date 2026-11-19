'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const call = async (method, value) => {
  const reply = await ipcRenderer.invoke(`yanqian:${method}`, value);
  // Plain rejection values retain code/details across Electron's contextBridge;
  // throwing an Error would lose its custom properties when Chromium copies it.
  if (!reply?.ok) throw { message:reply?.error?.message || '操作未完成', code:reply?.error?.code || 'OPERATION_FAILED', ...(reply?.error?.details ? {details:reply.error.details} : {}) };
  return reply.value;
};
const subscribe = channel => callback => {
  if (typeof callback !== 'function') return () => {};
  const handler = (_event, value) => callback(value); ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};
contextBridge.exposeInMainWorld('yanqianDesktop', Object.freeze({
  chooseWorkspace: () => call('choose-workspace'),
  getWorkspace: () => call('get-workspace'),
  listNotes: () => call('list-notes'),
  readNote: id => call('read-note', id),
  createNote: data => call('create-note', data),
  saveNote: data => call('save-note', data),
  deleteNote: data => call('delete-note', data),
  listTrash: () => call('list-trash'),
  restoreNote: trashId => call('restore-note', trashId),
  exportMarkdown: data => call('export-markdown', data),
  revealNote: id => call('reveal-note', id),
  appInfo: () => call('app-info'),
  onWorkspaceChanged: subscribe('yanqian:workspace-changed'),
  onNotesChanged: subscribe('yanqian:notes-changed'),
}));
