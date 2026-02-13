const { contextBridge, ipcRenderer } = require("electron");

const files = {
  ensureBaseFolders: () => ipcRenderer.invoke("files:ensureBaseFolders"),
  readJSON: (path) => ipcRenderer.invoke("files:readJSON", path),
  writeJSON: (path, data) => ipcRenderer.invoke("files:writeJSON", path, data),
  listCampaigns: () => ipcRenderer.invoke("files:listCampaigns"),
  createCampaign: (name) => ipcRenderer.invoke("files:createCampaign", name),
  loadToolSettings: () => ipcRenderer.invoke("files:loadToolSettings"),
  saveToolSettings: (settings) => ipcRenderer.invoke("files:saveToolSettings", settings),
};

contextBridge.exposeInMainWorld("api", { files });
