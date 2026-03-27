import api from '@/api/client';

export interface StockTransfer {
  id: string;
  from_pharmacy: string;
  to_pharmacy: string;
  product_name: string;
  quantity: number;
  status: 'pending' | 'completed' | 'cancelled';
  date: string;
}

export const getTransfers = async (): Promise<StockTransfer[]> => {
  const { data } = await api.get('/transfers');
  return data;
};