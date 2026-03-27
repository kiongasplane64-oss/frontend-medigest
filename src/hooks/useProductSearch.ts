// hooks/useProductSearch.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventoryService';
import type { Product, ProductListResponse } from '@/types/inventory.types';

interface UseProductSearchOptions {
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  onSuccess?: (data: ProductListResponse) => void;
  onError?: (error: Error) => void;
}

interface UseProductSearchReturn {
  products: Product[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  total: number;
  hasMore: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
  search: (query: string) => void;
  currentQuery: string;
}

export const useProductSearch = (
  query: string,
  options: UseProductSearchOptions = {}
): UseProductSearchReturn => {
  const queryClient = useQueryClient();
  const {
    enabled = true,
    staleTime = 60000, // 1 minute
    cacheTime = 300000, // 5 minutes
    onSuccess,
    onError,
  } = options;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['products-search', query],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return { products: [], total: 0, page: 1, limit: 0 };
      }
      
      try {
        const response = await inventoryService.getProducts({
          search: query,
          limit: 50,
          include_sales_stats: true,
        });
        return response;
      } catch (err) {
        console.error('Erreur lors de la recherche de produits:', err);
        throw err;
      }
    },
    enabled: enabled && query.length >= 2,
    staleTime,
    gcTime: cacheTime,
    retry: 1,
  });

  // Exécuter les callbacks
  if (data && onSuccess) {
    onSuccess(data);
  }
  
  if (isError && error instanceof Error && onError) {
    onError(error);
  }

  const products = data?.products || [];
  const total = data?.total || 0;
  const hasMore = products.length < total;

  const fetchNextPage = () => {
    if (hasMore && !isLoading) {
      // Implémentation de la pagination si nécessaire
      // À compléter selon les besoins
    }
  };

  const search = (newQuery: string) => {
    // Invalider le cache existant avec la nouvelle requête
    queryClient.invalidateQueries({ queryKey: ['products-search', newQuery] });
  };

  return {
    products,
    isLoading,
    isError,
    error: error instanceof Error ? error : null,
    total,
    hasMore,
    fetchNextPage,
    refetch,
    search,
    currentQuery: query,
  };
};

export default useProductSearch;