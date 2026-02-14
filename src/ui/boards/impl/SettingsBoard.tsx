import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { loadToolSettings, updateToolSettings } from "../../../files/toolSettingsIO";
import {
  ACTIVE_CAMPAIGN_CHANGED_EVENT,
  BOARD_BRUSH_SETTINGS_CHANGED_EVENT,
  defaultToolSettings,
  loadCampaignFile,
  loadCampaignSummaries,
  resolveActiveCampaign,
  saveCampaignFile,
  type CampaignSummary,
} from "./shared";

type SettingsBoardProps = {
  campaignLoaded: boolean;
};

type GlobalSettingsShape = {
  interface?: {
    uiScalePercent?: number;
    animateBoards?: boolean;
  };
  grid?: {
    lineOpacity?: number;
  };
  files?: {
    autosaveMinutes?: number;
    keepAutosaves?: number;
  };
};

type GameSettingsShape = {
  dmOnlyFog?: boolean;
  lockPlayerTokens?: boolean;
};

const categoriesBase = ["Interface", "Grid", "Brush Defaults", "Files & Saving"] as const;
const gameCategory = "Game Settings";

const searchInputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid rgba(170,184,210,0.45)",
  borderRadius: 7,
  background: "rgba(10, 14, 20, 0.85)",
  color: "#edf3ff",
  fontSize: 12,
  padding: "7px 9px",
};

const buttonStyle = (active: boolean): CSSProperties => ({
  textAlign: "left",
  border: "1px solid rgba(170,184,210,0.45)",
  borderRadius: 7,
  background: active ? "rgba(64, 110, 184, 0.35)" : "rgba(16,20,28,0.92)",
  color: "#eff4ff",
  fontSize: 12,
  padding: "6px 8px",
  cursor: "pointer",
});

const panelStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  background: "rgba(10, 13, 20, 0.75)",
  padding: 8,
  display: "grid",
  gap: 8,
};

const fieldStyle: CSSProperties = {
  border: "1px solid rgba(170,184,210,0.45)",
  borderRadius: 7,
  background: "rgba(10, 14, 20, 0.85)",
  color: "#edf3ff",
  fontSize: 12,
  padding: "6px 8px",
};

type SettingRowProps = {
  label: string;
  description: string;
  control: ReactNode;
};

function SettingRow({ label, description, control }: SettingRowProps) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 7,
        background: "rgba(17, 22, 32, 0.9)",
        padding: "8px 9px",
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, color: "#f2f6ff", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 11, color: "#c2ccde" }}>{description}</div>
      <div>{control}</div>
    </div>
  );
}

const toNumber = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const matchesSearch = (search: string, label: string, description: string) => {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return label.toLowerCase().includes(needle) || description.toLowerCase().includes(needle);
};

export default function SettingsBoard({ campaignLoaded }: SettingsBoardProps) {
  const categories = useMemo(
    () => (campaignLoaded ? [...categoriesBase, gameCategory] : [...categoriesBase]),
    [campaignLoaded]
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);
  const [search, setSearch] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettingsShape>({});
  const [toolSettings, setToolSettings] = useState(defaultToolSettings());
  const [activeCampaign, setActiveCampaign] = useState<CampaignSummary | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettingsShape>({});

  useEffect(() => {
    if (categories.includes(selectedCategory)) return;
    setSelectedCategory(categories[0]);
  }, [categories, selectedCategory]);

  const loadState = async () => {
    setErrorText(null);
    try {
      const filesApi = window.api?.files;
      const [tool, settingsRaw, campaigns] = await Promise.all([
        loadToolSettings(),
        filesApi?.readJSON("settings.json"),
        loadCampaignSummaries(),
      ]);
      setToolSettings(tool);
      setGlobalSettings((settingsRaw && typeof settingsRaw === "object" ? settingsRaw : {}) as GlobalSettingsShape);

      const campaign = resolveActiveCampaign(campaigns);
      setActiveCampaign(campaign);
      if (campaign) {
        const campaignFile = await loadCampaignFile(campaign);
        const nextGameSettings =
          campaignFile.settings && typeof campaignFile.settings === "object"
            ? (campaignFile.settings as GameSettingsShape)
            : {};
        setGameSettings(nextGameSettings);
      } else {
        setGameSettings({});
      }
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to load settings.");
    }
  };

  useEffect(() => {
    void loadState();
    const onActiveCampaignChanged = () => {
      void loadState();
    };
    window.addEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onActiveCampaignChanged);
    return () => {
      window.removeEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onActiveCampaignChanged);
    };
  }, []);

  const saveGlobalSettings = async (nextSettings: GlobalSettingsShape) => {
    setGlobalSettings(nextSettings);
    try {
      await window.api?.files.writeJSON("settings.json", nextSettings);
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to save global settings.");
    }
  };

  const saveTool = async (nextSettings: ReturnType<typeof defaultToolSettings>) => {
    setToolSettings(nextSettings);
    try {
      const saved = await updateToolSettings((current) => ({
        ...current,
        brush: {
          ...current.brush,
          ...nextSettings.brush,
        },
        toggles: {
          ...current.toggles,
          ...nextSettings.toggles,
        },
        selected: {
          ...current.selected,
          ...nextSettings.selected,
        },
      }));
      setToolSettings(saved);
      window.dispatchEvent(
        new CustomEvent(BOARD_BRUSH_SETTINGS_CHANGED_EVENT, {
          detail: {
            brushMode: saved.brush.mode,
            brushAction: saved.brush.action,
            brushTarget: saved.brush.target,
            gridOverlayEnabled: saved.toggles.gridOverlayEnabled,
            snapToGrid: saved.toggles.snapToGrid,
          },
        })
      );
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to save tool defaults.");
    }
  };

  const saveGameSettings = async (nextGameSettings: GameSettingsShape) => {
    if (!activeCampaign) return;
    setGameSettings(nextGameSettings);
    try {
      const campaignFile = await loadCampaignFile(activeCampaign);
      await saveCampaignFile(activeCampaign, {
        ...campaignFile,
        settings: nextGameSettings as Record<string, unknown>,
      });
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to save campaign settings.");
    }
  };

  const interfaceRows: SettingRowProps[] = [
    {
      label: "UI Scale (%)",
      description: "Global UI scale preference for desktop boards.",
      control: (
        <input
          type="number"
          min={80}
          max={200}
          value={globalSettings.interface?.uiScalePercent ?? 100}
          onChange={(event) =>
            void saveGlobalSettings({
              ...globalSettings,
              interface: {
                ...globalSettings.interface,
                uiScalePercent: toNumber(event.target.value, 100, 80, 200),
              },
            })
          }
          style={{ ...fieldStyle, width: 90 }}
        />
      ),
    },
    {
      label: "Animate Board Transitions",
      description: "Enable board open/collapse transition effects.",
      control: (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d6dff1" }}>
          <input
            type="checkbox"
            checked={globalSettings.interface?.animateBoards ?? true}
            onChange={(event) =>
              void saveGlobalSettings({
                ...globalSettings,
                interface: {
                  ...globalSettings.interface,
                  animateBoards: event.target.checked,
                },
              })
            }
          />
          Enabled
        </label>
      ),
    },
  ];

  const gridRows: SettingRowProps[] = [
    {
      label: "Grid Line Opacity",
      description: "Global default opacity for grid helper lines.",
      control: (
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={globalSettings.grid?.lineOpacity ?? 0.25}
          onChange={(event) =>
            void saveGlobalSettings({
              ...globalSettings,
              grid: {
                ...globalSettings.grid,
                lineOpacity: toNumber(event.target.value, 0.25, 0, 1),
              },
            })
          }
          style={{ ...fieldStyle, width: 90 }}
        />
      ),
    },
    {
      label: "Grid Overlay",
      description: "Show/hide transparent grid overlay in the editor.",
      control: (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d6dff1" }}>
          <input
            type="checkbox"
            checked={toolSettings.toggles.gridOverlayEnabled}
            onChange={(event) =>
              void saveTool({
                ...toolSettings,
                toggles: {
                  ...toolSettings.toggles,
                  gridOverlayEnabled: event.target.checked,
                },
              })
            }
          />
          Enabled
        </label>
      ),
    },
    {
      label: "Snap To Grid",
      description: "Enable grid snapping for movement and placement.",
      control: (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d6dff1" }}>
          <input
            type="checkbox"
            checked={toolSettings.toggles.snapToGrid}
            onChange={(event) =>
              void saveTool({
                ...toolSettings,
                toggles: {
                  ...toolSettings.toggles,
                  snapToGrid: event.target.checked,
                },
              })
            }
          />
          Enabled
        </label>
      ),
    },
  ];

  const brushRows: SettingRowProps[] = [
    {
      label: "Default Mode",
      description: "Default brush interaction mode.",
      control: (
        <select
          value={toolSettings.brush.mode}
          onChange={(event) =>
            void saveTool({
              ...toolSettings,
              brush: {
                ...toolSettings.brush,
                mode: event.target.value as typeof toolSettings.brush.mode,
              },
            })
          }
          style={fieldStyle}
        >
          <option value="manual">Manual</option>
          <option value="rect">Rectangle</option>
          <option value="circle">Circle</option>
          <option value="freehand">Freehand</option>
        </select>
      ),
    },
    {
      label: "Default Action",
      description: "Default brush action when opening the editor.",
      control: (
        <select
          value={toolSettings.brush.action}
          onChange={(event) =>
            void saveTool({
              ...toolSettings,
              brush: {
                ...toolSettings.brush,
                action: event.target.value as typeof toolSettings.brush.action,
              },
            })
          }
          style={fieldStyle}
        >
          <option value="place">Place</option>
          <option value="erase">Erase</option>
        </select>
      ),
    },
    {
      label: "Default Target",
      description: "Default target layer for brush edits.",
      control: (
        <select
          value={toolSettings.brush.target}
          onChange={(event) =>
            void saveTool({
              ...toolSettings,
              brush: {
                ...toolSettings.brush,
                target: event.target.value as typeof toolSettings.brush.target,
              },
            })
          }
          style={fieldStyle}
        >
          <option value="base">Base</option>
          <option value="overlay">Overlay</option>
        </select>
      ),
    },
    {
      label: "Default Brush Size",
      description: "Saved brush size value for future sessions.",
      control: (
        <input
          type="number"
          min={1}
          max={16}
          value={toolSettings.brush.size}
          onChange={(event) =>
            void saveTool({
              ...toolSettings,
              brush: {
                ...toolSettings.brush,
                size: toNumber(event.target.value, 1, 1, 16),
              },
            })
          }
          style={{ ...fieldStyle, width: 90 }}
        />
      ),
    },
  ];

  const fileRows: SettingRowProps[] = [
    {
      label: "Autosave Interval (minutes)",
      description: "Global autosave frequency preference.",
      control: (
        <input
          type="number"
          min={1}
          max={60}
          value={globalSettings.files?.autosaveMinutes ?? 5}
          onChange={(event) =>
            void saveGlobalSettings({
              ...globalSettings,
              files: {
                ...globalSettings.files,
                autosaveMinutes: toNumber(event.target.value, 5, 1, 60),
              },
            })
          }
          style={{ ...fieldStyle, width: 90 }}
        />
      ),
    },
    {
      label: "Autosave History Count",
      description: "How many autosaves to retain per campaign.",
      control: (
        <input
          type="number"
          min={1}
          max={100}
          value={globalSettings.files?.keepAutosaves ?? 20}
          onChange={(event) =>
            void saveGlobalSettings({
              ...globalSettings,
              files: {
                ...globalSettings.files,
                keepAutosaves: toNumber(event.target.value, 20, 1, 100),
              },
            })
          }
          style={{ ...fieldStyle, width: 90 }}
        />
      ),
    },
  ];

  const gameRows: SettingRowProps[] = [
    {
      label: "DM-only Fog Controls",
      description: "Restrict fog controls to DM clients for this campaign.",
      control: (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d6dff1" }}>
          <input
            type="checkbox"
            checked={gameSettings.dmOnlyFog ?? false}
            onChange={(event) =>
              void saveGameSettings({
                ...gameSettings,
                dmOnlyFog: event.target.checked,
              })
            }
          />
          Enabled
        </label>
      ),
    },
    {
      label: "Lock Player Token Movement",
      description: "Prevent player-side movement changes in this campaign.",
      control: (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d6dff1" }}>
          <input
            type="checkbox"
            checked={gameSettings.lockPlayerTokens ?? false}
            onChange={(event) =>
              void saveGameSettings({
                ...gameSettings,
                lockPlayerTokens: event.target.checked,
              })
            }
          />
          Enabled
        </label>
      ),
    },
  ];

  const rowsByCategory: Record<string, SettingRowProps[]> = {
    Interface: interfaceRows,
    Grid: gridRows,
    "Brush Defaults": brushRows,
    "Files & Saving": fileRows,
    [gameCategory]: gameRows,
  };

  const filteredRows = (rowsByCategory[selectedCategory] ?? []).filter((row) =>
    matchesSearch(search, row.label, row.description)
  );

  return (
    <div style={{ display: "grid", gap: 10, minHeight: 0 }}>
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search settings..."
        style={searchInputStyle}
      />

      {errorText && <div style={{ fontSize: 12, color: "#ff9b9b" }}>{errorText}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 10, minHeight: 0 }}>
        <div style={{ ...panelStyle, alignContent: "start" }}>
          {categories.map((category) => (
            <button key={category} type="button" style={buttonStyle(selectedCategory === category)} onClick={() => setSelectedCategory(category)}>
              {category}
            </button>
          ))}
        </div>

        <div style={{ ...panelStyle, overflowY: "auto", alignContent: "start" }}>
          {selectedCategory === gameCategory && !activeCampaign ? (
            <div style={{ fontSize: 12, color: "#c2ccde" }}>Game settings are available when a campaign is open.</div>
          ) : filteredRows.length === 0 ? (
            <div style={{ fontSize: 12, color: "#c2ccde" }}>No settings match this filter.</div>
          ) : (
            filteredRows.map((row) => <SettingRow key={row.label} {...row} />)
          )}
        </div>
      </div>
    </div>
  );
}
