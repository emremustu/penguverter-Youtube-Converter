const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  selectFolder: () => ipcRenderer.invoke("select-folder"),

  downloadVideo: (data) => ipcRenderer.invoke("download-video", data),

  getInfo: (url) => ipcRenderer.invoke("get-info", url),

  onProgress: (cb) => {
    const wrapper = (e, p) => cb(p);
    cb._ipcWrapper = wrapper;
    ipcRenderer.on("progress", wrapper);
  },

  removeProgress: (cb) => {
    if (cb._ipcWrapper) {
      ipcRenderer.removeListener("progress", cb._ipcWrapper);
    }
  },
});
