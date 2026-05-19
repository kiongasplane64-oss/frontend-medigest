// components/inventory/Expiration.tsx
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  AlertTriangle,
  Eye,
  Package,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Clock,
  AlertCircle,
  CheckCircle,
  Download,
  RefreshCw,
} from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type {
  Product,
  ExpiryStatus,
  ExpiryAlertItem,
  ExpirationStats,
  ExpiryThresholds,
  ExpiryAlert,
} from '@/types/inventory.types';

interface ExpirationProps {
  pharmacyId: string;
  branchId?: string;
  formatPrice: (price: number) => string;
  onViewProduct?: (product: Product) => void;
}

type ExpiryFilterStatus = 'expired' | 'critical' | 'warning' | 'all';

const DAYS_THRESHOLDS: ExpiryThresholds = {
  critical: 7,
  warning: 30,
};

interface StatusConfig {
  label: string;
  color: string;
  borderColor: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const STATUS_CONFIG: Record<ExpiryFilterStatus, StatusConfig> = {
  expired: {
    label: 'Expirés',
    color: 'bg-red-100 text-red-700',
    borderColor: 'border-red-200',
    icon: AlertCircle,
    description: 'Produits dont la date de péremption est dépassée',
  },
  critical: {
    label: 'Expire bientôt (≤7j)',
    color: 'bg-orange-100 text-orange-700',
    borderColor: 'border-orange-200',
    icon: AlertTriangle,
    description: 'Produits qui expirent dans moins de 7 jours',
  },
  warning: {
    label: 'Expire prochainement (≤30j)',
    color: 'bg-yellow-100 text-yellow-700',
    borderColor: 'border-yellow-200',
    icon: Clock,
    description: 'Produits qui expirent dans moins de 30 jours',
  },
  all: {
    label: 'Tous',
    color: 'bg-slate-100 text-slate-700',
    borderColor: 'border-slate-200',
    icon: Package,
    description: 'Tous les produits avec dates de péremption',
  },
};

// Interface pour l'affichage (enrichie avec les infos d'expiration)
interface DisplayExpiryProduct {
  id: string;
  name: string;
  code: string;
  barcode: string | null;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  expiry_date: string | null;
  days_until_expiry: number | null;
  expiry_status: ExpiryStatus | null;
  location: string | null;
  supplier: string | null;
  category: string | null;
  commercial_name: string | null;
  unit: string | null;
  alert_threshold: number | null;
  branch_id: string | null;
}

// Convertir ExpiryAlertItem en DisplayExpiryProduct
function alertToDisplayProduct(alert: ExpiryAlertItem): DisplayExpiryProduct {
  return {
    id: alert.id,
    name: alert.name,
    code: alert.code || '',
    barcode: alert.barcode ?? null,
    quantity: alert.quantity,
    purchase_price: alert.purchase_price ?? 0,
    selling_price: alert.selling_price ?? 0,
    expiry_date: alert.expiry_date,
    days_until_expiry: alert.days_until_expiry,
    expiry_status: alert.status,
    location: alert.location ?? null,
    supplier: alert.supplier ?? null,
    category: alert.category ?? null,
    commercial_name: alert.commercial_name ?? null,
    unit: alert.unit ?? null,
    alert_threshold: alert.alert_threshold ?? null,
    branch_id: alert.branch_id ?? null,
  };
}

// Convertir Product en DisplayExpiryProduct avec calculs
function productToDisplayProduct(product: Product): DisplayExpiryProduct {
  let daysUntilExpiry: number | null = null;
  let expiryStatus: ExpiryStatus | null = null;

  if (product.expiry_date) {
    const today = new Date();
    daysUntilExpiry = Math.ceil(
      (new Date(product.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysUntilExpiry < 0) {
      expiryStatus = 'expired';
    } else if (daysUntilExpiry <= DAYS_THRESHOLDS.critical) {
      expiryStatus = 'critical';
    } else if (daysUntilExpiry <= DAYS_THRESHOLDS.warning) {
      expiryStatus = 'warning';
    }
  }

  return {
    id: product.id,
    name: product.name,
    code: product.code,
    barcode: product.barcode ?? null,
    quantity: product.quantity,
    purchase_price: product.purchase_price,
    selling_price: product.selling_price,
    expiry_date: product.expiry_date ?? null,
    days_until_expiry: daysUntilExpiry,
    expiry_status: expiryStatus,
    location: product.location ?? null,
    supplier: product.supplier ?? null,
    category: typeof product.category === 'string' ? product.category : (product.category?.name ?? null),
    commercial_name: product.commercial_name ?? null,
    unit: product.unit ?? null,
    alert_threshold: product.alert_threshold ?? null,
    branch_id: product.branch_id ?? null,
  };
}

// Convertir ExpiryAlert (de inventoryService) en DisplayExpiryProduct
function expiryAlertToDisplayProduct(alert: ExpiryAlert): DisplayExpiryProduct {
  const daysUntilExpiry = alert.days_until_expiry ?? alert.days_remaining;
  
  return {
    id: alert.product_id,
    name: alert.product_name,
    code: '',
    barcode: null,
    quantity: 0,
    purchase_price: 0,
    selling_price: 0,
    expiry_date: alert.expiry_date,
    days_until_expiry: daysUntilExpiry ?? null,
    expiry_status: alert.type === 'expired' ? 'expired' : 'warning',
    location: null,
    supplier: null,
    category: null,
    commercial_name: null,
    unit: null,
    alert_threshold: null,
    branch_id: alert.branch_id ?? null,
  };
}

export default function Expiration({
  pharmacyId,
  branchId,
  formatPrice,
  onViewProduct,
}: ExpirationProps) {
  // États
  const [statusFilter, setStatusFilter] = useState<ExpiryFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sortField, setSortField] = useState<'expiry_date' | 'name' | 'quantity' | 'days_until_expiry'>('expiry_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Récupérer les alertes de péremption depuis l'API
  const {
    data: expiryData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['expiry-alerts', pharmacyId, branchId],
    queryFn: async () => {
      if (!pharmacyId) return { expired: [] as DisplayExpiryProduct[], expiringSoon: [] as DisplayExpiryProduct[] };

      const response = await inventoryService.getExpiryAlerts(Number(pharmacyId));
      
      // La réponse peut être de deux types selon l'implémentation
      // Type 1: ExpiryAlertsResponse avec expired et expiring_soon (ExpiryAlertItem[])
      // Type 2: GetExpiryAlertsResponse avec expired et expiringSoon (ExpiryAlert[])
      
      let expiredProducts: DisplayExpiryProduct[] = [];
      let expiringSoonProducts: DisplayExpiryProduct[] = [];

      // Vérifier si c'est le type ExpiryAlertItem[]
      if (response.expired && response.expired.length > 0 && 'name' in response.expired[0]) {
        expiredProducts = (response.expired as unknown as ExpiryAlertItem[]).map(alertToDisplayProduct);
        const expiringSoon = (response as any).expiring_soon || (response as any).expiringSoon || [];
        expiringSoonProducts = expiringSoon.map(alertToDisplayProduct);
      } 
      // Sinon, c'est le type ExpiryAlert[]
      else if (response.expired && response.expired.length > 0) {
        expiredProducts = (response.expired as unknown as ExpiryAlert[]).map(expiryAlertToDisplayProduct);
        const expiringSoon = (response as any).expiringSoon || (response as any).expiring_soon || [];
        expiringSoonProducts = expiringSoon.map(expiryAlertToDisplayProduct);
      }

      // Filtrer par branche si nécessaire
      if (branchId) {
        return {
          expired: expiredProducts.filter((p) => p.branch_id === branchId),
          expiringSoon: expiringSoonProducts.filter((p) => p.branch_id === branchId),
        };
      }

      return { expired: expiredProducts, expiringSoon: expiringSoonProducts };
    },
    enabled: !!pharmacyId,
    staleTime: 60000,
  });

  // Récupérer tous les produits pour le filtre "all"
  const {
    data: allProductsData,
    isLoading: isLoadingAll,
  } = useQuery({
    queryKey: ['all-products-expiry', pharmacyId, branchId],
    queryFn: async () => {
      if (!pharmacyId) return { products: [] as DisplayExpiryProduct[] };

      const response = await inventoryService.getProducts({
        skip: 0,
        limit: 10000,
        pharmacy_id: pharmacyId,
        branch_id: branchId,
      });

      // Filtrer les produits avec date d'expiration
      const productsWithExpiry = response.products
        .filter((product: Product) => product.expiry_date)
        .map(productToDisplayProduct);

      return { products: productsWithExpiry };
    },
    enabled: !!pharmacyId && statusFilter === 'all',
    staleTime: 60000,
  });

  // Obtenir les produits à afficher selon le filtre
  const getFilteredProducts = (): DisplayExpiryProduct[] => {
    if (statusFilter === 'expired') {
      return expiryData?.expired || [];
    }

    if (statusFilter === 'critical') {
      return (expiryData?.expiringSoon || []).filter(
        (p: DisplayExpiryProduct) => p.expiry_status === 'critical'
      );
    }

    if (statusFilter === 'warning') {
      return (expiryData?.expiringSoon || []).filter(
        (p: DisplayExpiryProduct) => p.expiry_status === 'warning'
      );
    }

    // 'all' - tous les produits avec date d'expiration
    return allProductsData?.products || [];
  };

  // Filtrer par recherche
  const getSearchedProducts = (products: DisplayExpiryProduct[]): DisplayExpiryProduct[] => {
    if (!searchQuery.trim()) return products;

    const query = searchQuery.toLowerCase().trim();
    return products.filter(
      (p: DisplayExpiryProduct) =>
        p.name.toLowerCase().includes(query) ||
        (p.code && p.code.toLowerCase().includes(query)) ||
        (p.barcode && p.barcode.toLowerCase().includes(query))
    );
  };

  // Trier les produits
  const getSortedProducts = (products: DisplayExpiryProduct[]): DisplayExpiryProduct[] => {
    return [...products].sort((a: DisplayExpiryProduct, b: DisplayExpiryProduct) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'quantity':
          aVal = a.quantity || 0;
          bVal = b.quantity || 0;
          break;
        case 'days_until_expiry':
          aVal = a.days_until_expiry ?? Infinity;
          bVal = b.days_until_expiry ?? Infinity;
          break;
        case 'expiry_date':
        default:
          aVal = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
          bVal = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
          break;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  // Pagination
  const getPaginatedProducts = (products: DisplayExpiryProduct[]): DisplayExpiryProduct[] => {
    const start = (page - 1) * limit;
    return products.slice(start, start + limit);
  };

  // Statistiques conformes à ExpirationStats
  const stats = useMemo((): ExpirationStats => {
    const expired = expiryData?.expired?.length || 0;
    const critical = (expiryData?.expiringSoon || []).filter((p: DisplayExpiryProduct) => p.expiry_status === 'critical').length;
    const warning = (expiryData?.expiringSoon || []).filter((p: DisplayExpiryProduct) => p.expiry_status === 'warning').length;
    const total = (allProductsData?.products || []).length;

    return { expired, critical, warning, total };
  }, [expiryData, allProductsData]);

  // Produits traités
  const filteredProducts = getFilteredProducts();
  const searchedProducts = getSearchedProducts(filteredProducts);
  const sortedProducts = getSortedProducts(searchedProducts);
  const paginatedProducts = getPaginatedProducts(sortedProducts);
  const totalPages = Math.ceil(sortedProducts.length / limit);

  // Obtenir le badge de statut
  const getStatusBadge = (product: DisplayExpiryProduct): { label: string; color: string } => {
    const days = product.days_until_expiry;

    if (!product.expiry_date) {
      return { label: 'Non défini', color: 'bg-slate-100 text-slate-600' };
    }

    const today = new Date();
    const expiryDate = new Date(product.expiry_date);

    if (expiryDate < today) {
      return { label: 'Expiré', color: 'bg-red-100 text-red-700' };
    }

    if (days !== null && days <= DAYS_THRESHOLDS.critical) {
      return { label: `Expire dans ${days} jour${days > 1 ? 's' : ''}`, color: 'bg-orange-100 text-orange-700' };
    }

    if (days !== null && days <= DAYS_THRESHOLDS.warning) {
      return { label: `Expire dans ${days} jours`, color: 'bg-yellow-100 text-yellow-700' };
    }

    return { label: 'Valide', color: 'bg-green-100 text-green-700' };
  };

  // Formater la date
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Exporter les données
  const handleExport = () => {
    if (sortedProducts.length === 0) return;

    const exportData = sortedProducts.map((p: DisplayExpiryProduct) => ({
      Nom: p.name,
      Code: p.code || '',
      'Code-barres': p.barcode || '',
      Quantité: p.quantity,
      "Prix d'achat": p.purchase_price,
      'Prix de vente': p.selling_price,
      "Date d'expiration": formatDate(p.expiry_date),
      'Jours restants': p.days_until_expiry ?? '—',
      Statut: getStatusBadge(p).label,
      Emplacement: p.location || '',
      Fournisseur: p.supplier || '',
      Catégorie: p.category || '',
      Lot: p.barcode || '',
    }));

    const headers = Object.keys(exportData[0]);
    const csvRows = [
      headers.join(','),
      ...exportData.map((row) =>
        headers.map((header) => JSON.stringify(row[header as keyof typeof row] || '')).join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `expiration_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convertir un DisplayExpiryProduct en Product pour onViewProduct
  const convertToProduct = (display: DisplayExpiryProduct): Product => {
    return {
      id: display.id,
      name: display.name,
      code: display.code,
      barcode: display.barcode,
      quantity: display.quantity,
      purchase_price: display.purchase_price,
      selling_price: display.selling_price,
      expiry_date: display.expiry_date,
      location: display.location,
      supplier: display.supplier,
      category: display.category || undefined,
      unit: display.unit,
      alert_threshold: display.alert_threshold || 0,
      commercial_name: display.commercial_name,
      is_active: true,
      is_available: true,
      created_at: '',
      updated_at: '',
      available_quantity: display.quantity,
      reserved_quantity: 0,
      has_tva: false,
      tva_rate: 0,
      stock_status: display.quantity === 0 ? 'out_of_stock' : 'in_stock',
      expiry_status: display.expiry_status || 'valid',
      total_sold: 0,
      purchase_value: 0,
      selling_value: 0,
      total_margin: 0,
      margin_rate: 0,
    };
  };

  const isLoadingData = isLoading || (statusFilter === 'all' && isLoadingAll);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Calendar className="text-medical" size={20} />
            Gestion des péremptions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Suivez les produits proches de leur date d'expiration
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm"
          >
            <RefreshCw size={16} className={isLoadingData ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            onClick={handleExport}
            disabled={sortedProducts.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(Object.keys(STATUS_CONFIG) as ExpiryFilterStatus[]).map((status) => {
          const config = STATUS_CONFIG[status];
          const Icon = config.icon;
          const statValue = status === 'all' ? stats.total : stats[status as keyof Omit<ExpirationStats, 'total'>];

          return (
            <div
              key={status}
              className={`rounded-xl p-4 cursor-pointer transition-all ${
                statusFilter === status
                  ? `${config.color.replace('text-', 'bg-').replace(/\d+/g, '50')} border-2 ${config.borderColor} shadow-sm`
                  : 'bg-white border border-slate-200 hover:shadow-md'
              }`}
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
            >
              <div className="flex items-center justify-between">
                <Icon size={20} className={config.color.split(' ')[1]} />
                <span className={`text-2xl font-bold ${config.color.split(' ')[1]}`}>
                  {statValue}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 mt-2">{config.label}</p>
              <p className="text-xs text-slate-500">{config.description}</p>
            </div>
          );
        })}
      </div>

      {/* Info sur le filtre actuel */}
      <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${STATUS_CONFIG[statusFilter].color}`}>
            {(() => {
              const Icon = STATUS_CONFIG[statusFilter].icon;
              return <Icon size={18} />;
            })()}
          </div>
          <div>
            <p className="font-medium text-slate-800">{STATUS_CONFIG[statusFilter].label}</p>
            <p className="text-sm text-slate-500">{STATUS_CONFIG[statusFilter].description}</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Rechercher par nom, code ou code-barres..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setPage(1);
          }}
          className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Tableau des produits */}
      {isLoadingData ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical"></div>
        </div>
      ) : isError ? (
        <div className="bg-red-50 rounded-xl p-4 text-red-600 text-center">
          Erreur lors du chargement des données: {(error as Error)?.message}
          <button onClick={() => refetch()} className="ml-2 underline">
            Réessayer
          </button>
        </div>
      ) : sortedProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <CheckCircle className="mx-auto text-green-500 mb-3" size={48} />
          <p className="text-slate-600">
            {statusFilter === 'expired'
              ? 'Aucun produit expiré dans le stock'
              : statusFilter === 'critical'
              ? 'Aucun produit n\'expire dans les 7 prochains jours'
              : statusFilter === 'warning'
              ? 'Aucun produit n\'expire dans les 30 prochains jours'
              : 'Aucun produit avec date d\'expiration trouvé'}
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      <button
                        onClick={() => {
                          if (sortField === 'name') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('name');
                            setSortOrder('asc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-slate-700"
                      >
                        Produit
                        {sortField === 'name' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Code</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      <button
                        onClick={() => {
                          if (sortField === 'quantity') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('quantity');
                            setSortOrder('desc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-slate-700 ml-auto"
                      >
                        Qté
                        {sortField === 'quantity' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Prix d'achat</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Prix de vente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                      <button
                        onClick={() => {
                          if (sortField === 'expiry_date') {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('expiry_date');
                            setSortOrder('asc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-slate-700"
                      >
                        Date expiration
                        {sortField === 'expiry_date' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product: DisplayExpiryProduct) => {
                    const statusBadge = getStatusBadge(product);
                    return (
                      <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{product.name}</div>
                          {product.commercial_name && (
                            <div className="text-xs text-slate-400">{product.commercial_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{product.code || '—'}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <span
                            className={
                              product.quantity === 0
                                ? 'text-red-500'
                                : product.quantity <= (product.alert_threshold || 0)
                                ? 'text-orange-500'
                                : 'text-slate-700'
                            }
                          >
                            {product.quantity}
                          </span>
                          {product.unit && <span className="text-xs text-slate-400 ml-1">{product.unit}</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatPrice(product.purchase_price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {formatPrice(product.selling_price)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="font-mono">{formatDate(product.expiry_date)}</div>
                          {product.days_until_expiry !== null && product.days_until_expiry > 0 && (
                            <div className="text-xs text-slate-400">J-{product.days_until_expiry}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color}`}
                          >
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onViewProduct?.(convertToProduct(product))}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-medical"
                            title="Voir le produit"
                          >
                            <Eye size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setPage((p: number) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
              >
                <ChevronLeft size={16} />
                Précédent
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">
                  Page {page} sur {totalPages}
                </span>
                <span className="text-xs text-slate-400">({sortedProducts.length} produits)</span>
              </div>
              <button
                onClick={() => setPage((p: number) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
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
}