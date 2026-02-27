import type { Context } from "hono";
import type { GetPluginItemUseCase } from "../../application/plugins/get-plugin-item.usecase";
import type { ListPluginItemsUseCase } from "../../application/plugins/list-plugin-items.usecase";
import type { ListPluginRecommendationsUseCase } from "../../application/plugins/list-plugin-recommendations.usecase";
import type { MarketplaceQueryParser } from "./query-parser";
import type { ApiResponseFactory } from "./response";

export class PluginController {
  constructor(
    private readonly listItemsUseCase: ListPluginItemsUseCase,
    private readonly getItemUseCase: GetPluginItemUseCase,
    private readonly listRecommendationsUseCase: ListPluginRecommendationsUseCase,
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
