// components/inventory/ProductTableRow.tsx
import { Eye, Edit2, Package, TrendingDown, CalendarClock } from 'lucide-react';
import type { Product, SalesType, Category } from '@/types/inventory.types';

interface ProductTableRowProps {
  product: Product;
  onEdit: () => void;
  onView: () => void;
  formatPrice: (price: number | undefined | null, currency?: 'CDF' | 'USD') => string;
  salesType?: SalesType;
  exchangeRate?: number;
  primaryCurrency?: 'CDF' | 'USD';
}

// Helper function pour afficher la catégorie
const getCategoryName = (category: string | Category | undefined): string => {
  if (!category) return '-';
  if (typeof category === 'string') return category;
  return category.name || '-';
};

// Helper pour obtenir le statut d'expiration
const getExpiryStatus = (expiryDate: string | null | undefined): 'expired' | 'critical' | 'warning' | 'valid' | null => {
  if (!expiryDate) return null;
  
  const expiry = new Date(expiryDate);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return 'expired';
  if (daysLeft < 7) return 'critical';
  if (daysLeft < 30) return 'warning';
  return 'valid';
};

// Helper pour le texte du statut d'expiration
const getExpiryStatusText = (status: 'expired' | 'critical' | 'warning' | 'valid' | null): string => {
  switch (status) {
    case 'expired': return 'Expiré';
    case 'critical': return 'Expire < 7j';
    case 'warning': return 'Expire < 30j';
    default: return '';
  }
};

// Helper pour le style du statut d'expiration
const getExpiryStatusStyle = (status: 'expired' | 'critical' | 'warning' | 'valid' | null): string => {
  switch (status) {
    case 'expired': return 'bg-red-100 text-red-800 border-red-200';
    case 'critical': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default: return '';
  }
};

// Helper pour le style du statut de stock
const getStockStatusStyle = (status: string | undefined): string => {
  switch (status) {
    case 'out_of_stock': return 'bg-red-100 text-red-800 border-red-200';
    case 'low_stock': return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'over_stock': return 'bg-blue-100 text-blue-800 border-blue-200';
    default: return 'bg-green-100 text-green-800 border-green-200';
  }
};

// Helper pour le texte du statut de stock
const getStockStatusText = (status: string | undefined, quantity: number, threshold: number): string => {
  switch (status) {
    case 'out_of_stock': return 'Rupture';
    case 'low_stock': return `Stock faible (${quantity}/${threshold})`;
    case 'over_stock': return 'Surstock';
    default: return 'Normal';
  }
};

export default function ProductTableRow({
  product,
  onEdit,
  onView,
  formatPrice,
  salesType = 'both',
  exchangeRate = 1,
  primaryCurrency = 'CDF',
}: ProductTableRowProps) {
  
  // Obtenir le prix de vente selon le type de vente
  const getSellingPrice = (): number => {
    if (salesType === 'wholesale') {
      return (product as any).selling_price_wholesale || product.selling_price || 0;
    }
    if (salesType === 'retail') {
      return (product as any).selling_price_retail || product.selling_price || 0;
    }
    return product.selling_price || 0;
  };

  // Obtenir le prix d'achat
  const getPurchasePrice = (): number => {
    return product.purchase_price || 0;
  };

  // Calculer la marge
  const getMargin = (): number => {
    const selling = getSellingPrice();
    const purchase = getPurchasePrice();
    if (purchase <= 0) return 0;
    return ((selling - purchase) / purchase) * 100;
  };

  // Calculer la valeur du stock
  const getStockValue = (): number => {
    return getSellingPrice() * (product.quantity || 0);
  };

  // Calculer les prix dans les deux devises
  const getPriceInBothCurrencies = (price: number) => {
    if (primaryCurrency === 'CDF') {
      return {
        cdf: price,
        usd: price / exchangeRate,
      };
    } else {
      return {
        usd: price,
        cdf: price * exchangeRate,
      };
    }
  };

  const expiryStatus = getExpiryStatus(product.expiry_date);
  const sellingPrice = getSellingPrice();
  const purchasePrice = getPurchasePrice();
  const margin = getMargin();
  const stockValue = getStockValue();
  const { cdf: priceCDF, usd: priceUSD } = getPriceInBothCurrencies(sellingPrice);
  const { cdf: purchaseCDF, usd: purchaseUSD } = getPriceInBothCurrencies(purchasePrice);
  const { cdf: valueCDF, usd: valueUSD } = getPriceInBothCurrencies(stockValue);

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
      {/* Code produit */}
      <td className="px-4 py-3">
        <div className="font-mono text-sm text-slate-600">
          {product.code || '-'}
        </div>
      </td>

      {/* Produit (Nom + Catégorie) */}
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{product.name}</div>
        <div className="text-xs text-slate-400 mt-0.5">{getCategoryName(product.category)}</div>
      </td>

      {/* Quantité + Unité */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className={`font-semibold ${
            (product.quantity || 0) === 0 ? 'text-red-600' :
            (product.quantity || 0) <= (product.alert_threshold || 0) ? 'text-amber-600' : 
            'text-slate-700'
          }`}>
            {product.quantity || 0}
          </span>
          <span className="text-xs text-slate-400">{product.unit || 'unité'}</span>
        </div>
      </td>

      {/* Prix d'achat */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className="font-medium text-slate-700">{formatPrice(purchaseCDF, 'CDF')}</span>
          {exchangeRate !== 1 && (
            <span className="text-xs text-slate-400">{formatPrice(purchaseUSD, 'USD')}</span>
          )}
        </div>
      </td>

      {/* Prix de vente */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className="font-bold text-medical">{formatPrice(priceCDF, 'CDF')}</span>
          {exchangeRate !== 1 && (
            <span className="text-xs text-slate-400">{formatPrice(priceUSD, 'USD')}</span>
          )}
        </div>
        {salesType === 'both' && (product as any).selling_price_wholesale && (
          <div className="text-xs text-slate-400 mt-0.5">
            Gros: {formatPrice((product as any).selling_price_wholesale, 'CDF')}
          </div>
        )}
      </td>

      {/* Marge */}
      <td className="px-4 py-3 text-right">
        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          margin >= 30 ? 'bg-green-100 text-green-700' :
          margin >= 15 ? 'bg-blue-100 text-blue-700' :
          margin > 0 ? 'bg-yellow-100 text-yellow-700' :
          'bg-red-100 text-red-700'
        }`}>
          <TrendingDown size={12} className={margin >= 0 ? 'rotate-180' : ''} />
          {margin.toFixed(1)}%
        </div>
      </td>

      {/* Valeur du stock */}
      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end">
          <span className="font-medium text-slate-700">{formatPrice(valueCDF, 'CDF')}</span>
          {exchangeRate !== 1 && (
            <span className="text-xs text-slate-400">{formatPrice(valueUSD, 'USD')}</span>
          )}
        </div>
      </td>

      {/* Statuts */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {/* Statut de stock */}
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStockStatusStyle(product.stock_status)}`}>
            <Package size={10} />
            {getStockStatusText(product.stock_status, product.quantity || 0, product.alert_threshold || 0)}
          </span>

          {/* Statut d'expiration */}
          {expiryStatus && expiryStatus !== 'valid' && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryStatusStyle(expiryStatus)}`}>
              <CalendarClock size={10} />
              {getExpiryStatusText(expiryStatus)}
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={onView}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Voir détails"
          >
            <Eye size={16} className="text-slate-400 hover:text-medical transition-colors" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Modifier"
          >
            <Edit2 size={16} className="text-slate-400 hover:text-medical transition-colors" />
          </button>
        </div>
      </td>
    </tr>
  );
}