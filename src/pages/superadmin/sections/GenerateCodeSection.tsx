// sections/GenerateCodeSection.tsx
import { useState, useEffect } from 'react';
import { Search, Users, RefreshCw, X, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';

interface GeneratedCode {
  code: string;
  plan_type: string;
  plan_name: string;
  duration_days: number;
  price: number;
  currency: string;
  valid_until: string;
  created_at: string;
  status: string;
  pharmacy_id?: string;
  pharmacy_name?: string;
}

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  code: string;
  is_active: boolean;
  is_main_branch: boolean;
  tenant_id?: string;
  parent_pharmacy_id?: string;
  parent_pharmacy_name?: string;
}

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  pharmacy_id?: string;
  pharmacy_name?: string;
  role: string;
  is_active: boolean;
}

// Configuration des plans (harmonisée avec le backend)
const plans = [
  { 
    id: 'starter', 
    name: 'Starter', 
    price_monthly: 5, 
    price_yearly: 48, 
    duration_days: 30,
    max_products: 1500,
    max_users: 5,
    features: ['5 Utilisateurs', '1500 Produits', 'Support email'] 
  },
  { 
    id: 'professional', 
    name: 'Professionnel', 
    price_monthly: 8, 
    price_yearly: 76.8, 
    duration_days: 30,
    max_products: 3000,
    max_users: 20,
    features: ['20 Utilisateurs', '3000 Produits', 'Transferts inter-stocks', 'Support prioritaire'] 
  },
  { 
    id: 'enterprise', 
    name: 'Entreprise', 
    price_monthly: 15, 
    price_yearly: 144, 
    duration_days: 30,
    max_products: 10000,
    max_users: 20,
    features: ['20 Utilisateurs', '10000 Produits', 'API d\'inventaire', 'Support 24/7'] 
  },
  { 
    id: 'infinite', 
    name: 'Infinite', 
    price_monthly: 30, 
    price_yearly: 288, 
    duration_days: 30,
    max_products: 0,
    max_users: 0,
    features: ['Utilisateurs illimités', 'Produits illimités', 'Multi-dépôts', 'Support dédié'] 
  }
];

export default function GenerateCodeSection() {
  const queryClient = useQueryClient();
  
  // Form states
  const [planType, setPlanType] = useState('professional');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  
  // Branch/User selection states
  const [selectionType, setSelectionType] = useState<'branch' | 'user'>('branch');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Query branches (succursales)
  const { 
    data: branchesData, 
    isLoading: isLoadingBranches, 
    error: branchesError,
    refetch: refetchBranches 
  } = useQuery({
    queryKey: ['superadmin-branches-list', debouncedSearchTerm],
    queryFn: async () => {
      const { data } = await api.get('/branches', {
        params: {
          page: 1,
          limit: 100,
          search: debouncedSearchTerm || undefined,
          is_active: true,
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      });
      return data;
    },
    enabled: selectionType === 'branch',
    staleTime: 30000,
  });

  // Query users
  const { 
    data: usersData, 
    isLoading: isLoadingUsers, 
    error: usersError,
    refetch: refetchUsers 
  } = useQuery({
    queryKey: ['superadmin-users-list', debouncedSearchTerm],
    queryFn: async () => {
      const { data } = await api.get('/users', {
        params: {
          page: 1,
          limit: 100,
          search: debouncedSearchTerm || undefined,
          is_active: true,
          role: 'admin,user',
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      });
      return data;
    },
    enabled: selectionType === 'user',
    staleTime: 30000,
  });

  // Mutation pour générer le code d'abonnement
  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/subscription-codes/admin/generate', payload);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedCode(data);
      toast.success('Code généré avec succès !');
      queryClient.invalidateQueries({ queryKey: ['superadmin-subscription-codes'] });
    },
    onError: (error: any) => {
      console.error('Generation error:', error);
      const errorMessage = error.response?.data?.detail?.message || error.response?.data?.detail || 'Erreur lors de la génération';
      toast.error(errorMessage);
    }
  });

  const branches: Branch[] = branchesData?.branches || branchesData?.items || [];
  const users: User[] = usersData?.users || usersData?.items || [];

  const selectedBranch = branches.find(b => b.id === selectedBranchId);
  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleGenerate = () => {
    if (selectionType === 'branch' && !selectedBranchId) {
      toast.error('Veuillez sélectionner une succursale/branche');
      return;
    }
    if (selectionType === 'user' && !selectedUserId) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    let finalDurationDays = durationDays;
    if (billingCycle === 'yearly') {
      finalDurationDays = 365;
    } else if (billingCycle === 'monthly' && durationDays === 30) {
      finalDurationDays = 30;
    }

    const payload: any = {
      plan_type: planType,
      duration_days: finalDurationDays,
      billing_cycle: billingCycle,
      price: price > 0 ? price : undefined,
      notes: notes.trim() || `Généré le ${new Date().toLocaleDateString('fr-FR')}`
    };

    if (selectionType === 'branch') {
      payload.pharmacy_id = selectedBranchId;
    } else if (selectionType === 'user' && selectedUser?.pharmacy_id) {
      payload.pharmacy_id = selectedUser.pharmacy_id;
    }

    generateMutation.mutate(payload);
  };

  const getPlanDefaultDuration = () => {
    const plan = plans.find(p => p.id === planType);
    return plan?.duration_days || 30;
  };

  useEffect(() => {
    if (billingCycle === 'monthly') {
      setDurationDays(getPlanDefaultDuration());
    } else {
      setDurationDays(365);
    }
  }, [planType, billingCycle]);

  const getSelectedEntityInfo = () => {
    if (selectionType === 'branch' && selectedBranch) {
      return {
        name: selectedBranch.name,
        email: selectedBranch.email,
        code: selectedBranch.code,
        city: selectedBranch.city,
        type: 'branche',
        is_main: selectedBranch.is_main_branch
      };
    } else if (selectionType === 'user' && selectedUser) {
      return {
        name: selectedUser.full_name || selectedUser.email,
        email: selectedUser.email,
        pharmacy: selectedUser.pharmacy_name,
        type: 'utilisateur'
      };
    }
    return null;
  };

  const handleRefresh = () => {
    if (selectionType === 'branch') {
      refetchBranches();
    } else {
      refetchUsers();
    }
    toast.success('Liste actualisée');
  };

  const handleClearSelection = () => {
    setSelectedBranchId('');
    setSelectedUserId('');
  };

  const selectedInfo = getSelectedEntityInfo();
  const isLoading = selectionType === 'branch' ? isLoadingBranches : isLoadingUsers;
  const error = selectionType === 'branch' ? branchesError : usersError;
  const items = selectionType === 'branch' ? branches : users;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 uppercase italic">
          Générer un code d'abonnement
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Créez des codes d'activation pour les paiements cash. L'abonnement est lié à une succursale/branche.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulaire */}
        <div className="bg-white rounded-4xl p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-black text-slate-800 uppercase mb-6">Paramètres du code</h2>
          
          <div className="space-y-6">
            {/* Branch/User Selection Type */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Générer pour
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('branch');
                    setSelectedBranchId('');
                    setSelectedUserId('');
                    setSearchTerm('');
                  }}
                  className={`p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                    selectionType === 'branch'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Store size={18} />
                  Une succursale/branche
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('user');
                    setSelectedBranchId('');
                    setSelectedUserId('');
                    setSearchTerm('');
                  }}
                  className={`p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                    selectionType === 'user'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Users size={18} />
                  Un utilisateur
                </button>
              </div>
            </div>

            {/* Search and Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-600 uppercase">
                  {selectionType === 'branch' ? 'Sélectionner une succursale/branche' : 'Sélectionner un utilisateur'}
                </label>
                <button
                  onClick={handleRefresh}
                  className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
                >
                  <RefreshCw size={12} />
                  Actualiser
                </button>
              </div>
              
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder={selectionType === 'branch' ? "Rechercher par nom, code ou email..." : "Rechercher par nom, email..."}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                  />
                </div>
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="px-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all"
                  >
                    <X size={18} className="text-slate-500" />
                  </button>
                )}
              </div>
              
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Chargement...</p>
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 rounded-2xl text-center">
                  <p className="text-xs text-red-600">Erreur de chargement</p>
                  <button onClick={handleRefresh} className="text-xs text-red-500 underline mt-1">
                    Réessayer
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 bg-slate-50 rounded-2xl text-center">
                  <p className="text-sm text-slate-500">
                    {searchTerm ? 'Aucun résultat trouvé' : `Aucun ${selectionType === 'branch' ? 'succursale' : 'utilisateur'} disponible`}
                  </p>
                </div>
              ) : (
                <select
                  value={selectionType === 'branch' ? selectedBranchId : selectedUserId}
                  onChange={(e) => {
                    if (selectionType === 'branch') {
                      setSelectedBranchId(e.target.value);
                    } else {
                      setSelectedUserId(e.target.value);
                    }
                  }}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                >
                  <option value="">-- Choisir {selectionType === 'branch' ? 'une succursale' : 'un utilisateur'} --</option>
                  {items.map((item: any) => {
                    if (selectionType === 'branch') {
                      const branch = item as Branch;
                      return (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} {branch.is_main_branch && '(Principale)'} - {branch.code} ({branch.city || 'Ville inconnue'})
                        </option>
                      );
                    } else {
                      const user = item as User;
                      const userName = user.full_name || user.email;
                      return (
                        <option key={user.id} value={user.id}>
                          {userName} - {user.email} {user.pharmacy_name ? `(${user.pharmacy_name})` : ''}
                        </option>
                      );
                    }
                  })}
                </select>
              )}
            </div>

            {/* Selected Entity Display */}
            {selectedInfo && (
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-bold text-blue-700 uppercase mb-1">Destinataire</p>
                    <p className="text-sm font-medium text-blue-900">{selectedInfo.name}</p>
                    <p className="text-xs text-blue-600 mt-0.5">{selectedInfo.email}</p>
                    {selectedInfo.type === 'branche' && (
                      <>
                        <p className="text-xs text-blue-500 mt-0.5">Code: {selectedInfo.code}</p>
                        {selectedInfo.city && <p className="text-xs text-blue-500">Ville: {selectedInfo.city}</p>}
                        {selectedInfo.is_main && <p className="text-xs text-green-600 mt-0.5">✓ Succursale principale</p>}
                      </>
                    )}
                    {selectedInfo.type === 'utilisateur' && selectedInfo.pharmacy && (
                      <p className="text-xs text-blue-500 mt-0.5">Succursale: {selectedInfo.pharmacy}</p>
                    )}
                  </div>
                  <button
                    onClick={handleClearSelection}
                    className="p-1 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <X size={14} className="text-blue-600" />
                  </button>
                </div>
              </div>
            )}

            <div className="border-t border-slate-200 my-4"></div>

            {/* Plan Selection */}
            <div>
              <label htmlFor="plan-select" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Plan d'abonnement
              </label>
              <select
                id="plan-select"
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              >
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} - {plan.price_monthly}€/mois ou {plan.price_yearly}€/an
                    {plan.max_products === 0 ? ' (Produits illimités)' : ` (${plan.max_products} produits max)`}
                  </option>
                ))}
              </select>
            </div>

            {/* Billing Cycle */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Cycle de facturation
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setBillingCycle('monthly')}
                  className={`p-4 rounded-2xl font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mensuel ({plans.find(p => p.id === planType)?.price_monthly || 0} €)
                  <span className="block text-[10px] opacity-80 mt-1">30 jours</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBillingCycle('yearly')}
                  className={`p-4 rounded-2xl font-bold transition-all ${
                    billingCycle === 'yearly'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Annuel ({plans.find(p => p.id === planType)?.price_yearly || 0} €)
                  <span className="block text-[10px] opacity-80 mt-1">365 jours</span>
                </button>
              </div>
            </div>

            {/* Duration Days */}
            <div>
              <label htmlFor="duration-days" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Durée personnalisée (jours)
              </label>
              <input
                id="duration-days"
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                min="1"
                max="3650"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
              <p className="text-xs text-slate-400 mt-1">
                {durationDays} jours = {Math.floor(durationDays / 30)} mois
                {billingCycle === 'yearly' && durationDays !== 365 && (
                  <span className="text-amber-600 ml-2">⚠️ Cycle annuel recommandé: 365 jours</span>
                )}
              </p>
            </div>

            {/* Custom Price */}
            <div>
              <label htmlFor="price" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Prix personnalisé (0 = prix par défaut)
              </label>
              <div className="relative">
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  min="0"
                  step="0.01"
                  className="w-full p-4 pl-8 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Notes (optionnel)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ajouter des notes sur ce code (client, contexte, etc.)"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || (!selectedBranchId && !selectedUserId)}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xl active:scale-95"
            >
              {generateMutation.isPending ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Génération en cours...
                </div>
              ) : (
                'Générer le code d\'abonnement'
              )}
            </button>

            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200">
              <p className="text-xs text-amber-700">
                ℹ️ L'abonnement sera lié à la succursale/branche sélectionnée. 
                L'utilisateur qui active le code devra avoir cette succursale comme branche active.
              </p>
            </div>
          </div>
        </div>

        {/* Résultat */}
        {generatedCode && (
          <div className="bg-linear-to-br from-blue-600 to-blue-800 rounded-4xl p-8 text-white shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-start mb-6">
              <h2 className="font-black text-lg uppercase tracking-widest">Code généré</h2>
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                {generatedCode.status}
              </span>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 mb-6 border border-white/20">
              <div className="text-center">
                <div className="text-5xl font-mono font-black tracking-wider mb-4 select-all break-all">
                  {generatedCode.code}
                </div>
              </div>
            </div>

            <div className="space-y-4 bg-white/5 rounded-3xl p-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/20">
                <span className="text-white/70 text-sm">Plan</span>
                <span className="font-bold text-lg">{generatedCode.plan_name}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/20">
                <span className="text-white/70 text-sm">Durée</span>
                <span className="font-bold">{generatedCode.duration_days} jours</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/20">
                <span className="text-white/70 text-sm">Prix</span>
                <span className="font-bold text-xl">{generatedCode.price} {generatedCode.currency}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-white/20">
                <span className="text-white/70 text-sm">Succursale</span>
                <span className="font-bold text-right break-all text-sm">
                  {generatedCode.pharmacy_name || generatedCode.pharmacy_id || 'Générique'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-white/70 text-sm">Valide jusqu'au</span>
                <span className="font-bold">
                  {new Date(generatedCode.valid_until).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
              {generatedCode.created_at && (
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Généré le</span>
                  <span className="text-sm">
                    {new Date(generatedCode.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-blue-500/30 rounded-2xl border border-white/20">
              <p className="text-xs text-center text-white/90">
                💡 Ce code peut être envoyé au client. Il devra l'activer depuis son espace 
                avec sa succursale active sélectionnée.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}