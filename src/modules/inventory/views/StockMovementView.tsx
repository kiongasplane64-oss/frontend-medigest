// components/inventory/StockMovementView.tsx
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown, ArrowLeftRight, Package, Download, Filter, X, Building2 } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { StockMovement } from '@/types/inventory.types';

interface StockMovementViewProps {
  pharmacyId?: string;
  branchId?: string;
}

const movementTypeLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  purchase: { label: 'Achat', color: 'text-green-600 bg-green-50', icon: <TrendingUp size={14} /> },
  sale: { label: 'Vente', color: 'text-red-600 bg-red-50', icon: <TrendingDown size={14} /> },
  sale_return: { label: 'Retour vente', color: 'text-orange-600 bg-orange-50', icon: <ArrowLeftRight size={14} /> },
  transfer_in: { label: 'Transfert entrant', color: 'text-blue-600 bg-blue-50', icon: <ArrowLeftRight size={14} /> },
  transfer_out: { label: 'Transfert sortant', color: 'text-purple-600 bg-purple-50', icon: <ArrowLeftRight size={14} /> },
  inventory: { label: 'Inventaire', color: 'text-cyan-600 bg-cyan-50', icon: <Package size={14} /> },
  adjustment: { label: 'Ajustement', color: 'text-amber-600 bg-amber-50', icon: <Package size={14} /> },
  initial: { label: 'Stock initial', color: 'text-slate-600 bg-slate-50', icon: <Package size={14} /> },
  import: { label: 'Import', color: 'text-indigo-600 bg-indigo-50', icon: <Package size={14} /> },
};

export default function StockMovementView({ pharmacyId, branchId }: StockMovementViewProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [movementType, setMovementType] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');

  // Réinitialiser la page quand les filtres changent
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, movementType, selectedProductId, pharmacyId, branchId]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stock-movements', page, limit, startDate, endDate, movementType, selectedProductId, pharmacyId, branchId],
    queryFn: () => inventoryService.getMovements({
      skip: (page - 1) * limit,
      limit,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      movement_type: movementType || undefined,
      product_id: selectedProductId || undefined,
      pharmacy_id: pharmacyId,
    }),
    enabled: !!pharmacyId,
  });

  const movements = data?.movements || [];
  const total = data?.total || 0;

  const handleExport = async () => {
    try {
      const blob = await inventoryService.exportStock('excel', { 
        pharmacy_id: pharmacyId,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(movementType && { movement_type: movementType }),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mouvements_stock_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur export:', err);
    }
  };

  const handleResetFilters = () => {
    setStartDate('');
    setEndDate('');
    setMovementType('');
    setSelectedProductId('');
  };

  const hasActiveFilters = startDate || endDate || movementType || selectedProductId;

  if (isLoading && page === 1) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 rounded-xl p-4 text-red-600 text-center">
        Erreur lors du chargement des mouvements: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête avec infos pharmacie/branche */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 size={16} />
          <span>Pharmacie: {pharmacyId || 'Non définie'}</span>
          {branchId && (
            <>
              <span className="text-slate-300">|</span>
              <span>Branche: {branchId}</span>
            </>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Filter size={16} />
          {showFilters ? 'Masquer filtres' : 'Afficher filtres'}
          {hasActiveFilters && (
            <span className="ml-1 px-1.5 py-0.5 bg-medical text-white text-xs rounded-full">
              {[startDate, endDate, movementType, selectedProductId].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Type de mouvement</label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              >
                <option value="">Tous</option>
                {Object.entries(movementTypeLabels).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date début</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Date fin</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">ID Produit</label>
              <input
                type="text"
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                placeholder="ID du produit"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:text-red-600 transition-colors"
              >
                <X size={14} />
                Réinitialiser
              </button>
            )}
            <button
              onClick={() => refetch()}
              className="px-4 py-1.5 bg-medical text-white rounded-lg hover:bg-medical-dark transition-colors text-sm"
            >
              Appliquer
            </button>
          </div>
        </div>
      )}

      {/* Statistiques rapides */}
      {movements.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-xs text-slate-500">Total mouvements</p>
            <p className="text-xl font-bold">{total}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-xs text-slate-500">Entrées</p>
            <p className="text-xl font-bold text-green-600">
              {movements.filter(m => m.quantity_change > 0).reduce((sum, m) => sum + m.quantity_change, 0)}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-xs text-slate-500">Sorties</p>
            <p className="text-xl font-bold text-red-600">
              {Math.abs(movements.filter(m => m.quantity_change < 0).reduce((sum, m) => sum + m.quantity_change, 0))}
            </p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-200">
            <p className="text-xs text-slate-500">Solde net</p>
            <p className="text-xl font-bold">
              {movements.reduce((sum, m) => sum + m.quantity_change, 0)}
            </p>
          </div>
        </div>
      )}

      {/* Bouton export */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
        >
          <Download size={16} />
          Exporter
        </button>
      </div>

      {/* Tableau des mouvements */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Produit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Type</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Qté avant</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Qté après</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Variation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Raison/Référence</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement: StockMovement) => {
              const typeInfo = movementTypeLabels[movement.movement_type] || movementTypeLabels.adjustment;
              const isNegative = movement.quantity_change < 0;
              
              return (
                <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {movement.created_at && format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                   </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm text-slate-800">{movement.product_name || '-'}</div>
                    <div className="text-xs text-slate-400">{movement.product_code || '-'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                      {typeInfo.icon}
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">{movement.quantity_before}</td>
                  <td className="px-4 py-3 text-right text-sm text-slate-600">{movement.quantity_after}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-medium ${isNegative ? 'text-red-600' : 'text-green-600'}`}>
                      {isNegative ? '' : '+'}{movement.quantity_change}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {movement.reason || '-'}
                    {movement.reference && (
                      <span className="text-xs text-slate-400 ml-1">({movement.reference})</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {movements.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-50" />
            <p>Aucun mouvement de stock trouvé</p>
            <p className="text-sm mt-1">Modifiez les filtres ou vérifiez votre sélection</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
          >
            Précédent
          </button>
          <span className="text-sm text-slate-600">
            Page {page} sur {Math.ceil(total / limit)} • {total} mouvement(s)
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * limit >= total}
            className="px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}