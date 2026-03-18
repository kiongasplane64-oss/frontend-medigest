// components/MouvementsView.tsx
import { useState, useEffect } from 'react';
import { 
  X, 
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  RotateCcw,
  Package,
  DollarSign
} from 'lucide-react';
import { movementService } from '@/services/movementService';
import { reportService } from '@/services/reportService';
import type { StockMovement, MovementType } from '@/types/inventory.types';
import { useCurrencyConfig } from '@/hooks/useCurrencyConfig';

interface MouvementsViewProps {
  open: boolean;
  onClose: () => void;
  productId?: string;
  productName?: string;
  pharmacyId?: string;
}

// Type pour les filtres d'affichage (simplifié)
type DisplayFilter = 'all' | 'in' | 'out' | 'adjustment' | 'return';

export default function MouvementsView({ open, onClose, productId, productName, pharmacyId }: MouvementsViewProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DisplayFilter>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('month');
  const [exporting, setExporting] = useState(false);
  const [showPrices, setShowPrices] = useState(false);
  
  // useCurrencyConfig pour formater les prix
  const { formatPrice, primaryCurrency } = useCurrencyConfig(pharmacyId);

  useEffect(() => {
    if (open) {
      loadMovements();
    }
  }, [open, filter, dateRange, productId]);

  const loadMovements = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (productId) params.product_id = productId;
      
      // Convertir le filtre d'affichage en type de mouvement API
      if (filter !== 'all') {
        if (filter === 'in') params.movement_type = 'purchase';
        else if (filter === 'out') params.movement_type = 'sale';
        else if (filter === 'adjustment') params.movement_type = 'inventory_adjustment';
        else if (filter === 'return') params.movement_type = 'return';
      }
      
      const now = new Date();
      if (dateRange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.date_from = today.toISOString();
        params.date_to = now.toISOString();
      } else if (dateRange === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.date_from = weekAgo.toISOString();
        params.date_to = now.toISOString();
      } else if (dateRange === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        params.date_from = monthAgo.toISOString();
        params.date_to = now.toISOString();
      }

      const data = await movementService.getMovements(params);
      setMovements(data.movements || []);
    } catch (error) {
      console.error('Erreur chargement mouvements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Construire les paramètres d'export
      const exportParams: any = {
        format: 'excel'
      };
      
      if (productId) {
        exportParams.productId = productId;
      }
      
      // Convertir le filtre d'affichage en type pour l'export
      if (filter !== 'all') {
        if (filter === 'in') exportParams.type = 'purchase';
        else if (filter === 'out') exportParams.type = 'sale';
        else if (filter === 'adjustment') exportParams.type = 'inventory_adjustment';
        else if (filter === 'return') exportParams.type = 'return';
      }
      
      // Ajouter les dates si nécessaire
      if (dateRange !== 'all') {
        const now = new Date();
        if (dateRange === 'today') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          exportParams.startDate = today.toISOString();
          exportParams.endDate = now.toISOString();
        } else if (dateRange === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          exportParams.startDate = weekAgo.toISOString();
          exportParams.endDate = now.toISOString();
        } else if (dateRange === 'month') {
          const monthAgo = new Date();
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          exportParams.startDate = monthAgo.toISOString();
          exportParams.endDate = now.toISOString();
        }
      }

      const blob = await reportService.generateMovementReport(exportParams);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mouvements-${productId || 'stock'}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur export:', error);
      alert('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Fonction pour obtenir l'icône en fonction du type de mouvement
  const getMovementIcon = (movementType: MovementType | string | undefined) => {
    switch (movementType) {
      case 'purchase':
      case 'transfer_in':
        return <ArrowDownLeft className="text-emerald-600" size={16} />;
      case 'sale':
      case 'transfer_out':
        return <ArrowUpRight className="text-red-600" size={16} />;
      case 'inventory_adjustment':
      case 'manual_adjustment':
        return <RefreshCw className="text-amber-600" size={16} />;
      case 'return':
        return <RotateCcw className="text-blue-600" size={16} />;
      case 'damage':
      case 'loss':
        return <Package className="text-red-600" size={16} />;
      default:
        return <RefreshCw className="text-slate-600" size={16} />;
    }
  };

  // Fonction pour obtenir la couleur en fonction du type de mouvement
  const getMovementColor = (movementType: MovementType | string | undefined) => {
    switch (movementType) {
      case 'purchase':
      case 'transfer_in':
        return 'bg-emerald-100 text-emerald-700';
      case 'sale':
      case 'transfer_out':
        return 'bg-red-100 text-red-700';
      case 'inventory_adjustment':
      case 'manual_adjustment':
        return 'bg-amber-100 text-amber-700';
      case 'return':
        return 'bg-blue-100 text-blue-700';
      case 'damage':
      case 'loss':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  // Fonction pour obtenir le libellé en fonction du type de mouvement
  const getMovementLabel = (movementType: MovementType | string | undefined) => {
    switch (movementType) {
      case 'purchase':
        return 'Achat';
      case 'sale':
        return 'Vente';
      case 'transfer_in':
        return 'Transfert reçu';
      case 'transfer_out':
        return 'Transfert envoyé';
      case 'inventory_adjustment':
        return 'Ajustement';
      case 'manual_adjustment':
        return 'Ajustement manuel';
      case 'return':
        return 'Retour';
      case 'damage':
        return 'Endommagé';
      case 'loss':
        return 'Perte';
      default:
        return movementType || 'Inconnu';
    }
  };

  // Fonction pour obtenir l'affichage de la quantité
  const getQuantityDisplay = (movement: StockMovement) => {
    const movementType = movement.movement_type;
    const quantity = movement.quantity_change || movement.quantity || 0;
    
    // Déterminer le signe en fonction du type
    if (movementType === 'purchase' || movementType === 'transfer_in' || movementType === 'return') {
      return { sign: '+', color: 'text-emerald-600', value: quantity };
    } else if (movementType === 'sale' || movementType === 'transfer_out' || movementType === 'damage' || movementType === 'loss') {
      return { sign: '-', color: 'text-red-600', value: quantity };
    } else {
      // Pour les ajustements, on détermine le signe par la différence
      const diff = (movement.quantity_after ?? 0) - (movement.quantity_before ?? 0);
      if (diff > 0) return { sign: '+', color: 'text-emerald-600', value: diff };
      if (diff < 0) return { sign: '-', color: 'text-red-600', value: Math.abs(diff) };
      return { sign: '±', color: 'text-amber-600', value: quantity };
    }
  };

  // Fonction pour obtenir la valeur totale du mouvement
  const getMovementValue = (movement: StockMovement): number | null => {
    if (movement.total_value) {
      return movement.total_value;
    }
    if (movement.unit_cost && (movement.quantity_change || movement.quantity)) {
      return movement.unit_cost * (movement.quantity_change || movement.quantity || 0);
    }
    return null;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600">
              <RefreshCw size={20} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900">
                {productId ? `Mouvements - ${productName || 'Produit'}` : 'Historique des mouvements'}
              </h3>
              <p className="text-sm text-slate-500">
                {movements.length} mouvement(s) trouvé(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPrices(!showPrices)}
              className={`p-2 rounded-xl transition-colors ${
                showPrices ? 'bg-sky-100 text-sky-600' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title={showPrices ? "Masquer les prix" : "Afficher les prix"}
            >
              <DollarSign size={18} />
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              title="Exporter"
            >
              <Download size={18} className={exporting ? 'animate-pulse' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-slate-100 bg-slate-50">
          <div className="flex flex-wrap gap-3">
            <div className="flex bg-white rounded-xl border border-slate-200 p-1">
              {(['all', 'in', 'out', 'adjustment', 'return'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    filter === f 
                      ? 'bg-sky-600 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f === 'all' && 'Tous'}
                  {f === 'in' && 'Entrées'}
                  {f === 'out' && 'Sorties'}
                  {f === 'adjustment' && 'Ajustements'}
                  {f === 'return' && 'Retours'}
                </button>
              ))}
            </div>

            <div className="flex bg-white rounded-xl border border-slate-200 p-1">
              {(['today', 'week', 'month', 'all'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateRange(d)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    dateRange === d 
                      ? 'bg-sky-600 text-white' 
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {d === 'today' && "Aujourd'hui"}
                  {d === 'week' && '7 jours'}
                  {d === 'month' && '30 jours'}
                  {d === 'all' && 'Tout'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-8">
              <Package className="mx-auto mb-4 text-slate-300" size={48} />
              <p className="text-base font-black text-slate-500">Aucun mouvement</p>
              <p className="mt-2 text-sm text-slate-400">
                Aucun mouvement de stock trouvé pour cette période.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {movements.map((movement) => {
                const movementType = movement.movement_type;
                const quantityDisplay = getQuantityDisplay(movement);
                const movementValue = getMovementValue(movement);
                
                return (
                  <div
                    key={movement.id}
                    className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <div className={`p-2 rounded-xl ${getMovementColor(movementType)}`}>
                      {getMovementIcon(movementType)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{movement.product_name || 'Produit'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getMovementColor(movementType)}`}>
                          {getMovementLabel(movementType)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                        <span>{new Date(movement.created_at).toLocaleString()}</span>
                        {movement.reason && <span>• {movement.reason}</span>}
                        {movement.reference_number && <span>• Réf: {movement.reference_number}</span>}
                        {movement.created_by_name && <span>• Par {movement.created_by_name}</span>}
                        {movement.user_name && <span>• Par {movement.user_name}</span>}
                      </div>
                      
                      {/* Affichage des prix si activé */}
                      {showPrices && movementValue !== null && (
                        <div className="mt-2 text-xs font-semibold text-slate-600 bg-slate-100 inline-block px-2 py-1 rounded-lg">
                          {formatPrice(movementValue)}
                          {movement.unit_cost && (
                            <span className="ml-2 text-slate-400">
                              (PU: {formatPrice(movement.unit_cost)})
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className={`font-black ${quantityDisplay.color}`}>
                        {quantityDisplay.sign}{quantityDisplay.value}
                      </p>
                      <p className="text-xs text-slate-400">
                        {movement.quantity_before ?? movement.previous_quantity} → {movement.quantity_after ?? movement.new_quantity}
                      </p>
                      
                      {/* Affichage du prix total en petit */}
                      {showPrices && movementValue !== null && (
                        <p className="text-xs font-bold text-sky-600 mt-1">
                          {formatPrice(movementValue)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pied de page avec résumé si les prix sont affichés */}
        {showPrices && movements.length > 0 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-[28px]">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-600">Valeur totale des mouvements:</span>
              <span className="font-black text-sky-600">
                {formatPrice(
                  movements.reduce((sum, m) => {
                    const val = m.total_value || (m.unit_cost && (m.quantity_change || m.quantity || 0) * m.unit_cost) || 0;
                    return sum + (typeof val === 'number' ? val : 0);
                  }, 0)
                )}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Tous les montants sont en {primaryCurrency}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}