import pluginsCatalog from "../../data/plugins-catalog.json";
import skillsCatalog from "../../data/skills-catalog.json";
import { DomainValidationError } from "../domain/errors";
import type {
  MarketplaceCatalogSection,
  MarketplaceCatalogSnapshot,
  MarketplaceInstallSpec,
  MarketplaceItem,
  MarketplaceItemType,
  MarketplaceRecommendationScene
} from "../domain/model";
import { BaseMarketplaceDataSource } from "./data-source";

type RawRecord = Record<string, unknown>;
type SplitCatalogSnapshot = {
  version: string;
  generatedAt: string;
  section: MarketplaceCatalogSection;
};

export class BundledMarketplaceDataSource extends BaseMarketplaceDataSource {
  async loadSnapshot(): Promise<MarketplaceCatalogSnapshot> {
    const plugins = this.parseSplitCatalog(pluginsCatalog as unknown, "plugins-catalog", "plugin");
    const skills = this.parseSplitCatalog(skillsCatalog as unknown, "skills-catalog", "skill");

    return {
      version: this.buildVersion(plugins.version, skills.version),
      generatedAt: this.pickLatestGeneratedAt(plugins.generatedAt, skills.generatedAt),
      plugins: plugins.section,
      skills: skills.section
    };
  }

  private parseSplitCatalog(
    raw: unknown,
    name: "plugins-catalog" | "skills-catalog",
    expectedType: MarketplaceItemType
  ): SplitCatalogSnapshot {
    if (!this.isRawRecord(raw)) {
      throw new DomainValidationError(`${name} root must be an object`);
    }

    const version = this.readString(raw.version, `${name}.version`);
    const generatedAt = this.readDateTime(raw.generatedAt, `${name}.generatedAt`);
    const section = this.parseSection(raw, name, expectedType);

    return {
      version,
      generatedAt,
      section
    };
  }

  private parseSection(
    value: RawRecord,
    path: string,
    expectedType: MarketplaceItemType
  ): MarketplaceCatalogSection {
    const items = this.parseItems(value.items, `${path}.items`, expectedType);
    const itemIds = new Set(items.map((item) => item.id));
    const recommendations = this.parseRecommendations(value.recommendations, `${path}.recommendations`, itemIds);

    return {
      items,
      recommendations
    };
  }

  private parseItems(value: unknown, path: string, expectedType: MarketplaceItemType): MarketplaceItem[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return value.map((entry, index) => this.parseItem(entry, `${path}[${index}]`, expectedType));
  }

  private parseItem(raw: unknown, path: string, expectedType: MarketplaceItemType): MarketplaceItem {
    if (!this.isRawRecord(raw)) {
      throw new DomainValidationError(`${path} must be an object`);
    }

    const rawType = this.readString(raw.type, `${path}.type`);
    if (rawType !== expectedType) {
      throw new DomainValidationError(`${path}.type must be ${expectedType}`);
    }
    const type = expectedType;

    return {
      id: this.readString(raw.id, `${path}.id`),
      slug: this.readString(raw.slug, `${path}.slug`),
      type,
      name: this.readString(raw.name, `${path}.name`),
      summary: this.readString(raw.summary, `${path}.summary`),
      description: this.readOptionalString(raw.description, `${path}.description`),
      tags: this.readStringArray(raw.tags, `${path}.tags`),
      author: this.readString(raw.author, `${path}.author`),
      sourceRepo: this.readOptionalString(raw.sourceRepo, `${path}.sourceRepo`),
      homepage: this.readOptionalString(raw.homepage, `${path}.homepage`),
      install: this.parseInstallSpec(raw.install, `${path}.install`),
      publishedAt: this.readString(raw.publishedAt, `${path}.publishedAt`),
      updatedAt: this.readString(raw.updatedAt, `${path}.updatedAt`)
    };
  }

  private parseInstallSpec(value: unknown, path: string): MarketplaceInstallSpec {
    if (!this.isRawRecord(value)) {
      throw new DomainValidationError(`${path} must be an object`);
    }

    const rawKind = this.readString(value.kind, `${path}.kind`);
    if (!["npm", "clawhub", "git", "builtin"].includes(rawKind)) {
      throw new DomainValidationError(`${path}.kind is invalid`);
    }
    const kind = rawKind as "npm" | "clawhub" | "git" | "builtin";

    return {
      kind,
      spec: this.readString(value.spec, `${path}.spec`),
      command: this.readString(value.command, `${path}.command`)
    };
  }

  private parseRecommendations(
    value: unknown,
    path: string,
    itemIds: Set<string>
  ): MarketplaceRecommendationScene[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return value.map((entry, index) => {
      if (!this.isRawRecord(entry)) {
        throw new DomainValidationError(`${path}[${index}] must be an object`);
      }

      const recommendation = {
        id: this.readString(entry.id, `${path}[${index}].id`),
        title: this.readString(entry.title, `${path}[${index}].title`),
        description: this.readOptionalString(entry.description, `${path}[${index}].description`),
        itemIds: this.readStringArray(entry.itemIds, `${path}[${index}].itemIds`)
      };

      for (const itemId of recommendation.itemIds) {
        if (!itemIds.has(itemId)) {
          throw new DomainValidationError(`${path}[${index}].itemIds contains unknown item id: ${itemId}`);
        }
      }

      return recommendation;
    });
  }

  private buildVersion(pluginVersion: string, skillVersion: string): string {
    if (pluginVersion === skillVersion) {
      return pluginVersion;
    }

    return `plugins@${pluginVersion}|skills@${skillVersion}`;
  }

  private pickLatestGeneratedAt(pluginGeneratedAt: string, skillGeneratedAt: string): string {
    const pluginTs = Date.parse(pluginGeneratedAt);
    const skillTs = Date.parse(skillGeneratedAt);

    return pluginTs >= skillTs ? pluginGeneratedAt : skillGeneratedAt;
  }

  private readDateTime(value: unknown, path: string): string {
    const text = this.readString(value, path);
    if (Number.isNaN(Date.parse(text))) {
      throw new DomainValidationError(`${path} must be a valid datetime string`);
    }
    return text;
  }

  private readString(value: unknown, path: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new DomainValidationError(`${path} must be a non-empty string`);
    }
    return value;
  }

  private readOptionalString(value: unknown, path: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return this.readString(value, path);
  }

  private readStringArray(value: unknown, path: string): string[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError(`${path} must be an array`);
    }

    return value.map((entry, index) => this.readString(entry, `${path}[${index}]`));
  }

  private isRawRecord(value: unknown): value is RawRecord {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
