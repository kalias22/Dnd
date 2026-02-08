import { type CSSProperties, type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import Tabletop, {
  type AssetLibraryItem,
  type PlacingAsset,
  type PlayerCharacter,
  type TokenContextAction,
} from "./components/Tabletop";

type AssetImage = AssetLibraryItem & {
  name: string;
};

type AppMode = "home" | "create" | "play";

const PLAYER_COLORS = ["#d35400", "#1abc9c", "#3498db", "#9b59b6", "#e74c3c", "#f1c40f"];

const createDefaultPlayer = (index: number): PlayerCharacter => ({
  id: `player-${crypto.randomUUID()}`,
  name: `Player ${index}`,
  color: PLAYER_COLORS[(index - 1) % PLAYER_COLORS.length],
  tokenAssetId: null,
});

const mergeOrderWithPlayers = (previousOrder: string[], players: PlayerCharacter[]) => {
  const playerIds = players.map((player) => player.id);
  const playerIdSet = new Set(playerIds);
  const kept = previousOrder.filter((playerId) => playerIdSet.has(playerId));
  const keptSet = new Set(kept);
  const appended = playerIds.filter((playerId) => !keptSet.has(playerId));
  return [...kept, ...appended];
};

const sortOrderByInitiativeDesc = (order: string[], initiatives: Record<string, number>) => {
  return [...order].sort((a, b) => {
    const aValue = initiatives[a];
    const bValue = initiatives[b];
    if (typeof aValue === "number" && typeof bValue === "number") {
      return bValue - aValue;
    }
    if (typeof aValue === "number") return -1;
    if (typeof bValue === "number") return 1;
    return 0;
  });
};

export default function App() {
  const [mode, setMode] = useState<AppMode>("home");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(true);
  const [playSetupOpen, setPlaySetupOpen] = useState(false);
  const [initiativeOpen, setInitiativeOpen] = useState(true);
  const [assets, setAssets] = useState<AssetImage[]>([]);
  const [players, setPlayers] = useState<PlayerCharacter[]>(() => [createDefaultPlayer(1), createDefaultPlayer(2)]);
  const [initiativeById, setInitiativeById] = useState<Record<string, number>>({});
  const [initiativeOrder, setInitiativeOrder] = useState<string[]>([]);
  const [activeInitiativePlayerId, setActiveInitiativePlayerId] = useState<string | null>(null);
  const [placingAsset, setPlacingAsset] = useState<PlacingAsset | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tokenId: string } | null>(null);
  const [contextAction, setContextAction] = useState<TokenContextAction | null>(null);

  const actionNonceRef = useRef(1);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const assetInputRef = useRef<HTMLInputElement | null>(null);
  const assetUrlsRef = useRef<string[]>([]);
  const assetLibrary = useMemo<AssetLibraryItem[]>(() => assets.map((asset) => ({ id: asset.id, url: asset.url })), [assets]);
  const sortedInitiativeOrder = useMemo(
    () => sortOrderByInitiativeDesc(mergeOrderWithPlayers(initiativeOrder, players), initiativeById),
    [initiativeOrder, initiativeById, players]
  );

  useEffect(() => {
    if (mode === "play") {
      setPlaySetupOpen(true);
      setInitiativeOpen(true);
    } else {
      setPlaySetupOpen(false);
      setInitiativeOpen(false);
    }

    if (mode === "create") {
      setPlayersOpen(true);
    } else {
      setPlayersOpen(false);
      setAssetsOpen(false);
      setPlacingAsset(null);
    }
  }, [mode]);

  useEffect(() => {
    assetUrlsRef.current = assets.map((asset) => asset.url);
  }, [assets]);

  useEffect(() => {
    const playerIds = players.map((player) => player.id);
    const playerIdSet = new Set(playerIds);

    setInitiativeById((previous) => {
      const next: Record<string, number> = {};
      for (const playerId of playerIds) {
        const value = previous[playerId];
        if (typeof value === "number") {
          next[playerId] = value;
        }
      }
      return next;
    });

    setInitiativeOrder((previous) => mergeOrderWithPlayers(previous, players));
    setActiveInitiativePlayerId((previous) => (previous && playerIdSet.has(previous) ? previous : null));
  }, [players]);

  useEffect(() => {
    return () => {
      for (const url of assetUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  useEffect(() => {
    if (!contextMenu) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as Node | null;
      if (target && contextMenuRef.current?.contains(target)) return;
      setContextMenu(null);
    };

    window.addEventListener("pointerdown", handleOutsidePointerDown);
    return () => {
      window.removeEventListener("pointerdown", handleOutsidePointerDown);
    };
  }, [contextMenu]);

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

  const addPlayer = () => {
    setPlayers((previous) => [...previous, createDefaultPlayer(previous.length + 1)]);
  };

  const updatePlayer = (playerId: string, updates: Partial<PlayerCharacter>) => {
    setPlayers((previous) => previous.map((player) => (player.id === playerId ? { ...player, ...updates } : player)));
  };

  const duplicatePlayer = (playerId: string) => {
    setPlayers((previous) => {
      const source = previous.find((player) => player.id === playerId);
      if (!source) return previous;

      return [
        ...previous,
        {
          ...source,
          id: `player-${crypto.randomUUID()}`,
          name: `${source.name} Copy`,
        },
      ];
    });
  };

  const deletePlayer = (playerId: string) => {
    setPlayers((previous) => previous.filter((player) => player.id !== playerId));
  };

  const renamePlayerPrompt = (playerId: string) => {
    const source = players.find((player) => player.id === playerId);
    if (!source) return;
    const nextName = window.prompt("Rename player:", source.name);
    if (nextName === null) return;
    const trimmed = nextName.trim();
    if (!trimmed) return;
    updatePlayer(playerId, { name: trimmed });
  };

  const setHpPrompt = (tokenId: string) => {
    const value = window.prompt('Set HP as "current/max"', "10/10");
    if (value === null) return;

    const match = value.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
    if (!match) return;

    const hpCurrent = Number(match[1]);
    const hpMax = Number(match[2]);
    if (!Number.isFinite(hpCurrent) || !Number.isFinite(hpMax) || hpMax <= 0) return;

    setContextAction({
      nonce: actionNonceRef.current++,
      type: "setHp",
      tokenId,
      hpCurrent,
      hpMax,
    });
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

  const rollAllInitiative = () => {
    const rolled: Record<string, number> = {};
    for (const player of players) {
      rolled[player.id] = Math.floor(Math.random() * 20) + 1;
    }

    setInitiativeById(rolled);
    setInitiativeOrder((previous) => sortOrderByInitiativeDesc(mergeOrderWithPlayers(previous, players), rolled));
    setActiveInitiativePlayerId(null);
  };

  const nextInitiativeTurn = () => {
    if (sortedInitiativeOrder.length === 0) {
      setActiveInitiativePlayerId(null);
      return;
    }

    setInitiativeOrder(sortedInitiativeOrder);
    setActiveInitiativePlayerId((current) => {
      if (!current) return sortedInitiativeOrder[0];
      const currentIndex = sortedInitiativeOrder.indexOf(current);
      if (currentIndex < 0) return sortedInitiativeOrder[0];
      return sortedInitiativeOrder[(currentIndex + 1) % sortedInitiativeOrder.length];
    });
  };

  const clearInitiativeTracker = () => {
    setInitiativeById({});
    setInitiativeOrder([]);
    setActiveInitiativePlayerId(null);
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
      <input
        ref={assetInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleAssetFilesChange}
        style={{ display: "none" }}
      />

      <Tabletop
        snapToGrid={snapToGrid}
        contextAction={contextAction}
        placingAsset={mode === "create" ? placingAsset : null}
        players={players}
        assetLibrary={assetLibrary}
        onPlacedAsset={mode === "create" ? () => setPlacingAsset(null) : undefined}
        onTokenContextMenu={(tokenId, x, y) => setContextMenu({ tokenId, x, y })}
        onRequestCloseContextMenu={() => setContextMenu(null)}
      />

      {mode === "create" && (
        <>
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
            <button type="button" onClick={() => setAssetsOpen((open) => !open)} style={panelToggleButtonStyle}>
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
                        onClick={() => setPlacingAsset({ id: asset.id, name: asset.name, url: asset.url })}
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
              width: 364,
              display: "flex",
              alignItems: "flex-start",
              gap: 6,
              transform: playersOpen ? "translateX(0)" : "translateX(-276px)",
              transition: "transform 160ms ease",
            }}
          >
            <div style={{ ...sidePanelStyle, width: 270 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Players</div>
              <button type="button" onClick={addPlayer} style={trackerButtonStyle}>
                Add Player
              </button>
              <div
                style={{
                  border: "1px solid #3a3a3a",
                  borderRadius: 8,
                  overflowY: "auto",
                  maxHeight: "calc(100vh - 180px)",
                  display: "grid",
                }}
              >
                {players.length === 0 ? (
                  <div style={{ padding: 10, fontSize: 12, color: "#b6b6b6" }}>No players</div>
                ) : (
                  players.map((player) => (
                    <div
                      key={player.id}
                      style={{
                        display: "grid",
                        gap: 6,
                        padding: 8,
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <input
                        type="text"
                        value={player.name}
                        onChange={(event) => updatePlayer(player.id, { name: event.target.value })}
                        style={inputStyle}
                      />
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="color"
                          value={player.color}
                          onChange={(event) => updatePlayer(player.id, { color: event.target.value })}
                          style={{ width: 42, height: 28, padding: 0, border: "1px solid #3a3a3a", borderRadius: 6 }}
                        />
                        <select
                          value={player.tokenAssetId ?? ""}
                          onChange={(event) =>
                            updatePlayer(player.id, { tokenAssetId: event.target.value || null })
                          }
                          style={{ ...inputStyle, minHeight: 28 }}
                        >
                          <option value="">No image (color token)</option>
                          {assets.map((asset) => (
                            <option key={asset.id} value={asset.id}>
                              {asset.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
            <button type="button" onClick={() => setPlayersOpen((open) => !open)} style={panelToggleButtonStyle}>
              {playersOpen ? "Hide" : "Players"}
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

      {mode === "play" && playSetupOpen && (
        <div
          style={{
            position: "fixed",
            top: 56,
            left: 12,
            zIndex: 1110,
            width: "min(360px, calc(100vw - 24px))",
            border: "1px solid #4a4a4a",
            borderRadius: 10,
            background: "rgba(18,18,18,0.94)",
            color: "#f2f2f2",
            padding: 10,
            display: "grid",
            gap: 10,
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700 }}>Player Setup</div>
          <div style={{ fontSize: 12, color: "#cfcfcf" }}>Choose token images, then press Start.</div>
          <button type="button" onClick={handleImportImages} style={trackerButtonStyle}>
            Import Images
          </button>
          <div style={{ display: "grid", gap: 8, maxHeight: 300, overflowY: "auto" }}>
            {players.map((player) => (
              <div key={player.id} style={{ display: "grid", gap: 4 }}>
                <div style={{ fontSize: 13 }}>{player.name}</div>
                <select
                  value={player.tokenAssetId ?? ""}
                  onChange={(event) => updatePlayer(player.id, { tokenAssetId: event.target.value || null })}
                  style={inputStyle}
                >
                  <option value="">No image (color token)</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setPlaySetupOpen(false)} style={trackerButtonStyle}>
            Start
          </button>
        </div>
      )}

      {mode === "play" && (
        <div
          style={{
            position: "fixed",
            left: 12,
            bottom: 12,
            zIndex: 1110,
            width: 354,
            display: "flex",
            alignItems: "flex-end",
            gap: 6,
            transform: initiativeOpen ? "translateX(0)" : "translateX(-266px)",
            transition: "transform 160ms ease",
          }}
        >
          <div style={{ ...sidePanelStyle, width: 260 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>Initiative</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button type="button" onClick={rollAllInitiative} style={trackerButtonStyle}>
                Roll All
              </button>
              <button type="button" onClick={nextInitiativeTurn} style={trackerButtonStyle}>
                Next
              </button>
              <button type="button" onClick={clearInitiativeTracker} style={trackerButtonStyle}>
                Clear
              </button>
            </div>
            <div
              style={{
                border: "1px solid #3a3a3a",
                borderRadius: 8,
                overflowY: "auto",
                maxHeight: 240,
              }}
            >
              {sortedInitiativeOrder.length === 0 ? (
                <div style={{ padding: 10, fontSize: 12, color: "#b6b6b6" }}>No players</div>
              ) : (
                sortedInitiativeOrder.map((playerId) => {
                  const player = players.find((item) => item.id === playerId);
                  if (!player) return null;
                  const isActive = player.id === activeInitiativePlayerId;
                  const initiative = initiativeById[player.id];
                  return (
                    <div
                      key={player.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 9px",
                        fontSize: 13,
                        background: isActive ? "rgba(255,240,122,0.22)" : "transparent",
                        borderTop: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {player.name}
                      </span>
                      <span style={{ minWidth: 24, textAlign: "right", fontWeight: 700 }}>
                        {typeof initiative === "number" ? initiative : "-"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <button type="button" onClick={() => setInitiativeOpen((open) => !open)} style={panelToggleButtonStyle}>
            {initiativeOpen ? "Hide" : "Initiative"}
          </button>
        </div>
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
            onClick={() => {
              duplicatePlayer(contextMenu.tokenId);
              setContextMenu(null);
            }}
            style={menuButtonStyle}
          >
            Duplicate player
          </button>
          <button
            type="button"
            onClick={() => {
              renamePlayerPrompt(contextMenu.tokenId);
              setContextMenu(null);
            }}
            style={menuButtonStyle}
          >
            Rename player
          </button>
          <button
            type="button"
            onClick={() => {
              setHpPrompt(contextMenu.tokenId);
              setContextMenu(null);
            }}
            style={menuButtonStyle}
          >
            Set HP
          </button>
          <button
            type="button"
            onClick={() => {
              deletePlayer(contextMenu.tokenId);
              setContextMenu(null);
            }}
            style={menuButtonStyle}
          >
            Delete player
          </button>
        </div>
      )}

      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 1120,
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
          zIndex: 1130,
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

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #3a3a3a",
  borderRadius: 6,
  background: "rgba(28,28,28,0.95)",
  color: "#f2f2f2",
  fontSize: 12,
  padding: "5px 7px",
};
