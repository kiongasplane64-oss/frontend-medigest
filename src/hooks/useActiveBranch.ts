// hooks/useActiveBranch.ts
/**
 * Hook pour gérer la branche active de l'utilisateur
 * Basé sur les endpoints branches.py
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';

// ===================================================================
// TYPES
// ===================================================================

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  is_main_branch: boolean;
  parent_pharmacy_id: string;
  parent_pharmacy_name?: string;
  manager_name?: string | null;
  config?: Record<string, unknown>;
  created_at: string;
}

export interface BranchWorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  daysOff: Record<string, boolean>;
  timezone: string;
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
  next_service_time?: string | null;
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

export interface BranchConfigUpdate {
  workingHours?: Partial<BranchWorkingHours>;
  lowStockThreshold?: number;
  expiryWarningDays?: number;
  allowNegativeStock?: boolean;
  taxRate?: number;
  [key: string]: unknown;
}

// ===================================================================
// HOOK
// ===================================================================

interface UseActiveBranchReturn {
  // Données de la branche
  id: string | null;
  name: string | null;
  code: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isMainBranch: boolean;
  parentPharmacyId: string | null;
  parentPharmacyName: string | null;
  managerName: string | null;
  config: Record<string, unknown> | null;
  
  // Statut du service
  serviceStatus: BranchServiceStatus | null;
  
  // Statistiques
  statistics: BranchStatistics | null;
  
  // États de chargement
  isLoading: boolean;
  isLoadingService: boolean;
  isLoadingStatistics: boolean;
  error: Error | null;
  serviceError: Error | null;
  statisticsError: Error | null;
  
  // Actions
  refreshBranch: () => Promise<void>;
  refreshServiceStatus: () => Promise<void>;
  refreshStatistics: (period?: 'day' | 'week' | 'month' | 'year') => Promise<void>;
  updateBranchConfig: (updates: BranchConfigUpdate) => Promise<Record<string, unknown>>;
  setActiveBranch: (branchId: string) => Promise<void>;
  clearActiveBranch: () => void;
}

export function useActiveBranch(): UseActiveBranchReturn {
  const { user, isAuthenticated, updateUser } = useAuthStore();
  
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [serviceStatus, setServiceStatus] = useState<BranchServiceStatus | null>(null);
  const [statistics, setStatistics] = useState<BranchStatistics | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingService, setIsLoadingService] = useState(false);
  const [isLoadingStatistics, setIsLoadingStatistics] = useState(false);
  
  const [error, setError] = useState<Error | null>(null);
  const [serviceError, setServiceError] = useState<Error | null>(null);
  const [statisticsError, setStatisticsError] = useState<Error | null>(null);

  // Récupérer l'ID de la branche active depuis l'utilisateur
  const activeBranchId = useMemo(() => {
    if (!user) return null;
    // L'utilisateur peut avoir un champ branch_id ou active_branch_id
    return (user as any).branch_id || (user as any).active_branch_id || null;
  }, [user]);

  // URL de base pour les endpoints de branche
  const getBranchUrl = useCallback((branchId: string, endpoint: string = '') => {
    return `/branches/${branchId}${endpoint}`;
  }, []);

  /**
   * Récupère les informations de la branche
   */
  const fetchBranch = useCallback(async () => {
    if (!activeBranchId) {
      setBranch(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.get(getBranchUrl(activeBranchId));
      const branchData = response.data;
      
      setBranch({
        id: branchData.id,
        name: branchData.name,
        code: branchData.code,
        address: branchData.address,
        city: branchData.city,
        country: branchData.country,
        phone: branchData.phone,
        email: branchData.email,
        is_active: branchData.is_active,
        is_main_branch: branchData.is_main_branch,
        parent_pharmacy_id: branchData.parent_pharmacy_id,
        parent_pharmacy_name: branchData.parent_pharmacy_name,
        manager_name: branchData.manager_name,
        config: branchData.config || {},
        created_at: branchData.created_at,
      });
    } catch (err) {
      console.error('Erreur lors du chargement de la branche:', err);
      setError(err instanceof Error ? err : new Error('Erreur inconnue'));
      setBranch(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId, getBranchUrl]);

  /**
   * Récupère le statut de service de la branche
   */
  const fetchServiceStatus = useCallback(async () => {
    if (!activeBranchId) {
      setServiceStatus(null);
      return;
    }

    setIsLoadingService(true);
    setServiceError(null);

    try {
      const response = await api.get(`${getBranchUrl(activeBranchId)}/service-status`);
      setServiceStatus(response.data);
    } catch (err) {
      console.error('Erreur lors du chargement du statut de service:', err);
      setServiceError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setIsLoadingService(false);
    }
  }, [activeBranchId, getBranchUrl]);

  /**
   * Récupère les statistiques de la branche
   */
  const fetchStatistics = useCallback(async (period: 'day' | 'week' | 'month' | 'year' = 'month') => {
    if (!activeBranchId) {
      setStatistics(null);
      return;
    }

    setIsLoadingStatistics(true);
    setStatisticsError(null);

    try {
      const response = await api.get(`${getBranchUrl(activeBranchId)}/statistics`, {
        params: { period }
      });
      setStatistics(response.data);
    } catch (err) {
      console.error('Erreur lors du chargement des statistiques:', err);
      setStatisticsError(err instanceof Error ? err : new Error('Erreur inconnue'));
    } finally {
      setIsLoadingStatistics(false);
    }
  }, [activeBranchId, getBranchUrl]);

  /**
   * Met à jour la configuration de la branche
   */
  const updateBranchConfig = useCallback(async (updates: BranchConfigUpdate): Promise<Record<string, unknown>> => {
    if (!activeBranchId) {
      throw new Error('Aucune branche active');
    }

    try {
      const response = await api.patch(`${getBranchUrl(activeBranchId)}/config`, updates);
      
      // Mettre à jour la config locale
      if (branch) {
        setBranch({
          ...branch,
          config: { ...branch.config, ...updates }
        });
      }
      
      return response.data;
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la configuration:', err);
      throw err;
    }
  }, [activeBranchId, getBranchUrl, branch]);

  /**
   * Définit la branche active pour l'utilisateur
   */
  const setActiveBranch = useCallback(async (branchId: string) => {
    try {
      // Appeler l'API pour mettre à jour la branche active de l'utilisateur
      await api.post('/users/me/active-branch', { branch_id: branchId });
      
      // Mettre à jour le store utilisateur - UTILISER updateUser au lieu de updateUser inexistant
      if (updateUser) {
        updateUser({ branch_id: branchId } as any);
      }
      
      // Recharger les données de la branche
      await fetchBranch();
      await fetchServiceStatus();
      await fetchStatistics();
    } catch (err) {
      console.error('Erreur lors du changement de branche active:', err);
      throw err;
    }
  }, [fetchBranch, fetchServiceStatus, fetchStatistics, updateUser]);

  /**
   * Efface la branche active
   */
  const clearActiveBranch = useCallback(() => {
    setBranch(null);
    setServiceStatus(null);
    setStatistics(null);
    setError(null);
    setServiceError(null);
    setStatisticsError(null);
  }, []);

  /**
   * Rafraîchit toutes les données
   */
  const refreshAll = useCallback(async () => {
    await Promise.all([
      fetchBranch(),
      fetchServiceStatus(),
      fetchStatistics(),
    ]);
  }, [fetchBranch, fetchServiceStatus, fetchStatistics]);

  // Chargement initial
  useEffect(() => {
    if (!isAuthenticated) {
      clearActiveBranch();
      setIsLoading(false);
      return;
    }

    refreshAll();
  }, [activeBranchId, isAuthenticated, refreshAll, clearActiveBranch]);

  // Rafraîchissement périodique du statut de service (toutes les 5 minutes)
  useEffect(() => {
    if (!activeBranchId) return;

    const interval = setInterval(() => {
      fetchServiceStatus();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [activeBranchId, fetchServiceStatus]);

  return {
    // Données
    id: branch?.id || null,
    name: branch?.name || null,
    code: branch?.code || null,
    address: branch?.address || null,
    city: branch?.city || null,
    country: branch?.country || null,
    phone: branch?.phone || null,
    email: branch?.email || null,
    isActive: branch?.is_active ?? false,
    isMainBranch: branch?.is_main_branch ?? false,
    parentPharmacyId: branch?.parent_pharmacy_id || null,
    parentPharmacyName: branch?.parent_pharmacy_name || null,
    managerName: branch?.manager_name || null,
    config: branch?.config || null,
    
    // Statut service
    serviceStatus,
    
    // Statistiques
    statistics,
    
    // États
    isLoading,
    isLoadingService,
    isLoadingStatistics,
    error,
    serviceError,
    statisticsError,
    
    // Actions
    refreshBranch: fetchBranch,
    refreshServiceStatus: fetchServiceStatus,
    refreshStatistics: fetchStatistics,
    updateBranchConfig,
    setActiveBranch,
    clearActiveBranch,
  };
}

export default useActiveBranch;