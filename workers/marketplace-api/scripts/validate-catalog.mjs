import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function fail(message) {
  throw new Error(message);
}

function expectNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function expectDateTime(value, path) {
  const text = expectNonEmptyString(value, path);
  if (Number.isNaN(Date.parse(text))) {
    fail(`${path} must be a valid datetime string`);
  }
  return text;
}

function expectStringArray(value, path) {
  if (!Array.isArray(value)) {
    fail(`${path} must be an array`);
  }
  return value.map((entry, index) => expectNonEmptyString(entry, `${path}[${index}]`));
}

function expectObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value;
}

function readJson(filePath, label) {
  const raw = readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`${label} is not valid JSON: ${String(error)}`);
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const pluginsCatalogPath = resolve(scriptDir, "../data/plugins-catalog.json");
const skillsCatalogPath = resolve(scriptDir, "../data/skills-catalog.json");

const pluginsCatalog = readJson(pluginsCatalogPath, "plugins-catalog.json");
const skillsCatalog = readJson(skillsCatalogPath, "skills-catalog.json");

const supportedKinds = new Set(["npm", "clawhub", "git", "builtin"]);
const seenGlobalIds = new Set();
const seenGlobalSlugs = new Set();
const seenGlobalSpecs = new Set();

function validateCatalog(catalog, label, expectedType) {
  const root = expectObject(catalog, label);

  const version = expectNonEmptyString(root.version, `${label}.version`);
  const generatedAt = expectDateTime(root.generatedAt, `${label}.generatedAt`);

  if (!Array.isArray(root.items)) {
    fail(`${label}.items must be an array`);
  }
  if (!Array.isArray(root.recommendations)) {
    fail(`${label}.recommendations must be an array`);
  }

  const sectionItemIds = new Set();
  const sectionRecommendationIds = new Set();

  for (let index = 0; index < root.items.length; index += 1) {
    const item = root.items[index];
    const path = `${label}.items[${index}]`;
    expectObject(item, path);

    const id = expectNonEmptyString(item.id, `${path}.id`);
    const slug = expectNonEmptyString(item.slug, `${path}.slug`);
    const type = expectNonEmptyString(item.type, `${path}.type`);
    if (type !== expectedType) {
      fail(`${path}.type must be ${expectedType}`);
    }

    expectNonEmptyString(item.name, `${path}.name`);
    expectNonEmptyString(item.summary, `${path}.summary`);
    expectStringArray(item.tags, `${path}.tags`);
    expectNonEmptyString(item.author, `${path}.author`);
    expectDateTime(item.publishedAt, `${path}.publishedAt`);
    expectDateTime(item.updatedAt, `${path}.updatedAt`);

    if (seenGlobalIds.has(id)) {
      fail(`${path}.id duplicates with ${id}`);
    }
    seenGlobalIds.add(id);
    sectionItemIds.add(id);

    if (seenGlobalSlugs.has(slug)) {
      fail(`${path}.slug duplicates with ${slug}`);
    }
    seenGlobalSlugs.add(slug);

    const install = expectObject(item.install, `${path}.install`);
    const kind = expectNonEmptyString(install.kind, `${path}.install.kind`);
    if (!supportedKinds.has(kind)) {
      fail(`${path}.install.kind is invalid`);
    }

    const spec = expectNonEmptyString(install.spec, `${path}.install.spec`);
    expectNonEmptyString(install.command, `${path}.install.command`);

    const specKey = `${type}:${kind}:${spec}`.toLowerCase();
    if (seenGlobalSpecs.has(specKey)) {
      fail(`${path}.install.spec duplicates with ${type}/${kind}/${spec}`);
    }
    seenGlobalSpecs.add(specKey);
  }

  for (let index = 0; index < root.recommendations.length; index += 1) {
    const recommendation = root.recommendations[index];
    const path = `${label}.recommendations[${index}]`;
    expectObject(recommendation, path);

    const recommendationId = expectNonEmptyString(recommendation.id, `${path}.id`);
    if (sectionRecommendationIds.has(recommendationId)) {
      fail(`${path}.id duplicates with ${recommendationId}`);
    }
    sectionRecommendationIds.add(recommendationId);

    expectNonEmptyString(recommendation.title, `${path}.title`);
    const itemIds = expectStringArray(recommendation.itemIds, `${path}.itemIds`);
    for (const itemId of itemIds) {
      if (!sectionItemIds.has(itemId)) {
        fail(`${path}.itemIds contains unknown ${expectedType} item id: ${itemId}`);
      }
    }
  }

  return {
    version,
    generatedAt,
    items: root.items.length,
    recommendations: root.recommendations.length
  };
}

const pluginStats = validateCatalog(pluginsCatalog, "plugins-catalog", "plugin");
const skillStats = validateCatalog(skillsCatalog, "skills-catalog", "skill");

console.log(
  `catalog validation passed: plugins=${pluginStats.version}/${pluginStats.items}/${pluginStats.recommendations}, skills=${skillStats.version}/${skillStats.items}/${skillStats.recommendations}`
);
