import { useState, type CSSProperties, type ReactNode } from "react";

type CampaignShellProps = {
  role: "dm" | "player";
  campaignMode: "play" | "edit";
  campaignName: string;
  onExitCampaign: () => void;
  children: ReactNode;
};

const overlayStyle: CSSProperties = {
  position: "fixed",
  top: 10,
  left: 10,
  zIndex: 2100,
  border: "1px solid #4a4a4a",
  borderRadius: 8,
  background: "rgba(18,18,18,0.92)",
  color: "#f2f2f2",
  padding: "8px 9px",
  display: "grid",
  gap: 6,
  fontFamily: "sans-serif",
  minWidth: 180,
};

const smallButtonStyle: CSSProperties = {
  border: "1px solid #3f3f3f",
  borderRadius: 6,
  background: "rgba(28,28,28,0.95)",
  color: "#f2f2f2",
  fontSize: 12,
  padding: "6px 8px",
  cursor: "pointer",
};

export default function CampaignShell({ role, campaignMode, campaignName, onExitCampaign, children }: CampaignShellProps) {
  const [dmToolsVisible, setDmToolsVisible] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {children}
      <div style={overlayStyle}>
        <button type="button" onClick={onExitCampaign} style={smallButtonStyle}>
          Exit to Home
        </button>
        <div style={{ fontSize: 11, color: "#bfcbe0", lineHeight: 1.3 }}>
          {campaignName}
          <br />
          {campaignMode.toUpperCase()} - {role.toUpperCase()}
        </div>
        {role === "dm" && (
          <button
            type="button"
            onClick={() => setDmToolsVisible((visible) => !visible)}
            style={smallButtonStyle}
          >
            {dmToolsVisible ? "Hide DM Tools" : "Reveal DM Tools"}
          </button>
        )}
      </div>
    </div>
  );
}

