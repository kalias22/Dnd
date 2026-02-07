import { type CSSProperties, useEffect, useRef, useState } from "react";
import Tabletop, { type TokenContextAction } from "./components/Tabletop";

type ContextActionInput =
  | { type: "delete"; tokenId: string }
  | { type: "duplicate"; tokenId: string }
  | { type: "rename"; tokenId: string; name: string }
  | { type: "setHp"; tokenId: string; hpCurrent: number; hpMax: number };

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(null);
  const [contextAction, setContextAction] = useState<TokenContextAction | null>(null);
  const actionNonceRef = useRef(1);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const dispatchTokenAction = (action: ContextActionInput) => {
    const nextAction: TokenContextAction = {
      nonce: actionNonceRef.current++,
      ...action,
    };
    setContextAction(nextAction);
    closeContextMenu();
  };

  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      const target = event.target as Node | null;
      if (target && contextMenuRef.current?.contains(target)) return;
      closeContextMenu();
    };

    window.addEventListener("pointerdown", handleOutsidePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [contextMenu]);

  const handleRenameToken = (tokenId: string) => {
    const nextName = window.prompt("Rename token:");
    if (nextName === null) return;

    const name = nextName.trim();
    if (!name) return;
    dispatchTokenAction({ type: "rename", tokenId, name });
  };

  const handleSetTokenHp = (tokenId: string) => {
    const value = window.prompt('Set HP as "current/max"', "10/10");
    if (value === null) return;

    const match = value.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) return;

    const hpCurrent = Number(match[1]);
    const hpMax = Number(match[2]);
    if (hpMax <= 0) return;

    dispatchTokenAction({ type: "setHp", tokenId, hpCurrent, hpMax });
  };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tabletop
        snapToGrid={snapToGrid}
        contextAction={contextAction}
        onTokenContextMenu={(tokenId, x, y) => setContextMenu({ tokenId, x, y })}
        onRequestCloseContextMenu={closeContextMenu}
      />

      {contextMenu && (
        <div
          ref={contextMenuRef}
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 1200,
            border: "1px solid #4a4a4a",
            borderRadius: 8,
            background: "rgba(18,18,18,0.97)",
            color: "#f2f2f2",
            padding: 6,
            minWidth: 160,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            boxShadow: "0 8px 18px rgba(0,0,0,0.35)",
          }}
        >
          <button
            type="button"
            onClick={() => dispatchTokenAction({ type: "delete", tokenId: contextMenu.tokenId })}
            style={menuButtonStyle}
          >
            Delete token
          </button>
          <button
            type="button"
            onClick={() => dispatchTokenAction({ type: "duplicate", tokenId: contextMenu.tokenId })}
            style={menuButtonStyle}
          >
            Duplicate token
          </button>
          <button type="button" onClick={() => handleRenameToken(contextMenu.tokenId)} style={menuButtonStyle}>
            Rename token
          </button>
          <button type="button" onClick={() => handleSetTokenHp(contextMenu.tokenId)} style={menuButtonStyle}>
            Set HP
          </button>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setSettingsOpen((open) => !open)}
          aria-label="Toggle settings"
          style={{
            width: 36,
            height: 36,
            border: "1px solid #4a4a4a",
            borderRadius: 8,
            background: "rgba(18,18,18,0.92)",
            color: "#f2f2f2",
            fontSize: 18,
            lineHeight: "36px",
            textAlign: "center",
            cursor: "pointer",
            padding: 0,
          }}
        >
          {"\u2699"}
        </button>

        {settingsOpen && (
          <div
            style={{
              minWidth: 180,
              border: "1px solid #4a4a4a",
              borderRadius: 10,
              background: "rgba(18,18,18,0.95)",
              color: "#f2f2f2",
              padding: "10px 12px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                fontFamily: "sans-serif",
                fontSize: 14,
                userSelect: "none",
              }}
            >
              <span>Snap to Grid</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={snapToGrid}
                  onChange={(event) => setSnapToGrid(event.target.checked)}
                />
                <span>{snapToGrid ? "On" : "Off"}</span>
              </span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

const menuButtonStyle: CSSProperties = {
  textAlign: "left",
  border: "1px solid #3f3f3f",
  borderRadius: 6,
  background: "rgba(28,28,28,0.95)",
  color: "#f2f2f2",
  fontSize: 13,
  padding: "7px 8px",
  cursor: "pointer",
};

