import { ResourceNotFoundError } from "../../domain/errors";
import type { MarketplaceItem } from "../../domain/model";
import type { PluginRepository } from "../../domain/plugin-repository";

export class GetPluginItemUseCase {
  constructor(private readonly repository: PluginRepository) {}

  async execute(slug: string): Promise<MarketplaceItem> {
    const item = await this.repository.getItemBySlug(slug);
    if (!item) {
      throw new ResourceNotFoundError(`plugin item not found: ${slug}`);
    }
    return item;
  }
}
