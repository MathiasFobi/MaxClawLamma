import { api } from './client';
import type {
  MarketplaceInstallRequest,
  MarketplaceInstallResult,
  MarketplaceInstalledView,
  MarketplaceItemType,
  MarketplaceItemView,
  MarketplaceListView,
  MarketplaceRecommendationView,
  MarketplaceSort
} from './types';

export type MarketplaceListParams = {
  q?: string;
  type?: MarketplaceItemType;
  tag?: string;
  sort?: MarketplaceSort;
  page?: number;
  pageSize?: number;
};

export async function fetchMarketplaceItems(params: MarketplaceListParams = {}): Promise<MarketplaceListView> {
  const query = new URLSearchParams();

  if (params.q?.trim()) {
    query.set('q', params.q.trim());
  }
  if (params.type) {
    query.set('type', params.type);
  }
  if (params.tag?.trim()) {
    query.set('tag', params.tag.trim());
  }
  if (params.sort) {
    query.set('sort', params.sort);
  }
  if (typeof params.page === 'number' && Number.isFinite(params.page)) {
    query.set('page', String(Math.max(1, Math.trunc(params.page))));
  }
  if (typeof params.pageSize === 'number' && Number.isFinite(params.pageSize)) {
    query.set('pageSize', String(Math.max(1, Math.trunc(params.pageSize))));
  }

  const suffix = query.toString();
  const response = await api.get<MarketplaceListView>(suffix ? `/api/marketplace/items?${suffix}` : '/api/marketplace/items');
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function fetchMarketplaceItem(slug: string, type?: MarketplaceItemType): Promise<MarketplaceItemView> {
  const query = new URLSearchParams();
  if (type) {
    query.set('type', type);
  }

  const suffix = query.toString();
  const response = await api.get<MarketplaceItemView>(
    suffix
      ? `/api/marketplace/items/${encodeURIComponent(slug)}?${suffix}`
      : `/api/marketplace/items/${encodeURIComponent(slug)}`
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function fetchMarketplaceRecommendations(params: {
  scene?: string;
  limit?: number;
} = {}): Promise<MarketplaceRecommendationView> {
  const query = new URLSearchParams();
  if (params.scene?.trim()) {
    query.set('scene', params.scene.trim());
  }
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) {
    query.set('limit', String(Math.max(1, Math.trunc(params.limit))));
  }

  const suffix = query.toString();
  const response = await api.get<MarketplaceRecommendationView>(
    suffix ? `/api/marketplace/recommendations?${suffix}` : '/api/marketplace/recommendations'
  );
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function installMarketplaceItem(request: MarketplaceInstallRequest): Promise<MarketplaceInstallResult> {
  const response = await api.post<MarketplaceInstallResult>('/api/marketplace/install', request);
  if (!response.ok) {
    throw new Error(response.error.message);
  }

  return response.data;
}

export async function fetchMarketplaceInstalled(): Promise<MarketplaceInstalledView> {
  const response = await api.get<MarketplaceInstalledView>('/api/marketplace/installed');
  if (!response.ok) {
    throw new Error(response.error.message);
  }
  return response.data;
}
