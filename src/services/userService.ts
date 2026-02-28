import api from '@/api/client';
import { User } from '@/types/auth'; 

export interface UserCreate {
  full_name: string;
  email: string;
  password?: string;
  role: 'admin' | 'manager' | 'pharmacist';
  is_active: boolean;
}

export interface UpdateUserData {
  full_name?: string;
  email?: string;
  role?: 'admin' | 'manager' | 'pharmacist';
  is_active?: boolean;
}

// Récupérer tous les utilisateurs de la pharmacie
export const getPharmacyUsers = async (): Promise<User[]> => {
  const { data } = await api.get('/v1/users');
  return data;
};

// Créer un nouvel utilisateur
export const createPharmacyUser = async (userData: UserCreate): Promise<User> => {
  const { data } = await api.post('/v1/users', userData);
  return data;
};

// Supprimer un utilisateur
export const deletePharmacyUser = async (id: string): Promise<void> => {
  await api.delete(`/v1/users/${id}`);
};

// Mettre à jour un utilisateur
export const updatePharmacyUser = async (id: string, userData: UpdateUserData): Promise<User> => {
  const { data } = await api.put(`/v1/users/${id}`, userData);
  return data;
};

// Récupérer un utilisateur par son ID
export const getPharmacyUserById = async (id: string): Promise<User> => {
  const { data } = await api.get(`/v1/users/${id}`);
  return data;
};

// Activer/désactiver un utilisateur
export const toggleUserStatus = async (id: string, is_active: boolean): Promise<User> => {
  const { data } = await api.patch(`/v1/users/${id}/status`, { is_active });
  return data;
};