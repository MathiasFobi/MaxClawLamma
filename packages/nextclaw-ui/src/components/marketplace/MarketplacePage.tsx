import { useEffect, useMemo, useState } from 'react';
import { Download, PackageSearch, Sparkles, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs-custom';
import { useInstallMarketplaceItem, useMarketplaceInstalled, useMarketplaceItems, useMarketplaceRecommendations } from '@/hooks/useMarketplace';
import type { MarketplaceItemSummary, MarketplaceSort } from '@/api/types';

const PAGE_SIZE = 12;

type FilterType = 'all' | 'plugin' | 'skill';
type ScopeType = 'all' | 'installed';

type InstallState = {
  isPending: boolean;
  installingSpec?: string;
};

type InstalledSpecSets = {
  plugin: Set<string>;
  skill: Set<string>;
};

function buildInstalledSpecSets(records: { pluginSpecs: string[]; skillSpecs: string[] } | undefined): InstalledSpecSets {
  return {
    plugin: new Set(records?.pluginSpecs ?? []),
    skill: new Set(records?.skillSpecs ?? [])
  };
}

function isInstalled(item: MarketplaceItemSummary, sets: InstalledSpecSets): boolean {
  return item.type === 'plugin'
    ? sets.plugin.has(item.install.spec)
    : sets.skill.has(item.install.spec);
}

function TypeBadge({ type }: { type: MarketplaceItemSummary['type'] }) {
  return (
    <span
      className={cn(
        'text-[11px] uppercase px-2 py-1 rounded-full font-semibold',
        type === 'plugin' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
      )}
    >
      {type}
    </span>
  );
}

function InstalledBadge() {
  return <span className="text-[11px] px-2 py-1 rounded-full font-semibold bg-indigo-50 text-indigo-600">Installed</span>;
}

function FilterPanel(props: {
  searchText: string;
  typeFilter: FilterType;
  sort: MarketplaceSort;
  onSearchTextChange: (value: string) => void;
  onTypeFilterChange: (value: FilterType) => void;
  onSortChange: (value: MarketplaceSort) => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2 relative">
          <PackageSearch className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={props.searchText}
            onChange={(event) => props.onSearchTextChange(event.target.value)}
            placeholder="Search by name, slug, tags..."
            className="w-full h-10 border border-gray-200 rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-2">
          <select
            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white"
            value={props.typeFilter}
            onChange={(event) => props.onTypeFilterChange(event.target.value as FilterType)}
          >
            <option value="all">All</option>
            <option value="plugin">Plugins</option>
            <option value="skill">Skills</option>
          </select>
          <select
            className="flex-1 h-10 border border-gray-200 rounded-lg px-3 text-sm bg-white"
            value={props.sort}
            onChange={(event) => props.onSortChange(event.target.value as MarketplaceSort)}
          >
            <option value="relevance">Relevance</option>
            <option value="updated">Recently Updated</option>
            <option value="downloads">Downloads</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function InstallButton(props: {
  item: MarketplaceItemSummary;
  installState: InstallState;
  installed: boolean;
  onInstall: (item: MarketplaceItemSummary) => void;
}) {
  const isInstalling = props.installState.isPending && props.installState.installingSpec === props.item.install.spec;

  if (props.installed) {
    return (
      <button
        disabled
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-gray-100 text-gray-500 cursor-not-allowed"
      >
        Installed
      </button>
    );
  }

  return (
    <button
      onClick={() => props.onInstall(props.item)}
      disabled={props.installState.isPending}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold bg-gray-900 text-white hover:bg-black disabled:opacity-50"
    >
      <Download className="h-3.5 w-3.5" />
      {isInstalling ? 'Installing...' : 'Install'}
    </button>
  );
}

function RecommendationSection(props: {
  items: MarketplaceItemSummary[];
  loading: boolean;
  installState: InstallState;
  installedSets: InstalledSpecSets;
  onInstall: (item: MarketplaceItemSummary) => void;
}) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-amber-500" />
        <h3 className="text-[15px] font-bold text-gray-900">Recommended</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {props.items.map((item) => {
          const installed = isInstalled(item, props.installedSets);
          return (
            <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-semibold text-gray-900">{item.name}</div>
                  <div className="text-[12px] text-gray-500 mt-0.5">{item.summary}</div>
                </div>
                <div className="flex items-center gap-2">
                  <TypeBadge type={item.type} />
                  {installed && <InstalledBadge />}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <code className="text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1">{item.install.spec}</code>
                <InstallButton
                  item={item}
                  installed={installed}
                  installState={props.installState}
                  onInstall={props.onInstall}
                />
              </div>
            </div>
          );
        })}

        {props.loading && <div className="text-[13px] text-gray-500">Loading recommendations...</div>}
        {!props.loading && props.items.length === 0 && <div className="text-[13px] text-gray-500">No recommendations yet.</div>}
      </div>
    </section>
  );
}

function MarketplaceItemCard(props: {
  item: MarketplaceItemSummary;
  installState: InstallState;
  installed: boolean;
  onInstall: (item: MarketplaceItemSummary) => void;
}) {
  const downloads = props.item.metrics?.downloads30d;

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[14px] font-semibold text-gray-900">{props.item.name}</h4>
        <div className="flex items-center gap-2">
          <TypeBadge type={props.item.type} />
          {props.installed && <InstalledBadge />}
        </div>
      </div>

      <p className="text-[12px] text-gray-500 mt-1 min-h-10">{props.item.summary}</p>

      <div className="flex flex-wrap gap-1 mt-2">
        {props.item.tags.slice(0, 3).map((tag) => (
          <span key={`${props.item.id}-${tag}`} className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 text-[11px] text-gray-500">By {props.item.author}</div>
      <div className="mt-1 text-[11px] text-gray-500">{downloads ? `${downloads} downloads / 30d` : 'No metrics'}</div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <code className="text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1 truncate">{props.item.install.spec}</code>
        <InstallButton
          item={props.item}
          installed={props.installed}
          installState={props.installState}
          onInstall={props.onInstall}
        />
      </div>
    </article>
  );
}

function PaginationBar(props: {
  page: number;
  totalPages: number;
  busy: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-end gap-2">
      <button
        className="h-8 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 disabled:opacity-40"
        onClick={props.onPrev}
        disabled={props.page <= 1 || props.busy}
      >
        Prev
      </button>
      <div className="text-sm text-gray-600 min-w-20 text-center">
        {props.totalPages === 0 ? '0 / 0' : `${props.page} / ${props.totalPages}`}
      </div>
      <button
        className="h-8 px-3 rounded-lg border border-gray-200 text-sm text-gray-700 disabled:opacity-40"
        onClick={props.onNext}
        disabled={props.totalPages === 0 || props.page >= props.totalPages || props.busy}
      >
        Next
      </button>
    </div>
  );
}

export function MarketplacePage() {
  const [searchText, setSearchText] = useState('');
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<ScopeType>('all');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<MarketplaceSort>('relevance');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(searchText.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchText]);

  const installedQuery = useMarketplaceInstalled();
  const requestPage = scope === 'installed' ? 1 : page;
  const requestPageSize = scope === 'installed' ? 100 : PAGE_SIZE;

  const itemsQuery = useMarketplaceItems({
    q: query || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
    sort,
    page: requestPage,
    pageSize: requestPageSize
  });
  const recommendationsQuery = useMarketplaceRecommendations({ scene: 'default', limit: 4 });
  const installMutation = useInstallMarketplaceItem();

  const installedSets = buildInstalledSpecSets(installedQuery.data);
  const allItems = itemsQuery.data?.items ?? [];
  const items = scope === 'installed'
    ? allItems.filter((item) => isInstalled(item, installedSets))
    : allItems;

  const recommendations = recommendationsQuery.data?.items ?? [];
  const total = scope === 'installed'
    ? items.length
    : (itemsQuery.data?.total ?? 0);
  const totalPages = scope === 'installed' ? 1 : (itemsQuery.data?.totalPages ?? 0);

  const listSummary = useMemo(() => {
    if (!itemsQuery.data) {
      return 'Loading...';
    }
    if (items.length === 0) {
      return scope === 'installed' ? 'No installed items on this page' : 'No results';
    }
    return `Showing ${items.length} / ${total}`;
  }, [items.length, itemsQuery.data, scope, total]);

  const installState: InstallState = {
    isPending: installMutation.isPending,
    installingSpec: installMutation.variables?.spec
  };

  const tabs = [
    { id: 'all', label: 'Marketplace' },
    { id: 'installed', label: 'Installed', count: installedQuery.data?.total ?? 0 }
  ];

  const handleInstall = (item: MarketplaceItemSummary) => {
    if (installMutation.isPending) {
      return;
    }
    installMutation.mutate({ type: item.type, spec: item.install.spec });
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Marketplace</h2>
          <p className="text-[13px] text-gray-500 mt-1">Search, discover and install plugins/skills.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-600 text-xs font-semibold">
          <Store className="h-3.5 w-3.5" />
          Read-only Catalog
        </div>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={scope}
        onChange={(value) => {
          setScope(value as ScopeType);
          setPage(1);
        }}
        className="mb-5"
      />

      <FilterPanel
        searchText={searchText}
        typeFilter={typeFilter}
        sort={sort}
        onSearchTextChange={setSearchText}
        onTypeFilterChange={(value) => {
          setPage(1);
          setTypeFilter(value);
        }}
        onSortChange={(value) => {
          setPage(1);
          setSort(value);
        }}
      />

      <RecommendationSection
        items={recommendations}
        loading={recommendationsQuery.isLoading}
        installState={installState}
        installedSets={installedSets}
        onInstall={handleInstall}
      />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-gray-900">{scope === 'installed' ? 'Installed Items' : 'All Items'}</h3>
          <span className="text-[12px] text-gray-500">{listSummary}</span>
        </div>

        {itemsQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            Failed to load marketplace data: {itemsQuery.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((item) => (
            <MarketplaceItemCard
              key={item.id}
              item={item}
              installed={isInstalled(item, installedSets)}
              installState={installState}
              onInstall={handleInstall}
            />
          ))}
        </div>

        {!itemsQuery.isLoading && !itemsQuery.isError && items.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">No items found.</div>
        )}
      </section>

      {scope === 'all' && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          busy={itemsQuery.isFetching}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => (totalPages > 0 ? Math.min(totalPages, current + 1) : current + 1))}
        />
      )}
    </div>
  );
}
