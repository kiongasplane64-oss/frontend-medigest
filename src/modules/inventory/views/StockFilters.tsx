// components/inventory/StockFilters.tsx
import { useState } from 'react';
import { Filter, ChevronDown, X } from 'lucide-react';

interface StockFiltersProps {
  filters: {
    category_id: string;
    category: string;
    stock_status: string;
    expiry_status: string;
    product_type: string;
    min_price: number | null;
    max_price: number | null;
    pharmacy_id: string;
    branch_id: string;
  };
  onFilterChange: (key: string, value: any) => void;
  categoryOptions?: Array<{ value: string; label: string }>;
}

export default function StockFilters({ 
  filters, 
  onFilterChange, 
  categoryOptions = [] 
}: StockFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);

  const stockStatusOptions = [
    { value: '', label: 'Tous' },
    { value: 'in_stock', label: 'En stock' },
    { value: 'low_stock', label: 'Stock faible' },
    { value: 'out_of_stock', label: 'Rupture' },
    { value: 'over_stock', label: 'Surstock' },
  ];

  const expiryStatusOptions = [
    { value: '', label: 'Tous' },
    { value: 'expired', label: 'Expirés' },
    { value: 'critical', label: 'Expire < 7j' },
    { value: 'warning', label: 'Expire < 30j' },
    { value: 'valid', label: 'Valides' },
  ];

  const hasActiveFilters = () => {
    return (
      filters.category ||
      filters.stock_status ||
      filters.expiry_status ||
      filters.product_type ||
      filters.min_price !== null ||
      filters.max_price !== null
    );
  };

  const clearFilters = () => {
    onFilterChange('category', '');
    onFilterChange('category_id', '');
    onFilterChange('stock_status', '');
    onFilterChange('expiry_status', '');
    onFilterChange('product_type', '');
    onFilterChange('min_price', null);
    onFilterChange('max_price', null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3">
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filtres</span>
          {hasActiveFilters() && (
            <span className="bg-medical/10 text-medical text-xs px-2 py-0.5 rounded-full">
              Actifs
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-400 transition-transform ${
            showFilters ? 'rotate-180' : ''
          }`}
        />
      </button>

      {showFilters && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Filtre par catégorie - depuis la base de données */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Catégorie
              </label>
              <select
                value={filters.category}
                onChange={(e) => onFilterChange('category', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              >
                <option value="">Toutes les catégories</option>
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par statut de stock */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Statut stock
              </label>
              <select
                value={filters.stock_status}
                onChange={(e) => onFilterChange('stock_status', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              >
                {stockStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par statut d'expiration */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Expiration
              </label>
              <select
                value={filters.expiry_status}
                onChange={(e) => onFilterChange('expiry_status', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              >
                {expiryStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtre par type de produit */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Type produit
              </label>
              <select
                value={filters.product_type}
                onChange={(e) => onFilterChange('product_type', e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical"
              >
                <option value="">Tous</option>
                <option value="medicament">Médicament</option>
                <option value="parapharmacie">Parapharmacie</option>
                <option value="materiel">Matériel médical</option>
                <option value="other">Autre</option>
              </select>
            </div>

            {/* Filtre prix min */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Prix min
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={filters.min_price ?? ''}
                onChange={(e) =>
                  onFilterChange(
                    'min_price',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical"
                placeholder="0 FC"
              />
            </div>

            {/* Filtre prix max */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Prix max
              </label>
              <input
                type="number"
                min="0"
                step="100"
                value={filters.max_price ?? ''}
                onChange={(e) =>
                  onFilterChange(
                    'max_price',
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical"
                placeholder="Illimité"
              />
            </div>
          </div>

          {/* Bouton effacer les filtres */}
          {hasActiveFilters() && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600 transition-colors"
              >
                <X size={12} />
                Effacer les filtres
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}