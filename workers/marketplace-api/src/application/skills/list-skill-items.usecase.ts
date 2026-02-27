import type { MarketplaceListQuery, MarketplaceListResult } from "../../domain/model";
import type { SkillRepository } from "../../domain/skill-repository";

export class ListSkillItemsUseCase {
  constructor(private readonly repository: SkillRepository) {}

  async execute(query: MarketplaceListQuery): Promise<MarketplaceListResult> {
    return this.repository.listItems(query);
  }
}
