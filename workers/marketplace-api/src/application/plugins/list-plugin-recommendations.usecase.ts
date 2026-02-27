import type { MarketplaceRecommendationResult } from "../../domain/model";
import type { PluginRepository } from "../../domain/plugin-repository";

export class ListPluginRecommendationsUseCase {
  constructor(private readonly repository: PluginRepository) {}

  async execute(sceneId: string | undefined, limit: number): Promise<MarketplaceRecommendationResult> {
    return this.repository.listRecommendations(sceneId, limit);
  }
}
