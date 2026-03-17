// hooks/useDashboard.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import { useAuthStore } from '@/store/useAuthStore';
import { useCallback, useMemo } from 'react';

// Types exports pour une utilisation dans d'autres composants
export interface DashboardStats {
  daily_sales: number;
  monthly_sales: number;
  total_stock_value: number;
  total_products: number;
  total_customers: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
  expired_count: number;
  sales_trend?: number;
  potential_profit?: number;
  net_profit?: number;
  active_users?: number;
}

export interface DashboardAlert {
  id: number | string;
  product_name: string;
  current_stock: number;
  threshold: number;
  type: 'low_stock' | 'expired' | 'expiring';
  severity: 'low' | 'medium' | 'high';
  message: string;
  expiry_date?: string;
  created_at: string;
  is_resolved: boolean;
}

export interface PendingTransfer {
  id: number | string;
  product_id: number;
  product_name: string;
  quantity: number;
  from_pharmacy_id: number;
  from_pharmacy_name: string;
  to_pharmacy_id: number;
  to_pharmacy_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
  notes?: string;
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[];
  total: number;
}

export interface DashboardError {
  message: string;
  status?: number;
  code?: string;
}

// Configuration des clés de requête pour une meilleure organisation
export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (pharmacyId?: number) => [...dashboardKeys.all, 'stats', pharmacyId] as const,
  alerts: (pharmacyId?: number) => [...dashboardKeys.all, 'alerts', pharmacyId] as const,
  transfers: (pharmacyId?: number) => [...dashboardKeys.all, 'transfers', pharmacyId] as const,
  salesHistory: (pharmacyId?: number) => [...dashboardKeys.all, 'sales-history', pharmacyId] as const,
};

export const useDashboard = () => {
  const queryClient = useQueryClient();
  const { user, currentPharmacyId } = useAuthStore();

  // Validation du pharmacyId
  const pharmacyId = useMemo(() => {
    if (!currentPharmacyId) return undefined;
    const id = Number(currentPharmacyId);
    return isNaN(id) ? undefined : id;
  }, [currentPharmacyId]);

  // Requête pour les statistiques principales
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
    isFetching: statsFetching,
    dataUpdatedAt: statsUpdatedAt
  } = useQuery<DashboardStats, DashboardError>({
    queryKey: dashboardKeys.stats(pharmacyId),
    queryFn: async () => {
      try {
        const response = await dashboardService.getDashboardStats({
          pharmacy_id: pharmacyId
        });
        
        // Transformation des données si nécessaire
        return {
          ...response,
          // Valeurs par défaut pour éviter undefined
          sales_trend: response.sales_trend ?? 0,
          potential_profit: response.potential_profit ?? 0,
          net_profit: response.net_profit ?? 0,
          active_users: response.active_users ?? 0
        };
      } catch (error) {
        console.error('Erreur lors du chargement des stats:', error);
        throw error;
      }
    },
    enabled: !!pharmacyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (remplace cacheTime)
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  // Requête pour les alertes
  const {
    data: alertsResponse,
    isLoading: alertsLoading,
    error: alertsError,
    refetch: refetchAlerts,
    isFetching: alertsFetching
  } = useQuery<DashboardAlertsResponse, DashboardError>({
    queryKey: dashboardKeys.alerts(pharmacyId),
    queryFn: async () => {
      try {
        const response = await dashboardService.getAlerts({
          pharmacy_id: pharmacyId,
          limit: 10,
          include_resolved: false
        });
        
        return {
          alerts: response.alerts || [],
          total: response.total || 0
        };
      } catch (error) {
        console.error('Erreur lors du chargement des alertes:', error);
        throw error;
      }
    },
    enabled: !!pharmacyId,
    refetchInterval: 30000, // 30 secondes
    staleTime: 10000, // 10 secondes
    retry: 3,
  });

  // Requête pour les transferts en attente
  const {
    data: transfers = [],
    isLoading: transfersLoading,
    error: transfersError,
    refetch: refetchTransfers,
    isFetching: transfersFetching
  } = useQuery<PendingTransfer[], DashboardError>({
    queryKey: dashboardKeys.transfers(pharmacyId),
    queryFn: async () => {
      try {
        return await dashboardService.getPendingTransfers(pharmacyId);
      } catch (error) {
        console.error('Erreur lors du chargement des transferts:', error);
        throw error;
      }
    },
    enabled: !!pharmacyId,
    refetchInterval: 30000, // 30 secondes
    staleTime: 10000,
    retry: 2,
  });

  // Transformation des alertes avec typage strict
  const transformedAlerts = useMemo(() => {
    if (!alertsResponse?.alerts) return [];
    
    return alertsResponse.alerts.map((alert): DashboardAlert => ({
      id: alert.id,
      product_name: alert.product_name,
      current_stock: alert.current_stock ?? 0,
      threshold: alert.threshold ?? 0,
      type: alert.type || 'low_stock',
      severity: alert.severity || 'medium',
      message: alert.message || `Stock bas pour ${alert.product_name}`,
      expiry_date: alert.expiry_date,
      created_at: alert.created_at || new Date().toISOString(),
      is_resolved: alert.is_resolved ?? false
    }));
  }, [alertsResponse]);

  // Comptage des alertes par sévérité
  const alertsBySeverity = useMemo(() => {
    return transformedAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [transformedAlerts]);

  // Alertes critiques (high severity)
  const criticalAlerts = useMemo(() => {
    return transformedAlerts.filter(alert => alert.severity === 'high');
  }, [transformedAlerts]);

  // Vérification si les données sont en cours de chargement
  const isLoading = statsLoading || alertsLoading || transfersLoading;
  const isFetching = statsFetching || alertsFetching || transfersFetching;

  // Gestion des erreurs combinées
  const error = useMemo(() => {
    return statsError || alertsError || transfersError;
  }, [statsError, alertsError, transfersError]);

  // Rafraîchissement de toutes les données
  const refetch = useCallback(() => {
    refetchStats();
    refetchAlerts();
    refetchTransfers();
  }, [refetchStats, refetchAlerts, refetchTransfers]);

  // Invalidation du cache
  const invalidateCache = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
  }, [queryClient]);

  // Rafraîchissement avec cache refresh
  const refreshWithCacheClear = useCallback(async () => {
    try {
      await dashboardService.refreshDashboardCache(pharmacyId);
      await invalidateCache();
    } catch (error) {
      console.error('Erreur lors du refresh cache:', error);
    }
  }, [pharmacyId, invalidateCache]);

  // Détermination des rôles
  const userRoles = useMemo(() => {
    const role = user?.role?.toLowerCase() || '';
    return {
      isAdmin: role === 'admin' || role === 'super_admin',
      isSuperAdmin: role === 'super_admin',
      isManager: role === 'manager' || role === 'admin' || role === 'super_admin',
      isPharmacist: role === 'pharmacist' || role === 'manager' || role === 'admin',
      isAssistant: role === 'assistant'
    };
  }, [user?.role]);

  // Statistiques formatées pour l'affichage
  const formattedStats = useMemo(() => {
    if (!stats) return null;
    
    return {
      ...stats,
      profitMargin: stats.monthly_sales > 0 
        ? ((stats.net_profit || 0) / stats.monthly_sales * 100).toFixed(1)
        : '0',
      stockTurnover: stats.total_stock_value > 0
        ? (stats.monthly_sales / stats.total_stock_value).toFixed(2)
        : '0'
    };
  }, [stats]);

  return {
    // Données brutes
    stats,
    alerts: transformedAlerts,
    transfers,
    
    // Données formatées
    formattedStats,
    criticalAlerts,
    alertsBySeverity,
    
    // États de chargement
    isLoading,
    isFetching,
    isStatsLoading: statsLoading,
    isAlertsLoading: alertsLoading,
    isTransfersLoading: transfersLoading,
    
    // Métadonnées
    error,
    statsError,
    alertsError,
    transfersError,
    lastUpdated: statsUpdatedAt,
    
    // Actions
    refetch,
    refetchStats,
    refetchAlerts,
    refetchTransfers,
    invalidateCache,
    refreshWithCacheClear,
    
    // Rôles utilisateur
    ...userRoles,
    
    // Informations de contexte
    pharmacyId,
    hasData: !!(stats && (transformedAlerts.length > 0 || transfers.length > 0)),
    isAuthenticated: !!user,
    
    // Utilitaires
    hasCriticalAlerts: criticalAlerts.length > 0,
    totalAlerts: transformedAlerts.length,
    pendingTransfersCount: transfers.length
  };
};

// Hook séparé pour l'historique des ventes (optionnel)
export const useSalesHistory = (period: 'day' | 'week' | 'month' | 'year' = 'month', limit: number = 30) => {
  const { currentPharmacyId } = useAuthStore();
  
  const pharmacyId = useMemo(() => {
    if (!currentPharmacyId) return undefined;
    const id = Number(currentPharmacyId);
    return isNaN(id) ? undefined : id;
  }, [currentPharmacyId]);

  return useQuery({
    queryKey: [...dashboardKeys.all, 'sales-history', pharmacyId, period, limit],
    queryFn: () => dashboardService.getSalesHistory({
      pharmacy_id: pharmacyId,
      period,
      limit
    }),
    enabled: !!pharmacyId,
    staleTime: 5 * 60 * 1000,
  });
};

// Hook pour les indicateurs de performance
export const usePerformanceIndicators = () => {
  const { currentPharmacyId } = useAuthStore();
  
  const pharmacyId = useMemo(() => {
    if (!currentPharmacyId) return undefined;
    const id = Number(currentPharmacyId);
    return isNaN(id) ? undefined : id;
  }, [currentPharmacyId]);

  return useQuery({
    queryKey: [...dashboardKeys.all, 'performance', pharmacyId],
    queryFn: () => dashboardService.getPerformanceIndicators(pharmacyId),
    enabled: !!pharmacyId,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Hook pour la résolution d'alertes
export const useResolveAlert = () => {
  const queryClient = useQueryClient();
  const { currentPharmacyId } = useAuthStore();

  const resolveAlert = useCallback(async (alertId: number) => {
    try {
      const result = await dashboardService.resolveAlert(alertId);
      
      // Invalider le cache des alertes après résolution
      await queryClient.invalidateQueries({ 
        queryKey: dashboardKeys.alerts(Number(currentPharmacyId))
      });
      
      return result;
    } catch (error) {
      console.error('Erreur lors de la résolution de l\'alerte:', error);
      throw error;
    }
  }, [currentPharmacyId, queryClient]);

  return { resolveAlert };
};

export default useDashboard;