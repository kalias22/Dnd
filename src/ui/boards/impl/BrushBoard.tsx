import { useEffect, useState, type CSSProperties } from "react";
import { loadToolSettings, updateToolSettings } from "../../../files/toolSettingsIO";
import {
  BOARD_BRUSH_SETTINGS_CHANGED_EVENT,
  mergeToolSettings,
  type BrushSettingsChangedPayload,
} from "./shared";

const groupStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const rowStyle: CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#d6dff1",
};

const buttonStyle = (active: boolean): CSSProperties => ({
  border: "1px solid rgba(142, 157, 182, 0.55)",
  borderRadius: 7,
  background: active ? "rgba(88, 131, 212, 0.42)" : "rgba(21, 27, 39, 0.95)",
  color: "#f2f6ff",
  fontSize: 12,
  padding: "6px 9px",
  cursor: "pointer",
});

type BrushState = {
  mode: "manual" | "rect" | "circle" | "freehand";
  action: "place" | "erase";
  target: "base" | "overlay";
  size: number;
  gridOverlayEnabled: boolean;
  snapToGrid: boolean;
};

const toBrushState = (value: unknown): BrushState => {
  const merged = mergeToolSettings(value);
  return {
    mode: merged.brush.mode,
    action: merged.brush.action,
    target: merged.brush.target,
    size: merged.brush.size,
    gridOverlayEnabled: merged.toggles.gridOverlayEnabled,
    snapToGrid: merged.toggles.snapToGrid,
  };
};

export default function BrushBoard() {
  const [state, setState] = useState<BrushState | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const settings = await loadToolSettings();
        if (!cancelled) {
          setState(toBrushState(settings));
        }
      } catch (error: unknown) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : "Failed to load tool settings.");
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistState = async (nextState: BrushState) => {
    setState(nextState);
    setErrorText(null);

    const payload: BrushSettingsChangedPayload = {
      brushMode: nextState.mode,
      brushAction: nextState.action,
      brushTarget: nextState.target,
      gridOverlayEnabled: nextState.gridOverlayEnabled,
      snapToGrid: nextState.snapToGrid,
    };

    window.dispatchEvent(new CustomEvent(BOARD_BRUSH_SETTINGS_CHANGED_EVENT, { detail: payload }));

    try {
      await updateToolSettings((current) => ({
        ...current,
        brush: {
          ...current.brush,
          mode: nextState.mode,
          action: nextState.action,
          target: nextState.target,
          size: nextState.size,
        },
        toggles: {
          ...current.toggles,
          gridOverlayEnabled: nextState.gridOverlayEnabled,
          snapToGrid: nextState.snapToGrid,
        },
      }));
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to save tool settings.");
    }
  };

  const patchState = (patch: Partial<BrushState>) => {
    if (!state) return;
    void persistState({ ...state, ...patch });
  };

  if (!state) {
    return <div style={{ fontSize: 12, color: "#d2dbec" }}>Loading brush settings...</div>;
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {errorText && <div style={{ fontSize: 12, color: "#ff9b9b" }}>{errorText}</div>}

      <div style={groupStyle}>
        <div style={labelStyle}>Mode</div>
        <div style={rowStyle}>
          <button type="button" style={buttonStyle(state.mode === "manual")} onClick={() => patchState({ mode: "manual" })}>
            Manual
          </button>
          <button type="button" style={buttonStyle(state.mode === "rect")} onClick={() => patchState({ mode: "rect" })}>
            Rectangle
          </button>
          <button type="button" style={buttonStyle(state.mode === "circle")} onClick={() => patchState({ mode: "circle" })}>
            Circle
          </button>
          <button type="button" style={buttonStyle(state.mode === "freehand")} onClick={() => patchState({ mode: "freehand" })}>
            Freehand
          </button>
        </div>
      </div>

      <div style={groupStyle}>
        <div style={labelStyle}>Action</div>
        <div style={rowStyle}>
          <button type="button" style={buttonStyle(state.action === "place")} onClick={() => patchState({ action: "place" })}>
            Place
          </button>
          <button type="button" style={buttonStyle(state.action === "erase")} onClick={() => patchState({ action: "erase" })}>
            Erase
          </button>
        </div>
      </div>

      <div style={groupStyle}>
        <div style={labelStyle}>Target</div>
        <div style={rowStyle}>
          <button type="button" style={buttonStyle(state.target === "base")} onClick={() => patchState({ target: "base" })}>
            Base
          </button>
          <button type="button" style={buttonStyle(state.target === "overlay")} onClick={() => patchState({ target: "overlay" })}>
            Overlay
          </button>
        </div>
      </div>

      <div style={groupStyle}>
        <div style={labelStyle}>Brush Size</div>
        <input
          type="number"
          min={1}
          max={16}
          value={state.size}
          onChange={(event) => patchState({ size: Math.max(1, Math.min(16, Number(event.target.value) || 1)) })}
          style={{
            border: "1px solid rgba(170,184,210,0.45)",
            borderRadius: 7,
            background: "rgba(10, 14, 20, 0.85)",
            color: "#edf3ff",
            fontSize: 12,
            padding: "6px 8px",
            width: 90,
          }}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d2dbec" }}>
        <input type="checkbox" checked={state.gridOverlayEnabled} onChange={(event) => patchState({ gridOverlayEnabled: event.target.checked })} />
        Grid Overlay
      </label>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#d2dbec" }}>
        <input type="checkbox" checked={state.snapToGrid} onChange={(event) => patchState({ snapToGrid: event.target.checked })} />
        Snap To Grid
      </label>
    </div>
  );
}
