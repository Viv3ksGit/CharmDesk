const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("charmdesk", {
  onPerformRitual: (callback) => ipcRenderer.on("perform-ritual", callback),
  onShowerPetals: (callback) => ipcRenderer.on("shower-petals", callback),
  onPetalsEnabled: (callback) => ipcRenderer.on("petals-enabled", (_event, enabled) => callback(enabled)),
  onSetCharmImage: (callback) => ipcRenderer.on("set-charm-image", (_event, payload) => callback(payload)),
  showContextMenu: () => ipcRenderer.send("show-context-menu"),
});
