// hooks/useCurrencyConfig.ts
import { useEffect, useState, useCallback, useMemo } from 'react';
import api from '@/api/client';

interface Currency {
  code: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number;
}

interface CurrencyConfig {
  primaryCurrency: string;
  currencies: Currency[];
  isLoading: boolean;
  error: string | null;
}

interface UseCurrencyConfigReturn extends CurrencyConfig {
  formatPrice: (amount: number, targetCurrency?: string) => string;
  convertAmount: (amount: number, fromCurrency: string, toCurrency: string) => number;
  getAvailableCurrencies: () => Currency[];
  getExchangeRate: (fromCurrency: string, toCurrency: string) => number;
}

// Valeurs par défaut pour la RDC
const DEFAULT_PRIMARY_CURRENCY = 'CDF';
const DEFAULT_CURRENCIES: Currency[] = [
  { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 1 },
  { code: 'USD', symbol: '$', isActive: true, exchangeRate: 2500 }
];

export function useCurrencyConfig(pharmacyId?: string): UseCurrencyConfigReturn {
  const [config, setConfig] = useState<CurrencyConfig>({
    primaryCurrency: DEFAULT_PRIMARY_CURRENCY,
    currencies: DEFAULT_CURRENCIES,
    isLoading: true,
    error: null
  });

  // Charger la configuration depuis l'API
  useEffect(() => {
    const loadConfig = async () => {
      if (!pharmacyId) {
        setConfig(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const response = await api.get(`/pharmacies/${pharmacyId}/config`);
        const configData = response.data?.config || response.data;
        
        if (configData) {
          // S'assurer que les taux de change sont corrects
          let currencies: Currency[] = configData.currencies || DEFAULT_CURRENCIES;
          
          // Vérifier que USD a un taux de base correct
          const usdCurrency: Currency | undefined = currencies.find((c: Currency) => c.code === 'USD');
          if (usdCurrency && usdCurrency.exchangeRate !== 1) {
            // Ajuster tous les taux par rapport à USD
            const usdRate: number = usdCurrency.exchangeRate;
            currencies = currencies.map((c: Currency) => ({
              ...c,
              exchangeRate: c.code === 'USD' ? 1 : c.exchangeRate / usdRate
            }));
          }
          
          setConfig({
            primaryCurrency: configData.primaryCurrency || DEFAULT_PRIMARY_CURRENCY,
            currencies: currencies,
            isLoading: false,
            error: null
          });
        } else {
          setConfig(prev => ({ ...prev, isLoading: false }));
        }
      } catch (error) {
        console.error('Erreur chargement config devises:', error);
        setConfig(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: 'Impossible de charger la configuration des devises' 
        }));
      }
    };

    loadConfig();
  }, [pharmacyId]);

  // Convertir un montant d'une devise à une autre
  const convertAmount = useCallback((amount: number, fromCurrency: string, toCurrency: string): number => {
    // Validation des entrées
    if (fromCurrency === toCurrency) return amount;
    if (isNaN(amount) || amount === null || amount === undefined) return 0;
    
    const fromCurr: Currency | undefined = config.currencies.find((c: Currency) => c.code === fromCurrency);
    const toCurr: Currency | undefined = config.currencies.find((c: Currency) => c.code === toCurrency);
    
    if (!fromCurr || !toCurr) return amount;
    
    // Si la devise source est USD, convertir directement
    if (fromCurrency === 'USD') {
      return amount * toCurr.exchangeRate;
    }
    
    // Si la devise cible est USD, convertir directement
    if (toCurrency === 'USD') {
      return amount / fromCurr.exchangeRate;
    }
    
    // Sinon, passer par USD comme intermédiaire
    const amountInUSD: number = amount / fromCurr.exchangeRate;
    return amountInUSD * toCurr.exchangeRate;
  }, [config.currencies]);

  // Obtenir le taux de change entre deux devises
  const getExchangeRate = useCallback((fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return 1;
    
    const fromCurr: Currency | undefined = config.currencies.find((c: Currency) => c.code === fromCurrency);
    const toCurr: Currency | undefined = config.currencies.find((c: Currency) => c.code === toCurrency);
    
    if (!fromCurr || !toCurr) return 1;
    
    // Calculer le taux via USD
    const rateInUSD: number = 1 / fromCurr.exchangeRate;
    return rateInUSD * toCurr.exchangeRate;
  }, [config.currencies]);

  // Formater un prix
  const formatPrice = useCallback((amount: number, targetCurrency?: string): string => {
    // Validation des entrées
    if (isNaN(amount) || amount === null || amount === undefined) {
      return `0 ${config.primaryCurrency}`;
    }

    const currencyCode: string = targetCurrency || config.primaryCurrency;
    const currency: Currency | undefined = config.currencies.find((c: Currency) => c.code === currencyCode && c.isActive);
    
    if (!currency) {
      return `${amount.toLocaleString()} ${config.primaryCurrency}`;
    }

    let displayAmount: number = amount;
    
    // Convertir si nécessaire (le montant est toujours stocké en devise primaire)
    if (currencyCode !== config.primaryCurrency) {
      displayAmount = convertAmount(amount, config.primaryCurrency, currencyCode);
    }

    // Formatage selon la devise
    let formattedValue: string;
    const isDecimalCurrency: boolean = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'CHF', 'JPY'].includes(currencyCode);
    
    if (isDecimalCurrency) {
      formattedValue = displayAmount.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      // Pour CDF, XAF, XOF, etc. - pas de décimales
      formattedValue = Math.round(displayAmount).toLocaleString('fr-FR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });
    }

    return `${formattedValue} ${currency.symbol}`;
  }, [config.currencies, config.primaryCurrency, convertAmount]);

  // Obtenir les devises actives
  const getAvailableCurrencies = useCallback((): Currency[] => {
    return config.currencies.filter((c: Currency) => c.isActive);
  }, [config.currencies]);

  // Version memoized de la config pour éviter les re-rendus inutiles
  const memoizedReturn = useMemo((): UseCurrencyConfigReturn => ({
    ...config,
    formatPrice,
    convertAmount,
    getAvailableCurrencies,
    getExchangeRate,
  }), [config, formatPrice, convertAmount, getAvailableCurrencies, getExchangeRate]);

  return memoizedReturn;
}

export default useCurrencyConfig;