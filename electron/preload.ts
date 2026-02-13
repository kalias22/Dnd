import { contextBridge, ipcRenderer } from "electron";

const files = {
  ensureBaseFolders: () => ipcRenderer.invoke("files:ensureBaseFolders"),
  readJSON: (path: string) => ipcRenderer.invoke("files:readJSON", path),
  writeJSON: (path: string, data: unknown) => ipcRenderer.invoke("files:writeJSON", path, data),
  listCampaigns: () => ipcRenderer.invoke("files:listCampaigns"),
  createCampaign: (name: string) => ipcRenderer.invoke("files:createCampaign", name),
  loadToolSettings: () => ipcRenderer.invoke("files:loadToolSettings"),
  saveToolSettings: (settings: unknown) => ipcRenderer.invoke("files:saveToolSettings", settings),
};

contextBridge.exposeInMainWorld("api", { files });
