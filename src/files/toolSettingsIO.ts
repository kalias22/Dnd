import type { ToolSettings } from "../types/fileTypes";

const defaultToolSettings = (): ToolSettings => ({
  brush: {
    mode: "manual",
    action: "place",
    target: "base",
    size: 1,
  },
  selected: {},
  toggles: {
    gridOverlayEnabled: true,
    snapToGrid: true,
  },
});

const getFilesApi = () => window.api?.files;

export const loadToolSettings = async (): Promise<ToolSettings> => {
  const filesApi = getFilesApi();
  if (!filesApi) return defaultToolSettings();
  return filesApi.loadToolSettings();
};

export const saveToolSettings = async (settings: ToolSettings): Promise<ToolSettings> => {
  const filesApi = getFilesApi();
  if (!filesApi) return settings;
  return filesApi.saveToolSettings(settings);
};
