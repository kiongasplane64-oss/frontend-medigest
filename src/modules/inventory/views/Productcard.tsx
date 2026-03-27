// components/inventory/ProductCard.tsx
import { Edit2, Eye, Package, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Product, SalesType } from '@/types/inventory.types';

interface ProductCardProps {
  product: Product;
  onEdit: () => void;
  onView: () => void;
  formatPrice: (price: number | undefined | null) => string;
  salesType?: SalesType;
}

export default function ProductCard({
  product,
  onEdit,
  onView,
  formatPrice,
  salesType = 'both',
}: ProductCardProps) {
  const isExpired = product.expiry_date && new Date(product.expiry_date) < new Date();
  const expiringSoon = product.expiry_date && 
    new Date(product.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
    !isExpired;

  const getSellingPrice = () => {
    if (salesType === 'wholesale') {
      return (product as any).selling_price_wholesale || product.selling_price;
    }
    if (salesType === 'retail') {
      return (product as any).selling_price_retail || product.selling_price;
    }
    return product.selling_price;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image/Header */}
      <div className="h-32 bg-linear-to-r from-medical/20 to-medical/10 relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Package size={48} className="text-medical/40" />
          </div>
        )}
        
        {/* Alertes visuelles */}
        {product.stock_status === 'out_of_stock' && (
          <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded-full">
            Rupture
          </div>
        )}
        {product.stock_status === 'low_stock' && (
          <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
            Stock faible
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-slate-800 line-clamp-1" title={product.name}>
              {product.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{product.code || product.barcode || 'Sans code'}</p>
          </div>
          <div className="flex gap-1">
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
        </div>

        {/* Catégorie */}
        {product.category && (
          <p className="text-xs text-slate-400 mt-1">
            {typeof product.category === 'string' ? product.category : product.category?.name}
          </p>
        )}

        {/* Prix et stock */}
        <div className="mt-3 flex justify-between items-end">
          <div>
            <p className="text-lg font-bold text-medical">
              {formatPrice(getSellingPrice())}
            </p>
            {salesType === 'both' && (product as any).selling_price_wholesale && (
              <p className="text-xs text-slate-400">
                Gros: {formatPrice((product as any).selling_price_wholesale)}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className={`text-lg font-semibold ${product.quantity === 0 ? 'text-red-500' : 'text-slate-700'}`}>
              {product.quantity}
            </p>
            <p className="text-xs text-slate-400">en stock</p>
          </div>
        </div>

        {/* Date d'expiration */}
        {product.expiry_date && (
          <div className={`mt-2 flex items-center gap-1 text-xs ${
            isExpired ? 'text-red-500' : expiringSoon ? 'text-amber-500' : 'text-slate-400'
          }`}>
            <Calendar size={12} />
            <span>
              Expire le {format(new Date(product.expiry_date), 'dd/MM/yyyy', { locale: fr })}
              {expiringSoon && !isExpired && ' (bientôt)'}
            </span>
          </div>
        )}

        {/* Seuil d'alerte */}
        {product.alert_threshold > 0 && product.quantity > 0 && product.quantity <= product.alert_threshold && (
          <div className="mt-2 flex items-center gap-1 text-xs text-amber-500">
            <AlertTriangle size={12} />
            <span>Seuil: {product.alert_threshold}</span>
          </div>
        )}
      </div>
    </div>
  );
}