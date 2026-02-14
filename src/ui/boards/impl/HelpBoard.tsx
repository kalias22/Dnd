import { useEffect, useMemo, useState } from "react";

type HelpEntry = {
  id: string;
  title: string;
  summary: string;
  body: string;
  tags: string[];
};

const HELP_ENTRIES: HelpEntry[] = [
  {
    id: "boards-overview",
    title: "Boards: Open, Close, Dock, Collapse",
    summary: "Use the native Boards menu and board headers to control windows.",
    body:
      "Open boards from the native menu bar under Boards. Drag a board by its header to move it, drop near screen edges to dock left/right, use the - button to collapse docked boards, and X to close.",
    tags: ["boards", "dock", "collapse", "window", "menu"],
  },
  {
    id: "assets-manager-flow",
    title: "Assets Manager and Tiles Manager",
    summary: "General assets and tile workflows are split into separate boards.",
    body:
      "Assets Manager handles general image imports and previews. Tiles Manager handles tile importing into Documents/DND/Assets/Tiles, adding tiles to campaign usage, and maintaining tile priority order.",
    tags: ["assets", "tiles", "library", "campaign", "priority", "boards"],
  },
  {
    id: "brush-modes",
    title: "Brush Modes and Actions",
    summary: "Choose mode, Place/Erase action, and Base/Overlay target.",
    body:
      "Manual paints continuously while dragging. Rectangle/Circle/Freehand apply to selected areas. Action toggles between Place and Erase. Target chooses whether edits apply to Base or Overlay layers.",
    tags: ["brush", "manual", "rectangle", "circle", "freehand", "erase", "overlay"],
  },
  {
    id: "scenes-management",
    title: "Scenes: Create, Rename, Delete",
    summary: "Manage scene files in the active campaign.",
    body:
      "Create Scene adds a new scene file under Campaigns/<campaign>/scenes. Rename updates scene metadata and the scene file name field. Delete removes the scene file and metadata entry after confirmation.",
    tags: ["scenes", "create", "rename", "delete", "campaign"],
  },
  {
    id: "settings-scope",
    title: "Settings Scope: Global vs Campaign",
    summary: "Know where each setting is saved.",
    body:
      "Interface/Grid/Brush defaults/Files settings save to global files (settings.json and tool-settings.json). Game Settings appear only with an active campaign and save into that campaign's campaign.json.",
    tags: ["settings", "global", "campaign", "tool-settings", "settings.json"],
  },
];

export default function HelpBoard() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string>(HELP_ENTRIES[0]?.id ?? "");

  const filteredEntries = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return HELP_ENTRIES;
    return HELP_ENTRIES.filter((entry) => {
      const haystack = `${entry.title} ${entry.summary} ${entry.body} ${entry.tags.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [search]);

  useEffect(() => {
    if (filteredEntries.length === 0) return;
    if (!filteredEntries.some((entry) => entry.id === selectedId)) {
      setSelectedId(filteredEntries[0].id);
    }
  }, [filteredEntries, selectedId]);

  const selectedEntry = filteredEntries.find((entry) => entry.id === selectedId) ?? null;

  return (
    <div style={{ display: "grid", gap: 10, minHeight: 0 }}>
      <input
        type="text"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search help..."
        style={{
          width: "100%",
          border: "1px solid rgba(170,184,210,0.45)",
          borderRadius: 7,
          background: "rgba(10, 14, 20, 0.85)",
          color: "#edf3ff",
          fontSize: 12,
          padding: "7px 9px",
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 10, minHeight: 0 }}>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            background: "rgba(10, 13, 20, 0.75)",
            padding: 8,
            overflowY: "auto",
            minHeight: 0,
            display: "grid",
            gap: 6,
            alignContent: "start",
          }}
        >
          {filteredEntries.length === 0 ? (
            <div style={{ fontSize: 12, color: "#c2ccde" }}>No matching help entries.</div>
          ) : (
            filteredEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                style={{
                  textAlign: "left",
                  border: "1px solid rgba(170,184,210,0.45)",
                  borderRadius: 7,
                  background: selectedId === entry.id ? "rgba(64,110,184,0.35)" : "rgba(16,20,28,0.92)",
                  color: "#eff4ff",
                  fontSize: 12,
                  padding: "6px 8px",
                  cursor: "pointer",
                  display: "grid",
                  gap: 3,
                }}
              >
                <span>{entry.title}</span>
                <span style={{ fontSize: 11, color: "#b8c3d8" }}>{entry.summary}</span>
              </button>
            ))
          )}
        </div>
        <div
          style={{
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            background: "rgba(10, 13, 20, 0.75)",
            padding: 10,
            overflowY: "auto",
            minHeight: 0,
            display: "grid",
            gap: 8,
          }}
        >
          {selectedEntry ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#f2f6ff" }}>{selectedEntry.title}</div>
              <div style={{ fontSize: 12, color: "#c9d3e6", lineHeight: 1.5 }}>{selectedEntry.body}</div>
              <div style={{ fontSize: 11, color: "#aeb8cc" }}>Tags: {selectedEntry.tags.join(", ")}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: "#c2ccde" }}>Select a help topic from the results list.</div>
          )}
        </div>
      </div>
    </div>
  );
}
