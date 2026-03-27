// hooks/useAlerts.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { inventoryService } from '@/services/inventoryService';
import type { StockAlert, ExpiryAlert } from '@/types/inventory.types';

// Type pour une alerte unifiée (peut être utilisée pour l'affichage)
export interface UnifiedAlert {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'expired' | 'expiring_soon';
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  productId?: string;
  productName?: string;
  currentStock?: number;
  threshold?: number;
  expiryDate?: string;
  daysLeft?: number;
  createdAt: Date;
}

interface AlertsData {
  stock: {
    out_of_stock: StockAlert[];
    low_stock: StockAlert[];
    counts: {
      out_of_stock: number;
      low_stock: number;
    };
  };
  expiry: {
    expired: ExpiryAlert[];
    expiring_soon: ExpiryAlert[];
    counts: {
      expired: number;
      expiring_soon: number;
    };
  };
  totalCount: number;
  lastUpdated: Date | null;
}

interface UseAlertsOptions {
  autoRefresh?: boolean;
  refreshInterval?: number; // en millisecondes
  expiryDays?: number;
  pharmacyId?: string; // AJOUTÉ : filtrer par pharmacie
  branchId?: string; // AJOUTÉ : filtrer par branche
  onError?: (error: Error) => void;
  onSuccess?: (data: AlertsData) => void;
}

interface UseAlertsReturn extends AlertsData {
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  refreshStockAlerts: () => Promise<void>;
  refreshExpiryAlerts: () => Promise<void>;
  stopAutoRefresh: () => void;
  startAutoRefresh: () => void;
  isAutoRefreshing: boolean;
  // AJOUTÉ : propriété alerts pour un accès unifié
  alerts: UnifiedAlert[];
}

/**
 * Hook pour gérer les alertes de stock et d'expiration
 */
export const useAlerts = (options: UseAlertsOptions = {}): UseAlertsReturn => {
  const {
    autoRefresh = true,
    refreshInterval = 300000, // 5 minutes
    expiryDays = 30,
    pharmacyId,
    branchId,
    onError,
    onSuccess,
  } = options;

  // États
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [stockAlerts, setStockAlerts] = useState<{
    out_of_stock: StockAlert[];
    low_stock: StockAlert[];
    counts: { out_of_stock: number; low_stock: number };
  }>({
    out_of_stock: [],
    low_stock: [],
    counts: { out_of_stock: 0, low_stock: 0 },
  });
  
  const [expiryAlerts, setExpiryAlerts] = useState<{
    expired: ExpiryAlert[];
    expiring_soon: ExpiryAlert[];
    counts: { expired: number; expiring_soon: number };
  }>({
    expired: [],
    expiring_soon: [],
    counts: { expired: 0, expiring_soon: 0 },
  });
  
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(autoRefresh);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Fonction utilitaire pour obtenir les jours restants
  const getDaysUntilExpiry = (alert: ExpiryAlert): number => {
    return alert.days_until_expiry ?? alert.days_remaining;
  };

  // Convertir les alertes de stock en alertes unifiées
  const convertStockToUnifiedAlerts = useCallback((
    alerts: StockAlert[],
    type: 'out_of_stock' | 'low_stock'
  ): UnifiedAlert[] => {
    return alerts.map((alert) => ({
      id: `stock_${type}_${alert.product_id}`,
      type,
      title: type === 'out_of_stock' ? 'Rupture de stock' : 'Stock faible',
      message: type === 'out_of_stock'
        ? `${alert.product_name || 'Produit'} est en rupture de stock`
        : `${alert.product_name || 'Produit'} a un stock faible (${alert.current_stock} ${alert.unit || 'unités'} restant${alert.current_stock > 1 ? 's' : ''})`,
      severity: type === 'out_of_stock' ? 'critical' : 'warning',
      productId: alert.product_id,
      productName: alert.product_name,
      currentStock: alert.current_stock,
      threshold: alert.threshold,
      createdAt: new Date(alert.created_at),
    }));
  }, []);

  // Convertir les alertes d'expiration en alertes unifiées
  const convertExpiryToUnifiedAlerts = useCallback((
    alerts: ExpiryAlert[],
    type: 'expired' | 'expiring_soon'
  ): UnifiedAlert[] => {
    return alerts.map((alert) => {
      const daysLeft = getDaysUntilExpiry(alert);
      return {
        id: `expiry_${type}_${alert.product_id}`,
        type,
        title: type === 'expired' ? 'Produit expiré' : 'Expiration proche',
        message: type === 'expired'
          ? `${alert.product_name || 'Produit'} est expiré depuis le ${new Date(alert.expiry_date).toLocaleDateString('fr-FR')}`
          : `${alert.product_name || 'Produit'} expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''} (le ${new Date(alert.expiry_date).toLocaleDateString('fr-FR')})`,
        severity: type === 'expired' ? 'critical' : 'warning',
        productId: alert.product_id,
        productName: alert.product_name,
        expiryDate: alert.expiry_date,
        daysLeft: daysLeft,
        createdAt: new Date(alert.created_at),
      };
    });
  }, []);

  // Générer la liste unifiée des alertes
  const unifiedAlerts = useMemo<UnifiedAlert[]>(() => {
    const alerts: UnifiedAlert[] = [
      ...convertStockToUnifiedAlerts(stockAlerts.out_of_stock, 'out_of_stock'),
      ...convertStockToUnifiedAlerts(stockAlerts.low_stock, 'low_stock'),
      ...convertExpiryToUnifiedAlerts(expiryAlerts.expired, 'expired'),
      ...convertExpiryToUnifiedAlerts(expiryAlerts.expiring_soon, 'expiring_soon'),
    ];
    
    // Trier par sévérité (critical d'abord) puis par date
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    return alerts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0);
    });
  }, [stockAlerts, expiryAlerts, convertStockToUnifiedAlerts, convertExpiryToUnifiedAlerts]);

  // Rafraîchir les alertes de stock
  const refreshStockAlerts = useCallback(async () => {
    try {
      // Appel sans paramètres car getStockAlerts ne prend pas d'arguments
      const data = await inventoryService.getStockAlerts();
      
      // Filtrer les alertes par pharmacie et branche si nécessaire
      let outOfStock = data.out_of_stock;
      let lowStock = data.low_stock;
      
      if (pharmacyId) {
        outOfStock = outOfStock.filter(alert => alert.pharmacy_id === pharmacyId);
        lowStock = lowStock.filter(alert => alert.pharmacy_id === pharmacyId);
      }
      
      if (branchId) {
        outOfStock = outOfStock.filter(alert => alert.branch_id === branchId);
        lowStock = lowStock.filter(alert => alert.branch_id === branchId);
      }
      
      setStockAlerts({
        out_of_stock: outOfStock,
        low_stock: lowStock,
        counts: {
          out_of_stock: outOfStock.length,
          low_stock: lowStock.length,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors de la récupération des alertes stock');
      setError(error);
      onError?.(error);
    }
  }, [pharmacyId, branchId, onError]);

  // Rafraîchir les alertes d'expiration
  const refreshExpiryAlerts = useCallback(async () => {
    try {
      // Appel avec le paramètre expiryDays
      const data = await inventoryService.getExpiryAlerts(expiryDays);
      
      // Filtrer les alertes par pharmacie et branche si nécessaire
      let expired = data.expired;
      let expiringSoon = data.expiring_soon;
      
      if (pharmacyId) {
        expired = expired.filter(alert => alert.pharmacy_id === pharmacyId);
        expiringSoon = expiringSoon.filter(alert => alert.pharmacy_id === pharmacyId);
      }
      
      if (branchId) {
        expired = expired.filter(alert => alert.branch_id === branchId);
        expiringSoon = expiringSoon.filter(alert => alert.branch_id === branchId);
      }
      
      setExpiryAlerts({
        expired: expired,
        expiring_soon: expiringSoon,
        counts: {
          expired: expired.length,
          expiring_soon: expiringSoon.length,
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors de la récupération des alertes expiration');
      setError(error);
      onError?.(error);
    }
  }, [expiryDays, pharmacyId, branchId, onError]);

  // Rafraîchir toutes les alertes
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        refreshStockAlerts(),
        refreshExpiryAlerts(),
      ]);
      
      const now = new Date();
      setLastUpdated(now);
      
      onSuccess?.({
        stock: stockAlerts,
        expiry: expiryAlerts,
        totalCount: stockAlerts.counts.out_of_stock + stockAlerts.counts.low_stock + 
                   expiryAlerts.counts.expired + expiryAlerts.counts.expiring_soon,
        lastUpdated: now,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors du rafraîchissement des alertes');
      setError(error);
      onError?.(error);
    } finally {
      setLoading(false);
    }
  }, [refreshStockAlerts, refreshExpiryAlerts, stockAlerts, expiryAlerts, onSuccess, onError]);

  // Démarrer le rafraîchissement automatique
  const startAutoRefresh = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    const id = setInterval(() => {
      refresh();
    }, refreshInterval);
    
    setIntervalId(id);
    setIsAutoRefreshing(true);
  }, [refresh, refreshInterval]);

  // Arrêter le rafraîchissement automatique
  const stopAutoRefresh = useCallback(() => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsAutoRefreshing(false);
  }, [intervalId]);

  // Calcul du total des alertes
  const totalCount = useMemo(() => {
    return stockAlerts.counts.out_of_stock + 
           stockAlerts.counts.low_stock + 
           expiryAlerts.counts.expired + 
           expiryAlerts.counts.expiring_soon;
  }, [stockAlerts.counts, expiryAlerts.counts]);

  // Initialisation
  useEffect(() => {
    refresh();
    
    if (autoRefresh) {
      startAutoRefresh();
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Recharger quand pharmacyId ou branchId change
  useEffect(() => {
    if (pharmacyId) {
      refresh();
    }
  }, [pharmacyId, branchId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Données originales (pour compatibilité)
    stock: stockAlerts,
    expiry: expiryAlerts,
    totalCount,
    lastUpdated,
    
    // AJOUTÉ : propriété alerts pour un accès unifié
    alerts: unifiedAlerts,
    
    // État
    loading,
    error,
    
    // Actions
    refresh,
    refreshStockAlerts,
    refreshExpiryAlerts,
    stopAutoRefresh,
    startAutoRefresh,
    isAutoRefreshing,
  };
};

export default useAlerts;