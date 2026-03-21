// sections/TenantsSection.tsx
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Building2, Search, Plus, RefreshCw, Filter, X, 
  LayoutGrid, List, Eye, AlertCircle, RotateCcw,
  Loader2, MoreVertical, UserCog, Ban, CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import api from '@/api/client';
import CreateTenantModal from '../modals/CreateTenantModal';
import TenantDetailsModal from '../modals/TenantDetailsModal';

type PlanType = 'starter' | 'professional' | 'enterprise';
type TenantStatus = 'active' | 'trial' | 'suspended' | 'inactive' | 'deleted';
type ViewMode = 'grid' | 'list';

interface Tenant {
  id: string;
  tenant_code: string;
  nom_pharmacie: string;
  email_admin: string;
  telephone_principal: string;
  ville: string;
  pays: string;
  status: TenantStatus;
  current_plan: PlanType;
  max_users: number;
  user_count?: number;
  created_at: string;
  trial_end_date?: string;
}

const StatusBadge: React.FC<{ status: TenantStatus }> = ({ status }) => {
  const config: Record<TenantStatus, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Actif' },
    trial: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Essai' },
    suspended: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Suspendu' },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactif' },
    deleted: { bg: 'bg-red-100', text: 'text-red-700', label: 'Supprimé' }
  };

  const style = config[status] || config.inactive;
  return <span className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>{style.label}</span>;
};

const PlanBadge: React.FC<{ plan: PlanType | string }> = ({ plan }) => {
  // Normaliser le nom du plan pour gérer différents formats
  const normalizedPlan = (plan || '').toLowerCase();
  
  // Configuration des plans avec fallback
  const config: Record<string, { bg: string; text: string; label: string }> = {
    starter: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Starter' },
    professional: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Pro' },
    enterprise: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Enterprise' }
  };

  // Utiliser le plan normalisé ou fallback vers 'starter'
  const style = config[normalizedPlan] || config.starter;
  
  return <span className={`px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>{style.label}</span>;
};

const TenantGridCard: React.FC<{
  tenant: Tenant;
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onAction?: (action: string, value?: any) => void;
}> = ({ tenant, isSelected, onSelect, onClick, onAction }) => {
  const [showActions, setShowActions] = useState(false);

  const handleAction = (action: string, value?: any, e?: React.MouseEvent) => {
    e?.stopPropagation();
    onAction?.(action, value);
    setShowActions(false);
  };

  return (
    <div 
      className={`bg-white rounded-2xl border p-5 hover:shadow-md transition-all cursor-pointer relative ${
        isSelected ? 'border-red-500 ring-2 ring-red-200' : 'border-gray-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="rounded border-gray-300 text-red-500 focus:ring-red-500"
          />
          <div className="h-10 w-10 bg-red-100 rounded-xl flex items-center justify-center">
            <Building2 size={18} className="text-red-500" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={tenant.status} />
          
          {/* Menu d'actions */}
          {onAction && (
            <div className="relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowActions(!showActions);
                }}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <MoreVertical size={16} className="text-gray-400" />
              </button>
              
              {showActions && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10 min-w-36">
                  <button
                    onClick={(e) => handleAction('activate', undefined, e)}
                    disabled={tenant.status === 'active'}
                    className="w-full px-3 py-1.5 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle size={14} /> Activer
                  </button>
                  <button
                    onClick={(e) => handleAction('suspend', undefined, e)}
                    disabled={tenant.status === 'suspended'}
                    className="w-full px-3 py-1.5 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Ban size={14} /> Suspendre
                  </button>
                  <button
                    onClick={(e) => handleAction('extend_trial', 7, e)}
                    disabled={tenant.status !== 'trial'}
                    className="w-full px-3 py-1.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <RotateCcw size={14} /> Prolonger essai (7j)
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={(e) => handleAction('reset_password', undefined, e)}
                    className="w-full px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <UserCog size={14} /> Reset password
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <h3 className="font-bold text-gray-800 mb-1">{tenant.nom_pharmacie}</h3>
      <p className="text-xs text-gray-400 mb-3">{tenant.tenant_code}</p>
      
      <div className="space-y-2 text-sm">
        <p className="text-gray-600 truncate">{tenant.email_admin}</p>
        <div className="flex justify-between items-center">
          <PlanBadge plan={tenant.current_plan} />
          <span className="text-xs text-gray-400">
            {tenant.user_count || 0}/{tenant.max_users} users
          </span>
        </div>
      </div>
    </div>
  );
};

export default function TenantsSection() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateTenant, setShowCreateTenant] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status_filter: '' as TenantStatus | '',
    plan_filter: '' as PlanType | ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const hasActiveFilters = filters.status_filter !== '' || filters.plan_filter !== '';

  // Requête tenants
  const { data: tenantsResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-tenants', currentPage, itemsPerPage, searchQuery, filters],
    queryFn: async () => {
      const { data } = await api.get('/super-admin/tenants', {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchQuery || undefined,
          status_filter: filters.status_filter || undefined,
          plan_filter: filters.plan_filter || undefined,
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      });
      return data;
    }
  });

  const tenants = tenantsResponse?.tenants || [];
  const pagination = tenantsResponse?.pagination;

  // Mutations
  const bulkActionMutation = useMutation({
    mutationFn: async ({ tenantIds, action, value }: { tenantIds: string[]; action: string; value?: any }) => {
      await api.post('/super-admin/tenants/bulk-actions', { tenant_ids: tenantIds, action, value });
    },
    onSuccess: (_, { action, tenantIds }) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
      toast.success(`✅ Action "${action}" effectuée sur ${tenantIds.length} tenant(s)`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail?.message || 'Erreur lors de l\'action en masse');
    }
  });

  // Mutation pour les actions individuelles sur un tenant
  const tenantActionMutation = useMutation({
    mutationFn: async ({ id, action, value }: { id: string; action: string; value?: any }) => {
      const params = new URLSearchParams({ action });
      if (value) params.append('value', value.toString());
      const { data } = await api.post(`/super-admin/tenants/${id}/actions?${params}`);
      return data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
      toast.success(`✅ Action "${action}" effectuée avec succès`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail?.message || 'Erreur lors de l\'action');
    }
  });

  // Gestion des actions individuelles
  const handleTenantAction = useCallback((tenantId: string, action: string, value?: any) => {
    const actionLabels: Record<string, string> = {
      activate: 'activer',
      suspend: 'suspendre',
      extend_trial: 'prolonger la période d\'essai',
      reset_password: 'réinitialiser le mot de passe'
    };
    
    if (window.confirm(`Êtes-vous sûr de vouloir ${actionLabels[action] || action} ce tenant ?`)) {
      tenantActionMutation.mutate({ id: tenantId, action, value });
    }
  }, [tenantActionMutation]);

  // Gestion des actions en masse
  const handleBulkAction = useCallback((action: string, value?: any) => {
    if (selectedTenants.length === 0) {
      toast.error('Sélectionnez au moins un tenant');
      return;
    }
    
    const actionLabels: Record<string, string> = {
      activate: 'activer',
      suspend: 'suspendre',
      extend_trial: 'prolonger la période d\'essai'
    };
    
    if (window.confirm(`Effectuer l'action "${actionLabels[action] || action}" sur ${selectedTenants.length} tenant(s) ?`)) {
      bulkActionMutation.mutate({ tenantIds: selectedTenants, action, value });
      setSelectedTenants([]);
    }
  }, [selectedTenants, bulkActionMutation]);

  const handleSelectTenant = useCallback((tenantId: string) => {
    setSelectedTenants(prev =>
      prev.includes(tenantId) ? prev.filter(id => id !== tenantId) : [...prev, tenantId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedTenants.length === tenants.length) {
      setSelectedTenants([]);
    } else {
      setSelectedTenants(tenants.map((t: Tenant) => t.id));
    }
  }, [selectedTenants.length, tenants]);

  const handleClearFilters = () => {
    setFilters({ status_filter: '', plan_filter: '' });
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
        <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
        <h3 className="text-lg font-medium text-gray-700 mb-2">Erreur de chargement</h3>
        <p className="text-gray-400 mb-4">{error.message}</p>
        <button onClick={() => refetch()} className="px-4 py-2 bg-red-500 text-white rounded-xl">
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
                onChange={(e) => handleSearchChange(e.target.value)}
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
              {hasActiveFilters && <span className="w-2 h-2 bg-red-500 rounded-full" />}
            </button>

            {showFilters && (
              <div className="flex items-center gap-2">
                <select
                  value={filters.status_filter}
                  onChange={(e) => setFilters(prev => ({ ...prev, status_filter: e.target.value as TenantStatus }))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="">Tous les statuts</option>
                  <option value="active">Actif</option>
                  <option value="trial">Essai</option>
                  <option value="suspended">Suspendu</option>
                  <option value="inactive">Inactif</option>
                </select>

                <select
                  value={filters.plan_filter}
                  onChange={(e) => setFilters(prev => ({ ...prev, plan_filter: e.target.value as PlanType }))}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm"
                >
                  <option value="">Tous les plans</option>
                  <option value="starter">Starter</option>
                  <option value="professional">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>

                {hasActiveFilters && (
                  <button onClick={handleClearFilters} className="p-2 text-gray-400 hover:text-gray-600">
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
                onClick={() => setViewMode('grid')}
                className={`p-2 transition-colors ${
                  viewMode === 'grid' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition-colors ${
                  viewMode === 'list' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List size={18} />
              </button>
            </div>

            <button
              onClick={() => setShowCreateTenant(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
            >
              <Plus size={18} />
              <span className="text-sm font-medium">Nouveau tenant</span>
            </button>

            <button 
              onClick={() => refetch()} 
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
              onClick={() => handleBulkAction('activate')} 
              className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
            >
              <CheckCircle size={14} /> Activer
            </button>
            <button 
              onClick={() => handleBulkAction('suspend')} 
              className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-1"
            >
              <Ban size={14} /> Suspendre
            </button>
            <button 
              onClick={() => handleBulkAction('extend_trial', 7)} 
              className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1"
            >
              <RotateCcw size={14} /> Prolonger essai (7j)
            </button>
            <button 
              onClick={() => setSelectedTenants([])} 
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
            onClick={() => setShowCreateTenant(true)} 
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Créer un tenant
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((tenant: Tenant) => (
            <TenantGridCard
              key={tenant.id}
              tenant={tenant}
              isSelected={selectedTenants.includes(tenant.id)}
              onSelect={() => handleSelectTenant(tenant.id)}
              onClick={() => setSelectedTenant(tenant)}
              onAction={(action, value) => handleTenantAction(tenant.id, action, value)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={tenants.length > 0 && selectedTenants.length === tenants.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-red-500 focus:ring-red-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Tenant</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Utilisateurs</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase">Création</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tenants.map((tenant: Tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedTenants.includes(tenant.id)}
                        onChange={() => handleSelectTenant(tenant.id)}
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
                    <td className="px-4 py-3"><StatusBadge status={tenant.status} /></td>
                    <td className="px-4 py-3"><PlanBadge plan={tenant.current_plan} /></td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium">{tenant.user_count || 0}</div>
                      <div className="text-xs text-gray-400">/ {tenant.max_users}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {format(new Date(tenant.created_at), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => setSelectedTenant(tenant)} 
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          title="Voir détails"
                        >
                          <Eye size={16} className="text-gray-500" />
                        </button>
                        
                        {/* Menu d'actions rapides */}
                        <div className="relative group">
                          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                            <MoreVertical size={16} className="text-gray-400" />
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-36">
                            <button
                              onClick={() => handleTenantAction(tenant.id, 'activate')}
                              disabled={tenant.status === 'active'}
                              className="w-full px-3 py-1.5 text-left text-sm text-green-600 hover:bg-green-50 flex items-center gap-2 disabled:opacity-50"
                            >
                              <CheckCircle size={14} /> Activer
                            </button>
                            <button
                              onClick={() => handleTenantAction(tenant.id, 'suspend')}
                              disabled={tenant.status === 'suspended'}
                              className="w-full px-3 py-1.5 text-left text-sm text-orange-600 hover:bg-orange-50 flex items-center gap-2 disabled:opacity-50"
                            >
                              <Ban size={14} /> Suspendre
                            </button>
                            <button
                              onClick={() => handleTenantAction(tenant.id, 'extend_trial', 7)}
                              disabled={tenant.status !== 'trial'}
                              className="w-full px-3 py-1.5 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2 disabled:opacity-50"
                            >
                              <RotateCcw size={14} /> Prolonger essai
                            </button>
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => handleTenantAction(tenant.id, 'reset_password')}
                              className="w-full px-3 py-1.5 text-left text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <UserCog size={14} /> Reset password
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Lignes par page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(Number(e.target.value))}
              className="px-2 py-1 border border-gray-200 rounded-lg text-sm"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Précédent
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} / {pagination.pages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(pagination.pages, p + 1))}
              disabled={currentPage === pagination.pages}
              className="px-3 py-1 border border-gray-200 rounded-lg disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCreateTenant && (
        <CreateTenantModal onClose={() => setShowCreateTenant(false)} />
      )}
      {selectedTenant && (
        <TenantDetailsModal
          tenant={selectedTenant}
          onClose={() => setSelectedTenant(null)}
        />
      )}
    </div>
  );
}