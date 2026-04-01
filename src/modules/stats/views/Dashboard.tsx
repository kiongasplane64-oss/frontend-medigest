/**
 * ===================================================================
 * DASHBOARD - Tableau de bord principal de l'application pharmaceutique
 * Utilisation de useActivePharmacy pour la gestion de la pharmacie active
 * ===================================================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate, Link } from 'react-router-dom';
import { useActivePharmacy } from '@/hooks/useActivePharmacy';
import {
  ShoppingBag,
  TrendingUp,
  RefreshCw,
  ArrowRight,
  Package,
  Clock,
  Calendar,
  X,
  LayoutDashboard,
  FileText,
  Printer,
  Building2,
  CheckCircle,
  MapPin,
  Phone,
  AlertTriangle,
  DollarSign,
  Receipt,
  Truck,
  CreditCard,
  Landmark,
  Wallet,
} from 'lucide-react';

import { ExpiryWarningBanner } from '@/components/ExpiryWarningBanner';
import { formatCurrency } from '@/utils/formatters';
import { generateDashboardPDF, PDFData } from '@/utils/pdfGenerator';
import { useTimezone } from '@/hooks/useTimezone';
import { withWritePermission } from '@/hoc/withWritingPermission';
import { dashboardService, DashboardStats, DashboardAlert, DashboardFilters } from '@/services/dashboardService';

// ===================================================================
// TYPES ET INTERFACES
// ===================================================================

type DetailModalType =
  | 'sales'
  | 'profits'
  | 'stock'
  | 'alerts'
  | 'expiry'
  | 'expenses'
  | 'debts'
  | 'purchases'
  | 'transactions';

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: unknown;
  type: DetailModalType;
  onExportPDF: () => void;
  userName?: string;
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  pharmacyEmail?: string;
}

interface DashboardCard {
  id: string;
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactElement;
  iconBgColor: string;
  onClick: () => void;
}

interface RecentTransaction {
  reference: string;
  amount: number;
  date: string;
  payment_method: string;
}

interface RecentPurchase {
  supplier_name: string;
  amount: number;
  date: string;
}

interface DebtItem {
  customer_name: string;
  amount: number;
  due_date: string;
}

interface ExpenseCategory {
  name: string;
  amount: number;
}

interface LowStockProduct {
  name: string;
  current_stock: number;
  threshold: number;
}

interface ExpiringProduct {
  name: string;
  expiry_date: string;
  quantity: number;
}

interface SalesHistoryItem {
  count?: unknown;
}

interface ExtendedDashboardStats {
  daily_sales: number;
  monthly_sales: number;
  sales_trend: number;
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  expired_count: number;
  expiring_soon_count: number;
  total_stock_value: number;
  total_purchase_value: number;
  potential_profit: number;
  net_profit: number;
  active_users: number;
  total_customers: number;
  daily_transactions: number;
  monthly_transactions: number;
  monthly_expenses: number;
  daily_expenses: number;
  monthly_debts: number;
  total_debts: number;
  unpaid_debts: number;
  recovery_rate: number;
  monthly_purchases: number;
  daily_purchases: number;
  suppliers_count: number;
  pending_orders: number;
  daily_profit: number;
  stock_turnover: number;
  recent_transactions: RecentTransaction[];
  recent_purchases: RecentPurchase[];
  debt_list: DebtItem[];
  expense_categories: ExpenseCategory[];
  low_stock_products: LowStockProduct[];
  expiring_products: ExpiringProduct[];
}

// ===================================================================
// CONSTANTES ET UTILITAIRES
// ===================================================================

const EMPTY_STATS: ExtendedDashboardStats = {
  daily_sales: 0,
  monthly_sales: 0,
  sales_trend: 0,
  total_products: 0,
  out_of_stock_count: 0,
  low_stock_count: 0,
  expired_count: 0,
  expiring_soon_count: 0,
  total_stock_value: 0,
  total_purchase_value: 0,
  potential_profit: 0,
  net_profit: 0,
  active_users: 0,
  total_customers: 0,
  daily_transactions: 0,
  monthly_transactions: 0,
  monthly_expenses: 0,
  daily_expenses: 0,
  monthly_debts: 0,
  total_debts: 0,
  unpaid_debts: 0,
  recovery_rate: 0,
  monthly_purchases: 0,
  daily_purchases: 0,
  suppliers_count: 0,
  pending_orders: 0,
  daily_profit: 0,
  stock_turnover: 0,
  recent_transactions: [],
  recent_purchases: [],
  debt_list: [],
  expense_categories: [],
  low_stock_products: [],
  expiring_products: [],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isRenderablePrimitive(value: unknown): boolean {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  );
}

function toDisplayText(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (value instanceof Date) return value.toLocaleString();
  try {
    return JSON.stringify(value);
  } catch {
    return '-';
  }
}

function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function sumMonthlyTransactions(salesHistory: unknown): number {
  if (!Array.isArray(salesHistory)) return 0;
  return salesHistory.reduce((sum, item) => {
    if (!isObject(item)) return sum;
    return sum + safeNumber((item as SalesHistoryItem).count, 0);
  }, 0);
}

function normalizeStats(raw: unknown): ExtendedDashboardStats {
  if (!isObject(raw)) return EMPTY_STATS;

  const monthlyTransactions =
    raw.monthly_transactions !== undefined
      ? safeNumber(raw.monthly_transactions)
      : sumMonthlyTransactions(raw.sales_history);

  return {
    daily_sales: safeNumber(raw.daily_sales),
    monthly_sales: safeNumber(raw.monthly_sales),
    sales_trend: safeNumber(raw.sales_trend),

    total_products: safeNumber(raw.total_products),
    out_of_stock_count: safeNumber(raw.out_of_stock_count),
    low_stock_count: safeNumber(raw.low_stock_count),
    expired_count: safeNumber(raw.expired_count),
    expiring_soon_count: safeNumber(raw.expiring_soon_count),

    total_stock_value: safeNumber(raw.total_stock_value),
    total_purchase_value: safeNumber(raw.total_purchase_value),
    potential_profit: safeNumber(raw.potential_profit),
    net_profit: safeNumber(raw.net_profit),
    active_users: safeNumber(raw.active_users),
    total_customers: safeNumber(raw.total_customers),

    daily_transactions: safeNumber(raw.daily_transactions ?? raw.daily_sales_count),
    monthly_transactions: monthlyTransactions,

    monthly_expenses: safeNumber(raw.monthly_expenses ?? raw.monthly_costs),
    daily_expenses: safeNumber(raw.daily_expenses),
    monthly_debts: safeNumber(raw.monthly_debts),
    total_debts: safeNumber(raw.total_debts),
    unpaid_debts: safeNumber(raw.unpaid_debts),
    recovery_rate: safeNumber(raw.recovery_rate),

    monthly_purchases: safeNumber(raw.monthly_purchases),
    daily_purchases: safeNumber(raw.daily_purchases),
    suppliers_count: safeNumber(raw.suppliers_count),
    pending_orders: safeNumber(raw.pending_orders ?? raw.pending_transfers_count),

    daily_profit: safeNumber(raw.daily_profit),
    stock_turnover: safeNumber(raw.stock_turnover),

    recent_transactions: safeArray<RecentTransaction>(raw.recent_transactions),
    recent_purchases: safeArray<RecentPurchase>(raw.recent_purchases),
    debt_list: safeArray<DebtItem>(raw.debt_list),
    expense_categories: safeArray<ExpenseCategory>(raw.expense_categories),
    low_stock_products: safeArray<LowStockProduct>(raw.low_stock_products),
    expiring_products: safeArray<ExpiringProduct>(raw.expiring_products),
  };
}

function safeDateDisplay(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString();
}

function safeDateOnlyDisplay(value?: string): string {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
}

function getErrorMessage(error: unknown, fallback = 'Erreur lors du chargement des données'): string {
  if (isObject(error)) {
    const response = error.response;
    if (isObject(response)) {
      const data = response.data;
      if (isObject(data)) {
        const detail = data.detail;
        if (typeof detail === 'string' && detail.trim()) return detail;
        if (isObject(detail) && typeof detail.message === 'string' && detail.message.trim()) {
          return detail.message;
        }
        if (typeof data.message === 'string' && data.message.trim()) return data.message;
      }
    }
    if (typeof error.message === 'string' && error.message.trim()) return error.message;
  }

  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
}

// ===================================================================
// COMPOSANTS DE MODAL
// ===================================================================

const DetailModal: React.FC<DetailModalProps> = React.memo(({
  isOpen,
  onClose,
  title,
  data,
  type,
  onExportPDF,
  userName,
  pharmacyName,
  pharmacyAddress,
  pharmacyPhone,
  pharmacyEmail,
}) => {
  const renderContent = useCallback((): React.ReactNode => {
    if (!data) {
      return (
        <div className="py-12 text-center">
          <FileText size={48} className="mx-auto mb-4 text-slate-400 opacity-50" />
          <p className="text-slate-500 dark:text-slate-400">Aucune donnée disponible</p>
        </div>
      );
    }

    const statsData = normalizeStats(data);

    switch (type) {
      case 'sales':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Ventes aujourd'hui"
                value={formatCurrency(statsData.daily_sales)}
                subtitle={`${statsData.daily_transactions} transaction(s)`}
                icon={<ShoppingBag size={20} />}
                color="blue"
              />
              <DetailCard
                title="Ventes ce mois"
                value={formatCurrency(statsData.monthly_sales)}
                subtitle={`Du 01 au ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                icon={<Calendar size={20} />}
                color="indigo"
              />
              <DetailCard
                title="Tendance"
                value={`${statsData.sales_trend}%`}
                subtitle={statsData.sales_trend >= 0 ? 'En hausse' : 'En baisse'}
                icon={<TrendingUp size={20} />}
                color="emerald"
              />
              <DetailCard
                title="Panier moyen"
                value={formatCurrency(
                  statsData.daily_transactions > 0
                    ? statsData.daily_sales / statsData.daily_transactions
                    : 0,
                )}
                subtitle="par transaction"
                icon={<Receipt size={20} />}
                color="purple"
              />
            </div>

            {statsData.recent_transactions.length > 0 && (
              <RecentSalesList sales={statsData.recent_transactions.slice(0, 5)} />
            )}
          </div>
        );

      case 'expenses':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Dépenses ce mois"
                value={formatCurrency(statsData.monthly_expenses)}
                subtitle="Total des dépenses"
                icon={<Receipt size={20} />}
                color="red"
              />
              <DetailCard
                title="Dépenses aujourd'hui"
                value={formatCurrency(statsData.daily_expenses)}
                subtitle="Aujourd'hui"
                icon={<Clock size={20} />}
                color="orange"
              />
              <DetailCard
                title="Par catégorie"
                value={statsData.expense_categories.length}
                subtitle="catégories"
                icon={<CreditCard size={20} />}
                color="amber"
              />
              <DetailCard
                title="Moyenne journalière"
                value={formatCurrency(statsData.monthly_expenses / 30)}
                subtitle="sur 30 jours"
                icon={<TrendingUp size={20} />}
                color="slate"
              />
            </div>

            {statsData.expense_categories.length > 0 && (
              <ExpenseCategoriesList categories={statsData.expense_categories} />
            )}
          </div>
        );

      case 'debts':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Dettes ce mois"
                value={formatCurrency(statsData.monthly_debts)}
                subtitle="Nouvelles dettes"
                icon={<Landmark size={20} />}
                color="amber"
              />
              <DetailCard
                title="Dettes totales"
                value={formatCurrency(statsData.total_debts)}
                subtitle="Toutes dettes confondues"
                icon={<Wallet size={20} />}
                color="orange"
              />
              <DetailCard
                title="Dettes impayées"
                value={formatCurrency(statsData.unpaid_debts)}
                subtitle="En souffrance"
                icon={<AlertTriangle size={20} />}
                color="red"
              />
              <DetailCard
                title="Taux de recouvrement"
                value={`${statsData.recovery_rate}%`}
                subtitle="des créances"
                icon={<TrendingUp size={20} />}
                color="emerald"
              />
            </div>

            {statsData.debt_list.length > 0 && (
              <DebtsList debts={statsData.debt_list.slice(0, 5)} />
            )}
          </div>
        );

      case 'purchases':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Achats ce mois"
                value={formatCurrency(statsData.monthly_purchases)}
                subtitle="Réapprovisionnements"
                icon={<Truck size={20} />}
                color="blue"
              />
              <DetailCard
                title="Achats aujourd'hui"
                value={formatCurrency(statsData.daily_purchases)}
                subtitle="Aujourd'hui"
                icon={<Package size={20} />}
                color="cyan"
              />
              <DetailCard
                title="Fournisseurs"
                value={statsData.suppliers_count}
                subtitle="fournisseurs actifs"
                icon={<Building2 size={20} />}
                color="purple"
              />
              <DetailCard
                title="Commandes en cours"
                value={statsData.pending_orders}
                subtitle="à recevoir"
                icon={<Clock size={20} />}
                color="amber"
              />
            </div>

            {statsData.recent_purchases.length > 0 && (
              <RecentPurchasesList purchases={statsData.recent_purchases.slice(0, 5)} />
            )}
          </div>
        );

      case 'alerts': {
        const alertsList = Array.isArray(data)
          ? safeArray<DashboardAlert>(data)
          : isObject(data)
            ? safeArray<DashboardAlert>(data.alerts)
            : [];

        if (!alertsList.length) {
          return <EmptyState icon={<CheckCircle size={32} />} message="Aucune alerte en cours" />;
        }

        return (
          <div className="space-y-3">
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <StatBadge label="Stock critique" count={alertsList.filter((a) => a?.severity === 'high').length} color="red" />
              <StatBadge label="Stock bas" count={alertsList.filter((a) => a?.severity === 'medium').length} color="amber" />
              <StatBadge label="Attention" count={alertsList.filter((a) => a?.severity === 'low').length} color="yellow" />
            </div>

            {alertsList.map((alert, index) => (
              <AlertCard key={alert.id || index} alert={alert} />
            ))}
          </div>
        );
      }

      case 'expiry':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Péremptions (7j)"
                value={statsData.expiring_soon_count}
                subtitle="Produits expirant dans 7 jours"
                icon={<Clock size={20} />}
                color="orange"
              />
              <DetailCard
                title="Produits périmés"
                value={statsData.expired_count}
                subtitle="Produits à retirer"
                icon={<AlertTriangle size={20} />}
                color="red"
              />
            </div>

            {statsData.expiring_products.length > 0 && (
              <ExpiringProductsList products={statsData.expiring_products.slice(0, 5)} />
            )}
          </div>
        );

      case 'stock':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Valeur du stock"
                value={formatCurrency(statsData.total_stock_value)}
                subtitle={`${statsData.total_products} produits`}
                icon={<Package size={20} />}
                color="purple"
              />
              <DetailCard
                title="Produits en stock bas"
                value={statsData.low_stock_count}
                subtitle="À réapprovisionner"
                icon={<AlertTriangle size={20} />}
                color="amber"
              />
              <DetailCard
                title="Produits en rupture"
                value={statsData.out_of_stock_count}
                subtitle="Indisponibles"
                icon={<X size={20} />}
                color="red"
              />
              <DetailCard
                title="Rotation du stock"
                value={`${statsData.stock_turnover}x`}
                subtitle="par mois"
                icon={<TrendingUp size={20} />}
                color="blue"
              />
            </div>

            {statsData.low_stock_products.length > 0 && (
              <LowStockList products={statsData.low_stock_products.slice(0, 5)} />
            )}
          </div>
        );

      case 'transactions':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Transactions aujourd'hui"
                value={statsData.daily_transactions}
                subtitle="Ventes réalisées"
                icon={<CreditCard size={20} />}
                color="blue"
              />
              <DetailCard
                title="Transactions ce mois"
                value={statsData.monthly_transactions}
                subtitle="Depuis début du mois"
                icon={<Calendar size={20} />}
                color="indigo"
              />
              <DetailCard
                title="Montant total"
                value={formatCurrency(statsData.daily_sales)}
                subtitle="Aujourd'hui"
                icon={<DollarSign size={20} />}
                color="emerald"
              />
            </div>

            {statsData.recent_transactions.length > 0 && (
              <RecentTransactionsList transactions={statsData.recent_transactions.slice(0, 5)} />
            )}
          </div>
        );

      case 'profits':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailCard
                title="Bénéfice du jour"
                value={formatCurrency(statsData.daily_profit)}
                subtitle="Estimation actuelle"
                icon={<TrendingUp size={20} />}
                color="emerald"
              />
              <DetailCard
                title="Bénéfice net"
                value={formatCurrency(statsData.net_profit)}
                subtitle="Sur la période"
                icon={<DollarSign size={20} />}
                color="blue"
              />
              <DetailCard
                title="Profit potentiel"
                value={formatCurrency(statsData.potential_profit)}
                subtitle="Selon le stock disponible"
                icon={<Wallet size={20} />}
                color="purple"
              />
              <DetailCard
                title="Tendance des ventes"
                value={`${statsData.sales_trend}%`}
                subtitle="Évolution"
                icon={<TrendingUp size={20} />}
                color="amber"
              />
            </div>
          </div>
        );

      default:
        return <GenericDataDisplay data={data} />;
    }
  }, [data, type]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-slide-up relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl dark:bg-slate-800 sm:rounded-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="flex items-center gap-2 text-lg font-black text-slate-800 dark:text-slate-200">
            {title}
          </h2>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportPDF}
              className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
              title="Exporter en PDF"
            >
              <Printer size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <X size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {renderContent()}
          <div className="mt-6 space-y-1 rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
            <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
            <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            {pharmacyAddress && <p>Adresse : {pharmacyAddress}</p>}
            {pharmacyPhone && <p>Tél : {pharmacyPhone}</p>}
            {pharmacyEmail && <p>Email : {pharmacyEmail}</p>}
          </div>
        </div>
      </div>
    </div>
  );
});

DetailModal.displayName = 'DetailModal';

// ===================================================================
// COMPOSANTS DE CARTES ET LISTES
// ===================================================================

const DetailCard: React.FC<{
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ReactElement;
  color: string;
}> = ({ title, value, subtitle, icon, color }) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
    slate: 'bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-400',
  };

  return (
    <div className="rounded-xl border border-slate-100 p-4 dark:border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{title}</p>
          <p className="mt-1 text-2xl font-black text-slate-800 dark:text-slate-200">{value}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>
        </div>
        <div className={`rounded-xl p-2 ${colorClasses[color] || colorClasses.slate}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const StatBadge: React.FC<{ label: string; count: number; color: string }> = ({ label, count, color }) => {
  const colors: Record<string, string> = {
    red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
    amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
    yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  };

  return (
    <div className={`rounded-xl p-3 text-center ${colors[color] || colors.yellow}`}>
      <p className="text-2xl font-black">{count}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
};

const AlertCard: React.FC<{ alert: DashboardAlert }> = ({ alert }) => {
  const severityColors: Record<string, string> = {
    high: 'bg-red-50 dark:bg-red-900/20 border-l-red-500',
    medium: 'bg-amber-50 dark:bg-amber-900/20 border-l-amber-500',
    low: 'bg-yellow-50 dark:bg-yellow-900/20 border-l-yellow-500',
  };

  const severityClass = severityColors[alert.severity] || severityColors.low;

  return (
    <div className={`rounded-xl border border-slate-100 border-l-4 p-4 dark:border-slate-700 ${severityClass}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold dark:text-slate-200">{alert.product_name}</p>
          <div className="mt-2 flex items-center gap-4 text-xs">
            <span className="text-slate-600 dark:text-slate-400">Stock: {alert.current_stock}</span>
            <span className="text-slate-600 dark:text-slate-400">Seuil: {alert.threshold}</span>
          </div>
        </div>
        <AlertTriangle size={20} className="text-red-500" />
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ icon?: React.ReactNode; message: string }> = ({ icon, message }) => (
  <div className="py-12 text-center">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
      {icon || <CheckCircle size={32} className="text-green-600 dark:text-green-400" />}
    </div>
    <p className="font-medium text-slate-500 dark:text-slate-400">{message}</p>
  </div>
);

const RecentSalesList: React.FC<{ sales: RecentTransaction[] }> = ({ sales }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Dernières ventes</h4>
    <div className="space-y-2">
      {sales.map((sale, idx) => (
        <div key={`${sale.reference}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div>
            <p className="text-sm font-medium dark:text-slate-200">{sale.reference || `Vente #${idx + 1}`}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{safeDateDisplay(sale.date)}</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(sale.amount)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{sale.payment_method || '-'}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ExpenseCategoriesList: React.FC<{ categories: ExpenseCategory[] }> = ({ categories }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Dépenses par catégorie</h4>
    <div className="space-y-2">
      {categories.map((cat, idx) => (
        <div key={`${cat.name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <span className="text-sm font-medium dark:text-slate-200">{cat.name}</span>
          <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(cat.amount)}</span>
        </div>
      ))}
    </div>
  </div>
);

const DebtsList: React.FC<{ debts: DebtItem[] }> = ({ debts }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Dernières dettes</h4>
    <div className="space-y-2">
      {debts.map((debt, idx) => (
        <div key={`${debt.customer_name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div>
            <p className="text-sm font-medium dark:text-slate-200">{debt.customer_name || 'Client'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Échéance: {safeDateOnlyDisplay(debt.due_date)}
            </p>
          </div>
          <p className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(debt.amount)}</p>
        </div>
      ))}
    </div>
  </div>
);

const RecentPurchasesList: React.FC<{ purchases: RecentPurchase[] }> = ({ purchases }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Derniers achats</h4>
    <div className="space-y-2">
      {purchases.map((purchase, idx) => (
        <div key={`${purchase.supplier_name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div>
            <p className="text-sm font-medium dark:text-slate-200">{purchase.supplier_name || 'Fournisseur'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{safeDateOnlyDisplay(purchase.date)}</p>
          </div>
          <p className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(purchase.amount)}</p>
        </div>
      ))}
    </div>
  </div>
);

const ExpiringProductsList: React.FC<{ products: ExpiringProduct[] }> = ({ products }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Produits expirant bientôt</h4>
    <div className="space-y-2">
      {products.map((product, idx) => (
        <div key={`${product.name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div>
            <p className="text-sm font-medium dark:text-slate-200">{product.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Expire le: {safeDateOnlyDisplay(product.expiry_date)}
            </p>
          </div>
          <p className="font-bold text-orange-600 dark:text-orange-400">{product.quantity} unités</p>
        </div>
      ))}
    </div>
  </div>
);

const LowStockList: React.FC<{ products: LowStockProduct[] }> = ({ products }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Produits en stock bas</h4>
    <div className="space-y-2">
      {products.map((product, idx) => (
        <div key={`${product.name}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div>
            <p className="text-sm font-medium dark:text-slate-200">{product.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Seuil: {product.threshold}</p>
          </div>
          <p className="font-bold text-amber-600 dark:text-amber-400">Stock: {product.current_stock}</p>
        </div>
      ))}
    </div>
  </div>
);

const RecentTransactionsList: React.FC<{ transactions: RecentTransaction[] }> = ({ transactions }) => (
  <div>
    <h4 className="mb-3 text-sm font-bold dark:text-slate-300">Dernières transactions</h4>
    <div className="space-y-2">
      {transactions.map((tx, idx) => (
        <div key={`${tx.reference}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
          <div>
            <p className="text-sm font-medium dark:text-slate-200">{tx.reference || `Transaction #${idx + 1}`}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{tx.payment_method || '-'}</p>
          </div>
          <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(tx.amount)}</p>
        </div>
      ))}
    </div>
  </div>
);

const GenericDataDisplay: React.FC<{ data: unknown }> = ({ data }) => {
  if (!isObject(data)) return null;

  const entries = Object.entries(data).filter(([, value]) => {
    return isRenderablePrimitive(value) || value instanceof Date;
  });

  if (!entries.length) {
    return <div className="py-8 text-center text-slate-500 dark:text-slate-400">Aucune donnée exploitable à afficher</div>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => {
        const displayValue = typeof value === 'number' ? formatCurrency(value) : toDisplayText(value);

        return (
          <div key={key} className="flex justify-between gap-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
            <span className="wrap-break-word text-sm font-medium dark:text-slate-300">{key}</span>
            <span className="wrap-break-word text-right font-bold dark:text-slate-200">{displayValue}</span>
          </div>
        );
      })}
    </div>
  );
};

// ===================================================================
// COMPOSANT PRINCIPAL DU DASHBOARD
// ===================================================================

const DashboardContent: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isSuperAdmin } = useAuthStore();

  const {
    id: activePharmacyId,
    name: pharmacyName,
    address: pharmacyAddress,
    phone: pharmacyPhone,
    email: pharmacyEmail,
    serviceStatus,
    isLoading: isLoadingPharmacy,
    error: pharmacyError,
    refreshActivePharmacy,
  } = useActivePharmacy();

  const [selectedModal, setSelectedModal] = useState<{
    type: DetailModalType;
    title: string;
    data: unknown;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);

  const timezoneHook = useTimezone();
  const browserTimezone = timezoneHook.timezone;

  // 🔥 CORRECTION : Utiliser l'UUID directement, ne pas convertir en entier
  const pharmacyId = useMemo(() => {
    if (!activePharmacyId) return null;
    // Retourner l'UUID tel quel - le backend accepte les UUID
    return activePharmacyId;
  }, [activePharmacyId]);

  const isAdmin = useMemo(() => {
    if (!isObject(user)) return false;
    const role = user.role || user.user_role;
    return role === 'admin' || role === 'super_admin';
  }, [user]);

  const hasCriticalAlerts = useMemo(() => {
    return alerts.some(alert => alert.severity === 'high' && !alert.is_resolved);
  }, [alerts]);

  const pendingTransfersCount = useMemo(() => {
    if (!isObject(stats)) return 0;
    return safeNumber(stats.pending_transfers_count);
  }, [stats]);

  const extendedStats = useMemo(() => normalizeStats(stats), [stats]);
  const safeAlerts = useMemo(() => safeArray<DashboardAlert>(alerts), [alerts]);

  const fetchDashboardData = useCallback(async (showBackgroundLoading = false) => {
    // 🔥 Vérification : pharmacyId peut être un UUID (string)
    if (!pharmacyId) {
      console.warn('fetchDashboardData: pharmacyId invalide (null)', pharmacyId);
      setIsLoading(false);
      setIsFetching(false);
      return;
    }

    console.log('📊 fetchDashboardData: pharmacyId =', pharmacyId, 'type:', typeof pharmacyId);

    if (showBackgroundLoading) {
      setIsFetching(true);
    } else {
      setIsLoading(true);
    }

    try {
      // 🔥 Les filtres acceptent maintenant des string (UUID)
      const filters: DashboardFilters = {
        pharmacy_id: pharmacyId as any, // Le backend accepte les UUID
      };

      console.log('📊 Appel API dashboard/stats avec pharmacy_id:', pharmacyId);

      const [statsData, alertsData] = await Promise.all([
        dashboardService.getDashboardStats(filters),
        dashboardService.getAlerts({ ...filters, limit: 50, include_resolved: false })
      ]);

      console.log('📊 Données dashboard reçues:', statsData ? 'OK' : 'vide');
      setStats(statsData);
      setAlerts(alertsData.alerts || []);
      setError(null);
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [pharmacyId]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (typeof isSuperAdmin === 'function' && isSuperAdmin()) {
      navigate('/super-admin', { replace: true });
    }
  }, [isAuthenticated, isSuperAdmin, navigate]);

  useEffect(() => {
    // 🔥 Vérifier si pharmacyId est valide (string non vide)
    if (!pharmacyId) {
      console.log('Dashboard: En attente d\'un pharmacyId valide...');
      setIsLoading(false);
      return;
    }

    console.log('Dashboard: pharmacyId valide, chargement des données:', pharmacyId);
    fetchDashboardData(false);
  }, [pharmacyId, fetchDashboardData]);

  useEffect(() => {
    if (!pharmacyId) return;

    const interval = window.setInterval(async () => {
      try {
        await fetchDashboardData(true);
      } catch (err) {
        console.error('Erreur actualisation silencieuse dashboard:', err);
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [pharmacyId, fetchDashboardData]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshActivePharmacy();
      await fetchDashboardData(false);
    } catch (err) {
      console.error('Erreur actualisation dashboard:', err);
    } finally {
      window.setTimeout(() => setIsRefreshing(false), 400);
    }
  }, [fetchDashboardData, refreshActivePharmacy]);

  const handleExportPDF = useCallback((type: string, data: unknown): void => {
    if (!data) return;

    const pdfData: PDFData = {
      type,
      data,
      userName: isObject(user) && typeof user.nom_complet === 'string' ? user.nom_complet : 'Non spécifié',
      pharmacyName: pharmacyName || 'Pharmacie non spécifiée',
      pharmacyAddress: pharmacyAddress || undefined,
      pharmacyPhone: pharmacyPhone || undefined,
      pharmacyEmail: pharmacyEmail || undefined,
    };

    try {
      generateDashboardPDF(pdfData);
    } catch (err) {
      console.error('Erreur lors de l’export PDF:', err);
      alert('Une erreur est survenue lors de la génération du PDF');
    }
  }, [user, pharmacyName, pharmacyAddress, pharmacyPhone, pharmacyEmail]);

  const dashboardCards = useMemo((): DashboardCard[] => {
    const dailyProfit = extendedStats.daily_profit || extendedStats.daily_sales * 0.3;

    return [
      {
        id: 'daily-sales',
        title: "Ventes aujourd'hui",
        value: formatCurrency(extendedStats.daily_sales),
        subtitle: `${extendedStats.daily_transactions} transaction(s)`,
        icon: <ShoppingBag size={20} />,
        iconBgColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
        onClick: () => setSelectedModal({ type: 'sales', title: 'Détail des ventes', data: extendedStats }),
      },
      {
        id: 'monthly-expenses',
        title: 'Dépenses ce mois',
        value: formatCurrency(extendedStats.monthly_expenses),
        subtitle: 'Total des dépenses',
        icon: <Receipt size={20} />,
        iconBgColor: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        onClick: () => setSelectedModal({ type: 'expenses', title: 'Détail des dépenses', data: extendedStats }),
      },
      {
        id: 'low-stock',
        title: 'Alertes stock',
        value: extendedStats.low_stock_count,
        subtitle: 'Produits en stock bas',
        icon: <AlertTriangle size={20} />,
        iconBgColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        onClick: () => setSelectedModal({ type: 'alerts', title: 'Alertes de stock', data: { alerts: safeAlerts } }),
      },
      {
        id: 'monthly-sales',
        title: 'Ventes ce mois',
        value: formatCurrency(extendedStats.monthly_sales),
        subtitle: `Du 01 au ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
        icon: <Calendar size={20} />,
        iconBgColor: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400',
        onClick: () => setSelectedModal({ type: 'sales', title: 'Ventes mensuelles', data: extendedStats }),
      },
      {
        id: 'debts',
        title: 'Dettes ce mois',
        value: formatCurrency(extendedStats.monthly_debts),
        subtitle: 'Nouvelles dettes',
        icon: <Landmark size={20} />,
        iconBgColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
        onClick: () => setSelectedModal({ type: 'debts', title: 'Détail des dettes', data: extendedStats }),
      },
      {
        id: 'expiry',
        title: 'Péremptions (7j)',
        value: extendedStats.expiring_soon_count,
        subtitle: 'Produits expirant dans 7 jours',
        icon: <Clock size={20} />,
        iconBgColor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
        onClick: () => setSelectedModal({ type: 'expiry', title: 'Produits à péremption', data: extendedStats }),
      },
      {
        id: 'daily-profit',
        title: "Bénéfice aujourd'hui",
        value: formatCurrency(dailyProfit),
        subtitle: 'Marge brute',
        icon: <TrendingUp size={20} />,
        iconBgColor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
        onClick: () => setSelectedModal({ type: 'profits', title: 'Bénéfice du jour', data: extendedStats }),
      },
      {
        id: 'purchases',
        title: 'Achats ce mois',
        value: formatCurrency(extendedStats.monthly_purchases),
        subtitle: 'Réapprovisionnements',
        icon: <Truck size={20} />,
        iconBgColor: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
        onClick: () => setSelectedModal({ type: 'purchases', title: 'Détail des achats', data: extendedStats }),
      },
      {
        id: 'expired',
        title: 'Produits périmés',
        value: extendedStats.expired_count,
        subtitle: 'Produits à retirer',
        icon: <X size={20} />,
        iconBgColor: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
        onClick: () => setSelectedModal({ type: 'expiry', title: 'Produits périmés', data: extendedStats }),
      },
    ];
  }, [extendedStats, safeAlerts]);

  const userFullName =
    isObject(user) && typeof user.nom_complet === 'string'
      ? user.nom_complet
      : 'Utilisateur';

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 pb-10 transition-colors sm:px-6 lg:px-8">
      <ExpiryWarningBanner />

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-800 dark:text-slate-200 sm:text-3xl">
            <LayoutDashboard className="text-blue-600 dark:text-blue-400" size={28} />
            Tableau de Bord
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 size={16} className="text-blue-500 dark:text-blue-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {pharmacyName || 'Pharmacie non spécifiée'}
              </p>
            </div>

            {pharmacyAddress && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <MapPin size={12} />
                <span className="max-w-48 truncate">{pharmacyAddress}</span>
              </div>
            )}

            {pharmacyPhone && (
              <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                <Phone size={12} />
                <span>{pharmacyPhone}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <p className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
              <span>👤 {userFullName}</span>
              {isAdmin && (
                <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                  Admin
                </span>
              )}
            </p>

            {serviceStatus?.in_service && (
              <div className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900 dark:text-green-300">
                <CheckCircle size={12} />
                <span className="text-[10px] font-bold">En service</span>
              </div>
            )}

            <div className="flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              <span className="text-[10px]">Fuseau: {browserTimezone}</span>
            </div>

            {(isLoadingPharmacy || isLoading) && (
              <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <RefreshCw size={10} className="animate-spin" />
                <span className="text-[10px] font-bold">Chargement...</span>
              </div>
            )}

            {isFetching && (
              <div className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                <RefreshCw size={10} className="animate-spin" />
                <span className="text-[10px] font-bold">Actualisation</span>
              </div>
            )}

            {pharmacyError && (
              <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                <span className="text-[10px] font-bold">{getErrorMessage(pharmacyError, 'Erreur pharmacie')}</span>
              </div>
            )}

            {error && !pharmacyError && (
              <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 dark:bg-red-900 dark:text-red-300">
                <span className="text-[10px] font-bold">
                  {getErrorMessage(error, 'Erreur de synchronisation')}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex w-full items-center gap-3 sm:w-auto">
          {pendingTransfersCount > 0 && (
            <Link
              to="/transfers"
              className="flex items-center gap-2 rounded-xl bg-purple-100 px-4 py-2 text-sm font-bold text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800"
            >
              <ArrowRight size={16} className="rotate-90" />
              {pendingTransfersCount} transfert(s)
            </Link>
          )}

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 sm:w-auto"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {hasCriticalAlerts && safeAlerts.length > 0 && (
        <div className="rounded-2xl bg-linear-to-r from-amber-500 to-orange-600 p-1 shadow-xl">
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl bg-white/10 p-4 backdrop-blur-md sm:flex-row sm:p-5">
            <div className="flex w-full items-center gap-4 sm:w-auto">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white sm:h-12 sm:w-12">
                <AlertTriangle size={20} />
              </div>
              <div className="text-white">
                <p className="text-xs font-black uppercase tracking-wider opacity-90">Alertes Stock</p>
                <p className="text-sm font-bold sm:text-base">
                  {safeAlerts.length} alerte(s) nécessitent votre attention
                </p>
              </div>
            </div>

            <Link
              to="/inventory/alerts"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-xs font-black text-amber-700 shadow-lg transition-all hover:bg-amber-50 sm:w-auto"
            >
              VOIR LES ALERTES <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboardCards.map((card) => (
          <div
            key={card.id}
            onClick={card.onClick}
            className="cursor-pointer rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:scale-[1.02] hover:shadow-md active:scale-[0.98] dark:border-slate-700 dark:bg-slate-800"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                card.onClick();
              }
            }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                <p className="mt-1 text-2xl font-black text-slate-800 dark:text-slate-200">{card.value}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{card.subtitle}</p>
              </div>
              <div className={`rounded-xl p-3 ${card.iconBgColor}`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {extendedStats.recent_transactions.length > 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-800 dark:text-slate-200">
              <Clock size={16} className="text-blue-500" />
              Dernières ventes
            </h3>
            <button
              onClick={() => setSelectedModal({ type: 'transactions', title: 'Historique des ventes', data: extendedStats })}
              className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              Voir tout <ArrowRight size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {extendedStats.recent_transactions.slice(0, 5).map((tx, idx) => (
              <div key={`${tx.reference}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
                <div>
                  <p className="text-sm font-medium dark:text-slate-200">{tx.reference || `Transaction #${idx + 1}`}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{safeDateDisplay(tx.date)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(tx.amount)}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tx.payment_method || 'Auto'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedModal && (
        <DetailModal
          isOpen={true}
          onClose={() => setSelectedModal(null)}
          title={selectedModal.title}
          data={selectedModal.data}
          type={selectedModal.type}
          onExportPDF={() => handleExportPDF(selectedModal.title, selectedModal.data)}
          userName={userFullName}
          pharmacyName={pharmacyName || undefined}
          pharmacyAddress={pharmacyAddress || undefined}
          pharmacyPhone={pharmacyPhone || undefined}
          pharmacyEmail={pharmacyEmail || undefined}
        />
      )}
    </div>
  );
};

export default withWritePermission(DashboardContent, {
  showReadOnlyMessage: true,
  redirectToSubscription: false,
});