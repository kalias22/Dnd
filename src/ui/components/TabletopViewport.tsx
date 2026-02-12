import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import Tabletop from "../../components/Tabletop";
import { createTabletopApp } from "../../pixi";
import type {
  AssetLibraryItem,
  PlacingAsset,
  PlayerCharacter,
  TileMaterial,
  TokenContextAction,
} from "../../components/Tabletop";

export type {
  AssetLibraryItem,
  PlacingAsset,
  PlayerCharacter,
  TileMaterial,
  TileMaterialTextures,
  TileRotationMode,
  TokenContextAction,
} from "../../components/Tabletop";

type TokenSummary = {
  id: string;
  name: string;
};

type TabletopViewportProps = {
  snapToGrid?: boolean;
  contextAction?: TokenContextAction | null;
  placingAsset?: PlacingAsset | null;
  stampAsset?: PlacingAsset | null;
  materials?: TileMaterial[];
  stampingMaterialId?: string | null;
  players?: PlayerCharacter[];
  assetLibrary?: AssetLibraryItem[];
  onPlacedAsset?: () => void;
  onTokensChange?: (tokens: TokenSummary[]) => void;
  onTokenContextMenu?: (tokenId: string, screenX: number, screenY: number) => void;
  onRequestCloseContextMenu?: () => void;
};

export default function TabletopViewport({
  snapToGrid,
  contextAction,
  placingAsset,
  stampAsset,
  materials,
  stampingMaterialId,
  players,
  assetLibrary,
  onPlacedAsset,
  onTokensChange,
  onTokenContextMenu,
  onRequestCloseContextMenu,
}: TabletopViewportProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [mountEl, setMountEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const tabletopApp = createTabletopApp(host);
    setMountEl(tabletopApp.mountEl);
    return () => {
      setMountEl(null);
      tabletopApp.destroy();
    };
  }, []);

  return (
    <div ref={hostRef} style={{ position: "fixed", inset: 0 }}>
      {mountEl
        ? createPortal(
            <Tabletop
              snapToGrid={snapToGrid}
              contextAction={contextAction}
              placingAsset={placingAsset}
              stampAsset={stampAsset}
              materials={materials}
              stampingMaterialId={stampingMaterialId}
              players={players}
              assetLibrary={assetLibrary}
              onPlacedAsset={onPlacedAsset}
              onTokensChange={onTokensChange}
              onTokenContextMenu={onTokenContextMenu}
              onRequestCloseContextMenu={onRequestCloseContextMenu}
            />,
            mountEl
          )
        : null}
    </div>
  );
}
