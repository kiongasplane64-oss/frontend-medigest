// src/services/pharmacyService.ts
import api from '@/api/client';

// ==================== BRANCH TYPES ====================

export interface Branch {
  id: string;
  tenant_id: string;
  parent_pharmacy_id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  latitude?: number;
  longitude?: number;
  manager_id?: string;
  manager_name?: string;
  opening_hours?: Record<string, string>;
  config?: BranchSpecificConfig;
  is_active: boolean;
  is_main_branch: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Champs additionnels (optionnels)
  pharmacy_name?: string;
  products_count?: number;
  sales_count?: number;
  customers_count?: number;
}

export interface BranchSpecificConfig {
  lowStockThreshold: number;
  expiryWarningDays: number;
  allowNegativeStock: boolean;
  enableBatchTracking: boolean;
  workingHours?: BranchWorkingHours;
  autoPricingEnabled?: boolean;
  defaultMargin?: number;
  updatedAt?: string;
}

export interface BranchWorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  timezone: string;
  daysOff: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

export interface BranchStatistics {
  branch_id: string;
  branch_name: string;
  products_total: number;
  products_low_stock: number;
  products_expiring_soon: number;
  products_out_of_stock: number;
  sales_today: number;
  sales_today_amount: number;
  sales_this_week: number;
  sales_this_week_amount: number;
  sales_this_month: number;
  sales_this_month_amount: number;
  customers_total: number;
  customers_active: number;
  employees_count: number;
  last_sale_at: string | null;
}

export interface BranchServiceStatus {
  branch_id: string;
  branch_name: string;
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

export interface BranchListResponse {
  items: Branch[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface BranchFilters {
  search?: string;
  city?: string;
  country?: string;
  is_active?: boolean;
  is_main_branch?: boolean;
  has_manager?: boolean;
}

// ==================== PHARMACY TYPES ====================

export interface BranchConfig {
  maxBranches: number;
  currentBranches: number;
  branches: BranchSummary[];
  main_branch_id?: string;
  main_branch_name?: string;
}

export interface BranchSummary {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  is_main_branch: boolean;
}

export interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  timezone: string;
  daysOff: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number;
}

export interface MarginConfig {
  defaultMargin: number;
  minMargin: number;
  maxMargin: number;
}

export interface AutomaticPricingConfig {
  enabled: boolean;
  method: 'percentage' | 'coefficient' | 'margin';
  value: number;
}

export interface SalesConfig {
  salesType: 'wholesale' | 'retail' | 'both';
  calcul_auto_prix: boolean;
  marge_par_defaut: number;
  taux_tva: number;
  lock_stock_modification: boolean;
}

export interface PharmacyConfig {
  pharmacyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
    logoUrl?: string;
  };
  currencies: CurrencyConfig[];
  primaryCurrency: string;
  taxRate: number;
  lowStockThreshold: number;
  expiryWarningDays: number;
  allowNegativeStock: boolean;
  workingHours: WorkingHours;
  productReturnDays: number;
  marginConfig: MarginConfig;
  automaticPricing: AutomaticPricingConfig;
  theme: 'light' | 'dark' | 'system';
  initialCapital: number;
  branchConfig: BranchConfig;
  // Champs de vente
  salesType: 'wholesale' | 'retail' | 'both';
  calcul_auto_prix: boolean;
  marge_par_defaut: number;
  taux_tva: number;
  lock_stock_modification: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Pharmacy {
  id: string;
  tenant_id: string;
  name: string;
  nom?: string; // Alias français
  license_number: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  is_active: boolean;
  opening_hours?: any;
  pharmacist_in_charge?: string;
  pharmacist_license?: string;
  config: PharmacyConfig;
  created_at: string;
  updated_at: string;
}

export interface PharmacyLimits {
  tenant_id: string;
  tenant_name: string;
  current_plan: string;
  limits: {
    max_pharmacies: number;
    max_branches_per_pharmacy: number;
    description: string;
  };
  current_pharmacies_count: number;
  max_pharmacies_allowed: number;
  remaining_pharmacies: number;
  can_create_more: boolean;
  max_branches_per_pharmacy: number;
}

export interface ActivePharmacy {
  id: string;
  name: string;
  license_number: string;
  config: PharmacyConfig;
  branches_count: number;
  is_active: boolean;
}

export interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc?: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_open_today?: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

export interface OnlineUser {
  id: string;
  nom_complet: string;
  email: string;
  role: string;
  last_login: string | null;
  login_duration: string;
  status: string;
}

export interface OnlineUsersResponse {
  pharmacy_id: string;
  pharmacy_name: string;
  online_count: number;
  users: OnlineUser[];
  timestamp: string;
}

export interface BranchesSummary {
  pharmacy_id: string;
  pharmacy_name: string;
  branches_count: number;
  total_products: number;
  total_customers: number;
  total_employees: number;
  sales_today_count: number;
  sales_today_amount: number;
  branches: Array<{
    id: string;
    name: string;
    city: string;
    is_main_branch: boolean;
  }>;
}

// ==================== PHARMACY API FUNCTIONS ====================

/**
 * Récupère toutes les pharmacies du tenant
 */
export const getPharmacies = async (activeOnly: boolean = true): Promise<Pharmacy[]> => {
  const params = new URLSearchParams();
  if (activeOnly) params.append('active_only', 'true');
  
  const { data } = await api.get('/pharmacies', { params });
  return data;
};

/**
 * Récupère une pharmacie par son ID
 */
export const getPharmacyById = async (id: string): Promise<Pharmacy> => {
  const { data } = await api.get(`/pharmacies/${id}`);
  return data;
};

/**
 * Récupère les limites de pharmacies pour le tenant
 */
export const getPharmacyLimits = async (): Promise<PharmacyLimits> => {
  const { data } = await api.get('/pharmacies/limits');
  return data;
};

/**
 * Récupère la pharmacie active de l'utilisateur
 */
export const getActivePharmacy = async (): Promise<ActivePharmacy> => {
  const { data } = await api.get('/pharmacies/active');
  return data;
};

/**
 * Définit la pharmacie active pour l'utilisateur
 */
export const setActivePharmacy = async (pharmacyId: string): Promise<{ id: string; name: string; message: string }> => {
  const { data } = await api.post(`/pharmacies/active/${pharmacyId}`);
  return data;
};

/**
 * Récupère la pharmacie active de l'utilisateur (me)
 */
export const getMyActivePharmacy = async (): Promise<{ pharmacy_id: string; name: string }> => {
  const { data } = await api.get('/pharmacies/me/active-pharmacy');
  return data;
};

/**
 * Récupère la configuration d'une pharmacie
 */
export const getPharmacyConfig = async (pharmacyId: string): Promise<PharmacyConfig> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/config`);
  return data.config;
};

/**
 * Met à jour la configuration d'une pharmacie
 */
export const updatePharmacyConfig = async (pharmacyId: string, config: Partial<PharmacyConfig>): Promise<PharmacyConfig> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/config`, config);
  return data.config;
};

/**
 * Met à jour la configuration de vente
 */
export const updateSalesConfig = async (pharmacyId: string, salesConfig: SalesConfig): Promise<SalesConfig> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/config/sales`, salesConfig);
  return data.sales_config;
};

/**
 * Met à jour la configuration des devises
 */
export const updateCurrenciesConfig = async (pharmacyId: string, currencies: CurrencyConfig[]): Promise<CurrencyConfig[]> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/config/currencies`, currencies);
  return data.currencies;
};

/**
 * Met à jour les heures de service
 */
export const updateWorkingHours = async (pharmacyId: string, workingHours: WorkingHours): Promise<WorkingHours> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/config/working-hours`, workingHours);
  return data.working_hours;
};

/**
 * Met à jour la configuration des prix
 */
export const updatePricingConfig = async (pharmacyId: string, pricing: AutomaticPricingConfig): Promise<AutomaticPricingConfig> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/config/pricing`, pricing);
  return data.pricing;
};

/**
 * Met à jour le thème
 */
export const updateTheme = async (pharmacyId: string, theme: 'light' | 'dark' | 'system'): Promise<string> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/config/theme`, { theme });
  return data.theme;
};

// ==================== BRANCH API FUNCTIONS ====================

/**
 * Récupère toutes les branches d'une pharmacie
 */
export const getPharmacyBranches = async (pharmacyId: string, activeOnly: boolean = true): Promise<Branch[]> => {
  const params = new URLSearchParams();
  if (activeOnly) params.append('active_only', 'true');
  
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches`, { params });
  return data;
};

/**
 * Récupère une branche spécifique
 */
export const getBranchById = async (pharmacyId: string, branchId: string): Promise<Branch> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/${branchId}`);
  return data;
};

/**
 * Crée une nouvelle branche
 */
export const createPharmacyBranch = async (pharmacyId: string, branchData: {
  name: string;
  code?: string;
  address: string;
  city: string;
  country?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  manager_id?: string;
  manager_name?: string;
  opening_hours?: Record<string, string>;
  config?: BranchSpecificConfig;
  is_main_branch?: boolean;
}): Promise<Branch> => {
  const { data } = await api.post(`/pharmacies/${pharmacyId}/branches`, branchData);
  return data;
};

/**
 * Met à jour une branche
 */
export const updatePharmacyBranch = async (pharmacyId: string, branchId: string, branchData: Partial<Branch>): Promise<Branch> => {
  const { data } = await api.put(`/pharmacies/${pharmacyId}/branches/${branchId}`, branchData);
  return data;
};

/**
 * Supprime (désactive) une branche
 */
export const deletePharmacyBranch = async (pharmacyId: string, branchId: string): Promise<void> => {
  await api.delete(`/pharmacies/${pharmacyId}/branches/${branchId}`);
};

/**
 * Récupère les statistiques d'une branche
 */
export const getBranchStatistics = async (pharmacyId: string, branchId: string, period: 'day' | 'week' | 'month' | 'year' = 'month'): Promise<BranchStatistics> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/${branchId}/statistics`, {
    params: { period }
  });
  return data;
};

/**
 * Vérifie le statut de service d'une branche
 */
export const checkBranchServiceStatus = async (pharmacyId: string, branchId: string): Promise<BranchServiceStatus> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/${branchId}/service-status`);
  return data;
};

/**
 * Met à jour la configuration d'une branche
 */
export const updateBranchConfig = async (pharmacyId: string, branchId: string, configUpdate: Partial<BranchSpecificConfig>): Promise<{ config: BranchSpecificConfig }> => {
  const { data } = await api.patch(`/pharmacies/${pharmacyId}/branches/${branchId}/config`, configUpdate);
  return data;
};

/**
 * Récupère la configuration d'une branche
 */
export const getBranchConfig = async (pharmacyId: string, branchId: string): Promise<BranchSpecificConfig> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/${branchId}/config`);
  return data.config;
};

/**
 * Définit une branche comme branche principale
 */
export const setMainBranch = async (pharmacyId: string, branchId: string): Promise<Branch> => {
  const { data } = await api.post(`/pharmacies/${pharmacyId}/branches/${branchId}/set-main`);
  return data;
};

/**
 * Filtre les branches avec pagination
 */
export const filterBranches = async (pharmacyId: string, filters: BranchFilters & { page?: number; size?: number }): Promise<BranchListResponse> => {
  const params = new URLSearchParams();
  if (filters.search) params.append('search', filters.search);
  if (filters.city) params.append('city', filters.city);
  if (filters.country) params.append('country', filters.country);
  if (filters.is_active !== undefined) params.append('is_active', String(filters.is_active));
  if (filters.is_main_branch !== undefined) params.append('is_main_branch', String(filters.is_main_branch));
  if (filters.has_manager !== undefined) params.append('has_manager', String(filters.has_manager));
  if (filters.page) params.append('page', String(filters.page));
  if (filters.size) params.append('size', String(filters.size));
  
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/filter`, { params });
  return data;
};

/**
 * Exporte les branches
 */
export const exportBranches = async (pharmacyId: string, format: 'csv' | 'json' = 'csv'): Promise<Blob | any[]> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/export`, {
    params: { format },
    responseType: format === 'csv' ? 'blob' : 'json'
  });
  return data;
};

/**
 * Override les horaires d'une branche
 */
export const overrideBranchWorkingHours = async (pharmacyId: string, branchId: string, workingHours: BranchWorkingHours): Promise<{ working_hours: BranchWorkingHours }> => {
  const { data } = await api.post(`/pharmacies/${pharmacyId}/branches/${branchId}/working-hours/override`, workingHours);
  return data;
};

/**
 * Supprime l'override des horaires d'une branche
 */
export const removeBranchWorkingHoursOverride = async (pharmacyId: string, branchId: string): Promise<void> => {
  await api.delete(`/pharmacies/${pharmacyId}/branches/${branchId}/working-hours/override`);
};

/**
 * Récupère le résumé statistique de toutes les branches
 */
export const getBranchesSummary = async (pharmacyId: string): Promise<BranchesSummary> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches/statistics/summary`);
  return data;
};

// ==================== PHARMACY CRUD ====================

/**
 * Crée une nouvelle pharmacie
 */
export const createPharmacy = async (pharmacyData: {
  name: string;
  license_number: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  pharmacist_in_charge?: string;
  pharmacist_license?: string;
  is_active?: boolean;
}): Promise<Pharmacy> => {
  const { data } = await api.post('/pharmacies', pharmacyData);
  return data;
};

/**
 * Met à jour une pharmacie
 */
export const updatePharmacy = async (id: string, pharmacyData: Partial<Pharmacy>): Promise<Pharmacy> => {
  const { data } = await api.put(`/pharmacies/${id}`, pharmacyData);
  return data;
};

/**
 * Désactive une pharmacie (soft delete)
 */
export const deactivatePharmacy = async (id: string): Promise<void> => {
  await api.delete(`/pharmacies/${id}`);
};

/**
 * Réactive une pharmacie
 */
export const reactivatePharmacy = async (id: string): Promise<Pharmacy> => {
  const { data } = await api.post(`/pharmacies/${id}/reactivate`);
  return data;
};

// ==================== SERVICE STATUS ====================

/**
 * Vérifie le statut du service (heures d'ouverture)
 */
export const checkPharmacyServiceStatus = async (pharmacyId: string): Promise<ServiceStatus> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/service-status`);
  return data;
};

// ==================== ONLINE USERS ====================

/**
 * Récupère les utilisateurs en ligne
 */
export const getOnlineUsers = async (pharmacyId: string): Promise<OnlineUsersResponse> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/online-users`);
  return data;
};

// ==================== LOGO UPLOAD ====================

/**
 * Upload le logo de la pharmacie
 */
export const uploadPharmacyLogo = async (pharmacyId: string, file: File): Promise<{ logo_url: string }> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const { data } = await api.post(`/pharmacies/${pharmacyId}/logo`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return data;
};

// ==================== EXPORT ====================

export default {
  // Pharmacies
  getPharmacies,
  getPharmacyById,
  getPharmacyLimits,
  getActivePharmacy,
  setActivePharmacy,
  getMyActivePharmacy,
  createPharmacy,
  updatePharmacy,
  deactivatePharmacy,
  reactivatePharmacy,
  
  // Configuration
  getPharmacyConfig,
  updatePharmacyConfig,
  updateSalesConfig,
  updateCurrenciesConfig,
  updateWorkingHours,
  updatePricingConfig,
  updateTheme,
  
  // Branches
  getPharmacyBranches,
  getBranchById,
  createPharmacyBranch,
  updatePharmacyBranch,
  deletePharmacyBranch,
  getBranchStatistics,
  checkBranchServiceStatus,
  updateBranchConfig,
  getBranchConfig,
  setMainBranch,
  filterBranches,
  exportBranches,
  overrideBranchWorkingHours,
  removeBranchWorkingHoursOverride,
  getBranchesSummary,
  
  // Utilitaires
  checkPharmacyServiceStatus,
  getOnlineUsers,
  uploadPharmacyLogo,
};