export type AppRoute = "home" | "dm" | "player" | "campaign";
export type CampaignMode = "edit" | "play";
export type CampaignRole = "dm" | "player";

export type AppNavState = {
  route: AppRoute;
  selectedCampaignId: string | null;
  campaignName: string | null;
  campaignMode: CampaignMode;
  role: CampaignRole;
};

export const createInitialAppNavState = (): AppNavState => ({
  route: "home",
  selectedCampaignId: null,
  campaignName: null,
  campaignMode: "edit",
  role: "dm",
});
