// ============================================================================
// SuperAdminDashboard.tsx - Tableau de bord super administrateur MEDIGEST
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, CreditCard, Activity,
  Search, Plus, RefreshCw,
  TrendingUp, Shield, Settings, Eye,
  Loader2, Globe, Server,
  Mail, MapPin, Phone,
  LayoutGrid, List,
  ArrowUpRight, ArrowDownRight, Bell, X,
  FileText, Filter,
  ChevronLeft, ChevronRight,
  DollarSign, BarChart,
  HardDrive, Database, Wifi,
  RotateCcw, Key,
  AlertCircle, LogOut
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// ============================================================================
// IMPORTS INTERNES
// ============================================================================

import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

type PlanType = 'starter' | 'professional' | 'enterprise';
type TenantStatus = 'active' | 'trial' | 'suspended' | 'inactive' | 'deleted';
type UserRole = 'super_admin' | 'admin' | 'pharmacien' | 'caissier' | 'comptable';
type NotificationPriority = 'low' | 'medium' | 'high';
type NotificationType = 'info' | 'warning' | 'error' | 'success';
type SystemHealthStatus = 'healthy' | 'degraded' | 'unhealthy';
type ViewMode = 'grid' | 'list';
type DateRange = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface ApiError {
  response?: {
    status: number;
    data?: {
      detail?: string;
    };
  };
  message: string;
}

interface Tenant {
  id: string;
  tenant_code: string;
  nom_pharmacie: string;
  nom_commercial?: string;
  email_admin: string;
  telephone_principal: string;
  ville: string;
  pays: string;
  adresse?: string;
  status: TenantStatus;
  current_plan: PlanType;
  max_users: number;
  max_pharmacies: number;
  max_products: number;
  created_at: string;
  updated_at: string;
  trial_start_date?: string;
  trial_end_date?: string;
  activated_at?: string;
  deleted_at?: string;
  config?: Record<string, unknown>;
  type_pharmacie?: string;
  user_count?: number;
  pharmacy_count?: number;
  trial_days_remaining?: number;
}

interface User {
  id: string;
  email: string;
  nom_complet: string;
  role: UserRole;
  actif: boolean;
  telephone?: string;
  tenant_id?: string;
  tenant?: {
    nom_pharmacie: string;
  };
  last_login?: string;
  created_at: string;
}

interface DashboardOverview {
  platform: {
    total_tenants: number;
    active_tenants: number;
    trial_tenants: number;
    suspended_tenants: number;
    total_users: number;
    super_admins: number;
    admin_users: number;
  };
  growth: {
    new_today: number;
    new_week: number;
    new_month: number;
    growth_rate: number;
  };
  distribution: {
    by_plan: Record<PlanType, number>;
    by_status: Record<TenantStatus, number>;
  };
  recent_activity: {
    tenants: Array<{
      id: string;
      nom_pharmacie: string;
      email_admin: string;
      status: TenantStatus;
      plan: PlanType;
      created_at: string;
      trial_end_date?: string;
    }>;
    audit_logs: Array<{
      id: string;
      action: string;
      description: string;
      user_id?: string;
      tenant_id?: string;
      created_at: string;
    }>;
  };
  timestamp: string;
}

interface SystemHealth {
  status: SystemHealthStatus;
  timestamp: string;
  checks: {
    database: { status: string; details: Record<string, unknown> };
    services: { status: string; details: Record<string, unknown> };
    performance: { status: string; details: Record<string, unknown> };
  };
  recommendations?: string[];
}

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  created_at: string;
}

interface SystemSettings {
  general: {
    platform_name: string;
    support_email: string;
    default_language: string;
    timezone: string;
  };
  registration: {
    allow_new_registrations: boolean;
    default_trial_days: number;
    default_plan: PlanType;
  };
  security: {
    max_login_attempts: number;
    account_lock_duration_minutes: number;
  };
  maintenance: {
    mode: boolean;
    message: string;
  };
}

interface AuditLog {
  id: string;
  action: string;
  action_level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  description: string;
  user_id?: string;
  tenant_id?: string;
  ip_address?: string;
  created_at: string;
}

interface SubscriptionStats {
  summary: {
    total_tenants: number;
    trial_tenants: number;
    active_paid_tenants: number;
    conversion_rate: string;
  };
  distribution: Record<PlanType, number>;
  revenue: {
    monthly: number;
    yearly: number;
    average_per_tenant: number;
  };
  plans_config: Record<PlanType, { price_monthly: number; currency: string }>;
}

interface PaginatedResponse<T> {
  data?: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================================================
// SERVICE API AVEC GESTION D'ERREURS AMÉLIORÉE
// ============================================================================

const handleApiError = (error: unknown, defaultMessage: string): never => {
  console.error('❌ API Error:', error);
  
  const apiError = error as ApiError;
  
  if (apiError.response?.status === 401) {
    toast.error('Session expirée. Veuillez vous reconnecter.');
    useAuthStore.getState().logout();
    window.location.href = '/login';
    throw new Error('Non authentifié');
  }
  
  if (apiError.response?.status === 403) {
    toast.error('Accès non autorisé.');
    throw new Error('Accès refusé');
  }
  
  const message = apiError.response?.data?.detail || apiError.message || defaultMessage;
  toast.error(message);
  throw new Error(message);
};

const superAdminApi = {
  // Dashboard
  getDashboardOverview: async (): Promise<DashboardOverview> => {
    try {
      console.log('📡 Chargement du dashboard overview...');
      const { data } = await api.get<DashboardOverview>('/super-admin/dashboard/overview');
      console.log('✅ Dashboard overview chargé:', data);
      return data;
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement du dashboard');
    }
  },

  getDashboardMetrics: async (period: DateRange = 'month'): Promise<any> => {
    try {
      const { data } = await api.get(`/super-admin/dashboard/metrics?period=${period}`);
      return data;
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement des métriques');
    }
  },

  // Tenants
  getTenants: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status_filter?: TenantStatus;
    plan_filter?: PlanType;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<PaginatedResponse<Tenant>> => {
    try {
      console.log('📡 Chargement des tenants avec params:', params);
      const { data } = await api.get<{ tenants: Tenant[]; pagination: any }>(
        '/super-admin/tenants',
        { params }
      );
      
      return {
        data: data.tenants,
        pagination: data.pagination || {
          total: data.tenants.length,
          page: params.page || 1,
          limit: params.limit || 20,
          pages: Math.ceil(data.tenants.length / (params.limit || 20)),
          has_next: false,
          has_prev: false
        }
      };
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement des tenants');
    }
  },

  getTenantById: async (id: string): Promise<Tenant> => {
    try {
      const { data } = await api.get<{ tenant: Tenant }>(`/super-admin/tenants/${id}`);
      return data.tenant;
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement du tenant');
    }
  },

  createTenant: async (data: Partial<Tenant>): Promise<Tenant> => {
    try {
      console.log('📡 Création d\'un nouveau tenant:', data);
      const { data: response } = await api.post<Tenant>('/super-admin/tenants', data);
      toast.success('✅ Tenant créé avec succès');
      return response;
    } catch (error) {
      return handleApiError(error, 'Erreur lors de la création du tenant');
    }
  },

  performTenantAction: async (id: string, action: string, value?: any): Promise<void> => {
    try {
      const params = new URLSearchParams({ action });
      if (value) params.append('value', value.toString());
      
      await api.post(`/super-admin/tenants/${id}/actions?${params}`);
      toast.success(`✅ Action "${action}" effectuée avec succès`);
    } catch (error) {
      return handleApiError(error, `Erreur lors de l'action ${action}`);
    }
  },

  bulkTenantActions: async (tenantIds: string[], action: string, value?: any): Promise<void> => {
    try {
      await api.post('/super-admin/tenants/bulk-actions', {
        tenant_ids: tenantIds,
        action,
        value
      });
      toast.success(`✅ Action en masse "${action}" effectuée sur ${tenantIds.length} tenant(s)`);
    } catch (error) {
      return handleApiError(error, `Erreur lors de l'action en masse ${action}`);
    }
  },

  // Utilisateurs
  getAllUsers: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    role_filter?: UserRole;
    tenant_id?: string;
    actif?: boolean;
  }): Promise<PaginatedResponse<User>> => {
    try {
      const { data } = await api.get<{ users: User[]; pagination: any }>(
        '/super-admin/users',
        { params }
      );
      
      return {
        data: data.users,
        pagination: data.pagination || {
          total: data.users.length,
          page: params.page || 1,
          limit: params.limit || 20,
          pages: Math.ceil(data.users.length / (params.limit || 20)),
          has_next: false,
          has_prev: false
        }
      };
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement des utilisateurs');
    }
  },

  // Système
  getSystemHealth: async (): Promise<SystemHealth> => {
    try {
      const { data } = await api.get<SystemHealth>('/super-admin/system/health');
      return data;
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement de la santé système');
    }
  },

  getSystemNotifications: async (): Promise<{
    notifications: Notification[];
    unread_count: number;
  }> => {
    try {
      const { data } = await api.get('/super-admin/notifications');
      return data;
    } catch (error) {
      console.error('Erreur notifications (non critique):', error);
      return { notifications: [], unread_count: 0 };
    }
  },

  getSystemLogs: async (params: {
    page?: number;
    limit?: number;
    level?: string;
    tenant_id?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<AuditLog>> => {
    try {
      const { data } = await api.get<{ logs: AuditLog[]; pagination: any }>(
        '/super-admin/system/logs',
        { params }
      );
      
      return {
        data: data.logs,
        pagination: data.pagination
      };
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement des logs');
    }
  },

  getSystemSettings: async (): Promise<{ settings: SystemSettings }> => {
    try {
      const { data } = await api.get('/super-admin/system/settings');
      return data;
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement des paramètres');
    }
  },

  // Abonnements
  getSubscriptionStatistics: async (): Promise<SubscriptionStats> => {
    try {
      const { data } = await api.get<SubscriptionStats>('/super-admin/subscriptions/statistics');
      return data;
    } catch (error) {
      return handleApiError(error, 'Erreur lors du chargement des statistiques');
    }
  }
};

// ============================================================================
// HOOKS PERSONNALISÉS
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      setStoredValue(value);
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('❌ Erreur localStorage:', error);
    }
  };

  return [storedValue, setValue];
}

// ============================================================================
// COMPOSANTS DE PRÉSENTATION
// ============================================================================

const StatusBadge: React.FC<{ status: TenantStatus }> = ({ status }) => {
  const config: Record<TenantStatus, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Actif' },
    trial: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Essai' },
    suspended: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Suspendu' },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactif' },
    deleted: { bg: 'bg-red-100', text: 'text-red-700', label: 'Supprimé' }
  };

  const { bg, text, label } = config[status] || config.inactive;

  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

const PlanBadge: React.FC<{ plan: PlanType }> = ({ plan }) => {
  const config: Record<PlanType, { bg: string; text: string; label: string }> = {
    starter: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Starter' },
    professional: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pro' },
    enterprise: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Enterprise' }
  };

  const { bg, text, label } = config[plan];

  return (
    <span className={`px-2 py-1 rounded-lg text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
};

interface StatCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  trend?: {
    value: number;
    label: string;
    direction?: 'up' | 'down';
  };
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  trend
}) => {
  const colors: Record<string, { iconBg: string }> = {
    blue: { iconBg: 'bg-blue-100' },
    green: { iconBg: 'bg-green-100' },
    orange: { iconBg: 'bg-orange-100' },
    purple: { iconBg: 'bg-purple-100' },
    red: { iconBg: 'bg-red-100' }
  };

  const { iconBg } = colors[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">
              {value.toLocaleString()}
            </span>
            {subtitle && (
              <span className="text-xs text-gray-400">{subtitle}</span>
            )}
          </div>
        </div>
        <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          {trend.direction === 'up' ? (
            <>
              <ArrowUpRight size={12} className="text-green-500" />
              <span className="text-green-600 font-medium">+{trend.value}%</span>
            </>
          ) : trend.direction === 'down' ? (
            <>
              <ArrowDownRight size={12} className="text-red-500" />
              <span className="text-red-600 font-medium">{trend.value}%</span>
            </>
          ) : (
            <span className={`font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>
          )}
          <span className="text-gray-400 ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

interface TenantGridCardProps {
  tenant: Tenant;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
}

const TenantGridCard: React.FC<TenantGridCardProps> = ({
  tenant,
  isSelected,
  onSelect,
  onClick
}) => {
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <div
      className={`bg-white rounded-2xl border p-5 cursor-pointer transition-all ${
        isSelected 
          ? 'border-red-500 ring-2 ring-red-200' 
          : 'border-gray-100 hover:border-red-200 hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-linear-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <Building2 className="text-white" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800">{tenant.nom_pharmacie}</h3>
            <p className="text-xs text-gray-400">{tenant.tenant_code}</p>
          </div>
        </div>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleCheckboxChange}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-gray-300 text-red-500 focus:ring-red-500"
        />
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-gray-600">
          <Mail size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">{tenant.email_admin}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <Phone size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">{tenant.telephone_principal}</span>
        </div>
        <div className="flex items-center gap-2 text-gray-600">
          <MapPin size={14} className="text-gray-400 shrink-0" />
          <span className="truncate">{tenant.ville}, {tenant.pays}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
        <div className="flex gap-2">
          <StatusBadge status={tenant.status} />
          <PlanBadge plan={tenant.current_plan} />
        </div>
        <div className="text-xs text-gray-400">
          {tenant.user_count || 0} utilisateur{tenant.user_count !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange
}) => {
  const start = (currentPage - 1) * itemsPerPage + 1;
  const end = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between mt-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          Affichage de {start} à {end} sur {totalItems} résultats
        </span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="ml-2 px-2 py-1 border border-gray-200 rounded-lg text-sm"
        >
          <option value={10}>10 / page</option>
          <option value={20}>20 / page</option>
          <option value={50}>50 / page</option>
          <option value={100}>100 / page</option>
        </select>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} />
        </button>
        
        <span className="px-3 py-1 bg-red-500 text-white rounded-lg text-sm">
          {currentPage}
        </span>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// COMPOSANTS D'ONGLETS
// ============================================================================

interface OverviewTabProps {
  overview?: DashboardOverview;
  health?: SystemHealth;
  notifications?: Notification[];
  isLoading: boolean;
  onRefresh: () => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  overview,
  health,
  notifications,
  isLoading,
  onRefresh
}) => {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-red-500 mx-auto mb-4" size={48} />
          <p className="text-gray-400">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-400">Aucune donnée disponible</p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
          >
            Rafraîchir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tenants actifs"
          value={overview.platform.active_tenants}
          subtitle={`/${overview.platform.total_tenants} total`}
          icon={<Building2 size={20} />}
          color="blue"
          trend={overview.growth.growth_rate ? { 
            value: overview.growth.growth_rate, 
            label: 'vs mois dernier',
            direction: overview.growth.growth_rate > 0 ? 'up' : 'down'
          } : undefined}
        />
        
        <StatCard
          title="En période d'essai"
          value={overview.platform.trial_tenants}
          subtitle={`${overview.platform.trial_tenants} en trial`}
          icon={<Activity size={20} />}
          color="orange"
        />
        
        <StatCard
          title="Utilisateurs"
          value={overview.platform.total_users}
          subtitle={`dont ${overview.platform.super_admins} super-admin`}
          icon={<Users size={20} />}
          color="green"
        />
        
        <StatCard
          title="Nouveaux (30j)"
          value={overview.growth.new_month}
          subtitle={`+${overview.growth.new_today} aujourd'hui`}
          icon={<TrendingUp size={20} />}
          color="purple"
        />
      </div>

      {/* Grille secondaire */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution par plan */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart size={16} className="text-red-500" />
            Distribution par plan
          </h3>
          
          <div className="space-y-3">
            {Object.entries(overview.distribution.by_plan).map(([plan, count]) => (
              <div key={plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-gray-600">{plan}</span>
                  <span className="font-bold text-gray-800">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full"
                    style={{ 
                      width: `${(count / overview.platform.total_tenants) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Alertes système */}
          {notifications && notifications.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
                Alertes système
              </h4>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`p-2 rounded-lg text-xs ${
                      notif.priority === 'high' 
                        ? 'bg-red-50 text-red-700 border border-red-100' 
                        : notif.priority === 'medium'
                          ? 'bg-orange-50 text-orange-700 border border-orange-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}
                  >
                    <div className="font-medium">{notif.title}</div>
                    <div className="text-xs opacity-80 mt-1">{notif.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Santé système */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Server size={16} className="text-red-500" />
              État du système
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full ${
              health?.status === 'healthy' 
                ? 'bg-green-100 text-green-700' 
                : health?.status === 'degraded'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}>
              {health?.status === 'healthy' 
                ? 'Opérationnel' 
                : health?.status === 'degraded'
                  ? 'Dégradé'
                  : 'Non opérationnel'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Database size={12} /> Base de données
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  health?.checks?.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="font-medium text-sm">
                  {health?.checks?.database?.status === 'healthy' ? 'Connectée' : 'Problème'}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Wifi size={12} /> Services
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  health?.checks?.services?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="font-medium text-sm">
                  {health?.checks?.services?.status === 'healthy' ? 'OK' : 'Dégradé'}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <HardDrive size={12} /> Performance
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  health?.checks?.performance?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="font-medium text-sm">
                  {health?.checks?.performance?.status === 'healthy' ? 'Normale' : 'À surveiller'}
                </span>
              </div>
            </div>
          </div>

          {/* Métriques de croissance */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
              Croissance (30 derniers jours)
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold text-gray-800">
                  {overview.growth.new_month}
                </div>
                <div className="text-xs text-gray-500">Nouveaux tenants</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">
                  {overview.growth.growth_rate}%
                </div>
                <div className="text-xs text-gray-500">Taux de croissance</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800">
                  {overview.growth.new_today}
                </div>
                <div className="text-xs text-gray-500">Aujourd'hui</div>
              </div>
            </div>
          </div>

          {/* Recommandations */}
          {health?.recommendations && health.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
                Recommandations
              </h4>
              <ul className="space-y-1">
                {health.recommendations.map((rec, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                    <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <Activity size={16} className="text-red-500" />
            Activité récente
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {overview.recent_activity.audit_logs?.slice(0, 5).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {log.description || '-'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                  </td>
                </tr>
              ))}
              
              {(!overview.recent_activity.audit_logs?.length) && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                    Aucune activité récente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface TenantsTabProps {
  tenants: Tenant[];
  pagination?: PaginatedResponse<Tenant>['pagination'];
  isLoading: boolean;
  error: Error | null;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filters: {
    status_filter: TenantStatus | '';
    plan_filter: PlanType | '';
  };
  onFilterChange: (key: string, value: string) => void;
  selectedTenants: string[];
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onTenantClick: (tenant: Tenant) => void;
  onBulkAction: (action: string, value?: any) => void;
  onCreateTenant: () => void;
  onRefresh: () => void;
  onSelectTenant: (tenantId: string) => void;
  onSelectAll: (tenants: Tenant[]) => void;
  onClearSelection: () => void;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (limit: number) => void;
}

const TenantsTab: React.FC<TenantsTabProps> = ({
  tenants,
  pagination,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  selectedTenants,
  viewMode,
  onViewModeChange,
  onTenantClick,
  onBulkAction,
  onCreateTenant,
  onRefresh,
  onSelectTenant,
  onSelectAll,
  onClearSelection,
  currentPage,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange
}) => {
  const [showFilters, setShowFilters] = useState(false);

  const hasActiveFilters = filters.status_filter !== '' || filters.plan_filter !== '';

  const handleClearFilters = () => {
    onFilterChange('status_filter', '');
    onFilterChange('plan_filter', '');
  };

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-lg font-medium text-gray-700 mb-2">
          Erreur de chargement
        </h3>
        <p className="text-gray-400 mb-4">{error.message}</p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre d'actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {/* Recherche */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Rechercher un tenant..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 w-64"
              />
            </div>

            {/* Filtres */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-2 ${
                hasActiveFilters ? 'bg-red-50 border-red-200 text-red-600' : ''
              }`}
            >
              <Filter size={18} />
              {hasActiveFilters && (
                <span className="w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>

            {showFilters && (
              <div className="flex items-center gap-2">
                <select
                  value={filters.status_filter}
                  onChange={(e) => onFilterChange('status_filter', e.target.value as TenantStatus)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Tous les statuts</option>
                  <option value="active">Actif</option>
                  <option value="trial">Essai</option>
                  <option value="suspended">Suspendu</option>
                  <option value="inactive">Inactif</option>
                </select>

                <select
                  value={filters.plan_filter}
                  onChange={(e) => onFilterChange('plan_filter', e.target.value as PlanType)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20"
                >
                  <option value="">Tous les plans</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>

                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="p-2 text-gray-400 hover:text-gray-600"
                    title="Effacer les filtres"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Sélecteur de vue */}
            <div className="flex border border-gray-200 rounded-xl overflow-hidden">
              <button
                onClick={() => onViewModeChange('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Vue en grille"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => onViewModeChange('list')}
                className={`p-2 transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-red-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
                title="Vue en liste"
              >
                <List size={18} />
              </button>
            </div>

            {/* Actions principales */}
            <button
              onClick={onCreateTenant}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors shadow-sm shadow-red-200"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">Nouveau tenant</span>
            </button>

            <button
              onClick={onRefresh}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              title="Rafraîchir"
            >
              <RefreshCw size={18} className="text-gray-600" />
            </button>
          </div>
        </div>

        {/* Actions en masse */}
        {selectedTenants.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">
              {selectedTenants.length} tenant(s) sélectionné(s)
            </span>
            
            <button
              onClick={() => onBulkAction('activate')}
              className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
            >
              <Activity size={14} /> Activer
            </button>
            
            <button
              onClick={() => onBulkAction('suspend')}
              className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1"
            >
              <AlertCircle size={14} /> Suspendre
            </button>
            
            <button
              onClick={() => onBulkAction('extend_trial', 7)}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <RotateCcw size={14} /> Prolonger essai (7j)
            </button>
            
            <button
              onClick={onClearSelection}
              className="px-3 py-1.5 text-gray-600 text-sm hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* Contenu principal */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="animate-spin text-red-500" size={48} />
        </div>
      ) : tenants.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <Building2 className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Aucun tenant</h3>
          <p className="text-gray-400 mb-4">Commencez par créer votre premier tenant</p>
          <button
            onClick={onCreateTenant}
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Créer un tenant
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tenants.map((tenant) => (
              <TenantGridCard
                key={tenant.id}
                tenant={tenant}
                isSelected={selectedTenants.includes(tenant.id)}
                onSelect={() => onSelectTenant(tenant.id)}
                onClick={() => onTenantClick(tenant)}
              />
            ))}
          </div>
          
          {pagination && pagination.pages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
              onItemsPerPageChange={onItemsPerPageChange}
            />
          )}
        </>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={tenants.length > 0 && selectedTenants.length === tenants.length}
                      onChange={() => onSelectAll(tenants)}
                      className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Tenant
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Contact
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Plan
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Utilisateurs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                    Création
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTenants.includes(tenant.id)}
                        onChange={() => onSelectTenant(tenant.id)}
                        className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{tenant.nom_pharmacie}</div>
                      <div className="text-xs text-gray-400">{tenant.tenant_code}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">{tenant.email_admin}</div>
                      <div className="text-xs text-gray-400">{tenant.telephone_principal}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tenant.status} />
                    </td>
                    <td className="px-4 py-3">
                      <PlanBadge plan={tenant.current_plan} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{tenant.user_count || 0}</div>
                      <div className="text-xs text-gray-400">/ {tenant.max_users || '∞'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(tenant.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onTenantClick(tenant)}
                        className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Voir détails"
                      >
                        <Eye size={16} className="text-gray-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {pagination && pagination.pages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.pages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={onPageChange}
              onItemsPerPageChange={onItemsPerPageChange}
            />
          )}
        </>
      )}
    </div>
  );
};

// ============================================================================
// MODALS
// ============================================================================

interface CreateTenantModalProps {
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const CreateTenantModal: React.FC<CreateTenantModalProps> = ({
  onClose,
  onSubmit,
  isLoading
}) => {
  const [formData, setFormData] = useState({
    nom_pharmacie: '',
    email_admin: '',
    password_admin: '',
    ville: '',
    pays: 'RDC',
    telephone: '',
    adresse: '',
    type_pharmacie: '',
    plan: 'professional' as PlanType,
    trial_days: 14
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* En-tête */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-800">Créer un nouveau tenant</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la pharmacie *
              </label>
              <input
                type="text"
                required
                value={formData.nom_pharmacie}
                onChange={(e) => setFormData({ ...formData, nom_pharmacie: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="ex: Pharmacie Centrale"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email admin *
              </label>
              <input
                type="email"
                required
                value={formData.email_admin}
                onChange={(e) => setFormData({ ...formData, email_admin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="admin@pharmacie.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe *
              </label>
              <input
                type="password"
                required
                value={formData.password_admin}
                onChange={(e) => setFormData({ ...formData, password_admin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Minimum 8 caractères"
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                required
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="+243 XXX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville *
              </label>
              <input
                type="text"
                required
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Kinshasa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pays
              </label>
              <input
                type="text"
                value={formData.pays}
                onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="RDC"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <textarea
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Adresse complète"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de pharmacie
              </label>
              <input
                type="text"
                value={formData.type_pharmacie}
                onChange={(e) => setFormData({ ...formData, type_pharmacie: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="ex: Privée"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan *
              </label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as PlanType })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jours d'essai
              </label>
              <input
                type="number"
                value={formData.trial_days}
                onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 14 })}
                min={1}
                max={365}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
            >
              {isLoading && <Loader2 className="animate-spin" size={18} />}
              Créer le tenant
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TenantDetailsModalProps {
  tenant: Tenant;
  onClose: () => void;
  onAction: (action: string, value?: any) => void;
  isLoading: boolean;
}

const TenantDetailsModal: React.FC<TenantDetailsModalProps> = ({
  tenant,
  onClose,
  onAction,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'subscriptions' | 'activity'>('info');

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* En-tête */}
        <div className="p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-800">{tenant.nom_pharmacie}</h2>
              <p className="text-sm text-gray-400">Code: {tenant.tenant_code}</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>

          {/* Actions rapides */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              onClick={() => onAction('activate')}
              disabled={isLoading || tenant.status === 'active'}
              className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Activity size={14} /> Activer
            </button>
            
            <button
              onClick={() => onAction('suspend')}
              disabled={isLoading || tenant.status === 'suspended'}
              className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <AlertCircle size={14} /> Suspendre
            </button>
            
            <button
              onClick={() => onAction('extend_trial', 7)}
              disabled={isLoading || tenant.status !== 'trial'}
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <RotateCcw size={14} /> Prolonger essai (7j)
            </button>
            
            <button
              onClick={() => onAction('reset_password')}
              disabled={isLoading}
              className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Key size={14} /> Reset Password
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-gray-100 px-6">
          <div className="flex gap-4">
            {(['info', 'users', 'subscriptions', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
                  activeTab === tab
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'info' ? 'Informations' : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {activeTab === 'info' && (
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Statut</div>
                <div className="text-sm text-gray-700">
                  <StatusBadge status={tenant.status} />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Plan</div>
                <div className="text-sm text-gray-700">
                  <PlanBadge plan={tenant.current_plan} />
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Email admin</div>
                <div className="text-sm text-gray-700">{tenant.email_admin}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Téléphone</div>
                <div className="text-sm text-gray-700">{tenant.telephone_principal}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Ville</div>
                <div className="text-sm text-gray-700">{tenant.ville}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Pays</div>
                <div className="text-sm text-gray-700">{tenant.pays}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs text-gray-400 font-medium mb-1">Adresse</div>
                <div className="text-sm text-gray-700">{tenant.adresse || '-'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Max utilisateurs</div>
                <div className="text-sm text-gray-700">
                  {tenant.max_users === 0 ? 'Illimité' : tenant.max_users}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400 font-medium mb-1">Date création</div>
                <div className="text-sm text-gray-700">
                  {format(new Date(tenant.created_at), 'dd/MM/yyyy HH:mm')}
                </div>
              </div>
              {tenant.trial_end_date && (
                <div className="col-span-2">
                  <div className="text-xs text-gray-400 font-medium mb-1">Fin d'essai</div>
                  <div className={`text-sm ${
                    new Date(tenant.trial_end_date) < new Date() ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {format(new Date(tenant.trial_end_date), 'dd/MM/yyyy')}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab !== 'info' && (
            <div className="text-center text-gray-400 py-8">
              <Users size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Cette fonctionnalité est en cours de développement</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  
  // État local
  const [activeTab, setActiveTab] = useLocalStorage<'overview' | 'tenants' | 'users' | 'subscriptions' | 'analytics' | 'system' | 'logs' | 'settings'>(
    'superadmin-active-tab',
    'overview'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('superadmin-view-mode', 'grid');
  const [filters, setFilters] = useState({
    status_filter: '' as TenantStatus | '',
    plan_filter: '' as PlanType | ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useLocalStorage('superadmin-items-per-page', 20);

  const debouncedSearch = useDebounce(searchQuery, 500);
  const queryClient = useQueryClient();

  // Vérification de l'authentification au chargement
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    console.log('🔐 Vérification authentification SuperAdmin:');
    console.log('   Token présent:', !!token);
    console.log('   User stocké:', !!storedUser);
    console.log('   User store:', user);
    
    if (!token || !user) {
      console.log('❌ Non authentifié - Redirection vers login');
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Requêtes
  const { 
    data: overview, 
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview
  } = useQuery({
    queryKey: ['superadmin-overview'],
    queryFn: superAdminApi.getDashboardOverview,
    refetchInterval: 60000,
    retry: 2,
    staleTime: 30000,
    enabled: !!user // Ne charger que si authentifié
  });

  const { 
    data: tenantsResponse, 
    isLoading: tenantsLoading,
    error: tenantsError,
    refetch: refetchTenants
  } = useQuery({
    queryKey: ['superadmin-tenants', currentPage, itemsPerPage, debouncedSearch, filters],
    queryFn: () => superAdminApi.getTenants({
      page: currentPage,
      limit: itemsPerPage,
      search: debouncedSearch || undefined,
      status_filter: filters.status_filter || undefined,
      plan_filter: filters.plan_filter || undefined,
      sort_by: 'created_at',
      sort_order: 'desc'
    }),
    retry: 1,
    enabled: !!user
  });

  const { 
    data: healthData, 
    refetch: refetchHealth 
  } = useQuery({
    queryKey: ['superadmin-health'],
    queryFn: superAdminApi.getSystemHealth,
    refetchInterval: 300000,
    retry: 1,
    enabled: !!user
  });

  const { 
    data: notificationsData
  } = useQuery({
    queryKey: ['superadmin-notifications'],
    queryFn: superAdminApi.getSystemNotifications,
    refetchInterval: 30000,
    retry: 1,
    enabled: !!user
  });

  const { 
    data: subscriptionStats 
  } = useQuery({
    queryKey: ['superadmin-subscription-stats'],
    queryFn: superAdminApi.getSubscriptionStatistics,
    enabled: activeTab === 'subscriptions' && !!user,
    retry: 1
  });

  const { 
    data: systemSettings,
    refetch: refetchSettings
  } = useQuery({
    queryKey: ['superadmin-system-settings'],
    queryFn: superAdminApi.getSystemSettings,
    enabled: activeTab === 'settings' && !!user,
    retry: 1
  });

  // Mutations
  const bulkActionMutation = useMutation({
    mutationFn: ({ tenantIds, action, value }: { tenantIds: string[]; action: string; value?: any }) =>
      superAdminApi.bulkTenantActions(tenantIds, action, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
    }
  });

  const createTenantMutation = useMutation({
    mutationFn: (data: any) => superAdminApi.createTenant(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
      setShowCreateTenant(false);
    }
  });

  const tenantActionMutation = useMutation({
    mutationFn: ({ id, action, value }: { id: string; action: string; value?: any }) =>
      superAdminApi.performTenantAction(id, action, value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
    }
  });

  // Handlers
  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries();
    toast.success('✅ Données rafraîchies');
  }, [queryClient]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const handleBulkAction = useCallback((action: string, value?: any) => {
    if (selectedTenants.length === 0) {
      toast.error('Sélectionnez au moins un tenant');
      return;
    }

    if (window.confirm(`Effectuer l'action "${action}" sur ${selectedTenants.length} tenant(s) ?`)) {
      bulkActionMutation.mutate({
        tenantIds: selectedTenants,
        action,
        value
      });
      setSelectedTenants([]);
    }
  }, [selectedTenants, bulkActionMutation]);

  const handleSelectTenant = useCallback((tenantId: string) => {
    setSelectedTenants(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  }, []);

  const handleSelectAll = useCallback((tenants: Tenant[]) => {
    if (selectedTenants.length === tenants.length) {
      setSelectedTenants([]);
    } else {
      setSelectedTenants(tenants.map(t => t.id));
    }
  }, [selectedTenants.length]);

  const handleClearSelection = useCallback(() => {
    setSelectedTenants([]);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleFilterChange = useCallback((key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, [setViewMode]);

  const handleItemsPerPageChange = useCallback((limit: number) => {
    setItemsPerPage(limit);
    setCurrentPage(1);
  }, [setItemsPerPage]);

  // Rendu
  if (overviewError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Erreur de chargement</h2>
          <p className="text-gray-500 mb-4">
            {overviewError instanceof Error ? overviewError.message : 'Impossible de charger le tableau de bord'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* En-tête */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-md shadow-red-200">
                <Shield className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-800">Super Administration</h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Globe size={12} /> Plateforme MEDIGEST • {user?.nom_complet || 'Super Admin'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Indicateur système */}
              <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-xl">
                <div className={`w-2 h-2 rounded-full ${
                  healthData?.status === 'healthy' 
                    ? 'bg-green-500 animate-pulse' 
                    : healthData?.status === 'degraded'
                      ? 'bg-yellow-500 animate-pulse'
                      : 'bg-red-500 animate-pulse'
                }`} />
                <span className="text-xs font-medium text-gray-600">
                  {healthData?.status === 'healthy' 
                    ? 'Système OK' 
                    : healthData?.status === 'degraded'
                      ? 'Système dégradé'
                      : 'Problème détecté'}
                </span>
              </div>

              {/* Notifications */}
              <button 
                onClick={() => setActiveTab('logs')}
                className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <Bell size={18} className="text-gray-600" />
                {notificationsData?.unread_count ? notificationsData.unread_count > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                ) : null}
              </button>

              {/* Rafraîchir */}
              <button 
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                title="Rafraîchir les données"
              >
                <RefreshCw size={18} className="text-gray-600" />
              </button>

              {/* Déconnexion */}
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                title="Déconnexion"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>

          {/* Navigation par onglets */}
          <nav className="flex gap-1 mt-4 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'overview', label: 'Vue d\'ensemble', icon: Activity, count: overview?.platform?.total_tenants },
              { id: 'tenants', label: 'Tenants', icon: Building2, count: overview?.platform?.total_tenants },
              { id: 'users', label: 'Utilisateurs', icon: Users, count: overview?.platform?.total_users },
              { id: 'subscriptions', label: 'Abonnements', icon: CreditCard },
              { id: 'analytics', label: 'Analytique', icon: TrendingUp },
              { id: 'system', label: 'Système', icon: Server },
              { id: 'logs', label: 'Journaux', icon: FileText },
              { id: 'settings', label: 'Configuration', icon: Settings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-red-500 text-white shadow-md shadow-red-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="p-6">
        {activeTab === 'overview' && (
          <OverviewTab
            overview={overview}
            health={healthData}
            notifications={notificationsData?.notifications}
            isLoading={overviewLoading}
            onRefresh={refetchOverview}
          />
        )}

        {activeTab === 'tenants' && (
          <TenantsTab
            tenants={tenantsResponse?.data || []}
            pagination={tenantsResponse?.pagination}
            isLoading={tenantsLoading}
            error={tenantsError as Error | null}
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            filters={filters}
            onFilterChange={handleFilterChange}
            selectedTenants={selectedTenants}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onTenantClick={setSelectedTenant}
            onBulkAction={handleBulkAction}
            onCreateTenant={() => setShowCreateTenant(true)}
            onRefresh={refetchTenants}
            onSelectTenant={handleSelectTenant}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}

        {activeTab === 'subscriptions' && subscriptionStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Abonnements actifs"
                value={subscriptionStats.summary.active_paid_tenants}
                subtitle={`/${subscriptionStats.summary.total_tenants} total`}
                icon={<CreditCard size={20} />}
                color="green"
              />
              <StatCard
                title="En période d'essai"
                value={subscriptionStats.summary.trial_tenants}
                subtitle={`${subscriptionStats.summary.conversion_rate} conversion`}
                icon={<Activity size={20} />}
                color="blue"
              />
              <StatCard
                title="Revenu mensuel"
                value={subscriptionStats.revenue.monthly}
                subtitle={`${subscriptionStats.revenue.average_per_tenant}/tenant`}
                icon={<DollarSign size={20} />}
                color="purple"
              />
              <StatCard
                title="Revenu annuel"
                value={subscriptionStats.revenue.yearly}
                subtitle="projection"
                icon={<TrendingUp size={20} />}
                color="red"
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-700 mb-4">Distribution par plan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(subscriptionStats.distribution).map(([plan, count]) => (
                  <div key={plan} className="p-4 bg-gray-50 rounded-xl">
                    <div className="text-sm text-gray-500 mb-1 capitalize">{plan}</div>
                    <div className="text-2xl font-bold text-gray-800">{count}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {subscriptionStats.plans_config[plan as PlanType]?.price_monthly 
                        ? `${subscriptionStats.plans_config[plan as PlanType].price_monthly} ${subscriptionStats.plans_config[plan as PlanType].currency}/mois`
                        : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'system' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700">État du système</h3>
                <button 
                  onClick={() => refetchHealth()} 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Database size={16} className="text-gray-400" />
                    <span className="font-medium">Base de données</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      healthData?.checks?.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                    }`} />
                    <span className="text-sm">
                      {healthData?.checks?.database?.status === 'healthy' ? 'Connectée' : 'Problème'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Wifi size={16} className="text-gray-400" />
                    <span className="font-medium">Services</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      healthData?.checks?.services?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-sm">
                      {healthData?.checks?.services?.status === 'healthy' ? 'OK' : 'Dégradé'}
                    </span>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <HardDrive size={16} className="text-gray-400" />
                    <span className="font-medium">Performance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${
                      healthData?.checks?.performance?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                    }`} />
                    <span className="text-sm">
                      {healthData?.checks?.performance?.status === 'healthy' ? 'Normale' : 'À surveiller'}
                    </span>
                  </div>
                </div>
              </div>

              {healthData?.recommendations && healthData.recommendations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Recommandations</h4>
                  <ul className="space-y-1">
                    {healthData.recommendations.map((rec, idx) => (
                      <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                        <AlertCircle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && systemSettings && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-700">Paramètres système</h3>
                <button 
                  onClick={() => refetchSettings()} 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <RefreshCw size={16} />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Général</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Nom de la plateforme</div>
                      <div className="text-sm font-medium">{systemSettings.settings.general.platform_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Email support</div>
                      <div className="text-sm">{systemSettings.settings.general.support_email}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Langue par défaut</div>
                      <div className="text-sm">{systemSettings.settings.general.default_language}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Fuseau horaire</div>
                      <div className="text-sm">{systemSettings.settings.general.timezone}</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Inscription</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-400">Nouvelles inscriptions</div>
                      <div className="text-sm">
                        {systemSettings.settings.registration.allow_new_registrations ? 'Autorisées' : 'Bloquées'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Jours d'essai par défaut</div>
                      <div className="text-sm">{systemSettings.settings.registration.default_trial_days} jours</div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Maintenance</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${systemSettings.settings.maintenance.mode ? 'bg-red-500' : 'bg-green-500'}`} />
                    <span className="text-sm">
                      {systemSettings.settings.maintenance.mode ? 'Mode maintenance activé' : 'Mode maintenance désactivé'}
                    </span>
                  </div>
                  {systemSettings.settings.maintenance.mode && (
                    <div className="mt-2 text-sm text-gray-600">
                      Message: {systemSettings.settings.maintenance.message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Onglets en cours de développement */}
        {['users', 'analytics', 'logs'].includes(activeTab) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            {activeTab === 'users' && <Users size={48} className="mx-auto mb-4 text-gray-300" />}
            {activeTab === 'analytics' && <BarChart size={48} className="mx-auto mb-4 text-gray-300" />}
            {activeTab === 'logs' && <FileText size={48} className="mx-auto mb-4 text-gray-300" />}
            <h3 className="text-lg font-medium text-gray-700 mb-2 capitalize">
              {activeTab === 'users' ? 'Gestion des utilisateurs' : activeTab === 'analytics' ? 'Analytique' : 'Journaux système'}
            </h3>
            <p className="text-gray-400">Cette fonctionnalité est en cours de développement</p>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCreateTenant && (
        <CreateTenantModal
          onClose={() => setShowCreateTenant(false)}
          onSubmit={createTenantMutation.mutate}
          isLoading={createTenantMutation.isPending}
        />
      )}

      {selectedTenant && (
        <TenantDetailsModal
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
          onAction={(action, value) => 
            tenantActionMutation.mutate({ id: selectedTenant.id, action, value })
          }
          isLoading={tenantActionMutation.isPending}
        />
      )}
    </div>
  );
}