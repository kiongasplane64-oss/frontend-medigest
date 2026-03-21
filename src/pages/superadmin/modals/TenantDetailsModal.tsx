// modals/TenantDetailsModal.tsx
import { useState, useMemo } from 'react';
import { 
  X, AlertCircle, RotateCcw, Key, Users, 
  Building2, Mail, Phone, MapPin, Calendar, UserCog,
  Clock, CheckCircle, Ban, RefreshCw, Loader2, Eye, Trash2, Plus,
  Activity, CreditCard, TrendingUp, FileText, DollarSign,
  BarChart3, Settings, Shield, UserPlus
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/api/client';

type PlanType = 'starter' | 'professional' | 'enterprise';
type TenantStatus = 'active' | 'trial' | 'suspended' | 'inactive' | 'deleted';

interface Tenant {
  id: string;
  tenant_code: string;
  nom_pharmacie: string;
  email_admin: string;
  telephone_principal: string;
  ville: string;
  pays: string;
  adresse?: string;
  status: TenantStatus;
  current_plan: PlanType;
  max_users: number;
  user_count?: number;
  created_at: string;
  trial_end_date?: string;
}

interface TenantDetails {
  tenant: Tenant;
  statistics: {
    users: { total: number; limit: number; usage_percentage: number };
    pharmacies: { total: number; limit: number; usage_percentage: number };
    roles_distribution: Record<string, number>;
    created: string;
    last_updated: string;
  };
  users: Array<{
    id: string;
    email: string;
    nom_complet: string;
    role: string;
    telephone: string;
    actif: boolean;
    last_login: string | null;
    created_at: string;
  }>;
  pharmacies: Array<{
    id: string;
    name: string;
    address: string;
    city: string;
    phone: string;
    is_main: boolean;
    is_active: boolean;
    created_at: string;
  }>;
  recent_activity: Array<{
    id: string;
    action: string;
    description: string;
    user_id: string | null;
    created_at: string;
    ip_address: string | null;
  }>;
}

interface TenantDetailsModalProps {
  tenant: Tenant;
  onClose: () => void;
}

const StatusBadge: React.FC<{ status: TenantStatus }> = ({ status }) => {
  const config: Record<TenantStatus, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    active: { bg: 'bg-green-100', text: 'text-green-700', label: 'Actif', icon: <Activity size={12} /> },
    trial: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Essai', icon: <Clock size={12} /> },
    suspended: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Suspendu', icon: <Ban size={12} /> },
    inactive: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Inactif', icon: <AlertCircle size={12} /> },
    deleted: { bg: 'bg-red-100', text: 'text-red-700', label: 'Supprimé', icon: <Trash2 size={12} /> }
  };

  const style = config[status] || config.inactive;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
      {style.icon}
      {style.label}
    </span>
  );
};

const PlanBadge: React.FC<{ plan: PlanType | string }> = ({ plan }) => {
  const normalizedPlan = (plan || '').toLowerCase();
  
  const config: Record<string, { bg: string; text: string; label: string; price: string; icon: React.ReactNode }> = {
    starter: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Starter', price: '49,99€/mois', icon: <CreditCard size={12} /> },
    professional: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Professional', price: '99,99€/mois', icon: <TrendingUp size={12} /> },
    enterprise: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Enterprise', price: 'Sur devis', icon: <Shield size={12} /> }
  };

  const style = config[normalizedPlan] || config.starter;
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}>
        {style.icon}
        {style.label}
      </span>
      <span className="text-xs text-gray-400">{style.price}</span>
    </div>
  );
};

const InfoCard: React.FC<{ icon: React.ReactNode; title: string; value: string | React.ReactNode; subtitle?: string }> = ({ icon, title, value, subtitle }) => (
  <div className="bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors">
    <div className="flex items-center gap-2 mb-1">
      <div className="text-gray-400">{icon}</div>
      <span className="text-xs text-gray-500">{title}</span>
    </div>
    <div className="text-sm font-medium text-gray-800">{value}</div>
    {subtitle && <div className="text-xs text-gray-400 mt-0.5">{subtitle}</div>}
  </div>
);

const StatCard: React.FC<{ title: string; value: number | string; total?: number; color?: string; icon?: React.ReactNode }> = ({ title, value, total, color = 'red', icon }) => {
  const percentage = total ? Math.round((Number(value) / total) * 100) : 0;
  const colors: Record<string, string> = {
    red: 'bg-red-500',
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500'
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-400">{title}</p>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {total !== undefined && (
        <div className="mt-2">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Utilisation</span>
            <span>{percentage}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${colors[color]} rounded-full transition-all`} style={{ width: `${Math.min(percentage, 100)}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1">sur {total}</p>
        </div>
      )}
    </div>
  );
};

const ActivityItem: React.FC<{ activity: any }> = ({ activity }) => {
  const getActivityIcon = (action: string) => {
    if (action.includes('CREATE')) return <Plus size={14} className="text-green-600" />;
    if (action.includes('DELETE')) return <Trash2 size={14} className="text-red-600" />;
    if (action.includes('UPDATE')) return <RefreshCw size={14} className="text-blue-600" />;
    if (action.includes('VIEW')) return <Eye size={14} className="text-gray-500" />;
    if (action.includes('LOGIN')) return <UserPlus size={14} className="text-purple-600" />;
    if (action.includes('CONFIG')) return <Settings size={14} className="text-orange-600" />;
    if (action.includes('REPORT')) return <FileText size={14} className="text-cyan-600" />;
    if (action.includes('ANALYTICS')) return <BarChart3 size={14} className="text-indigo-600" />;
    if (action.includes('PAYMENT')) return <DollarSign size={14} className="text-emerald-600" />;
    return <Activity size={14} className="text-gray-500" />;
  };

  return (
    <div className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors">
      <div className="h-8 w-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
        {getActivityIcon(activity.action)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-800 truncate">{activity.description}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{format(new Date(activity.created_at), 'dd/MM/yyyy HH:mm')}</span>
          {activity.ip_address && (
            <span className="text-xs text-gray-400">• {activity.ip_address}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default function TenantDetailsModal({ tenant, onClose }: TenantDetailsModalProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'pharmacies' | 'activity'>('info');
  const [showFullHistory, setShowFullHistory] = useState(false);

  // Récupération des détails complets du tenant
  const { data: details, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant-details', tenant.id],
    queryFn: async () => {
      const { data } = await api.get<TenantDetails>(`/super-admin/tenants/${tenant.id}`);
      return data;
    },
    enabled: true
  });

  // Actions sur le tenant
  const actionMutation = useMutation({
    mutationFn: async ({ action, value }: { action: string; value?: any }) => {
      const params = new URLSearchParams({ action });
      if (value) params.append('value', value.toString());
      const { data } = await api.post(`/super-admin/tenants/${tenant.id}/actions?${params}`);
      return data;
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['tenant-details', tenant.id] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      queryClient.invalidateQueries({ queryKey: ['superadmin-overview'] });
      toast.success(`✅ Action "${action}" effectuée avec succès`);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail?.message || 'Erreur lors de l\'action');
    }
  });

  // Réinitialisation du mot de passe
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/super-admin/tenants/${tenant.id}/actions?action=reset_password`);
      return data;
    },
    onSuccess: (data) => {
      toast.success(`✅ Mot de passe réinitialisé avec succès`);
      if (data.result?.new_password) {
        toast.success(`Nouveau mot de passe: ${data.result.new_password}`, { duration: 10000 });
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail?.message || 'Erreur lors de la réinitialisation');
    }
  });

  const handleAction = (action: string, value?: any) => {
    const confirmMessages: Record<string, string> = {
      activate: 'Êtes-vous sûr de vouloir activer ce tenant ?',
      suspend: 'Êtes-vous sûr de vouloir suspendre ce tenant ?',
      extend_trial: `Êtes-vous sûr de vouloir prolonger la période d'essai de ${value} jours ?`,
      reset_password: 'Êtes-vous sûr de vouloir réinitialiser le mot de passe ? Un nouveau mot de passe sera généré.'
    };

    if (window.confirm(confirmMessages[action] || `Êtes-vous sûr de vouloir ${action} ce tenant ?`)) {
      if (action === 'reset_password') {
        resetPasswordMutation.mutate();
      } else {
        actionMutation.mutate({ action, value });
      }
    }
  };

  // Calcul des jours restants d'essai
  const trialDaysRemaining = useMemo(() => {
    if (!tenant.trial_end_date || tenant.status !== 'trial') return null;
    const days = differenceInDays(new Date(tenant.trial_end_date), new Date());
    return days;
  }, [tenant]);

  const isLoadingContent = isLoading && !details;

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl max-w-md w-full p-8 text-center">
          <AlertCircle className="mx-auto text-red-500 mb-4" size={48} />
          <h3 className="text-lg font-medium text-gray-700 mb-2">Erreur de chargement</h3>
          <p className="text-gray-400 mb-4">Impossible de charger les détails du tenant</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white rounded-xl">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  // Filtrer l'activité selon l'affichage
  const displayedActivities = showFullHistory 
    ? details?.recent_activity 
    : details?.recent_activity?.slice(0, 10);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* En-tête avec bannière */}
        <div className="relative bg-linear-to-r from-red-500 to-red-600 p-6 rounded-t-3xl">
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors text-white"
          >
            <X size={20} />
          </button>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <Building2 size={24} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{tenant.nom_pharmacie}</h2>
                  <p className="text-sm text-white/80">Code: {tenant.tenant_code}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={tenant.status} />
                <PlanBadge plan={tenant.current_plan} />
              </div>
            </div>
          </div>
        </div>

        {/* Actions rapides */}
        <div className="px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleAction('activate')}
              disabled={tenant.status === 'active' || actionMutation.isPending || resetPasswordMutation.isPending}
              className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              {actionMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
              Activer
            </button>
            
            <button
              onClick={() => handleAction('suspend')}
              disabled={tenant.status === 'suspended' || actionMutation.isPending || resetPasswordMutation.isPending}
              className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              <Ban size={14} /> Suspendre
            </button>
            
            {tenant.status === 'trial' && (
              <button
                onClick={() => handleAction('extend_trial', 7)}
                disabled={actionMutation.isPending || resetPasswordMutation.isPending}
                className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
              >
                <RotateCcw size={14} /> Prolonger essai (7j)
              </button>
            )}
            
            <button
              onClick={() => handleAction('reset_password')}
              disabled={resetPasswordMutation.isPending || actionMutation.isPending}
              className="px-3 py-1.5 bg-gray-500 text-white text-sm rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
            >
              {resetPasswordMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
              Reset Password
            </button>
          </div>
        </div>

        {/* Onglets */}
        <div className="border-b border-gray-100 px-6 bg-gray-50/50">
          <div className="flex gap-1">
            {(['info', 'users', 'pharmacies', 'activity'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab
                    ? 'border-b-2 border-red-500 text-red-600 bg-white rounded-t-xl'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-t-xl'
                }`}
              >
                {tab === 'info' && <Settings size={14} />}
                {tab === 'users' && <Users size={14} />}
                {tab === 'pharmacies' && <Building2 size={14} />}
                {tab === 'activity' && <Activity size={14} />}
                <span className="capitalize">
                  {tab === 'info' ? 'Informations' : tab === 'pharmacies' ? 'Pharmacies' : tab}
                </span>
                {tab === 'users' && details?.statistics?.users?.total && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {details.statistics.users.total}
                  </span>
                )}
                {tab === 'pharmacies' && details?.statistics?.pharmacies?.total && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {details.statistics.pharmacies.total}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {isLoadingContent ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="animate-spin text-red-500" size={48} />
            </div>
          ) : (
            <>
              {activeTab === 'info' && (
                <div className="space-y-6">
                  {/* Statistiques */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <StatCard 
                      title="Utilisateurs" 
                      value={details?.statistics?.users?.total || 0} 
                      total={details?.statistics?.users?.limit || tenant.max_users}
                      color="red"
                      icon={<Users size={14} />}
                    />
                    <StatCard 
                      title="Pharmacies" 
                      value={details?.statistics?.pharmacies?.total || 0} 
                      total={details?.statistics?.pharmacies?.limit || 0}
                      color="blue"
                      icon={<Building2 size={14} />}
                    />
                    <StatCard 
                      title="Jours d'essai restants" 
                      value={trialDaysRemaining !== null ? `${trialDaysRemaining} jours` : 'N/A'}
                      color="purple"
                      icon={<Clock size={14} />}
                    />
                  </div>

                  {/* Informations détaillées */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoCard
                      icon={<Mail size={14} />}
                      title="Email administrateur"
                      value={tenant.email_admin}
                    />
                    <InfoCard
                      icon={<Phone size={14} />}
                      title="Téléphone"
                      value={tenant.telephone_principal}
                    />
                    <InfoCard
                      icon={<MapPin size={14} />}
                      title="Ville / Pays"
                      value={`${tenant.ville}, ${tenant.pays}`}
                    />
                    <InfoCard
                      icon={<Calendar size={14} />}
                      title="Date de création"
                      value={format(new Date(tenant.created_at), 'dd MMMM yyyy', { locale: fr })}
                      subtitle={formatDistanceToNow(new Date(tenant.created_at), { addSuffix: true, locale: fr })}
                    />
                    {tenant.adresse && (
                      <InfoCard
                        icon={<Building2 size={14} />}
                        title="Adresse"
                        value={tenant.adresse}
                      />
                    )}
                    {tenant.trial_end_date && (
                      <InfoCard
                        icon={<Clock size={14} />}
                        title="Fin de période d'essai"
                        value={format(new Date(tenant.trial_end_date), 'dd MMMM yyyy', { locale: fr })}
                        subtitle={
                          trialDaysRemaining !== null && trialDaysRemaining >= 0
                            ? `${trialDaysRemaining} jours restants`
                            : 'Essai expiré'
                        }
                      />
                    )}
                  </div>

                  {/* Distribution des rôles */}
                  {details?.statistics?.roles_distribution && Object.keys(details.statistics.roles_distribution).length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <UserPlus size={14} /> Distribution des rôles
                      </h4>
                      <div className="flex flex-wrap gap-3">
                        {Object.entries(details.statistics.roles_distribution).map(([role, count]) => (
                          <div key={role} className="bg-white rounded-lg px-3 py-1.5 shadow-sm flex items-center gap-2">
                            <Shield size={12} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-800 capitalize">{role}</span>
                            <span className="text-xs text-gray-400">({count})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'users' && (
                <div className="space-y-4">
                  {details?.users && details.users.length > 0 ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <UserPlus size={16} className="text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {details.users.length} utilisateur(s) actif(s) sur {details.statistics.users.limit || 'illimité'}
                          </span>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 rounded-xl">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Utilisateur</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Email</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Rôle</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Statut</th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Dernière connexion</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {details.users.map(user => (
                              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center">
                                      <UserCog size={14} className="text-gray-500" />
                                    </div>
                                    <span className="font-medium text-gray-800">{user.nom_complet}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs capitalize">
                                    {user.role}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {user.actif ? (
                                    <span className="text-green-600 text-sm flex items-center gap-1">
                                      <CheckCircle size={12} /> Actif
                                    </span>
                                  ) : (
                                    <span className="text-gray-400 text-sm flex items-center gap-1">
                                      <Ban size={12} /> Inactif
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-400">
                                  {user.last_login ? format(new Date(user.last_login), 'dd/MM/yyyy HH:mm') : 'Jamais'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Users size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>Aucun utilisateur pour ce tenant</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'pharmacies' && (
                <div className="space-y-4">
                  {details?.pharmacies && details.pharmacies.length > 0 ? (
                    <>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <Building2 size={16} className="text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {details.pharmacies.length} pharmacie(s) configurée(s)
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {details.pharmacies.map(pharmacy => (
                          <div key={pharmacy.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-medium text-gray-800 flex items-center gap-2">
                                  {pharmacy.name}
                                  {pharmacy.is_main && (
                                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Principale</span>
                                  )}
                                </h4>
                                <p className="text-xs text-gray-400 mt-1">{pharmacy.city}</p>
                              </div>
                              {pharmacy.is_active ? (
                                <span className="text-green-600 text-xs flex items-center gap-1">
                                  <CheckCircle size={10} /> Active
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs flex items-center gap-1">
                                  <Ban size={10} /> Inactive
                                </span>
                              )}
                            </div>
                            <div className="mt-3 space-y-1">
                              <p className="text-sm text-gray-600 truncate">{pharmacy.address}</p>
                              <p className="text-xs text-gray-400">{pharmacy.phone}</p>
                              <p className="text-xs text-gray-400">
                                Créée le {format(new Date(pharmacy.created_at), 'dd/MM/yyyy')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Building2 size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>Aucune pharmacie associée</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-2">
                  {details?.recent_activity && details.recent_activity.length > 0 ? (
                    <>
                      {displayedActivities?.map(activity => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                      {details.recent_activity.length > 10 && (
                        <div className="text-center pt-4">
                          <button
                            onClick={() => setShowFullHistory(!showFullHistory)}
                            className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center gap-1 mx-auto"
                          >
                            {showFullHistory ? (
                              <>Voir moins <ChevronUp size={14} /></>
                            ) : (
                              <>Voir plus ({details.recent_activity.length - 10} activités supplémentaires) <ChevronDown size={14} /></>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <Activity size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>Aucune activité récente</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-3xl">
          <div className="flex justify-between items-center">
            <div className="text-xs text-gray-400 flex items-center gap-2">
              <Clock size={12} />
              Dernière mise à jour: {details?.statistics?.last_updated ? format(new Date(details.statistics.last_updated), 'dd/MM/yyyy HH:mm') : format(new Date(), 'dd/MM/yyyy HH:mm')}
            </div>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Actualiser
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Composant pour les icônes de chevron (à ajouter en haut avec les imports)
const ChevronUp = ({ size }: { size: number }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>;
const ChevronDown = ({ size }: { size: number }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;