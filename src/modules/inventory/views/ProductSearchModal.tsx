// components/inventory/ProductSearchModal.tsx
import { useState, useEffect } from 'react';
import { X, Search, Barcode, Package, Loader2 } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { Product } from '@/types/inventory.types';

interface ProductSearchModalProps {
  onSelect: (product: Product) => void;
  onClose: () => void;
  formatPrice: (price: number | undefined | null) => string;
}

export default function ProductSearchModal({
  onSelect,
  onClose,
  formatPrice,
}: ProductSearchModalProps) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchingByBarcode, setSearchingByBarcode] = useState(false);

  useEffect(() => {
    if (query.length >= 2) {
      const timeout = setTimeout(async () => {
        setLoading(true);
        try {
          const response = await inventoryService.getProducts({
            search: query,
            limit: 20,
          });
          setProducts(response.products);
        } catch (error) {
          console.error('Erreur recherche:', error);
        } finally {
          setLoading(false);
        }
      }, 300);

      return () => clearTimeout(timeout);
    } else {
      setProducts([]);
    }
  }, [query]);

  const handleBarcodeSearch = async () => {
    setSearchingByBarcode(true);
    try {
      const barcode = prompt('Scannez ou saisissez le code-barres:');
      if (barcode) {
        const product = await inventoryService.searchByBarcode(barcode);
        if (product) {
          onSelect(product);
          onClose();
        } else {
          alert('Produit non trouvé');
        }
      }
    } catch (error) {
      console.error('Erreur recherche code-barres:', error);
    } finally {
      setSearchingByBarcode(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Rechercher un produit</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        {/* Recherche */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher par nom, code ou code-barres..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical"
              />
            </div>
            <button
              onClick={handleBarcodeSearch}
              disabled={searchingByBarcode}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
            >
              {searchingByBarcode ? <Loader2 size={18} className="animate-spin" /> : <Barcode size={18} />}
              Scanner
            </button>
          </div>
        </div>

        {/* Résultats */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-medical" size={32} />
            </div>
          )}

          {!loading && products.length === 0 && query.length >= 2 && (
            <div className="text-center py-12 text-slate-400">
              Aucun produit trouvé
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="text-center py-12 text-slate-400">
              Saisissez au moins 2 caractères pour rechercher
            </div>
          )}

          <div className="space-y-2">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => onSelect(product)}
                className="w-full text-left p-4 hover:bg-slate-50 rounded-xl transition-colors border border-slate-100"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Package size={16} className="text-slate-400" />
                      <h3 className="font-medium text-slate-800">{product.name}</h3>
                    </div>
                    <div className="flex gap-3 mt-1 text-sm text-slate-500">
                      <span>Code: {product.code || '-'}</span>
                      <span>Code-barres: {product.barcode || '-'}</span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-slate-400">
                      <span>Stock: {product.quantity}</span>
                      <span>Catégorie: {typeof product.category === 'string' ? product.category : product.category?.name || '-'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-medical">
                      {formatPrice(product.selling_price)}
                    </p>
                    {product.quantity <= product.alert_threshold && product.quantity > 0 && (
                      <p className="text-xs text-amber-500">Stock faible</p>
                    )}
                    {product.quantity === 0 && (
                      <p className="text-xs text-red-500">Rupture</p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}