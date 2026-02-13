const path = require("node:path");
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron");
const {
  ensureBaseFolders,
  readJSON,
  writeJSON,
  listCampaigns,
  createCampaign,
  loadToolSettings,
  saveToolSettings,
  getCampaignsPath,
} = require("./fileApi.cjs");

const DEV_URL = "http://127.0.0.1:5173";
let mainWindow = null;
let cachedToolSettings = null;

function createMainWindow() {
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
}

async function promptForCampaignName(window) {
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
}

function toggleDevTools(window) {
  if (!window) return;
  if (window.webContents.isDevToolsOpened()) {
    window.webContents.closeDevTools();
    return;
  }
  window.webContents.openDevTools();
}

function buildMenu() {
  return Menu.buildFromTemplate([
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
            } catch (error) {
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
            cachedToolSettings = await saveToolSettings(nextSettings);
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
  ]);
}

function registerIpcHandlers() {
  const register = (channel, handler) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, (_event, ...args) => handler(...args));
  };

  register("files:ensureBaseFolders", async () => ensureBaseFolders());
  register("files:readJSON", async (targetPath) => readJSON(targetPath));
  register("files:writeJSON", async (targetPath, data) => writeJSON(targetPath, data));
  register("files:listCampaigns", async () => listCampaigns());
  register("files:createCampaign", async (name) => createCampaign(name));
  register("files:loadToolSettings", async () => {
    const settings = await loadToolSettings();
    cachedToolSettings = settings;
    return settings;
  });
  register("files:saveToolSettings", async (settings) => {
    const saved = await saveToolSettings(settings);
    cachedToolSettings = saved;
    return saved;
  });
}

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
