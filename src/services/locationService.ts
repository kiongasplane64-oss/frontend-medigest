// services/locationService.ts
import api from '@/api/client';
import type { Location } from '@/types/inventory.types';

export const locationService = {
  async getLocations(): Promise<Location[]> {
    try {
      const response = await api.get('/locations');
      const data = response.data;
      
      if (Array.isArray(data)) return data as Location[];
      if (data && typeof data === 'object' && 'locations' in data && Array.isArray(data.locations)) {
        return data.locations as Location[];
      }
      
      return [];
    } catch (error) {
      console.error('Erreur chargement emplacements:', error);
      return [];
    }
  },

  async createLocation(data: { name: string; description?: string }): Promise<Location> {
    const response = await api.post('/locations', data);
    return response.data;
  },

  async updateLocation(id: string, data: { name?: string; description?: string }): Promise<Location> {
    const response = await api.patch(`/locations/${id}`, data);
    return response.data;
  },

  async deleteLocation(id: string): Promise<{ message: string }> {
    const response = await api.delete(`/locations/${id}`);
    return response.data;
  }
};