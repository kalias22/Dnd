import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

type SceneMeta = { id: string; name: string; file: string };
type CampaignMeta = { id: string; name: string; scenes: SceneMeta[] };
type ToolSettings = {
  brush: {
    mode: "manual" | "rect" | "circle" | "freehand";
    action: "place" | "erase";
    target: "base" | "overlay";
    size: number;
  };
  selected: {
    tileAssetId?: string;
    overlayAssetId?: string;
    tokenAssetId?: string;
    objectAssetId?: string;
    itemAssetId?: string;
  };
  toggles: {
    gridOverlayEnabled: boolean;
    snapToGrid: boolean;
  };
};

const ROOT_FOLDER_NAME = "DND";
const SETTINGS_FILE_NAME = "settings.json";
const TOOL_SETTINGS_FILE_NAME = "tool-settings.json";

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

const getRootPath = () => path.join(app.getPath("documents"), ROOT_FOLDER_NAME);
export const getAssetsPath = () => path.join(getRootPath(), "Assets");
export const getCampaignsPath = () => path.join(getRootPath(), "Campaigns");
const getSettingsPath = () => path.join(getRootPath(), SETTINGS_FILE_NAME);
const getToolSettingsPath = () => path.join(getRootPath(), TOOL_SETTINGS_FILE_NAME);

const isWithinRoot = (candidate: string, root: string) => {
  const normalizedCandidate = path.normalize(candidate);
  const normalizedRoot = path.normalize(root);
  if (normalizedCandidate === normalizedRoot) return true;
  return normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
};

const resolveRootFilePath = (requestedPath: string) => {
  const rootPath = getRootPath();
  const absolutePath = path.isAbsolute(requestedPath) ? requestedPath : path.join(rootPath, requestedPath);
  if (!isWithinRoot(absolutePath, rootPath)) {
    throw new Error("Path must stay inside Documents/DND.");
  }
  return absolutePath;
};

const ensureJSONFile = async <T>(filePath: string, defaults: T) => {
  try {
    await stat(filePath);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFile(filePath, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
  }
};

const sanitizeCampaignName = (rawName: string) => {
  const trimmed = rawName.trim();
  const sanitized = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\.+$/g, "")
    .trim();
  return sanitized;
};

const getUniqueCampaignFolderName = async (baseFolderName: string) => {
  const campaignsPath = getCampaignsPath();
  let suffix = 0;
  let candidate = baseFolderName;
  while (true) {
    const candidatePath = path.join(campaignsPath, candidate);
    try {
      await stat(candidatePath);
      suffix += 1;
      candidate = `${baseFolderName} (${suffix})`;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return candidate;
      throw error;
    }
  }
};

const mergeToolSettings = (value: unknown): ToolSettings => {
  const defaults = defaultToolSettings();
  if (!value || typeof value !== "object") return defaults;
  const objectValue = value as Partial<ToolSettings>;
  return {
    brush: {
      mode: objectValue.brush?.mode ?? defaults.brush.mode,
      action: objectValue.brush?.action ?? defaults.brush.action,
      target: objectValue.brush?.target ?? defaults.brush.target,
      size: typeof objectValue.brush?.size === "number" ? objectValue.brush.size : defaults.brush.size,
    },
    selected: {
      ...defaults.selected,
      ...(objectValue.selected ?? {}),
    },
    toggles: {
      gridOverlayEnabled: objectValue.toggles?.gridOverlayEnabled ?? defaults.toggles.gridOverlayEnabled,
      snapToGrid: objectValue.toggles?.snapToGrid ?? defaults.toggles.snapToGrid,
    },
  };
};

export async function ensureBaseFolders() {
  const rootPath = getRootPath();
  const assetsPath = getAssetsPath();
  const campaignsPath = getCampaignsPath();

  await mkdir(rootPath, { recursive: true });
  await mkdir(path.join(assetsPath, "Tiles"), { recursive: true });
  await mkdir(path.join(assetsPath, "Objects"), { recursive: true });
  await mkdir(path.join(assetsPath, "Tokens"), { recursive: true });
  await mkdir(path.join(assetsPath, "Items"), { recursive: true });
  await mkdir(campaignsPath, { recursive: true });

  await ensureJSONFile(getSettingsPath(), {});
  await ensureJSONFile(getToolSettingsPath(), defaultToolSettings());

  return { rootPath, assetsPath, campaignsPath };
}

export async function readJSON(filePath: string) {
  await ensureBaseFolders();
  const resolvedPath = resolveRootFilePath(filePath);
  const raw = await readFile(resolvedPath, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function writeJSON(filePath: string, data: unknown) {
  await ensureBaseFolders();
  const resolvedPath = resolveRootFilePath(filePath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { path: resolvedPath };
}

export async function listCampaigns() {
  await ensureBaseFolders();
  const campaignsPath = getCampaignsPath();
  const entries = await readdir(campaignsPath, { withFileTypes: true });
  const campaigns: CampaignMeta[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const campaignFolderPath = path.join(campaignsPath, entry.name);
    const campaignFilePath = path.join(campaignFolderPath, "campaign.json");
    try {
      const raw = await readFile(campaignFilePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<CampaignMeta>;
      campaigns.push({
        id: parsed.id ?? entry.name,
        name: parsed.name ?? entry.name,
        scenes: Array.isArray(parsed.scenes) ? (parsed.scenes as SceneMeta[]) : [],
      });
    } catch {
      campaigns.push({
        id: entry.name,
        name: entry.name,
        scenes: [],
      });
    }
  }

  campaigns.sort((a, b) => a.name.localeCompare(b.name));
  return campaigns;
}

export async function createCampaign(name: string) {
  await ensureBaseFolders();
  const campaignName = sanitizeCampaignName(name);
  if (!campaignName) {
    throw new Error("Campaign name is required.");
  }

  const folderName = await getUniqueCampaignFolderName(campaignName);
  const campaignPath = path.join(getCampaignsPath(), folderName);
  const scenesPath = path.join(campaignPath, "scenes");
  const autosavePath = path.join(campaignPath, "autosave");

  await mkdir(scenesPath, { recursive: true });
  await mkdir(autosavePath, { recursive: true });

  const sceneId = randomUUID();
  const sceneFileName = `${sceneId}.json`;
  const campaignMeta: CampaignMeta = {
    id: randomUUID(),
    name: campaignName,
    scenes: [{ id: sceneId, name: "Scene 1", file: `scenes/${sceneFileName}` }],
  };

  await writeFile(path.join(campaignPath, "campaign.json"), `${JSON.stringify(campaignMeta, null, 2)}\n`, "utf8");
  await writeFile(
    path.join(scenesPath, sceneFileName),
    `${JSON.stringify({ id: sceneId, name: "Scene 1" }, null, 2)}\n`,
    "utf8"
  );

  return campaignMeta;
}

export async function loadToolSettings() {
  await ensureBaseFolders();
  try {
    const raw = await readFile(getToolSettingsPath(), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return mergeToolSettings(parsed);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    const defaults = defaultToolSettings();
    await writeFile(getToolSettingsPath(), `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
    return defaults;
  }
}

export async function saveToolSettings(settings: ToolSettings) {
  await ensureBaseFolders();
  const nextSettings = mergeToolSettings(settings);
  await writeFile(getToolSettingsPath(), `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");
  return nextSettings;
}
