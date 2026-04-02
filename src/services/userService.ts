import api from '@/api/client';
import { User } from '@/types/auth';

// ============================================
// TYPES ET INTERFACES
// ============================================

export interface UserCreate {
  full_name: string;
  email: string;
  password?: string;
  role: 'admin' | 'gestionnaire' | 'pharmacien' | 'vendeur' | 'caissier' | 'stockiste' | 'comptable' | 'preparateur';
  is_active: boolean;
  pharmacy_id?: string;
  branch_id?: string;
  telephone?: string;
  adresse?: string;
}

export interface UpdateUserData {
  full_name?: string;
  email?: string;
  role?: 'admin' | 'gestionnaire' | 'pharmacien' | 'vendeur' | 'caissier' | 'stockiste' | 'comptable' | 'preparateur';
  is_active?: boolean;
  pharmacy_id?: string;
  branch_id?: string;
  telephone?: string;
  adresse?: string;
  password?: string;  // Ajout du champ password
  active_pharmacy_id?: string;  // Pour la pharmacie active
  active_branch_id?: string; 
}

export interface UserPermissions {
  can_sell: boolean;
  can_modify_stock: boolean;
  can_view_reports: boolean;
  can_view_profits: boolean;
  can_view_sales: boolean;
  can_modify_service_hours: boolean;
  can_use_overtime: boolean;
  can_modify_settings: boolean;
  can_do_inventory: boolean;
  can_manage_users: boolean;
  can_view_attendance: boolean;
  can_export_data: boolean;
}

export interface UserSessionStats {
  online_users: Array<{
    id: string;
    full_name: string;
    email: string;
    role: string;
    last_login: string;
    session_duration: number;
    pharmacy_id: string;
    branch_id?: string;
  }>;
  total_sessions_today: number;
  average_session_duration: number;
  sessions_by_user: Array<{
    user_id: string;
    user_name: string;
    sessions_count: number;
    total_duration: number;
    last_session: string;
  }>;
}

export interface UserFilters {
  pharmacy_id?: string;
  branch_id?: string;
  include_inactive?: boolean;
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface SessionHistoryFilters {
  user_id: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  page?: number;
}

export interface UserSession {
  id: string;
  user_id: string;
  login_time: string;
  logout_time?: string;
  duration_minutes?: number;
  ip_address?: string;
  pharmacy_id: string;
  branch_id?: string;
}

export interface UserMonthlyStats {
  user_id: string;
  user_name: string;
  year: number;
  month: number;
  days_connected: number;
  total_hours: number;
  average_per_day: number;
  sessions: UserSession[];
}

// ============================================
// PERMISSIONS PAR DÉFAUT SELON LE RÔLE
// ============================================

export const getDefaultPermissions = (role: string): UserPermissions => {
  const permissions = {
    admin: {
      can_sell: true,
      can_modify_stock: true,
      can_view_reports: true,
      can_view_profits: true,
      can_view_sales: true,
      can_modify_service_hours: true,
      can_use_overtime: true,
      can_modify_settings: true,
      can_do_inventory: true,
      can_manage_users: true,
      can_view_attendance: true,
      can_export_data: true
    },
    manager: {
      can_sell: true,
      can_modify_stock: true,
      can_view_reports: true,
      can_view_profits: true,
      can_view_sales: true,
      can_modify_service_hours: true,
      can_use_overtime: true,
      can_modify_settings: true,
      can_do_inventory: true,
      can_manage_users: false,
      can_view_attendance: true,
      can_export_data: true
    },
    pharmacist: {
      can_sell: true,
      can_modify_stock: true,
      can_view_reports: true,
      can_view_profits: false,
      can_view_sales: true,
      can_modify_service_hours: false,
      can_use_overtime: true,
      can_modify_settings: false,
      can_do_inventory: true,
      can_manage_users: false,
      can_view_attendance: false,
      can_export_data: false
    },
    vendeur: {
      can_sell: true,
      can_modify_stock: false,
      can_view_reports: false,
      can_view_profits: false,
      can_view_sales: true,
      can_modify_service_hours: false,
      can_use_overtime: false,
      can_modify_settings: false,
      can_do_inventory: false,
      can_manage_users: false,
      can_view_attendance: false,
      can_export_data: false
    },
    caissier: {
      can_sell: true,
      can_modify_stock: false,
      can_view_reports: false,
      can_view_profits: false,
      can_view_sales: true,
      can_modify_service_hours: false,
      can_use_overtime: false,
      can_modify_settings: false,
      can_do_inventory: false,
      can_manage_users: false,
      can_view_attendance: false,
      can_export_data: false
    },
    stockiste: {
      can_sell: false,
      can_modify_stock: true,
      can_view_reports: false,
      can_view_profits: false,
      can_view_sales: false,
      can_modify_service_hours: false,
      can_use_overtime: false,
      can_modify_settings: false,
      can_do_inventory: true,
      can_manage_users: false,
      can_view_attendance: false,
      can_export_data: false
    },
    comptable: {
      can_sell: false,
      can_modify_stock: false,
      can_view_reports: true,
      can_view_profits: true,
      can_view_sales: true,
      can_modify_service_hours: false,
      can_use_overtime: false,
      can_modify_settings: false,
      can_do_inventory: false,
      can_manage_users: false,
      can_view_attendance: false,
      can_export_data: true
    },
    preparateur: {
      can_sell: false,
      can_modify_stock: true,
      can_view_reports: false,
      can_view_profits: false,
      can_view_sales: false,
      can_modify_service_hours: false,
      can_use_overtime: false,
      can_modify_settings: false,
      can_do_inventory: false,
      can_manage_users: false,
      can_view_attendance: false,
      can_export_data: false
    }
  };

  return permissions[role as keyof typeof permissions] || permissions.vendeur;
};

// ============================================
// FONCTIONS DE BASE (CRUD)
// ============================================

/**
 * Récupérer tous les utilisateurs de la pharmacie avec filtres optionnels
 */
export const getPharmacyUsers = async (filters?: UserFilters): Promise<User[]> => {
  const params = new URLSearchParams();
  
  if (filters?.pharmacy_id) params.append('pharmacy_id', filters.pharmacy_id);
  if (filters?.branch_id) params.append('branch_id', filters.branch_id);
  if (filters?.include_inactive) params.append('include_inactive', 'true');
  if (filters?.search) params.append('search', filters.search);
  if (filters?.role) params.append('role', filters.role);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const { data } = await api.get('/users', { params });
  return data;
};

/**
 * Créer un nouvel utilisateur
 */
export const createPharmacyUser = async (userData: UserCreate): Promise<User> => {
  // Ajouter les permissions par défaut basées sur le rôle
  const defaultPermissions = getDefaultPermissions(userData.role);
  
  const payload = {
    ...userData,
    permissions: defaultPermissions,
    email: userData.email.toLowerCase().trim()
  };

  const { data } = await api.post('/users', payload);
  return data;
};

/**
 * Supprimer un utilisateur
 */
export const deletePharmacyUser = async (id: string): Promise<void> => {
  await api.delete(`/users/${id}`);
};

/**
 * Mettre à jour un utilisateur
 */
export const updatePharmacyUser = async (id: string, userData: UpdateUserData): Promise<User> => {
  const payload = {
    ...userData,
    ...(userData.email && { email: userData.email.toLowerCase().trim() })
  };

  const { data } = await api.put(`/users/${id}`, payload);
  return data;
};

/**
 * Récupérer un utilisateur par son ID
 */
export const getPharmacyUserById = async (id: string): Promise<User> => {
  const { data } = await api.get(`/users/${id}`);
  return data;
};

// ============================================
// GESTION DES PERMISSIONS
// ============================================

/**
 * Mettre à jour les permissions d'un utilisateur
 */
export const updateUserPermissions = async (userId: string, permissions: UserPermissions): Promise<User> => {
  const { data } = await api.patch(`/users/${userId}/permissions`, permissions);
  return data;
};

/**
 * Récupérer les permissions d'un utilisateur
 */
export const getUserPermissions = async (userId: string): Promise<UserPermissions> => {
  const { data } = await api.get(`/users/${userId}/permissions`);
  return data;
};

/**
 * Réinitialiser les permissions d'un utilisateur selon son rôle
 */
export const resetUserPermissions = async (userId: string, role: string): Promise<User> => {
  const defaultPermissions = getDefaultPermissions(role);
  const { data } = await api.post(`/users/${userId}/permissions/reset`, { 
    role,
    permissions: defaultPermissions 
  });
  return data;
};

// ============================================
// AFFECTATION (PHARMACIE/BRANCHE)
// ============================================

/**
 * Mettre à jour l'affectation d'un utilisateur (pharmacie et branche)
 */
export const updateUserAssignment = async (
  userId: string, 
  pharmacyId: string, 
  branchId?: string
): Promise<User> => {
  const { data } = await api.patch(`/users/${userId}/assignment`, { 
    pharmacyId, 
    branchId 
  });
  return data;
};

/**
 * Récupérer les affectations possibles pour un utilisateur
 */
export const getUserAssignments = async (userId: string): Promise<{
  pharmacies: Array<{ id: string; name: string }>;
  current_pharmacy?: string;
  current_branch?: string;
}> => {
  const { data } = await api.get(`/users/${userId}/assignments`);
  return data;
};

// ============================================
// GESTION DU STATUT
// ============================================

/**
 * Activer/désactiver un utilisateur
 */
export const toggleUserStatus = async (id: string, is_active: boolean): Promise<User> => {
  const { data } = await api.patch(`/users/${id}/status`, { is_active });
  return data;
};

/**
 * Vérifier si un utilisateur est actif
 */
export const checkUserStatus = async (id: string): Promise<{ is_active: boolean; is_online: boolean }> => {
  const { data } = await api.get(`/users/${id}/status`);
  return data;
};

// ============================================
// SESSIONS ET STATISTIQUES DE CONNEXION
// ============================================

/**
 * Récupérer les statistiques des sessions utilisateur
 */
export const getUserSessionStats = async (filters: {
  pharmacy_id?: string;
  branch_id?: string;
  date_range: 'today' | 'week' | 'month' | 'custom';
  start_date?: string;
  end_date?: string;
}): Promise<UserSessionStats> => {
  const params = new URLSearchParams();
  
  params.append('date_range', filters.date_range);
  if (filters.pharmacy_id) params.append('pharmacy_id', filters.pharmacy_id);
  if (filters.branch_id) params.append('branch_id', filters.branch_id);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);

  const { data } = await api.get('/users/sessions/stats', { params });
  return data;
};

/**
 * Récupérer l'historique des sessions d'un utilisateur
 */
export const getUserSessionHistory = async (filters: SessionHistoryFilters): Promise<UserSession[]> => {
  const params = new URLSearchParams();
  
  params.append('user_id', filters.user_id);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.page) params.append('page', filters.page.toString());

  const { data } = await api.get(`/users/${filters.user_id}/sessions`, { params });
  return data;
};

/**
 * Récupérer les statistiques mensuelles d'un utilisateur
 */
export const getUserMonthlyStats = async (
  userId: string,
  year: number,
  month: number
): Promise<UserMonthlyStats> => {
  const { data } = await api.get(`/users/${userId}/stats/monthly`, {
    params: { year, month }
  });
  return data;
};

/**
 * Récupérer les utilisateurs actuellement en ligne
 */
export const getOnlineUsers = async (pharmacyId?: string, branchId?: string): Promise<User[]> => {
  const params = new URLSearchParams();
  
  if (pharmacyId) params.append('pharmacy_id', pharmacyId);
  if (branchId) params.append('branch_id', branchId);

  const { data } = await api.get('/users/online', { params });
  return data;
};

// ============================================
// SUIVI DE PRÉSENCE
// ============================================

/**
 * Enregistrer le début d'une session utilisateur
 */
export const startUserSession = async (pharmacyId: string, branchId?: string): Promise<{ session_id: string }> => {
  const { data } = await api.post('/users/session/start', { pharmacyId, branchId });
  return data;
};

/**
 * Enregistrer la fin d'une session utilisateur
 */
export const endUserSession = async (sessionId: string): Promise<{ duration: number }> => {
  const { data } = await api.post(`/users/session/${sessionId}/end`);
  return data;
};

/**
 * Récupérer le rapport de présence pour une période donnée
 */
export const getAttendanceReport = async (filters: {
  pharmacy_id?: string;
  branch_id?: string;
  start_date: string;
  end_date: string;
  user_id?: string;
}): Promise<{
  summary: {
    total_users: number;
    total_sessions: number;
    total_hours: number;
    average_daily: number;
  };
  details: Array<{
    user_id: string;
    user_name: string;
    sessions_count: number;
    total_hours: number;
    days_present: number;
  }>;
}> => {
  const params = new URLSearchParams();
  
  params.append('start_date', filters.start_date);
  params.append('end_date', filters.end_date);
  if (filters.pharmacy_id) params.append('pharmacy_id', filters.pharmacy_id);
  if (filters.branch_id) params.append('branch_id', filters.branch_id);
  if (filters.user_id) params.append('user_id', filters.user_id);

  const { data } = await api.get('/users/attendance/report', { params });
  return data;
};

// ============================================
// PROFIL UTILISATEUR CONNECTÉ
// ============================================

/**
 * Récupérer le profil de l'utilisateur connecté
 */
export const getCurrentUserProfile = async (): Promise<User & { permissions: UserPermissions }> => {
  const { data } = await api.get('/users/me/profile');
  return data;
};

/**
 * Mettre à jour le profil de l'utilisateur connecté
 */
export const updateCurrentUserProfile = async (userData: {
  full_name?: string;
  telephone?: string;
  adresse?: string;
}): Promise<User> => {
  const { data } = await api.patch('/users/me/profile', userData);
  return data;
};

/**
 * Changer le mot de passe de l'utilisateur connecté
 */
export const changePassword = async (oldPassword: string, newPassword: string): Promise<{ message: string }> => {
  const { data } = await api.post('/users/me/change-password', {
    old_password: oldPassword,
    new_password: newPassword
  });
  return data;
};

// ============================================
// EXPORTATION DES DONNÉES
// ============================================

/**
 * Exporter les données des utilisateurs
 */
export const exportUsersData = async (format: 'csv' | 'excel' | 'pdf', filters?: UserFilters): Promise<Blob> => {
  const params = new URLSearchParams();
  
  params.append('format', format);
  if (filters?.pharmacy_id) params.append('pharmacy_id', filters.pharmacy_id);
  if (filters?.branch_id) params.append('branch_id', filters.branch_id);
  if (filters?.role) params.append('role', filters.role);
  if (filters?.include_inactive) params.append('include_inactive', 'true');

  const response = await api.get('/users/export', {
    params,
    responseType: 'blob'
  });
  
  return response.data;
};

/**
 * Exporter l'historique des sessions
 */
export const exportSessionsData = async (
  format: 'csv' | 'excel' | 'pdf',
  filters: {
    start_date: string;
    end_date: string;
    pharmacy_id?: string;
    branch_id?: string;
    user_id?: string;
  }
): Promise<Blob> => {
  const params = new URLSearchParams();
  
  params.append('format', format);
  params.append('start_date', filters.start_date);
  params.append('end_date', filters.end_date);
  if (filters.pharmacy_id) params.append('pharmacy_id', filters.pharmacy_id);
  if (filters.branch_id) params.append('branch_id', filters.branch_id);
  if (filters.user_id) params.append('user_id', filters.user_id);

  const response = await api.get('/users/sessions/export', {
    params,
    responseType: 'blob'
  });
  
  return response.data;
};

// ============================================
// STATISTIQUES GLOBALES
// ============================================

/**
 * Récupérer les statistiques globales des utilisateurs
 */
export const getUsersStatistics = async (pharmacyId?: string): Promise<{
  total_users: number;
  active_users: number;
  inactive_users: number;
  online_now: number;
  by_role: Record<string, number>;
  by_pharmacy: Array<{
    pharmacy_id: string;
    pharmacy_name: string;
    user_count: number;
    active_count: number;
  }>;
}> => {
  const params = new URLSearchParams();
  if (pharmacyId) params.append('pharmacy_id', pharmacyId);

  const { data } = await api.get('/users/statistics', { params });
  return data;
};

export default {
  getPharmacyUsers,
  createPharmacyUser,
  deletePharmacyUser,
  updatePharmacyUser,
  getPharmacyUserById,
  updateUserPermissions,
  getUserPermissions,
  resetUserPermissions,
  updateUserAssignment,
  getUserAssignments,
  toggleUserStatus,
  checkUserStatus,
  getUserSessionStats,
  getUserSessionHistory,
  getUserMonthlyStats,
  getOnlineUsers,
  startUserSession,
  endUserSession,
  getAttendanceReport,
  getCurrentUserProfile,
  updateCurrentUserProfile,
  changePassword,
  exportUsersData,
  exportSessionsData,
  getUsersStatistics,
  getDefaultPermissions
};