import axios from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
});

api.interceptors.request.use((config) => {
  // On récupère les données directement depuis l'état du Store
  const { token, currentPharmacyId } = useAuthStore.getState();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (currentPharmacyId) {
    config.headers['X-Pharmacy-ID'] = currentPharmacyId;
  }

  return config;
});

export default api;