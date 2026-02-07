import { useEffect, useRef } from "react";
import { Application, Container, Graphics, Rectangle } from "pixi.js";

const GRID_CELL_SIZE = 50;
const ORIGIN_MARKER_SIZE = 22;
const ORIGIN_MARKER_THICKNESS = 3;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.0015;
const TOKEN_RADIUS = 18;
const TOKEN_X = 200;
const TOKEN_Y = 200;

export default function Tabletop() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let app: Application | null = null;
    let world: Container | null = null;
    let grid: Graphics | null = null;
    let originMarker: Graphics | null = null;
    let token: Graphics | null = null;
    let detachInteractions: (() => void) | null = null;

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const drawGrid = () => {
      if (!app || !grid || !world) return;

      const halfWidth = Math.max(app.screen.width * 2, 2000);
      const halfHeight = Math.max(app.screen.height * 2, 2000);

      grid.clear();
      grid.setStrokeStyle({ width: 1, color: 0x505050, alpha: 0.9 });

      for (let x = -halfWidth; x <= halfWidth; x += GRID_CELL_SIZE) {
        grid.moveTo(x, -halfHeight);
        grid.lineTo(x, halfHeight);
      }

      for (let y = -halfHeight; y <= halfHeight; y += GRID_CELL_SIZE) {
        grid.moveTo(-halfWidth, y);
        grid.lineTo(halfWidth, y);
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

    const setupInteractions = (canvas: HTMLCanvasElement, stage: Container) => {
      let panning = false;
      let panPointerId: number | null = null;
      let lastPanX = 0;
      let lastPanY = 0;

      let draggingToken = false;
      let tokenPointerId: number | null = null;
      let tokenOffsetX = 0;
      let tokenOffsetY = 0;

      const onStagePointerDown = (event: any) => {
        if (!world || event.button !== 0) return;

        panning = true;
        panPointerId = event.pointerId;
        lastPanX = event.global.x;
        lastPanY = event.global.y;
        canvas.style.cursor = "grabbing";
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

        if (draggingToken && token && event.pointerId === tokenPointerId) {
          const local = world.toLocal(event.global);
          token.position.set(local.x + tokenOffsetX, local.y + tokenOffsetY);
        }
      };

      const onStagePointerUp = (event: any) => {
        if (panning && event.pointerId === panPointerId) {
          panning = false;
          panPointerId = null;
          canvas.style.cursor = "grab";
        }

        if (draggingToken && event.pointerId === tokenPointerId) {
          draggingToken = false;
          tokenPointerId = null;
          canvas.style.cursor = "grab";
        }
      };

      const onTokenPointerDown = (event: any) => {
        if (!world || !token || event.button !== 0) return;

        event.stopPropagation();
        draggingToken = true;
        tokenPointerId = event.pointerId;
        const local = world.toLocal(event.global);
        tokenOffsetX = token.x - local.x;
        tokenOffsetY = token.y - local.y;
        canvas.style.cursor = "grabbing";
      };

      const onTokenPointerUp = (event: any) => {
        if (!draggingToken || event.pointerId !== tokenPointerId) return;
        event.stopPropagation();
        draggingToken = false;
        tokenPointerId = null;
        canvas.style.cursor = "grab";
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

      canvas.style.cursor = "grab";
      canvas.style.touchAction = "none";

      stage.eventMode = "static";
      stage.hitArea = new Rectangle(0, 0, canvas.clientWidth, canvas.clientHeight);
      stage.on("pointerdown", onStagePointerDown);
      stage.on("pointermove", onStagePointerMove);
      stage.on("pointerup", onStagePointerUp);
      stage.on("pointerupoutside", onStagePointerUp);

      if (token) {
        token.eventMode = "static";
        token.cursor = "pointer";
        token.on("pointerdown", onTokenPointerDown);
        token.on("pointerup", onTokenPointerUp);
        token.on("pointerupoutside", onTokenPointerUp);
      }

      canvas.addEventListener("wheel", onWheel, { passive: false });

      return () => {
        stage.off("pointerdown", onStagePointerDown);
        stage.off("pointermove", onStagePointerMove);
        stage.off("pointerup", onStagePointerUp);
        stage.off("pointerupoutside", onStagePointerUp);
        if (token) {
          token.off("pointerdown", onTokenPointerDown);
          token.off("pointerup", onTokenPointerUp);
          token.off("pointerupoutside", onTokenPointerUp);
        }
        canvas.removeEventListener("wheel", onWheel);
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
      token = new Graphics();
      token.circle(0, 0, TOKEN_RADIUS).fill({ color: 0xd35400, alpha: 1 });
      token.position.set(TOKEN_X, TOKEN_Y);
      world.addChild(token);

      detachInteractions = setupInteractions(canvas, nextApp.stage);

      onResize();
      window.addEventListener("resize", onResize);
    };

    void mount();

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      if (detachInteractions) detachInteractions();
      if (app) app.destroy(true, { children: true });
    };
  }, []);

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
