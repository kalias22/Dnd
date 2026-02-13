const FALLBACK_ROOT = "Documents/DND";
const FALLBACK_CAMPAIGNS = `${FALLBACK_ROOT}/Campaigns`;
const FALLBACK_ASSETS = `${FALLBACK_ROOT}/Assets`;

export const getRootPath = async () => {
  const filesApi = window.api?.files;
  if (!filesApi) return FALLBACK_ROOT;
  const paths = await filesApi.ensureBaseFolders();
  return paths.rootPath;
};

export const getCampaignsPath = async () => {
  const filesApi = window.api?.files;
  if (!filesApi) return FALLBACK_CAMPAIGNS;
  const paths = await filesApi.ensureBaseFolders();
  return paths.campaignsPath;
};

export const getAssetsPath = async () => {
  const filesApi = window.api?.files;
  if (!filesApi) return FALLBACK_ASSETS;
  const paths = await filesApi.ensureBaseFolders();
  return paths.assetsPath;
};
