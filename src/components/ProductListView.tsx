// components/ProductListView.tsx
import { useState, useMemo } from 'react';
import { Product, Category } from '@/types/inventory.types';
import { formatPrice, formatDate } from '@/utils/formatters';
import {
  X, Search, ChevronLeft, ChevronRight, Printer,
  Package, Grid, List
} from 'lucide-react';

interface ProductListViewProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct: (product: Product) => void;
  onPrintLabel: (product: Product) => void;
}

type ViewMode = 'grid' | 'list';

// Fonction utilitaire pour obtenir le nom de la catégorie
const getCategoryName = (category: string | Category | undefined): string => {
  if (!category) return '';
  if (typeof category === 'string') return category;
  return category.name || '';
};

export default function ProductListView({
  open,
  onClose,
  products,
  onSelectProduct,
  onPrintLabel
}: ProductListViewProps) {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const itemsPerPage = 20;

  // Extraction des catégories uniques
  const categories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      const catName = getCategoryName(p.category);
      if (catName) cats.add(catName);
    });
    return ['all', ...Array.from(cats).sort()];
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = [...products];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(p => {
        const categoryName = getCategoryName(p.category);
        return (
          p.name.toLowerCase().includes(term) ||
          p.code.toLowerCase().includes(term) ||
          categoryName.toLowerCase().includes(term) ||
          (p.supplier && p.supplier.toLowerCase().includes(term)) ||
          (p.barcode && p.barcode.toLowerCase().includes(term))
        );
      });
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => {
        const categoryName = getCategoryName(p.category);
        return categoryName === categoryFilter;
      });
    }

    return filtered;
  }, [products, searchTerm, categoryFilter]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalValue = useMemo(() => {
    return filteredProducts.reduce((sum, p) => sum + (p.quantity * p.selling_price), 0);
  }, [filteredProducts]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black uppercase italic text-slate-900">
                Visualisation des produits
              </h2>
              <p className="text-xs md:text-sm text-slate-500 mt-1">
                {filteredProducts.length} produits • Valeur totale: {formatPrice(totalValue)}
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
              >
                {viewMode === 'list' ? <Grid size={18} /> : <List size={18} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="p-4 md:p-6 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par nom, code, catégorie..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="px-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 min-w-45"
            >
              <option value="all">Toutes les catégories</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {viewMode === 'list' ? (
            // List View
            <div className="overflow-x-auto">
              <table className="w-full min-w-200">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                    <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Désignation</th>
                    <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Catégorie</th>
                    <th className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock</th>
                    <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Prix Vente</th>
                    <th className="p-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Valeur</th>
                    <th className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Péremption</th>
                    <th className="p-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedProducts.map((product) => {
                    const isLowStock = product.quantity <= product.alert_threshold;
                    const expiryDate = product.expiry_date ? new Date(product.expiry_date) : null;
                    const isExpired = expiryDate ? expiryDate < new Date() : false;
                    const isExpiringSoon = expiryDate ?
                      expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                      expiryDate >= new Date() : false;

                    const categoryName = getCategoryName(product.category);

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-blue-50 transition-colors cursor-pointer
                          ${isExpired ? 'bg-red-50' : isExpiringSoon ? 'bg-amber-50' : ''}
                        `}
                        onClick={() => onSelectProduct(product)}
                      >
                        <td className="p-4 font-mono text-sm">{product.code}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{product.name}</p>
                          {product.supplier && (
                            <p className="text-xs text-slate-400">{product.supplier}</p>
                          )}
                        </td>
                        <td className="p-4">
                          {categoryName || '-'}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold
                            ${isLowStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                            }`}>
                            {product.quantity}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold">{formatPrice(product.selling_price)}</td>
                        <td className="p-4 text-right font-medium text-blue-600">
                          {formatPrice(product.quantity * product.selling_price)}
                        </td>
                        <td className="p-4 text-center">
                          {product.expiry_date ? (
                            <span className={`text-xs font-bold
                              ${isExpired ? 'text-red-600' : isExpiringSoon ? 'text-amber-600' : 'text-slate-600'}`}>
                              {formatDate(product.expiry_date)}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrintLabel(product);
                              }}
                              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                              title="Imprimer étiquette"
                            >
                              <Printer size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            // Grid View
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {paginatedProducts.map((product) => {
                const isLowStock = product.quantity <= product.alert_threshold;
                const expiryDate = product.expiry_date ? new Date(product.expiry_date) : null;
                const isExpired = expiryDate ? expiryDate < new Date() : false;
                const isExpiringSoon = expiryDate ?
                  expiryDate <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                  expiryDate >= new Date() : false;

                const categoryName = getCategoryName(product.category);

                return (
                  <div
                    key={product.id}
                    onClick={() => onSelectProduct(product)}
                    className={`bg-white border-2 rounded-xl p-4 cursor-pointer hover:shadow-lg transition-all
                      ${isExpired ? 'border-red-200 bg-red-50/50' :
                        isExpiringSoon ? 'border-amber-200 bg-amber-50/50' :
                        isLowStock ? 'border-amber-200' : 'border-slate-100'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-mono text-xs text-slate-400">{product.code}</p>
                        <p className="font-bold text-slate-800 line-clamp-2">{product.name}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPrintLabel(product);
                        }}
                        className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <Printer size={14} />
                      </button>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Catégorie:</span>
                        <span className="font-bold">{categoryName || '-'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Stock:</span>
                        <span className={`font-bold ${isLowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {product.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Prix:</span>
                        <span className="font-bold text-blue-600">
                          {formatPrice(product.selling_price)}
                        </span>
                      </div>
                      {product.expiry_date && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Péremption:</span>
                          <span className={`font-bold ${
                            isExpired ? 'text-red-600' :
                            isExpiringSoon ? 'text-amber-600' :
                            'text-slate-600'
                          }`}>
                            {formatDate(product.expiry_date)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-400">Valeur stock</p>
                      <p className="font-bold text-lg text-blue-600">
                        {formatPrice(product.quantity * product.selling_price)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <p className="text-slate-400 font-bold">Aucun produit trouvé</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-500 order-2 sm:order-1">
              Affichage {(page - 1) * itemsPerPage + 1} à {Math.min(page * itemsPerPage, filteredProducts.length)} sur {filteredProducts.length}
            </p>
            <div className="flex gap-2 order-1 sm:order-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold">
                Page {page} / {totalPages || 1}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || totalPages === 0}
                className="p-2 bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}