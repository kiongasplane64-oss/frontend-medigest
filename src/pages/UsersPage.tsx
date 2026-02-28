import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPharmacyUsers, deletePharmacyUser, createPharmacyUser, UserCreate } from '@/services/userService';
import { getSubscriptionUsage, SubscriptionUsage } from '@/services/subscriptionService';
import { 
  UserPlus, Shield, Trash2, 
  Loader2, AlertCircle 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import UserModal from '@/components/UserModal';
import { User } from '@/types/auth';

// Interface locale pour l'utilisateur avec full_name
interface PharmacyUser extends User {
  full_name?: string;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. Récupération des utilisateurs
  const { data: users = [], isLoading: loadingUsers } = useQuery<PharmacyUser[]>({ 
    queryKey: ['users'], 
    queryFn: getPharmacyUsers 
  });

  // 2. Récupération de l'usage de l'abonnement
  const { data: usageData } = useQuery<SubscriptionUsage>({ 
    queryKey: ['subscription-usage'], 
    queryFn: getSubscriptionUsage 
  });

  // 3. Mutation pour la création d'utilisateur
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

  // 4. Mutation pour la suppression
  const deleteMutation = useMutation({
    mutationFn: deletePharmacyUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      toast.success("Utilisateur supprimé");
    },
    onError: () => toast.error("Erreur lors de la suppression")
  });

  const handleCreateUser = (userData: UserCreate) => {
    createMutation.mutate(userData);
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

  if (loadingUsers) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-medical" size={40} />
      </div>
    );
  }

  // Fonction pour obtenir les initiales d'un utilisateur
  const getInitials = (user: PharmacyUser) => {
    // Si l'utilisateur a un nom complet, utiliser les premières lettres
    if (user.full_name) {
      return user.full_name.substring(0, 2).toUpperCase();
    }
    // Sinon, utiliser la première lettre du nom ou de l'email
    if (user.name) {
      return user.name.substring(0, 2).toUpperCase();
    }
    // Sinon, utiliser la première lettre de l'email
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

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* HEADER & QUOTA */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
            ÉQUIPE <span className="text-medical">PHARMACIE</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
            Gérer les accès et les permissions
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
                className={`h-full transition-all duration-500 ${isLimitReached ? 'bg-danger' : 'bg-medical'}`}
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
        <div className="bg-danger/5 border border-danger/10 p-4 rounded-2xl flex items-center gap-3 text-danger text-[11px] font-black uppercase tracking-tight">
          <AlertCircle size={18} />
          Limite atteinte. Veuillez augmenter votre abonnement pour ajouter d'autres membres.
        </div>
      )}

      {/* TABLEAU */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Utilisateur</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rôle</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Statut</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map((user: PharmacyUser) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs uppercase shadow-sm">
                        {getInitials(user)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{getDisplayName(user)}</p>
                        <p className="text-[11px] text-slate-400 font-medium">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-medical" />
                      <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter italic">
                        {user.role === 'admin' ? 'Administrateur' : 
                         user.role === 'manager' ? 'Gestionnaire' : 
                         user.role === 'pharmacist' ? 'Pharmacien' :
                         user.role}
                      </span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${user.is_active ? 'bg-success/10 text-success' : 'bg-slate-100 text-slate-400'}`}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => { 
                        if(window.confirm(`Êtes-vous sûr de vouloir supprimer ${getDisplayName(user)} ?`)) 
                          deleteMutation.mutate(user.id) 
                      }}
                      disabled={deleteMutation.isPending}
                      className="p-2 text-slate-300 hover:text-danger hover:bg-danger/5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && (
          <div className="p-20 text-center space-y-2">
            <p className="text-slate-400 font-bold text-sm italic uppercase tracking-widest">Aucun utilisateur trouvé</p>
          </div>
        )}
      </div>

      <UserModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateUser}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}