const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),
  downloadVideo: (data) => ipcRenderer.invoke("download-video", data),
});
