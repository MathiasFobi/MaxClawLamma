import { useEffect, useMemo, useState } from 'react';
import { Download, PackageSearch, Sparkles, Store } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs } from '@/components/ui/tabs-custom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInstallMarketplaceItem, useManageMarketplaceItem, useMarketplaceInstalled, useMarketplaceItems, useMarketplaceRecommendations } from '@/hooks/useMarketplace';
import type { MarketplaceInstalledRecord, MarketplaceItemSummary, MarketplaceManageAction, MarketplaceSort } from '@/api/types';

const PAGE_SIZE = 12;

type FilterType = 'all' | 'plugin' | 'skill';
type ScopeType = 'all' | 'installed';

type InstallState = {
  isPending: boolean;
  installingSpec?: string;
};

type ManageState = {
  isPending: boolean;
  targetId?: string;
  action?: MarketplaceManageAction;
};

type InstalledSpecSets = {
  plugin: Set<string>;
  skill: Set<string>;
};

type InstalledRenderEntry = {
  key: string;
  record: MarketplaceInstalledRecord;
  item?: MarketplaceItemSummary;
};

function normalizeMarketplaceKey(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function toLookupKey(type: MarketplaceItemSummary['type'], value: string | undefined): string {
  const normalized = normalizeMarketplaceKey(value);
  return normalized.length > 0 ? `${type}:${normalized}` : '';
}

function buildInstalledSpecSets(
  records: { pluginSpecs: string[]; skillSpecs: string[]; records: MarketplaceInstalledRecord[] } | undefined
): InstalledSpecSets {
  const plugin = new Set((records?.pluginSpecs ?? []).map((value) => normalizeMarketplaceKey(value)).filter(Boolean));
  const skill = new Set((records?.skillSpecs ?? []).map((value) => normalizeMarketplaceKey(value)).filter(Boolean));

  for (const record of records?.records ?? []) {
    const target = record.type === 'plugin' ? plugin : skill;
    const specKey = normalizeMarketplaceKey(record.spec);
    if (specKey) {
      target.add(specKey);
    }
    const labelKey = normalizeMarketplaceKey(record.label);
    if (labelKey) {
      target.add(labelKey);
    }
    const idKey = normalizeMarketplaceKey(record.id);
    if (idKey) {
      target.add(idKey);
    }
  }

  return { plugin, skill };
}

function isInstalled(item: MarketplaceItemSummary, sets: InstalledSpecSets): boolean {
  const target = item.type === 'plugin' ? sets.plugin : sets.skill;
  const candidateKeys = [item.install.spec, item.slug, item.id].map((value) => normalizeMarketplaceKey(value)).filter(Boolean);
  return candidateKeys.some((key) => target.has(key));
}

function buildCatalogLookup(items: MarketplaceItemSummary[]): Map<string, MarketplaceItemSummary> {
  const lookup = new Map<string, MarketplaceItemSummary>();

  for (const item of items) {
    const candidates = [item.install.spec, item.slug, item.id];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(item.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, item);
    }
  }

  return lookup;
}

function buildInstalledRecordLookup(records: MarketplaceInstalledRecord[]): Map<string, MarketplaceInstalledRecord> {
  const lookup = new Map<string, MarketplaceInstalledRecord>();

  for (const record of records) {
    const candidates = [record.spec, record.label, record.id];
    for (const candidate of candidates) {
      const lookupKey = toLookupKey(record.type, candidate);
      if (!lookupKey || lookup.has(lookupKey)) {
        continue;
      }
      lookup.set(lookupKey, record);
    }
  }

  return lookup;
}

function findCatalogItemForRecord(
  record: MarketplaceInstalledRecord,
  catalogLookup: Map<string, MarketplaceItemSummary>
): MarketplaceItemSummary | undefined {
  const bySpec = catalogLookup.get(toLookupKey(record.type, record.spec));
  if (bySpec) {
    return bySpec;
  }
  const byId = catalogLookup.get(toLookupKey(record.type, record.id));
  if (byId) {
    return byId;
  }
  return catalogLookup.get(toLookupKey(record.type, record.label));
}

function findInstalledRecordForItem(
  item: MarketplaceItemSummary,
  installedRecordLookup: Map<string, MarketplaceInstalledRecord>
): MarketplaceInstalledRecord | undefined {
  const candidates = [item.install.spec, item.slug, item.id];
  for (const candidate of candidates) {
    const lookupKey = toLookupKey(item.type, candidate);
    if (!lookupKey) {
      continue;
    }
    const record = installedRecordLookup.get(lookupKey);
    if (record) {
      return record;
    }
  }
  return undefined;
}

function matchInstalledSearch(
  record: MarketplaceInstalledRecord,
  item: MarketplaceItemSummary | undefined,
  query: string
): boolean {
  const normalizedQuery = normalizeMarketplaceKey(query);
  if (!normalizedQuery) {
    return true;
  }

  const values = [
    record.id,
    record.spec,
    record.label,
    record.source,
    record.runtimeStatus,
    item?.name,
    item?.slug,
    item?.summary,
    ...(item?.tags ?? [])
  ];

  return values
    .map((value) => normalizeMarketplaceKey(value))
    .filter(Boolean)
    .some((value) => value.includes(normalizedQuery));
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

function EnabledStateBadge(props: { enabled?: boolean }) {
  if (props.enabled === undefined) {
    return null;
  }

  return props.enabled
    ? <span className="text-[11px] px-2 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-600">Enabled</span>
    : <span className="text-[11px] px-2 py-1 rounded-full font-semibold bg-amber-50 text-amber-700">Disabled</span>;
}

function RecordActionButtons(props: {
  record: MarketplaceInstalledRecord;
  state: ManageState;
  onAction: (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => void;
}) {
  const targetId = props.record.id || props.record.spec;
  const busyForRecord = props.state.isPending && props.state.targetId === targetId;
  const canToggle = props.record.type === 'plugin';
  const canUninstallPlugin = props.record.type === 'plugin' && props.record.origin !== 'bundled';
  const canUninstallSkill = props.record.type === 'skill' && props.record.source === 'workspace';
  const canUninstall = canUninstallPlugin || canUninstallSkill;

  return (
    <div className="flex items-center gap-2">
      {canToggle && (
        <button
          disabled={props.state.isPending}
          onClick={() => props.onAction(props.record.enabled === false ? 'enable' : 'disable', props.record)}
          className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-semibold border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          {busyForRecord && props.state.action !== 'uninstall'
            ? (props.state.action === 'enable' ? 'Enabling...' : 'Disabling...')
            : (props.record.enabled === false ? 'Enable' : 'Disable')}
        </button>
      )}
      {canUninstall && (
        <button
          disabled={props.state.isPending}
          onClick={() => props.onAction('uninstall', props.record)}
          className="inline-flex items-center h-8 px-3 rounded-lg text-xs font-semibold border border-rose-200 text-rose-600 bg-white hover:bg-rose-50 disabled:opacity-50"
        >
          {busyForRecord && props.state.action === 'uninstall' ? 'Uninstalling...' : 'Uninstall'}
        </button>
      )}
    </div>
  );
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
      <div className="flex gap-3 items-center">
        <div className="flex-1 min-w-0 relative">
          <PackageSearch className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={props.searchText}
            onChange={(event) => props.onSearchTextChange(event.target.value)}
            placeholder="Search by name, slug, tags..."
            className="w-full h-9 border border-gray-200 rounded-lg pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Segmented type filter */}
        <div className="inline-flex h-9 rounded-lg bg-gray-100 p-0.5 shrink-0">
          {([
            { value: 'all', label: 'All' },
            { value: 'plugin', label: 'Plugins' },
            { value: 'skill', label: 'Skills' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => props.onTypeFilterChange(opt.value)}
              className={cn(
                'px-3 rounded-md text-sm font-medium transition-all whitespace-nowrap',
                props.typeFilter === opt.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Select value={props.sort} onValueChange={(v) => props.onSortChange(v as MarketplaceSort)}>
          <SelectTrigger className="h-9 w-[150px] shrink-0 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">Relevance</SelectItem>
            <SelectItem value="updated">Recently Updated</SelectItem>
          </SelectContent>
        </Select>
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
  installedRecord?: MarketplaceInstalledRecord;
  installState: InstallState;
  manageState: ManageState;
  installed: boolean;
  onInstall: (item: MarketplaceItemSummary) => void;
  onManage: (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => void;
}) {
  return (
    <article className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[14px] font-semibold text-gray-900">{props.item.name}</h4>
        <div className="flex items-center gap-2">
          <TypeBadge type={props.item.type} />
          {props.installed && <InstalledBadge />}
          {props.installed && <EnabledStateBadge enabled={props.installedRecord?.enabled} />}
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

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <code className="text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1 truncate">{props.item.install.spec}</code>
        {props.installed && props.installedRecord ? (
          <RecordActionButtons
            record={props.installedRecord}
            state={props.manageState}
            onAction={props.onManage}
          />
        ) : (
          <InstallButton
            item={props.item}
            installed={props.installed}
            installState={props.installState}
            onInstall={props.onInstall}
          />
        )}
      </div>
    </article>
  );
}

function InstalledRecordCard(props: {
  record: MarketplaceInstalledRecord;
  manageState: ManageState;
  onManage: (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => void;
}) {
  const installedAt = props.record.installedAt ? new Date(props.record.installedAt).toLocaleString() : undefined;
  const sourceHint = props.record.source ? `source: ${props.record.source}` : undefined;

  return (
    <article className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow" title={sourceHint}>
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[14px] font-semibold text-gray-900">{props.record.label || props.record.spec}</h4>
        <div className="flex items-center gap-2">
          <TypeBadge type={props.record.type} />
          <InstalledBadge />
          <EnabledStateBadge enabled={props.record.enabled} />
        </div>
      </div>

      <p className="text-[12px] text-gray-500 mt-1 min-h-10">Installed locally. This item is not in the current marketplace catalog.</p>

      <div className="flex flex-wrap gap-1 mt-2">
        {installedAt && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{installedAt}</span>}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <code className="text-[11px] text-gray-500 bg-gray-100 rounded px-2 py-1 truncate" title={sourceHint}>{props.record.spec}</code>
        <RecordActionButtons
          record={props.record}
          state={props.manageState}
          onAction={props.onManage}
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

  const itemsQuery = useMarketplaceItems({
    q: query || undefined,
    type: typeFilter === 'all' ? undefined : typeFilter,
    sort,
    page,
    pageSize: PAGE_SIZE
  });
  const recommendationsQuery = useMarketplaceRecommendations({ scene: 'default', limit: 4 });
  const installMutation = useInstallMarketplaceItem();
  const manageMutation = useManageMarketplaceItem();

  const installedRecords = useMemo(
    () => installedQuery.data?.records ?? [],
    [installedQuery.data?.records]
  );
  const installedSets = buildInstalledSpecSets(installedQuery.data);
  const installedRecordLookup = useMemo(
    () => buildInstalledRecordLookup(installedRecords),
    [installedRecords]
  );
  const allItems = useMemo(
    () => itemsQuery.data?.items ?? [],
    [itemsQuery.data?.items]
  );
  const recommendations = useMemo(
    () => recommendationsQuery.data?.items ?? [],
    [recommendationsQuery.data?.items]
  );

  const catalogLookup = useMemo(
    () => buildCatalogLookup([...allItems, ...recommendations]),
    [allItems, recommendations]
  );

  const installedEntries = useMemo<InstalledRenderEntry[]>(() => {
    const entries = installedRecords
      .filter((record) => (typeFilter === 'all' ? true : record.type === typeFilter))
      .map((record) => {
        const item = findCatalogItemForRecord(record, catalogLookup);
        return {
          key: `${record.type}:${record.spec}:${record.label ?? ''}`,
          record,
          item
        };
      })
      .filter((entry) => matchInstalledSearch(entry.record, entry.item, query));

    entries.sort((left, right) => {
      const leftTs = left.record.installedAt ? Date.parse(left.record.installedAt) : Number.NaN;
      const rightTs = right.record.installedAt ? Date.parse(right.record.installedAt) : Number.NaN;
      const leftValid = !Number.isNaN(leftTs);
      const rightValid = !Number.isNaN(rightTs);

      if (leftValid && rightValid && leftTs !== rightTs) {
        return rightTs - leftTs;
      }

      return left.record.spec.localeCompare(right.record.spec);
    });

    return entries;
  }, [installedRecords, typeFilter, catalogLookup, query]);

  const total = scope === 'installed'
    ? installedEntries.length
    : (itemsQuery.data?.total ?? 0);
  const totalPages = scope === 'installed' ? 1 : (itemsQuery.data?.totalPages ?? 0);

  const listSummary = useMemo(() => {
    if (scope === 'installed') {
      if (installedQuery.isLoading) {
        return 'Loading...';
      }
      if (installedEntries.length === 0) {
        return 'No installed items';
      }
      const installedTotal = installedQuery.data?.total ?? installedEntries.length;
      return `Showing ${installedEntries.length} / ${installedTotal}`;
    }

    if (!itemsQuery.data) {
      return 'Loading...';
    }
    if (allItems.length === 0) {
      return 'No results';
    }
    return `Showing ${allItems.length} / ${total}`;
  }, [scope, installedQuery.isLoading, installedQuery.data, installedEntries.length, itemsQuery.data, allItems.length, total]);

  const installState: InstallState = {
    isPending: installMutation.isPending,
    installingSpec: installMutation.variables?.spec
  };

  const manageState: ManageState = {
    isPending: manageMutation.isPending,
    targetId: manageMutation.variables?.id || manageMutation.variables?.spec,
    action: manageMutation.variables?.action
  };

  const tabs = [
    { id: 'all', label: 'Marketplace' },
    { id: 'installed', label: 'Installed', count: installedQuery.data?.total ?? 0 }
  ];

  const handleInstall = (item: MarketplaceItemSummary) => {
    if (installMutation.isPending) {
      return;
    }
    installMutation.mutate({ type: item.type, spec: item.install.spec, kind: item.install.kind });
  };

  const handleManage = (action: MarketplaceManageAction, record: MarketplaceInstalledRecord) => {
    if (manageMutation.isPending) {
      return;
    }

    const targetId = record.id || record.spec;
    if (!targetId) {
      return;
    }

    if (action === 'uninstall') {
      const confirmed = window.confirm(`Confirm ${action} ${targetId}?`);
      if (!confirmed) {
        return;
      }
    }

    manageMutation.mutate({
      type: record.type,
      action,
      id: targetId,
      spec: record.spec
    });
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

      {scope === 'all' && (
        <RecommendationSection
          items={recommendations}
          loading={recommendationsQuery.isLoading}
          installState={installState}
          installedSets={installedSets}
          onInstall={handleInstall}
        />
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[15px] font-bold text-gray-900">{scope === 'installed' ? 'Installed Items' : 'All Items'}</h3>
          <span className="text-[12px] text-gray-500">{listSummary}</span>
        </div>

        {scope === 'all' && itemsQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            Failed to load marketplace data: {itemsQuery.error.message}
          </div>
        )}
        {scope === 'installed' && installedQuery.isError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
            Failed to load installed items: {installedQuery.error.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {scope === 'all' && allItems.map((item) => (
            <MarketplaceItemCard
              key={item.id}
              item={item}
              installedRecord={findInstalledRecordForItem(item, installedRecordLookup)}
              installed={isInstalled(item, installedSets)}
              installState={installState}
              manageState={manageState}
              onInstall={handleInstall}
              onManage={handleManage}
            />
          ))}

          {scope === 'installed' && installedEntries.map((entry) => (
            entry.item
              ? (
                <MarketplaceItemCard
                  key={`catalog:${entry.key}:${entry.item.id}`}
                  item={entry.item}
                  installedRecord={entry.record}
                  installed
                  installState={installState}
                  manageState={manageState}
                  onInstall={handleInstall}
                  onManage={handleManage}
                />
              )
              : <InstalledRecordCard key={`local:${entry.key}`} record={entry.record} manageState={manageState} onManage={handleManage} />
          ))}
        </div>

        {scope === 'all' && !itemsQuery.isLoading && !itemsQuery.isError && allItems.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">No items found.</div>
        )}
        {scope === 'installed' && !installedQuery.isLoading && !installedQuery.isError && installedEntries.length === 0 && (
          <div className="text-[13px] text-gray-500 py-8 text-center">No installed items found.</div>
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
