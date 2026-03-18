import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getPharmacyUsers, 
  deletePharmacyUser, 
  createPharmacyUser, 
  updateUserPermissions,
  toggleUserStatus,
  getUserSessionStats,
  UserCreate,
  UserPermissions,
  
} from '@/services/userService';
import { getSubscriptionUsage, SubscriptionUsage } from '@/services/subscriptionService';
import { getPharmacies, Pharmacy, Branch } from '@/services/pharmacyService';
import { 
  UserPlus, Shield, Trash2, 
  Loader2, AlertCircle, 
  Settings, Power, Clock,
  Calendar, 
  Download,
  Store, Users, Activity,
  Filter, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import UserModal from '@/components/UserModal';
import PermissionModal from '@/components/PermissionModal';
import UserSessionModal from '@/components/UserSessionModal';
import { User } from '@/types/auth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Interface locale pour l'utilisateur avec full_name
interface PharmacyUser extends User {
  full_name?: string;
  pharmacy_id?: string;
  branch_id?: string;
  permissions?: UserPermissions;
  last_login?: string;
  session_duration?: number;
  monthly_stats?: {
    days_connected: number;
    total_hours: number;
    average_per_day: number;
  };
}

// Interface pour les statistiques de session adaptée
interface SessionStats {
  online_users: PharmacyUser[];
  total_sessions_today: number;
  average_session_duration: number;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PharmacyUser | null>(null);
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customStartDate] = useState('');
  const [customEndDate] = useState('');

  // 1. Récupération des pharmacies du tenant
  const { data: pharmacies = [] } = useQuery<Pharmacy[]>({
    queryKey: ['pharmacies'],
    queryFn: async () => {
      const response = await getPharmacies();
      return response;
    }
  });

  // 2. Récupération des utilisateurs avec filtres
  const { data: users = [], isLoading: loadingUsers } = useQuery<PharmacyUser[]>({
    queryKey: ['users', selectedPharmacy, selectedBranch, showInactive, searchTerm],
    queryFn: async () => {
      const response = await getPharmacyUsers({
        pharmacy_id: selectedPharmacy,
        branch_id: selectedBranch,
        include_inactive: showInactive,
        search: searchTerm
      });
      return response as PharmacyUser[];
    }
  });

  // 3. Récupération des statistiques de session
  const { data: sessionStats, refetch: refetchStats } = useQuery<SessionStats>({
    queryKey: ['session-stats', selectedPharmacy, selectedBranch, dateRange],
    queryFn: async () => {
      const response = await getUserSessionStats({
        pharmacy_id: selectedPharmacy,
        branch_id: selectedBranch,
        date_range: dateRange,
        start_date: customStartDate,
        end_date: customEndDate
      });
      
      // Transformer les données pour correspondre à notre interface
      return {
        online_users: (response as any).online_users || [],
        total_sessions_today: (response as any).total_sessions_today || 0,
        average_session_duration: (response as any).average_session_duration || 0
      };
    },
    enabled: true
  });

  // 4. Récupération de l'usage de l'abonnement
  const { data: usageData } = useQuery<SubscriptionUsage>({
    queryKey: ['subscription-usage'],
    queryFn: getSubscriptionUsage
  });

  // 5. Mutation pour la création d'utilisateur
  const createMutation = useMutation({
    mutationFn: createPharmacyUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      toast.success("Utilisateur créé avec succès");
      setIsModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de la création");
    }
  });

  // 6. Mutation pour la suppression
  const deleteMutation = useMutation({
    mutationFn: deletePharmacyUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      toast.success("Utilisateur supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression")
  });

  // 7. Mutation pour la mise à jour des permissions
  const permissionsMutation = useMutation({
    mutationFn: ({ userId, permissions }: { userId: string; permissions: UserPermissions }) =>
      updateUserPermissions(userId, permissions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Permissions mises à jour");
      setIsPermissionModalOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de la mise à jour");
    }
  });

  // 8. Mutation pour activer/désactiver un utilisateur
  const toggleStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      toggleUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success("Statut utilisateur mis à jour");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erreur lors de la mise à jour");
    }
  });

  const handleCreateUser = (userData: UserCreate & { pharmacy_id: string; branch_id?: string }) => {
    createMutation.mutate(userData);
  };

  const handleUpdatePermissions = (userId: string, permissions: UserPermissions) => {
    permissionsMutation.mutate({ userId, permissions });
  };

  const handleToggleStatus = (user: PharmacyUser) => {
    toggleStatusMutation.mutate({ 
      userId: user.id, 
      isActive: !user.is_active 
    });
  };

  // Calcul du quota
  const currentUsers = usageData?.current_users || users.length;
  const maxUsers = usageData?.max_users || 0;
  
  // Fonction pour calculer le pourcentage
  const calculatePercentage = (): number => {
    if (maxUsers === "Illimité") return 0;
    if (typeof maxUsers === 'number' && maxUsers > 0) {
      return Math.min(100, (currentUsers / maxUsers) * 100);
    }
    return 0;
  };
  
  const percentage = calculatePercentage();
  const isLimitReached = maxUsers !== "Illimité" && typeof maxUsers === 'number' && currentUsers >= maxUsers;

  // Fonction pour exporter en PDF
  const exportToPDF = (user?: PharmacyUser) => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text("Rapport d'activité des utilisateurs", 14, 22);
    doc.setFontSize(10);
    doc.text(`Généré le ${new Date().toLocaleString('fr-FR')}`, 14, 30);
    
    if (user) {
      // Rapport pour un utilisateur spécifique
      doc.text(`Utilisateur: ${user.full_name || user.name || user.email}`, 14, 38);
      doc.text(`Rôle: ${user.role}`, 14, 44);
      
      autoTable(doc, {
        startY: 50,
        head: [['Date', 'Heure connexion', 'Heure déconnexion', 'Durée', 'Pharmacie', 'Branche']],
        body: [
          ['01/03/2024', '08:15', '17:30', '9h 15m', 'Pharmacie Centrale', 'Principale'],
          ['02/03/2024', '08:30', '17:45', '9h 15m', 'Pharmacie Centrale', 'Principale'],
          ['03/03/2024', '08:00', '17:15', '9h 15m', 'Pharmacie Centrale', 'Principale'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      });
    } else {
      // Rapport pour tous les utilisateurs
      autoTable(doc, {
        startY: 40,
        head: [['Utilisateur', 'Rôle', 'Connexions', 'Heures totales', 'Moyenne/jour', 'Statut']],
        body: users.map(u => [
          u.full_name || u.name || u.email,
          u.role,
          u.monthly_stats?.days_connected?.toString() || '0',
          `${u.monthly_stats?.total_hours || 0}h`,
          `${u.monthly_stats?.average_per_day || 0}h`,
          u.is_active ? 'Actif' : 'Inactif'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185] }
      });
    }
    
    doc.save(`rapport_utilisateurs_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Fonction pour formater la durée de session
  const formatSessionDuration = (minutes?: number): string => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Fonction pour obtenir les initiales
  const getInitials = (user: PharmacyUser) => {
    if (user.full_name) {
      return user.full_name.substring(0, 2).toUpperCase();
    }
    if (user.name) {
      return user.name.substring(0, 2).toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  // Fonction pour obtenir le nom d'affichage
  const getDisplayName = (user: PharmacyUser) => {
    return user.full_name || user.name || user.email.split('@')[0];
  };

  // Fonction pour formater l'affichage de la limite
  const formatMaxDisplay = (value: number | "Illimité"): string => {
    return value === "Illimité" ? "∞" : value.toString();
  };

  if (loadingUsers) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-medical" size={40} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER & QUOTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
            GESTION <span className="text-medical">DES UTILISATEURS</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
            Gérer les accès, permissions et présence
          </p>
        </div>

        <div className="bg-white border border-slate-100 p-4 rounded-3xl flex items-center gap-6 shadow-sm">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Utilisateurs</p>
            <p className="font-black text-slate-900 italic">
              {currentUsers} / {formatMaxDisplay(maxUsers)}
            </p>
          </div>
          {maxUsers !== "Illimité" && (
            <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${isLimitReached ? 'bg-red-500' : 'bg-medical'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            disabled={isLimitReached}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
              isLimitReached 
              ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100' 
              : 'bg-medical text-white shadow-lg shadow-medical/20 hover:scale-105 active:scale-95'
            }`}
          >
            <UserPlus size={16} /> Ajouter
          </button>
        </div>
      </div>

      {isLimitReached && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center gap-3 text-red-600 text-[11px] font-black uppercase tracking-tight">
          <AlertCircle size={18} />
          Limite atteinte. Veuillez augmenter votre abonnement pour ajouter d'autres membres.
        </div>
      )}

      {/* FILTRES AVANCÉS */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400" />
          <h2 className="text-sm font-bold text-slate-700">Filtres avancés</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Filtre par pharmacie */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
              Pharmacie
            </label>
            <select
              value={selectedPharmacy}
              onChange={(e) => setSelectedPharmacy(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
            >
              <option value="">Toutes les pharmacies</option>
              {pharmacies.map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>
                  {pharmacy.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtre par branche */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
              Succursale
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
            >
              <option value="">Toutes les succursales</option>
              {selectedPharmacy && pharmacies
                .find((p: Pharmacy) => p.id === selectedPharmacy)
                ?.config?.branchConfig?.branches?.map((branch: Branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
              ))}
            </select>
          </div>

          {/* Recherche */}
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
              Recherche
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nom, email..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
            />
          </div>

          {/* Afficher inactifs */}
          <div className="flex items-center gap-2 pt-6">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-medical"></div>
            </label>
            <span className="text-sm text-slate-600">Afficher les comptes inactifs</span>
          </div>
        </div>
      </div>

      {/* STATISTIQUES DE PRÉSENCE */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Users className="text-green-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">En ligne</p>
              <p className="text-2xl font-black text-slate-900">{sessionStats?.online_users?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Activity className="text-blue-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sessions aujourd'hui</p>
              <p className="text-2xl font-black text-slate-900">{sessionStats?.total_sessions_today || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Clock className="text-purple-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Durée moyenne</p>
              <p className="text-2xl font-black text-slate-900">
                {formatSessionDuration(sessionStats?.average_session_duration)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Calendar className="text-amber-600" size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Période</p>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="text-sm font-bold text-slate-900 bg-transparent border-none focus:ring-0"
              >
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="custom">Personnalisé</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* UTILISATEURS EN LIGNE */}
      {sessionStats?.online_users && sessionStats.online_users.length > 0 && (
        <div className="bg-linear-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="text-green-600" size={18} />
              <h3 className="font-bold text-green-800">Utilisateurs en ligne</h3>
            </div>
            <button
              onClick={() => refetchStats()}
              className="p-1 hover:bg-green-200 rounded-lg transition-colors"
            >
              <RefreshCw size={14} className="text-green-600" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sessionStats.online_users.map((user) => (
              <div
                key={user.id}
                className="bg-white px-3 py-2 rounded-xl flex items-center gap-2 shadow-sm"
              >
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-[10px] font-black">
                  {getInitials(user)}
                </div>
                <span className="text-sm font-medium">{getDisplayName(user)}</span>
                <span className="text-[10px] text-slate-400">
                  {user.session_duration ? formatSessionDuration(user.session_duration) : 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLEAU PRINCIPAL */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilisateur</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Affectation</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rôle</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Présence</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user: PharmacyUser) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs uppercase shadow-sm">
                          {getInitials(user)}
                        </div>
                        {user.last_login && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{getDisplayName(user)}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-xs">
                        <Store size={12} className="text-slate-400" />
                        <span>
                          {pharmacies.find((p: Pharmacy) => p.id === user.pharmacy_id)?.name || 'Non assigné'}
                        </span>
                      </div>
                      {user.branch_id && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Users size={12} />
                          <span>
                            {pharmacies
                              .find((p: Pharmacy) => p.id === user.pharmacy_id)
                              ?.config?.branchConfig?.branches
                              ?.find((b: Branch) => b.id === user.branch_id)?.name || 'Succursale'}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-medical" />
                      <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter italic">
                        {user.role === 'admin' ? 'Administrateur' : 
                         user.role === 'manager' ? 'Gestionnaire' : 
                         user.role === 'pharmacist' ? 'Pharmacien' :
                         user.role === 'vendeur' ? 'Vendeur' :
                         user.role === 'caissier' ? 'Caissier' :
                         user.role === 'stockiste' ? 'Stockiste' :
                         user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <button
                      onClick={() => handleToggleStatus(user)}
                      disabled={toggleStatusMutation.isPending}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${
                        user.is_active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                    >
                      <Power size={12} />
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-8 py-5">
                    <div className="space-y-1">
                      {user.last_login ? (
                        <>
                          <div className="flex items-center gap-1 text-xs">
                            <Clock size={12} className="text-slate-400" />
                            <span>
                              Connecté depuis {formatSessionDuration(user.session_duration)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400">
                            <Calendar size={10} />
                            <span>
                              {user.monthly_stats?.days_connected || 0} jours ce mois
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400">Jamais connecté</span>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Permissions */}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsPermissionModalOpen(true);
                        }}
                        className="p-2 text-slate-300 hover:text-medical hover:bg-medical/5 rounded-xl transition-all"
                        title="Gérer les permissions"
                      >
                        <Settings size={16} />
                      </button>
                      
                      {/* Voir sessions */}
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setIsSessionModalOpen(true);
                        }}
                        className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="Voir l'historique des sessions"
                      >
                        <Activity size={16} />
                      </button>
                      
                      {/* Exporter PDF */}
                      <button
                        onClick={() => exportToPDF(user)}
                        className="p-2 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                        title="Exporter en PDF"
                      >
                        <Download size={16} />
                      </button>
                      
                      {/* Supprimer */}
                      <button
                        onClick={() => {
                          if(window.confirm(`Êtes-vous sûr de vouloir supprimer ${getDisplayName(user)} ?`)) {
                            deleteMutation.mutate(user.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && (
          <div className="p-20 text-center space-y-2">
            <p className="text-slate-400 font-bold text-sm italic uppercase tracking-widest">
              Aucun utilisateur trouvé
            </p>
          </div>
        )}
      </div>

      {/* BOUTON EXPORT GLOBAL */}
      <div className="flex justify-end">
        <button
          onClick={() => exportToPDF()}
          className="flex items-center gap-2 px-6 py-3 bg-amber-50 text-amber-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-100 transition-all border border-amber-200"
        >
          <Download size={16} />
          Exporter le rapport global (PDF)
        </button>
      </div>

      {/* MODALS */}
      <UserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateUser}
        isLoading={createMutation.isPending}
        pharmacies={pharmacies}
      />

      {selectedUser && (
        <>
          <PermissionModal
            isOpen={isPermissionModalOpen}
            onClose={() => {
              setIsPermissionModalOpen(false);
              setSelectedUser(null);
            }}
            user={selectedUser}
            onSave={handleUpdatePermissions}
            isLoading={permissionsMutation.isPending}
          />

          <UserSessionModal
            isOpen={isSessionModalOpen}
            onClose={() => {
              setIsSessionModalOpen(false);
              setSelectedUser(null);
            }}
            user={selectedUser}
          />
        </>
      )}
    </div>
  );
}