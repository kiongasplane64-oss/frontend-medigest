// hooks/useCurrencyConfig.ts
import { useEffect, useState } from 'react';
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

export function useCurrencyConfig(pharmacyId?: string) {
  const [config, setConfig] = useState<CurrencyConfig>({
    primaryCurrency: 'CDF',
    currencies: [
      { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 2500 },
      { code: 'USD', symbol: '$', isActive: true, exchangeRate: 1 }
    ],
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const loadConfig = async () => {
      if (!pharmacyId) {
        setConfig(prev => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const response = await api.get(`/pharmacies/${pharmacyId}/config`);
        const configData = response.data.config;
        
        if (configData) {
          setConfig({
            primaryCurrency: configData.primaryCurrency || 'CDF',
            currencies: configData.currencies || config.currencies,
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

  const formatPrice = (amount: number, targetCurrency?: string): string => {
    if (isNaN(amount) || amount === null || amount === undefined) {
      return `0 ${config.primaryCurrency}`;
    }

    const currencyCode = targetCurrency || config.primaryCurrency;
    const currency = config.currencies.find(c => c.code === currencyCode && c.isActive);
    
    if (!currency) {
      return `${amount.toLocaleString()} ${config.primaryCurrency}`;
    }

    // Convertir le montant (stocké en devise primaire) vers la devise cible
    const primaryCurrency = config.currencies.find(c => c.code === config.primaryCurrency);
    if (!primaryCurrency) return `${amount.toLocaleString()} ${currencyCode}`;

    // Si la devise cible est la devise primaire, pas de conversion
    if (currencyCode === config.primaryCurrency) {
      return `${amount.toLocaleString(undefined, { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })} ${currency.symbol}`;
    }

    // Conversion: montant en devise primaire * taux de la devise cible
    let convertedAmount = amount;
    
    if (config.primaryCurrency === 'USD' && currencyCode === 'CDF') {
      // USD -> CDF
      convertedAmount = amount * currency.exchangeRate;
    } else if (config.primaryCurrency === 'CDF' && currencyCode === 'USD') {
      // CDF -> USD
      convertedAmount = amount / currency.exchangeRate;
    } else if (config.primaryCurrency !== currencyCode) {
      // Autres conversions via USD comme intermédiaire
      const usdRate = config.currencies.find(c => c.code === 'USD')?.exchangeRate || 1;
      const targetRate = currency.exchangeRate;
      
      if (config.primaryCurrency === 'USD') {
        convertedAmount = amount * targetRate;
      } else {
        // Convertir primaire -> USD -> cible
        const primaryToUSD = 1 / usdRate;
        convertedAmount = amount * primaryToUSD * targetRate;
      }
    }

    return `${convertedAmount.toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })} ${currency.symbol}`;
  };

  const convertAmount = (amount: number, fromCurrency: string, toCurrency: string): number => {
    if (fromCurrency === toCurrency) return amount;
    
    const fromCurr = config.currencies.find(c => c.code === fromCurrency);
    const toCurr = config.currencies.find(c => c.code === toCurrency);
    
    if (!fromCurr || !toCurr) return amount;
    
    // Convertir via USD comme référence
    const amountInUSD = fromCurrency === 'USD' ? amount : amount / fromCurr.exchangeRate;
    return toCurrency === 'USD' ? amountInUSD : amountInUSD * toCurr.exchangeRate;
  };

  const getAvailableCurrencies = () => config.currencies.filter(c => c.isActive);

  return {
    ...config,
    formatPrice,
    convertAmount,
    getAvailableCurrencies
  };
}