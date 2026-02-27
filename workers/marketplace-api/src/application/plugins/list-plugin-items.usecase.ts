import type { MarketplaceListQuery, MarketplaceListResult } from "../../domain/model";
import type { PluginRepository } from "../../domain/plugin-repository";

export class ListPluginItemsUseCase {
  constructor(private readonly repository: PluginRepository) {}

  async execute(query: MarketplaceListQuery): Promise<MarketplaceListResult> {
    return this.repository.listItems(query);
  }
}
