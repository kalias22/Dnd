import { createElement, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Application, Container, Graphics, Rectangle, Sprite, Text, Texture } from "pixi.js";
import { GRID_SIZE } from "./constants";
import { circleCells, polygonCells, rectCells, type GridCell, type WorldPoint } from "../systems/brush/brushFill";
import type { BrushAction, BrushMode, BrushTarget } from "../systems/brush/brushTypes";

const ORIGIN_MARKER_SIZE = 22;
const ORIGIN_MARKER_THICKNESS = 3;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.0015;
const SELECTION_DRAG_THRESHOLD = 3;
const ROTATE_STEP_DEG = 15;
const TOKEN_SCALE_DOWN_FACTOR = 0.9;
const TOKEN_SCALE_UP_FACTOR = 1.1;
const MIN_TOKEN_SCALE = 0.25;
const MAX_TOKEN_SCALE = 4;
const TOKEN_MOVE_SPEED = 600;
const PLACED_ASSET_MAX_SIZE = 240;
const DEFAULT_PLAYER_RADIUS = 18;
const DEFAULT_PLAYER_HP = 10;
const BASE_TILE_ROTATIONS = [0, Math.PI / 2, Math.PI, Math.PI * 1.5] as const;

type TokenRecord = {
  id: string;
  name: string;
  radius: number;
  color: number;
  tokenImageUrl: string | null;
  imageRequestedUrl: string | null;
  imageLoadVersion: number;
  hpCurrent: number;
  hpMax: number;
  container: Container;
  imageSprite: Sprite | null;
  body: Graphics;
  label: Text;
  hpBarBg: Graphics;
  hpBarFill: Graphics;
  rotationDeg: number;
  scale: number;
  targetX: number | null;
  targetY: number | null;
  moving: boolean;
};

type LegacyTileMaterialTextures = Partial<{
  isolatedAssetId: string;
  endAssetId: string;
  straightAssetId: string;
  cornerAssetId: string;
  teeAssetId: string;
  crossAssetId: string;
}>;

export type TokenContextAction =
  | { nonce: number; type: "delete"; tokenId: string }
  | { nonce: number; type: "duplicate"; tokenId: string }
  | { nonce: number; type: "rename"; tokenId: string; name: string }
  | { nonce: number; type: "setHp"; tokenId: string; hpCurrent: number; hpMax: number };

export type TokenSummary = {
  id: string;
  name: string;
};

export type PlacingAsset = {
  id: string;
  name: string;
  url: string;
};

export type TileMaterialTextures = {
  baseAssetId: string;
  overlayAssetId: string;
  cornerOverlayAssetId: string;
  overlayHorizontalAssetId: string;
  overlayVerticalAssetId: string;
  cornerOverlayHorizontalAssetId: string;
  cornerOverlayVerticalAssetId: string;
  cornerOverlayNeAssetId: string;
  cornerOverlayNwAssetId: string;
  cornerOverlaySeAssetId: string;
  cornerOverlaySwAssetId: string;
};

export type TileRotationMode = "random90" | "none";

export type TileMaterial = {
  id: string;
  name: string;
  priority: number;
  rotationMode?: TileRotationMode;
  noOverlay?: boolean;
  textures: TileMaterialTextures;
};

export type PlayerCharacter = {
  id: string;
  name: string;
  color: string;
  tokenAssetId: string | null;
};

export type AssetLibraryItem = {
  id: string;
  url: string;
};

export type TabletopAppOptions = {
  snapToGrid?: boolean;
  contextAction?: TokenContextAction | null;
  placingAsset?: PlacingAsset | null;
  stampAsset?: PlacingAsset | null;
  materials?: TileMaterial[];
  stampingMaterialId?: string | null;
  brushMode?: BrushMode;
  brushAction?: BrushAction;
  brushTarget?: BrushTarget;
  gridOverlayEnabled?: boolean;
  players?: PlayerCharacter[];
  assetLibrary?: AssetLibraryItem[];
  onPlacedAsset?: () => void;
  onTokensChange?: (tokens: TokenSummary[]) => void;
  onTokenContextMenu?: (tokenId: string, screenX: number, screenY: number) => void;
  onRequestCloseContextMenu?: () => void;
};

function PixiTabletopRuntime({
  snapToGrid = true,
  contextAction = null,
  placingAsset = null,
  stampAsset = null,
  materials = [],
  stampingMaterialId = null,
  brushMode = "manual",
  brushAction = "place",
  brushTarget = "base",
  gridOverlayEnabled = true,
  players = [],
  assetLibrary = [],
  onPlacedAsset,
  onTokensChange,
  onTokenContextMenu,
  onRequestCloseContextMenu,
}: TabletopAppOptions) {
  const hostRef = useRef<HTMLDivElement>(null);
  const snapToGridRef = useRef(snapToGrid);
  const placingAssetRef = useRef<PlacingAsset | null>(placingAsset);
  const stampAssetRef = useRef<PlacingAsset | null>(stampAsset);
  const materialsRef = useRef<TileMaterial[]>(materials);
  const stampingMaterialIdRef = useRef<string | null>(stampingMaterialId);
  const brushModeRef = useRef<BrushMode>(brushMode);
  const brushActionRef = useRef<BrushAction>(brushAction);
  const brushTargetRef = useRef<BrushTarget>(brushTarget);
  const gridOverlayEnabledRef = useRef(gridOverlayEnabled);
  const playersRef = useRef<PlayerCharacter[]>(players);
  const assetLibraryRef = useRef<AssetLibraryItem[]>(assetLibrary);
  const onPlacedAssetRef = useRef(onPlacedAsset);
  const onTokensChangeRef = useRef(onTokensChange);
  const onTokenContextMenuRef = useRef(onTokenContextMenu);
  const onRequestCloseContextMenuRef = useRef(onRequestCloseContextMenu);
  const runContextActionRef = useRef<((action: TokenContextAction) => void) | null>(null);
  const placeAssetAtClientRef = useRef<
    (clientX: number, clientY: number) => "single" | "stamp" | "material" | null
  >(() => null);
  const syncPlayersRef = useRef<((nextPlayers: PlayerCharacter[], nextAssets: AssetLibraryItem[]) => void) | null>(
    null
  );
  const refreshMaterialTilesRef = useRef<(() => void) | null>(null);
  const applyGridOverlayVisibilityRef = useRef<((visible: boolean) => void) | null>(null);

  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);

  useEffect(() => {
    placingAssetRef.current = placingAsset;
  }, [placingAsset]);

  useEffect(() => {
    stampAssetRef.current = stampAsset;
  }, [stampAsset]);

  useEffect(() => {
    materialsRef.current = materials;
    refreshMaterialTilesRef.current?.();
  }, [materials]);

  useEffect(() => {
    stampingMaterialIdRef.current = stampingMaterialId;
  }, [stampingMaterialId]);

  useEffect(() => {
    brushModeRef.current = brushMode;
  }, [brushMode]);

  useEffect(() => {
    brushActionRef.current = brushAction;
  }, [brushAction]);

  useEffect(() => {
    brushTargetRef.current = brushTarget;
  }, [brushTarget]);

  useEffect(() => {
    gridOverlayEnabledRef.current = gridOverlayEnabled;
    applyGridOverlayVisibilityRef.current?.(gridOverlayEnabled);
  }, [gridOverlayEnabled]);

  useEffect(() => {
    playersRef.current = players;
    syncPlayersRef.current?.(players, assetLibraryRef.current);
  }, [players]);

  useEffect(() => {
    assetLibraryRef.current = assetLibrary;
    syncPlayersRef.current?.(playersRef.current, assetLibrary);
    refreshMaterialTilesRef.current?.();
  }, [assetLibrary]);

  useEffect(() => {
    onPlacedAssetRef.current = onPlacedAsset;
  }, [onPlacedAsset]);

  useEffect(() => {
    onTokenContextMenuRef.current = onTokenContextMenu;
  }, [onTokenContextMenu]);

  useEffect(() => {
    onTokensChangeRef.current = onTokensChange;
  }, [onTokensChange]);

  useEffect(() => {
    onRequestCloseContextMenuRef.current = onRequestCloseContextMenu;
  }, [onRequestCloseContextMenu]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let app: Application | null = null;
    let world: Container | null = null;
    let gridLayer: Graphics | null = null;
    let previewLayer: Graphics | null = null;
    let tilesLayer: Container | null = null;
    let overlaysLayer: Container | null = null;
    let materialOverlayLayerById = new Map<string, Container>();
    let tokensLayer: Container | null = null;
    let originMarker: Graphics | null = null;
    let selectionOverlay: Graphics | null = null;
    let movementPreviewOverlay: Graphics | null = null;
    let tokenRecords: TokenRecord[] = [];
    let selectedTokenIds = new Set<string>();
    type MaterialTileRecord = { gx: number; gy: number; materialId: string; sprite: Sprite; baseRotation: number };
    type TileCellRecord = { base?: Sprite; overlays: Sprite[] };
    let materialTileByCellKey = new Map<string, MaterialTileRecord>();
    let tileCellByKey = new Map<string, TileCellRecord>();
    const textureByUrl = new Map<string, Texture>();
    const loadingTextureUrls = new Set<string>();
    const failedTextureUrls = new Set<string>();
    let detachInteractions: (() => void) | null = null;
    let detachKeyboard: (() => void) | null = null;
    let rebindInteractionHandlers: (() => void) | null = null;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const getRandomBaseRotation = () => BASE_TILE_ROTATIONS[Math.floor(Math.random() * BASE_TILE_ROTATIONS.length)];
    const parseHexColor = (input: string, fallback: number) => {
      const normalized = input.trim().replace("#", "");
      if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return Number.parseInt(normalized, 16);
      }
      return fallback;
    };
    const emitTokensChange = () => {
      onTokensChangeRef.current?.(
        tokenRecords.map((token) => ({
          id: token.id,
          name: token.name,
        }))
      );
    };

    const drawToken = (token: TokenRecord, selected: boolean) => {
      if (token.tokenImageUrl) {
        if (token.imageRequestedUrl !== token.tokenImageUrl) {
          token.imageRequestedUrl = token.tokenImageUrl;
          token.imageLoadVersion += 1;
          const currentLoadVersion = token.imageLoadVersion;
          const requestedUrl = token.tokenImageUrl;
          const image = new Image();
          image.onload = () => {
            if (disposed || token.container.destroyed) return;
            if (token.imageLoadVersion !== currentLoadVersion) return;
            if (token.imageRequestedUrl !== requestedUrl) return;

            if (token.imageSprite) {
              token.imageSprite.destroy();
            }

            const sprite = Sprite.from(image);
            sprite.anchor.set(0.5);
            sprite.eventMode = "none";
            token.container.addChildAt(sprite, 0);
            token.imageSprite = sprite;
            drawToken(token, selectedTokenIds.has(token.id));
          };
          image.onerror = () => {
            if (disposed || token.container.destroyed) return;
            if (token.imageLoadVersion !== currentLoadVersion) return;
            if (token.imageRequestedUrl !== requestedUrl) return;
            if (token.imageSprite) {
              token.imageSprite.destroy();
              token.imageSprite = null;
            }
          };
          image.src = requestedUrl;
        }
        if (token.imageSprite) {
          const diameter = token.radius * 2;
          const sourceWidth = token.imageSprite.texture.width;
          const sourceHeight = token.imageSprite.texture.height;
          if (sourceWidth > 0 && sourceHeight > 0) {
            const uniformScale = diameter / Math.max(sourceWidth, sourceHeight);
            token.imageSprite.scale.set(uniformScale);
          }
        }
      } else {
        token.imageRequestedUrl = null;
        token.imageLoadVersion += 1;
        if (token.imageSprite) {
          token.imageSprite.destroy();
          token.imageSprite = null;
        }
      }

      token.body.clear();
      if (token.tokenImageUrl && token.imageSprite) {
        token.body.circle(0, 0, token.radius).fill({ color: 0xffffff, alpha: 0.001 });
      } else {
        token.body.circle(0, 0, token.radius).fill({ color: token.color, alpha: 1 });
      }
      if (selected) {
        token.body.setStrokeStyle({ width: 3, color: 0xfff07a, alpha: 1 });
        token.body.circle(0, 0, token.radius + 4).stroke();
      }

      token.label.text = token.name;
      token.label.x = -token.label.width / 2;
      token.label.y = -token.radius - token.label.height - 8;

      const hpRatio = clamp(token.hpCurrent / Math.max(token.hpMax, 1), 0, 1);
      const hpBarWidth = token.radius * 2;
      const hpBarHeight = 6;
      const hpBarY = token.radius + 8;

      token.hpBarBg.clear();
      token.hpBarBg.rect(-hpBarWidth / 2, hpBarY, hpBarWidth, hpBarHeight).fill({
        color: 0x1b1b1b,
        alpha: 0.95,
      });

      token.hpBarFill.clear();
      token.hpBarFill.rect(-hpBarWidth / 2, hpBarY, hpBarWidth * hpRatio, hpBarHeight).fill({
        color: 0x34d17c,
        alpha: 1,
      });

      token.container.rotation = (token.rotationDeg * Math.PI) / 180;
      token.container.scale.set(token.scale);
    };

    const refreshTokenStyles = () => {
      for (const token of tokenRecords) {
        drawToken(token, selectedTokenIds.has(token.id));
      }
    };

    const setSelection = (ids: string[]) => {
      selectedTokenIds = new Set(ids);
      refreshTokenStyles();
    };

    const getPrimarySelectedToken = () => {
      const firstSelectedId = selectedTokenIds.values().next().value as string | undefined;
      if (!firstSelectedId) return null;
      return tokenRecords.find((token) => token.id === firstSelectedId) ?? null;
    };

    const drawSelectionRect = (x0: number, y0: number, x1: number, y1: number) => {
      if (!selectionOverlay) return;

      const left = Math.min(x0, x1);
      const top = Math.min(y0, y1);
      const width = Math.abs(x1 - x0);
      const height = Math.abs(y1 - y0);

      selectionOverlay.clear();
      selectionOverlay.rect(left, top, width, height).fill({ color: 0x8ec5ff, alpha: 0.18 });
      selectionOverlay.setStrokeStyle({ width: 1.5, color: 0xb7d9ff, alpha: 1 });
      selectionOverlay.rect(left, top, width, height).stroke();
    };

    const clearSelectionRect = () => {
      if (selectionOverlay) selectionOverlay.clear();
    };

    const clearMovementPreview = () => {
      if (movementPreviewOverlay) movementPreviewOverlay.clear();
    };

    const clearBrushPreview = () => {
      if (previewLayer) previewLayer.clear();
    };

    const drawBrushPreviewCells = (cells: GridCell[]) => {
      if (!previewLayer) return;
      previewLayer.clear();
      for (const cell of cells) {
        previewLayer
          .rect(
            toCellCenterCoordinate(cell.x) - GRID_SIZE / 2,
            toCellCenterCoordinate(cell.y) - GRID_SIZE / 2,
            GRID_SIZE,
            GRID_SIZE
          )
          .fill({ color: 0x8ec5ff, alpha: 0.28 });
      }
    };

    const drawMovementPreview = (
      token: TokenRecord,
      startX: number,
      startY: number,
      previewX: number,
      previewY: number
    ) => {
      if (!movementPreviewOverlay) return;

      const previewRadius = token.radius * token.scale;
      movementPreviewOverlay.clear();
      movementPreviewOverlay.setStrokeStyle({ width: 2, color: 0xc8dcff, alpha: 0.9 });
      movementPreviewOverlay.moveTo(startX, startY);
      movementPreviewOverlay.lineTo(previewX, previewY);
      movementPreviewOverlay.stroke();
      movementPreviewOverlay.circle(previewX, previewY, previewRadius).fill({
        color: token.color,
        alpha: 0.38,
      });
      movementPreviewOverlay.setStrokeStyle({ width: 1.5, color: 0xe8f0ff, alpha: 0.9 });
      movementPreviewOverlay.circle(previewX, previewY, previewRadius).stroke();
    };

    const drawGrid = () => {
      if (!app || !gridLayer || !world) return;

      const halfWidth = Math.max(app.screen.width * 2, 2000);
      const halfHeight = Math.max(app.screen.height * 2, 2000);
      const startX = Math.floor(-halfWidth / GRID_SIZE) * GRID_SIZE;
      const endX = Math.ceil(halfWidth / GRID_SIZE) * GRID_SIZE;
      const startY = Math.floor(-halfHeight / GRID_SIZE) * GRID_SIZE;
      const endY = Math.ceil(halfHeight / GRID_SIZE) * GRID_SIZE;

      gridLayer.clear();
      gridLayer.setStrokeStyle({ width: 1, color: 0xd8e1ef, alpha: 0.25 });

      for (let x = startX; x <= endX; x += GRID_SIZE) {
        gridLayer.moveTo(x, startY);
        gridLayer.lineTo(x, endY);
      }

      for (let y = startY; y <= endY; y += GRID_SIZE) {
        gridLayer.moveTo(startX, y);
        gridLayer.lineTo(endX, y);
      }

      gridLayer.stroke();
    };

    const drawOriginMarker = () => {
      if (!originMarker) return;

      originMarker.clear();
      originMarker.rect(0, 0, ORIGIN_MARKER_SIZE, ORIGIN_MARKER_THICKNESS).fill({
        color: 0xffffff,
        alpha: 1,
      });
      originMarker.rect(0, 0, ORIGIN_MARKER_THICKNESS, ORIGIN_MARKER_SIZE).fill({
        color: 0xffffff,
        alpha: 1,
      });
    };

    const toCellCoordinate = (value: number) => Math.round((value - GRID_SIZE / 2) / GRID_SIZE);
    const toCellCenterCoordinate = (cellCoordinate: number) => cellCoordinate * GRID_SIZE + GRID_SIZE / 2;
    const snapToCellCenter = (value: number) => toCellCenterCoordinate(toCellCoordinate(value));
    const toMaterialTileCellKey = (gx: number, gy: number) => `${gx},${gy}`;
    const parseMaterialTileCellKey = (cellKey: string) => {
      const [xRaw, yRaw] = cellKey.split(",");
      return { gx: Number(xRaw), gy: Number(yRaw) };
    };
    const getOrCreateTileCell = (gx: number, gy: number) => {
      const key = toMaterialTileCellKey(gx, gy);
      let existing = tileCellByKey.get(key);
      if (existing) return existing;
      existing = { overlays: [] };
      tileCellByKey.set(key, existing);
      return existing;
    };
    const setBaseSpriteAtCell = (gx: number, gy: number, sprite: Sprite) => {
      getOrCreateTileCell(gx, gy).base = sprite;
    };
    const addOverlaySpriteAtCell = (gx: number, gy: number, sprite: Sprite) => {
      getOrCreateTileCell(gx, gy).overlays.push(sprite);
    };
    const getMaterialTileAt = (gx: number, gy: number) => materialTileByCellKey.get(toMaterialTileCellKey(gx, gy)) ?? null;

    const getMaterialById = (materialId: string) =>
      materialsRef.current.find((material) => material.id === materialId) ?? null;
    const getMaterialRotationMode = (materialId: string): TileRotationMode =>
      getMaterialById(materialId)?.rotationMode ?? "random90";
    const isNoOverlayMaterial = (material: TileMaterial) => {
      if (typeof material.noOverlay === "boolean") return material.noOverlay;
      const textureConfig = material.textures as TileMaterialTextures & LegacyTileMaterialTextures;
      const overlayAssetId = textureConfig.overlayAssetId || textureConfig.endAssetId || "";
      const cornerOverlayAssetId = textureConfig.cornerOverlayAssetId || textureConfig.cornerAssetId || "";
      const overlayHorizontalAssetId = textureConfig.overlayHorizontalAssetId || "";
      const overlayVerticalAssetId = textureConfig.overlayVerticalAssetId || "";
      const cornerOverlayHorizontalAssetId = textureConfig.cornerOverlayHorizontalAssetId || "";
      const cornerOverlayVerticalAssetId = textureConfig.cornerOverlayVerticalAssetId || "";
      const cornerOverlayNeAssetId = textureConfig.cornerOverlayNeAssetId || "";
      const cornerOverlayNwAssetId = textureConfig.cornerOverlayNwAssetId || "";
      const cornerOverlaySeAssetId = textureConfig.cornerOverlaySeAssetId || "";
      const cornerOverlaySwAssetId = textureConfig.cornerOverlaySwAssetId || "";
      return (
        !overlayAssetId &&
        !cornerOverlayAssetId &&
        !overlayHorizontalAssetId &&
        !overlayVerticalAssetId &&
        !cornerOverlayHorizontalAssetId &&
        !cornerOverlayVerticalAssetId &&
        !cornerOverlayNeAssetId &&
        !cornerOverlayNwAssetId &&
        !cornerOverlaySeAssetId &&
        !cornerOverlaySwAssetId
      );
    };

    const ensureTextureByUrl = (url: string | null | undefined) => {
      if (!url) return null;
      const cachedTexture = textureByUrl.get(url);
      if (cachedTexture) return cachedTexture;
      if (failedTextureUrls.has(url)) return null;

      if (!loadingTextureUrls.has(url)) {
        loadingTextureUrls.add(url);
        const image = new Image();
        image.onload = () => {
          if (disposed) return;
          loadingTextureUrls.delete(url);
          textureByUrl.set(url, Texture.from(image));
          refreshMaterialTilesRef.current?.();
        };
        image.onerror = () => {
          if (disposed) return;
          loadingTextureUrls.delete(url);
          failedTextureUrls.add(url);
          refreshMaterialTilesRef.current?.();
        };
        image.src = url;
      }

      return null;
    };

    const resolveMaterialTextures = (materialId: string) => {
      const material = getMaterialById(materialId);
      if (!material) return null;

      const textureConfig = material.textures as TileMaterialTextures & LegacyTileMaterialTextures;
      const baseAssetId = textureConfig.baseAssetId || textureConfig.isolatedAssetId || textureConfig.crossAssetId || "";
      const overlayAssetId = textureConfig.overlayAssetId || textureConfig.endAssetId || "";
      const cornerOverlayAssetId =
        textureConfig.cornerOverlayAssetId || textureConfig.cornerAssetId || textureConfig.overlayAssetId || "";
      const overlayHorizontalAssetId = textureConfig.overlayHorizontalAssetId || "";
      const overlayVerticalAssetId = textureConfig.overlayVerticalAssetId || "";
      const cornerOverlayHorizontalAssetId = textureConfig.cornerOverlayHorizontalAssetId || "";
      const cornerOverlayVerticalAssetId = textureConfig.cornerOverlayVerticalAssetId || "";
      const cornerOverlayNeAssetId = textureConfig.cornerOverlayNeAssetId || "";
      const cornerOverlayNwAssetId = textureConfig.cornerOverlayNwAssetId || "";
      const cornerOverlaySeAssetId = textureConfig.cornerOverlaySeAssetId || "";
      const cornerOverlaySwAssetId = textureConfig.cornerOverlaySwAssetId || "";

      const baseTextureUrl = assetLibraryRef.current.find((asset) => asset.id === baseAssetId)?.url;
      const overlayTextureUrl = assetLibraryRef.current.find((asset) => asset.id === overlayAssetId)?.url;
      const cornerOverlayTextureUrl = assetLibraryRef.current.find((asset) => asset.id === cornerOverlayAssetId)?.url;
      const overlayHorizontalTextureUrl = assetLibraryRef.current.find((asset) => asset.id === overlayHorizontalAssetId)?.url;
      const overlayVerticalTextureUrl = assetLibraryRef.current.find((asset) => asset.id === overlayVerticalAssetId)?.url;
      const cornerOverlayHorizontalTextureUrl = assetLibraryRef.current.find(
        (asset) => asset.id === cornerOverlayHorizontalAssetId
      )?.url;
      const cornerOverlayVerticalTextureUrl = assetLibraryRef.current.find(
        (asset) => asset.id === cornerOverlayVerticalAssetId
      )?.url;
      const cornerOverlayNeTextureUrl = assetLibraryRef.current.find((asset) => asset.id === cornerOverlayNeAssetId)?.url;
      const cornerOverlayNwTextureUrl = assetLibraryRef.current.find((asset) => asset.id === cornerOverlayNwAssetId)?.url;
      const cornerOverlaySeTextureUrl = assetLibraryRef.current.find((asset) => asset.id === cornerOverlaySeAssetId)?.url;
      const cornerOverlaySwTextureUrl = assetLibraryRef.current.find((asset) => asset.id === cornerOverlaySwAssetId)?.url;

      return {
        base: ensureTextureByUrl(baseTextureUrl),
        overlay: ensureTextureByUrl(overlayTextureUrl),
        corner: ensureTextureByUrl(cornerOverlayTextureUrl),
        overlayHorizontal: ensureTextureByUrl(overlayHorizontalTextureUrl),
        overlayVertical: ensureTextureByUrl(overlayVerticalTextureUrl),
        cornerHorizontal: ensureTextureByUrl(cornerOverlayHorizontalTextureUrl),
        cornerVertical: ensureTextureByUrl(cornerOverlayVerticalTextureUrl),
        cornerNe: ensureTextureByUrl(cornerOverlayNeTextureUrl),
        cornerNw: ensureTextureByUrl(cornerOverlayNwTextureUrl),
        cornerSe: ensureTextureByUrl(cornerOverlaySeTextureUrl),
        cornerSw: ensureTextureByUrl(cornerOverlaySwTextureUrl),
      };
    };

    const shouldOverlayNeighbor = (materialId: string, neighborMaterialId: string) => {
      if (materialId === neighborMaterialId) return false;
      const material = getMaterialById(materialId);
      const neighborMaterial = getMaterialById(neighborMaterialId);
      if (!material || !neighborMaterial) return false;
      if (isNoOverlayMaterial(material)) return false;
      if (material.priority !== neighborMaterial.priority) {
        return material.priority > neighborMaterial.priority;
      }
      const materialIndex = materialsRef.current.findIndex((candidate) => candidate.id === materialId);
      const neighborIndex = materialsRef.current.findIndex((candidate) => candidate.id === neighborMaterialId);
      return materialIndex > neighborIndex;
    };

    const sortMaterialOverlayLayers = () => {
      if (!overlaysLayer) return;
      const overlayRoot = overlaysLayer;
      const sortedEntries = [...materialOverlayLayerById.entries()].sort(([aId], [bId]) => {
        const a = getMaterialById(aId);
        const b = getMaterialById(bId);
        const aPriority = a?.priority ?? 0;
        const bPriority = b?.priority ?? 0;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const aIndex = materialsRef.current.findIndex((candidate) => candidate.id === aId);
        const bIndex = materialsRef.current.findIndex((candidate) => candidate.id === bId);
        return aIndex - bIndex;
      });

      sortedEntries.forEach(([, layer], index) => {
        if (layer.parent === overlayRoot) {
          overlayRoot.setChildIndex(layer, index);
        }
      });
    };

    const getOrCreateMaterialOverlayLayer = (materialId: string) => {
      if (!overlaysLayer) return null;
      const existing = materialOverlayLayerById.get(materialId);
      if (existing && !existing.destroyed) return existing;

      const created = new Container();
      created.eventMode = "none";
      materialOverlayLayerById.set(materialId, created);
      overlaysLayer.addChild(created);
      sortMaterialOverlayLayers();
      return created;
    };

    const updateMaterialTileVisualAt = (gx: number, gy: number) => {
      const tile = getMaterialTileAt(gx, gy);
      if (!tile) return;

      const resolvedTextures = resolveMaterialTextures(tile.materialId);
      const baseTexture = resolvedTextures?.base ?? resolvedTextures?.overlay ?? null;

      tile.sprite.anchor.set(0.5);
      tile.sprite.position.set(toCellCenterCoordinate(tile.gx), toCellCenterCoordinate(tile.gy));
      tile.sprite.width = GRID_SIZE;
      tile.sprite.height = GRID_SIZE;
      tile.sprite.rotation = getMaterialRotationMode(tile.materialId) === "none" ? 0 : tile.baseRotation ?? 0;

      if (baseTexture) {
        tile.sprite.texture = baseTexture;
        tile.sprite.tint = 0xffffff;
        tile.sprite.alpha = 1;
      } else {
        tile.sprite.texture = Texture.WHITE;
        tile.sprite.tint = 0x7c7c7c;
        tile.sprite.alpha = 1;
      }
      setBaseSpriteAtCell(gx, gy, tile.sprite);
    };

    const clearAllMaterialOverlays = () => {
      for (const cell of tileCellByKey.values()) {
        for (const overlaySprite of cell.overlays) {
          if (!overlaySprite.destroyed) {
            overlaySprite.destroy();
          }
        }
        cell.overlays = [];
      }

      for (const materialLayer of materialOverlayLayerById.values()) {
        if (materialLayer.destroyed) continue;
        materialLayer.removeChildren();
        materialLayer.destroy();
      }
      materialOverlayLayerById.clear();
    };

    const rebuildMaterialOverlays = () => {
      clearAllMaterialOverlays();
      if (!overlaysLayer) return;

      // Basic overlay mode rotates a single texture. Directional mode uses dedicated
      // horizontal/vertical textures and mirrors them without rotation.
      const edgeDirections = [
        { dx: 1, dy: 0, rotation: 0, side: "east" as const },
        { dx: 0, dy: 1, rotation: Math.PI / 2, side: "south" as const },
        { dx: -1, dy: 0, rotation: Math.PI, side: "west" as const },
        { dx: 0, dy: -1, rotation: -Math.PI / 2, side: "north" as const },
      ];

      // Basic corner mode rotates a single corner texture. Advanced mode can use explicit
      // NE/NW/SE/SW corner textures with no rotation.
      const cornerDirections = [
        {
          key: "ne" as const,
          requires: ["north", "east"] as const,
          dx: 1,
          dy: -1,
          rotation: 0,
          family: "horizontal" as const,
          legacyFlipX: false,
          legacyFlipY: false,
        },
        {
          key: "se" as const,
          requires: ["south", "east"] as const,
          dx: 1,
          dy: 1,
          rotation: Math.PI / 2,
          family: "vertical" as const,
          legacyFlipX: false,
          legacyFlipY: false,
        },
        {
          key: "sw" as const,
          requires: ["south", "west"] as const,
          dx: -1,
          dy: 1,
          rotation: Math.PI,
          family: "horizontal" as const,
          legacyFlipX: true,
          legacyFlipY: true,
        },
        {
          key: "nw" as const,
          requires: ["north", "west"] as const,
          dx: -1,
          dy: -1,
          rotation: -Math.PI / 2,
          family: "vertical" as const,
          legacyFlipX: true,
          legacyFlipY: true,
        },
      ];

      const placedCornerKeys = new Set<string>();

      for (const tile of materialTileByCellKey.values()) {
        const resolvedTextures = resolveMaterialTextures(tile.materialId);
        if (!resolvedTextures) continue;
        const materialOverlayLayer = getOrCreateMaterialOverlayLayer(tile.materialId);
        if (!materialOverlayLayer) continue;
        const useDirectionalEdges = Boolean(resolvedTextures.overlayHorizontal && resolvedTextures.overlayVertical);
        const useDirectionalCorners = Boolean(
          resolvedTextures.cornerNe &&
            resolvedTextures.cornerNw &&
            resolvedTextures.cornerSe &&
            resolvedTextures.cornerSw
        );
        const useLegacyDirectionalCorners =
          !useDirectionalCorners && Boolean(resolvedTextures.cornerHorizontal && resolvedTextures.cornerVertical);

        const coveredSides = {
          north: false,
          east: false,
          south: false,
          west: false,
        };

        for (const direction of edgeDirections) {
          const neighbor = getMaterialTileAt(tile.gx + direction.dx, tile.gy + direction.dy);
          if (!neighbor) continue;
          if (!shouldOverlayNeighbor(tile.materialId, neighbor.materialId)) continue;
          coveredSides[direction.side] = true;
        }

        for (const direction of edgeDirections) {
          if (!coveredSides[direction.side]) continue;

          const isHorizontal = direction.side === "east" || direction.side === "west";
          const overlayTexture = useDirectionalEdges
            ? isHorizontal
              ? resolvedTextures.overlayHorizontal
              : resolvedTextures.overlayVertical
            : resolvedTextures.overlay;
          if (!overlayTexture) continue;

          let rotation = direction.rotation;
          let flipX = false;
          let flipY = false;
          if (useDirectionalEdges) {
            rotation = 0;
            if (isHorizontal) {
              flipX = direction.side === "west";
            } else {
              flipY = direction.side === "south";
            }
          }

          const neighborX = tile.gx + direction.dx;
          const neighborY = tile.gy + direction.dy;
          const overlaySprite = new Sprite(overlayTexture);
          overlaySprite.anchor.set(0.5);
          overlaySprite.position.set(toCellCenterCoordinate(neighborX), toCellCenterCoordinate(neighborY));
          overlaySprite.width = GRID_SIZE;
          overlaySprite.height = GRID_SIZE;
          overlaySprite.rotation = rotation;
          overlaySprite.eventMode = "none";
          const edgeScaleX = Math.abs(overlaySprite.scale.x) || 1;
          const edgeScaleY = Math.abs(overlaySprite.scale.y) || 1;
          overlaySprite.scale.set(flipX ? -edgeScaleX : edgeScaleX, flipY ? -edgeScaleY : edgeScaleY);

          materialOverlayLayer.addChild(overlaySprite);
          addOverlaySpriteAtCell(neighborX, neighborY, overlaySprite);
        }

        for (const cornerDirection of cornerDirections) {
          const [firstSide, secondSide] = cornerDirection.requires;
          if (!coveredSides[firstSide] || !coveredSides[secondSide]) continue;

          const diagonalX = tile.gx + cornerDirection.dx;
          const diagonalY = tile.gy + cornerDirection.dy;
          const diagonalNeighbor = getMaterialTileAt(diagonalX, diagonalY);
          if (!diagonalNeighbor) continue;
          if (!shouldOverlayNeighbor(tile.materialId, diagonalNeighbor.materialId)) continue;

          const cornerKey = `${tile.materialId}|${diagonalX},${diagonalY}|${cornerDirection.key}`;
          if (placedCornerKeys.has(cornerKey)) continue;
          placedCornerKeys.add(cornerKey);

          const directionalCornerTexture =
            cornerDirection.key === "ne"
              ? resolvedTextures.cornerNe
              : cornerDirection.key === "nw"
                ? resolvedTextures.cornerNw
                : cornerDirection.key === "se"
                  ? resolvedTextures.cornerSe
                  : resolvedTextures.cornerSw;
          const cornerTexture = useDirectionalCorners
            ? directionalCornerTexture
            : useLegacyDirectionalCorners
              ? cornerDirection.family === "horizontal"
                ? resolvedTextures.cornerHorizontal
                : resolvedTextures.cornerVertical
              : resolvedTextures.corner;
          if (!cornerTexture) continue;

          let cornerRotation = cornerDirection.rotation;
          let cornerFlipX = false;
          let cornerFlipY = false;
          if (useDirectionalCorners) {
            cornerRotation = 0;
          } else if (useLegacyDirectionalCorners) {
            cornerRotation = 0;
            cornerFlipX = cornerDirection.legacyFlipX;
            cornerFlipY = cornerDirection.legacyFlipY;
          }

          const cornerSprite = new Sprite(cornerTexture);
          cornerSprite.anchor.set(0.5);
          cornerSprite.position.set(toCellCenterCoordinate(diagonalX), toCellCenterCoordinate(diagonalY));
          cornerSprite.width = GRID_SIZE;
          cornerSprite.height = GRID_SIZE;
          cornerSprite.rotation = cornerRotation;
          cornerSprite.eventMode = "none";
          const cornerScaleX = Math.abs(cornerSprite.scale.x) || 1;
          const cornerScaleY = Math.abs(cornerSprite.scale.y) || 1;
          cornerSprite.scale.set(
            cornerFlipX ? -cornerScaleX : cornerScaleX,
            cornerFlipY ? -cornerScaleY : cornerScaleY
          );

          materialOverlayLayer.addChild(cornerSprite);
          addOverlaySpriteAtCell(diagonalX, diagonalY, cornerSprite);
        }
      }

      sortMaterialOverlayLayers();
    };

    const upsertMaterialTileAt = (gx: number, gy: number, materialId: string) => {
      if (!tilesLayer) return null;

      const cellKey = toMaterialTileCellKey(gx, gy);
      const existing = materialTileByCellKey.get(cellKey);
      if (existing) {
        existing.materialId = materialId;
        existing.gx = gx;
        existing.gy = gy;
        existing.baseRotation = getRandomBaseRotation();
        setBaseSpriteAtCell(gx, gy, existing.sprite);
        return existing;
      }

      const cell = getOrCreateTileCell(gx, gy);
      if (cell.base && !cell.base.destroyed) {
        cell.base.destroy();
      }

      const sprite = new Sprite(Texture.WHITE);
      sprite.anchor.set(0.5);
      sprite.position.set(toCellCenterCoordinate(gx), toCellCenterCoordinate(gy));
      sprite.width = GRID_SIZE;
      sprite.height = GRID_SIZE;
      sprite.eventMode = "none";
      tilesLayer.addChild(sprite);

      const created: MaterialTileRecord = { gx, gy, materialId, sprite, baseRotation: getRandomBaseRotation() };
      materialTileByCellKey.set(cellKey, created);
      setBaseSpriteAtCell(gx, gy, sprite);
      return created;
    };

    const addRefreshCells = (refreshKeys: Set<string>, gx: number, gy: number) => {
      refreshKeys.add(toMaterialTileCellKey(gx, gy));
      refreshKeys.add(toMaterialTileCellKey(gx, gy - 1));
      refreshKeys.add(toMaterialTileCellKey(gx + 1, gy));
      refreshKeys.add(toMaterialTileCellKey(gx, gy + 1));
      refreshKeys.add(toMaterialTileCellKey(gx - 1, gy));
    };

    const removeOverlaysAtGrid = (gx: number, gy: number) => {
      const cellKey = toMaterialTileCellKey(gx, gy);
      const cell = tileCellByKey.get(cellKey);
      if (!cell || cell.overlays.length === 0) return false;
      for (const overlaySprite of cell.overlays) {
        if (!overlaySprite.destroyed) overlaySprite.destroy();
      }
      cell.overlays = [];
      return true;
    };

    const removeMaterialTileAtGrid = (gx: number, gy: number) => {
      const cellKey = toMaterialTileCellKey(gx, gy);
      let changed = false;
      const existing = materialTileByCellKey.get(cellKey);
      if (existing) {
        if (!existing.sprite.destroyed) existing.sprite.destroy();
        materialTileByCellKey.delete(cellKey);
        changed = true;
      }

      const cell = tileCellByKey.get(cellKey);
      if (cell?.base) {
        if (!cell.base.destroyed) cell.base.destroy();
        cell.base = undefined;
        changed = true;
      }

      return changed;
    };

    const applyMaterialCells = (cells: GridCell[], materialId: string) => {
      const material = getMaterialById(materialId);
      if (!material) return false;
      const refreshKeys = new Set<string>();
      let changed = false;
      for (const cell of cells) {
        const tile = upsertMaterialTileAt(cell.x, cell.y, material.id);
        if (!tile) continue;
        changed = true;
        addRefreshCells(refreshKeys, cell.x, cell.y);
      }
      if (!changed) return false;
      for (const key of refreshKeys) {
        const { gx, gy } = parseMaterialTileCellKey(key);
        updateMaterialTileVisualAt(gx, gy);
      }
      rebuildMaterialOverlays();
      return true;
    };

    const eraseBaseCells = (cells: GridCell[]) => {
      const refreshKeys = new Set<string>();
      let changed = false;
      for (const cell of cells) {
        if (!removeMaterialTileAtGrid(cell.x, cell.y)) continue;
        changed = true;
        addRefreshCells(refreshKeys, cell.x, cell.y);
      }
      if (!changed) return false;
      for (const key of refreshKeys) {
        const { gx, gy } = parseMaterialTileCellKey(key);
        updateMaterialTileVisualAt(gx, gy);
      }
      rebuildMaterialOverlays();
      return true;
    };

    const eraseOverlayCells = (cells: GridCell[]) => {
      let changed = false;
      for (const cell of cells) {
        if (removeOverlaysAtGrid(cell.x, cell.y)) changed = true;
      }
      return changed;
    };

    const refreshAllMaterialTileVisuals = () => {
      for (const tile of materialTileByCellKey.values()) {
        updateMaterialTileVisualAt(tile.gx, tile.gy);
      }
      rebuildMaterialOverlays();
    };
    refreshMaterialTilesRef.current = refreshAllMaterialTileVisuals;

    const stopTokenMotion = (token: TokenRecord) => {
      token.targetX = null;
      token.targetY = null;
      token.moving = false;
    };

    const setTokenMoveTarget = (token: TokenRecord, targetX: number, targetY: number) => {
      token.targetX = targetX;
      token.targetY = targetY;
      token.moving = true;
    };

    const placeAssetSprite = (asset: PlacingAsset, worldX: number, worldY: number, asGridTile: boolean) => {
      if (!tilesLayer) return;
      const targetLayer = tilesLayer;
      const placeholderHalfSize = asGridTile ? GRID_SIZE / 2 : 18;
      const placeholder = new Graphics();
      placeholder.position.set(worldX, worldY);
      placeholder
        .rect(-placeholderHalfSize, -placeholderHalfSize, placeholderHalfSize * 2, placeholderHalfSize * 2)
        .fill({ color: 0x9fb7d9, alpha: 0.35 });
      placeholder.setStrokeStyle({ width: 1.5, color: 0xd9e7ff, alpha: 0.9 });
      placeholder.rect(-placeholderHalfSize, -placeholderHalfSize, placeholderHalfSize * 2, placeholderHalfSize * 2).stroke();
      targetLayer.addChild(placeholder);

      const image = new Image();
      image.onload = () => {
        if (disposed || targetLayer.destroyed) {
          placeholder.destroy();
          return;
        }

        const sprite = Sprite.from(image);
        sprite.anchor.set(0.5);
        sprite.eventMode = "none";

        if (asGridTile) {
          const gx = toCellCoordinate(worldX);
          const gy = toCellCoordinate(worldY);
          sprite.position.set(toCellCenterCoordinate(gx), toCellCenterCoordinate(gy));
          sprite.width = GRID_SIZE;
          sprite.height = GRID_SIZE;
          setBaseSpriteAtCell(gx, gy, sprite);
        } else if (image.width > 0 && image.height > 0) {
          sprite.position.set(worldX, worldY);
          const scale = PLACED_ASSET_MAX_SIZE / Math.max(image.width, image.height);
          sprite.scale.set(scale);
        } else {
          sprite.position.set(worldX, worldY);
        }

        targetLayer.addChild(sprite);
        placeholder.destroy();
      };

      image.onerror = () => {
        placeholder.clear();
        placeholder
          .rect(-placeholderHalfSize, -placeholderHalfSize, placeholderHalfSize * 2, placeholderHalfSize * 2)
          .fill({ color: 0xa32222, alpha: 0.45 });
        placeholder.setStrokeStyle({ width: 1.5, color: 0xff8a8a, alpha: 0.95 });
        placeholder.rect(-placeholderHalfSize, -placeholderHalfSize, placeholderHalfSize * 2, placeholderHalfSize * 2).stroke();
      };

      image.src = asset.url;
    };

    const getBrushCellsFromDrag = (
      startCell: GridCell,
      endCell: GridCell,
      freehandPointsWorld: WorldPoint[]
    ): GridCell[] => {
      const mode = brushModeRef.current;
      if (mode === "circle") {
        return circleCells(startCell, endCell);
      }
      if (mode === "freehand") {
        const polygonFilled = polygonCells(freehandPointsWorld, GRID_SIZE);
        if (polygonFilled.length > 0) return polygonFilled;
        return [{ x: endCell.x, y: endCell.y }];
      }
      return rectCells(startCell, endCell);
    };

    const applyCells = (cells: GridCell[]) => {
      if (cells.length === 0) return false;
      if (brushActionRef.current === "erase") {
        if (brushTargetRef.current === "overlay") {
          return eraseOverlayCells(cells);
        }
        return eraseBaseCells(cells);
      }

      const activeStampMaterialId = stampingMaterialIdRef.current;
      if (activeStampMaterialId) {
        return applyMaterialCells(cells, activeStampMaterialId);
      }

      const stampPlaceAsset = stampAssetRef.current;
      if (stampPlaceAsset) {
        for (const cell of cells) {
          placeAssetSprite(
            stampPlaceAsset,
            toCellCenterCoordinate(cell.x),
            toCellCenterCoordinate(cell.y),
            true
          );
        }
        return true;
      }

      return false;
    };

    const placeAssetAtWorld = (rawWorldX: number, rawWorldY: number) => {
      const activeStampMaterialId = stampingMaterialIdRef.current;
      if (activeStampMaterialId) {
        const gx = toCellCoordinate(rawWorldX);
        const gy = toCellCoordinate(rawWorldY);
        return applyMaterialCells([{ x: gx, y: gy }], activeStampMaterialId) ? "material" : null;
      }

      const singlePlaceAsset = placingAssetRef.current;
      const stampPlaceAsset = stampAssetRef.current;
      const assetToPlace = singlePlaceAsset ?? stampPlaceAsset;
      if (!assetToPlace) return null;
      const isStampPlacement = !singlePlaceAsset && Boolean(stampPlaceAsset);
      const snappedX = snapToCellCenter(rawWorldX);
      const snappedY = snapToCellCenter(rawWorldY);
      const worldX = isStampPlacement ? snappedX : rawWorldX;
      const worldY = isStampPlacement ? snappedY : rawWorldY;

      placeAssetSprite(assetToPlace, worldX, worldY, isStampPlacement);
      return isStampPlacement ? "stamp" : "single";
    };

    placeAssetAtClientRef.current = (clientX: number, clientY: number) => {
      if (!app || !world) return null;
      const canvas = app.canvas as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;
      const worldPoint = world.toLocal({ x: screenX, y: screenY });
      return placeAssetAtWorld(worldPoint.x, worldPoint.y);
    };

    const createTokenRecord = (token: {
      id: string;
      name: string;
      x: number;
      y: number;
      radius: number;
      color: number;
      tokenImageUrl?: string | null;
      hpCurrent: number;
      hpMax: number;
      rotationDeg?: number;
      scale?: number;
    }) => {
      if (!tokensLayer) return null;

      const tokenContainer = new Container();
      tokenContainer.label = token.id;
      tokenContainer.position.set(token.x, token.y);

      const tokenBody = new Graphics();
      const tokenLabel = new Text({
        text: token.name,
        style: {
          fill: 0xffffff,
          fontSize: 12,
          fontFamily: "Arial",
          fontWeight: "600",
        },
      });
      const hpBarBg = new Graphics();
      const hpBarFill = new Graphics();

      tokenContainer.addChild(tokenBody);
      tokenContainer.addChild(tokenLabel);
      tokenContainer.addChild(hpBarBg);
      tokenContainer.addChild(hpBarFill);
      tokensLayer.addChild(tokenContainer);

      const record: TokenRecord = {
        id: token.id,
        name: token.name,
        radius: token.radius,
        color: token.color,
        tokenImageUrl: token.tokenImageUrl ?? null,
        imageRequestedUrl: null,
        imageLoadVersion: 0,
        hpCurrent: token.hpCurrent,
        hpMax: Math.max(1, token.hpMax),
        container: tokenContainer,
        imageSprite: null,
        body: tokenBody,
        label: tokenLabel,
        hpBarBg,
        hpBarFill,
        rotationDeg: token.rotationDeg ?? 0,
        scale: token.scale ?? 1,
        targetX: null,
        targetY: null,
        moving: false,
      };

      tokenRecords.push(record);
      drawToken(record, selectedTokenIds.has(record.id));

      return record;
    };

    const deleteTokenById = (tokenId: string) => {
      const index = tokenRecords.findIndex((token) => token.id === tokenId);
      if (index < 0) return;

      const [token] = tokenRecords.splice(index, 1);
      stopTokenMotion(token);
      token.container.destroy({ children: true });
      selectedTokenIds.delete(tokenId);
      refreshTokenStyles();
      rebindInteractionHandlers?.();
      emitTokensChange();
    };

    const duplicateTokenById = (tokenId: string) => {
      const source = tokenRecords.find((token) => token.id === tokenId);
      if (!source) return;

      let copyCounter = 1;
      let nextId = `${source.id}-copy-${copyCounter}`;
      while (tokenRecords.some((token) => token.id === nextId)) {
        copyCounter += 1;
        nextId = `${source.id}-copy-${copyCounter}`;
      }

      const duplicate = createTokenRecord({
        id: nextId,
        name: `${source.name} Copy`,
        x: source.container.x + GRID_SIZE / 2,
        y: source.container.y + GRID_SIZE / 2,
        radius: source.radius,
        color: source.color,
        tokenImageUrl: source.tokenImageUrl,
        hpCurrent: source.hpCurrent,
        hpMax: source.hpMax,
        rotationDeg: source.rotationDeg,
        scale: source.scale,
      });

      if (duplicate) {
        setSelection([duplicate.id]);
        rebindInteractionHandlers?.();
        emitTokensChange();
      }
    };

    const renameToken = (tokenId: string, name: string) => {
      const token = tokenRecords.find((item) => item.id === tokenId);
      if (!token) return;
      token.name = name;
      drawToken(token, selectedTokenIds.has(token.id));
      emitTokensChange();
    };

    const setTokenHp = (tokenId: string, hpCurrent: number, hpMax: number) => {
      const token = tokenRecords.find((item) => item.id === tokenId);
      if (!token) return;

      token.hpMax = Math.max(1, hpMax);
      token.hpCurrent = clamp(hpCurrent, 0, token.hpMax);
      drawToken(token, selectedTokenIds.has(token.id));
    };

    const syncPlayers = (nextPlayers: PlayerCharacter[], nextAssets: AssetLibraryItem[]) => {
      if (!world) return;

      const assetUrlById = new Map(nextAssets.map((asset) => [asset.id, asset.url]));
      const existingById = new Map(tokenRecords.map((token) => [token.id, token]));
      const nextTokenRecords: TokenRecord[] = [];

      nextPlayers.forEach((player, index) => {
        const existing = existingById.get(player.id);
        const tokenImageUrl = player.tokenAssetId ? assetUrlById.get(player.tokenAssetId) ?? null : null;

        if (existing) {
          existing.name = player.name.trim() || `Player ${index + 1}`;
          existing.color = parseHexColor(player.color, existing.color);
          existing.tokenImageUrl = tokenImageUrl;
          drawToken(existing, selectedTokenIds.has(existing.id));
          nextTokenRecords.push(existing);
          existingById.delete(player.id);
          return;
        }

        const created = createTokenRecord({
          id: player.id,
          name: player.name.trim() || `Player ${index + 1}`,
          x: GRID_SIZE / 2 + index * GRID_SIZE * 2,
          y: GRID_SIZE / 2 + GRID_SIZE * 2,
          radius: DEFAULT_PLAYER_RADIUS,
          color: parseHexColor(player.color, 0x777777),
          tokenImageUrl,
          hpCurrent: DEFAULT_PLAYER_HP,
          hpMax: DEFAULT_PLAYER_HP,
        });

        if (created) {
          nextTokenRecords.push(created);
        }
      });

      for (const staleToken of existingById.values()) {
        stopTokenMotion(staleToken);
        staleToken.container.destroy({ children: true });
        selectedTokenIds.delete(staleToken.id);
      }

      tokenRecords = nextTokenRecords;
      selectedTokenIds = new Set(
        [...selectedTokenIds].filter((tokenId) => tokenRecords.some((token) => token.id === tokenId))
      );
      refreshTokenStyles();
      rebindInteractionHandlers?.();
      emitTokensChange();
    };

    runContextActionRef.current = (action: TokenContextAction) => {
      switch (action.type) {
        case "delete":
          deleteTokenById(action.tokenId);
          break;
        case "duplicate":
          duplicateTokenById(action.tokenId);
          break;
        case "rename":
          if (action.name.trim()) {
            renameToken(action.tokenId, action.name.trim());
          }
          break;
        case "setHp":
          setTokenHp(action.tokenId, action.hpCurrent, action.hpMax);
          break;
        default:
          break;
      }
    };

    syncPlayersRef.current = syncPlayers;

    const setupInteractions = (canvas: HTMLCanvasElement, stage: Container, tokens: TokenRecord[]) => {
      let panning = false;
      let panPointerId: number | null = null;
      let lastPanX = 0;
      let lastPanY = 0;

      let selecting = false;
      let selectionPointerId: number | null = null;
      let selectionStartX = 0;
      let selectionStartY = 0;
      let selectionCurrentX = 0;
      let selectionCurrentY = 0;
      let selectionMoved = false;

      let draggingToken: TokenRecord | null = null;
      let tokenPointerId: number | null = null;
      let tokenOffsetX = 0;
      let tokenOffsetY = 0;
      let tokenDownX = 0;
      let tokenDownY = 0;
      let tokenDragMoved = false;
      let tokenDragStartX = 0;
      let tokenDragStartY = 0;
      let tokenPreviewX = 0;
      let tokenPreviewY = 0;
      let brushingArea = false;
      let brushPointerId: number | null = null;
      let brushStartCell: GridCell = { x: 0, y: 0 };
      let brushCurrentCell: GridCell = { x: 0, y: 0 };
      let brushPointsWorld: WorldPoint[] = [];
      let lastBrushPoint: WorldPoint | null = null;
      let lastManualCell: GridCell | null = null;

      const finishTokenDrag = (selectOnClick: boolean) => {
        if (!draggingToken) return;

        const releasedToken = draggingToken;
        const rawX = tokenPreviewX;
        const rawY = tokenPreviewY;
        const targetX = snapToGridRef.current ? snapToCellCenter(rawX) : rawX;
        const targetY = snapToGridRef.current ? snapToCellCenter(rawY) : rawY;
        setTokenMoveTarget(releasedToken, targetX, targetY);

        if (selectOnClick && !tokenDragMoved) {
          setSelection([releasedToken.id]);
        }

        draggingToken = null;
        tokenPointerId = null;
        clearMovementPreview();
        canvas.style.cursor = "grab";
      };

      const onStagePointerDown = (event: any) => {
        if (!world) return;
        onRequestCloseContextMenuRef.current?.();
        const button = event.button ?? 0;

        if (button === 2) {
          event.nativeEvent?.preventDefault?.();
          return;
        }

        if (button === 1) {
          event.nativeEvent?.preventDefault?.();
          panning = true;
          panPointerId = event.pointerId;
          lastPanX = event.global.x;
          lastPanY = event.global.y;
          canvas.style.cursor = "grabbing";
          return;
        }

        if (button !== 0) return;

        const singlePlaceAsset = placingAssetRef.current;
        if (singlePlaceAsset) {
          event.nativeEvent?.preventDefault?.();
          const local = world.toLocal(event.global);
          const placedMode = placeAssetAtWorld(local.x, local.y);
          if (!placedMode) return;
          onPlacedAssetRef.current?.();
          return;
        }

        const hasPlacementSource = Boolean(stampingMaterialIdRef.current || stampAssetRef.current);
        const hasBrushPlacement = hasPlacementSource || brushActionRef.current === "erase";
        if (hasBrushPlacement) {
          event.nativeEvent?.preventDefault?.();
          const local = world.toLocal(event.global);
          const gx = toCellCoordinate(local.x);
          const gy = toCellCoordinate(local.y);
          brushingArea = true;
          brushPointerId = event.pointerId;
          brushStartCell = { x: gx, y: gy };
          brushCurrentCell = { x: gx, y: gy };
          brushPointsWorld = [{ x: local.x, y: local.y }];
          lastBrushPoint = brushPointsWorld[0];
          lastManualCell = null;
          if (brushModeRef.current === "manual") {
            applyCells([{ x: gx, y: gy }]);
            lastManualCell = { x: gx, y: gy };
            clearBrushPreview();
          } else {
            drawBrushPreviewCells(getBrushCellsFromDrag(brushStartCell, brushCurrentCell, brushPointsWorld));
          }
          return;
        }

        selecting = true;
        selectionPointerId = event.pointerId;
        selectionStartX = event.global.x;
        selectionStartY = event.global.y;
        selectionCurrentX = selectionStartX;
        selectionCurrentY = selectionStartY;
        selectionMoved = false;
        drawSelectionRect(selectionStartX, selectionStartY, selectionCurrentX, selectionCurrentY);
      };

      const onStagePointerMove = (event: any) => {
        if (!world) return;

        if (panning && event.pointerId === panPointerId) {
          const deltaX = event.global.x - lastPanX;
          const deltaY = event.global.y - lastPanY;
          world.position.x += deltaX;
          world.position.y += deltaY;
          lastPanX = event.global.x;
          lastPanY = event.global.y;
        }

        if (brushingArea && event.pointerId === brushPointerId) {
          const local = world.toLocal(event.global);
          brushCurrentCell = { x: toCellCoordinate(local.x), y: toCellCoordinate(local.y) };
          if (brushModeRef.current === "manual") {
            if (!lastManualCell || lastManualCell.x !== brushCurrentCell.x || lastManualCell.y !== brushCurrentCell.y) {
              applyCells([brushCurrentCell]);
              lastManualCell = { x: brushCurrentCell.x, y: brushCurrentCell.y };
            }
          } else if (brushModeRef.current === "freehand") {
            const nextPoint = { x: local.x, y: local.y };
            if (!lastBrushPoint) {
              brushPointsWorld.push(nextPoint);
              lastBrushPoint = nextPoint;
            } else {
              const deltaX = nextPoint.x - lastBrushPoint.x;
              const deltaY = nextPoint.y - lastBrushPoint.y;
              if (deltaX * deltaX + deltaY * deltaY >= 16) {
                brushPointsWorld.push(nextPoint);
                lastBrushPoint = nextPoint;
              }
            }
            drawBrushPreviewCells(getBrushCellsFromDrag(brushStartCell, brushCurrentCell, brushPointsWorld));
          } else {
            drawBrushPreviewCells(getBrushCellsFromDrag(brushStartCell, brushCurrentCell, brushPointsWorld));
          }
        }

        if (selecting && event.pointerId === selectionPointerId) {
          selectionCurrentX = event.global.x;
          selectionCurrentY = event.global.y;
          if (
            Math.abs(selectionCurrentX - selectionStartX) > SELECTION_DRAG_THRESHOLD ||
            Math.abs(selectionCurrentY - selectionStartY) > SELECTION_DRAG_THRESHOLD
          ) {
            selectionMoved = true;
          }
          drawSelectionRect(selectionStartX, selectionStartY, selectionCurrentX, selectionCurrentY);
        }

        if (draggingToken && event.pointerId === tokenPointerId) {
          const local = world.toLocal(event.global);
          tokenPreviewX = local.x + tokenOffsetX;
          tokenPreviewY = local.y + tokenOffsetY;
          drawMovementPreview(draggingToken, tokenDragStartX, tokenDragStartY, tokenPreviewX, tokenPreviewY);
          if (
            Math.abs(event.global.x - tokenDownX) > SELECTION_DRAG_THRESHOLD ||
            Math.abs(event.global.y - tokenDownY) > SELECTION_DRAG_THRESHOLD
          ) {
            tokenDragMoved = true;
          }
        }
      };

      const onStagePointerUp = (event: any) => {
        if (panning && event.pointerId === panPointerId) {
          panning = false;
          panPointerId = null;
          canvas.style.cursor = "grab";
        }

        if (brushingArea && event.pointerId === brushPointerId) {
          if (world) {
            const local = world.toLocal(event.global);
            brushCurrentCell = { x: toCellCoordinate(local.x), y: toCellCoordinate(local.y) };
            if (brushModeRef.current === "freehand") {
              const endPoint = { x: local.x, y: local.y };
              if (
                !lastBrushPoint ||
                (endPoint.x - lastBrushPoint.x) * (endPoint.x - lastBrushPoint.x) +
                  (endPoint.y - lastBrushPoint.y) * (endPoint.y - lastBrushPoint.y) >=
                  1
              ) {
                brushPointsWorld.push(endPoint);
              }
            }
            if (brushModeRef.current !== "manual") {
              const cells = getBrushCellsFromDrag(brushStartCell, brushCurrentCell, brushPointsWorld);
              applyCells(cells);
            }
          }
          clearBrushPreview();
          brushingArea = false;
          brushPointerId = null;
          brushPointsWorld = [];
          lastBrushPoint = null;
          lastManualCell = null;
        }

        if (selecting && event.pointerId === selectionPointerId) {
          if (!selectionMoved) {
            setSelection([]);
          } else if (world) {
            const currentWorld = world;
            const left = Math.min(selectionStartX, selectionCurrentX);
            const right = Math.max(selectionStartX, selectionCurrentX);
            const top = Math.min(selectionStartY, selectionCurrentY);
            const bottom = Math.max(selectionStartY, selectionCurrentY);

            const selectedIds = tokens
              .filter((token) => {
                const center = currentWorld.toGlobal(token.container.position);
                return center.x >= left && center.x <= right && center.y >= top && center.y <= bottom;
              })
              .map((token) => token.id);

            setSelection(selectedIds);
          }

          selecting = false;
          selectionPointerId = null;
          clearSelectionRect();
        }

        if (draggingToken && event.pointerId === tokenPointerId) {
          finishTokenDrag(false);
        }
      };

      const onWheel = (event: WheelEvent) => {
        if (!world) return;

        event.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const pointerX = event.clientX - rect.left;
        const pointerY = event.clientY - rect.top;

        const oldScale = world.scale.x;
        const zoomFactor = Math.exp(-event.deltaY * ZOOM_SENSITIVITY);
        const newScale = clamp(oldScale * zoomFactor, MIN_ZOOM, MAX_ZOOM);
        if (newScale === oldScale) return;

        const worldX = (pointerX - world.position.x) / oldScale;
        const worldY = (pointerY - world.position.y) / oldScale;

        world.scale.set(newScale);
        world.position.set(pointerX - worldX * newScale, pointerY - worldY * newScale);
      };

      const onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
      };

      canvas.style.cursor = "grab";
      canvas.style.touchAction = "none";

      stage.eventMode = "static";
      stage.hitArea = new Rectangle(0, 0, canvas.clientWidth, canvas.clientHeight);
      stage.on("pointerdown", onStagePointerDown);
      stage.on("pointermove", onStagePointerMove);
      stage.on("pointerup", onStagePointerUp);
      stage.on("pointerupoutside", onStagePointerUp);

      const removeTokenListeners: Array<() => void> = [];
      for (const token of tokens) {
        const onTokenPointerDown = (event: any) => {
          if (!world) return;
          const button = event.button ?? 0;

          if (button === 2) {
            event.stopPropagation();
            event.nativeEvent?.preventDefault?.();
            event.nativeEvent?.stopPropagation?.();

            const screenX = event.nativeEvent?.clientX ?? event.global.x;
            const screenY = event.nativeEvent?.clientY ?? event.global.y;
            onTokenContextMenuRef.current?.(token.id, screenX, screenY);
            return;
          }

          if (button !== 0) return;

          onRequestCloseContextMenuRef.current?.();
          event.stopPropagation();
          stopTokenMotion(token);
          draggingToken = token;
          tokenPointerId = event.pointerId;
          tokenDownX = event.global.x;
          tokenDownY = event.global.y;
          tokenDragMoved = false;
          tokenDragStartX = token.container.x;
          tokenDragStartY = token.container.y;
          const local = world.toLocal(event.global);
          tokenOffsetX = token.container.x - local.x;
          tokenOffsetY = token.container.y - local.y;
          tokenPreviewX = token.container.x;
          tokenPreviewY = token.container.y;
          drawMovementPreview(token, tokenDragStartX, tokenDragStartY, tokenPreviewX, tokenPreviewY);
          canvas.style.cursor = "grabbing";
        };

        const onTokenPointerUp = (event: any) => {
          if (!draggingToken || event.pointerId !== tokenPointerId) return;

          event.stopPropagation();
          finishTokenDrag(true);
        };

        token.body.eventMode = "static";
        token.body.cursor = "pointer";
        token.body.on("pointerdown", onTokenPointerDown);
        token.body.on("pointerup", onTokenPointerUp);
        token.body.on("pointerupoutside", onTokenPointerUp);

        removeTokenListeners.push(() => {
          token.body.off("pointerdown", onTokenPointerDown);
          token.body.off("pointerup", onTokenPointerUp);
          token.body.off("pointerupoutside", onTokenPointerUp);
        });
      }

      canvas.addEventListener("wheel", onWheel, { passive: false });
      canvas.addEventListener("contextmenu", onContextMenu);

      return () => {
        stage.off("pointerdown", onStagePointerDown);
        stage.off("pointermove", onStagePointerMove);
        stage.off("pointerup", onStagePointerUp);
        stage.off("pointerupoutside", onStagePointerUp);
        for (const remove of removeTokenListeners) remove();
        canvas.removeEventListener("wheel", onWheel);
        canvas.removeEventListener("contextmenu", onContextMenu);
      };
    };

    const setupKeyboardShortcuts = () => {
      const onKeyDown = (event: KeyboardEvent) => {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT" ||
            target.isContentEditable)
        ) {
          return;
        }

        const token = getPrimarySelectedToken();
        if (!token) return;

        let handled = false;
        switch (event.key) {
          case "q":
          case "Q":
            token.rotationDeg -= ROTATE_STEP_DEG;
            handled = true;
            break;
          case "e":
          case "E":
            token.rotationDeg += ROTATE_STEP_DEG;
            handled = true;
            break;
          case "[":
            token.scale = clamp(token.scale * TOKEN_SCALE_DOWN_FACTOR, MIN_TOKEN_SCALE, MAX_TOKEN_SCALE);
            handled = true;
            break;
          case "]":
            token.scale = clamp(token.scale * TOKEN_SCALE_UP_FACTOR, MIN_TOKEN_SCALE, MAX_TOKEN_SCALE);
            handled = true;
            break;
          default:
            break;
        }

        if (!handled) return;
        event.preventDefault();
        drawToken(token, selectedTokenIds.has(token.id));
      };

      window.addEventListener("keydown", onKeyDown);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
      };
    };

    const setupTokenMotionTicker = () => {
      if (!app) return () => {};

      const onTick = () => {
        if (!app) return;
        const dtSeconds = app.ticker.deltaMS / 1000;
        if (dtSeconds <= 0) return;

        const step = TOKEN_MOVE_SPEED * dtSeconds;
        for (const token of tokenRecords) {
          if (!token.moving || token.targetX === null || token.targetY === null) continue;

          const dx = token.targetX - token.container.x;
          const dy = token.targetY - token.container.y;
          const distance = Math.hypot(dx, dy);

          if (distance <= step || distance === 0) {
            token.container.position.set(token.targetX, token.targetY);
            stopTokenMotion(token);
            continue;
          }

          const invDistance = 1 / distance;
          token.container.position.set(
            token.container.x + dx * invDistance * step,
            token.container.y + dy * invDistance * step
          );
        }
      };

      app.ticker.add(onTick);
      return () => {
        app?.ticker.remove(onTick);
      };
    };

    const onResize = () => {
      if (app) {
        app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
      }
      drawGrid();
      drawOriginMarker();
    };

    const mount = async () => {
      const nextApp = new Application();

      await nextApp.init({
        resizeTo: window,
        antialias: true,
        autoDensity: true,
        resolution: window.devicePixelRatio || 1,
        backgroundColor: 0x0b0c10,
      });

      if (disposed) {
        nextApp.destroy(true, { children: true });
        return;
      }

      app = nextApp;

      const canvas = nextApp.canvas as HTMLCanvasElement;
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      host.appendChild(canvas);

      world = new Container();
      nextApp.stage.addChild(world);

      tilesLayer = new Container();
      world.addChild(tilesLayer);

      overlaysLayer = new Container();
      world.addChild(overlaysLayer);

      gridLayer = new Graphics();
      world.addChild(gridLayer);
      applyGridOverlayVisibilityRef.current = (visible: boolean) => {
        if (!gridLayer) return;
        gridLayer.visible = visible;
      };
      applyGridOverlayVisibilityRef.current(gridOverlayEnabledRef.current);

      previewLayer = new Graphics();
      world.addChild(previewLayer);

      originMarker = new Graphics();
      world.addChild(originMarker);

      movementPreviewOverlay = new Graphics();
      world.addChild(movementPreviewOverlay);

      tokensLayer = new Container();
      world.addChild(tokensLayer);

      tokenRecords = [];
      materialTileByCellKey = new Map();
      tileCellByKey = new Map();

      selectionOverlay = new Graphics();
      nextApp.stage.addChild(selectionOverlay);

      setSelection([]);
      rebindInteractionHandlers = () => {
        if (detachInteractions) detachInteractions();
        detachInteractions = setupInteractions(canvas, nextApp.stage, tokenRecords);
      };
      syncPlayers(playersRef.current, assetLibraryRef.current);
      rebindInteractionHandlers();
      detachKeyboard = setupKeyboardShortcuts();
      const detachTokenMotionTicker = setupTokenMotionTicker();

      onResize();
      window.addEventListener("resize", onResize);

      return detachTokenMotionTicker;
    };

    let detachTokenMotionTicker: (() => void) | null = null;
    void mount().then((detachTicker) => {
      detachTokenMotionTicker = detachTicker ?? null;
    });

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      if (detachInteractions) detachInteractions();
      if (detachKeyboard) detachKeyboard();
      if (detachTokenMotionTicker) detachTokenMotionTicker();
      placeAssetAtClientRef.current = () => null;
      runContextActionRef.current = null;
      syncPlayersRef.current = null;
      refreshMaterialTilesRef.current = null;
      applyGridOverlayVisibilityRef.current = null;
      materialTileByCellKey.clear();
      tileCellByKey.clear();
      textureByUrl.clear();
      loadingTextureUrls.clear();
      failedTextureUrls.clear();
      if (app) app.destroy(true, { children: true, texture: true });
    };
  }, []);

  useEffect(() => {
    if (!contextAction) return;
    runContextActionRef.current?.(contextAction);
  }, [contextAction]);

  return createElement("div", {
    ref: hostRef,
    style: {
      position: "fixed",
      inset: 0,
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      background: "#0b0c10",
    },
  });
}

export type TabletopAppHandle = {
  update: (nextOptions: TabletopAppOptions) => void;
  destroy: () => void;
};

export const createTabletopApp = (
  containerEl: HTMLDivElement,
  initialOptions: TabletopAppOptions = {}
): TabletopAppHandle => {
  const mountEl = document.createElement("div");
  mountEl.style.position = "relative";
  mountEl.style.width = "100%";
  mountEl.style.height = "100%";
  containerEl.appendChild(mountEl);

  const root: Root = createRoot(mountEl);
  let disposed = false;
  let currentOptions: TabletopAppOptions = { ...initialOptions };

  const render = () => {
    if (disposed) return;
    root.render(createElement(PixiTabletopRuntime, currentOptions));
  };

  render();

  return {
    update: (nextOptions: TabletopAppOptions) => {
      currentOptions = { ...nextOptions };
      render();
    },
    destroy: () => {
      if (disposed) return;
      disposed = true;
      root.unmount();
      if (mountEl.parentElement === containerEl) {
        containerEl.removeChild(mountEl);
      } else {
        mountEl.remove();
      }
    },
  };
};
