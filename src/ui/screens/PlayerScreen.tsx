import { useState, type CSSProperties } from "react";

type PlayerScreenProps = {
  onBack: () => void;
};

const screenStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  background: "radial-gradient(circle at top, #1d2638 0%, #0b0c10 55%, #08090c 100%)",
  color: "#f2f2f2",
  fontFamily: "sans-serif",
  padding: 16,
};

const cardStyle: CSSProperties = {
  width: "min(620px, 100%)",
  border: "1px solid #3d4558",
  borderRadius: 12,
  background: "rgba(14,16,22,0.92)",
  padding: "24px 22px",
  display: "grid",
  gap: 14,
};

const buttonStyle: CSSProperties = {
  justifySelf: "start",
  border: "1px solid #49526a",
  borderRadius: 8,
  background: "rgba(24,28,37,0.95)",
  color: "#f2f2f2",
  fontSize: 14,
  padding: "8px 12px",
  cursor: "pointer",
};

const characterListStyle: CSSProperties = {
  border: "1px solid #3d4558",
  borderRadius: 10,
  background: "rgba(11,14,20,0.88)",
  display: "grid",
  gap: 0,
  overflow: "hidden",
};

const characterRowStyle = (selected: boolean): CSSProperties => ({
  textAlign: "left",
  border: 0,
  borderTop: "1px solid rgba(255,255,255,0.08)",
  background: selected ? "rgba(78,122,215,0.26)" : "rgba(0,0,0,0)",
  color: "#f2f2f2",
  fontSize: 14,
  padding: "9px 10px",
  cursor: "pointer",
});

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #3d4558",
  borderRadius: 8,
  background: "rgba(24,28,37,0.95)",
  color: "#f2f2f2",
  fontSize: 14,
  padding: "8px 10px",
};

const joinButtonStyle: CSSProperties = {
  border: "1px solid #49526a",
  borderRadius: 8,
  background: "rgba(39,86,178,0.75)",
  color: "#f2f2f2",
  fontSize: 14,
  padding: "8px 12px",
  cursor: "pointer",
};

export default function PlayerScreen({ onBack }: PlayerScreenProps) {
  const characters = ["Alice", "Bob"];
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(characters[0] ?? null);
  const [joinCode, setJoinCode] = useState("");

  const handleJoin = () => {
    console.log("Join game (stub)", {
      character: selectedCharacter,
      code: joinCode.trim(),
    });
  };

  return (
    <div style={screenStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 30 }}>Player</h1>
        <p style={{ margin: 0, color: "#c8d0df" }}>Select character and join a game.</p>

        <div style={characterListStyle}>
          {characters.map((character, index) => (
            <button
              key={character}
              type="button"
              style={{
                ...characterRowStyle(selectedCharacter === character),
                borderTop: index === 0 ? 0 : "1px solid rgba(255,255,255,0.08)",
              }}
              onClick={() => setSelectedCharacter(character)}
            >
              {character}
            </button>
          ))}
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, color: "#c8d0df" }}>IP or Code</span>
          <input
            type="text"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="127.0.0.1 or room code"
            style={inputStyle}
          />
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={handleJoin} style={joinButtonStyle}>
            Join
          </button>
          <button type="button" onClick={onBack} style={buttonStyle}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
