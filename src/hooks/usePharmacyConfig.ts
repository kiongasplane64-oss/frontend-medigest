// hooks/usePharmacyConfig.ts
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import api from '@/api/client';
import type { PharmacyConfig, SalesType } from '@/types/inventory.types';

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
  salesType: SalesType; // AJOUTÉ : type de vente configuré
  automaticPricingMethod: string; // AJOUTÉ : méthode de calcul automatique
  automaticPricingValue: number; // AJOUTÉ : valeur pour le calcul automatique
  calculAutoPrix: boolean; // AJOUTÉ : flag pour calcul auto des prix
}

const DEFAULT_CONFIG: Partial<PharmacyConfig> = {
  primaryCurrency: 'CDF',
  taxRate: 0,
  lowStockThreshold: 10,
  expiryWarningDays: 30,
  salesType: 'both', // AJOUTÉ : valeur par défaut
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
    { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 1 },
    { code: 'USD', symbol: '$', isActive: false, exchangeRate: 2500 },
    { code: 'EUR', symbol: '€', isActive: false, exchangeRate: 2700 },
  ],
  calcul_auto_prix: true,
  marge_par_defaut: 25,
  taux_tva: 0,
  lock_stock_modification: false,
};

// Symboles de devise par défaut
const CURRENCY_SYMBOLS: Record<string, string> = {
  CDF: 'FC',
  USD: '$',
  EUR: '€',
  GBP: '£',
  XAF: 'FCFA',
  XOF: 'CFA',
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
    isError,
  } = useQuery({
    queryKey: ['pharmacy-config', pharmacyId],
    queryFn: async () => {
      if (!pharmacyId) {
        console.log('usePharmacyConfig: Pas de pharmacyId fourni');
        return null;
      }

      console.log('usePharmacyConfig: Récupération config pour pharmacyId:', pharmacyId);

      try {
        // Essayer de récupérer la configuration via l'API des pharmacies
        const response = await api.get(`/pharmacies/${pharmacyId}/config`);
        console.log('usePharmacyConfig: Config récupérée depuis /config:', response.data);
        
        // S'assurer que salesType est présent
        const config = response.data?.config || response.data;
        
        // Si config est un objet direct (pas encapsulé dans .config)
        if (config && typeof config === 'object') {
          return {
            ...config,
            salesType: config.salesType || DEFAULT_CONFIG.salesType,
          };
        }
        
        return config;
      } catch (err) {
        console.warn('usePharmacyConfig: Impossible de récupérer la config depuis /config, tentative alternative...', err);

        try {
          // Fallback: récupérer la pharmacie complète
          const response = await api.get(`/pharmacies/${pharmacyId}`);
          console.log('usePharmacyConfig: Pharmacie récupérée:', response.data);
          
          // Extraire la configuration des paramètres de la pharmacie
          const pharmacy = response.data;
          const config = pharmacy?.config || {};
          
          // Construire la configuration à partir des champs explicites si présents
          const fallbackConfig: Partial<PharmacyConfig> = {
            primaryCurrency: pharmacy?.primary_currency || pharmacy?.primaryCurrency || DEFAULT_CONFIG.primaryCurrency,
            taxRate: pharmacy?.tax_rate ?? pharmacy?.taxRate ?? DEFAULT_CONFIG.taxRate,
            lowStockThreshold: pharmacy?.low_stock_threshold ?? pharmacy?.lowStockThreshold ?? DEFAULT_CONFIG.lowStockThreshold,
            expiryWarningDays: pharmacy?.expiry_warning_days ?? pharmacy?.expiryWarningDays ?? DEFAULT_CONFIG.expiryWarningDays,
            salesType: pharmacy?.sales_type ?? pharmacy?.salesType ?? DEFAULT_CONFIG.salesType,
            calcul_auto_prix: pharmacy?.calcul_auto_prix ?? pharmacy?.autoPricingEnabled ?? DEFAULT_CONFIG.calcul_auto_prix,
            marge_par_defaut: pharmacy?.marge_par_defaut ?? pharmacy?.defaultMargin ?? DEFAULT_CONFIG.marge_par_defaut,
            taux_tva: pharmacy?.taux_tva ?? pharmacy?.taxRate ?? DEFAULT_CONFIG.taux_tva,
            lock_stock_modification: pharmacy?.lock_stock_modification ?? false,
          };
          
          return {
            ...config,
            ...fallbackConfig,
          };
        } catch (fallbackErr) {
          console.error('usePharmacyConfig: Erreur récupération configuration:', fallbackErr);
          return null;
        }
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes (réduit pour plus de réactivité)
    gcTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!pharmacyId,
    retry: 2,
    retryDelay: 1000,
  });

  // Configuration fusionnée avec les valeurs par défaut
  const config = useMemo<PharmacyConfig | null>(() => {
    // Si pas de pharmacyId, retourner null (pas de configuration)
    if (!pharmacyId) {
      console.log('usePharmacyConfig: Pas de pharmacyId, configuration null');
      return null;
    }
    
    const mergedConfig: PharmacyConfig = {
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
      // S'assurer que salesType est défini
      salesType: (pharmacyData?.salesType || DEFAULT_CONFIG.salesType) as SalesType,
      // S'assurer que calcul_auto_prix est défini
      calcul_auto_prix: pharmacyData?.calcul_auto_prix ?? DEFAULT_CONFIG.calcul_auto_prix,
      marge_par_defaut: pharmacyData?.marge_par_defaut ?? DEFAULT_CONFIG.marge_par_defaut,
      taux_tva: pharmacyData?.taux_tva ?? DEFAULT_CONFIG.taux_tva,
      lock_stock_modification: pharmacyData?.lock_stock_modification ?? DEFAULT_CONFIG.lock_stock_modification,
    } as PharmacyConfig;
    
    console.log('usePharmacyConfig: Configuration fusionnée:', {
      salesType: mergedConfig.salesType,
      primaryCurrency: mergedConfig.primaryCurrency,
      calcul_auto_prix: mergedConfig.calcul_auto_prix,
      automaticPricingEnabled: mergedConfig.automaticPricing?.enabled,
    });
    
    return mergedConfig;
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
    return config?.taxRate ?? config?.taux_tva ?? DEFAULT_CONFIG.taxRate ?? 0;
  }, [config]);

  const defaultMargin = useMemo(() => {
    return config?.marginConfig?.defaultMargin ?? config?.marge_par_defaut ?? DEFAULT_CONFIG.marginConfig?.defaultMargin ?? 25;
  }, [config]);

  const isAutomaticPricing = useMemo(() => {
    return config?.automaticPricing?.enabled ?? (config?.calcul_auto_prix ?? DEFAULT_CONFIG.automaticPricing?.enabled ?? false);
  }, [config]);

  const automaticPricingMethod = useMemo(() => {
    return config?.automaticPricing?.method ?? 'percentage';
  }, [config]);

  const automaticPricingValue = useMemo(() => {
    return config?.automaticPricing?.value ?? config?.marge_par_defaut ?? 25;
  }, [config]);

  const calculAutoPrix = useMemo(() => {
    return config?.calcul_auto_prix ?? true;
  }, [config]);

  const salesType = useMemo<SalesType>(() => {
    const type = config?.salesType;
    if (type === 'wholesale' || type === 'retail' || type === 'both') {
      return type;
    }
    return 'both';
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
        numericPrice = parseFloat(price.replace(/[^0-9.-]/g, ''));
        if (isNaN(numericPrice)) {
          console.warn('formatPrice: Prix invalide:', price);
          return `0 ${primaryCurrency}`;
        }
      } else {
        numericPrice = price;
      }

      // Recherche la devise active
      const activeCurrency = config?.currencies?.find(c => c.code === primaryCurrency && c.isActive);
      const symbol = activeCurrency?.symbol || CURRENCY_SYMBOLS[primaryCurrency] || primaryCurrency;

      // Formatage selon la devise
      let formattedValue: string;
      if (primaryCurrency === 'USD' || primaryCurrency === 'EUR' || primaryCurrency === 'GBP') {
        formattedValue = numericPrice.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else {
        // Pour CDF, XAF, etc. - pas de décimales
        formattedValue = Math.round(numericPrice).toLocaleString('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      }

      return `${formattedValue} ${symbol}`;
    };
  }, [config, primaryCurrency]);

  // Log d'erreur pour débogage
  if (isError && error) {
    console.error('usePharmacyConfig: Erreur de chargement:', error);
  }

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
    salesType, // AJOUTÉ
    automaticPricingMethod, // AJOUTÉ
    automaticPricingValue, // AJOUTÉ
    calculAutoPrix, // AJOUTÉ
  };
}

export default usePharmacyConfig;