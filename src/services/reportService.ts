import api from '@/api/client';

export interface SalesReport {
  period: string;
  total_sales: number;
  total_transactions: number;
  top_selling_product: string;
}

export const getSalesReport = async (period: 'daily' | 'monthly' | 'yearly'): Promise<SalesReport> => {
  const { data } = await api.get(`/v1/reports/sales?period=${period}`);
  return data;
};