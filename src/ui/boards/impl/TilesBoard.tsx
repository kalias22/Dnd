import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react";
import type { TileMaterial, TileMaterialTextures } from "../../../pixi";
import { loadToolSettings, updateToolSettings } from "../../../files/toolSettingsIO";
import {
  ACTIVE_CAMPAIGN_CHANGED_EVENT,
  BOARD_TILE_LIBRARY_CHANGED_EVENT,
  BOARD_TILE_MATERIALS_CHANGED_EVENT,
  BOARD_TILE_SETTINGS_EDIT_EVENT,
  BOARD_TILE_SELECTED_EVENT,
  getTileBaseNameStem,
  inferTileMaterialTextures,
  loadCampaignFile,
  loadCampaignSummaries,
  loadTileLibrary,
  openTilesFolder,
  resolveActiveCampaign,
  saveCampaignFile,
  sortByPriority,
  type CampaignSummary,
  type CampaignTileEntry,
  type TileLibraryAsset,
} from "./shared";

type CampaignState = { campaign: CampaignSummary; tileEntries: CampaignTileEntry[] };
type Group = { key: string; name: string; preview: TileLibraryAsset; count: number };

const overlayKeys: Array<keyof TileMaterialTextures> = [
  "overlayAssetId",
  "cornerOverlayAssetId",
  "overlayHorizontalAssetId",
  "overlayVerticalAssetId",
  "cornerOverlayNeAssetId",
  "cornerOverlayNwAssetId",
  "cornerOverlaySeAssetId",
  "cornerOverlaySwAssetId",
  "cornerOverlayHorizontalAssetId",
  "cornerOverlayVerticalAssetId",
];

const box: CSSProperties = { border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, background: "rgba(10, 13, 20, 0.75)", padding: 8, display: "grid", gap: 8 };
const btn: CSSProperties = { border: "1px solid rgba(142,157,182,.55)", borderRadius: 7, background: "rgba(21,27,39,.95)", color: "#f2f6ff", fontSize: 12, padding: "7px 10px", cursor: "pointer" };
const tileGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, 92px)",
  justifyContent: "start",
  gap: 8,
  maxHeight: 220,
  overflowY: "auto",
};

const keyOf = (v: string) => v.trim().toLowerCase();
const emptyTextures = (baseAssetId = ""): TileMaterialTextures => ({
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
const hasOverlay = (t: TileMaterialTextures) => overlayKeys.some((k) => Boolean(t[k]));
const reorderIds = (assetIds: string[], draggedId: string, targetId: string) => {
  if (draggedId === targetId) return assetIds;
  const filtered = assetIds.filter((assetId) => assetId !== draggedId);
  const nextIndex = filtered.indexOf(targetId);
  if (nextIndex < 0) return [...filtered, draggedId];
  return [...filtered.slice(0, nextIndex), draggedId, ...filtered.slice(nextIndex)];
};

const normalizeMat = (
  raw: TileMaterial | undefined,
  tile: TileLibraryAsset,
  priority: number,
  valid: Set<string>,
  libraryAssets: TileLibraryAsset[],
  hasGlobalTileSetting: boolean
): TileMaterial => {
  const base = raw?.textures?.baseAssetId && valid.has(raw.textures.baseAssetId) ? raw.textures.baseAssetId : tile.id;
  const textures = raw?.textures ?? emptyTextures(base);
  const inferredTextures = inferTileMaterialTextures(tile, libraryAssets);
  const rawHasAnyOverlay = overlayKeys.some((key) => Boolean(textures[key]));
  const shouldUseInference =
    !raw ||
    (!rawHasAnyOverlay && (raw.noOverlay !== true || !hasGlobalTileSetting));
  const out: TileMaterialTextures = { ...emptyTextures(base) };
  for (const k of overlayKeys) {
    const rawValue = textures[k];
    const rawResolved = typeof rawValue === "string" && valid.has(rawValue) ? rawValue : "";
    const inferredValue = inferredTextures[k];
    const inferredResolved = typeof inferredValue === "string" && valid.has(inferredValue) ? inferredValue : "";
    out[k] = rawResolved || (shouldUseInference ? inferredResolved : "");
  }
  return {
    id: raw?.id || `material-${base}`,
    name: (raw?.name && raw.name.trim()) || getTileBaseNameStem(tile.name) || tile.name,
    priority,
    rotationMode: raw?.rotationMode === "none" ? "none" : "random90",
    noOverlay: typeof raw?.noOverlay === "boolean" ? raw.noOverlay : !hasOverlay(out),
    textures: out,
  };
};

const ensureMaterials = (
  assetIds: string[],
  stored: TileMaterial[] | undefined,
  byId: Map<string, TileLibraryAsset>,
  globallyConfiguredTileIds: Set<string> = new Set()
) => {
  const valid = new Set(byId.keys());
  const libraryAssets = [...byId.values()];
  const byBase = new Map<string, TileMaterial>();
  for (const m of stored ?? []) {
    const base = m?.textures?.baseAssetId;
    if (base && valid.has(base)) byBase.set(base, m);
  }
  const next: TileMaterial[] = [];
  assetIds.forEach((id, i) => {
    const tile = byId.get(id);
    if (tile) {
      next.push(normalizeMat(byBase.get(id), tile, i, valid, libraryAssets, globallyConfiguredTileIds.has(id)));
    }
  });
  return next;
};

export default function TilesBoard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [library, setLibrary] = useState<TileLibraryAsset[]>([]);
  const [campaignState, setCampaignState] = useState<CampaignState | null>(null);
  const [materials, setMaterials] = useState<TileMaterial[]>([]);
  const [selectedTileId, setSelectedTileId] = useState("");
  const [openLibrary, setOpenLibrary] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [tileContextMenu, setTileContextMenu] = useState<{ x: number; y: number; tile: TileLibraryAsset } | null>(null);

  const tileById = useMemo(() => new Map(library.map((t) => [t.id, t])), [library]);

  const groups = useMemo(() => {
    const grouped = new Map<string, TileLibraryAsset[]>();
    for (const t of library) {
      const key = keyOf(getTileBaseNameStem(t.name));
      const arr = grouped.get(key) ?? [];
      arr.push(t);
      grouped.set(key, arr);
    }
    const next: Group[] = [];
    for (const [k, arr] of grouped) {
      const preview = arr.find((t) => keyOf(t.name) === k);
      if (!preview) continue;
      next.push({ key: k, name: getTileBaseNameStem(arr[0].name), preview, count: arr.length });
    }
    next.sort((a, b) => a.name.localeCompare(b.name));
    return next;
  }, [library]);

  const campaignIds = useMemo(() => sortByPriority(campaignState?.tileEntries).map((e) => e.assetId), [campaignState]);
  const campaignTiles = useMemo(() => campaignIds.map((id) => tileById.get(id)).filter((v): v is TileLibraryAsset => Boolean(v)), [campaignIds, tileById]);

  const emitLibrary = (assets: TileLibraryAsset[]) => window.dispatchEvent(new CustomEvent(BOARD_TILE_LIBRARY_CHANGED_EVENT, { detail: { assets } }));
  const emitMaterials = (next: TileMaterial[], selectedMaterialId?: string | null) =>
    window.dispatchEvent(new CustomEvent(BOARD_TILE_MATERIALS_CHANGED_EVENT, { detail: { materials: next, selectedMaterialId } }));

  const persistCampaign = async (campaign: CampaignSummary, assetIds: string[], nextMaterials: TileMaterial[], selectedMaterialId?: string | null) => {
    const file = await loadCampaignFile(campaign);
    const entries = assetIds.map((assetId, priority) => ({ assetId, priority }));
    await saveCampaignFile(campaign, { ...file, campaignAssets: { ...(file.campaignAssets ?? {}), tiles: entries }, tileMaterials: nextMaterials });
    setCampaignState({ campaign, tileEntries: entries });
    setMaterials(nextMaterials);
    emitMaterials(nextMaterials, selectedMaterialId);
  };

  const loadState = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tool, campaigns, tiles] = await Promise.all([loadToolSettings(), loadCampaignSummaries(), loadTileLibrary()]);
      setLibrary(tiles);
      emitLibrary(tiles);
      const active = resolveActiveCampaign(campaigns);
      if (!active) {
        setCampaignState(null);
        setMaterials([]);
        setSelectedTileId("");
        emitMaterials([], null);
        return;
      }

      const file = await loadCampaignFile(active);
      const ids = sortByPriority(file.campaignAssets?.tiles).map((e) => e.assetId).filter((id) => tileById.has(id) || tiles.some((t) => t.id === id));
      const byId = new Map(tiles.map((t) => [t.id, t]));
      const globalTileSettings = tool.tileMaterialSettings ?? {};
      const nextMaterials = ensureMaterials(
        ids,
        Array.isArray(file.tileMaterials) ? (file.tileMaterials as TileMaterial[]) : [],
        byId,
        new Set(Object.keys(globalTileSettings))
      );
      setCampaignState({ campaign: active, tileEntries: ids.map((assetId, priority) => ({ assetId, priority })) });
      setMaterials(nextMaterials);
      const selected = tool.selected.tileAssetId && ids.includes(tool.selected.tileAssetId) ? tool.selected.tileAssetId : ids[0] ?? "";
      setSelectedTileId(selected);
      emitMaterials(nextMaterials, nextMaterials.find((m) => m.textures.baseAssetId === selected)?.id ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tiles.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadState();
    const onCampaign = () => void loadState();
    window.addEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onCampaign);
    return () => window.removeEventListener(ACTIVE_CAMPAIGN_CHANGED_EVENT, onCampaign);
  }, []);

  useEffect(() => {
    if (!tileContextMenu) return;
    const onPointerDown = () => setTileContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTileContextMenu(null);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [tileContextMenu]);

  const refreshLibrary = async () => {
    setError(null);
    setNotice(null);
    try {
      const tiles = await loadTileLibrary();
      setLibrary(tiles);
      emitLibrary(tiles);
      await loadState();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to refresh library.");
    }
  };

  const onImportClick = async () => {
    setError(null);
    setNotice(null);
    try {
      const opened = await openTilesFolder();
      if (opened.result) {
        setError(`Copy files to: ${opened.path}`);
        return;
      }
      setNotice(`Tiles folder opened: ${opened.path}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to open tiles folder.");
    }
  };

  const selectTile = async (tile: TileLibraryAsset) => {
    setSelectedTileId(tile.id);
    void updateToolSettings((current) => ({
      ...current,
      selected: { ...current.selected, tileAssetId: tile.id },
    })).catch(() => {
      // Keep selection interaction responsive even if persistence fails.
    });
    const materialId = materials.find((m) => m.textures.baseAssetId === tile.id)?.id ?? null;
    emitMaterials(materials, materialId);
    window.dispatchEvent(new CustomEvent(BOARD_TILE_SELECTED_EVENT, { detail: { assetId: tile.id, name: tile.name, url: tile.url, materialId } }));
  };

  const addFromLibrary = async (group: Group) => {
    if (!campaignState) return;
    const nextIds = campaignIds.includes(group.preview.id) ? campaignIds : [...campaignIds, group.preview.id];
    const nextMaterials = ensureMaterials(nextIds, materials, tileById);
    await persistCampaign(campaignState.campaign, nextIds, nextMaterials);
    setOpenLibrary(false);
  };

  const onDragStart = (assetId: string) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", assetId);
    setDraggingId(assetId);
  };

  const onDrop = (target: string) => async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dragged = event.dataTransfer.getData("text/plain");
    setDraggingId(null);
    if (!campaignState || !dragged) return;
    const nextIds = reorderIds(campaignIds, dragged, target);
    await persistCampaign(campaignState.campaign, nextIds, ensureMaterials(nextIds, materials, tileById));
  };

  const removeTile = (assetId: string) => async () => {
    if (!campaignState) return;
    const nextIds = campaignIds.filter((id) => id !== assetId);
    const nextMaterials = ensureMaterials(nextIds, materials, tileById);
    const nextSelected = nextIds.includes(selectedTileId) ? selectedTileId : nextIds[0] ?? "";
    setSelectedTileId(nextSelected);
    await persistCampaign(campaignState.campaign, nextIds, nextMaterials, nextMaterials.find((m) => m.textures.baseAssetId === nextSelected)?.id ?? null);
  };

  const moveTileByOffset = (assetId: string, offset: number) => async () => {
    if (!campaignState) return;
    const fromIndex = campaignIds.indexOf(assetId);
    if (fromIndex < 0) return;
    const toIndex = Math.max(0, Math.min(campaignIds.length - 1, fromIndex + offset));
    if (toIndex === fromIndex) return;
    const nextIds = [...campaignIds];
    const [movedId] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, movedId);
    await persistCampaign(campaignState.campaign, nextIds, ensureMaterials(nextIds, materials, tileById));
  };

  const moveTileToEdge = (assetId: string, edge: "top" | "bottom") => async () => {
    if (!campaignState) return;
    const fromIndex = campaignIds.indexOf(assetId);
    if (fromIndex < 0) return;
    const nextIds = [...campaignIds];
    const [movedId] = nextIds.splice(fromIndex, 1);
    if (edge === "top") {
      nextIds.unshift(movedId);
    } else {
      nextIds.push(movedId);
    }
    await persistCampaign(campaignState.campaign, nextIds, ensureMaterials(nextIds, materials, tileById));
  };

  const openTileSettings = async (tile: TileLibraryAsset) => {
    setSelectedTileId(tile.id);
    setTileContextMenu(null);

    void updateToolSettings((current) => ({
      ...current,
      selected: {
        ...current.selected,
        tileAssetId: tile.id,
      },
    })).catch(() => {
      // Opening editor should not be blocked by persistence issues.
    });

    window.dispatchEvent(
      new CustomEvent(BOARD_TILE_SETTINGS_EDIT_EVENT, {
        detail: { assetId: tile.id },
      })
    );
    window.dispatchEvent(
      new CustomEvent("dnd:boards-toggle", {
        detail: { id: "tileSettings", action: "open" },
      })
    );
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <section style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Import Tiles (Manual Copy)</div>
        <div style={{ fontSize: 12, color: "#c8d2e6" }}>Click import to open <code>Documents/DND/Assets/Tiles</code>, copy files, then refresh.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btn} onClick={() => void onImportClick()}>Import Tiles...</button>
          <button type="button" style={btn} onClick={() => void refreshLibrary()}>Refresh Library</button>
        </div>
      </section>

      {notice && <div style={{ fontSize: 12, color: "#9dd0ff" }}>{notice}</div>}
      {error && <div style={{ fontSize: 12, color: "#ff9b9b" }}>{error}</div>}

      <section style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Campaign Tiles</div>
        <button type="button" style={btn} onClick={() => setOpenLibrary(true)}>Add from Library...</button>
        {loading ? <div style={{ fontSize: 12, color: "#c8d2e6" }}>Loading...</div> : !campaignState ? <div style={{ fontSize: 12, color: "#c8d2e6" }}>No active campaign selected.</div> : campaignTiles.length === 0 ? <div style={{ fontSize: 12, color: "#c8d2e6" }}>No tiles in this campaign yet.</div> : (
          <div style={tileGridStyle}>
            {campaignTiles.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() => void selectTile(tile)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setTileContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    tile,
                  });
                }}
                style={{
                  ...btn,
                  width: 92,
                  background: tile.id === selectedTileId ? "rgba(73, 128, 223, 0.35)" : "rgba(16,20,28,0.92)",
                  padding: 6,
                  display: "grid",
                  gap: 4,
                }}
              >
                <img src={tile.url} alt={tile.name} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.16)" }} />
                <span style={{ fontSize: 11, color: "#dde5f4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tile.name}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Priority Order</div>
        <div style={{ fontSize: 11, color: "#9fb0cd" }}>
          Drag to reorder or use arrow controls for quick moves.
        </div>
        {!campaignState || campaignTiles.length === 0 ? <div style={{ fontSize: 12, color: "#c8d2e6" }}>No campaign tiles to order.</div> : (
          <div style={{ display: "grid", gap: 6, maxHeight: 170, overflowY: "auto" }}>
            {campaignTiles.map((tile, index) => (
              <div key={tile.id} draggable onDragStart={onDragStart(tile.id)} onDragOver={(event) => event.preventDefault()} onDragEnd={() => setDraggingId(null)} onDrop={onDrop(tile.id)} style={{ ...btn, background: draggingId === tile.id ? "rgba(121, 156, 223, 0.25)" : "rgba(16,20,28,0.92)", padding: "6px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{index + 1}. {tile.name}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    type="button"
                    onClick={moveTileToEdge(tile.id, "top")}
                    disabled={index === 0}
                    style={{ ...btn, padding: "3px 5px", fontSize: 11, opacity: index === 0 ? 0.5 : 1 }}
                    title="Move to top"
                  >
                    Top
                  </button>
                  <button
                    type="button"
                    onClick={moveTileByOffset(tile.id, -1)}
                    disabled={index === 0}
                    style={{ ...btn, padding: "3px 5px", fontSize: 11, opacity: index === 0 ? 0.5 : 1 }}
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={moveTileByOffset(tile.id, 1)}
                    disabled={index === campaignTiles.length - 1}
                    style={{
                      ...btn,
                      padding: "3px 5px",
                      fontSize: 11,
                      opacity: index === campaignTiles.length - 1 ? 0.5 : 1,
                    }}
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={moveTileToEdge(tile.id, "bottom")}
                    disabled={index === campaignTiles.length - 1}
                    style={{
                      ...btn,
                      padding: "3px 5px",
                      fontSize: 11,
                      opacity: index === campaignTiles.length - 1 ? 0.5 : 1,
                    }}
                    title="Move to bottom"
                  >
                    End
                  </button>
                  <button type="button" onClick={removeTile(tile.id)} style={{ ...btn, padding: "3px 6px", fontSize: 11 }}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={box}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Tile Settings</div>
        <div style={{ fontSize: 12, color: "#c8d2e6" }}>
          Right-click a campaign tile preview and choose <strong>Edit Tile Settings</strong> to open the Tile Settings board.
        </div>
      </section>

      {tileContextMenu && (
        <div
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: tileContextMenu.x,
            top: tileContextMenu.y,
            zIndex: 2600,
            border: "1px solid rgba(170,184,210,0.55)",
            borderRadius: 8,
            background: "rgba(12, 16, 24, 0.98)",
            padding: 6,
            minWidth: 170,
            display: "grid",
            gap: 4,
          }}
        >
          <button
            type="button"
            style={{ ...btn, textAlign: "left", padding: "6px 8px" }}
            onClick={() => void openTileSettings(tileContextMenu.tile)}
          >
            Edit Tile Settings
          </button>
        </div>
      )}

      {openLibrary && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.42)", display: "grid", placeItems: "center", zIndex: 2500, pointerEvents: "auto" }} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenLibrary(false); }}>
          <div style={{ width: "min(560px, calc(100vw - 48px))", maxHeight: "min(520px, calc(100vh - 48px))", border: "1px solid rgba(170, 184, 210, 0.45)", borderRadius: 10, background: "rgba(12, 17, 26, 0.98)", padding: 12, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#eef3ff" }}>Global Tile Library</div>
              <button type="button" style={{ ...btn, padding: "5px 8px", fontSize: 11 }} onClick={() => setOpenLibrary(false)}>Close</button>
            </div>
            <div style={{ ...tileGridStyle, maxHeight: 360 }}>
              {groups.length === 0 ? <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#c8d2e6" }}>No complete tile sets found. Add base files like <code>name.png</code>.</div> : groups.map((g) => (
                <button key={g.key} type="button" onClick={() => void addFromLibrary(g)} style={{ ...btn, background: "rgba(16,20,28,0.92)", padding: 6, display: "grid", gap: 4 }}>
                  <img src={g.preview.url} alt={g.name} style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 6, border: "1px solid rgba(255,255,255,0.16)" }} />
                  <span style={{ fontSize: 11, color: "#dde5f4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</span>
                  <span style={{ fontSize: 10, color: "#9fb0cd" }}>{g.count} file{g.count === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

