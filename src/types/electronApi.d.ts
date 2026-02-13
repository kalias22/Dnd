import type { CampaignMeta, ToolSettings } from "./fileTypes";

type FileApi = {
  ensureBaseFolders: () => Promise<{ rootPath: string; assetsPath: string; campaignsPath: string }>;
  readJSON: (path: string) => Promise<unknown>;
  writeJSON: (path: string, data: unknown) => Promise<{ path: string }>;
  listCampaigns: () => Promise<CampaignMeta[]>;
  createCampaign: (name: string) => Promise<CampaignMeta>;
  loadToolSettings: () => Promise<ToolSettings>;
  saveToolSettings: (settings: ToolSettings) => Promise<ToolSettings>;
};

declare global {
  interface Window {
    api?: {
      files: FileApi;
    };
  }
}

export {};
