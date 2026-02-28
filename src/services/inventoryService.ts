import api from '@/api/client';

export interface Transfer {
  id: string;
  reference: string;
  source_depot: string;
  destination_depot: string;
  date_transfert: string;
  items_count: number;
  status: 'pending' | 'shipped' | 'received' | 'cancelled';
}

export const inventoryService = {
  getTransfers: async (): Promise<Transfer[]> => {
    const response = await api.get('/inventory/transfers');
    return response.data;
  },
};