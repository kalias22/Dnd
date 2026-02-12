export type BrushMode = "manual" | "rect" | "circle" | "freehand";

export type BrushAction = "place" | "erase";

export type BrushTarget = "base" | "overlay";

export type BrushState = {
  mode: BrushMode;
  action: BrushAction;
  target: BrushTarget;
  isActive: boolean;
};
