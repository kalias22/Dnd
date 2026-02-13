const { randomUUID } = require("node:crypto");
const { mkdir, readFile, readdir, stat, writeFile } = require("node:fs/promises");
const path = require("node:path");
const { app } = require("electron");

const ROOT_FOLDER_NAME = "DND";
const SETTINGS_FILE_NAME = "settings.json";
const TOOL_SETTINGS_FILE_NAME = "tool-settings.json";

const defaultToolSettings = () => ({
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
const getAssetsPath = () => path.join(getRootPath(), "Assets");
const getCampaignsPath = () => path.join(getRootPath(), "Campaigns");
const getSettingsPath = () => path.join(getRootPath(), SETTINGS_FILE_NAME);
const getToolSettingsPath = () => path.join(getRootPath(), TOOL_SETTINGS_FILE_NAME);

const isWithinRoot = (candidate, root) => {
  const normalizedCandidate = path.normalize(candidate);
  const normalizedRoot = path.normalize(root);
  if (normalizedCandidate === normalizedRoot) return true;
  return normalizedCandidate.startsWith(`${normalizedRoot}${path.sep}`);
};

const resolveRootFilePath = (requestedPath) => {
  const rootPath = getRootPath();
  const absolutePath = path.isAbsolute(requestedPath) ? requestedPath : path.join(rootPath, requestedPath);
  if (!isWithinRoot(absolutePath, rootPath)) {
    throw new Error("Path must stay inside Documents/DND.");
  }
  return absolutePath;
};

const ensureJSONFile = async (filePath, defaults) => {
  try {
    await stat(filePath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await writeFile(filePath, `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
  }
};

const sanitizeCampaignName = (rawName) => {
  const trimmed = rawName.trim();
  const sanitized = trimmed
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\.+$/g, "")
    .trim();
  return sanitized;
};

const getUniqueCampaignFolderName = async (baseFolderName) => {
  const campaignsPath = getCampaignsPath();
  let suffix = 0;
  let candidate = baseFolderName;
  while (true) {
    const candidatePath = path.join(campaignsPath, candidate);
    try {
      await stat(candidatePath);
      suffix += 1;
      candidate = `${baseFolderName} (${suffix})`;
    } catch (error) {
      if (error.code === "ENOENT") return candidate;
      throw error;
    }
  }
};

const mergeToolSettings = (value) => {
  const defaults = defaultToolSettings();
  if (!value || typeof value !== "object") return defaults;
  return {
    brush: {
      mode: value.brush?.mode ?? defaults.brush.mode,
      action: value.brush?.action ?? defaults.brush.action,
      target: value.brush?.target ?? defaults.brush.target,
      size: typeof value.brush?.size === "number" ? value.brush.size : defaults.brush.size,
    },
    selected: {
      ...defaults.selected,
      ...(value.selected ?? {}),
    },
    toggles: {
      gridOverlayEnabled: value.toggles?.gridOverlayEnabled ?? defaults.toggles.gridOverlayEnabled,
      snapToGrid: value.toggles?.snapToGrid ?? defaults.toggles.snapToGrid,
    },
  };
};

const ensureBaseFolders = async () => {
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
};

const readJSON = async (filePath) => {
  await ensureBaseFolders();
  const resolvedPath = resolveRootFilePath(filePath);
  const raw = await readFile(resolvedPath, "utf8");
  return JSON.parse(raw);
};

const writeJSON = async (filePath, data) => {
  await ensureBaseFolders();
  const resolvedPath = resolveRootFilePath(filePath);
  await mkdir(path.dirname(resolvedPath), { recursive: true });
  await writeFile(resolvedPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return { path: resolvedPath };
};

const listCampaigns = async () => {
  await ensureBaseFolders();
  const campaignsPath = getCampaignsPath();
  const entries = await readdir(campaignsPath, { withFileTypes: true });
  const campaigns = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const campaignFolderPath = path.join(campaignsPath, entry.name);
    const campaignFilePath = path.join(campaignFolderPath, "campaign.json");
    try {
      const raw = await readFile(campaignFilePath, "utf8");
      const parsed = JSON.parse(raw);
      campaigns.push({
        id: parsed.id ?? entry.name,
        name: parsed.name ?? entry.name,
        scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
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
};

const createCampaign = async (name) => {
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
  const campaignMeta = {
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
};

const loadToolSettings = async () => {
  await ensureBaseFolders();
  try {
    const raw = await readFile(getToolSettingsPath(), "utf8");
    return mergeToolSettings(JSON.parse(raw));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const defaults = defaultToolSettings();
    await writeFile(getToolSettingsPath(), `${JSON.stringify(defaults, null, 2)}\n`, "utf8");
    return defaults;
  }
};

const saveToolSettings = async (settings) => {
  await ensureBaseFolders();
  const nextSettings = mergeToolSettings(settings);
  await writeFile(getToolSettingsPath(), `${JSON.stringify(nextSettings, null, 2)}\n`, "utf8");
  return nextSettings;
};

module.exports = {
  ensureBaseFolders,
  readJSON,
  writeJSON,
  listCampaigns,
  createCampaign,
  loadToolSettings,
  saveToolSettings,
  getRootPath,
  getAssetsPath,
  getCampaignsPath,
};
