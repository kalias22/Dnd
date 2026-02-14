import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ACTIVE_CAMPAIGN_CHANGED_EVENT,
  BOARD_SCENE_SELECTED_EVENT,
  deleteRootPath,
  loadCampaignFile,
  loadCampaignSummaries,
  resolveActiveCampaign,
  saveCampaignFile,
  type CampaignSceneEntry,
  type CampaignSummary,
} from "./shared";

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(142, 157, 182, 0.55)",
  borderRadius: 7,
  background: "rgba(21, 27, 39, 0.95)",
  color: "#f2f6ff",
  fontSize: 12,
  padding: "6px 10px",
  cursor: "pointer",
};

const rowButtonStyle: CSSProperties = {
  ...buttonStyle,
  fontSize: 11,
  padding: "4px 8px",
};

const sceneRowStyle = (selected: boolean): CSSProperties => ({
  border: "1px solid rgba(170, 184, 210, 0.3)",
  borderRadius: 7,
  background: selected ? "rgba(77, 124, 210, 0.32)" : "rgba(16,20,28,0.92)",
  padding: "7px 8px",
  display: "grid",
  gap: 6,
});

type ScenesState = {
  campaign: CampaignSummary;
  scenes: CampaignSceneEntry[];
};

const nowIso = () => new Date().toISOString();

export default function ScenesBoard() {
  const [state, setState] = useState<ScenesState | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const loadScenes = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const campaigns = await loadCampaignSummaries();
      const activeCampaign = resolveActiveCampaign(campaigns);
      if (!activeCampaign) {
        setState(null);
        setLoading(false);
        return;
      }
      const campaignFile = await loadCampaignFile(activeCampaign);
      const scenes = Array.isArray(campaignFile.scenes) ? campaignFile.scenes : [];
      setState({ campaign: activeCampaign, scenes });
      if (scenes.length > 0) {
        setSelectedSceneId((previous) => previous ?? scenes[0].id);
      } else {
        setSelectedSceneId(null);
      }
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to load scenes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScenes();
    const onActiveCampaignChanged = () => {
      void loadScenes();
    };
    window.addEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onActiveCampaignChanged);
    return () => {
      window.removeEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onActiveCampaignChanged);
    };
  }, []);

  const selectedScene = useMemo(
    () => state?.scenes.find((scene) => scene.id === selectedSceneId) ?? null,
    [selectedSceneId, state]
  );

  const saveScenes = async (campaign: CampaignSummary, scenes: CampaignSceneEntry[]) => {
    const campaignFile = await loadCampaignFile(campaign);
    const nextCampaignFile = {
      ...campaignFile,
      scenes,
    };
    await saveCampaignFile(campaign, nextCampaignFile);
    setState({ campaign, scenes });
  };

  const selectScene = (scene: CampaignSceneEntry) => {
    if (!state) return;
    setSelectedSceneId(scene.id);
    window.dispatchEvent(
      new CustomEvent(BOARD_SCENE_SELECTED_EVENT, {
        detail: {
          campaignId: state.campaign.id,
          sceneId: scene.id,
        },
      })
    );
  };

  const createScene = async () => {
    if (!state) return;
    const rawName = window.prompt("New scene name:", `Scene ${state.scenes.length + 1}`);
    if (rawName === null) return;
    const name = rawName.trim();
    if (!name) return;

    setErrorText(null);
    try {
      const id = crypto.randomUUID();
      const updatedAt = nowIso();
      const file = `scenes/${id}.json`;
      const nextScene: CampaignSceneEntry = { id, name, file, updatedAt };
      await window.api?.files.writeJSON(`Campaigns/${state.campaign.folderName || state.campaign.name}/${file}`, {
        id,
        name,
        updatedAt,
      });
      const nextScenes = [...state.scenes, nextScene];
      await saveScenes(state.campaign, nextScenes);
      setSelectedSceneId(id);
      selectScene(nextScene);
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to create scene.");
    }
  };

  const renameScene = async (scene: CampaignSceneEntry) => {
    if (!state) return;
    const rawName = window.prompt("Rename scene:", scene.name);
    if (rawName === null) return;
    const name = rawName.trim();
    if (!name || name === scene.name) return;

    setErrorText(null);
    try {
      const updatedAt = nowIso();
      const nextScenes = state.scenes.map((entry) =>
        entry.id === scene.id
          ? {
              ...entry,
              name,
              updatedAt,
            }
          : entry
      );
      await window.api?.files.writeJSON(
        `Campaigns/${state.campaign.folderName || state.campaign.name}/${scene.file}`,
        { id: scene.id, name, updatedAt }
      );
      await saveScenes(state.campaign, nextScenes);
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to rename scene.");
    }
  };

  const deleteScene = async (scene: CampaignSceneEntry) => {
    if (!state) return;
    const confirmed = window.confirm(`Delete "${scene.name}"?`);
    if (!confirmed) return;

    setErrorText(null);
    try {
      await deleteRootPath(`Campaigns/${state.campaign.folderName || state.campaign.name}/${scene.file}`);
      const nextScenes = state.scenes.filter((entry) => entry.id !== scene.id);
      await saveScenes(state.campaign, nextScenes);
      if (selectedSceneId === scene.id) {
        setSelectedSceneId(nextScenes[0]?.id ?? null);
      }
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to delete scene.");
    }
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={buttonStyle} onClick={() => void createScene()} disabled={!state || loading}>
          Create Scene
        </button>
      </div>
      {errorText && <div style={{ fontSize: 12, color: "#ff9b9b" }}>{errorText}</div>}
      {loading ? (
        <div style={{ fontSize: 12, color: "#d2dbec" }}>Loading scenes...</div>
      ) : !state ? (
        <div style={{ fontSize: 12, color: "#d2dbec" }}>No active campaign selected.</div>
      ) : state.scenes.length === 0 ? (
        <div style={{ fontSize: 12, color: "#d2dbec" }}>No scenes yet.</div>
      ) : (
        <div style={{ display: "grid", gap: 7, maxHeight: 320, overflowY: "auto" }}>
          {state.scenes.map((scene) => (
            <div key={scene.id} style={sceneRowStyle(scene.id === selectedSceneId)}>
              <button
                type="button"
                onClick={() => selectScene(scene)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#edf3ff",
                  padding: 0,
                  margin: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {scene.name}
              </button>
              <div style={{ fontSize: 11, color: "#b8c3d8" }}>
                Updated: {scene.updatedAt ? new Date(scene.updatedAt).toLocaleString() : "Not available"}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={rowButtonStyle} onClick={() => void renameScene(scene)}>
                  Rename
                </button>
                <button type="button" style={rowButtonStyle} onClick={() => void deleteScene(scene)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {selectedScene && (
        <div style={{ fontSize: 11, color: "#b9c3d8" }}>
          Selected scene: <strong>{selectedScene.name}</strong>
        </div>
      )}
    </div>
  );
}
