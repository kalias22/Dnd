import type { CampaignMeta } from "../types/fileTypes";

const getFilesApi = () => window.api?.files;

export const listCampaigns = async (): Promise<CampaignMeta[]> => {
  const filesApi = getFilesApi();
  if (!filesApi) return [];
  return filesApi.listCampaigns();
};

export const createCampaign = async (name: string): Promise<CampaignMeta> => {
  const filesApi = getFilesApi();
  if (!filesApi) {
    throw new Error("Desktop filesystem API is not available in browser mode.");
  }
  return filesApi.createCampaign(name);
};
