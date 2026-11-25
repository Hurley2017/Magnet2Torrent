'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('magnetDesktop', {
  getInitInfo: () => ipcRenderer.invoke('m2t:init-info'),
  search: (query) => ipcRenderer.invoke('m2t:search', query),
  resolveMagnet: (item) => ipcRenderer.invoke('m2t:resolve-magnet', item),
  openExternal: (url) => ipcRenderer.invoke('m2t:open-external', url),
  startVlcStream: (payload) => ipcRenderer.invoke('m2t:stream-start', payload),
  selectStreamFile: (index) => ipcRenderer.invoke('m2t:stream-select-file', index),
  stopStream: () => ipcRenderer.invoke('m2t:stream-stop'),
  reopenVlc: (customPath) => ipcRenderer.invoke('m2t:stream-reopen-vlc', customPath),
  pickVlcPath: () => ipcRenderer.invoke('m2t:pick-vlc-path'),
  onStreamEvent: (handler) => {
    if (typeof handler !== 'function') return () => {};
    const listener = (_event, data) => handler(data);
    ipcRenderer.on('m2t:stream-event', listener);
    return () => ipcRenderer.removeListener('m2t:stream-event', listener);
  },
});
