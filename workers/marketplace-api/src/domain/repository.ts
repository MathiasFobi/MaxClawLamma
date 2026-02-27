import type { MarketplaceCatalogSnapshot } from "./model";

export type MarketplaceDataSource = {
  loadSnapshot(): Promise<MarketplaceCatalogSnapshot>;
};
