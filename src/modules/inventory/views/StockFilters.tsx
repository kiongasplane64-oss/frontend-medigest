// components/inventory/StockFilters.tsx
import { X } from 'lucide-react';
import type { PharmacyConfig, SalesType } from '@/types/inventory.types';

interface StockFiltersProps {
  filters: {
    category_id: string;
    stock_status: string;
    expiry_status: string;
    product_type: string;
    min_price: number | null;
    max_price: number | null;
    pharmacy_id: string;
    branch_id: string;
  };
  onFilterChange: (key: string, value: any) => void;
  config?: PharmacyConfig | null;
  salesType?: SalesType;
}

export default function StockFilters({ filters, onFilterChange, config, salesType }: StockFiltersProps) {
  const hasActiveFilters = Object.values(filters).some(v => v && v !== '' && v !== null && v !== 0);

  const clearFilters = () => {
    onFilterChange('category_id', '');
    onFilterChange('stock_status', '');
    onFilterChange('expiry_status', '');
    onFilterChange('product_type', '');
    onFilterChange('min_price', null);
    onFilterChange('max_price', null);
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-200">
      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm font-medium text-slate-600">Filtres:</span>

        {/* Catégorie */}
        <select
          value={filters.category_id}
          onChange={(e) => onFilterChange('category_id', e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
        >
          <option value="">Toutes les catégories</option>
          {/* Les catégories seront chargées dynamiquement */}
        </select>

        {/* Statut stock */}
        <select
          value={filters.stock_status}
          onChange={(e) => onFilterChange('stock_status', e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Tous les stocks</option>
          <option value="out_of_stock">Rupture de stock</option>
          <option value="low_stock">Stock faible</option>
          <option value="normal">Stock normal</option>
          <option value="over_stock">Surstock</option>
        </select>

        {/* Statut expiration */}
        <select
          value={filters.expiry_status}
          onChange={(e) => onFilterChange('expiry_status', e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Toutes les expirations</option>
          <option value="expired">Expirés</option>
          <option value="critical">Expiration critique (7j)</option>
          <option value="warning">Expiration proche (30j)</option>
          <option value="valid">Valides</option>
        </select>

        {/* Type de produit */}
        <select
          value={filters.product_type}
          onChange={(e) => onFilterChange('product_type', e.target.value)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm"
        >
          <option value="">Tous les types</option>
          <option value="medicament">Médicament</option>
          <option value="parapharmacie">Parapharmacie</option>
          <option value="materiel">Matériel médical</option>
          <option value="autre">Autre</option>
        </select>

        {/* Prix min/max */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="Prix min"
            value={filters.min_price || ''}
            onChange={(e) => onFilterChange('min_price', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
          />
          <span className="text-slate-400">-</span>
          <input
            type="number"
            placeholder="Prix max"
            value={filters.max_price || ''}
            onChange={(e) => onFilterChange('max_price', e.target.value ? parseFloat(e.target.value) : null)}
            className="w-24 px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
          />
        </div>

        {/* Bouton effacer */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 px-2 py-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <X size={14} />
            Effacer
          </button>
        )}
      </div>

      {/* Indicateur de configuration */}
      {config && (
        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-400 flex flex-wrap gap-3">
          <span>💱 Devise: {config.primaryCurrency}</span>
          {salesType === 'wholesale' && <span>� wholesale Vente en gros uniquement</span>}
          {salesType === 'retail' && <span>🏪 Vente au détail uniquement</span>}
          {salesType === 'both' && <span>🔄 Vente en gros et détail</span>}
          {config.calcul_auto_prix && <span>⚡ Calcul automatique des prix activé</span>}
        </div>
      )}
    </div>
  );
}