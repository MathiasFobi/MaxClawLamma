import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  fetchMarketplaceItem,
  fetchMarketplaceInstalled,
  fetchMarketplaceItems,
  fetchMarketplaceRecommendations,
  installMarketplaceItem,
  manageMarketplaceItem,
  type MarketplaceListParams
} from '@/api/marketplace';
import type { MarketplaceInstallRequest, MarketplaceItemType, MarketplaceManageRequest } from '@/api/types';

export function useMarketplaceItems(params: MarketplaceListParams) {
  return useQuery({
    queryKey: ['marketplace-items', params],
    queryFn: () => fetchMarketplaceItems(params),
    staleTime: 15_000
  });
}

export function useMarketplaceRecommendations(params: { scene?: string; limit?: number }) {
  return useQuery({
    queryKey: ['marketplace-recommendations', params],
    queryFn: () => fetchMarketplaceRecommendations(params),
    staleTime: 30_000
  });
}

export function useMarketplaceItem(slug: string | null, type?: MarketplaceItemType) {
  return useQuery({
    queryKey: ['marketplace-item', slug, type],
    queryFn: () => fetchMarketplaceItem(slug as string, type),
    enabled: Boolean(slug),
    staleTime: 30_000
  });
}

export function useMarketplaceInstalled() {
  return useQuery({
    queryKey: ['marketplace-installed'],
    queryFn: fetchMarketplaceInstalled,
    staleTime: 10_000
  });
}

export function useInstallMarketplaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MarketplaceInstallRequest) => installMarketplaceItem(request),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-installed'] });
      toast.success(result.message || `${result.type} installed`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Install failed');
    }
  });
}

export function useManageMarketplaceItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: MarketplaceManageRequest) => manageMarketplaceItem(request),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-installed'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-items'] });
      toast.success(result.message || `${result.action} success`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Operation failed');
    }
  });
}
