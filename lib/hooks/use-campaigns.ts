import { useState, useCallback } from 'react';
import { useSWRConfig } from 'swr';
import useSWRMutation from 'swr/mutation';
import { campaignsApi, type Campaign } from '../api-client';

export interface CampaignFilters {
  status?: 'draft' | 'active' | 'completed' | 'paused';
  search?: string;
  sortBy?: 'created_at' | 'updated_at' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationState {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function useCampaigns() {
  const { mutate: globalMutate } = useSWRConfig();
  const [filters, setFilters] = useState<CampaignFilters>({});
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
  });

  // --- Filter Management ---
  const updateFilters = useCallback((newFilters: Partial<CampaignFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    // Reset to page 1 when filters change
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPagination((prev) => ({ ...prev, currentPage: 1 }));
  }, []);

  // --- Pagination Management ---
  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: Math.max(1, Math.min(page, prev.totalPages)),
    }));
  }, []);

  const nextPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      currentPage: Math.min(prev.currentPage + 1, prev.totalPages),
    }));
  }, []);

  const previousPage = useCallback(() => {
    setPagination((prev) => ({
      ...prev,
      currentPage: Math.max(prev.currentPage - 1, 1),
    }));
  }, []);

  // --- Create Campaign Mutation ---
  const createCampaignMutation = useSWRMutation(
    '/campaigns',
    async (_key, { arg }: { arg: { name: string; brand_id: string } }) => {
      const response = await campaignsApi.create(arg);
      return response.data.data;
    },
    {
      onSuccess: () => {
        // Revalidate campaigns list
        globalMutate((key) => typeof key === 'string' && key.startsWith('/campaigns'));
      },
    }
  );

  // --- Update Campaign Mutation ---
  const updateCampaignMutation = useSWRMutation(
    '/campaigns/update',
    async (_key, { arg }: { arg: { campaignId: string; data: Partial<Campaign> } }) => {
      const response = await campaignsApi.update(arg.campaignId, arg.data);
      return response.data.data;
    },
    {
      onSuccess: (data) => {
        // Revalidate specific campaign and list
        globalMutate(`/campaigns/${data.id}`);
        globalMutate((key) => typeof key === 'string' && key.startsWith('/campaigns'));
      },
    }
  );

  // --- Delete Campaign Mutation ---
  const deleteCampaignMutation = useSWRMutation(
    '/campaigns/delete',
    async (_key, { arg }: { arg: string }) => {
      const response = await campaignsApi.delete(arg);
      return response.data.data;
    },
    {
      onSuccess: () => {
        // Revalidate campaigns list
        globalMutate((key) => typeof key === 'string' && key.startsWith('/campaigns'));
      },
    }
  );

  return {
    // Filter state
    filters,
    updateFilters,
    clearFilters,
    hasActiveFilters: Object.keys(filters).length > 0,

    // Pagination state
    pagination,
    goToPage,
    nextPage,
    previousPage,
    canGoNext: pagination.currentPage < pagination.totalPages,
    canGoPrevious: pagination.currentPage > 1,

    // Mutations
    createCampaign: createCampaignMutation.trigger,
    updateCampaign: updateCampaignMutation.trigger,
    deleteCampaign: deleteCampaignMutation.trigger,

    // Loading states
    isCreating: createCampaignMutation.isMutating,
    isUpdating: updateCampaignMutation.isMutating,
    isDeleting: deleteCampaignMutation.isMutating,
  };
}
