import { useEffect, useMemo, useRef } from "react";
import { createTabletopApp, type TabletopAppHandle, type TabletopAppOptions } from "../../pixi";

export type {
  AssetLibraryItem,
  PlacingAsset,
  PlayerCharacter,
  TileMaterial,
  TileMaterialTextures,
  TileRotationMode,
  TokenContextAction,
  TokenSummary,
} from "../../pixi";

export type TabletopViewportProps = TabletopAppOptions;

export default function TabletopViewport({
  snapToGrid,
  contextAction,
  placingAsset,
  stampAsset,
  materials,
  stampingMaterialId,
  brushMode,
  brushAction,
  brushTarget,
  gridOverlayEnabled,
  players,
  assetLibrary,
  onPlacedAsset,
  onTokensChange,
  onTokenContextMenu,
  onRequestCloseContextMenu,
}: TabletopViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const tabletopHandleRef = useRef<TabletopAppHandle | null>(null);

  const options = useMemo<TabletopAppOptions>(
    () => ({
      snapToGrid,
      contextAction,
      placingAsset,
      stampAsset,
      materials,
      stampingMaterialId,
      brushMode,
      brushAction,
      brushTarget,
      gridOverlayEnabled,
      players,
      assetLibrary,
      onPlacedAsset,
      onTokensChange,
      onTokenContextMenu,
      onRequestCloseContextMenu,
    }),
    [
      snapToGrid,
      contextAction,
      placingAsset,
      stampAsset,
      materials,
      stampingMaterialId,
      brushMode,
      brushAction,
      brushTarget,
      gridOverlayEnabled,
      players,
      assetLibrary,
      onPlacedAsset,
      onTokensChange,
      onTokenContextMenu,
      onRequestCloseContextMenu,
    ]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = "";
    const tabletopHandle = createTabletopApp(host, options);
    tabletopHandleRef.current = tabletopHandle;
    return () => {
      tabletopHandleRef.current?.destroy();
      tabletopHandleRef.current = null;
      host.innerHTML = "";
    };
  }, []);

  useEffect(() => {
    tabletopHandleRef.current?.update(options);
  }, [options]);

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
