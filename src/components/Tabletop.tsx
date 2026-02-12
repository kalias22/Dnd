import TabletopViewport, { type TabletopViewportProps } from "../ui/components/TabletopViewport";

export type {
  AssetLibraryItem,
  PlacingAsset,
  PlayerCharacter,
  TileMaterial,
  TileMaterialTextures,
  TileRotationMode,
  TokenContextAction,
  TokenSummary,
} from "../ui/components/TabletopViewport";

export type TabletopProps = TabletopViewportProps;

export default function Tabletop(props: TabletopProps) {
  return <TabletopViewport {...props} />;
}
