// InventoryList.tsx - Version corrigée
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RefreshCw,
  Download,
  Upload,
  Printer,
  Eye,
  AlertCircle,
  ShoppingCart,
  TrendingUp,
  Package,
  Edit2,
  Trash2,
  X,
  Clock,
  Grid,
  List,
  Filter,
  AlertTriangle,
  FileBarChart2,
  ClipboardList,
  Boxes,
  ScanLine,
  Warehouse,
  CircleDollarSign,
  DollarSign,
  Loader2,
  Settings
} from 'lucide-react';
import Barcode from 'react-barcode';
import { Html5QrcodeScanner } from 'html5-qrcode';

import { inventoryService } from '@/services/inventoryService';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { Product, StockStats, Category } from '@/types/inventory.types';
import { SearchInput } from '@/components/SearchInput';
import { StatCardDetail } from '@/components/StatCardDetail';
import ProductListView from '@/components/ProductListView';
import ExportInventory from '@/components/ExportInventory';
import AchatView from '@/components/AchatView';
import ApprovisionnerView from '@/components/ApprovisionnerView';
import CreateProductView from '@/components/CreateProductView';
import InitialStockView from '@/components/InitialStockView';
import MouvementsView from '@/components/MouvementsView';
import RapportStockView from '@/components/RapportStockView';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: keyof Product;
  direction: SortDirection;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'violet';
  subtitle?: string;
  onClick?: () => void;
  loading?: boolean;
}

interface QuickActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  loading?: boolean;
}

interface InventoryListProps {
  pharmacyId?: string;
  tenantId?: string;
}

// Constantes de configuration
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const DEFAULT_PAGINATION_LIMIT = 100;

// Fonctions utilitaires
function getCategoryName(product: Product): string {
  if (typeof product.category === 'string') return product.category || 'Sans catégorie';
  if (product.category && typeof product.category === 'object' && 'name' in product.category) {
    return String((product.category as { name?: string }).name ?? 'Sans catégorie');
  }
  return 'Sans catégorie';
}

function getProductCode(product: Product): string {
  return product.code || product.barcode || 'N/A';
}

function getBarcodeValue(product: Product): string {
  return product.barcode || product.code || String(product.id);
}

function isProductExpired(product: Product): boolean {
  if (!product.expiry_date) return false;
  const expiryDate = new Date(product.expiry_date);
  if (isNaN(expiryDate.getTime())) return false;
  return expiryDate < new Date();
}

function isProductLowStock(product: Product, threshold: number = DEFAULT_LOW_STOCK_THRESHOLD): boolean {
  const quantity = Number(product.quantity ?? 0);
  return quantity > 0 && quantity <= threshold;
}

function isProductOutOfStock(product: Product): boolean {
  return Number(product.quantity ?? 0) <= 0;
}

function getStockBadge(product: Product, threshold: number = DEFAULT_LOW_STOCK_THRESHOLD): {
  label: string;
  className: string;
} {
  if (isProductExpired(product)) {
    return {
      label: 'Périmé',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (isProductOutOfStock(product)) {
    return {
      label: 'Rupture',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (isProductLowStock(product, threshold)) {
    return {
      label: 'Faible',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }

  return {
    label: 'En stock',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };
}

function StatCard({ title, value, icon, tone, subtitle, onClick, loading = false }: StatCardProps) {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200 md:h-10" />
          ) : (
            <p className="truncate text-xl font-black text-slate-900 md:text-3xl">{value}</p>
          )}
          {subtitle && !loading && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({ label, icon, onClick, variant = 'default', loading = false }: QuickActionButtonProps) {
  const variants = {
    default: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    primary: 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-100',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
        variants[variant]
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function InventoryList({ pharmacyId, tenantId: _tenantId }: InventoryListProps) {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Récupération de la configuration de la pharmacie
  const { 
    config, 
    isLoading: configLoading,
    formatPrice, 
    primaryCurrency,
    lowStockThreshold,
    expiryWarningDays,
    taxRate
  } = usePharmacyConfig(pharmacyId);

  // États
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage] = useState(1);

  // États des modaux
  const [showAddModal, setShowAddModal] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [showApproModal, setShowApproModal] = useState(false);
  const [showInitialStockModal, setShowInitialStockModal] = useState(false);
  const [showMouvementsModal, setShowMouvementsModal] = useState(false);
  const [showRapportModal, setShowRapportModal] = useState(false);
  const [showStatDetail, setShowStatDetail] = useState<{
    type: 'value' | 'margin' | 'lowstock' | 'expired' | 'purchase';
    title: string;
    data: any;
  } | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);

  // États pour le scanner
  const [barcodeToCreate, setBarcodeToCreate] = useState<string>('');
  const [showBarcodeCreateChoice, setShowBarcodeCreateChoice] = useState(false);

  // Ajuster le mode d'affichage pour mobile
  useEffect(() => {
    setViewMode(isMobile ? 'grid' : 'list');
  }, [isMobile]);

  // Query: Récupération des produits
  const {
    data: productsData,
    isLoading: productsLoading,
    refetch,
    error: productsError,
    isFetching,
  } = useQuery({
    queryKey: ['inventory-products', pharmacyId, searchTerm, selectedCategory, selectedLocation, currentPage],
    queryFn: () =>
      inventoryService.getProducts({
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        location: selectedLocation !== 'all' ? selectedLocation : undefined,
        skip: (currentPage - 1) * DEFAULT_PAGINATION_LIMIT,
        limit: DEFAULT_PAGINATION_LIMIT,
        include_sales_stats: true,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!pharmacyId,
  });

  // Query: Récupération des statistiques
  const { data: stats, isLoading: statsLoading } = useQuery<StockStats>({
    queryKey: ['inventory-stats', pharmacyId],
    queryFn: () => inventoryService.getStats(),
    staleTime: 5 * 60 * 1000,
    enabled: !!pharmacyId,
  });

  // Query: Récupération des catégories - CORRIGÉE
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['inventory-categories', pharmacyId],
    queryFn: async () => {
      const response = await inventoryService.getCategories({ skip: 0, limit: 100 });
      return response.categories;
    },
    staleTime: 10 * 60 * 1000,
    enabled: true,
  });

  // Mutation: Suppression de produit
  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
    },
    onError: (error) => {
      console.error('Erreur suppression produit:', error);
      alert('Erreur lors de la suppression du produit.');
    },
  });

  // Scanner QR code / code-barres
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let mounted = true;

    if (!isScanning) return;

    scanner = new Html5QrcodeScanner(
      'reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        showTorchButtonIfSupported: true,
      },
      false,
    );

    scanner.render(
      async (decodedText: string) => {
        if (!mounted) return;

        // Rechercher le produit par code-barres ou code
        const found = await inventoryService.findProductByCodeOrBarcode(decodedText);

        if (found) {
          setSelectedProduct(found);
          setShowApproModal(true);
        } else {
          setBarcodeToCreate(decodedText);
          setShowBarcodeCreateChoice(true);
          setSearchTerm(decodedText);
        }

        setIsScanning(false);
      },
      (scanError: string) => {
        if (scanError) {
          console.warn('Scan info:', scanError);
        }
      },
    );

    return () => {
      mounted = false;
      if (scanner) {
        scanner.clear().catch((err: Error) => {
          console.warn('Erreur fermeture scanner:', err);
        });
      }
    };
  }, [isScanning]);

  // Traitement des données
  const products = useMemo(() => {
    if (!productsData?.products) return [];
    return productsData.products;
  }, [productsData]);

  const totalProducts = productsData?.total || products.length;

  // Tri des produits
  const sortedProducts = useMemo(() => {
    const cloned = [...products];

    if (!sortConfig) return cloned;

    cloned.sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aText =
        sortConfig.field === 'category'
          ? getCategoryName(a)
          : String(aValue ?? '').toLowerCase();

      const bText =
        sortConfig.field === 'category'
          ? getCategoryName(b)
          : String(bValue ?? '').toLowerCase();

      return sortConfig.direction === 'asc'
        ? aText.localeCompare(bText)
        : bText.localeCompare(aText);
    });

    return cloned;
  }, [products, sortConfig]);

  // Produits affichés selon le mode
  const displayedProducts = useMemo(() => {
    if (viewMode === 'grid') return sortedProducts.slice(0, 12);
    return sortedProducts.slice(0, 10);
  }, [sortedProducts, viewMode]);

  // Calcul des statistiques locales
  const inventoryHighlights = useMemo(() => {
    const threshold = lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    const total = products.length;
    const low = products.filter(p => isProductLowStock(p, threshold)).length;
    const expired = products.filter(isProductExpired).length;
    const rupture = products.filter(isProductOutOfStock).length;

    return { total, low, expired, rupture };
  }, [products, lowStockThreshold]);

  // Calcul des valeurs financières - CORRIGÉ avec les bonnes propriétés
  const totalSelling = Number((stats as any)?.total_value_selling ?? stats?.total_selling_value ?? 0);
  const totalPurchase = Number((stats as any)?.total_value_purchase ?? stats?.total_purchase_value ?? 0);
  const potentialMargin = totalSelling - totalPurchase;

  // Handlers
  const handleSort = (field: keyof Product) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        return {
          field,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        };
      }
      return { field, direction: 'asc' };
    });
  };

  const handleDelete = (id: string) => {
    const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?');
    if (!confirmed) return;
    deleteMutation.mutate(id);
  };

  const handlePrintLabel = (product: Product) => {
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (!printWindow) return;

    const code = getProductCode(product);
    const barcodeValue = getBarcodeValue(product);
    const formattedPrice = formatPrice(product.selling_price);

    printWindow.document.write(`
      <html>
        <head>
          <title>Étiquette - ${product.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { size: 50mm 30mm; margin: 2mm; }
            body {
              margin: 0;
              padding: 2mm;
              width: 50mm;
              min-height: 30mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              font-family: Arial, sans-serif;
            }
            .name {
              font-size: 10pt;
              font-weight: 700;
              margin-bottom: 2px;
              text-transform: uppercase;
              word-break: break-word;
            }
            .price {
              font-size: 9pt;
              font-weight: 700;
              color: #0284c7;
              margin-bottom: 2px;
            }
            .code {
              font-size: 7pt;
              color: #64748b;
              margin-top: 2px;
            }
            svg {
              width: 100%;
              max-width: 42mm;
              height: 10mm;
            }
          </style>
        </head>
        <body>
          <div class="name">${product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div class="price">${formattedPrice}</div>
          <svg id="barcode"></svg>
          <div class="code">${code}</div>
          <script>
            JsBarcode("#barcode", "${barcodeValue}", {
              format: "CODE128",
              displayValue: false,
              margin: 0,
              height: 35,
              width: 1.2
            });
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  const handleImport = async (file: File) => {
    try {
      const result = await inventoryService.importProducts(file, 'add');
      alert(result?.message || 'Importation effectuée avec succès.');

      await queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
    } catch (error) {
      console.error('Erreur import:', error);
      alert("Erreur lors de l'importation.");
    }
  };

  const handleCreateFromBarcode = () => {
    setShowBarcodeCreateChoice(false);
    setShowAddModal(true);
  };

  const handleStatCardClick = (type: 'value' | 'margin' | 'lowstock' | 'expired' | 'purchase', title: string) => {
    let data: any = {};

    switch (type) {
      case 'value':
        data = {
          purchaseValue: totalPurchase,
          sellingValue: totalSelling,
          profit: potentialMargin,
          averageMargin: (stats as any)?.average_margin,
          currency: primaryCurrency
        };
        break;
      case 'margin':
        data = {
          totalMargin: potentialMargin,
          byCategory: categories.map((cat: Category) => ({
            category: cat.name,
            profit: (potentialMargin * (cat.product_count || 1)) / (products.length || 1),
            margin: (stats as any)?.average_margin || 0
          }))
        };
        break;
      case 'lowstock':
        data = {
          products: products.filter(p => isProductLowStock(p, lowStockThreshold)).slice(0, 10),
          threshold: lowStockThreshold
        };
        break;
      case 'expired':
        data = {
          products: products.filter(isProductExpired).slice(0, 10)
        };
        break;
      case 'purchase':
        data = {
          totalPurchase,
          productCount: products.length,
          averagePurchasePrice: products.length > 0 ? totalPurchase / products.length : 0
        };
        break;
    }

    setShowStatDetail({ type, title, data });
  };

  // États de chargement
  const isLoading = productsLoading || statsLoading || configLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mb-6 h-28 animate-pulse rounded-[28px] bg-slate-200" />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-200" />
          ))}
        </div>
        <div className="h-105 animate-pulse rounded-[28px] bg-slate-200" />
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="mb-2 text-xl font-black text-slate-900">Erreur de chargement</h2>
          <p className="mb-5 text-sm text-slate-500">Impossible de charger les produits du stock.</p>
          <button
            onClick={() => refetch()}
            className="rounded-2xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-50 p-3 md:p-6">
      <div className="mx-auto max-w-400 space-y-5">
        {/* Header */}
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-md md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                <Warehouse size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl">
                  Inventaire
                </h1>
                <p className="text-sm text-slate-500">
                  {totalProducts} produits • {inventoryHighlights.rupture} ruptures
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-4 py-2 rounded-2xl">
              <DollarSign size={16} className="text-sky-600" />
              <span>Devise: {primaryCurrency || 'CDF'}</span>
              {taxRate !== undefined && (
                <span className="ml-2 text-slate-400">| TVA: {taxRate}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Cartes de statistiques */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Valeur du stock"
            value={formatPrice(totalSelling)}
            icon={<Package size={20} />}
            tone="blue"
            subtitle={`${stats?.total_products ?? 0} produits`}
            onClick={() => handleStatCardClick('value', 'Valeur du stock')}
            loading={statsLoading}
          />
          <StatCard
            title="Marge potentielle"
            value={formatPrice(potentialMargin)}
            icon={<TrendingUp size={20} />}
            tone="green"
            subtitle={`${(stats as any)?.average_margin?.toFixed(1) || 0}% de marge`}
            onClick={() => handleStatCardClick('margin', 'Marge potentielle')}
            loading={statsLoading}
          />
          <StatCard
            title="Stock faible"
            value={inventoryHighlights.low}
            icon={<AlertCircle size={20} />}
            tone="amber"
            subtitle={`${inventoryHighlights.rupture} en rupture`}
            onClick={() => handleStatCardClick('lowstock', 'Produits en stock faible')}
          />
          <StatCard
            title="Produits expirés"
            value={inventoryHighlights.expired}
            icon={<Clock size={20} />}
            tone="red"
            subtitle={`Seuil: ${expiryWarningDays || 30} jours`}
            onClick={() => handleStatCardClick('expired', 'Produits expirés')}
          />
          <StatCard
            title="Valeur achat"
            value={formatPrice(totalPurchase)}
            icon={<CircleDollarSign size={20} />}
            tone="violet"
            subtitle="Coût d'acquisition"
            onClick={() => handleStatCardClick('purchase', "Valeur d'achat")}
            loading={statsLoading}
          />
        </div>

        {/* Barre d'actions */}
        <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-3 items-center">
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              onSelect={setSelectedProduct}
              products={products}
              placeholder="Rechercher par nom, code, fournisseur..."
              pharmacyId={pharmacyId}
            />

            <div className="flex flex-wrap gap-2">
              <QuickActionButton
                label="Achat"
                icon={<ShoppingCart size={16} />}
                onClick={() => setShowAchatModal(true)}
                variant="primary"
              />
              <QuickActionButton
                label="Appro"
                icon={<RefreshCw size={16} />}
                onClick={() => {
                  if (selectedProduct) {
                    setShowApproModal(true);
                  } else {
                    alert('Sélectionnez d’abord un produit');
                  }
                }}
                variant="success"
              />
              <QuickActionButton
                label="Ajouter"
                icon={<Plus size={16} />}
                onClick={() => setShowAddModal(true)}
                variant="warning"
              />
              <QuickActionButton
                label="Importer"
                icon={<Upload size={16} />}
                onClick={() => {
                  const input = document.getElementById('inventory-import-input') as HTMLInputElement | null;
                  input?.click();
                }}
              />
              <QuickActionButton
                label="Exporter"
                icon={<Download size={16} />}
                onClick={() => setShowExportModal(true)}
              />
              <QuickActionButton
                label="Mouvements"
                icon={<ClipboardList size={16} />}
                onClick={() => setShowMouvementsModal(true)}
              />
              <QuickActionButton
                label="Rapport"
                icon={<FileBarChart2 size={16} />}
                onClick={() => setShowRapportModal(true)}
              />
              <QuickActionButton
                label="Scanner"
                icon={<ScanLine size={16} />}
                onClick={() => setIsScanning(true)}
              />
              <QuickActionButton
                label="Config"
                icon={<Settings size={16} />}
                onClick={() => setShowConfigModal(true)}
              />
            </div>
          </div>

          <input
            id="inventory-import-input"
            hidden
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.currentTarget.value = '';
            }}
          />

          {/* Filtres */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                showFilters || selectedCategory !== 'all' || selectedLocation !== 'all'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Filter size={16} />
                Filtres
              </span>
            </button>

            <button
              onClick={() => setViewMode(prev => prev === 'list' ? 'grid' : 'list')}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                {viewMode === 'list' ? <Grid size={16} /> : <List size={16} />}
                {viewMode === 'list' ? 'Grille' : 'Liste'}
              </span>
            </button>

            <button
              onClick={() => setShowProductList(true)}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                <Eye size={16} />
                Tout voir ({totalProducts})
              </span>
            </button>

            <button
              onClick={() => setShowInitialStockModal(true)}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                <Boxes size={16} />
                Stock initial
              </span>
            </button>

            <button
              onClick={() => refetch()}
              className={`rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 ${
                isFetching ? 'animate-pulse' : ''
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
                Rafraîchir
              </span>
            </button>
          </div>

          {/* Panneau de filtres */}
          {showFilters && (
            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">Toutes les catégories</option>
                {categories.map((cat: Category) => (
                  <option key={String(cat.id)} value={cat.name}>
                    {cat.name} {cat.product_count ? `(${cat.product_count})` : ''}
                  </option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">Tous les emplacements</option>
                <option value="principal">Principal</option>
                <option value="reserve">Réserve</option>
              </select>

              <select
                value="all"
                onChange={() => {}}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">État du stock : tous</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock faible</option>
                <option value="out_of_stock">Rupture</option>
                <option value="expired">Périmé</option>
              </select>
            </div>
          )}

          {/* Scanner */}
          {isScanning && (
            <div className="relative mt-4 overflow-hidden rounded-3xl border-4 border-sky-500 bg-black">
              <div id="reader" className="w-full" />
              <button
                onClick={() => setIsScanning(false)}
                className="absolute right-3 top-3 rounded-xl bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Liste/Grille des produits */}
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                <Package size={14} />
                {totalProducts} produits
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                <AlertCircle size={14} />
                {inventoryHighlights.low} faibles
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-red-700">
                <Clock size={14} />
                {inventoryHighlights.rupture} ruptures
              </span>
              {primaryCurrency && (
                <span className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-purple-700">
                  <DollarSign size={14} />
                  {primaryCurrency}
                </span>
              )}
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-200">
                <thead className="border-b border-slate-100 bg-white">
                  <tr>
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">#</th>
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('name')}>
                      Produit {sortConfig?.field === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Catégorie</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('quantity')}>
                      Stock {sortConfig?.field === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('selling_price')}>
                      Prix vente {sortConfig?.field === 'selling_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('purchase_price')}>
                      Prix achat {sortConfig?.field === 'purchase_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Profit
                    </th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      État
                    </th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {displayedProducts.map((product, index) => {
                    const lowStock = isProductLowStock(product, lowStockThreshold);
                    const expired = isProductExpired(product);
                    const outOfStock = isProductOutOfStock(product);
                    const badge = getStockBadge(product, lowStockThreshold);
                    const profit = (product.selling_price - product.purchase_price) * product.quantity;

                    return (
                      <tr
                        key={String(product.id)}
                        className={`transition-colors hover:bg-sky-50/40 ${
                          expired ? 'bg-red-50/50' : outOfStock ? 'bg-red-50/30' : lowStock ? 'bg-amber-50/40' : 'bg-white'
                        }`}
                      >
                        <td className="px-3 py-3 text-sm font-bold text-slate-500">{index + 1}</td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                              <Package size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">
                                {product.name}
                              </p>
                              <p className="truncate text-xs font-semibold text-slate-400">
                                {getProductCode(product)}
                                {product.location && ` • ${product.location}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-sm font-semibold text-slate-600">
                          {getCategoryName(product)}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1 text-xs font-black ${
                              outOfStock
                                ? 'bg-red-100 text-red-700'
                                : lowStock
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {product.quantity}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right text-sm font-black text-slate-800">
                          {formatPrice(product.selling_price)}
                        </td>

                        <td className="px-3 py-3 text-right text-sm font-black text-slate-500">
                          {formatPrice(product.purchase_price)}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <span className="text-sm font-black text-emerald-600">
                            {formatPrice(profit)}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowApproModal(true);
                              }}
                              className="rounded-xl bg-emerald-600 p-2 text-white hover:bg-emerald-700"
                              title="Approvisionner"
                            >
                              <RefreshCw size={14} />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowMouvementsModal(true);
                              }}
                              className="rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700"
                              title="Mouvements"
                            >
                              <ClipboardList size={14} />
                            </button>

                            <button
                              onClick={() => handlePrintLabel(product)}
                              className="rounded-xl bg-amber-500 p-2 text-white hover:bg-amber-600"
                              title="Imprimer étiquette"
                            >
                              <Printer size={14} />
                            </button>

                            <button
                              onClick={() => setSelectedProduct(product)}
                              className="rounded-xl bg-slate-700 p-2 text-white hover:bg-slate-800"
                              title="Modifier"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              onClick={() => handleDelete(String(product.id))}
                              className="rounded-xl bg-red-600 p-2 text-white hover:bg-red-700"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
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
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 xl:grid-cols-5">
              {displayedProducts.map((product) => {
                const lowStock = isProductLowStock(product, lowStockThreshold);
                const expired = isProductExpired(product);
                const outOfStock = isProductOutOfStock(product);
                const badge = getStockBadge(product, lowStockThreshold);

                return (
                  <div
                    key={String(product.id)}
                    className={`rounded-3xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                      expired
                        ? 'border-red-200 bg-red-50/40'
                        : outOfStock
                        ? 'border-red-200 bg-red-50/30'
                        : lowStock
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                          {getProductCode(product)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-black text-slate-900">
                          {product.name}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mb-3 flex justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 py-3">
                      <Barcode
                        value={getBarcodeValue(product)}
                        format="CODE128"
                        width={1}
                        height={30}
                        displayValue={false}
                        margin={0}
                      />
                    </div>

                    <div className="mb-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Catégorie</span>
                        <span className="max-w-[50%] truncate font-bold text-slate-700">
                          {getCategoryName(product)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Stock</span>
                        <span className={`font-black ${outOfStock ? 'text-red-600' : lowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {product.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prix</span>
                        <span className="font-black text-sky-600">
                          {formatPrice(product.selling_price)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Emplacement</span>
                        <span className="font-bold text-slate-600">
                          {product.location || 'Principal'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowApproModal(true);
                        }}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Appro
                      </button>
                      <button
                        onClick={() => handlePrintLabel(product)}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        Étiquette
                      </button>
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowMouvementsModal(true);
                        }}
                        className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                      >
                        Mouv.
                      </button>
                      <button
                        onClick={() => handleDelete(String(product.id))}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Suppr.
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sortedProducts.length === 0 && (
            <div className="px-4 py-16 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-base font-black text-slate-500">Aucun produit trouvé</p>
              <p className="mt-2 text-sm text-slate-400">
                {searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'
                  ? 'Essayez de modifier les filtres'
                  : 'Ajoutez votre premier produit'}
              </p>
            </div>
          )}

          {sortedProducts.length > displayedProducts.length && (
            <div className="border-t border-slate-100 px-4 py-4">
              <button
                onClick={() => setShowProductList(true)}
                className="w-full rounded-2xl bg-slate-50 py-3 text-sm font-black text-sky-600 transition-colors hover:bg-sky-50"
              >
                Voir tous les produits ({sortedProducts.length})
              </button>
            </div>
          )}
        </div>

        {/* FAB mobile */}
        {isMobile && (
          <div className="fixed bottom-4 left-4 right-4 z-40 grid grid-cols-3 gap-3">
            <button
              onClick={() => setShowAchatModal(true)}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              Achat
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              Produit
            </button>
            <button
              onClick={() => setIsScanning(true)}
              className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              Scan
            </button>
          </div>
        )}

        {/* Modals */}
        {showBarcodeCreateChoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                  <ScanLine size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Code-barres détecté</h3>
                  <p className="text-sm text-slate-500">
                    Aucun produit n'est lié à ce code.
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Code détecté
                </p>
                <p className="mt-2 break-all font-mono text-sm font-bold text-slate-800">
                  {barcodeToCreate}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setShowBarcodeCreateChoice(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Fermer
                </button>
                <button
                  onClick={handleCreateFromBarcode}
                  className="rounded-2xl bg-sky-600 px-4 py-3 font-bold text-white hover:bg-sky-700"
                >
                  Créer ce produit
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddModal && (
          <CreateProductView
            open={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              setBarcodeToCreate('');
            }}
            onSuccess={() => {
              refetch();
              setShowAddModal(false);
              setBarcodeToCreate('');
            }}
            initialValues={
              barcodeToCreate
                ? {
                    barcode: barcodeToCreate,
                    code: barcodeToCreate,
                  }
                : undefined
            }
            pharmacyId={pharmacyId}
          />
        )}

        {showProductList && (
          <ProductListView
            open={showProductList}
            onClose={() => setShowProductList(false)}
            products={sortedProducts}
            onSelectProduct={(product: Product) => {
              setSelectedProduct(product);
              setShowProductList(false);
            }}
            onPrintLabel={handlePrintLabel}
          />
        )}

        {showExportModal && (
          <ExportInventory
            open={showExportModal}
            onClose={() => setShowExportModal(false)}
            filters={{
              search: searchTerm,
              category: selectedCategory !== 'all' ? selectedCategory : undefined,
            }}
          />
        )}

        {showAchatModal && (
          <AchatView
            open={showAchatModal}
            onClose={() => setShowAchatModal(false)}
            onSuccess={() => {
              refetch();
              setShowAchatModal(false);
            }}
          />
        )}

        {showApproModal && selectedProduct && (
          <ApprovisionnerView
            open={showApproModal}
            onClose={() => {
              setShowApproModal(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            onSuccess={() => {
              refetch();
              setShowApproModal(false);
              setSelectedProduct(null);
            }}
          />
        )}

        {showInitialStockModal && (
          <InitialStockView
            open={showInitialStockModal}
            onClose={() => setShowInitialStockModal(false)}
            onSuccess={() => {
              refetch();
              setShowInitialStockModal(false);
            }}
          />
        )}

        {showMouvementsModal && (
          <MouvementsView
            open={showMouvementsModal}
            onClose={() => {
              setShowMouvementsModal(false);
              setSelectedProduct(null);
            }}
            productId={selectedProduct ? String(selectedProduct.id) : undefined}
            productName={selectedProduct?.name}
            pharmacyId={pharmacyId}
          />
        )}

        {showRapportModal && (
          <RapportStockView
            open={showRapportModal}
            onClose={() => setShowRapportModal(false)}
            pharmacyId={pharmacyId}
          />
        )}

        {showStatDetail && (
          <StatCardDetail
            title={showStatDetail.title}
            type={showStatDetail.type}
            data={showStatDetail.data}
            onClose={() => setShowStatDetail(null)}
            pharmacyId={pharmacyId}
          />
        )}

        {showConfigModal && config && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                    <Settings size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900">Configuration du stock</h3>
                    <p className="text-sm text-slate-500">
                      Paramètres de gestion d'inventaire
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 font-bold text-slate-800">Seuils d'alerte</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Stock faible (quantité)</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Alerte expiration (jours)</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {expiryWarningDays ?? 30} jours
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 font-bold text-slate-800">Configuration financière</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Devise principale</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {primaryCurrency || 'CDF'}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Taux TVA</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {taxRate ?? 0}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 font-bold text-slate-800">Méthodes de calcul</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Prix de vente</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {config?.automaticPricing?.enabled ? 'Auto (marge fixe)' : 'Manuel'}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Marge par défaut</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {config?.marginConfig?.defaultMargin ?? 25}%
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <h4 className="mb-3 font-bold text-slate-800">Horaires de service</h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Ouverture</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {config?.workingHours?.startTime || '08:00'}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-600">Fermeture</label>
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 font-mono font-bold">
                        {config?.workingHours?.endTime || '20:00'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-2xl bg-slate-100 px-6 py-3 font-bold text-slate-700 hover:bg-slate-200"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}