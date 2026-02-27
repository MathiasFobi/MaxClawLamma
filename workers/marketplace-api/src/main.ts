import { Hono } from "hono";
import { GetPluginItemUseCase } from "./application/plugins/get-plugin-item.usecase";
import { ListPluginItemsUseCase } from "./application/plugins/list-plugin-items.usecase";
import { ListPluginRecommendationsUseCase } from "./application/plugins/list-plugin-recommendations.usecase";
import { GetSkillItemUseCase } from "./application/skills/get-skill-item.usecase";
import { ListSkillItemsUseCase } from "./application/skills/list-skill-items.usecase";
import { ListSkillRecommendationsUseCase } from "./application/skills/list-skill-recommendations.usecase";
import { DomainValidationError, ResourceNotFoundError } from "./domain/errors";
import { BundledMarketplaceDataSource } from "./infrastructure/bundled-data-source";
import { InMemoryPluginRepository } from "./infrastructure/in-memory-plugin-repository";
import { InMemorySkillRepository } from "./infrastructure/in-memory-skill-repository";
import { PluginController } from "./presentation/http/plugin-controller";
import { PluginRouter } from "./presentation/http/plugin-router";
import { MarketplaceQueryParser } from "./presentation/http/query-parser";
import { ApiResponseFactory } from "./presentation/http/response";
import { SkillController } from "./presentation/http/skill-controller";
import { SkillRouter } from "./presentation/http/skill-router";

class MarketplaceContainer {
  private readonly responses = new ApiResponseFactory();
  private readonly parser = new MarketplaceQueryParser();

  private readonly dataSource = new BundledMarketplaceDataSource();

  private readonly pluginRepository = new InMemoryPluginRepository(this.dataSource, {
    cacheTtlMs: 120_000
  });
  private readonly listPluginItems = new ListPluginItemsUseCase(this.pluginRepository);
  private readonly getPluginItem = new GetPluginItemUseCase(this.pluginRepository);
  private readonly listPluginRecommendations = new ListPluginRecommendationsUseCase(this.pluginRepository);
  private readonly pluginController = new PluginController(
    this.listPluginItems,
    this.getPluginItem,
    this.listPluginRecommendations,
    this.parser,
    this.responses
  );
  private readonly pluginRouter = new PluginRouter(this.pluginController);

  private readonly skillRepository = new InMemorySkillRepository(this.dataSource, {
    cacheTtlMs: 120_000
  });
  private readonly listSkillItems = new ListSkillItemsUseCase(this.skillRepository);
  private readonly getSkillItem = new GetSkillItemUseCase(this.skillRepository);
  private readonly listSkillRecommendations = new ListSkillRecommendationsUseCase(this.skillRepository);
  private readonly skillController = new SkillController(
    this.listSkillItems,
    this.getSkillItem,
    this.listSkillRecommendations,
    this.parser,
    this.responses
  );
  private readonly skillRouter = new SkillRouter(this.skillController);

  app() {
    const app = new Hono();

    app.notFound((c) => this.responses.error(c, "NOT_FOUND", "endpoint not found", 404));

    app.onError((error, c) => {
      if (error instanceof ResourceNotFoundError) {
        return this.responses.error(c, "NOT_FOUND", error.message, 404);
      }

      if (error instanceof DomainValidationError) {
        return this.responses.error(c, "INVALID_QUERY", error.message, 400);
      }

      return this.responses.error(c, "INTERNAL_ERROR", error.message || "internal error", 500);
    });

    app.use("/api/v1/*", async (c, next) => {
      if (c.req.method !== "GET") {
        return this.responses.error(c, "READ_ONLY_API", "marketplace api is read-only", 405);
      }
      await next();
      return undefined;
    });

    app.get("/health", (c) => {
      return this.responses.ok(c, {
        status: "ok",
        service: "marketplace-api"
      });
    });

    this.pluginRouter.register(app);
    this.skillRouter.register(app);

    return app;
  }
}

const container = new MarketplaceContainer();

export default container.app();
