// utils/formatters.ts

// Types de devises supportées
export type Currency = 'CDF' | 'USD' | 'FC' | 'GNF' | 'XOF';

// Configuration des devises
const currencyConfig: Record<Currency, { code: string; symbol: string; decimals: number }> = {
  CDF: { code: 'CDF', symbol: 'FC', decimals: 0 },
  USD: { code: 'USD', symbol: '$', decimals: 2 },
  FC: { code: 'CDF', symbol: 'FC', decimals: 0 },
  GNF: { code: 'GNF', symbol: 'FG', decimals: 0 },
  XOF: { code: 'XOF', symbol: 'FCFA', decimals: 0 }
};

// Taux de conversion (à remplacer par une API ou configuration dynamique)
const conversionRates: Record<string, number> = {
  'USD_CDF': 2500,
  'CDF_USD': 0.0004,
  'USD_XOF': 600,
  'XOF_USD': 0.00167,
  'USD_GNF': 8500,
  'GNF_USD': 0.000118,
  'CDF_XOF': 0.24, // 1 CDF = 0.24 XOF
  'XOF_CDF': 4.17, // 1 XOF = 4.17 CDF
};

// Formatage de prix avec devise configurable
export const formatPrice = (
  price: number | null | undefined, 
  currency: Currency = 'CDF',
  options?: { showSymbol?: boolean; showCode?: boolean; fallback?: string }
): string => {
  // Gestion des valeurs nulles/undefined
  if (price === null || price === undefined || isNaN(price)) {
    return options?.fallback || '-';
  }
  
  const config = currencyConfig[currency] || currencyConfig.CDF;
  const { showSymbol = true, showCode = false } = options || {};
  
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'decimal',
    minimumFractionDigits: config.decimals,
    maximumFractionDigits: config.decimals
  });
  
  const formattedNumber = formatter.format(price);
  
  if (showSymbol) {
    return `${formattedNumber} ${config.symbol}`;
  }
  
  if (showCode) {
    return `${formattedNumber} ${config.code}`;
  }
  
  return formattedNumber;
};

// Alias pour la rétrocompatibilité
export const formatCurrency = formatPrice;

// Formatage spécifique USD
export const formatUSD = (price: number | null | undefined): string => {
  return formatPrice(price, 'USD');
};

// Formatage spécifique CDF/FC
export const formatCDF = (price: number | null | undefined): string => {
  return formatPrice(price, 'CDF');
};

// Formatage spécifique XOF/FCFA
export const formatXOF = (price: number | null | undefined): string => {
  return formatPrice(price, 'XOF');
};

// Formatage avec conversion
export const formatWithConversion = (
  price: number | null | undefined,
  fromCurrency: Currency,
  toCurrency: Currency,
  rate?: number
): string => {
  if (price === null || price === undefined || isNaN(price)) {
    return '-';
  }
  
  let convertedPrice = price;
  
  if (fromCurrency !== toCurrency) {
    const key = `${fromCurrency}_${toCurrency}`;
    const conversionRate = rate || conversionRates[key] || 1;
    convertedPrice = price * conversionRate;
  }
  
  return formatPrice(convertedPrice, toCurrency);
};

// Formatage de date
export const formatDate = (date: string | Date | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    // Vérifier si la date est valide
    if (isNaN(d.getTime())) return '-';
    
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return '-';
  }
};

export const formatDateTime = (date: string | Date | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) return '-';
    
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
};

export const formatTime = (date: string | Date | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) return '-';
    
    return d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '-';
  }
};

export const formatRelativeTime = (date: string | Date | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) return '-';
    
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
      return 'à l\'instant';
    } else if (diffMin < 60) {
      return `il y a ${diffMin} minute${diffMin > 1 ? 's' : ''}`;
    } else if (diffHour < 24) {
      return `il y a ${diffHour} heure${diffHour > 1 ? 's' : ''}`;
    } else if (diffDay < 7) {
      return `il y a ${diffDay} jour${diffDay > 1 ? 's' : ''}`;
    } else {
      return formatDate(date);
    }
  } catch {
    return '-';
  }
};

// Formatage de nombre
export const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  
  return new Intl.NumberFormat('fr-FR').format(num);
};

export const formatPercentage = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) return '-';
  
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value / 100);
};

export const formatPercentageRaw = (value: number | null | undefined, total: number): string => {
  if (!value || !total || total === 0) return '0%';
  
  const percentage = (value / total) * 100;
  
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(percentage) + '%';
};

// Formatage de texte
export const truncateText = (text: string | null | undefined, maxLength: number): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const capitalizeFirst = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
};

export const capitalizeWords = (text: string | null | undefined): string => {
  if (!text) return '';
  return text.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

// Formatage de téléphone
export const formatPhoneNumber = (phone: string | null | undefined): string => {
  if (!phone) return '-';
  
  // Nettoyer le numéro
  const cleaned = phone.replace(/\D/g, '');
  
  // Format: +243 XX XXX XXXX
  if (cleaned.length === 12 && cleaned.startsWith('243')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  
  // Format: 0XX XXX XXX
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  
  return phone;
};

// Formatage de quantité avec unité
export const formatQuantity = (
  quantity: number | null | undefined, 
  unit: string = '',
  options?: { showUnit: boolean }
): string => {
  if (quantity === null || quantity === undefined || isNaN(quantity)) return '-';
  
  const formatted = formatNumber(quantity);
  const { showUnit = true } = options || {};
  
  if (showUnit && unit) {
    return `${formatted} ${unit}`;
  }
  
  return formatted;
};

// Status labels
export const getStockStatusLabel = (status: string): { label: string; color: string } => {
  switch (status) {
    case 'in_stock':
      return { label: 'En stock', color: 'emerald' };
    case 'low_stock':
      return { label: 'Stock bas', color: 'amber' };
    case 'out_of_stock':
      return { label: 'Rupture', color: 'red' };
    case 'over_stock':
      return { label: 'Surstock', color: 'blue' };
    default:
      return { label: status || 'Inconnu', color: 'slate' };
  }
};

export const getExpiryStatusLabel = (status: string): { label: string; color: string } => {
  switch (status) {
    case 'valid':
      return { label: 'Valide', color: 'emerald' };
    case 'warning':
      return { label: 'Expire bientôt', color: 'amber' };
    case 'critical':
      return { label: 'Expiration critique', color: 'orange' };
    case 'expired':
      return { label: 'Expiré', color: 'red' };
    default:
      return { label: status || 'Inconnu', color: 'slate' };
  }
};

export const getPaymentMethodLabel = (method: string): { label: string; color: string } => {
  switch (method) {
    case 'cash':
      return { label: 'Espèces', color: 'green' };
    case 'mobile':
      return { label: 'Mobile Money', color: 'blue' };
    case 'account':
      return { label: 'Compte Client', color: 'purple' };
    case 'card':
      return { label: 'Carte bancaire', color: 'indigo' };
    case 'check':
      return { label: 'Chèque', color: 'pink' };
    default:
      return { label: method || 'Inconnu', color: 'slate' };
  }
};

export const getSaleStatusLabel = (status: string): { label: string; color: string } => {
  switch (status) {
    case 'pending':
      return { label: 'En attente', color: 'amber' };
    case 'synced':
      return { label: 'Synchronisé', color: 'green' };
    case 'cancelled':
      return { label: 'Annulé', color: 'red' };
    default:
      return { label: status || 'Inconnu', color: 'slate' };
  }
};

// Utilitaires de fichier
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(bytes / Math.pow(1024, i)) + ' ' + units[i];
};

export const formatFileName = (base: string, extension: string = 'pdf'): string => {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  // Nettoyer le nom de base
  const cleanBase = base.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  
  return `${cleanBase}_${dateStr}_${timeStr}.${extension}`;
};

// Utilitaires de calcul
export const calculateTax = (
  amount: number,
  taxRate: number,
  included: boolean = false
): { tax: number; total: number } => {
  if (included) {
    const tax = amount - (amount / (1 + taxRate / 100));
    return { tax, total: amount };
  } else {
    const tax = amount * (taxRate / 100);
    return { tax, total: amount + tax };
  }
};

export const calculateDiscount = (
  amount: number,
  discountRate: number,
  type: 'percentage' | 'fixed' = 'percentage'
): { discount: number; total: number } => {
  if (type === 'percentage') {
    const discount = amount * (discountRate / 100);
    return { discount, total: amount - discount };
  } else {
    return { discount: discountRate, total: amount - discountRate };
  }
};

export const calculateProfit = (
  sellingPrice: number,
  costPrice: number,
  quantity: number = 1
): { profit: number; margin: number } => {
  const profit = (sellingPrice - costPrice) * quantity;
  const margin = sellingPrice > 0 ? (profit / (sellingPrice * quantity)) * 100 : 0;
  
  return { profit, margin };
};

// Validation
export const isValidEmail = (email: string): boolean => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const isValidPhone = (phone: string): boolean => {
  const re = /^[0-9+\-\s]{9,}$/;
  return re.test(phone);
};

export const isValidDate = (date: any): boolean => {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
};

// Export par défaut avec toutes les fonctions
export default {
  formatPrice,
  formatCurrency,
  formatUSD,
  formatCDF,
  formatXOF,
  formatWithConversion,
  formatDate,
  formatDateTime,
  formatTime,
  formatRelativeTime,
  formatNumber,
  formatPercentage,
  formatPercentageRaw,
  truncateText,
  capitalizeFirst,
  capitalizeWords,
  formatPhoneNumber,
  formatQuantity,
  getStockStatusLabel,
  getExpiryStatusLabel,
  getPaymentMethodLabel,
  getSaleStatusLabel,
  formatFileSize,
  formatFileName,
  calculateTax,
  calculateDiscount,
  calculateProfit,
  isValidEmail,
  isValidPhone,
  isValidDate
};