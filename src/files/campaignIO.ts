import type { CampaignMeta } from "../types/fileTypes";

export type CampaignListItem = {
  id?: string;
  name: string;
  description?: string;
};

const getFilesApi = () => window.api?.files;
const LOCAL_CAMPAIGNS_KEY = "dnd_local_campaigns_v1";

const readLocalCampaigns = (): CampaignListItem[] => {
  try {
    const raw = window.localStorage.getItem(LOCAL_CAMPAIGNS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const campaigns: CampaignListItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const value = entry as { id?: unknown; name?: unknown };
      if (typeof value.name !== "string" || value.name.trim().length === 0) continue;
      campaigns.push({
        id: typeof value.id === "string" ? value.id : undefined,
        name: value.name.trim(),
        description: typeof (value as { description?: unknown }).description === "string"
          ? ((value as { description: string }).description.trim() || undefined)
          : undefined,
      });
    }
    return campaigns;
  } catch {
    return [];
  }
};

const writeLocalCampaigns = (campaigns: CampaignListItem[]) => {
  window.localStorage.setItem(LOCAL_CAMPAIGNS_KEY, JSON.stringify(campaigns));
};

export const listCampaigns = async (): Promise<CampaignListItem[]> => {
  const filesApi = getFilesApi();
  if (!filesApi) {
    return readLocalCampaigns();
  }
  try {
    const campaigns = await filesApi.listCampaigns();
    return campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
    }));
  } catch {
    return readLocalCampaigns();
  }
};

export const createCampaign = async (name: string, description = ""): Promise<CampaignMeta> => {
  const trimmedName = name.trim();
  const trimmedDescription = description.trim();
  if (!trimmedName) {
    throw new Error("Campaign name is required.");
  }

  const filesApi = getFilesApi();
  if (!filesApi) {
    const campaigns = readLocalCampaigns();
    const created: CampaignMeta = {
      id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`,
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      scenes: [],
    };
    writeLocalCampaigns([
      ...campaigns,
      { id: created.id, name: created.name, description: created.description },
    ]);
    return created;
  }
  try {
    return filesApi.createCampaign({ name: trimmedName, description: trimmedDescription });
  } catch {
    const campaigns = readLocalCampaigns();
    const created: CampaignMeta = {
      id: globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}`,
      name: trimmedName,
      ...(trimmedDescription ? { description: trimmedDescription } : {}),
      scenes: [],
    };
    writeLocalCampaigns([
      ...campaigns,
      { id: created.id, name: created.name, description: created.description },
    ]);
    return created;
  }
};
