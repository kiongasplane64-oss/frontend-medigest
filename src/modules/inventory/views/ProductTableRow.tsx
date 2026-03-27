// components/inventory/ProductTableRow.tsx
import { Edit2, Eye } from 'lucide-react';
import type { Product, SalesType, Category } from '@/types/inventory.types';
import StockAlertBadge from './StockAlertbadge';

interface ProductTableRowProps {
  product: Product;
  onEdit: () => void;
  onView: () => void;
  formatPrice: (price: number | undefined | null) => string;
  salesType?: SalesType;
}

// Helper function pour afficher la catégorie
const getCategoryName = (category: string | Category | undefined): string => {
  if (!category) return '-';
  if (typeof category === 'string') return category;
  return category.name || '-';
};

export default function ProductTableRow({
  product,
  onEdit,
  onView,
  formatPrice,
  salesType = 'both',
}: ProductTableRowProps) {
  const getSellingPrice = () => {
    if (salesType === 'wholesale') {
      return (product as any).selling_price_wholesale || product.selling_price;
    }
    if (salesType === 'retail') {
      return (product as any).selling_price_retail || product.selling_price;
    }
    return product.selling_price;
  };

  const getExpiryStatus = () => {
    if (!product.expiry_date) return null;
    const expiryDate = new Date(product.expiry_date);
    const now = new Date();
    const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft < 0) return 'expired';
    if (daysLeft < 7) return 'critical';
    if (daysLeft < 30) return 'warning';
    return 'valid';
  };

  const expiryStatus = getExpiryStatus();

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{product.name}</div>
        <div className="text-xs text-slate-400">{getCategoryName(product.category)}</div>
       </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {product.code || '-'}
       </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-medium ${product.quantity === 0 ? 'text-red-500' : 'text-slate-700'}`}>
          {product.quantity}
        </span>
        {product.alert_threshold > 0 && (
          <span className="text-xs text-slate-400 ml-1">
            / {product.alert_threshold}
          </span>
        )}
       </td>
      <td className="px-4 py-3 text-right">
        <div className="font-medium text-medical">
          {formatPrice(getSellingPrice())}
        </div>
        {salesType === 'both' && (product as any).selling_price_wholesale && (
          <div className="text-xs text-slate-400">
            Gros: {formatPrice((product as any).selling_price_wholesale)}
          </div>
        )}
       </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          <StockAlertBadge
            stockStatus={product.stock_status}
            quantity={product.quantity}
            threshold={product.alert_threshold}
          />
          {expiryStatus && expiryStatus !== 'valid' && (
            <StockAlertBadge
              expiryStatus={expiryStatus}
              expiryDate={product.expiry_date}
            />
          )}
        </div>
       </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={onView}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Voir détails"
          >
            <Eye size={16} className="text-slate-400" />
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
            title="Modifier"
          >
            <Edit2 size={16} className="text-slate-400" />
          </button>
        </div>
       </td>
    </tr>
  );
}