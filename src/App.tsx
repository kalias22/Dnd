import { type CSSProperties, type ChangeEvent, useEffect, useRef, useState } from "react";
import Tabletop, { type PlacingAsset, type TokenContextAction, type TokenSummary } from "./components/Tabletop";

type ContextActionInput =
  | { type: "add"; name: string }
  | { type: "delete"; tokenId: string }
  | { type: "duplicate"; tokenId: string }
  | { type: "rename"; tokenId: string; name: string }
  | { type: "setHp"; tokenId: string; hpCurrent: number; hpMax: number };

type AssetImage = {
  id: string;
  name: string;
  url: string;
};

type AppMode = "home" | "create" | "play";

export default function App() {
  const [mode, setMode] = useState<AppMode>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [entitiesOpen, setEntitiesOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(null);
  const [contextAction, setContextAction] = useState<TokenContextAction | null>(null);
  const [assets, setAssets] = useState<AssetImage[]>([]);
  const [placingAsset, setPlacingAsset] = useState<PlacingAsset | null>(null);
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const actionNonceRef = useRef(1);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const assetUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (mode !== "create") {
      setAssetsOpen(false);
      setEntitiesOpen(false);
      setPlacingAsset(null);
    }
  }, [mode]);

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

  useEffect(() => {
    assetUrlsRef.current = assets.map((asset) => asset.url);
  }, [assets]);

  useEffect(() => {
    return () => {
      for (const url of assetUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (!placingAsset) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPlacingAsset(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [placingAsset]);

  const handleRenameEntity = (tokenId: string) => {
    const nextName = window.prompt("Rename entity:");
    if (nextName === null) return;

    const name = nextName.trim();
    if (!name) return;
    dispatchTokenAction({ type: "rename", tokenId, name });
  };

  const handleSetEntityHp = (tokenId: string) => {
    const value = window.prompt('Set HP as "current/max"', "10/10");
    if (value === null) return;

    const match = value.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) return;

    const hpCurrent = Number(match[1]);
    const hpMax = Number(match[2]);
    if (hpMax <= 0) return;

    dispatchTokenAction({ type: "setHp", tokenId, hpCurrent, hpMax });
  };

  const handleAddEntity = () => {
    let nextIndex = tokens.length + 1;
    const existingNames = new Set(tokens.map((token) => token.name.toLowerCase()));
    while (existingNames.has(`entity ${nextIndex}`)) {
      nextIndex += 1;
    }

    dispatchTokenAction({ type: "add", name: `Entity ${nextIndex}` });
  };

  const handleImportImages = () => {
    assetInputRef.current?.click();
  };

  const handleAssetFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) return;

    const imported: AssetImage[] = [];
    for (const file of Array.from(fileList)) {
      imported.push({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        url: URL.createObjectURL(file),
      });
    }

    setAssets((previous) => [...previous, ...imported]);
    event.target.value = "";
  };

  if (mode === "home") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at top, #1d2638 0%, #0b0c10 55%, #08090c 100%)",
          color: "#f2f2f2",
          fontFamily: "sans-serif",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            border: "1px solid #3d4558",
            borderRadius: 14,
            background: "rgba(14,16,22,0.92)",
            boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
            padding: "28px 24px",
            display: "grid",
            gap: 16,
            textAlign: "center",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1, letterSpacing: 0.4 }}>DnD Virtual Tabletop</h1>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setMode("create")} style={homeButtonStyle}>
              Create Campaign
            </button>
            <button type="button" onClick={() => setMode("play")} style={homeButtonStyle}>
              Play Campaign
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tabletop
        snapToGrid={snapToGrid}
        contextAction={contextAction}
        placingAsset={mode === "create" ? placingAsset : null}
        onPlacedAsset={mode === "create" ? () => setPlacingAsset(null) : undefined}
        onTokensChange={setTokens}
        onTokenContextMenu={(tokenId, x, y) => setContextMenu({ tokenId, x, y })}
        onRequestCloseContextMenu={closeContextMenu}
      />

      {mode === "create" && (
        <>
          <input
            ref={assetInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAssetFilesChange}
            style={{ display: "none" }}
          />

          <div
            style={{
              position: "fixed",
              top: settingsOpen ? 124 : 56,
              right: 12,
              width: 354,
              maxHeight: "calc(100vh - 68px)",
              zIndex: 1005,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              transform: assetsOpen ? "translateX(0)" : "translateX(266px)",
              transition: "transform 160ms ease, top 120ms ease",
            }}
          >
            <button
              type="button"
              onClick={() => setAssetsOpen((open) => !open)}
              style={panelToggleButtonStyle}
            >
              {assetsOpen ? "Hide" : "Assets"}
            </button>

            <div style={sidePanelStyle}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Assets</div>
              <button type="button" onClick={handleImportImages} style={trackerButtonStyle}>
                Import Images
              </button>
              <div
                style={{
                  border: "1px solid #3a3a3a",
                  borderRadius: 8,
                  overflowY: "auto",
                  padding: 8,
                  display: "grid",
                  gap: 8,
                  maxHeight: "calc(100vh - 180px)",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                {assets.length === 0 ? (
                  <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "#b6b6b6" }}>No images imported</div>
                ) : (
                  assets.map((asset) => (
                    <div
                      key={asset.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 5,
                      }}
                    >
                      <img
                        src={asset.url}
                        alt={asset.name}
                        style={{
                          width: "100%",
                          aspectRatio: "1 / 1",
                          objectFit: "cover",
                          borderRadius: 6,
                          border: "1px solid #3f3f3f",
                        }}
                      />
                      <div
                        title={asset.name}
                        style={{
                          fontSize: 11,
                          color: "#d5d5d5",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {asset.name}
                      </div>
                      <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          setPlacingAsset({ id: asset.id, name: asset.name, url: asset.url });
                        }}
                        style={{
                          ...trackerButtonStyle,
                          padding: "4px 6px",
                          fontSize: 11,
                          background:
                            placingAsset?.id === asset.id ? "rgba(76,123,255,0.35)" : "rgba(28,28,28,0.95)",
                        }}
                      >
                        Place
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              position: "fixed",
              top: 56,
              left: 12,
              zIndex: 1100,
              width: 354,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              transform: entitiesOpen ? "translateX(0)" : "translateX(-266px)",
              transition: "transform 160ms ease",
            }}
          >
            <div style={sidePanelStyle}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Entities</div>
              <button type="button" onClick={handleAddEntity} style={trackerButtonStyle}>
                Add Entity
              </button>
              <div
                style={{
                  border: "1px solid #3a3a3a",
                  borderRadius: 8,
                  overflowY: "auto",
                  maxHeight: 240,
                }}
              >
                {tokens.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 13, color: "#b6b6b6" }}>No entities</div>
                ) : (
                  tokens.map((token) => (
                    <div
                      key={token.id}
                      style={{
                        padding: "7px 9px",
                        fontSize: 13,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={token.name}
                    >
                      {token.name}
                    </div>
                  ))
                )}
              </div>
            </div>

            <button type="button" onClick={() => setEntitiesOpen((open) => !open)} style={panelToggleButtonStyle}>
              {entitiesOpen ? "Hide" : "Entities"}
            </button>
          </div>

          {placingAsset && (
            <div
              style={{
                position: "fixed",
                top: settingsOpen ? 124 : 56,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1010,
                border: "1px solid #3a3a3a",
                borderRadius: 8,
                padding: "8px 9px",
                background: "rgba(18,18,18,0.95)",
                color: "#d8e6ff",
                fontSize: 12,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
                width: "min(320px, calc(100vw - 24px))",
                fontFamily: "sans-serif",
              }}
            >
              <span
                title={placingAsset.name}
                style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                Placing: {placingAsset.name}
              </span>
              <button
                type="button"
                onClick={() => setPlacingAsset(null)}
                style={{ ...trackerButtonStyle, padding: "3px 7px", fontSize: 11 }}
              >
                Cancel
              </button>
            </div>
          )}
        </>
      )}

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
            Delete entity
          </button>
          <button
            type="button"
            onClick={() => dispatchTokenAction({ type: "duplicate", tokenId: contextMenu.tokenId })}
            style={menuButtonStyle}
          >
            Duplicate entity
          </button>
          <button type="button" onClick={() => handleRenameEntity(contextMenu.tokenId)} style={menuButtonStyle}>
            Rename entity
          </button>
          <button type="button" onClick={() => handleSetEntityHp(contextMenu.tokenId)} style={menuButtonStyle}>
            Set HP
          </button>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 1110,
        }}
      >
        <button type="button" onClick={() => setMode("home")} style={trackerButtonStyle}>
          Home
        </button>
      </div>

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

const trackerButtonStyle: CSSProperties = {
  border: "1px solid #3f3f3f",
  borderRadius: 6,
  background: "rgba(28,28,28,0.95)",
  color: "#f2f2f2",
  fontSize: 12,
  padding: "6px 8px",
  cursor: "pointer",
};

const homeButtonStyle: CSSProperties = {
  border: "1px solid #49526a",
  borderRadius: 10,
  background: "rgba(24,28,37,0.95)",
  color: "#f2f2f2",
  fontSize: 16,
  fontWeight: 600,
  padding: "12px 16px",
  cursor: "pointer",
  minWidth: 170,
};

const panelToggleButtonStyle: CSSProperties = {
  width: 88,
  border: "1px solid #4a4a4a",
  borderRadius: 8,
  background: "rgba(18,18,18,0.94)",
  color: "#f2f2f2",
  fontSize: 12,
  padding: "10px 8px",
  cursor: "pointer",
  userSelect: "none",
};

const sidePanelStyle: CSSProperties = {
  width: 260,
  border: "1px solid #4a4a4a",
  borderRadius: 10,
  background: "rgba(18,18,18,0.95)",
  color: "#f2f2f2",
  padding: 10,
  display: "grid",
  gridAutoFlow: "row",
  gap: 10,
  fontFamily: "sans-serif",
};
