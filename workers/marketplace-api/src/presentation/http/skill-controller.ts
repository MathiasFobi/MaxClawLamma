import type { Context } from "hono";
import type { GetSkillItemUseCase } from "../../application/skills/get-skill-item.usecase";
import type { ListSkillItemsUseCase } from "../../application/skills/list-skill-items.usecase";
import type { ListSkillRecommendationsUseCase } from "../../application/skills/list-skill-recommendations.usecase";
import type { MarketplaceQueryParser } from "./query-parser";
import type { ApiResponseFactory } from "./response";

export class SkillController {
  constructor(
    private readonly listItemsUseCase: ListSkillItemsUseCase,
    private readonly getItemUseCase: GetSkillItemUseCase,
    private readonly listRecommendationsUseCase: ListSkillRecommendationsUseCase,
    private readonly parser: MarketplaceQueryParser,
    private readonly responses: ApiResponseFactory
  ) {}

  async listItems(c: Context) {
    const query = this.parser.parseListQuery(c);
    const data = await this.listItemsUseCase.execute(query);
    return this.responses.ok(c, data);
  }

  async getItem(c: Context) {
    const slug = c.req.param("slug");
    const data = await this.getItemUseCase.execute(slug);
    return this.responses.ok(c, data);
  }

  async listRecommendations(c: Context) {
    const sceneId = this.parser.parseRecommendationScene(c);
    const limit = this.parser.parseRecommendationLimit(c);
    const data = await this.listRecommendationsUseCase.execute(sceneId, limit);
    return this.responses.ok(c, data);
  }
}
