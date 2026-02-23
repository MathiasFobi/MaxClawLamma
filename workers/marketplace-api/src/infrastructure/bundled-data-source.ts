import catalog from "../../data/catalog.json";
import { DomainValidationError } from "../domain/errors";
import type {
  MarketplaceCatalogSnapshot,
  MarketplaceInstallSpec,
  MarketplaceItem,
  MarketplaceRecommendationScene
} from "../domain/model";
import { MARKETPLACE_ITEM_TYPES } from "../domain/model";
import { BaseMarketplaceDataSource } from "./data-source";

type RawRecord = Record<string, unknown>;

export class BundledMarketplaceDataSource extends BaseMarketplaceDataSource {
  async loadSnapshot(): Promise<MarketplaceCatalogSnapshot> {
    return this.parseCatalog(catalog as unknown);
  }

  private parseCatalog(raw: unknown): MarketplaceCatalogSnapshot {
    if (!this.isRawRecord(raw)) {
      throw new DomainValidationError("catalog root must be an object");
    }

    const version = this.readString(raw.version, "catalog.version");
    const generatedAt = this.readString(raw.generatedAt, "catalog.generatedAt");
    const items = this.parseItems(raw.items);
    const recommendations = this.parseRecommendations(raw.recommendations);

    return {
      version,
      generatedAt,
      items,
      recommendations
    };
  }

  private parseItems(value: unknown): MarketplaceItem[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError("catalog.items must be an array");
    }

    return value.map((entry, index) => this.parseItem(entry, index));
  }

  private parseItem(raw: unknown, index: number): MarketplaceItem {
    if (!this.isRawRecord(raw)) {
      throw new DomainValidationError(`catalog.items[${index}] must be an object`);
    }

    const rawType = this.readString(raw.type, `catalog.items[${index}].type`);
    if (!MARKETPLACE_ITEM_TYPES.includes(rawType as (typeof MARKETPLACE_ITEM_TYPES)[number])) {
      throw new DomainValidationError(`catalog.items[${index}].type is invalid`);
    }
    const type = rawType as (typeof MARKETPLACE_ITEM_TYPES)[number];

    return {
      id: this.readString(raw.id, `catalog.items[${index}].id`),
      slug: this.readString(raw.slug, `catalog.items[${index}].slug`),
      type,
      name: this.readString(raw.name, `catalog.items[${index}].name`),
      summary: this.readString(raw.summary, `catalog.items[${index}].summary`),
      description: this.readOptionalString(raw.description, `catalog.items[${index}].description`),
      tags: this.readStringArray(raw.tags, `catalog.items[${index}].tags`),
      author: this.readString(raw.author, `catalog.items[${index}].author`),
      sourceRepo: this.readOptionalString(raw.sourceRepo, `catalog.items[${index}].sourceRepo`),
      homepage: this.readOptionalString(raw.homepage, `catalog.items[${index}].homepage`),
      install: this.parseInstallSpec(raw.install, index),
      publishedAt: this.readString(raw.publishedAt, `catalog.items[${index}].publishedAt`),
      updatedAt: this.readString(raw.updatedAt, `catalog.items[${index}].updatedAt`)
    };
  }

  private parseInstallSpec(value: unknown, index: number): MarketplaceInstallSpec {
    if (!this.isRawRecord(value)) {
      throw new DomainValidationError(`catalog.items[${index}].install must be an object`);
    }

    const rawKind = this.readString(value.kind, `catalog.items[${index}].install.kind`);
    if (!["npm", "clawhub", "git", "builtin"].includes(rawKind)) {
      throw new DomainValidationError(`catalog.items[${index}].install.kind is invalid`);
    }
    const kind = rawKind as "npm" | "clawhub" | "git" | "builtin";

    return {
      kind,
      spec: this.readString(value.spec, `catalog.items[${index}].install.spec`),
      command: this.readString(value.command, `catalog.items[${index}].install.command`)
    };
  }

  private parseRecommendations(value: unknown): MarketplaceRecommendationScene[] {
    if (!Array.isArray(value)) {
      throw new DomainValidationError("catalog.recommendations must be an array");
    }

    return value.map((entry, index) => {
      if (!this.isRawRecord(entry)) {
        throw new DomainValidationError(`catalog.recommendations[${index}] must be an object`);
      }

      return {
        id: this.readString(entry.id, `catalog.recommendations[${index}].id`),
        title: this.readString(entry.title, `catalog.recommendations[${index}].title`),
        description: this.readOptionalString(entry.description, `catalog.recommendations[${index}].description`),
        itemIds: this.readStringArray(entry.itemIds, `catalog.recommendations[${index}].itemIds`)
      };
    });
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
