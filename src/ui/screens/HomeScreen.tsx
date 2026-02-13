import type { CSSProperties } from "react";

type HomeScreenProps = {
  onSelectDM: () => void;
  onSelectPlayer: () => void;
};

const screenStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "radial-gradient(circle at top, #1d2638 0%, #0b0c10 55%, #08090c 100%)",
  color: "#f2f2f2",
  fontFamily: "sans-serif",
  padding: 16,
};

const cardStyle: CSSProperties = {
  width: "min(560px, 100%)",
  border: "1px solid #3d4558",
  borderRadius: 14,
  background: "rgba(14,16,22,0.92)",
  boxShadow: "0 20px 48px rgba(0,0,0,0.35)",
  padding: "28px 24px",
  display: "grid",
  gap: 16,
  textAlign: "center",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "center",
  gap: 14,
  flexWrap: "wrap",
};

const choiceButtonStyle: CSSProperties = {
  border: "1px solid #49526a",
  borderRadius: 12,
  background: "rgba(24,28,37,0.95)",
  color: "#f2f2f2",
  fontSize: 28,
  fontWeight: 700,
  padding: "22px 28px",
  cursor: "pointer",
  minWidth: 200,
};

export default function HomeScreen({ onSelectDM, onSelectPlayer }: HomeScreenProps) {
  return (
    <div style={screenStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 38, lineHeight: 1.1, letterSpacing: 0.4 }}>DnD Virtual Tabletop</h1>
        <div style={buttonRowStyle}>
          <button type="button" onClick={onSelectDM} style={choiceButtonStyle}>
            DM
          </button>
          <button type="button" onClick={onSelectPlayer} style={choiceButtonStyle}>
            Player
          </button>
        </div>
      </div>
    </div>
  );
}
