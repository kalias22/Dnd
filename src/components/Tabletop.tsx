import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Rectangle, Text } from "pixi.js";

const GRID_CELL_SIZE = 50;
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
const TOKEN_DEFINITIONS = [
  { id: "token-1", name: "Aria", x: 200, y: 200, radius: 18, color: 0xd35400, hpCurrent: 22, hpMax: 30 },
  { id: "token-2", name: "Bram", x: 320, y: 260, radius: 16, color: 0x1abc9c, hpCurrent: 11, hpMax: 18 },
  { id: "token-3", name: "Cora", x: 420, y: 140, radius: 20, color: 0x3498db, hpCurrent: 35, hpMax: 40 },
];

type TokenRecord = {
  id: string;
  name: string;
  radius: number;
  color: number;
  hpCurrent: number;
  hpMax: number;
  container: Container;
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

export type TokenContextAction =
  | { nonce: number; type: "delete"; tokenId: string }
  | { nonce: number; type: "duplicate"; tokenId: string }
  | { nonce: number; type: "rename"; tokenId: string; name: string }
  | { nonce: number; type: "setHp"; tokenId: string; hpCurrent: number; hpMax: number };

export type TokenSummary = {
  id: string;
  name: string;
};

type TabletopProps = {
  snapToGrid?: boolean;
  contextAction?: TokenContextAction | null;
  onTokensChange?: (tokens: TokenSummary[]) => void;
  onTokenContextMenu?: (tokenId: string, screenX: number, screenY: number) => void;
  onRequestCloseContextMenu?: () => void;
};

export default function Tabletop({
  snapToGrid = true,
  contextAction = null,
  onTokensChange,
  onTokenContextMenu,
  onRequestCloseContextMenu,
}: TabletopProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const snapToGridRef = useRef(snapToGrid);
  const onTokensChangeRef = useRef(onTokensChange);
  const onTokenContextMenuRef = useRef(onTokenContextMenu);
  const onRequestCloseContextMenuRef = useRef(onRequestCloseContextMenu);
  const runContextActionRef = useRef<((action: TokenContextAction) => void) | null>(null);

  useEffect(() => {
    snapToGridRef.current = snapToGrid;
  }, [snapToGrid]);

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
    let grid: Graphics | null = null;
    let originMarker: Graphics | null = null;
    let selectionOverlay: Graphics | null = null;
    let movementPreviewOverlay: Graphics | null = null;
    let tokenRecords: TokenRecord[] = [];
    let selectedTokenIds = new Set<string>();
    let detachInteractions: (() => void) | null = null;
    let detachKeyboard: (() => void) | null = null;
    let rebindInteractionHandlers: (() => void) | null = null;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
    const emitTokensChange = () => {
      onTokensChangeRef.current?.(
        tokenRecords.map((token) => ({
          id: token.id,
          name: token.name,
        }))
      );
    };

    const drawToken = (token: TokenRecord, selected: boolean) => {
      token.body.clear();
      token.body.circle(0, 0, token.radius).fill({ color: token.color, alpha: 1 });
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
      if (!app || !grid || !world) return;

      const halfWidth = Math.max(app.screen.width * 2, 2000);
      const halfHeight = Math.max(app.screen.height * 2, 2000);
      const startX = Math.floor(-halfWidth / GRID_CELL_SIZE) * GRID_CELL_SIZE;
      const endX = Math.ceil(halfWidth / GRID_CELL_SIZE) * GRID_CELL_SIZE;
      const startY = Math.floor(-halfHeight / GRID_CELL_SIZE) * GRID_CELL_SIZE;
      const endY = Math.ceil(halfHeight / GRID_CELL_SIZE) * GRID_CELL_SIZE;

      grid.clear();
      grid.setStrokeStyle({ width: 1, color: 0x505050, alpha: 0.9 });

      for (let x = startX; x <= endX; x += GRID_CELL_SIZE) {
        grid.moveTo(x, startY);
        grid.lineTo(x, endY);
      }

      for (let y = startY; y <= endY; y += GRID_CELL_SIZE) {
        grid.moveTo(startX, y);
        grid.lineTo(endX, y);
      }

      grid.stroke();
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

    const snapToCellCenter = (value: number) => {
      const halfCell = GRID_CELL_SIZE / 2;
      const baseCenter = Math.floor(value / GRID_CELL_SIZE) * GRID_CELL_SIZE + halfCell;
      const neighborCenter = baseCenter + GRID_CELL_SIZE;

      return Math.abs(value - baseCenter) <= Math.abs(value - neighborCenter)
        ? baseCenter
        : neighborCenter;
    };

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

    const createTokenRecord = (token: {
      id: string;
      name: string;
      x: number;
      y: number;
      radius: number;
      color: number;
      hpCurrent: number;
      hpMax: number;
      rotationDeg?: number;
      scale?: number;
    }) => {
      if (!world) return null;

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
      world.addChild(tokenContainer);

      const record: TokenRecord = {
        id: token.id,
        name: token.name,
        radius: token.radius,
        color: token.color,
        hpCurrent: token.hpCurrent,
        hpMax: Math.max(1, token.hpMax),
        container: tokenContainer,
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
        x: source.container.x + GRID_CELL_SIZE / 2,
        y: source.container.y + GRID_CELL_SIZE / 2,
        radius: source.radius,
        color: source.color,
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

        if (event.button === 2) {
          event.nativeEvent?.preventDefault?.();
          return;
        }

        if (event.button === 1) {
          event.nativeEvent?.preventDefault?.();
          panning = true;
          panPointerId = event.pointerId;
          lastPanX = event.global.x;
          lastPanY = event.global.y;
          canvas.style.cursor = "grabbing";
          return;
        }

        if (event.button !== 0) return;

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

          if (event.button === 2) {
            event.stopPropagation();
            event.nativeEvent?.preventDefault?.();
            event.nativeEvent?.stopPropagation?.();

            const screenX = event.nativeEvent?.clientX ?? event.global.x;
            const screenY = event.nativeEvent?.clientY ?? event.global.y;
            onTokenContextMenuRef.current?.(token.id, screenX, screenY);
            return;
          }

          if (event.button !== 0) return;

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

      grid = new Graphics();
      world.addChild(grid);

      originMarker = new Graphics();
      world.addChild(originMarker);

      movementPreviewOverlay = new Graphics();
      world.addChild(movementPreviewOverlay);

      tokenRecords = [];
      for (const token of TOKEN_DEFINITIONS) {
        createTokenRecord(token);
      }
      emitTokensChange();

      selectionOverlay = new Graphics();
      nextApp.stage.addChild(selectionOverlay);

      setSelection([]);
      rebindInteractionHandlers = () => {
        if (detachInteractions) detachInteractions();
        detachInteractions = setupInteractions(canvas, nextApp.stage, tokenRecords);
      };
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
      runContextActionRef.current = null;
      if (app) app.destroy(true, { children: true });
    };
  }, []);

  useEffect(() => {
    if (!contextAction) return;
    runContextActionRef.current?.(contextAction);
  }, [contextAction]);

  return (
    <div
      ref={hostRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0b0c10",
      }}
    />
  );
}
