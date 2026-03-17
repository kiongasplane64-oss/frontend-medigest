import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search,
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
  ChevronUp,
  ChevronDown,
  Clock,
  Grid,
  List,
  Filter,
  AlertTriangle,
  ArrowRightLeft,
  FileBarChart2,
  ClipboardList,
  Boxes,
  ScanLine,
  Warehouse,
  CircleDollarSign,
} from 'lucide-react';
import Barcode from 'react-barcode';
import { Html5QrcodeScanner } from 'html5-qrcode';

import { inventoryService } from '@/services/inventoryService';
import type { Product, StockStats, Category } from '@/types/inventory.types';
import { formatPrice } from '@/utils/formatters';
import ProductListView from '@/components/ProductListView';
import ExportInventory from '@/components/ExportInventory';
import AchatView from '@/components/AchatView';
import ApprovisionnerView from '@/components/ApprovisionnerView';
import CreateProductView from '@/components/CreateProductView';
import InitialStockView from '@/components/InitialStockView';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: keyof Product;
  direction: SortDirection;
}

interface ProductListResponse {
  products: Product[];
  total?: number;
  page?: number;
  limit?: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'violet';
  subtitle?: string;
}

interface SortableHeaderProps {
  label: string;
  sortKey: keyof Product;
  currentSort: SortConfig | null;
  onSort: (field: keyof Product) => void;
  align?: 'left' | 'center' | 'right';
}

interface QuickActionButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning';
}

const serviceWithOptionalCategories = inventoryService as typeof inventoryService & {
  getCategories?: () => Promise<Category[]>;
  getAlerts?: () => Promise<{
    low_stock_count?: number;
    expiring_soon_count?: number;
    expired_count?: number;
    alerts?: {
      low_stock?: Array<Record<string, unknown>>;
      expiring_soon?: Array<Record<string, unknown>>;
      expired?: Array<Record<string, unknown>>;
    };
  }>;
};

function normalizeProductsResponse(data: unknown): Product[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as Product[];

  const response = data as ProductListResponse;
  if (Array.isArray(response.products)) return response.products;

  return [];
}

function getCategoryName(product: Product): string {
  if (typeof product.category === 'string') return product.category;
  if (product.category && typeof product.category === 'object' && 'name' in product.category) {
    return String((product.category as { name?: string }).name ?? 'Sans catégorie');
  }
  return 'Sans catégorie';
}

function getProductCode(product: Product): string {
  return product.code || product.barcode || 'N/A';
}

function getBarcodeValue(product: Product): string {
  return product.barcode || product.code || product.id;
}

function isProductExpired(product: Product): boolean {
  if (!product.expiry_date) return false;
  const d = new Date(product.expiry_date);
  if (Number.isNaN(d.getTime())) return false;
  return d < new Date();
}

function isProductLowStock(product: Product): boolean {
  const qty = Number(product.quantity ?? 0);
  const threshold = Number(product.alert_threshold ?? 0);
  return qty <= threshold;
}

function getStockBadge(product: Product): {
  label: string;
  className: string;
} {
  if (isProductExpired(product)) {
    return {
      label: 'Périmé',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  const quantity = Number(product.quantity ?? 0);

  if (quantity <= 0) {
    return {
      label: 'Rupture',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (isProductLowStock(product)) {
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

function StatCard({ title, value, icon, tone, subtitle }: StatCardProps) {
  const tones: Record<StatCardProps['tone'], string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100',
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {title}
          </p>
          <p className="truncate text-xl font-black text-slate-900 md:text-3xl">{value}</p>
          {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function QuickActionButton({
  label,
  icon,
  onClick,
  variant = 'default',
}: QuickActionButtonProps) {
  const variants: Record<NonNullable<QuickActionButtonProps['variant']>, string> = {
    default: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    primary: 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-100',
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${variants[variant]}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  onSort,
  align = 'left',
}: SortableHeaderProps) {
  const isActive = currentSort?.field === sortKey;

  const thAlignClass =
    align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';

  const flexAlignClass =
    align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

  return (
    <th
      className={`cursor-pointer px-3 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 transition-colors hover:text-sky-600 md:px-4 ${thAlignClass}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center gap-1 ${flexAlignClass}`}>
        <span className="truncate">{label}</span>
        <div className="flex flex-col opacity-40">
          <ChevronUp
            size={10}
            className={isActive && currentSort?.direction === 'asc' ? 'text-sky-600 opacity-100' : ''}
          />
          <ChevronDown
            size={10}
            className={isActive && currentSort?.direction === 'desc' ? 'text-sky-600 opacity-100' : ''}
          />
        </div>
      </div>
    </th>
  );
}

export default function InventoryList() {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');
  const [showFilters, setShowFilters] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [showApproModal, setShowApproModal] = useState(false);
  const [showInitialStockModal, setShowInitialStockModal] = useState(false);

  const [barcodeToCreate, setBarcodeToCreate] = useState<string>('');
  const [showBarcodeCreateChoice, setShowBarcodeCreateChoice] = useState(false);

  useEffect(() => {
    setViewMode(isMobile ? 'grid' : 'list');
  }, [isMobile]);

  const {
    data: productsData,
    isLoading: productsLoading,
    refetch,
    error: productsError,
    isFetching,
  } = useQuery({
    queryKey: ['inventory-products', searchTerm, selectedCategory],
    queryFn: () =>
      inventoryService.getProducts({
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        limit: 1000,
      }),
    staleTime: 5 * 60 * 1000,
  });

  const { data: stats, isLoading: statsLoading } = useQuery<StockStats>({
    queryKey: ['inventory-stats'],
    queryFn: () => inventoryService.getStats(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: alertsData } = useQuery({
    queryKey: ['inventory-alerts'],
    queryFn: async () => {
      if (typeof serviceWithOptionalCategories.getAlerts === 'function') {
        return serviceWithOptionalCategories.getAlerts();
      }
      return null;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      if (typeof serviceWithOptionalCategories.getCategories === 'function') {
        return serviceWithOptionalCategories.getCategories();
      }

      const products = normalizeProductsResponse(productsData);
      const map = new Map<string, Category>();

      for (const product of products) {
        const name = getCategoryName(product);
        if (!map.has(name)) {
          map.set(name, {
            id: name,
            name,
            product_count: 1,
          } as Category);
        } else {
          const current = map.get(name)!;
          map.set(name, {
            ...current,
            product_count: Number(current.product_count ?? 0) + 1,
          });
        }
      }

      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    },
    staleTime: 10 * 60 * 1000,
    enabled: true,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteProduct(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
      ]);
    },
    onError: (error) => {
      console.error('Erreur suppression produit:', error);
      window.alert('Erreur lors de la suppression du produit.');
    },
  });

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
      (decodedText) => {
        if (!mounted) return;

        const currentProducts = normalizeProductsResponse(productsData);
        const found = currentProducts.find(
          (product) =>
            product.barcode === decodedText ||
            product.code === decodedText ||
            product.id === decodedText,
        );

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
      (scanError) => {
        if (scanError) {
          console.warn('Scan info:', scanError);
        }
      },
    );

    return () => {
      mounted = false;
      if (scanner) {
        scanner.clear().catch((err) => {
          console.warn('Erreur fermeture scanner:', err);
        });
      }
    };
  }, [isScanning, productsData]);

  const products = useMemo(() => normalizeProductsResponse(productsData), [productsData]);

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

  const displayedProducts = useMemo(() => {
    if (viewMode === 'grid') return sortedProducts.slice(0, 12);
    return sortedProducts.slice(0, 10);
  }, [sortedProducts, viewMode]);

  const inventoryHighlights = useMemo(() => {
    const total = products.length;
    const low = products.filter(isProductLowStock).length;
    const expired = products.filter(isProductExpired).length;
    const rupture = products.filter((p) => Number(p.quantity ?? 0) <= 0).length;

    return {
      total,
      low,
      expired,
      rupture,
    };
  }, [products]);

  const totalSelling = Number(stats?.total_value_selling ?? 0);
  const totalPurchase = Number(stats?.total_value_purchase ?? 0);
  const potentialMargin = totalSelling - totalPurchase;

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
          <div class="name">${product.name}</div>
          <div class="price">${formatPrice(product.selling_price)}</div>
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
      window.alert(result?.message || 'Importation effectuée avec succès.');

      await Promise.all([
        refetch(),
        queryClient.invalidateQueries({ queryKey: ['inventory-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-categories'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
      ]);
    } catch (error) {
      console.error('Erreur import:', error);
      window.alert("Erreur lors de l'importation.");
    }
  };

  const handleCreateFromBarcode = () => {
    setShowBarcodeCreateChoice(false);
    setShowAddModal(true);
  };

  if (productsLoading || statsLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mb-6 h-28 animate-pulse rounded-[28px] bg-slate-200" />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#eef6ff,#f8fafc_45%,#f8fafc)] p-3 md:p-6">
      <div className="mx-auto max-w-400 space-y-5">
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-sky-900 p-5 text-white shadow-xl md:p-7">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                  <Warehouse size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-sky-200">
                    Gestion de stock
                  </p>
                  <h1 className="text-2xl font-black tracking-tight md:text-4xl">
                    Tableau de bord inventaire
                  </h1>
                </div>
              </div>

              <p className="max-w-3xl text-sm text-slate-200 md:text-base">
                Interface moderne de gestion des produits, mouvements, ruptures, achats,
                approvisionnements et création rapide par code-barres.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:min-w-140">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-100">
                  Produits
                </p>
                <p className="mt-1 text-2xl font-black">{inventoryHighlights.total}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100">
                  Faibles
                </p>
                <p className="mt-1 text-2xl font-black">{alertsData?.low_stock_count ?? inventoryHighlights.low}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-100">
                  Ruptures
                </p>
                <p className="mt-1 text-2xl font-black">{inventoryHighlights.rupture}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-100">
                  Périmés
                </p>
                <p className="mt-1 text-2xl font-black">{alertsData?.expired_count ?? inventoryHighlights.expired}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Valeur du stock"
            value={formatPrice(totalSelling)}
            icon={<Package size={20} />}
            tone="blue"
            subtitle={`${stats?.total_products ?? 0} produits enregistrés`}
          />
          <StatCard
            title="Marge potentielle"
            value={formatPrice(potentialMargin)}
            icon={<TrendingUp size={20} />}
            tone="green"
            subtitle="Différence vente / achat"
          />
          <StatCard
            title="Stock faible"
            value={stats?.low_stock_count ?? inventoryHighlights.low}
            icon={<AlertCircle size={20} />}
            tone="amber"
            subtitle={`${stats?.out_of_stock_count ?? inventoryHighlights.rupture} en rupture`}
          />
          <StatCard
            title="Produits expirés"
            value={stats?.expired_count ?? inventoryHighlights.expired}
            icon={<Clock size={20} />}
            tone="red"
            subtitle={`${stats?.expiring_soon_count ?? 0} bientôt expirés`}
          />
          <StatCard
            title="Valeur achat"
            value={formatPrice(totalPurchase)}
            icon={<CircleDollarSign size={20} />}
            tone="violet"
            subtitle="Coût global du stock"
          />
        </div>

        <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative flex-1 xl:max-w-2xl">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Rechercher un produit, code, code-barres, fournisseur..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm font-semibold text-slate-700 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                />
                {searchTerm ? (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                  >
                    <X size={14} />
                  </button>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:flex xl:flex-wrap xl:justify-end">
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
                  label="Transfert"
                  icon={<ArrowRightLeft size={16} />}
                  onClick={() => window.alert('Vue transfert à connecter.')}
                />
                <QuickActionButton
                  label="Achat"
                  icon={<ShoppingCart size={16} />}
                  onClick={() => setShowAchatModal(true)}
                  variant="primary"
                />
                <QuickActionButton
                  label="Approvisionner"
                  icon={<RefreshCw size={16} />}
                  onClick={() => {
                    if (selectedProduct) {
                      setShowApproModal(true);
                    } else {
                      window.alert('Sélectionnez d’abord un produit à approvisionner.');
                    }
                  }}
                  variant="success"
                />
                <QuickActionButton
                  label="Rapport stock"
                  icon={<FileBarChart2 size={16} />}
                  onClick={() => window.alert('Module rapport stock à connecter.')}
                />
                <QuickActionButton
                  label="Mouvements"
                  icon={<ClipboardList size={16} />}
                  onClick={() => window.alert('Module mouvements à connecter.')}
                />
                <QuickActionButton
                  label="Ajouter produit"
                  icon={<Plus size={16} />}
                  onClick={() => setShowAddModal(true)}
                  variant="warning"
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

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowFilters((prev) => !prev)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  showFilters || selectedCategory !== 'all'
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
                onClick={() => setViewMode((prev) => (prev === 'list' ? 'grid' : 'list'))}
                className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                <span className="inline-flex items-center gap-2">
                  {viewMode === 'list' ? <Grid size={16} /> : <List size={16} />}
                  {viewMode === 'list' ? 'Vue grille' : 'Vue liste'}
                </span>
              </button>

              <button
                onClick={() => setShowProductList(true)}
                className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                <span className="inline-flex items-center gap-2">
                  <Eye size={16} />
                  Tous les produits
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
                onClick={() => setIsScanning((prev) => !prev)}
                className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  isScanning
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <ScanLine size={16} />
                  Capture code-barres
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

            {showFilters ? (
              <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map((cat) => (
                    <option key={String(cat.id)} value={cat.name}>
                      {cat.name}
                      {cat.product_count ? ` (${cat.product_count})` : ''}
                    </option>
                  ))}
                </select>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                  Fournisseur : tous
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-500">
                  État du stock : tous
                </div>
              </div>
            ) : null}

            {isScanning ? (
              <div className="relative overflow-hidden rounded-3xl border-4 border-sky-500 bg-black">
                <div id="reader" className="w-full" />
                <button
                  onClick={() => setIsScanning(false)}
                  className="absolute right-3 top-3 rounded-xl bg-black/60 p-2 text-white hover:bg-black/80"
                >
                  <X size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                <Package size={14} />
                Total produits : {inventoryHighlights.total}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                <AlertCircle size={14} />
                Produits faibles : {alertsData?.low_stock_count ?? inventoryHighlights.low}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-red-700">
                <Clock size={14} />
                Ruptures : {inventoryHighlights.rupture}
              </span>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-275">
                <thead className="border-b border-slate-100 bg-white">
                  <tr>
                    <SortableHeader
                      label="Code"
                      sortKey="code"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Produit"
                      sortKey="name"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Catégorie"
                      sortKey="category"
                      currentSort={sortConfig}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Stock"
                      sortKey="quantity"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="center"
                    />
                    <SortableHeader
                      label="Prix détail"
                      sortKey="selling_price"
                      currentSort={sortConfig}
                      onSort={handleSort}
                      align="right"
                    />
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
                    const lowStock = isProductLowStock(product);
                    const expired = isProductExpired(product);
                    const badge = getStockBadge(product);

                    return (
                      <tr
                        key={product.id}
                        className={`transition-colors hover:bg-sky-50/40 ${
                          expired ? 'bg-red-50/50' : lowStock ? 'bg-amber-50/40' : 'bg-white'
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
                                {product.supplier ? ` • ${product.supplier}` : ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-sm font-semibold text-slate-600">
                          {getCategoryName(product)}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex min-w-16.5 items-center justify-center rounded-full px-3 py-1 text-xs font-black ${
                              lowStock
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

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-center gap-2">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowApproModal(true);
                              }}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                              title="Approvisionner"
                            >
                              <span className="inline-flex items-center gap-1">
                                <RefreshCw size={12} />
                                Appro
                              </span>
                            </button>

                            <button
                              onClick={() => window.alert(`Mouvements du produit ${product.name} à connecter.`)}
                              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                              title="Mouvements"
                            >
                              <span className="inline-flex items-center gap-1">
                                <ClipboardList size={12} />
                                Mouv.
                              </span>
                            </button>

                            <button
                              onClick={() => handlePrintLabel(product)}
                              className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
                              title="Imprimer"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Printer size={12} />
                                Étiquette
                              </span>
                            </button>

                            <button
                              onClick={() => setSelectedProduct(product)}
                              className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                              title="Modifier"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Edit2 size={12} />
                                Modifier
                              </span>
                            </button>

                            <button
                              onClick={() => handleDelete(product.id)}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                              title="Supprimer"
                            >
                              <span className="inline-flex items-center gap-1">
                                <Trash2 size={12} />
                                Suppr.
                              </span>
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
                const lowStock = isProductLowStock(product);
                const expired = isProductExpired(product);
                const badge = getStockBadge(product);

                return (
                  <div
                    key={product.id}
                    className={`rounded-3xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                      expired
                        ? 'border-red-200 bg-red-50/40'
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
                        <span className={`font-black ${lowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {product.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prix détail</span>
                        <span className="font-black text-sky-600">
                          {formatPrice(product.selling_price)}
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
                        onClick={() => setSelectedProduct(product)}
                        className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sortedProducts.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-base font-black text-slate-500">Aucun produit trouvé</p>
              <p className="mt-2 text-sm text-slate-400">
                {searchTerm || selectedCategory !== 'all'
                  ? 'Essayez de modifier les filtres ou la recherche.'
                  : 'Ajoutez votre premier produit ou importez votre stock.'}
              </p>
            </div>
          ) : null}

          {sortedProducts.length > displayedProducts.length ? (
            <div className="border-t border-slate-100 px-4 py-4">
              <button
                onClick={() => setShowProductList(true)}
                className="w-full rounded-2xl bg-slate-50 py-3 text-sm font-black text-sky-600 transition-colors hover:bg-sky-50"
              >
                Voir tous les produits ({sortedProducts.length})
              </button>
            </div>
          ) : null}
        </div>

        {isMobile ? (
          <div className="fixed bottom-4 left-4 right-4 z-40 grid grid-cols-2 gap-3 md:hidden">
            <button
              onClick={() => setShowAchatModal(true)}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-sky-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <ShoppingCart size={16} />
                Achat
              </span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100"
            >
              <span className="inline-flex items-center justify-center gap-2">
                <Plus size={16} />
                Produit
              </span>
            </button>
          </div>
        ) : null}

        {showBarcodeCreateChoice ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                  <ScanLine size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Code-barres détecté</h3>
                  <p className="text-sm text-slate-500">
                    Aucun produit n&apos;est lié à ce code.
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
        ) : null}

        {showAddModal ? (
          <CreateProductView
            open={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              setBarcodeToCreate('');
            }}
            onSuccess={() => {
              void refetch();
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
          />
        ) : null}

        {showProductList ? (
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
        ) : null}

        {showExportModal ? (
          <ExportInventory
            open={showExportModal}
            onClose={() => setShowExportModal(false)}
            filters={{
              search: searchTerm,
              category: selectedCategory !== 'all' ? selectedCategory : undefined,
            }}
          />
        ) : null}

        {showAchatModal ? (
          <AchatView
            open={showAchatModal}
            onClose={() => setShowAchatModal(false)}
            onSuccess={() => {
              void refetch();
              setShowAchatModal(false);
            }}
          />
        ) : null}

        {showApproModal && selectedProduct ? (
          <ApprovisionnerView
            open={showApproModal}
            onClose={() => {
              setShowApproModal(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            onSuccess={() => {
              void refetch();
              setShowApproModal(false);
              setSelectedProduct(null);
            }}
          />
        ) : null}

        {showInitialStockModal ? (
          <InitialStockView
            open={showInitialStockModal}
            onClose={() => setShowInitialStockModal(false)}
            onSuccess={() => {
              void refetch();
              setShowInitialStockModal(false);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}