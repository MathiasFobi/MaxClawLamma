import { Hono } from "hono";
import { expandHome } from "@nextclaw/core";
import {
  buildConfigSchemaView,
  buildConfigMeta,
  buildConfigView,
  executeConfigAction,
  loadConfigOrDefault,
  updateChannel,
  updateModel,
  updateProvider,
  updateRuntime,
  listSessions,
  getSessionHistory,
  patchSession,
  deleteSession
} from "./config.js";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  ConfigActionExecuteRequest,
  MarketplaceApiConfig,
  MarketplaceInstalledRecord,
  MarketplaceInstalledView,
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceRecommendationView,
  ProviderConfigUpdate,
  RuntimeConfigUpdate,
  SessionPatchUpdate,
  UiServerEvent
} from "./types.js";

type UiRouterOptions = {
  configPath: string;
  publish: (event: UiServerEvent) => void;
  marketplace?: MarketplaceApiConfig;
};

const DEFAULT_MARKETPLACE_API_BASE = "https://nextclaw-marketplace-api.15353764479037.workers.dev";

function ok<T>(data: T) {
  return { ok: true, data };
}

function err(code: string, message: string, details?: Record<string, unknown>) {
  return { ok: false, error: { code, message, details } };
}

async function readJson<T>(req: Request): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = (await req.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readErrorMessage(value: unknown, fallback: string): string {
  if (!isRecord(value)) {
    return fallback;
  }

  const maybeError = value.error;
  if (!isRecord(maybeError)) {
    return fallback;
  }

  return typeof maybeError.message === "string" && maybeError.message.trim().length > 0
    ? maybeError.message
    : fallback;
}

function normalizeMarketplaceBaseUrl(options: UiRouterOptions): string {
  const fromOptions = options.marketplace?.apiBaseUrl?.trim();
  const fromEnv = process.env.NEXTCLAW_MARKETPLACE_API_BASE?.trim();
  const value = fromOptions || fromEnv || DEFAULT_MARKETPLACE_API_BASE;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function toMarketplaceUrl(baseUrl: string, path: string, query: Record<string, string | undefined> = {}): string {
  const url = new URL(path, `${baseUrl}/`);
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string" && value.trim().length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function fetchMarketplaceData<T>(params: {
  baseUrl: string;
  path: string;
  query?: Record<string, string | undefined>;
}): Promise<{ ok: true; data: T } | { ok: false; status: number; message: string }> {
  const url = toMarketplaceUrl(params.baseUrl, params.path, params.query ?? {});

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: readErrorMessage(payload, `marketplace request failed: ${response.status}`)
      };
    }

    if (!isRecord(payload) || payload.ok !== true || !Object.prototype.hasOwnProperty.call(payload, "data")) {
      return {
        ok: false,
        status: 502,
        message: "invalid marketplace response"
      };
    }

    return {
      ok: true,
      data: payload.data as T
    };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      message: `marketplace fetch failed: ${String(error)}`
    };
  }
}

function collectMarketplaceInstalledView(options: UiRouterOptions): MarketplaceInstalledView {
  const config = loadConfigOrDefault(options.configPath);
  const pluginRecordsMap = config.plugins.installs ?? {};
  const pluginRecords: MarketplaceInstalledRecord[] = [];
  const pluginSpecSet = new Set<string>();

  for (const [pluginId, installRecord] of Object.entries(pluginRecordsMap)) {
    const normalizedSpec = typeof installRecord.spec === "string" && installRecord.spec.trim().length > 0
      ? installRecord.spec.trim()
      : pluginId;
    pluginRecords.push({
      type: "plugin",
      spec: normalizedSpec,
      label: pluginId,
      source: installRecord.source,
      installedAt: installRecord.installedAt
    });
    pluginSpecSet.add(normalizedSpec);
  }

  const pluginEntries = config.plugins.entries ?? {};
  for (const pluginId of Object.keys(pluginEntries)) {
    if (!pluginSpecSet.has(pluginId)) {
      pluginRecords.push({
        type: "plugin",
        spec: pluginId,
        label: pluginId,
        source: "config"
      });
      pluginSpecSet.add(pluginId);
    }
  }

  const workspacePath = resolve(expandHome(config.agents.defaults.workspace));
  const skillsPath = join(workspacePath, "skills");
  const skillSpecSet = new Set<string>();
  const skillRecords: MarketplaceInstalledRecord[] = [];

  if (existsSync(skillsPath)) {
    const entries = readdirSync(skillsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillSlug = entry.name;
      const skillFile = join(skillsPath, skillSlug, "SKILL.md");
      if (!existsSync(skillFile)) {
        continue;
      }

      skillRecords.push({
        type: "skill",
        spec: skillSlug,
        label: skillSlug,
        source: "workspace"
      });
      skillSpecSet.add(skillSlug);
    }
  }

  const records: MarketplaceInstalledRecord[] = [...pluginRecords, ...skillRecords].sort((left, right) => {
    if (left.type !== right.type) {
      return left.type.localeCompare(right.type);
    }
    return left.spec.localeCompare(right.spec);
  });

  return {
    total: records.length,
    pluginSpecs: Array.from(pluginSpecSet).sort((left, right) => left.localeCompare(right)),
    skillSpecs: Array.from(skillSpecSet).sort((left, right) => left.localeCompare(right)),
    records
  };
}

async function installMarketplaceItem(params: {
  options: UiRouterOptions;
  body: MarketplaceInstallRequest;
}): Promise<MarketplaceInstallResult> {
  const type = params.body.type;
  const spec = typeof params.body.spec === "string" ? params.body.spec.trim() : "";
  if ((type !== "plugin" && type !== "skill") || !spec) {
    throw new Error("INVALID_BODY:type and non-empty spec are required");
  }

  const installer = params.options.marketplace?.installer;
  if (!installer) {
    throw new Error("NOT_AVAILABLE:marketplace installer is not configured");
  }

  let result: { message: string; output?: string };
  if (type === "plugin") {
    if (!installer.installPlugin) {
      throw new Error("NOT_AVAILABLE:plugin installer is not configured");
    }
    result = await installer.installPlugin(spec);
  } else {
    if (!installer.installSkill) {
      throw new Error("NOT_AVAILABLE:skill installer is not configured");
    }
    result = await installer.installSkill({
      slug: spec,
      version: params.body.version,
      registry: params.body.registry,
      force: params.body.force
    });
  }

  params.options.publish({ type: "config.updated", payload: { path: type === "plugin" ? "plugins" : "skills" } });
  return {
    type,
    spec,
    message: result.message,
    output: result.output
  };
}

function registerMarketplaceRoutes(app: Hono, options: UiRouterOptions, marketplaceBaseUrl: string): void {
  app.get("/api/marketplace/installed", (c) => {
    return c.json(ok(collectMarketplaceInstalledView(options)));
  });

  app.get("/api/marketplace/items", async (c) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceListView>({
      baseUrl: marketplaceBaseUrl,
      path: "/api/v1/items",
      query: {
        q: query.q,
        type: query.type,
        tag: query.tag,
        sort: query.sort,
        page: query.page,
        pageSize: query.pageSize
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    return c.json(ok(result.data));
  });

  app.get("/api/marketplace/items/:slug", async (c) => {
    const slug = encodeURIComponent(c.req.param("slug"));
    const type = c.req.query("type");
    const result = await fetchMarketplaceData<MarketplaceItemView>({
      baseUrl: marketplaceBaseUrl,
      path: `/api/v1/items/${slug}`,
      query: {
        type
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    return c.json(ok(result.data));
  });

  app.get("/api/marketplace/recommendations", async (c) => {
    const query = c.req.query();
    const result = await fetchMarketplaceData<MarketplaceRecommendationView>({
      baseUrl: marketplaceBaseUrl,
      path: "/api/v1/recommendations",
      query: {
        scene: query.scene,
        limit: query.limit
      }
    });

    if (!result.ok) {
      return c.json(err("MARKETPLACE_UNAVAILABLE", result.message), result.status as 500);
    }

    return c.json(ok(result.data));
  });

  app.post("/api/marketplace/install", async (c) => {
    const body = await readJson<MarketplaceInstallRequest>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    try {
      const payload = await installMarketplaceItem({ options, body: body.data });
      return c.json(ok(payload));
    } catch (error) {
      const message = String(error);
      if (message.startsWith("INVALID_BODY:")) {
        return c.json(err("INVALID_BODY", message.slice("INVALID_BODY:".length)), 400);
      }
      if (message.startsWith("NOT_AVAILABLE:")) {
        return c.json(err("NOT_AVAILABLE", message.slice("NOT_AVAILABLE:".length)), 503);
      }
      return c.json(err("INSTALL_FAILED", message), 400);
    }
  });
}

export function createUiRouter(options: UiRouterOptions): Hono {
  const app = new Hono();
  const marketplaceBaseUrl = normalizeMarketplaceBaseUrl(options);

  app.notFound((c) => c.json(err("NOT_FOUND", "endpoint not found"), 404));

  app.get("/api/health", (c) => c.json(ok({ status: "ok" })));

  app.get("/api/config", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigView(config)));
  });

  app.get("/api/config/meta", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigMeta(config)));
  });

  app.get("/api/config/schema", (c) => {
    const config = loadConfigOrDefault(options.configPath);
    return c.json(ok(buildConfigSchemaView(config)));
  });

  app.put("/api/config/model", async (c) => {
    const body = await readJson<{ model?: string; maxTokens?: number }>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }

    const hasModel = typeof body.data.model === "string";
    const hasMaxTokens = typeof body.data.maxTokens === "number";
    if (!hasModel && !hasMaxTokens) {
      return c.json(err("INVALID_BODY", "model or maxTokens is required"), 400);
    }

    const view = updateModel(options.configPath, {
      model: hasModel ? body.data.model : undefined,
      maxTokens: hasMaxTokens ? body.data.maxTokens : undefined
    });

    if (hasModel) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.model" } });
    }
    if (hasMaxTokens) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.maxTokens" } });
    }

    return c.json(ok({
      model: view.agents.defaults.model,
      maxTokens: view.agents.defaults.maxTokens
    }));
  });

  app.put("/api/config/providers/:provider", async (c) => {
    const provider = c.req.param("provider");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateProvider(options.configPath, provider, body.data as ProviderConfigUpdate);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown provider: ${provider}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: `providers.${provider}` } });
    return c.json(ok(result));
  });

  app.put("/api/config/channels/:channel", async (c) => {
    const channel = c.req.param("channel");
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateChannel(options.configPath, channel, body.data);
    if (!result) {
      return c.json(err("NOT_FOUND", `unknown channel: ${channel}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: `channels.${channel}` } });
    return c.json(ok(result));
  });

  app.get("/api/sessions", (c) => {
    const query = c.req.query();
    const q = typeof query.q === "string" ? query.q : undefined;
    const limit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : undefined;
    const activeMinutes =
      typeof query.activeMinutes === "string" ? Number.parseInt(query.activeMinutes, 10) : undefined;
    const data = listSessions(options.configPath, {
      q,
      limit: Number.isFinite(limit) ? limit : undefined,
      activeMinutes: Number.isFinite(activeMinutes) ? activeMinutes : undefined
    });
    return c.json(ok(data));
  });

  app.get("/api/sessions/:key/history", (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const query = c.req.query();
    const limit = typeof query.limit === "string" ? Number.parseInt(query.limit, 10) : undefined;
    const data = getSessionHistory(options.configPath, key, Number.isFinite(limit) ? limit : undefined);
    if (!data) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    return c.json(ok(data));
  });

  app.put("/api/sessions/:key", async (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const body = await readJson<Record<string, unknown>>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const data = patchSession(options.configPath, key, body.data as SessionPatchUpdate);
    if (!data) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(data));
  });

  app.delete("/api/sessions/:key", (c) => {
    const key = decodeURIComponent(c.req.param("key"));
    const deleted = deleteSession(options.configPath, key);
    if (!deleted) {
      return c.json(err("NOT_FOUND", `session not found: ${key}`), 404);
    }
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok({ deleted: true }));
  });

  app.put("/api/config/runtime", async (c) => {
    const body = await readJson<RuntimeConfigUpdate>(c.req.raw);
    if (!body.ok || !body.data || typeof body.data !== "object") {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = updateRuntime(options.configPath, body.data);
    if (body.data.agents?.defaults && Object.prototype.hasOwnProperty.call(body.data.agents.defaults, "contextTokens")) {
      options.publish({ type: "config.updated", payload: { path: "agents.defaults.contextTokens" } });
    }
    options.publish({ type: "config.updated", payload: { path: "agents.list" } });
    options.publish({ type: "config.updated", payload: { path: "bindings" } });
    options.publish({ type: "config.updated", payload: { path: "session" } });
    return c.json(ok(result));
  });

  app.post("/api/config/actions/:actionId/execute", async (c) => {
    const actionId = c.req.param("actionId");
    const body = await readJson<ConfigActionExecuteRequest>(c.req.raw);
    if (!body.ok) {
      return c.json(err("INVALID_BODY", "invalid json body"), 400);
    }
    const result = await executeConfigAction(options.configPath, actionId, body.data ?? {});
    if (!result.ok) {
      return c.json(err(result.code, result.message, result.details), 400);
    }
    return c.json(ok(result.data));
  });

  registerMarketplaceRoutes(app, options, marketplaceBaseUrl);

  return app;
}
