// src/services/pharmacyService.ts
import api from '@/api/client';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  manager?: string;
  created_at: string;
  is_active: boolean;
}

export interface BranchConfig {
  maxBranches: number;
  currentBranches: number;
  branches: Branch[];
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

export interface PharmacyConfig {
  pharmacyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
    logo?: string;
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
  updatedAt: string;
  createdAt: string;
}

export interface Pharmacy {
  id: string;
  tenant_id: string;
  name: string;
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
 * Récupère les branches d'une pharmacie
 */
export const getPharmacyBranches = async (pharmacyId: string): Promise<Branch[]> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/branches`);
  return data;
};

/**
 * Crée une nouvelle branche pour une pharmacie
 */
export const createPharmacyBranch = async (pharmacyId: string, branchData: {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  manager?: string;
}): Promise<Branch> => {
  const { data } = await api.post(`/pharmacies/${pharmacyId}/branches`, branchData);
  return data.branch;
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

/**
 * Vérifie le statut du service (heures d'ouverture)
 */
export const checkPharmacyServiceStatus = async (pharmacyId: string): Promise<{
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
}> => {
  const { data } = await api.get(`/pharmacies/${pharmacyId}/service-status`);
  return data;
};

export default {
  getPharmacies,
  getPharmacyById,
  getPharmacyLimits,
  getPharmacyConfig,
  updatePharmacyConfig,
  getPharmacyBranches,
  createPharmacyBranch,
  updatePharmacyBranch,
  deletePharmacyBranch,
  createPharmacy,
  updatePharmacy,
  deactivatePharmacy,
  reactivatePharmacy,
  checkPharmacyServiceStatus
};