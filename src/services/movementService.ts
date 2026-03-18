// services/movementService.ts
import api from '@/api/client';
import type { StockMovement } from '@/types/inventory.types';

export const movementService = {
  async getMovements(params?: {
    page?: number;
    limit?: number;
    product_id?: string;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    const response = await api.get('/stock/movements', { params });
    
    const data = response.data;
    
    // Normaliser la réponse
    if (data && typeof data === 'object') {
      if ('data' in data && Array.isArray(data.data)) {
        return {
          movements: data.data as StockMovement[],
          total: (data.total as number) || data.data.length
        };
      }
      if ('movements' in data && Array.isArray(data.movements)) {
        return {
          movements: data.movements as StockMovement[],
          total: (data.total as number) || data.movements.length
        };
      }
      if ('items' in data && Array.isArray(data.items)) {
        return {
          movements: data.items as StockMovement[],
          total: (data.total as number) || data.items.length
        };
      }
    }
    
    // Si la réponse est directement un tableau
    if (Array.isArray(data)) {
      return {
        movements: data as StockMovement[],
        total: data.length
      };
    }
    
    return { movements: [], total: 0 };
  },

  async getMovement(id: string): Promise<StockMovement> {
    const response = await api.get(`/stock/movements/${id}`);
    
    const data = response.data;
    
    // Normaliser la réponse
    if (data && typeof data === 'object') {
      if ('data' in data) {
        return data.data as StockMovement;
      }
      if ('movement' in data) {
        return data.movement as StockMovement;
      }
    }
    
    return data as StockMovement;
  },

  async exportMovements(params?: {
    format?: 'excel' | 'csv' | 'pdf';
    product_id?: string;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<Blob> {
    const response = await api.get('/stock/movements/export', {
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  async createMovement(data: {
    product_id: string;
    movement_type: string;
    quantity_change: number;
    reason?: string;
    reference_number?: string;
    notes?: string;
    source_location?: string;
    destination_location?: string;
    unit_cost?: number;
  }): Promise<StockMovement> {
    const response = await api.post('/stock/movements', data);
    
    const responseData = response.data;
    
    // Normaliser la réponse
    if (responseData && typeof responseData === 'object') {
      if ('data' in responseData) {
        return responseData.data as StockMovement;
      }
      if ('movement' in responseData) {
        return responseData.movement as StockMovement;
      }
    }
    
    return responseData as StockMovement;
  },

  async getMovementsByProduct(productId: string, params?: {
    page?: number;
    limit?: number;
    date_from?: string;
    date_to?: string;
  }): Promise<{ movements: StockMovement[]; total: number }> {
    return this.getMovements({
      product_id: productId,
      ...params
    });
  },

  async getRecentMovements(limit: number = 10): Promise<StockMovement[]> {
    const response = await this.getMovements({ limit });
    return response.movements;
  }
};