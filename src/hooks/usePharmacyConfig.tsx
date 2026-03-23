// hooks/usePharmacyConfig.ts
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '@/api/client';
import type { PharmacyConfig } from '@/types/inventory.types';

interface UsePharmacyConfigReturn {
  config: PharmacyConfig | null;
  isLoading: boolean;
  error: Error | null;
  formatPrice: (price: number | string | undefined | null) => string;
  primaryCurrency: string;
  lowStockThreshold: number;
  expiryWarningDays: number;
  taxRate: number;
  defaultMargin: number;
  isAutomaticPricing: boolean;
  workingHours: PharmacyConfig['workingHours'] | null;
}

const DEFAULT_CONFIG: Partial<PharmacyConfig> = {
  primaryCurrency: 'CDF',
  taxRate: 0,
  lowStockThreshold: 10,
  expiryWarningDays: 30,
  marginConfig: {
    defaultMargin: 25,
    minMargin: 10,
    maxMargin: 50,
  },
  automaticPricing: {
    enabled: false,
    method: 'percentage',
    value: 25,
  },
  currencies: [
    { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 2500 },
    { code: 'USD', symbol: '$', isActive: true, exchangeRate: 1 },
  ],
};

/**
 * Hook pour récupérer et gérer la configuration d'une pharmacie
 * @param pharmacyId - ID de la pharmacie (optionnel)
 * @returns Configuration de la pharmacie et utilitaires
 */
export function usePharmacyConfig(pharmacyId?: string): UsePharmacyConfigReturn {
  // Récupération de la configuration depuis l'API
  const {
    data: pharmacyData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['pharmacy-config', pharmacyId],
    queryFn: async () => {
      if (!pharmacyId) return null;
      
      try {
        // Essayer de récupérer la configuration via l'API des pharmacies
        const response = await api.get(`/pharmacies/${pharmacyId}/config`);
        return response.data?.config || null;
      } catch (err) {
        console.warn('Impossible de récupérer la config depuis /config, tentative alternative...', err);
        
        try {
          // Fallback: récupérer la pharmacie complète
          const response = await api.get(`/pharmacies/${pharmacyId}`);
          return response.data?.config || null;
        } catch (fallbackErr) {
          console.error('Erreur récupération configuration:', fallbackErr);
          return null;
        }
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!pharmacyId,
    retry: 1,
  });

  // Configuration fusionnée avec les valeurs par défaut
  const config = useMemo<PharmacyConfig | null>(() => {
    if (!pharmacyData && !pharmacyId) return null;
    
    return {
      ...DEFAULT_CONFIG,
      ...(pharmacyData || {}),
      currencies: pharmacyData?.currencies || DEFAULT_CONFIG.currencies,
      marginConfig: {
        ...DEFAULT_CONFIG.marginConfig,
        ...(pharmacyData?.marginConfig || {}),
      },
      automaticPricing: {
        ...DEFAULT_CONFIG.automaticPricing,
        ...(pharmacyData?.automaticPricing || {}),
      },
    } as PharmacyConfig;
  }, [pharmacyData, pharmacyId]);

  // Récupération des valeurs avec fallback
  const primaryCurrency = useMemo(() => {
    return config?.primaryCurrency || DEFAULT_CONFIG.primaryCurrency || 'CDF';
  }, [config]);

  const lowStockThreshold = useMemo(() => {
    return config?.lowStockThreshold ?? DEFAULT_CONFIG.lowStockThreshold ?? 10;
  }, [config]);

  const expiryWarningDays = useMemo(() => {
    return config?.expiryWarningDays ?? DEFAULT_CONFIG.expiryWarningDays ?? 30;
  }, [config]);

  const taxRate = useMemo(() => {
    return config?.taxRate ?? DEFAULT_CONFIG.taxRate ?? 0;
  }, [config]);

  const defaultMargin = useMemo(() => {
    return config?.marginConfig?.defaultMargin ?? DEFAULT_CONFIG.marginConfig?.defaultMargin ?? 25;
  }, [config]);

  const isAutomaticPricing = useMemo(() => {
    return config?.automaticPricing?.enabled ?? DEFAULT_CONFIG.automaticPricing?.enabled ?? false;
  }, [config]);

  const workingHours = useMemo(() => {
    return config?.workingHours ?? null;
  }, [config]);

  /**
   * Formate un prix selon la configuration de la pharmacie
   * @param price - Prix à formater (nombre, string, undefined, null)
   * @returns Chaîne formatée avec la devise
   */
  const formatPrice = useMemo(() => {
    return (price: number | string | undefined | null): string => {
      if (price === undefined || price === null || price === '') {
        return `0 ${primaryCurrency}`;
      }

      let numericPrice: number;

      if (typeof price === 'string') {
        numericPrice = parseFloat(price);
        if (isNaN(numericPrice)) return `0 ${primaryCurrency}`;
      } else {
        numericPrice = price;
      }

      // Recherche la devise active
      const activeCurrency = config?.currencies?.find(c => c.code === primaryCurrency && c.isActive);
      const symbol = activeCurrency?.symbol || (primaryCurrency === 'USD' ? '$' : primaryCurrency === 'EUR' ? '€' : 'FC');

      // Formatage selon la devise
      let formattedValue: string;
      if (primaryCurrency === 'USD' || primaryCurrency === 'EUR') {
        formattedValue = numericPrice.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else {
        formattedValue = numericPrice.toLocaleString('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      }

      return `${formattedValue} ${symbol}`;
    };
  }, [config, primaryCurrency]);

  return {
    config,
    isLoading,
    error: error as Error | null,
    formatPrice,
    primaryCurrency,
    lowStockThreshold,
    expiryWarningDays,
    taxRate,
    defaultMargin,
    isAutomaticPricing,
    workingHours,
  };
}

export default usePharmacyConfig;