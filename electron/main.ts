import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  shell,
  type MenuItemConstructorOptions,
} from "electron";
import {
  createCampaign,
  ensureBaseFolders,
  getCampaignsPath,
  listCampaigns,
  loadToolSettings,
  readJSON,
  saveToolSettings,
  writeJSON,
} from "./fileApi";

const DEV_URL = "http://127.0.0.1:5173";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let cachedToolSettings: unknown = null;

const createMainWindow = () => {
  const window = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  void window.loadURL(DEV_URL);
  return window;
};

const promptForCampaignName = async (window: BrowserWindow | null) => {
  if (!window || window.isDestroyed()) return null;
  try {
    const result = await window.webContents.executeJavaScript(
      "window.prompt('Campaign name', 'New Campaign')",
      true
    );
    if (typeof result !== "string") return null;
    const trimmed = result.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
};

const toggleDevTools = (window: BrowserWindow | null) => {
  if (!window) return;
  if (window.webContents.isDevToolsOpened()) {
    window.webContents.closeDevTools();
    return;
  }
  window.webContents.openDevTools();
};

const buildMenu = () => {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        {
          label: "New Campaign…",
          click: async () => {
            const name = await promptForCampaignName(mainWindow);
            if (!name) return;
            try {
              await createCampaign(name);
            } catch (error: unknown) {
              dialog.showErrorBox("New Campaign Failed", String(error));
            }
          },
        },
        {
          label: "Open Campaign Folder",
          click: async () => {
            await ensureBaseFolders();
            await shell.openPath(getCampaignsPath());
          },
        },
        {
          label: "Save Tool Settings (manual trigger)",
          click: async () => {
            const nextSettings = cachedToolSettings ?? (await loadToolSettings());
            cachedToolSettings = await saveToolSettings(nextSettings as any);
          },
        },
        { type: "separator" },
        { label: "Exit", role: "quit" },
      ],
    },
    {
      label: "Window",
      submenu: [
        {
          label: "Reload",
          click: () => {
            BrowserWindow.getFocusedWindow()?.reload();
          },
        },
        {
          label: "Toggle DevTools",
          click: () => {
            toggleDevTools(BrowserWindow.getFocusedWindow() ?? mainWindow);
          },
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
};

const registerIpcHandlers = () => {
  const register = (channel: string, handler: (...args: any[]) => Promise<unknown>) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (_event, ...args) => handler(...args));
  };

  register("files:ensureBaseFolders", async () => ensureBaseFolders());
  register("files:readJSON", async (targetPath: string) => readJSON(targetPath));
  register("files:writeJSON", async (targetPath: string, data: unknown) => writeJSON(targetPath, data));
  register("files:listCampaigns", async () => listCampaigns());
  register("files:createCampaign", async (input: string | { name: string; description?: string }) => createCampaign(input));
  register("files:loadToolSettings", async () => {
    const settings = await loadToolSettings();
    cachedToolSettings = settings;
    return settings;
  });
  register("files:saveToolSettings", async (settings: unknown) => {
    const saved = await saveToolSettings(settings as any);
    cachedToolSettings = saved;
    return saved;
  });
};

app.whenReady().then(async () => {
  await ensureBaseFolders();
  cachedToolSettings = await loadToolSettings();
  registerIpcHandlers();
  Menu.setApplicationMenu(buildMenu());

  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
