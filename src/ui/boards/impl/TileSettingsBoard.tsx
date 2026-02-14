import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { TileMaterial, TileMaterialTextures } from "../../../pixi";
import { loadToolSettings, updateToolSettings } from "../../../files/toolSettingsIO";
import type { TileMaterialSetting } from "../../../types/fileTypes";
import {
  ACTIVE_CAMPAIGN_CHANGED_EVENT,
  BOARD_TILE_LIBRARY_CHANGED_EVENT,
  BOARD_TILE_MATERIALS_CHANGED_EVENT,
  BOARD_TILE_SELECTED_EVENT,
  BOARD_TILE_SETTINGS_EDIT_EVENT,
  inferTileMaterialTextures,
  loadCampaignFile,
  loadCampaignSummaries,
  loadTileLibrary,
  resolveActiveCampaign,
  saveCampaignFile,
  type CampaignSummary,
  type TileLibraryAsset,
  type TileLibraryChangedPayload,
  type TileMaterialsChangedPayload,
  type TileSelectedPayload,
  type TileSettingsEditPayload,
} from "./shared";

const sectionStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  background: "rgba(10, 13, 20, 0.75)",
  padding: 8,
  display: "grid",
  gap: 8,
};

const inputStyle: CSSProperties = {
  border: "1px solid rgba(170,184,210,0.45)",
  borderRadius: 7,
  background: "rgba(10,14,20,0.85)",
  color: "#edf3ff",
  fontSize: 12,
  padding: "6px 8px",
};

const buttonStyle: CSSProperties = {
  border: "1px solid rgba(142,157,182,0.55)",
  borderRadius: 7,
  background: "rgba(21,27,39,0.95)",
  color: "#f2f6ff",
  fontSize: 12,
  padding: "7px 10px",
  cursor: "pointer",
};

type OverlayTextureKey = Exclude<keyof TileMaterialTextures, "baseAssetId">;

const overlayFields: Array<{ key: OverlayTextureKey; label: string }> = [
  { key: "overlayAssetId", label: "Blend Overlay" },
  { key: "cornerOverlayAssetId", label: "Corner Overlay" },
  { key: "overlayHorizontalAssetId", label: "Overlay Horizontal" },
  { key: "overlayVerticalAssetId", label: "Overlay Vertical" },
  { key: "cornerOverlayNeAssetId", label: "Corner NE" },
  { key: "cornerOverlayNwAssetId", label: "Corner NW" },
  { key: "cornerOverlaySeAssetId", label: "Corner SE" },
  { key: "cornerOverlaySwAssetId", label: "Corner SW" },
];

const overlayKeys: OverlayTextureKey[] = overlayFields.map((field) => field.key);

const createTextures = (baseAssetId = ""): TileMaterialTextures => ({
  baseAssetId,
  overlayAssetId: "",
  cornerOverlayAssetId: "",
  overlayHorizontalAssetId: "",
  overlayVerticalAssetId: "",
  cornerOverlayHorizontalAssetId: "",
  cornerOverlayVerticalAssetId: "",
  cornerOverlayNeAssetId: "",
  cornerOverlayNwAssetId: "",
  cornerOverlaySeAssetId: "",
  cornerOverlaySwAssetId: "",
});

const hasOverlay = (textures: TileMaterialTextures) => overlayKeys.some((key) => Boolean(textures[key]));

const toGlobalTileMaterialSetting = (material: TileMaterial): TileMaterialSetting => ({
  rotationMode: material.rotationMode === "none" ? "none" : "random90",
  noOverlay: Boolean(material.noOverlay),
  textures: {
    overlayAssetId: material.textures.overlayAssetId || "",
    cornerOverlayAssetId: material.textures.cornerOverlayAssetId || "",
    overlayHorizontalAssetId: material.textures.overlayHorizontalAssetId || "",
    overlayVerticalAssetId: material.textures.overlayVerticalAssetId || "",
    cornerOverlayHorizontalAssetId: material.textures.cornerOverlayHorizontalAssetId || "",
    cornerOverlayVerticalAssetId: material.textures.cornerOverlayVerticalAssetId || "",
    cornerOverlayNeAssetId: material.textures.cornerOverlayNeAssetId || "",
    cornerOverlayNwAssetId: material.textures.cornerOverlayNwAssetId || "",
    cornerOverlaySeAssetId: material.textures.cornerOverlaySeAssetId || "",
    cornerOverlaySwAssetId: material.textures.cornerOverlaySwAssetId || "",
  },
});

const materialFromGlobalTileSetting = (
  setting: TileMaterialSetting | undefined,
  tile: TileLibraryAsset,
  priority: number,
  validAssetIds: Set<string>
): TileMaterial | undefined => {
  if (!setting || typeof setting !== "object") return undefined;
  const textures = createTextures(tile.id);
  const sourceTextures = setting.textures;
  for (const key of overlayKeys) {
    const value = sourceTextures?.[key];
    textures[key] = typeof value === "string" && validAssetIds.has(value) ? value : "";
  }
  return {
    id: `material-${tile.id}`,
    name: tile.name,
    priority,
    rotationMode: setting.rotationMode === "none" ? "none" : "random90",
    noOverlay: typeof setting.noOverlay === "boolean" ? setting.noOverlay : !hasOverlay(textures),
    textures,
  };
};

const normalizeMaterial = (
  raw: TileMaterial | undefined,
  tile: TileLibraryAsset,
  priority: number,
  validAssetIds: Set<string>,
  libraryAssets: TileLibraryAsset[],
  hasGlobalTileSetting: boolean
): TileMaterial => {
  const textures = raw?.textures ?? createTextures(tile.id);
  const inferredTextures = inferTileMaterialTextures(tile, libraryAssets);
  const rawHasAnyOverlay = overlayKeys.some((key) => Boolean(textures[key]));
  const shouldUseInference =
    !raw ||
    (!rawHasAnyOverlay && (raw.noOverlay !== true || !hasGlobalTileSetting));
  const nextTextures = createTextures(tile.id);
  for (const key of overlayKeys) {
    const value = textures[key];
    const resolved = typeof value === "string" && validAssetIds.has(value) ? value : "";
    const inferred = inferredTextures[key];
    const inferredResolved = typeof inferred === "string" && validAssetIds.has(inferred) ? inferred : "";
    nextTextures[key] = resolved || (shouldUseInference ? inferredResolved : "");
  }
  return {
    id: raw?.id ?? `material-${tile.id}`,
    name: raw?.name?.trim() ? raw.name : tile.name,
    priority,
    rotationMode: raw?.rotationMode === "none" ? "none" : "random90",
    noOverlay: typeof raw?.noOverlay === "boolean" ? raw.noOverlay : !hasOverlay(nextTextures),
    textures: nextTextures,
  };
};

export default function TileSettingsBoard() {
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [library, setLibrary] = useState<TileLibraryAsset[]>([]);
  const [materials, setMaterials] = useState<TileMaterial[]>([]);
  const [selectedTileAssetId, setSelectedTileAssetId] = useState("");
  const [draft, setDraft] = useState<TileMaterial | null>(null);

  const tileById = useMemo(() => new Map(library.map((tile) => [tile.id, tile])), [library]);
  const selectedTile = useMemo(() => tileById.get(selectedTileAssetId) ?? null, [selectedTileAssetId, tileById]);
  const selectedMaterial = useMemo(
    () => materials.find((material) => material.textures.baseAssetId === selectedTileAssetId) ?? null,
    [materials, selectedTileAssetId]
  );

  const emitMaterialsChanged = (next: TileMaterial[], selectedMaterialId?: string | null) => {
    window.dispatchEvent(
      new CustomEvent(BOARD_TILE_MATERIALS_CHANGED_EVENT, {
        detail: { materials: next, selectedMaterialId },
      })
    );
  };

  useEffect(() => {
    if (!selectedTile) {
      setDraft(null);
      return;
    }
    const validAssetIds = new Set(library.map((tile) => tile.id));
    const fallback = normalizeMaterial(undefined, selectedTile, 0, validAssetIds, library, false);
    setDraft(
      selectedMaterial
        ? normalizeMaterial(selectedMaterial, selectedTile, selectedMaterial.priority, validAssetIds, library, true)
        : fallback
    );
  }, [library, selectedMaterial, selectedTile]);

  const loadState = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const [campaigns, tiles, toolSettings] = await Promise.all([
        loadCampaignSummaries(),
        loadTileLibrary(),
        loadToolSettings(),
      ]);
      setLibrary(tiles);
      const activeCampaign = resolveActiveCampaign(campaigns);
      setCampaign(activeCampaign);
      if (!activeCampaign) {
        setMaterials([]);
        setSelectedTileAssetId("");
        setDraft(null);
        return;
      }

      const campaignFile = await loadCampaignFile(activeCampaign);
      const validAssetIds = new Set(tiles.map((tile) => tile.id));
      const tileIds = (campaignFile.campaignAssets?.tiles ?? []).map((entry) => entry.assetId).filter((id) => validAssetIds.has(id));
      const globalTileSettings = toolSettings.tileMaterialSettings ?? {};
      const storedMaterials = Array.isArray(campaignFile.tileMaterials) ? (campaignFile.tileMaterials as TileMaterial[]) : [];
      const materialsByBaseId = new Map<string, TileMaterial>();
      for (const material of storedMaterials) {
        const baseId = material.textures?.baseAssetId;
        if (baseId && validAssetIds.has(baseId)) materialsByBaseId.set(baseId, material);
      }
      const nextMaterials = tileIds
        .map((assetId, index) => {
          const tile = tileById.get(assetId) ?? tiles.find((entry) => entry.id === assetId);
          if (!tile) return null;
          const fallbackGlobalMaterial = materialFromGlobalTileSetting(
            globalTileSettings[assetId],
            tile,
            index,
            validAssetIds
          );
          return normalizeMaterial(
            materialsByBaseId.get(assetId) ?? fallbackGlobalMaterial,
            tile,
            index,
            validAssetIds,
            tiles,
            Boolean(globalTileSettings[assetId])
          );
        })
        .filter((material): material is TileMaterial => Boolean(material));

      setMaterials(nextMaterials);
      const preferredSelectedTileId =
        typeof toolSettings.selected.tileAssetId === "string" ? toolSettings.selected.tileAssetId : "";
      if (!selectedTileAssetId && tileIds.length > 0) {
        setSelectedTileAssetId(tileIds.includes(preferredSelectedTileId) ? preferredSelectedTileId : tileIds[0]);
      } else if (selectedTileAssetId && !tileIds.includes(selectedTileAssetId)) {
        setSelectedTileAssetId(tileIds.includes(preferredSelectedTileId) ? preferredSelectedTileId : tileIds[0] ?? "");
      }
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to load tile settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
    const onCampaignChanged = () => {
      void loadState();
    };
    const onTileLibraryChanged = (event: Event) => {
      const detail = (event as CustomEvent<TileLibraryChangedPayload>).detail;
      if (!detail || !Array.isArray(detail.assets)) return;
      setLibrary(detail.assets);
    };
    const onTileMaterialsChanged = (event: Event) => {
      const detail = (event as CustomEvent<TileMaterialsChangedPayload>).detail;
      if (!detail || !Array.isArray(detail.materials)) return;
      setMaterials(detail.materials);
      if (detail.selectedMaterialId) {
        const selected = detail.materials.find((material) => material.id === detail.selectedMaterialId);
        if (selected) setSelectedTileAssetId(selected.textures.baseAssetId);
      }
    };
    const onEditTileSettings = (event: Event) => {
      const detail = (event as CustomEvent<TileSettingsEditPayload>).detail;
      if (!detail?.assetId) return;
      setSelectedTileAssetId(detail.assetId);
    };
    const onTileSelected = (event: Event) => {
      const detail = (event as CustomEvent<TileSelectedPayload>).detail;
      if (!detail?.assetId) return;
      setSelectedTileAssetId(detail.assetId);
    };

    window.addEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onCampaignChanged);
    window.addEventListener(BOARD_TILE_LIBRARY_CHANGED_EVENT, onTileLibraryChanged as EventListener);
    window.addEventListener(BOARD_TILE_MATERIALS_CHANGED_EVENT, onTileMaterialsChanged as EventListener);
    window.addEventListener(BOARD_TILE_SETTINGS_EDIT_EVENT, onEditTileSettings as EventListener);
    window.addEventListener(BOARD_TILE_SELECTED_EVENT, onTileSelected as EventListener);
    return () => {
      window.removeEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onCampaignChanged);
      window.removeEventListener(BOARD_TILE_LIBRARY_CHANGED_EVENT, onTileLibraryChanged as EventListener);
      window.removeEventListener(BOARD_TILE_MATERIALS_CHANGED_EVENT, onTileMaterialsChanged as EventListener);
      window.removeEventListener(BOARD_TILE_SETTINGS_EDIT_EVENT, onEditTileSettings as EventListener);
      window.removeEventListener(BOARD_TILE_SELECTED_EVENT, onTileSelected as EventListener);
    };
  }, []);

  const saveDraft = async () => {
    if (!campaign || !selectedTile || !draft) return;
    setErrorText(null);
    setNoticeText(null);
    try {
      const validAssetIds = new Set(library.map((tile) => tile.id));
      const nextTextures = createTextures(selectedTile.id);
      for (const key of overlayKeys) {
        const value = draft.textures[key];
        nextTextures[key] = typeof value === "string" && validAssetIds.has(value) ? value : "";
      }
      if (draft.noOverlay) {
        for (const key of overlayKeys) nextTextures[key] = "";
      }
      const hasAnyOverlay = hasOverlay(nextTextures);
      const nextNoOverlay = Boolean(draft.noOverlay) && !hasAnyOverlay;

      const nextMaterial: TileMaterial = {
        ...draft,
        rotationMode: draft.rotationMode === "none" ? "none" : "random90",
        noOverlay: nextNoOverlay,
        textures: nextTextures,
      };

      const existingIndex = materials.findIndex((material) => material.textures.baseAssetId === selectedTile.id);
      const nextMaterials =
        existingIndex >= 0
          ? materials.map((material) =>
              material.textures.baseAssetId === selectedTile.id ? nextMaterial : material
            )
          : [...materials, nextMaterial];
      const campaignFile = await loadCampaignFile(campaign);
      await saveCampaignFile(campaign, {
        ...campaignFile,
        tileMaterials: nextMaterials,
      });

      try {
        await updateToolSettings((currentToolSettings) => ({
          ...currentToolSettings,
          selected: {
            ...currentToolSettings.selected,
            tileAssetId: selectedTile.id,
          },
          tileMaterialSettings: {
            ...(currentToolSettings.tileMaterialSettings ?? {}),
            [selectedTile.id]: toGlobalTileMaterialSetting(nextMaterial),
          },
        }));
      } catch {
        // Campaign material still applies even if tool-settings persistence fails.
      }

      setDraft(nextMaterial);
      setMaterials(nextMaterials);
      emitMaterialsChanged(nextMaterials, nextMaterial.id);
      window.dispatchEvent(
        new CustomEvent(BOARD_TILE_SELECTED_EVENT, {
          detail: {
            assetId: selectedTile.id,
            name: selectedTile.name,
            url: selectedTile.url,
            materialId: nextMaterial.id,
          },
        })
      );
      setNoticeText(`Saved tile settings for ${selectedTile.name}.`);
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to save tile settings.");
    }
  };

  if (loading) {
    return <div style={{ fontSize: 12, color: "#c8d2e6" }}>Loading tile settings...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!campaign && <div style={{ fontSize: 12, color: "#c8d2e6" }}>No active campaign selected.</div>}
      {errorText && <div style={{ fontSize: 12, color: "#ff9b9b" }}>{errorText}</div>}
      {noticeText && <div style={{ fontSize: 12, color: "#9dd0ff" }}>{noticeText}</div>}

      <section style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Selected Tile</div>
        {!selectedTile ? (
          <div style={{ fontSize: 12, color: "#c8d2e6" }}>Right-click a campaign tile in Tiles Manager and choose Edit Tile Settings.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <img src={selectedTile.url} alt={selectedTile.name} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)" }} />
            <div style={{ fontSize: 12, color: "#dce6f8" }}>{selectedTile.name}</div>
          </div>
        )}
      </section>

      {selectedTile && draft && (
        <section style={sectionStyle}>
          <label style={{ fontSize: 12, color: "#d6dff1", display: "grid", gap: 4 }}>
            Rotation Mode
            <select
              value={draft.rotationMode ?? "random90"}
              onChange={(event) =>
                setDraft((previous) =>
                  previous
                    ? { ...previous, rotationMode: event.target.value === "none" ? "none" : "random90" }
                    : previous
                )
              }
              style={inputStyle}
            >
              <option value="random90">Random 90 deg</option>
              <option value="none">No Rotation</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d6dff1" }}>
            <input
              type="checkbox"
              checked={Boolean(draft.noOverlay)}
              onChange={(event) =>
                setDraft((previous) => {
                  if (!previous) return previous;
                  const checked = event.target.checked;
                  const nextTextures = { ...previous.textures };
                  if (checked) {
                    for (const key of overlayKeys) nextTextures[key] = "";
                  }
                  return { ...previous, noOverlay: checked, textures: nextTextures };
                })
              }
            />
            No Overlay (blocks edge overlays)
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {overlayFields.map((field) => (
              <label key={field.key} style={{ fontSize: 12, color: "#d6dff1", display: "grid", gap: 4 }}>
                {field.label}
                <select
                  value={draft.textures[field.key]}
                  onChange={(event) =>
                    setDraft((previous) =>
                      previous
                        ? {
                            ...previous,
                            noOverlay: event.target.value ? false : previous.noOverlay,
                            textures: { ...previous.textures, [field.key]: event.target.value },
                          }
                        : previous
                    )
                  }
                  style={inputStyle}
                >
                  <option value="">None</option>
                  {library.map((tile) => (
                    <option key={tile.id} value={tile.id}>
                      {tile.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <button type="button" style={buttonStyle} onClick={() => void saveDraft()}>
            Save Tile Settings
          </button>
        </section>
      )}
    </div>
  );
}
