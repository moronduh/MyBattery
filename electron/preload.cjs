const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  sendNotification: (title, body) => ipcRenderer.invoke('notification:send', { title, body }),
})
