import type { MarketplaceItem, MarketplaceListQuery, MarketplaceListResult, MarketplaceRecommendationResult } from "./model";

export interface PluginRepository {
  listItems(query: MarketplaceListQuery): Promise<MarketplaceListResult>;
  getItemBySlug(slug: string): Promise<MarketplaceItem | null>;
  listRecommendations(sceneId: string | undefined, limit: number): Promise<MarketplaceRecommendationResult>;
}
