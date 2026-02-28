import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export const useProductSearch = (query: string) => {
  return useQuery({
    queryKey: ['products-search', query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const { data } = await api.get(`/endpoints/products?search=${query}`);
      return data;
    },
    enabled: query.length >= 2, // Ne cherche qu'à partir de 2 caractères
  });
};