import { useEffect, useState, type CSSProperties } from "react";
import { createCampaign, listCampaigns, type CampaignListItem } from "../../files/campaignIO";

type EnterCampaignPayload = {
  campaignId?: string;
  campaignName: string;
  mode: "edit" | "play";
  role: "dm";
};

type DMScreenProps = {
  onBack: () => void;
  onEnterCampaign?: (payload: EnterCampaignPayload) => void;
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
  width: "min(700px, 100%)",
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

const rowButtonStyle: CSSProperties = {
  border: "1px solid #49526a",
  borderRadius: 8,
  background: "rgba(24,28,37,0.95)",
  color: "#f2f2f2",
  fontSize: 13,
  padding: "6px 10px",
  cursor: "pointer",
};

const listContainerStyle: CSSProperties = {
  border: "1px solid #3d4558",
  borderRadius: 10,
  background: "rgba(11,14,20,0.88)",
  maxHeight: "44vh",
  overflowY: "auto",
};

const listRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 10,
  padding: "10px 12px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
};

const createPanelStyle: CSSProperties = {
  border: "1px solid #3d4558",
  borderRadius: 10,
  background: "rgba(11,14,20,0.9)",
  padding: 12,
  display: "grid",
  gap: 8,
};

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #49526a",
  borderRadius: 8,
  background: "rgba(24,28,37,0.95)",
  color: "#f2f2f2",
  fontSize: 14,
  padding: "7px 10px",
};

const textareaStyle: CSSProperties = {
  ...inputStyle,
  resize: "vertical",
  minHeight: 70,
  fontFamily: "inherit",
};

export default function DMScreen({ onBack, onEnterCampaign }: DMScreenProps) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignDescription, setNewCampaignDescription] = useState("");
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  const refreshCampaigns = async () => {
    setLoading(true);
    setErrorText(null);
    try {
      const nextCampaigns = await listCampaigns();
      setCampaigns(nextCampaigns);
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshCampaigns();
  }, []);

  const handleCreateCampaign = async () => {
    const trimmedName = newCampaignName.trim();
    if (!trimmedName) {
      setErrorText("Campaign name is required.");
      return;
    }
    setCreatingCampaign(true);
    setErrorText(null);
    try {
      const created = await createCampaign(trimmedName, newCampaignDescription);
      await refreshCampaigns();
      setCreatePanelOpen(false);
      setNewCampaignName("");
      setNewCampaignDescription("");
      onEnterCampaign?.({
        campaignId: created.id,
        campaignName: created.name,
        mode: "edit",
        role: "dm",
      });
    } catch (error: unknown) {
      setErrorText(error instanceof Error ? error.message : "Failed to create campaign.");
    } finally {
      setCreatingCampaign(false);
    }
  };

  return (
    <div style={screenStyle}>
      <div style={cardStyle}>
        <h1 style={{ margin: 0, fontSize: 30 }}>DM</h1>
        <p style={{ margin: 0, color: "#c8d0df" }}>Campaigns</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setCreatePanelOpen((open) => !open)} style={buttonStyle}>
            Create New Campaign
          </button>
          <button type="button" onClick={onBack} style={buttonStyle}>
            Back
          </button>
        </div>
        {createPanelOpen && (
          <div style={createPanelStyle}>
            <div style={{ fontSize: 13, color: "#c8d0df" }}>New Campaign</div>
            <input
              type="text"
              value={newCampaignName}
              onChange={(event) => setNewCampaignName(event.target.value)}
              placeholder="Campaign name"
              style={inputStyle}
            />
            <textarea
              value={newCampaignDescription}
              onChange={(event) => setNewCampaignDescription(event.target.value)}
              placeholder="Description (optional)"
              style={textareaStyle}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setCreatePanelOpen(false);
                  setNewCampaignName("");
                  setNewCampaignDescription("");
                  setErrorText(null);
                }}
                style={rowButtonStyle}
                disabled={creatingCampaign}
              >
                Cancel
              </button>
              <button type="button" onClick={handleCreateCampaign} style={rowButtonStyle} disabled={creatingCampaign}>
                {creatingCampaign ? "Creating..." : "Create & Open Editor"}
              </button>
            </div>
          </div>
        )}
        {errorText && <div style={{ fontSize: 13, color: "#ff9b9b" }}>{errorText}</div>}
        <div style={listContainerStyle}>
          {loading ? (
            <div style={{ padding: "12px", fontSize: 13, color: "#c8d0df" }}>Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div style={{ padding: "12px", fontSize: 13, color: "#c8d0df" }}>No campaigns yet.</div>
          ) : (
            campaigns.map((campaign, index) => (
              <div key={campaign.id ?? `${campaign.name}-${index}`} style={listRowStyle}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "#f2f2f2", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {campaign.name}
                  </div>
                  {campaign.description && (
                    <div style={{ marginTop: 3, fontSize: 12, color: "#aeb8cc" }}>{campaign.description}</div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    style={rowButtonStyle}
                    onClick={() =>
                      onEnterCampaign?.({
                        campaignId: campaign.id,
                        campaignName: campaign.name,
                        mode: "play",
                        role: "dm",
                      })
                    }
                  >
                    Run
                  </button>
                  <button
                    type="button"
                    style={rowButtonStyle}
                    onClick={() =>
                      onEnterCampaign?.({
                        campaignId: campaign.id,
                        campaignName: campaign.name,
                        mode: "edit",
                        role: "dm",
                      })
                    }
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
