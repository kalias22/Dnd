export type ToolSettings = {
  brush: {
    mode: "manual" | "rect" | "circle" | "freehand";
    action: "place" | "erase";
    target: "base" | "overlay";
    size: number;
  };
  selected: {
    tileAssetId?: string;
    overlayAssetId?: string;
    tokenAssetId?: string;
    objectAssetId?: string;
    itemAssetId?: string;
  };
  toggles: {
    gridOverlayEnabled: boolean;
    snapToGrid: boolean;
  };
};

export type CampaignMeta = {
  id: string;
  name: string;
  description?: string;
  scenes: { id: string; name: string; file: string }[];
};
