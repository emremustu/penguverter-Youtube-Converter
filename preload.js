const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  downloadVideo: (data) => ipcRenderer.invoke("download-video", data),

  getInfo: (url) => ipcRenderer.invoke("get-info", url),

  onProgress: (cb) => ipcRenderer.on("progress", (e, p) => cb(p)),
});
