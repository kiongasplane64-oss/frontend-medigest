// services/reportService.ts
import api from '@/api/client';

export const reportService = {
  async generateStockReport(params?: {
    category?: string;
    location?: string;
    includeExpired?: boolean;
    includeLowStock?: boolean;
    format?: 'pdf' | 'excel' | 'csv';
  }): Promise<Blob> {
    const response = await api.get('/reports/stock', {
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  async generateValuationReport(params?: {
    currency?: string;
    includeMargin?: boolean;
    format?: 'pdf' | 'excel' | 'csv';
  }): Promise<Blob> {
    const response = await api.get('/reports/valuation', {
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  async getProfitAnalytics(dateRange?: { start: string; end: string }): Promise<{
    totalSales: number;
    totalPurchases: number;
    grossProfit: number;
    marginPercentage: number;
    byCategory: Array<{ category: string; profit: number; margin: number }>;
  }> {
    const response = await api.get('/analytics/profit', { params: dateRange });
    return response.data;
  },

  async generateMovementReport(params?: {
    startDate?: string;
    endDate?: string;
    productId?: string;
    type?: string;
    format?: 'pdf' | 'excel';
  }): Promise<Blob> {
    const response = await api.get('/reports/movements', {
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  async generateExpiryReport(params?: {
    days?: number;
    includeExpired?: boolean;
    format?: 'pdf' | 'excel';
  }): Promise<Blob> {
    const response = await api.get('/reports/expiry', {
      params,
      responseType: 'blob'
    });
    return response.data;
  }
};

export interface SalesReport {
  period: string;
  total_sales: number;
  total_transactions: number;
  top_selling_product: string;
}

export const getSalesReport = async (period: 'daily' | 'monthly' | 'yearly'): Promise<SalesReport> => {
  const { data } = await api.get(`/reports/sales?period=${period}`);
  return data;
};
