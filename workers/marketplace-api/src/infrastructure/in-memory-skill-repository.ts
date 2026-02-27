import type { MarketplaceCatalogSection, MarketplaceCatalogSnapshot } from "../domain/model";
import type { MarketplaceDataSource } from "../domain/repository";
import type { SkillRepository } from "../domain/skill-repository";
import { InMemorySectionRepositoryBase } from "./in-memory-section-repository-base";

type RepositoryOptions = {
  cacheTtlMs?: number;
};

export class InMemorySkillRepository extends InMemorySectionRepositoryBase implements SkillRepository {
  constructor(dataSource: MarketplaceDataSource, options: RepositoryOptions = {}) {
    super(dataSource, options);
  }

  protected getSection(snapshot: MarketplaceCatalogSnapshot): MarketplaceCatalogSection {
    return snapshot.skills;
  }

  protected getResultType(): "skill" {
    return "skill";
  }
}
