// sections/GenerateCodeSection.tsx
import { useState, useEffect } from 'react';
import { Copy, Check, Search, Building2, Users, RefreshCw, X } from 'lucide-react';
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
  tenant_id?: string;
  user_id?: string;
}

interface Tenant {
  id: string;
  name: string;
  nom_pharmacie?: string;
  email: string;
  email_admin?: string;
  tenant_code: string;
  status: string;
  current_plan?: string;
}

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  tenant_id?: string;
  tenant_name?: string;
  role: string;
  is_active: boolean;
}

const plans = [
  { id: 'starter', name: 'Starter', price_monthly: 5, price_yearly: 50, features: ['Basic features', 'Email support'] },
  { id: 'pro', name: 'Pro', price_monthly: 8, price_yearly: 80, features: ['Advanced features', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price_monthly: 15, price_yearly: 150, features: ['All features', 'Dedicated support'] }
];

export default function GenerateCodeSection() {
  const queryClient = useQueryClient();
  
  // Form states
  const [planType, setPlanType] = useState('pro');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState(0);
  const [notes, setNotes] = useState('');
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Tenant/User selection states
  const [selectionType, setSelectionType] = useState<'tenant' | 'user'>('tenant');
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
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

  // Query tenants
  const { 
    data: tenantsData, 
    isLoading: isLoadingTenants, 
    error: tenantsError,
    refetch: refetchTenants 
  } = useQuery({
    queryKey: ['superadmin-tenants-list', debouncedSearchTerm],
    queryFn: async () => {
      const { data } = await api.get('/super-admin/tenants', {
        params: {
          page: 1,
          limit: 100,
          search: debouncedSearchTerm || undefined,
          status_filter: 'active,trial',
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      });
      return data;
    },
    enabled: selectionType === 'tenant',
    staleTime: 30000, // 30 seconds
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
      const { data } = await api.get('/super-admin/users', {
        params: {
          page: 1,
          limit: 100,
          search: debouncedSearchTerm || undefined,
          role: 'user,admin',
          is_active: true,
          sort_by: 'created_at',
          sort_order: 'desc'
        }
      });
      return data;
    },
    enabled: selectionType === 'user',
    staleTime: 30000,
  });

  // Mutation pour générer le code
  const generateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.post('/subscription-codes/admin/generate', payload);
      return data;
    },
    onSuccess: (data) => {
      setGeneratedCode(data);
      toast.success('Code généré avec succès !');
      
      // Reset selection after successful generation (optional)
      // setSelectedTenantId('');
      // setSelectedUserId('');
      // setNotes('');
      
      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ['superadmin-subscription-codes'] });
    },
    onError: (error: any) => {
      console.error('Generation error:', error);
      const errorMessage = error.response?.data?.detail?.message || error.response?.data?.detail || 'Erreur lors de la génération';
      toast.error(errorMessage);
    }
  });

  // Extract tenants from response
  const tenants: Tenant[] = tenantsData?.tenants || [];
  const users: User[] = usersData?.users || [];

  // Get selected tenant details
  const selectedTenant = tenants.find(t => t.id === selectedTenantId);
  const selectedUser = users.find(u => u.id === selectedUserId);

  const handleGenerate = () => {
    if (selectionType === 'tenant' && !selectedTenantId) {
      toast.error('Veuillez sélectionner une pharmacie');
      return;
    }
    if (selectionType === 'user' && !selectedUserId) {
      toast.error('Veuillez sélectionner un utilisateur');
      return;
    }

    const payload: any = {
      plan_type: planType,
      billing_cycle: billingCycle,
      duration_days: durationDays,
      price: price > 0 ? price : undefined,
      notes: notes.trim() || `Généré le ${new Date().toLocaleDateString('fr-FR')}`
    };

    // Add tenant or user context
    if (selectionType === 'tenant') {
      payload.tenant_id = selectedTenantId;
    } else {
      payload.user_id = selectedUserId;
    }

    generateMutation.mutate(payload);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Code copié dans le presse-papiers !');
    setTimeout(() => setCopied(false), 2000);
  };

  const getPlanPrice = () => {
    const plan = plans.find(p => p.id === planType);
    if (!plan) return 0;
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
  };

  const getSelectedEntityInfo = () => {
    if (selectionType === 'tenant' && selectedTenant) {
      return {
        name: selectedTenant.name || selectedTenant.nom_pharmacie || 'Pharmacie',
        email: selectedTenant.email || selectedTenant.email_admin,
        code: selectedTenant.tenant_code,
        type: 'pharmacie'
      };
    } else if (selectionType === 'user' && selectedUser) {
      return {
        name: selectedUser.full_name || `${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || 'Utilisateur',
        email: selectedUser.email,
        tenant: selectedUser.tenant_name,
        type: 'utilisateur'
      };
    }
    return null;
  };

  const handleRefresh = () => {
    if (selectionType === 'tenant') {
      refetchTenants();
    } else {
      refetchUsers();
    }
    toast.success('Liste actualisée');
  };

  const handleClearSelection = () => {
    setSelectedTenantId('');
    setSelectedUserId('');
  };

  const selectedInfo = getSelectedEntityInfo();
  const isLoading = selectionType === 'tenant' ? isLoadingTenants : isLoadingUsers;
  const error = selectionType === 'tenant' ? tenantsError : usersError;
  const items = selectionType === 'tenant' ? tenants : users;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 uppercase italic">
          Générer un code d'abonnement
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Créez des codes d'activation pour les paiements cash et associez-les à une pharmacie ou un utilisateur
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulaire */}
        <div className="bg-white rounded-4xl p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-black text-slate-800 uppercase mb-6">Paramètres du code</h2>
          
          <div className="space-y-6">
            {/* Tenant/User Selection Type */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Générer pour
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('tenant');
                    setSelectedTenantId('');
                    setSelectedUserId('');
                    setSearchTerm('');
                  }}
                  className={`p-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                    selectionType === 'tenant'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Building2 size={18} />
                  Une pharmacie
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionType('user');
                    setSelectedTenantId('');
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
                  {selectionType === 'tenant' ? 'Sélectionner une pharmacie' : 'Sélectionner un utilisateur'}
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
                    placeholder={selectionType === 'tenant' ? "Rechercher par nom, code ou email..." : "Rechercher par nom, email..."}
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
                    {searchTerm ? 'Aucun résultat trouvé' : `Aucun ${selectionType === 'tenant' ? 'tenant' : 'utilisateur'} disponible`}
                  </p>
                </div>
              ) : (
                <select
                  value={selectionType === 'tenant' ? selectedTenantId : selectedUserId}
                  onChange={(e) => {
                    if (selectionType === 'tenant') {
                      setSelectedTenantId(e.target.value);
                    } else {
                      setSelectedUserId(e.target.value);
                    }
                  }}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
                >
                  <option value="">-- Choisir {selectionType === 'tenant' ? 'une pharmacie' : 'un utilisateur'} --</option>
                  {items.map((item: any) => {
                    if (selectionType === 'tenant') {
                      const tenant = item as Tenant;
                      return (
                        <option key={tenant.id} value={tenant.id}>
                          {tenant.name || tenant.nom_pharmacie} - {tenant.tenant_code} ({tenant.email || tenant.email_admin})
                        </option>
                      );
                    } else {
                      const user = item as User;
                      const userName = user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
                      return (
                        <option key={user.id} value={user.id}>
                          {userName} - {user.email} {user.tenant_name ? `(${user.tenant_name})` : ''}
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
                    {selectedInfo.type === 'pharmacie' && (selectedInfo as any).code && (
                      <p className="text-xs text-blue-500 mt-0.5">Code: {(selectedInfo as any).code}</p>
                    )}
                    {selectedInfo.type === 'utilisateur' && (selectedInfo as any).tenant && (
                      <p className="text-xs text-blue-500 mt-0.5">Pharmacie: {(selectedInfo as any).tenant}</p>
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
                Plan
              </label>
              <select
                id="plan-select"
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              >
                {plans.map(plan => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} ({plan.price_monthly} €/mois ou {plan.price_yearly} €/an)
                  </option>
                ))}
              </select>
            </div>

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
                  Mensuel ({getPlanPrice()} €)
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
                  Annuel ({getPlanPrice()} €)
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="duration-days" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Durée de l'abonnement (jours)
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
              </p>
            </div>

            <div>
              <label htmlFor="price" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Prix personnalisé (laisser 0 pour le prix par défaut)
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

            <button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || (!selectedTenantId && !selectedUserId)}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xl active:scale-95"
            >
              {generateMutation.isPending ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Génération en cours...
                </div>
              ) : (
                'Générer le code'
              )}
            </button>
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
                <button
                  onClick={() => copyToClipboard(generatedCode.code)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all font-bold text-sm"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copié !' : 'Copier le code'}
                </button>
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
                💡 Ce code peut être envoyé au client pour activer son abonnement dans l'espace dédié
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}