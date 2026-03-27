// components/inventory/StockMovementView.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingUp, TrendingDown, ArrowLeftRight, Package, Download } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { StockMovement } from '@/types/inventory.types';

interface StockMovementViewProps {
  pharmacyId?: string;
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

export default function StockMovementView({ pharmacyId }: StockMovementViewProps) {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [movementType, setMovementType] = useState('');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['stock-movements', page, limit, startDate, endDate, movementType, pharmacyId],
    queryFn: () => inventoryService.getMovements({
      skip: (page - 1) * limit,
      limit,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      movement_type: movementType || undefined,
      pharmacy_id: pharmacyId,
    }),
  });

  const movements = data?.movements || [];
  const total = data?.total || 0;

  const handleExport = async () => {
    try {
      const blob = await inventoryService.exportStock('excel', { pharmacy_id: pharmacyId });
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
        Erreur lors du chargement des mouvements: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <div className="bg-white rounded-xl p-4 border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Type de mouvement</label>
            <select
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
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
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={() => refetch()}
              className="w-full px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark"
            >
              Filtrer
            </button>
          </div>
        </div>
      </div>

      {/* Bouton export */}
      <div className="flex justify-end">
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg"
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
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Raison</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((movement: StockMovement) => {
              const typeInfo = movementTypeLabels[movement.movement_type] || movementTypeLabels.adjustment;
              const isNegative = movement.quantity_change < 0;
              
              return (
                <tr key={movement.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    {movement.created_at && format(new Date(movement.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-sm">{movement.product_name}</div>
                    <div className="text-xs text-slate-400">{movement.product_code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${typeInfo.color}`}>
                      {typeInfo.icon}
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{movement.quantity_before}</td>
                  <td className="px-4 py-3 text-right text-sm">{movement.quantity_after}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={isNegative ? 'text-red-600' : 'text-green-600'}>
                      {isNegative ? '' : '+'}{movement.quantity_change}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{movement.reason || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {movements.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            Aucun mouvement de stock trouvé
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-between items-center pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
          >
            Précédent
          </button>
          <span className="text-sm text-slate-600">
            Page {page} sur {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * limit >= total}
            className="px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}