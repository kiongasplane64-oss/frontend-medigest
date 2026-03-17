// components/ApprovisionnerView.tsx
import { useState } from 'react';
import { Product } from '@/types/inventory.types';
import { inventoryService } from '@/services/inventoryService';
import { formatPrice } from '@/utils/formatters';
import {
  X, RefreshCw, Plus, Minus, Loader2, AlertTriangle,
  Package, Calendar, FileText, Check
} from 'lucide-react';

interface ApprovisionnerViewProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess?: () => void;
}

export default function ApprovisionnerView({
  open,
  onClose,
  product,
  onSuccess
}: ApprovisionnerViewProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !product) return null;

  const handleRestock = async () => {
    if (quantity <= 0) {
      setError("La quantité doit être supérieure à 0");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await inventoryService.adjustStock({
        product_id: product.id,
        new_quantity: product.quantity + quantity,
        reason: 'Réapprovisionnement',
        notes: notes || undefined
      });

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError("Erreur lors du réapprovisionnement");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isLowStock = product.quantity <= product.alert_threshold;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-medical/10 flex items-center justify-center">
                <RefreshCw className="text-medical" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic text-slate-900">
                  Réapprovisionnement
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  AJOUTER DU STOCK
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}

          {/* Product info */}
          <div className="bg-slate-50 p-4 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <Package className="text-medical flex-shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-800 truncate">{product.name}</p>
                <p className="text-xs text-slate-400">Code: {product.code}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="bg-white p-2 rounded-lg text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Stock actuel</p>
                <p className="font-bold text-lg">{product.quantity}</p>
              </div>
              <div className="bg-white p-2 rounded-lg text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase">Seuil</p>
                <p className="font-bold text-lg">{product.alert_threshold}</p>
              </div>
            </div>
          </div>

          {isLowStock && (
            <div className="p-4 bg-amber-50 text-amber-700 rounded-xl text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              Stock bas ! Réapprovisionnement recommandé.
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase ml-2">
              Quantité à ajouter
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center border-none rounded-xl p-3 bg-slate-100 font-bold outline-none focus:ring-4 focus:ring-medical/5"
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase ml-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Lot N°12345, Fournisseur..."
              rows={2}
              className="w-full border-none rounded-xl p-3 bg-slate-100 font-bold outline-none focus:ring-4 focus:ring-medical/5 resize-none"
            />
          </div>

          {/* Summary */}
          <div className="p-4 bg-medical-light/20 rounded-xl space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Stock après opération:</span>
              <span className="font-bold text-lg">{product.quantity + quantity}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600">Valeur ajoutée:</span>
              <span className="font-bold text-success text-lg">
                {formatPrice(quantity * product.purchase_price)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-4 rounded-xl border-2 border-slate-200 font-bold text-sm hover:bg-slate-50 transition-colors"
            >
              ANNULER
            </button>
            <button
              onClick={handleRestock}
              disabled={loading}
              className="flex-1 bg-medical text-white py-4 rounded-xl font-bold text-sm hover:bg-medical-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  ...
                </>
              ) : (
                <>
                  <Check size={18} />
                  VALIDER
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}