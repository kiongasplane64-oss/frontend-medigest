// components/inventory/StockAlert.tsx
import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  PackageX,
  TrendingDown,
  Calendar,
  Clock,
  Download,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Eye,
  ShoppingCart,
} from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { Product, ExpiryAlert } from '@/types/inventory.types';

type TabType = 'ruptures' | 'jamais_vendus' | 'peremptions';

interface StockAlertProps {
  pharmacyId: string;
  branchId?: string;
  formatPrice?: (price: number) => string;
  onViewProduct?: (product: Product) => void;
}

// Type pour les données de péremption transformées
interface TransformedExpiryAlert {
  product_id: string;
  product_name: string;
  expiry_date: string;
  days_remaining: number;
}

export default function StockAlert({
  pharmacyId,
  branchId,
  formatPrice = (price) => `${price.toLocaleString()} FC`,
  onViewProduct,
}: StockAlertProps) {
  const queryClient = useQueryClient();
  
  // États
  const [activeTab, setActiveTab] = useState<TabType>('ruptures');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [sortBy, setSortBy] = useState<'name' | 'quantity'>('name');
  const [sortOrder] = useState<'asc' | 'desc'>('asc');

  // =========================================================
  // REQUÊTES API
  // =========================================================

  // Récupérer tous les produits (pour les ruptures et jamais vendus)
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    refetch: refetchProducts,
  } = useQuery({
    queryKey: ['stock-alert-products', pharmacyId, branchId, page, limit, searchQuery, sortBy, sortOrder],
    queryFn: async () => {
      if (!pharmacyId) return { products: [], total: 0 };
      
      const response = await inventoryService.getProducts({
        skip: (page - 1) * limit,
        limit: 10000,
        search: searchQuery || undefined,
        pharmacy_id: pharmacyId,
        branch_id: branchId || undefined,
        include_sales_stats: true,
      });
      return response;
    },
    staleTime: 30000,
    enabled: !!pharmacyId,
  });

  // Récupérer les alertes de péremption
  const {
    data: expiryAlerts,
    isLoading: isLoadingExpiryAlerts,
    refetch: refetchExpiryAlerts,
  } = useQuery({
    queryKey: ['expiry-alerts', pharmacyId, branchId],
    queryFn: async () => {
      if (!pharmacyId) return { expired: [], expiring_soon: [], counts: { expired: 0, expiring_soon: 0 }, days_threshold: 30 };
      return await inventoryService.getExpiryAlerts(30);
    },
    staleTime: 30000,
    enabled: !!pharmacyId,
  });

  // Rafraîchir toutes les données
  const refreshAll = useCallback(() => {
    refetchProducts();
    refetchExpiryAlerts();
    queryClient.invalidateQueries({ queryKey: ['products'] });
  }, [refetchProducts, refetchExpiryAlerts, queryClient]);

  // =========================================================
  // TRAITEMENT DES DONNÉES
  // =========================================================

  // 1. Produits en rupture (stock = 0)
  const outOfStockProducts = useMemo(() => {
    if (!productsData?.products) return [];
    
    const outOfStock = productsData.products.filter(
      (product) => product.stock_status === 'out_of_stock' || product.quantity === 0
    );
    
    // Trier
    const sorted = [...outOfStock];
    sorted.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortBy === 'name') {
        aVal = a.name;
        bVal = b.name;
      } else {
        aVal = a.quantity || 0;
        bVal = b.quantity || 0;
      }
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
    
    // Filtrer par recherche
    if (searchQuery) {
      return sorted.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return sorted;
  }, [productsData?.products, sortBy, sortOrder, searchQuery]);

  // 2. Produits jamais vendus (ventes = 0 depuis création)
  const neverSoldProducts = useMemo(() => {
    if (!productsData?.products) return [];
    
    const neverSold = productsData.products.filter((product) => {
      const salesStats = (product as any).sales_stats;
      const totalSold = salesStats?.last_30_days_sold || 0;
      return totalSold === 0;
    });
    
    // Filtrer par recherche
    if (searchQuery) {
      return neverSold.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.code?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return neverSold;
  }, [productsData?.products, searchQuery]);

  // 3. Produits expirés et proches d'expiration
  const expiryData = useMemo<{
    expired: TransformedExpiryAlert[];
    expiringSoon: TransformedExpiryAlert[];
  }>(() => {
    if (!expiryAlerts) return { expired: [], expiringSoon: [] };
    
    // Produits expirés
    const expired: TransformedExpiryAlert[] = (expiryAlerts.expired || []).map((alert: ExpiryAlert) => ({
      product_id: alert.product_id,
      product_name: alert.product_name,
      expiry_date: alert.expiry_date,
      days_remaining: alert.days_remaining || 0,
    }));
    
    // Produits proches d'expiration
    const expiringSoon: TransformedExpiryAlert[] = (expiryAlerts.expiring_soon || []).map((alert: ExpiryAlert) => ({
      product_id: alert.product_id,
      product_name: alert.product_name,
      expiry_date: alert.expiry_date,
      days_remaining: alert.days_remaining || 0,
    }));
    
    return {
      expired,
      expiringSoon,
    };
  }, [expiryAlerts]);

  // =========================================================
  // EXPORT CSV
  // =========================================================

  const handleExportCSV = useCallback(async () => {
    try {
      let dataToExport: Record<string, any>[] = [];
      let title = '';
      
      if (activeTab === 'ruptures') {
        title = 'Produits_en_rupture_de_stock';
        dataToExport = outOfStockProducts.map(p => ({
          'Code': p.code || '',
          'Produit': p.name,
          'Stock_disponible': p.quantity || 0,
          'Prix_achat': p.purchase_price || 0,
          'Prix_vente': p.selling_price || 0,
          'Categorie': p.category || '',
        }));
      } else if (activeTab === 'jamais_vendus') {
        title = 'Produits_jamais_vendus';
        dataToExport = neverSoldProducts.map(p => ({
          'Code': p.code || '',
          'Produit': p.name,
          'Stock_actuel': p.quantity || 0,
          'Prix_achat': p.purchase_price || 0,
          'Prix_vente': p.selling_price || 0,
          'Date_creation': p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A',
          'Categorie': p.category || '',
        }));
      } else if (activeTab === 'peremptions') {
        title = 'Produits_expires_et_proches_expiration';
        const allExpiry: TransformedExpiryAlert[] = [...expiryData.expired, ...expiryData.expiringSoon];
        dataToExport = allExpiry.map(e => ({
          'Code': '',
          'Produit': e.product_name,
          'Date_expiration': new Date(e.expiry_date).toLocaleDateString(),
          'Jours_restants': e.days_remaining,
          'Statut': e.days_remaining <= 0 ? 'EXPIRÉ' : e.days_remaining <= 7 ? 'CRITIQUE' : 'Attention',
        }));
      }
      
      if (dataToExport.length === 0) {
        alert('Aucune donnée à exporter');
        return;
      }
      
      const headers = Object.keys(dataToExport[0]);
      const csvRows = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(header => {
            const value = row[header];
            return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
          }).join(',')
        )
      ];
      
      const blob = new Blob([`\uFEFF${csvRows.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erreur export:', error);
      alert('Erreur lors de l\'export des données');
    }
  }, [activeTab, outOfStockProducts, neverSoldProducts, expiryData]);

  // =========================================================
  // PAGINATION
  // =========================================================

  const getCurrentItems = (): Product[] | TransformedExpiryAlert[] => {
    if (activeTab === 'ruptures') return outOfStockProducts;
    if (activeTab === 'jamais_vendus') return neverSoldProducts;
    if (activeTab === 'peremptions') return [...expiryData.expired, ...expiryData.expiringSoon];
    return [];
  };

  const currentItems = getCurrentItems();
  const totalPages = Math.ceil(currentItems.length / limit);
  
  // Pour la pagination, on conserve le type approprié selon l'onglet
  const getPaginatedItems = (): Product[] | TransformedExpiryAlert[] => {
    return currentItems.slice((page - 1) * limit, page * limit);
  };

  // =========================================================
  // RENDU DES TABLEAUX
  // =========================================================

  const formatExpiryDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR');
  };

  const getExpiryStatusColor = (daysRemaining: number) => {
    if (daysRemaining <= 0) return 'bg-red-100 text-red-700';
    if (daysRemaining <= 7) return 'bg-orange-100 text-orange-700';
    if (daysRemaining <= 30) return 'bg-yellow-100 text-yellow-700';
    return 'bg-green-100 text-green-700';
  };

  const getExpiryStatusText = (daysRemaining: number) => {
    if (daysRemaining <= 0) return `Expiré depuis ${Math.abs(daysRemaining)}j`;
    if (daysRemaining <= 7) return `Expire dans ${daysRemaining}j (critique)`;
    if (daysRemaining <= 30) return `Expire dans ${daysRemaining}j`;
    return `Expire dans ${daysRemaining}j`;
  };

  // Rendu du tableau des ruptures
  const renderRupturesTable = () => {
    const items = getPaginatedItems() as Product[];
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-red-50 border-b border-red-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-red-600">
                <button onClick={() => setSortBy('name')} className="flex items-center gap-1">
                  Produit
                  {sortBy === 'name' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-red-600">
                <button onClick={() => setSortBy('quantity')} className="flex items-center gap-1">
                  Stock disponible
                  {sortBy === 'quantity' && (sortOrder === 'asc' ? ' ↑' : ' ↓')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-red-600">Fini depuis</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-red-600">Prix achat</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-red-600">Prix vente</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-red-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product, index) => {
              // Calcul approximatif du nombre de jours depuis la rupture (basé sur la date de création)
              const daysSinceOutOfStock = product.created_at
                ? Math.floor((new Date().getTime() - new Date(product.created_at).getTime()) / (1000 * 60 * 60 * 24))
                : null;
              
              return (
                <tr key={product.id || index} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{product.name}</div>
                    <div className="text-xs text-slate-400">Code: {product.code || 'N/A'}</div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-600">
                      <PackageX size={12} />
                      {product.quantity || 0} unités
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {product.quantity === 0 ? (
                      daysSinceOutOfStock !== null ? (
                        <span className="flex items-center gap-1">
                          <Clock size={14} className="text-red-400" />
                          {daysSinceOutOfStock} jour(s)
                        </span>
                      ) : (
                        <span className="text-red-500">En rupture</span>
                      )
                    ) : (
                      <span className="text-amber-500">Stock faible ({product.quantity} unités)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">{formatPrice(product.purchase_price || 0)}</td>
                  <td className="px-4 py-3 text-right text-sm">{formatPrice(product.selling_price || 0)}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => onViewProduct?.(product)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-medical hover:bg-medical/10"
                    >
                      <Eye size={14} />
                      Voir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            <PackageX size={40} className="mx-auto mb-2 text-slate-300" />
            <p>Aucun produit en rupture de stock</p>
          </div>
        )}
      </div>
    );
  };

  // Rendu du tableau des produits jamais vendus
  const renderNeverSoldTable = () => {
    const items = getPaginatedItems() as Product[];
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Produit</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">Stock</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-600">Prix achat</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-600">Prix vente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Date création</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((product, index) => (
              <tr key={product.id || index} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{product.name}</div>
                  <div className="text-xs text-slate-400">Code: {product.code || 'N/A'}</div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm">{product.quantity || 0} unités</span>
                </td>
                <td className="px-4 py-3 text-right text-sm">{formatPrice(product.purchase_price || 0)}</td>
                <td className="px-4 py-3 text-right text-sm">{formatPrice(product.selling_price || 0)}</td>
                <td className="px-4 py-3 text-sm text-slate-500">
                  {product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onViewProduct?.(product)}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-medical hover:bg-medical/10"
                  >
                    <Eye size={14} />
                    Voir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 && (
          <div className="py-8 text-center text-slate-500">
            <ShoppingCart size={40} className="mx-auto mb-2 text-slate-300" />
            <p>Tous les produits ont déjà été vendus au moins une fois</p>
          </div>
        )}
      </div>
    );
  };

  // Rendu du tableau des péremptions
  const renderPeremptionsTable = () => (
    <div className="space-y-6">
      {/* Produits expirés */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-red-600">
          <AlertCircle size={18} />
          Produits expirés ({expiryData.expired.length})
        </h3>
        <div className="overflow-x-auto rounded-lg border border-red-200">
          <table className="w-full">
            <thead className="bg-red-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Produit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-red-600">Date expiration</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-red-600">Expiré depuis</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-red-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expiryData.expired.slice((page - 1) * limit, page * limit).map((alert, index) => (
                <tr key={alert.product_id || index} className="border-b border-red-100 hover:bg-red-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{alert.product_name}</div>
                  </td>
                  <td className="px-4 py-2 text-sm text-red-600">{formatExpiryDate(alert.expiry_date)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs text-red-600">
                      <Clock size={12} />
                      {Math.abs(alert.days_remaining)} jour(s)
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button className="text-xs text-medical hover:underline">Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Produits proches d'expiration */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-amber-600">
          <Calendar size={18} />
          Produits proches d'expiration ({expiryData.expiringSoon.length})
        </h3>
        <div className="overflow-x-auto rounded-lg border border-amber-200">
          <table className="w-full">
            <thead className="bg-amber-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-amber-600">Produit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-amber-600">Date expiration</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-amber-600">Expire dans</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-amber-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expiryData.expiringSoon.slice((page - 1) * limit, page * limit).map((alert, index) => (
                <tr key={alert.product_id || index} className="border-b border-amber-100 hover:bg-amber-50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{alert.product_name}</div>
                  </td>
                  <td className="px-4 py-2 text-sm">{formatExpiryDate(alert.expiry_date)}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${getExpiryStatusColor(alert.days_remaining)}`}>
                      <Calendar size={12} />
                      {getExpiryStatusText(alert.days_remaining)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button className="text-xs text-medical hover:underline">Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {expiryData.expired.length === 0 && expiryData.expiringSoon.length === 0 && (
        <div className="py-8 text-center text-slate-500">
          <Calendar size={40} className="mx-auto mb-2 text-slate-300" />
          <p>Aucun produit expiré ou proche d'expiration</p>
        </div>
      )}
    </div>
  );

  // =========================================================
  // RENDU PRINCIPAL
  // =========================================================

  const isLoading = isLoadingProducts || isLoadingExpiryAlerts;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Alertes et Analyse du Stock</h2>
          <p className="text-sm text-slate-500">
            Pharmacie: {pharmacyId} {branchId && `- Branche: ${branchId}`}
          </p>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={refreshAll}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 rounded-lg bg-medical px-3 py-2 text-sm text-white hover:bg-medical-dark"
          >
            <Download size={16} />
            Exporter CSV
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <button
          onClick={() => { setActiveTab('ruptures'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'ruptures'
              ? 'border-b-2 border-red-500 text-red-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <AlertTriangle size={16} />
          Ruptures ({outOfStockProducts.length})
        </button>
        <button
          onClick={() => { setActiveTab('jamais_vendus'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'jamais_vendus'
              ? 'border-b-2 border-amber-500 text-amber-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <TrendingDown size={16} />
          Jamais vendus ({neverSoldProducts.length})
        </button>
        <button
          onClick={() => { setActiveTab('peremptions'); setPage(1); }}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'peremptions'
              ? 'border-b-2 border-orange-500 text-orange-600'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Calendar size={16} />
          Péremptions ({expiryData.expired.length + expiryData.expiringSoon.length})
        </button>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
          className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-medical"
        />
      </div>

      {/* Chargement */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-medical"></div>
        </div>
      )}

      {/* Contenu des onglets */}
      {!isLoading && (
        <>
          {activeTab === 'ruptures' && renderRupturesTable()}
          {activeTab === 'jamais_vendus' && renderNeverSoldTable()}
          {activeTab === 'peremptions' && renderPeremptionsTable()}
        </>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            Précédent
          </button>
          <span className="text-sm text-slate-600">
            Page {page} sur {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm disabled:opacity-50"
          >
            Suivant
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}