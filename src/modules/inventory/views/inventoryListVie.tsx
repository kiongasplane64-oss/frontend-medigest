// components/inventory/InventoryListView.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Search,
  Download,
  Eye,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Camera,
  Barcode,
  Printer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  List,
  ArrowUpDown,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import { inventoryService } from '@/services/inventoryService';
import { useAlerts } from '@/hooks/useAlerts';
import type { Product } from '@/types/inventory.types';

// Sous-composants
import ProductFormModal from './ProductFormModal';
import ProductDetailModal from './ProductDetailModal';
import BarcodeScannerModal from './BarcodeScannerModal';
import ProductSearchModal from './ProductSearchModal';
import StockMovementView from './StockMovementView';
import ImportExportView from './ImportExportView';
import InitialStockView from './InitialStockView';
import ReportStockView from './ReportStockView';
import ApproView from './ApproView';
import AchatView from './AchatView';
import BarcodeLabelView from './BarcodeLabelView';
import ProductCard from './Productcard';
import ProductTableRow from './ProductTableRow';
import ViewToggle from './ViewToggle';
import StockFilters from './StockFilters';

type ViewMode = 'grid' | 'list';
type ActiveTab = 'products' | 'movements' | 'import_export' | 'initial_stock' | 'reports' | 'appro' | 'achat' | 'barcodes';

interface InventoryListViewProps {
  initialPharmacyId?: string;
  initialBranchId?: string;
}

export default function InventoryListView({
  initialPharmacyId,
  initialBranchId,
}: InventoryListViewProps) {
  // Hooks
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { config, salesType, formatPrice } = usePharmacyConfig(initialPharmacyId);
  const { stock: stockAlerts, totalCount: alertsCount } = useAlerts({
    autoRefresh: true,
    refreshInterval: 300000,
  });

  // États
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category_id: '',
    stock_status: '',
    expiry_status: '',
    product_type: '',
    min_price: null as number | null,
    max_price: null as number | null,
    pharmacy_id: initialPharmacyId || '',
    branch_id: initialBranchId || '',
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(isMobile ? 12 : 24);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'selling_price' | 'expiry_date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Query pour récupérer les produits
  const {
    data: productsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['products', page, limit, searchQuery, filters, sortBy, sortOrder],
    queryFn: async () => {
      const response = await inventoryService.getProducts({
        skip: (page - 1) * limit,
        limit,
        search: searchQuery || undefined,
        category_id: filters.category_id || undefined,
        stock_status: filters.stock_status || undefined,
        expiry_status: filters.expiry_status || undefined,
        product_type: filters.product_type || undefined,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
        pharmacy_id: filters.pharmacy_id || undefined,
        branch_id: filters.branch_id || undefined,
        include_sales_stats: true,
      });
      return response;
    },
    staleTime: 30000,
  });

  // Trier les produits côté client si nécessaire
  const sortedProducts = useMemo(() => {
    if (!productsData?.products) return [];
    
    return [...productsData.products].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];
      
      if (sortBy === 'expiry_date') {
        aVal = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
        bVal = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [productsData?.products, sortBy, sortOrder]);

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!productsData?.products) return { total: 0, outOfStock: 0, lowStock: 0, totalValue: 0 };
    
    const total = productsData.products.length;
    const outOfStock = productsData.products.filter(p => p.stock_status === 'out_of_stock').length;
    const lowStock = productsData.products.filter(p => p.stock_status === 'low_stock').length;
    const totalValue = productsData.products.reduce((sum, p) => sum + (p.selling_value || 0), 0);
    
    return { total, outOfStock, lowStock, totalValue };
  }, [productsData?.products]);

  // Handlers
  const handleAddProduct = () => {
    setSelectedProduct(null);
    setShowProductForm(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowProductForm(true);
  };

  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const handleBarcodeScan = async (code: string) => {
    try {
      const product = await inventoryService.searchByBarcode(code);
      if (product) {
        setSelectedProduct(product);
        setShowProductDetail(true);
      } else {
        // Produit non trouvé, ouvrir le formulaire avec le code-barres pré-rempli
        setSelectedProduct(null);
        setShowProductForm(true);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche par code-barres:', error);
    } finally {
      setShowBarcodeScanner(false);
    }
  };

  const handleSearchByBarcode = () => {
    setShowProductSearch(true);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Réinitialiser la page
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  // Rendu des différents onglets
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'products':
        return (
          <div className="space-y-4">
            {/* Barre d'outils */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="flex flex-1 gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom, code ou code-barres..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical"
                  />
                </div>
                <button
                  onClick={handleSearchByBarcode}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  title="Rechercher par code-barres"
                >
                  <Barcode size={20} />
                </button>
                <button
                  onClick={() => setShowBarcodeScanner(true)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  title="Scanner un code-barres"
                >
                  <Camera size={20} />
                </button>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  title="Actualiser"
                >
                  <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAddProduct}
                  className="flex items-center gap-2 px-4 py-2 bg-medical text-white rounded-xl hover:bg-medical-dark transition-colors"
                >
                  <Plus size={18} />
                  <span className={isMobile ? 'sr-only' : ''}>Ajouter</span>
                </button>
                {!isMobile && (
                  <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
                )}
              </div>
            </div>

            {/* Filtres */}
            <StockFilters
              filters={filters}
              onFilterChange={handleFilterChange}
              config={config}
              salesType={salesType}
            />

            {/* Statistiques rapides */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Total produits</p>
                <p className="text-xl font-bold">{stats.total}</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200">
                <p className="text-xs text-slate-500">Valeur du stock</p>
                <p className="text-xl font-bold">{formatPrice(stats.totalValue)}</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 border border-red-200">
                <p className="text-xs text-red-600">Rupture de stock</p>
                <p className="text-xl font-bold text-red-600">{stats.outOfStock}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <p className="text-xs text-amber-600">Stock faible</p>
                <p className="text-xl font-bold text-amber-600">{stats.lowStock}</p>
              </div>
            </div>

            {/* Alertes */}
            {(stockAlerts.out_of_stock?.length > 0 || stockAlerts.low_stock?.length > 0) && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertTriangle size={16} />
                  <span className="text-sm font-medium">Alertes stock</span>
                </div>
                <div className="text-xs text-amber-600">
                  {stockAlerts.out_of_stock?.length > 0 && (
                    <span>{stockAlerts.out_of_stock.length} produit(s) en rupture de stock. </span>
                  )}
                  {stockAlerts.low_stock?.length > 0 && (
                    <span>{stockAlerts.low_stock.length} produit(s) avec stock faible.</span>
                  )}
                </div>
              </div>
            )}

            {/* Chargement / Erreur */}
            {isLoading && (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical"></div>
              </div>
            )}

            {isError && (
              <div className="bg-red-50 rounded-xl p-4 text-red-600 text-center">
                Erreur lors du chargement des produits: {error?.message}
                <button onClick={handleRefresh} className="ml-2 underline">Réessayer</button>
              </div>
            )}

            {/* Liste des produits */}
            {!isLoading && !isError && productsData && (
              <>
                {viewMode === 'grid' && !isMobile ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onEdit={() => handleEditProduct(product)}
                        onView={() => handleViewProduct(product)}
                        formatPrice={formatPrice}
                        salesType={salesType}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                            <button
                              onClick={() => handleSort('name')}
                              className="flex items-center gap-1 hover:text-slate-700"
                            >
                              Produit
                              <ArrowUpDown size={12} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Code</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                            <button
                              onClick={() => handleSort('quantity')}
                              className="flex items-center gap-1 hover:text-slate-700 ml-auto"
                            >
                              Stock
                              <ArrowUpDown size={12} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                            <button
                              onClick={() => handleSort('selling_price')}
                              className="flex items-center gap-1 hover:text-slate-700 ml-auto"
                            >
                              Prix
                              <ArrowUpDown size={12} />
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Statut</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedProducts.map((product) => (
                          <ProductTableRow
                            key={product.id}
                            product={product}
                            onEdit={() => handleEditProduct(product)}
                            onView={() => handleViewProduct(product)}
                            formatPrice={formatPrice}
                            salesType={salesType}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination */}
                {productsData.total > limit && (
                  <div className="flex justify-between items-center pt-4">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
                    >
                      <ChevronLeft size={16} />
                      Précédent
                    </button>
                    <span className="text-sm text-slate-600">
                      Page {page} sur {Math.ceil(productsData.total / limit)}
                    </span>
                    <button
                      onClick={() => setPage(p => p + 1)}
                      disabled={page * limit >= productsData.total}
                      className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
                    >
                      Suivant
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'movements':
        return <StockMovementView pharmacyId={filters.pharmacy_id} />;

      case 'import_export':
        return <ImportExportView pharmacyId={filters.pharmacy_id} />;

      case 'initial_stock':
        return <InitialStockView pharmacyId={filters.pharmacy_id} />;

      case 'reports':
        return <ReportStockView pharmacyId={filters.pharmacy_id} />;

      case 'appro':
        return <ApproView pharmacyId={filters.pharmacy_id} />;

      case 'achat':
        return <AchatView pharmacyId={filters.pharmacy_id} />;

      case 'barcodes':
        return <BarcodeLabelView products={sortedProducts} formatPrice={formatPrice} />;

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* En-tête avec onglets */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-3">
            <div className="flex items-center gap-3">
              <Package className="text-medical" size={24} />
              <h1 className="text-xl font-bold text-slate-900">Gestion de stock</h1>
              {alertsCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                  {alertsCount} alertes
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'products'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <List size={16} className="inline mr-1" />
                Produits
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'movements'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <TrendingUp size={16} className="inline mr-1" />
                Mouvements
              </button>
              <button
                onClick={() => setActiveTab('achat')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'achat'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingCart size={16} className="inline mr-1" />
                Achats
              </button>
              <button
                onClick={() => setActiveTab('appro')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'appro'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Package size={16} className="inline mr-1" />
                Approvisionnement
              </button>
              <button
                onClick={() => setActiveTab('barcodes')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'barcodes'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Printer size={16} className="inline mr-1" />
                Étiquettes
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Eye size={16} className="inline mr-1" />
                Rapports
              </button>
              <button
                onClick={() => setActiveTab('import_export')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'import_export'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Download size={16} className="inline mr-1" />
                Import/Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderActiveTab()}
      </div>

      {/* Modals */}
      {showProductForm && (
        <ProductFormModal
          product={selectedProduct}
          pharmacyId={filters.pharmacy_id}
          branchId={filters.branch_id}
          config={config}
          salesType={salesType}
          onClose={() => setShowProductForm(false)}
          onSuccess={() => {
            setShowProductForm(false);
            refetch();
          }}
        />
      )}

      {showProductDetail && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setShowProductDetail(false)}
          onEdit={() => {
            setShowProductDetail(false);
            handleEditProduct(selectedProduct);
          }}
          formatPrice={formatPrice}
          salesType={salesType}
        />
      )}

      {showBarcodeScanner && (
        <BarcodeScannerModal
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {showProductSearch && (
        <ProductSearchModal
          onSelect={(product) => {
            setSelectedProduct(product);
            setShowProductDetail(true);
            setShowProductSearch(false);
          }}
          onClose={() => setShowProductSearch(false)}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}