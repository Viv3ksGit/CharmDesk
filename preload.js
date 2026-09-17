const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("charmdesk", {
  onPerformRitual: (callback) => ipcRenderer.on("perform-ritual", callback),
});
