import type { MarketplaceRecommendationResult } from "../../domain/model";
import type { SkillRepository } from "../../domain/skill-repository";

export class ListSkillRecommendationsUseCase {
  constructor(private readonly repository: SkillRepository) {}

  async execute(sceneId: string | undefined, limit: number): Promise<MarketplaceRecommendationResult> {
    return this.repository.listRecommendations(sceneId, limit);
  }
}
