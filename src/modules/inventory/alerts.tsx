// src/pages/inventory/alerts.tsx
/**
 * ===================================================================
 * INVENTORY ALERTS - Gestion des alertes de stock et péremption
 * Affiche les produits en stock bas, rupture, et ceux proche de la péremption
 * ===================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useActiveBranch } from '@/hooks/useActiveBranch';
import { useAuthStore } from '@/store/useAuthStore';
import { inventoryService } from '@/services/inventoryService';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { withWritePermission } from '@/hoc/withWritingPermission';
import { useTimezone } from '@/hooks/useTimezone';

// Import des icônes (uniquement celles utilisées)
import {
  ArrowLeft,
  Package,
  AlertTriangle,
  Clock,
  Calendar,
  RefreshCw,
  Printer,
  Building2,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Truck,
  Eye,
  Layers,
  Bell,
  DollarSign,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';

// Types locaux
interface StockAlertItem {
  id: string;
  product_id: string;
  product_name: string;
  code: string;
  current_stock: number;
  threshold: number;
  type: 'out_of_stock' | 'low_stock';
  severity: 'high' | 'medium' | 'low';
  created_at: string;
  category?: string;
  selling_price?: number;
  purchase_price?: number;
}

interface ExpiryAlertItem {
  id: string;
  product_id: string;
  product_name: string;
  code: string;
  expiry_date: string;
  days_remaining: number;
  quantity: number;
  type: 'expired' | 'expiring_soon';
  severity: 'high' | 'medium' | 'low';
  created_at: string;
  batch_number?: string;
  category?: string;
}

// Types pour les statistiques du tableau de bord
interface AlertStats {
  total_alerts: number;
  out_of_stock: number;
  low_stock: number;
  expired: number;
  expiring_soon: number;
  high_severity: number;
  medium_severity: number;
  low_severity: number;
}

// Type pour les alertes combinées
type CombinedAlert = 
  | (StockAlertItem & { alertType: 'stock' })
  | (ExpiryAlertItem & { alertType: 'expiry' });

// Interface pour RestockRequest
interface RestockRequest {
  product_id: string;
  quantity: number;
  branch_id?: string;
  notes?: string;
}

// Composant de carte statistique
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactElement;
  color: string;
  onClick?: () => void;
}> = ({ title, value, icon, color, onClick }) => {
  const colorClasses: Record<string, string> = {
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  };

  return (
    <div
      onClick={onClick}
      className={`cursor-pointer rounded-xl border bg-white p-4 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md dark:bg-slate-800 ${colorClasses[color] || colorClasses.blue}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider opacity-70">{title}</p>
          <p className="mt-1 text-2xl font-black">{value}</p>
        </div>
        <div className={`rounded-xl p-2 ${colorClasses[color]?.replace('border', 'bg') || 'bg-blue-100'}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// Composant d'alerte de stock
const StockAlertRow: React.FC<{
  alert: StockAlertItem;
  onViewProduct: (productId: string) => void;
  onRestock: (productId: string, productName: string) => void;
}> = ({ alert, onViewProduct, onRestock }) => {
  const getSeverityBadge = () => {
    switch (alert.severity) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-300">
            <AlertTriangle size={12} /> Critique
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
            <AlertTriangle size={12} /> Bas
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
            <Bell size={12} /> Attention
          </span>
        );
    }
  };

  const progressPercentage = Math.min(
    100,
    ((alert.current_stock + (alert.type === 'low_stock' ? 0 : alert.threshold)) /
      (alert.threshold * 2)) *
      100
  );

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 transition-all hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-slate-800 dark:text-slate-200">{alert.product_name}</h4>
            {getSeverityBadge()}
            <span className="text-xs text-slate-400 dark:text-slate-500">Code: {alert.code || 'N/A'}</span>
          </div>

          {alert.category && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Catégorie: {alert.category}</p>
          )}

          <div className="mt-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-300">
                Stock actuel: {alert.current_stock} unités
              </span>
              <span className="text-slate-400 dark:text-slate-500">
                Seuil: {alert.threshold} unités
              </span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
              <div
                className={`h-full rounded-full transition-all ${
                  alert.severity === 'high'
                    ? 'bg-red-500'
                    : alert.severity === 'medium'
                    ? 'bg-amber-500'
                    : 'bg-yellow-500'
                }`}
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
            {alert.selling_price && (
              <span className="flex items-center gap-1">
                <DollarSign size={12} />
                Prix vente: {formatCurrency(alert.selling_price)}
              </span>
            )}
            {alert.purchase_price && (
              <span className="flex items-center gap-1">
                <Package size={12} />
                Prix achat: {formatCurrency(alert.purchase_price)}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onViewProduct(alert.product_id)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            <Eye size={16} className="inline mr-1" />
            Voir
          </button>
          <button
            onClick={() => onRestock(alert.product_id, alert.product_name)}
            className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            <Truck size={16} className="inline mr-1" />
            Réapprovisionner
          </button>
        </div>
      </div>
    </div>
  );
};

// Composant d'alerte de péremption
const ExpiryAlertRow: React.FC<{
  alert: ExpiryAlertItem;
  onViewProduct: (productId: string) => void;
  onMarkAsUsed: (productId: string, productName: string, quantity: number) => void;
}> = ({ alert, onViewProduct, onMarkAsUsed }) => {
  const getSeverityBadge = () => {
    if (alert.type === 'expired') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-300">
          <XCircle size={12} /> Expiré
        </span>
      );
    }

    if (alert.days_remaining <= 7) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/50 dark:text-red-300">
          <AlertTriangle size={12} /> Expire bientôt ({alert.days_remaining}j)
        </span>
      );
    }

    if (alert.days_remaining <= 15) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700 dark:bg-orange-900/50 dark:text-orange-300">
          <Clock size={12} /> {alert.days_remaining} jours restants
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-bold text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300">
        <Calendar size={12} /> {alert.days_remaining} jours
      </span>
    );
  };

  const getExpiryColor = () => {
    if (alert.type === 'expired') return 'border-red-200 bg-red-50/30 dark:border-red-800 dark:bg-red-900/10';
    if (alert.days_remaining <= 7) return 'border-red-200 bg-red-50/20 dark:border-red-800 dark:bg-red-900/5';
    if (alert.days_remaining <= 15) return 'border-orange-200 bg-orange-50/20 dark:border-orange-800 dark:bg-orange-900/5';
    return 'border-yellow-200 bg-yellow-50/20 dark:border-yellow-800 dark:bg-yellow-900/5';
  };

  return (
    <div className={`rounded-xl border bg-white p-4 transition-all hover:shadow-md dark:bg-slate-800 ${getExpiryColor()}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-bold text-slate-800 dark:text-slate-200">{alert.product_name}</h4>
            {getSeverityBadge()}
            <span className="text-xs text-slate-400 dark:text-slate-500">Code: {alert.code || 'N/A'}</span>
          </div>

          {alert.batch_number && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Lot: {alert.batch_number}
            </p>
          )}

          <div className="mt-2 grid grid-cols-2 gap-4 text-sm sm:flex sm:gap-6">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Date d'expiration</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">
                {formatDate(alert.expiry_date)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500">Quantité</p>
              <p className="font-medium text-slate-700 dark:text-slate-300">{alert.quantity} unités</p>
            </div>
            {alert.category && (
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500">Catégorie</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{alert.category}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onViewProduct(alert.product_id)}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
          >
            <Eye size={16} className="inline mr-1" />
            Voir
          </button>
          {alert.type !== 'expired' && (
            <button
              onClick={() => onMarkAsUsed(alert.product_id, alert.product_name, alert.quantity)}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <ShoppingBag size={16} className="inline mr-1" />
              Promouvoir
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Composant principal
const InventoryAlertsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { id: activeBranchId, name: branchName, address: branchAddress, phone: branchPhone, email: branchEmail } = useActiveBranch();
  const { timezone } = useTimezone();

  // États
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stockAlerts, setStockAlerts] = useState<StockAlertItem[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    total_alerts: 0,
    out_of_stock: 0,
    low_stock: 0,
    expired: 0,
    expiring_soon: 0,
    high_severity: 0,
    medium_severity: 0,
    low_severity: 0,
  });

  // Filtres
  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'expiry'>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // États pour les actions
  const [selectedProduct, setSelectedProduct] = useState<{ id: string; name: string } | null>(null);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [promoteQuantity, setPromoteQuantity] = useState(0);
  const [restockQuantity, setRestockQuantity] = useState(0);

  // Calcul des alertes filtrées
  const filteredStockAlerts = useMemo(() => {
    let filtered = [...stockAlerts];

    if (severityFilter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        alert =>
          alert.product_name.toLowerCase().includes(term) ||
          alert.code?.toLowerCase().includes(term) ||
          alert.category?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [stockAlerts, severityFilter, searchTerm]);

  const filteredExpiryAlerts = useMemo(() => {
    let filtered = [...expiryAlerts];

    if (severityFilter !== 'all') {
      filtered = filtered.filter(alert => alert.severity === severityFilter);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        alert =>
          alert.product_name.toLowerCase().includes(term) ||
          alert.code?.toLowerCase().includes(term) ||
          alert.category?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [expiryAlerts, severityFilter, searchTerm]);

  const allFilteredAlerts = useMemo((): CombinedAlert[] => {
    const stockItems = filteredStockAlerts.map(a => ({ ...a, alertType: 'stock' as const }));
    const expiryItems = filteredExpiryAlerts.map(a => ({ ...a, alertType: 'expiry' as const }));
    return [...stockItems, ...expiryItems].sort((a, b) => {
      if (a.alertType === 'stock' && b.alertType === 'expiry') return -1;
      if (a.alertType === 'expiry' && b.alertType === 'stock') return 1;
      return 0;
    });
  }, [filteredStockAlerts, filteredExpiryAlerts]);

  // Récupération des alertes
  const fetchAlerts = useCallback(async () => {
    if (!activeBranchId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Récupérer les alertes de stock
      const stockAlertResponse = await inventoryService.getStockAlerts();
      const stockData = stockAlertResponse;

      // Transformer les alertes de stock
      const transformedStockAlerts: StockAlertItem[] = [
        ...(stockData.out_of_stock || []).map((alert: any) => ({
          id: `oos-${alert.product_id}`,
          product_id: alert.product_id,
          product_name: alert.product_name,
          code: alert.code || '',
          current_stock: 0,
          threshold: alert.threshold || 5,
          type: 'out_of_stock' as const,
          severity: 'high' as const,
          created_at: new Date().toISOString(),
          category: alert.category,
          selling_price: alert.selling_price,
          purchase_price: alert.purchase_price,
        })),
        ...(stockData.low_stock || []).map((alert: any) => ({
          id: `ls-${alert.product_id}`,
          product_id: alert.product_id,
          product_name: alert.product_name,
          code: alert.code || '',
          current_stock: alert.current_stock || 0,
          threshold: alert.threshold || 10,
          type: 'low_stock' as const,
          severity: (alert.current_stock <= (alert.threshold || 10) / 2 ? 'high' : 'medium') as 'high' | 'medium',
          created_at: new Date().toISOString(),
          category: alert.category,
          selling_price: alert.selling_price,
          purchase_price: alert.purchase_price,
        })),
      ];

      // Récupérer les alertes de péremption
      const expiryResponse = await inventoryService.getExpiryAlerts(30);
      const expiryData = expiryResponse;

      const transformedExpiryAlerts: ExpiryAlertItem[] = [
        ...(expiryData.expired || []).map((alert: any) => ({
          id: `exp-${alert.product_id}`,
          product_id: alert.product_id,
          product_name: alert.product_name,
          code: alert.code || '',
          expiry_date: alert.expiry_date,
          days_remaining: alert.days_remaining || 0,
          quantity: 1,
          type: 'expired' as const,
          severity: 'high' as const,
          created_at: new Date().toISOString(),
          batch_number: alert.batch_number,
          category: alert.category,
        })),
        ...(expiryData.expiring_soon || []).map((alert: any) => {
          let severity: 'high' | 'medium' | 'low' = 'low';
          const daysLeft = alert.days_remaining || 0;
          if (daysLeft <= 7) severity = 'high';
          else if (daysLeft <= 15) severity = 'medium';
          else severity = 'low';
          
          return {
            id: `es-${alert.product_id}`,
            product_id: alert.product_id,
            product_name: alert.product_name,
            code: alert.code || '',
            expiry_date: alert.expiry_date,
            days_remaining: daysLeft,
            quantity: alert.quantity || 1,
            type: 'expiring_soon' as const,
            severity,
            created_at: new Date().toISOString(),
            batch_number: alert.batch_number,
            category: alert.category,
          };
        }),
      ];

      setStockAlerts(transformedStockAlerts);
      setExpiryAlerts(transformedExpiryAlerts);

      // Calculer les statistiques
      const outOfStockCount = transformedStockAlerts.filter(a => a.type === 'out_of_stock').length;
      const lowStockCount = transformedStockAlerts.filter(a => a.type === 'low_stock').length;
      const expiredCount = transformedExpiryAlerts.filter(a => a.type === 'expired').length;
      const expiringSoonCount = transformedExpiryAlerts.filter(a => a.type === 'expiring_soon').length;

      const highSeverity = [
        ...transformedStockAlerts.filter(a => a.severity === 'high'),
        ...transformedExpiryAlerts.filter(a => a.severity === 'high'),
      ].length;

      const mediumSeverity = [
        ...transformedStockAlerts.filter(a => a.severity === 'medium'),
        ...transformedExpiryAlerts.filter(a => a.severity === 'medium'),
      ].length;

      const lowSeverity = [
        ...transformedStockAlerts.filter(a => a.severity === 'low'),
        ...transformedExpiryAlerts.filter(a => a.severity === 'low'),
      ].length;

      setStats({
        total_alerts: transformedStockAlerts.length + transformedExpiryAlerts.length,
        out_of_stock: outOfStockCount,
        low_stock: lowStockCount,
        expired: expiredCount,
        expiring_soon: expiringSoonCount,
        high_severity: highSeverity,
        medium_severity: mediumSeverity,
        low_severity: lowSeverity,
      });
    } catch (err) {
      console.error('Erreur lors du chargement des alertes:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement des alertes');
    } finally {
      setIsLoading(false);
    }
  }, [activeBranchId]);

  // Rafraîchissement manuel
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchAlerts();
    setIsRefreshing(false);
  }, [fetchAlerts]);

  // Chargement initial
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    fetchAlerts();

    // Rafraîchissement automatique toutes les 30 secondes
    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAuthenticated, navigate, fetchAlerts]);

  // Navigation vers le produit
  const handleViewProduct = (productId: string) => {
    navigate(`/inventory/products/${productId}`);
  };

  // Réapprovisionnement
  const handleRestock = (productId: string, productName: string) => {
    setSelectedProduct({ id: productId, name: productName });
    setRestockQuantity(0);
    setShowRestockModal(true);
  };

  const handleConfirmRestock = async () => {
    if (!selectedProduct || restockQuantity <= 0) return;

    try {
      const restockRequest: RestockRequest = {
        product_id: selectedProduct.id,
        quantity: restockQuantity,
        branch_id: activeBranchId || undefined,
      };
      await inventoryService.restockProduct(restockRequest);
      setShowRestockModal(false);
      await fetchAlerts();
    } catch (err) {
      console.error('Erreur lors du réapprovisionnement:', err);
      alert('Erreur lors du réapprovisionnement');
    }
  };

  // Promotion (utilisation des produits proche de péremption)
  const handlePromote = (productId: string, productName: string, quantity: number) => {
    setSelectedProduct({ id: productId, name: productName });
    setPromoteQuantity(quantity);
    setShowPromoteModal(true);
  };

  const handleConfirmPromote = async () => {
    if (!selectedProduct || promoteQuantity <= 0) return;

    // Rediriger vers la page de vente avec le produit pré-sélectionné
    navigate(`/sales/new?product=${selectedProduct.id}&quantity=${promoteQuantity}&promotion=true`);
    setShowPromoteModal(false);
  };

  // Export PDF (version simplifiée - à adapter selon votre générateur PDF)
  const handleExportPDF = () => {
    const pdfData = {
      type: 'alerts',
      data: {
        stock_alerts: filteredStockAlerts,
        expiry_alerts: filteredExpiryAlerts,
        stats,
        filters: {
          severity: severityFilter,
          search: searchTerm,
          tab: activeTab,
        },
        generated_at: new Date().toISOString(),
        branch: branchName,
        timezone,
      },
      userName: user?.nom_complet || 'Utilisateur',
      pharmacyName: branchName || 'Branche non spécifiée',
      pharmacyAddress: branchAddress,
      pharmacyPhone: branchPhone,
      pharmacyEmail: branchEmail,
    };

    try {
      // Créer un blob JSON pour l'export (version simple)
      const blob = new Blob([JSON.stringify(pdfData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `alertes_stock_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur lors de l\'export:', err);
      alert('Une erreur est survenue lors de la génération du fichier');
    }
  };

  // Réinitialisation des filtres
  const handleResetFilters = () => {
    setSeverityFilter('all');
    setSearchTerm('');
    setActiveTab('all');
  };

  // Rendu des onglets
  const renderTabs = () => (
    <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
      <button
        onClick={() => setActiveTab('all')}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
          activeTab === 'all'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
        }`}
      >
        <Layers size={16} />
        Toutes ({stats.total_alerts})
      </button>
      <button
        onClick={() => setActiveTab('stock')}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
          activeTab === 'stock'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
        }`}
      >
        <Package size={16} />
        Stock ({stockAlerts.length})
      </button>
      <button
        onClick={() => setActiveTab('expiry')}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
          activeTab === 'expiry'
            ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
        }`}
      >
        <Calendar size={16} />
        Péremption ({expiryAlerts.length})
      </button>
    </div>
  );

  // Rendu des cartes de statistiques
  const renderStatsCards = () => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
      <StatCard
        title="Total Alertes"
        value={stats.total_alerts}
        icon={<Bell size={18} />}
        color="blue"
        onClick={() => {
          setSeverityFilter('all');
          setActiveTab('all');
        }}
      />
      <StatCard
        title="Stock Épuisé"
        value={stats.out_of_stock}
        icon={<XCircle size={18} />}
        color="red"
        onClick={() => {
          setSeverityFilter('high');
          setActiveTab('stock');
        }}
      />
      <StatCard
        title="Stock Bas"
        value={stats.low_stock}
        icon={<AlertTriangle size={18} />}
        color="amber"
        onClick={() => {
          setSeverityFilter('medium');
          setActiveTab('stock');
        }}
      />
      <StatCard
        title="Expirés"
        value={stats.expired}
        icon={<XCircle size={18} />}
        color="red"
        onClick={() => {
          setSeverityFilter('high');
          setActiveTab('expiry');
        }}
      />
      <StatCard
        title="Expire bientôt"
        value={stats.expiring_soon}
        icon={<Clock size={18} />}
        color="orange"
        onClick={() => {
          setSeverityFilter('high');
          setActiveTab('expiry');
        }}
      />
      <StatCard
        title="Haute Séverité"
        value={stats.high_severity}
        icon={<AlertCircle size={18} />}
        color="red"
        onClick={() => setSeverityFilter('high')}
      />
      <StatCard
        title="Criticité Moyenne"
        value={stats.medium_severity}
        icon={<AlertCircle size={18} />}
        color="yellow"
        onClick={() => setSeverityFilter('medium')}
      />
    </div>
  );

  // Rendu des filtres
  const renderFilters = () => (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as typeof severityFilter)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
          >
            <option value="all">Toutes sévérités</option>
            <option value="high">Haute sévérité</option>
            <option value="medium">Sévérité moyenne</option>
            <option value="low">Basse sévérité</option>
          </select>

          <button
            onClick={handleResetFilters}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <RotateCcw size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // Rendu du contenu principal
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <RefreshCw size={40} className="mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-slate-500 dark:text-slate-400">Chargement des alertes...</p>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <AlertTriangle size={48} className="mx-auto mb-4 text-red-500" />
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={handleRefresh}
            className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600"
          >
            Réessayer
          </button>
        </div>
      );
    }

    if (allFilteredAlerts.length === 0) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
          <h3 className="mb-2 text-lg font-bold text-slate-800 dark:text-slate-200">
            Aucune alerte à afficher
          </h3>
          <p className="text-slate-500 dark:text-slate-400">
            {searchTerm || severityFilter !== 'all'
              ? 'Aucune alerte ne correspond à vos filtres.'
              : 'Tous les stocks sont à des niveaux acceptables.'}
          </p>
          {(searchTerm || severityFilter !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {activeTab === 'all' && (
          <>
            {filteredStockAlerts.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
                  <Package size={20} className="text-blue-500" />
                  Alertes de Stock ({filteredStockAlerts.length})
                </h3>
                {filteredStockAlerts.map((alert) => (
                  <StockAlertRow
                    key={alert.id}
                    alert={alert}
                    onViewProduct={handleViewProduct}
                    onRestock={handleRestock}
                  />
                ))}
              </div>
            )}

            {filteredExpiryAlerts.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-200">
                  <Calendar size={20} className="text-orange-500" />
                  Alertes de Péremption ({filteredExpiryAlerts.length})
                </h3>
                {filteredExpiryAlerts.map((alert) => (
                  <ExpiryAlertRow
                    key={alert.id}
                    alert={alert}
                    onViewProduct={handleViewProduct}
                    onMarkAsUsed={handlePromote}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'stock' && (
          <div className="space-y-2">
            {filteredStockAlerts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
                <p className="text-slate-500 dark:text-slate-400">
                  Aucune alerte de stock
                </p>
              </div>
            ) : (
              filteredStockAlerts.map((alert) => (
                <StockAlertRow
                  key={alert.id}
                  alert={alert}
                  onViewProduct={handleViewProduct}
                  onRestock={handleRestock}
                />
              ))
            )}
          </div>
        )}

        {activeTab === 'expiry' && (
          <div className="space-y-2">
            {filteredExpiryAlerts.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
                <CheckCircle size={40} className="mx-auto mb-3 text-emerald-500" />
                <p className="text-slate-500 dark:text-slate-400">
                  Aucune alerte de péremption
                </p>
              </div>
            ) : (
              filteredExpiryAlerts.map((alert) => (
                <ExpiryAlertRow
                  key={alert.id}
                  alert={alert}
                  onViewProduct={handleViewProduct}
                  onMarkAsUsed={handlePromote}
                />
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-10 transition-colors sm:px-6 lg:px-8">
      {/* En-tête */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Link
            to="/inventory"
            className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
          >
            <ArrowLeft size={16} />
            Retour à l'inventaire
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
            <AlertTriangle className="text-amber-500" size={28} />
            Alertes de Stock
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Gérez les produits en stock bas, en rupture et ceux proche de la péremption
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <Printer size={16} />
            Exporter
          </button>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Informations branche */}
      {branchName && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
          <Building2 size={16} className="text-slate-400" />
          <span className="font-medium text-slate-700 dark:text-slate-300">{branchName}</span>
          {branchAddress && (
            <>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="text-slate-500 dark:text-slate-400">{branchAddress}</span>
            </>
          )}
          <span className="text-slate-300 dark:text-slate-600">•</span>
          <span className="text-slate-500 dark:text-slate-400">Fuseau: {timezone}</span>
        </div>
      )}

      {/* Cartes statistiques */}
      {renderStatsCards()}

      {/* Filtres */}
      {renderFilters()}

      {/* Onglets */}
      {renderTabs()}

      {/* Contenu principal */}
      {renderContent()}

      {/* Modal de réapprovisionnement */}
      {showRestockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="mb-4 text-xl font-bold text-slate-800 dark:text-slate-200">
              Réapprovisionnement
            </h2>
            <p className="mb-4 text-slate-600 dark:text-slate-300">
              Produit: <span className="font-medium">{selectedProduct.name}</span>
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Quantité à ajouter
              </label>
              <input
                type="number"
                min="1"
                value={restockQuantity}
                onChange={(e) => setRestockQuantity(parseInt(e.target.value) || 0)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRestockModal(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmRestock}
                disabled={restockQuantity <= 0}
                className="flex-1 rounded-lg bg-emerald-500 py-2 text-white transition-colors hover:bg-emerald-600 disabled:opacity-50"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de promotion */}
      {showPromoteModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-800">
            <h2 className="mb-4 text-xl font-bold text-slate-800 dark:text-slate-200">
              Promouvoir le produit
            </h2>
            <p className="mb-2 text-slate-600 dark:text-slate-300">
              Produit: <span className="font-medium">{selectedProduct.name}</span>
            </p>
            <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
              Ce produit est proche de sa date d'expiration. Nous vous recommandons de le mettre en promotion.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Quantité à vendre
              </label>
              <input
                type="number"
                min="1"
                max={promoteQuantity}
                value={promoteQuantity}
                onChange={(e) => setPromoteQuantity(parseInt(e.target.value) || 1)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPromoteModal(false)}
                className="flex-1 rounded-lg border border-slate-200 py-2 text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmPromote}
                disabled={promoteQuantity <= 0}
                className="flex-1 rounded-lg bg-amber-500 py-2 text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                Créer une vente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export avec HOC de permission
export default withWritePermission(InventoryAlertsPage, {
  showReadOnlyMessage: true,
  redirectToSubscription: false,
});