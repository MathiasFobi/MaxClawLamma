import type { MarketplaceCatalogSection, MarketplaceCatalogSnapshot } from "../domain/model";
import type { PluginRepository } from "../domain/plugin-repository";
import type { MarketplaceDataSource } from "../domain/repository";
import { InMemorySectionRepositoryBase } from "./in-memory-section-repository-base";

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export class InMemoryPluginRepository extends InMemorySectionRepositoryBase implements PluginRepository {
  constructor(dataSource: MarketplaceDataSource, options: RepositoryOptions = {}) {
    super(dataSource, options);
  }

  protected getSection(snapshot: MarketplaceCatalogSnapshot): MarketplaceCatalogSection {
    return snapshot.plugins;
  }

  protected getResultType(): "plugin" {
    return "plugin";
  }
}
