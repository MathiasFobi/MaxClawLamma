import type { Hono } from "hono";
import type { SkillController } from "./skill-controller";

export class SkillRouter {
  constructor(private readonly controller: SkillController) {}

  register(app: Hono) {
    app.get("/api/v1/skills/items", (c) => this.controller.listItems(c));
    app.get("/api/v1/skills/items/:slug", (c) => this.controller.getItem(c));
    app.get("/api/v1/skills/recommendations", (c) => this.controller.listRecommendations(c));
  }
}
