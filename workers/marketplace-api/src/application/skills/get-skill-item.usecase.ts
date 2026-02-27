import { ResourceNotFoundError } from "../../domain/errors";
import type { MarketplaceItem } from "../../domain/model";
import type { SkillRepository } from "../../domain/skill-repository";

export class GetSkillItemUseCase {
  constructor(private readonly repository: SkillRepository) {}

  async execute(slug: string): Promise<MarketplaceItem> {
    const item = await this.repository.getItemBySlug(slug);
    if (!item) {
      throw new ResourceNotFoundError(`skill item not found: ${slug}`);
    }
    return item;
  }
}
