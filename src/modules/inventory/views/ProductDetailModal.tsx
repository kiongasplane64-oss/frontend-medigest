// components/inventory/ProductDetailModal.tsx
import { useState, useMemo } from 'react';
import { X, Edit2, Package, Calendar, Tag, Building2, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Product, SalesType } from '@/types/inventory.types';
import StockAlertBadge from './StockAlertBadge';

interface ProductDetailModalProps {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  formatPrice: (price: number | undefined | null) => string;
  salesType?: SalesType;
}

interface ExpiryInfo {
  status: 'expired' | 'critical' | 'warning' | 'valid' | null;
  text: string;
  color: string;
  daysLeft?: number;
}

export default function ProductDetailModal({
  product,
  onClose,
  onEdit,
  formatPrice,
  salesType = 'both',
}: ProductDetailModalProps) {
  const [showAllDetails, setShowAllDetails] = useState(false);

  // Calcul des informations d'expiration
  const expiryInfo = useMemo((): ExpiryInfo => {
    if (!product.expiry_date) {
      return { status: null, text: '', color: '' };
    }

    const expiryDate = new Date(product.expiry_date);
    const now = new Date();
    const daysLeft = differenceInDays(expiryDate, now);
    
    if (daysLeft < 0) {
      return { 
        status: 'expired', 
        text: 'Expiré', 
        color: 'text-red-600',
        daysLeft
      };
    }
    if (daysLeft < 7) {
      return { 
        status: 'critical', 
        text: `Expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`, 
        color: 'text-orange-600',
        daysLeft
      };
    }
    if (daysLeft < 30) {
      return { 
        status: 'warning', 
        text: `Expire dans ${daysLeft} jours`, 
        color: 'text-amber-600',
        daysLeft
      };
    }
    return { 
      status: 'valid', 
      text: `Expire le ${format(expiryDate, 'dd MMMM yyyy', { locale: fr })}`, 
      color: 'text-slate-500',
      daysLeft
    };
  }, [product.expiry_date]);

  // Récupération du prix de vente selon le type de vente
  const sellingPrice = useMemo((): number => {
    if (salesType === 'wholesale') {
      return (product as any).selling_price_wholesale ?? product.selling_price;
    }
    if (salesType === 'retail') {
      return (product as any).selling_price_retail ?? product.selling_price;
    }
    return product.selling_price;
  }, [product, salesType]);

  // Prix de vente alternatif (pour l'affichage both)
  const wholesalePrice = useMemo((): number | null => {
    if (salesType === 'both' && (product as any).selling_price_wholesale) {
      return (product as any).selling_price_wholesale;
    }
    return null;
  }, [product, salesType]);

  const retailPrice = useMemo((): number | null => {
    if (salesType === 'both' && (product as any).selling_price_retail) {
      return (product as any).selling_price_retail;
    }
    return null;
  }, [product, salesType]);

  // Catégorie formatée
  const categoryName = useMemo((): string => {
    if (typeof product.category === 'string') return product.category;
    if (product.category?.name) return product.category.name;
    if (product.category_id) return product.category_id;
    return '-';
  }, [product.category, product.category_id]);

  // Statut de stock avec message
  const stockStatusInfo = useMemo(() => {
    const quantity = product.quantity ?? 0;
    const threshold = product.alert_threshold ?? 10;

    if (quantity <= 0) {
      return { status: 'out_of_stock', text: 'Rupture de stock', color: 'text-red-600', icon: AlertTriangle };
    }
    if (quantity <= threshold) {
      return { status: 'low_stock', text: `Stock faible (${quantity} ≤ ${threshold})`, color: 'text-amber-600', icon: AlertTriangle };
    }
    return { status: 'in_stock', text: `Stock disponible (${quantity} unités)`, color: 'text-green-600', icon: Package };
  }, [product.quantity, product.alert_threshold]);

  const StockStatusIcon = stockStatusInfo.icon;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* En-tête */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              product.stock_status === 'out_of_stock' ? 'bg-red-100' :
              product.stock_status === 'low_stock' ? 'bg-amber-100' : 'bg-medical/10'
            }`}>
              <Package className={product.stock_status === 'out_of_stock' ? 'text-red-600' : 'text-medical'} size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{product.name}</h2>
              <p className="text-sm text-slate-500">
                {product.code || product.barcode ? (
                  <>
                    {product.code && `Code: ${product.code}`}
                    {product.code && product.barcode && ' • '}
                    {product.barcode && `Code-barres: ${product.barcode}`}
                  </>
                ) : 'Sans code'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              title="Modifier"
            >
              <Edit2 size={18} className="text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Image */}
          {product.image_url && (
            <div className="flex justify-center bg-slate-50 rounded-xl p-4">
              <img 
                src={product.image_url} 
                alt={product.name} 
                className="max-h-48 rounded-lg object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Badges de statut */}
          <div className="flex flex-wrap gap-2">
            <StockAlertBadge
              stockStatus={product.stock_status}
              quantity={product.quantity}
              threshold={product.alert_threshold}
            />
            {expiryInfo.status && expiryInfo.status !== 'valid' && (
              <StockAlertBadge
                expiryStatus={expiryInfo.status}
                expiryDate={product.expiry_date}
              />
            )}
          </div>

          {/* Informations principales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stock */}
            <div className={`rounded-xl p-4 ${
              stockStatusInfo.status === 'out_of_stock' ? 'bg-red-50 border border-red-200' :
              stockStatusInfo.status === 'low_stock' ? 'bg-amber-50 border border-amber-200' :
              'bg-slate-50'
            }`}>
              <div className={`flex items-center gap-2 mb-2 ${
                stockStatusInfo.status === 'out_of_stock' ? 'text-red-600' :
                stockStatusInfo.status === 'low_stock' ? 'text-amber-600' :
                'text-slate-500'
              }`}>
                <StockStatusIcon size={16} />
                <span className="text-sm font-medium">Stock</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">
                {product.quantity} <span className="text-sm font-normal text-slate-500">unités</span>
              </p>
              <p className={`text-xs mt-1 ${
                stockStatusInfo.status === 'out_of_stock' ? 'text-red-600' :
                stockStatusInfo.status === 'low_stock' ? 'text-amber-600' :
                'text-slate-400'
              }`}>
                {stockStatusInfo.text}
              </p>
              {product.alert_threshold > 0 && (
                <p className="text-xs text-slate-400 mt-1">
                  Seuil d'alerte: {product.alert_threshold}
                </p>
              )}
            </div>

            {/* Prix de vente */}
            <div className="bg-medical/10 rounded-xl p-4 border border-medical/20">
              <div className="flex items-center gap-2 text-medical mb-2">
                <Tag size={16} />
                <span className="text-sm font-medium">Prix de vente</span>
              </div>
              <p className="text-2xl font-bold text-medical">
                {formatPrice(sellingPrice)}
              </p>
              {wholesalePrice && retailPrice && (
                <div className="mt-2 text-xs text-slate-500 space-y-1">
                  <p>Gros: {formatPrice(wholesalePrice)}</p>
                  <p>Détail: {formatPrice(retailPrice)}</p>
                </div>
              )}
              {product.margin_rate !== undefined && (
                <p className="text-xs text-slate-400 mt-2">
                  Marge: {product.margin_rate.toFixed(1)}%
                </p>
              )}
            </div>
          </div>

          {/* Informations financières */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Prix d'achat (HT)</label>
              <p className="text-slate-700 font-medium">{formatPrice(product.purchase_price)}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">TVA</label>
              <p className="text-slate-700 font-medium">
                {product.has_tva ? `${product.tva_rate}%` : 'Non applicable'}
              </p>
            </div>
          </div>

          {/* Date d'expiration */}
          {product.expiry_date && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              expiryInfo.status === 'expired' ? 'bg-red-50' :
              expiryInfo.status === 'critical' ? 'bg-orange-50' :
              expiryInfo.status === 'warning' ? 'bg-amber-50' : 'bg-slate-50'
            }`}>
              <Calendar size={18} className={expiryInfo.color} />
              <span className={`text-sm ${expiryInfo.color}`}>
                {expiryInfo.text}
              </span>
              {expiryInfo.daysLeft !== undefined && expiryInfo.daysLeft >= 0 && expiryInfo.daysLeft < 90 && (
                <span className="text-xs text-slate-400 ml-auto">
                  {expiryInfo.daysLeft} jours restants
                </span>
              )}
            </div>
          )}

          {/* Pharmacie et succursale */}
          {(product.pharmacy_id || product.branch_id) && (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <Building2 size={16} className="text-slate-400" />
              <div className="flex-1">
                {product.pharmacy_id && (
                  <p className="text-xs text-slate-500">
                    Pharmacie: <span className="text-slate-700 font-mono text-xs">{product.pharmacy_id.slice(0, 8)}...</span>
                  </p>
                )}
                {product.branch_id && (
                  <p className="text-xs text-slate-500">
                    Succursale: <span className="text-slate-700 font-mono text-xs">{product.branch_id.slice(0, 8)}...</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bouton voir tous les détails */}
          <button
            onClick={() => setShowAllDetails(!showAllDetails)}
            className="text-sm text-medical hover:underline flex items-center gap-1"
          >
            {showAllDetails ? 'Masquer les détails' : 'Voir tous les détails'}
          </button>

          {/* Détails supplémentaires */}
          {showAllDetails && (
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              <div>
                <label className="text-xs text-slate-400 block">Catégorie</label>
                <p className="text-slate-700 font-medium">{categoryName}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">Fournisseur</label>
                <p className="text-slate-700 font-medium">{product.supplier || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">Emplacement</label>
                <p className="text-slate-700 font-medium">{product.location || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">Numéro de lot</label>
                <p className="text-slate-700 font-medium font-mono text-sm">{product.batch_number || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">Unité de mesure</label>
                <p className="text-slate-700 font-medium">{product.unit || 'unité'}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">Valeur du stock</label>
                <p className="text-slate-700 font-medium">{formatPrice(product.selling_value)}</p>
              </div>
              {product.description && (
                <div className="col-span-2">
                  <label className="text-xs text-slate-400 block">Description</label>
                  <p className="text-slate-700 text-sm mt-1">{product.description}</p>
                </div>
              )}
            </div>
          )}

          {/* Statistiques de vente */}
          {product.total_sold !== undefined && product.total_sold > 0 && (
            <div className="bg-slate-50 rounded-xl p-4">
              <h4 className="font-medium text-slate-700 mb-3">Statistiques de vente</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-800">{product.total_sold}</p>
                  <p className="text-xs text-slate-400">Vendus (30j)</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-800">
                    {product.last_sale_date ? format(new Date(product.last_sale_date), 'dd/MM/yyyy', { locale: fr }) : '-'}
                  </p>
                  <p className="text-xs text-slate-400">Dernière vente</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-slate-800">
                    {product.margin_rate ? `${product.margin_rate.toFixed(1)}%` : '-'}
                  </p>
                  <p className="text-xs text-slate-400">Marge</p>
                </div>
              </div>
            </div>
          )}

          {/* Message si pas de statistiques */}
          {(!product.total_sold || product.total_sold === 0) && (
            <div className="bg-slate-50 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-400">Aucune vente enregistrée pour ce produit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}