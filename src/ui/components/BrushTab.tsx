import type { CSSProperties } from "react";
import type { BrushAction, BrushMode, BrushTarget } from "../../systems/brush/brushTypes";

type BrushTabProps = {
  brushMode: BrushMode;
  setBrushMode: (next: BrushMode) => void;
  brushAction: BrushAction;
  setBrushAction: (next: BrushAction) => void;
  brushTarget?: BrushTarget;
  setBrushTarget?: (next: BrushTarget) => void;
  gridOverlayEnabled: boolean;
  setGridOverlayEnabled: (next: boolean) => void;
};

const buttonStyle = (active: boolean): CSSProperties => ({
  border: "1px solid #3f3f3f",
  borderRadius: 6,
  background: active ? "rgba(79,138,255,0.38)" : "rgba(28,28,28,0.95)",
  color: "#f2f2f2",
  fontSize: 12,
  padding: "6px 8px",
  cursor: "pointer",
});

export default function BrushTab({
  brushMode,
  setBrushMode,
  brushAction,
  setBrushAction,
  brushTarget,
  setBrushTarget,
  gridOverlayEnabled,
  setGridOverlayEnabled,
}: BrushTabProps) {
  return (
    <div
      style={{
        border: "1px solid #4a4a4a",
        borderRadius: 10,
        background: "rgba(18,18,18,0.95)",
        color: "#f2f2f2",
        padding: 10,
        display: "grid",
        gap: 8,
        width: 240,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>Brush</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={buttonStyle(brushMode === "manual")} onClick={() => setBrushMode("manual")}>
          Manual
        </button>
        <button type="button" style={buttonStyle(brushMode === "rect")} onClick={() => setBrushMode("rect")}>
          Rectangle
        </button>
        <button type="button" style={buttonStyle(brushMode === "circle")} onClick={() => setBrushMode("circle")}>
          Circle
        </button>
        <button type="button" style={buttonStyle(brushMode === "freehand")} onClick={() => setBrushMode("freehand")}>
          Freehand
        </button>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" style={buttonStyle(brushAction === "place")} onClick={() => setBrushAction("place")}>
          Place
        </button>
        <button type="button" style={buttonStyle(brushAction === "erase")} onClick={() => setBrushAction("erase")}>
          Erase
        </button>
      </div>
      {brushTarget && setBrushTarget ? (
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" style={buttonStyle(brushTarget === "base")} onClick={() => setBrushTarget("base")}>
            Base
          </button>
          <button
            type="button"
            style={buttonStyle(brushTarget === "overlay")}
            onClick={() => setBrushTarget("overlay")}
          >
            Overlay
          </button>
        </div>
      ) : null}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          checked={gridOverlayEnabled}
          onChange={(event) => setGridOverlayEnabled(event.target.checked)}
        />
        Grid Overlay
      </label>
    </div>
  );
}
