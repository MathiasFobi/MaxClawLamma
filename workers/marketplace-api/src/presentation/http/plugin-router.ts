import type { Hono } from "hono";
import type { PluginController } from "./plugin-controller";

export class PluginRouter {
  constructor(private readonly controller: PluginController) {}

  register(app: Hono) {
    app.get("/api/v1/plugins/items", (c) => this.controller.listItems(c));
    app.get("/api/v1/plugins/items/:slug", (c) => this.controller.getItem(c));
    app.get("/api/v1/plugins/recommendations", (c) => this.controller.listRecommendations(c));
  }
}
