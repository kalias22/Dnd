import type { TileMaterial, TileMaterialTextures } from "../../../pixi";
import type { CampaignMeta, ToolSettings, TileMaterialSetting } from "../../../types/fileTypes";

export type TileLibraryAsset = {
  id: string;
  name: string;
  fileName: string;
  relativePath: string;
  url: string;
};

export type CampaignSummary = CampaignMeta & {
  folderName?: string;
};

export type CampaignTileEntry = {
  assetId: string;
  priority: number;
};

export type CampaignSceneEntry = {
  id: string;
  name: string;
  file: string;
  updatedAt?: string;
};

export type CampaignFileShape = CampaignMeta & {
  campaignAssets?: {
    tiles?: CampaignTileEntry[];
  };
  tileMaterials?: TileMaterial[];
  settings?: Record<string, unknown>;
  scenes: CampaignSceneEntry[];
};

export type ActiveCampaignRef = {
  id: string | null;
  name: string | null;
};

export type BrushSettingsChangedPayload = {
  brushMode: ToolSettings["brush"]["mode"];
  brushAction: ToolSettings["brush"]["action"];
  brushTarget: ToolSettings["brush"]["target"];
  gridOverlayEnabled: boolean;
  snapToGrid: boolean;
};

export type TileSelectedPayload = {
  assetId: string;
  name: string;
  url: string;
  materialId?: string | null;
};

export type TileLibraryChangedPayload = {
  assets: TileLibraryAsset[];
};

export type TileMaterialsChangedPayload = {
  materials: TileMaterial[];
  selectedMaterialId?: string | null;
};

export type TileSettingsEditPayload = {
  assetId: string;
};

export type SceneSelectedPayload = {
  campaignId: string;
  sceneId: string;
};

export const ACTIVE_CAMPAIGN_STORAGE_KEY = "dnd:active-campaign";
export const ACTIVE_CAMPAIGN_CHANGED_EVENT = "dnd:active-campaign-changed";
export const BOARD_BRUSH_SETTINGS_CHANGED_EVENT = "dnd:board-brush-settings-changed";
export const BOARD_TILE_SELECTED_EVENT = "dnd:board-tile-selected";
export const BOARD_TILE_LIBRARY_CHANGED_EVENT = "dnd:board-tile-library-changed";
export const BOARD_TILE_MATERIALS_CHANGED_EVENT = "dnd:board-tile-materials-changed";
export const BOARD_TILE_SETTINGS_EDIT_EVENT = "dnd:board-tile-settings-edit";
export const BOARD_SCENE_SELECTED_EVENT = "dnd:board-scene-selected";

const TILE_NAME_SUFFIXES = [
  "_overlay_ne_corner",
  "_overlay_nw_corner",
  "_overlay_se_corner",
  "_overlay_sw_corner",
  "_overlay_corner_ne",
  "_overlay_corner_nw",
  "_overlay_corner_se",
  "_overlay_corner_sw",
  "_overlay_horizontal_corner",
  "_overlay_vertical_corner",
  "_overlay_corner",
  "_overlay_horizontal",
  "_overlay_vertical",
  "_overlay",
];

const toTileNameKey = (value: string) => value.trim().toLowerCase();

export const getTileBaseNameStem = (name: string) => {
  const trimmed = name.trim();
  const lowered = trimmed.toLowerCase();
  for (const suffix of TILE_NAME_SUFFIXES) {
    if (lowered.endsWith(suffix)) {
      return trimmed.slice(0, trimmed.length - suffix.length).trim();
    }
  }
  return trimmed;
};

const findTileAssetIdByNameVariants = (
  byNameKey: Map<string, TileLibraryAsset>,
  baseStem: string,
  suffixVariants: string[]
) => {
  for (const suffix of suffixVariants) {
    const asset = byNameKey.get(toTileNameKey(`${baseStem}${suffix}`));
    if (asset) return asset.id;
  }
  return "";
};

export const inferTileMaterialTextures = (
  baseTile: TileLibraryAsset,
  libraryAssets: TileLibraryAsset[]
): TileMaterialTextures => {
  const baseStem = getTileBaseNameStem(baseTile.name);
  const byNameKey = new Map<string, TileLibraryAsset>();
  for (const asset of libraryAssets) {
    byNameKey.set(toTileNameKey(asset.name), asset);
  }

  const overlayHorizontalAssetId = findTileAssetIdByNameVariants(byNameKey, baseStem, ["_overlay_horizontal"]);
  const overlayVerticalAssetId = findTileAssetIdByNameVariants(byNameKey, baseStem, ["_overlay_vertical"]);
  const overlayAssetId =
    findTileAssetIdByNameVariants(byNameKey, baseStem, ["_overlay"]) ||
    overlayHorizontalAssetId ||
    overlayVerticalAssetId;

  return {
    baseAssetId: baseTile.id,
    overlayAssetId,
    cornerOverlayAssetId: findTileAssetIdByNameVariants(byNameKey, baseStem, ["_overlay_corner"]),
    overlayHorizontalAssetId,
    overlayVerticalAssetId,
    cornerOverlayHorizontalAssetId: "",
    cornerOverlayVerticalAssetId: "",
    cornerOverlayNeAssetId: findTileAssetIdByNameVariants(byNameKey, baseStem, [
      "_overlay_ne_corner",
      "_overlay_corner_ne",
    ]),
    cornerOverlayNwAssetId: findTileAssetIdByNameVariants(byNameKey, baseStem, [
      "_overlay_nw_corner",
      "_overlay_corner_nw",
    ]),
    cornerOverlaySeAssetId: findTileAssetIdByNameVariants(byNameKey, baseStem, [
      "_overlay_se_corner",
      "_overlay_corner_se",
    ]),
    cornerOverlaySwAssetId: findTileAssetIdByNameVariants(byNameKey, baseStem, [
      "_overlay_sw_corner",
      "_overlay_corner_sw",
    ]),
  };
};

const getFilesApi = () => window.api?.files;

export const defaultToolSettings = (): ToolSettings => ({
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
  tileMaterialSettings: {},
});

export const mergeToolSettings = (value: unknown): ToolSettings => {
  const defaults = defaultToolSettings();
  if (!value || typeof value !== "object") return defaults;
  const source = value as Partial<ToolSettings>;
  const rawTileSettings = source.tileMaterialSettings;
  const tileMaterialSettings: Record<string, TileMaterialSetting> = {};
  if (rawTileSettings && typeof rawTileSettings === "object") {
    for (const [assetId, setting] of Object.entries(rawTileSettings)) {
      if (!assetId || !setting || typeof setting !== "object") continue;
      const sourceSetting = setting as TileMaterialSetting;
      const sourceTextures = sourceSetting.textures;
      tileMaterialSettings[assetId] = {
        rotationMode: sourceSetting.rotationMode === "none" ? "none" : "random90",
        noOverlay: Boolean(sourceSetting.noOverlay),
        textures:
          sourceTextures && typeof sourceTextures === "object"
            ? {
                overlayAssetId:
                  typeof sourceTextures.overlayAssetId === "string" ? sourceTextures.overlayAssetId : "",
                cornerOverlayAssetId:
                  typeof sourceTextures.cornerOverlayAssetId === "string"
                    ? sourceTextures.cornerOverlayAssetId
                    : "",
                overlayHorizontalAssetId:
                  typeof sourceTextures.overlayHorizontalAssetId === "string"
                    ? sourceTextures.overlayHorizontalAssetId
                    : "",
                overlayVerticalAssetId:
                  typeof sourceTextures.overlayVerticalAssetId === "string"
                    ? sourceTextures.overlayVerticalAssetId
                    : "",
                cornerOverlayHorizontalAssetId:
                  typeof sourceTextures.cornerOverlayHorizontalAssetId === "string"
                    ? sourceTextures.cornerOverlayHorizontalAssetId
                    : "",
                cornerOverlayVerticalAssetId:
                  typeof sourceTextures.cornerOverlayVerticalAssetId === "string"
                    ? sourceTextures.cornerOverlayVerticalAssetId
                    : "",
                cornerOverlayNeAssetId:
                  typeof sourceTextures.cornerOverlayNeAssetId === "string"
                    ? sourceTextures.cornerOverlayNeAssetId
                    : "",
                cornerOverlayNwAssetId:
                  typeof sourceTextures.cornerOverlayNwAssetId === "string"
                    ? sourceTextures.cornerOverlayNwAssetId
                    : "",
                cornerOverlaySeAssetId:
                  typeof sourceTextures.cornerOverlaySeAssetId === "string"
                    ? sourceTextures.cornerOverlaySeAssetId
                    : "",
                cornerOverlaySwAssetId:
                  typeof sourceTextures.cornerOverlaySwAssetId === "string"
                    ? sourceTextures.cornerOverlaySwAssetId
                    : "",
              }
            : {},
      };
    }
  }
  return {
    brush: {
      mode: source.brush?.mode ?? defaults.brush.mode,
      action: source.brush?.action ?? defaults.brush.action,
      target: source.brush?.target ?? defaults.brush.target,
      size: typeof source.brush?.size === "number" ? source.brush.size : defaults.brush.size,
    },
    selected: {
      ...(source.selected ?? {}),
    },
    toggles: {
      gridOverlayEnabled: source.toggles?.gridOverlayEnabled ?? defaults.toggles.gridOverlayEnabled,
      snapToGrid: source.toggles?.snapToGrid ?? defaults.toggles.snapToGrid,
    },
    tileMaterialSettings,
  };
};

export const readActiveCampaignRef = (): ActiveCampaignRef => {
  try {
    const raw = window.localStorage.getItem(ACTIVE_CAMPAIGN_STORAGE_KEY);
    if (!raw) return { id: null, name: null };
    const parsed = JSON.parse(raw) as { id?: unknown; name?: unknown };
    return {
      id: typeof parsed.id === "string" && parsed.id.trim() ? parsed.id : null,
      name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name : null,
    };
  } catch {
    return { id: null, name: null };
  }
};

export const resolveActiveCampaign = (campaigns: CampaignSummary[]): CampaignSummary | null => {
  if (campaigns.length === 0) return null;
  const active = readActiveCampaignRef();
  if (active.id) {
    const byId = campaigns.find((campaign) => campaign.id === active.id);
    if (byId) return byId;
  }
  if (active.name) {
    const byName = campaigns.find((campaign) => campaign.name === active.name);
    if (byName) return byName;
  }
  if (campaigns.length === 1) return campaigns[0];
  return null;
};

export const getCampaignFolderName = (campaign: CampaignSummary) => campaign.folderName || campaign.name;

export const getCampaignJsonPath = (campaign: CampaignSummary) =>
  `Campaigns/${getCampaignFolderName(campaign)}/campaign.json`;

export const loadCampaignFile = async (campaign: CampaignSummary): Promise<CampaignFileShape> => {
  const filesApi = getFilesApi();
  if (!filesApi) {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      scenes: Array.isArray(campaign.scenes) ? campaign.scenes : [],
    };
  }

  try {
    const parsed = (await filesApi.readJSON(getCampaignJsonPath(campaign))) as CampaignFileShape;
    return {
      ...parsed,
      id: parsed.id ?? campaign.id,
      name: parsed.name ?? campaign.name,
      description: parsed.description ?? campaign.description,
      scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
      campaignAssets: parsed.campaignAssets ?? { tiles: [] },
      settings: parsed.settings ?? {},
    };
  } catch {
    return {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      scenes: Array.isArray(campaign.scenes) ? campaign.scenes : [],
      campaignAssets: { tiles: [] },
      settings: {},
    };
  }
};

export const saveCampaignFile = async (campaign: CampaignSummary, data: CampaignFileShape) => {
  const filesApi = getFilesApi();
  if (!filesApi) return;
  await filesApi.writeJSON(getCampaignJsonPath(campaign), data);
};

export const loadCampaignSummaries = async (): Promise<CampaignSummary[]> => {
  const filesApi = getFilesApi();
  if (!filesApi) return [];
  const campaigns = (await filesApi.listCampaigns()) as CampaignSummary[];
  return campaigns;
};

export const loadTileLibrary = async (): Promise<TileLibraryAsset[]> => {
  const filesApi = getFilesApi();
  if (!filesApi || typeof filesApi.listTileLibrary !== "function") return [];
  const assets = (await filesApi.listTileLibrary()) as TileLibraryAsset[];
  return assets;
};

export const importTileLibraryFiles = async (sourcePaths: string[]): Promise<TileLibraryAsset[]> => {
  const filesApi = getFilesApi();
  if (!filesApi || typeof filesApi.importTileAssets !== "function") return [];
  const assets = (await filesApi.importTileAssets(sourcePaths)) as TileLibraryAsset[];
  return assets;
};

type OpenTilesFolderResult = {
  path: string;
  result: string;
};

export const openTilesFolder = async (): Promise<OpenTilesFolderResult> => {
  const filesApi = getFilesApi();
  if (!filesApi) {
    return {
      path: "D:\\Documents\\DND\\Assets\\Tiles",
      result: "NO_DESKTOP_API",
    };
  }
  if (typeof filesApi.openTilesFolder === "function") {
    const opened = (await filesApi.openTilesFolder()) as OpenTilesFolderResult;
    return opened;
  }
  if (typeof filesApi.ensureBaseFolders === "function") {
    const paths = await filesApi.ensureBaseFolders();
    return {
      path: `${paths.assetsPath}/Tiles`,
      result: "MISSING_OPEN_TILES_FOLDER_HANDLER",
    };
  }
  return {
    path: "D:\\Documents\\DND\\Assets\\Tiles",
    result: "MISSING_OPEN_TILES_FOLDER_HANDLER",
  };
};

export const deleteRootPath = async (targetPath: string): Promise<void> => {
  const filesApi = getFilesApi();
  if (!filesApi || typeof filesApi.deletePath !== "function") return;
  await filesApi.deletePath(targetPath);
};

export const sortByPriority = (entries: CampaignTileEntry[] | undefined): CampaignTileEntry[] => {
  if (!entries) return [];
  return [...entries].sort((a, b) => a.priority - b.priority);
};
