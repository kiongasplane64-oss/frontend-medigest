// AdminGenerateCodePage.tsx
import { useState, useEffect } from 'react';
import { Copy, Building2, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/api/client';

interface Pharmacy {
  id: string;
  name: string;
  branch_name?: string;
  city?: string;
  is_active?: boolean;
}

interface GeneratedCode {
  code: string;
  plan_type: string;
  plan_name: string;
  duration_days: number;
  price: number;
  currency: string;
  valid_until: string;
  pharmacy_id?: string;
  pharmacy_name?: string;
  status?: string;
  success?: boolean;
}

export default function AdminGenerateCodePage() {
  const [planType, setPlanType] = useState('professional');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState(0);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Configuration des plans (synchronisée avec PLAN_CONFIG du backend)
  const plans = [
    { id: 'starter', name: 'Starter', price_monthly: 49.99, price_yearly: 479.99, max_branches: 1, max_users: 2, max_products: 500 },
    { id: 'professional', name: 'Professional', price_monthly: 89.99, price_yearly: 899.99, max_branches: 3, max_users: 10, max_products: 5000 },
    { id: 'enterprise', name: 'Enterprise', price_monthly: 149.99, price_yearly: 1499.99, max_branches: 0, max_users: 0, max_products: 0 }
  ];

  // Charger automatiquement les pharmacies au montage
  useEffect(() => {
    loadPharmacies();
  }, []);

  // Charger la liste des pharmacies (branches) - API CORRIGÉE
  const loadPharmacies = async (search: string = '') => {
    setIsLoadingPharmacies(true);
    try {
      // Utiliser l'API superadmin pour lister les pharmacies
      const response = await api.get('/super-admin/tenants', {
        params: { 
          page: 1, 
          limit: 100,
          search: search || undefined
        }
      });
      
      // Extraire les pharmacies de tous les tenants
      // Note: Si vous avez un endpoint direct /pharmacies/admin/list, utilisez-le
      // Sinon, cette approche fonctionne avec l'existant
      const tenants = response.data.tenants || [];
      let allPharmacies: Pharmacy[] = [];
      
      // Pour chaque tenant, récupérer ses pharmacies
      for (const tenant of tenants) {
        try {
          const pharmacyResponse = await api.get(`/super-admin/tenants/${tenant.id}`);
          const tenantPharmacies = pharmacyResponse.data.pharmacies || [];
          allPharmacies = [...allPharmacies, ...tenantPharmacies];
        } catch (err) {
          console.warn(`Erreur chargement pharmacies du tenant ${tenant.id}:`, err);
        }
      }
      
      setPharmacies(allPharmacies);
      if (allPharmacies.length > 0) {
        toast.success(`${allPharmacies.length} pharmacies chargées`);
      }
    } catch (error: any) {
      console.error('Erreur chargement pharmacies:', error);
      // Fallback: essayer l'endpoint direct si disponible
      try {
        const fallbackResponse = await api.get('/admin/pharmacies', {
          params: { limit: 100 }
        });
        setPharmacies(fallbackResponse.data.pharmacies || []);
      } catch (fallbackError) {
        toast.error('Impossible de charger la liste des pharmacies');
      }
    } finally {
      setIsLoadingPharmacies(false);
    }
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const selectedPlan = plans.find(p => p.id === planType);
      const defaultPrice = billingCycle === 'monthly' 
        ? selectedPlan?.price_monthly 
        : selectedPlan?.price_yearly;

      // Appel à l'API de génération de code (existe dans subscription_codes.py)
      const response = await api.post('/subscription-codes/admin/generate', {
        plan_type: planType,
        billing_cycle: billingCycle,
        duration_days: durationDays,
        price: price || defaultPrice,
        currency: 'EUR',
        pharmacy_id: selectedPharmacyId || null, // ✅ Lie le code à une branche spécifique
        notes: `Généré par admin le ${new Date().toLocaleDateString('fr-FR')} - ${billingCycle === 'monthly' ? 'Mensuel' : 'Annuel'}`,
        code_length: 8,
        expiry_days: 90  // Code valable 90 jours
      });
      
      setGeneratedCode(response.data);
      toast.success('Code généré avec succès !');
      
      // Réinitialiser la sélection de pharmacie
      setSelectedPharmacyId('');
      
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      if (detail?.error === 'invalid_plan') {
        toast.error(`Plan invalide. Plans disponibles: ${detail.message}`);
      } else if (detail?.error === 'pharmacy_not_found') {
        toast.error('La pharmacie spécifiée n\'existe pas');
      } else {
        toast.error(detail?.message || 'Erreur lors de la génération');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Code copié dans le presse-papiers !');
  };

  const getPlanPrice = () => {
    const plan = plans.find(p => p.id === planType);
    if (!plan) return 0;
    if (price > 0) return price;
    return billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
  };

  const getPlanFeatures = () => {
    const plan = plans.find(p => p.id === planType);
    if (!plan) return null;
    return plan;
  };

  const getDiscountPercentage = () => {
    const plan = plans.find(p => p.id === planType);
    if (!plan) return 0;
    const monthlyTotal = plan.price_monthly * 12;
    const yearlyPrice = plan.price_yearly;
    return Math.round(((monthlyTotal - yearlyPrice) / monthlyTotal) * 100);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 uppercase italic">
          Générer un code d'abonnement
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Créez des codes d'activation pour les branches/pharmacies (paiement cash)
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Formulaire */}
        <div className="bg-white rounded-4xl p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-black text-slate-800 uppercase mb-6">Paramètres du code</h2>
          
          <div className="space-y-6">
            {/* Sélection du plan */}
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
                  </option>
                ))}
              </select>
              {getPlanFeatures() && (
                <div className="mt-2 text-xs text-slate-500 flex gap-4 flex-wrap">
                  <span>🏢 Max {getPlanFeatures()?.max_branches === 0 ? 'Illimité' : getPlanFeatures()?.max_branches} branches</span>
                  <span>👥 Max {getPlanFeatures()?.max_users === 0 ? 'Illimité' : getPlanFeatures()?.max_users} utilisateurs</span>
                  <span>📦 Max {getPlanFeatures()?.max_products === 0 ? 'Illimité' : getPlanFeatures()?.max_products} produits</span>
                </div>
              )}
            </div>

            {/* Cycle de facturation */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Cycle de facturation
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setBillingCycle('monthly');
                    setDurationDays(30);
                  }}
                  className={`p-4 rounded-2xl font-bold transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Mensuel (30j)
                  <span className="block text-xs opacity-80 mt-1">
                    {getPlanPrice()}€
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBillingCycle('yearly');
                    setDurationDays(365);
                  }}
                  className={`p-4 rounded-2xl font-bold transition-all ${
                    billingCycle === 'yearly'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Annuel (365j)
                  <span className="block text-xs opacity-80 mt-1">
                    {getPlanPrice()}€ (économisez {getDiscountPercentage()}%)
                  </span>
                </button>
              </div>
            </div>

            {/* Durée personnalisée */}
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
                {durationDays} jours = {Math.floor(durationDays / 30)} mois, {Math.floor(durationDays / 365)} an(s)
              </p>
            </div>

            {/* Prix personnalisé */}
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

            {/* Affectation à une branche spécifique */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-2">
                <Building2 size={12} className="inline mr-1" />
                Affecter à une branche (optionnel)
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <select
                    value={selectedPharmacyId}
                    onChange={(e) => setSelectedPharmacyId(e.target.value)}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all disabled:bg-slate-100 disabled:cursor-not-allowed"
                    disabled={isLoadingPharmacies}
                  >
                    <option value="">-- Code générique (toutes branches) --</option>
                    {pharmacies.map(pharmacy => (
                      <option key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.branch_name ? `${pharmacy.name} (${pharmacy.branch_name})` : pharmacy.name}
                        {pharmacy.city && ` - ${pharmacy.city}`}
                      </option>
                    ))}
                  </select>
                  {isLoadingPharmacies && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => loadPharmacies()}
                  disabled={isLoadingPharmacies}
                  className="px-4 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Rafraîchir la liste"
                >
                  <RefreshCw size={20} className={isLoadingPharmacies ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {selectedPharmacyId 
                  ? "🔒 Ce code sera valable UNIQUEMENT pour cette branche" 
                  : "🌍 Ce code pourra être utilisé par N'IMPORTE QUELLE branche"}
              </p>
              {!isLoadingPharmacies && pharmacies.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Aucune pharmacie chargée. Cliquez sur le bouton rafraîchir pour charger la liste.
                </p>
              )}
            </div>

            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-800 transition-all disabled:bg-slate-300 disabled:cursor-not-allowed shadow-xl active:scale-95"
            >
              {isLoading ? (
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
                {generatedCode.pharmacy_id ? 'Lié à une branche' : 'Générique'}
              </span>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 mb-6 border border-white/20">
              <div className="text-center">
                <div className="text-5xl font-mono font-black tracking-wider mb-4 select-all">
                  {generatedCode.code}
                </div>
                <button
                  onClick={() => copyToClipboard(generatedCode.code)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 rounded-xl hover:bg-white/30 transition-all font-bold text-sm"
                >
                  <Copy size={16} />
                  Copier le code
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
              <div className="flex justify-between items-center pb-2 border-b border-white/20">
                <span className="text-white/70 text-sm">Valide jusqu'au</span>
                <span className="font-bold">
                  {new Date(generatedCode.valid_until).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </span>
              </div>
              {generatedCode.pharmacy_name && (
                <div className="flex justify-between items-center">
                  <span className="text-white/70 text-sm">Branche affectée</span>
                  <span className="font-bold flex items-center gap-1">
                    <Building2 size={14} />
                    {generatedCode.pharmacy_name}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 p-4 bg-blue-500/30 rounded-2xl border border-white/20">
              <p className="text-xs text-center text-white/90">
                {generatedCode.pharmacy_id 
                  ? "🔒 Code réservé à une branche spécifique - Le client devra avoir cette branche active"
                  : "🌍 Code générique - Peut être utilisé par n'importe quelle branche"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section d'information */}
      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-2xl p-6">
        <h3 className="font-bold text-amber-800 mb-2">📌 Comment ça fonctionne ?</h3>
        <ul className="text-sm text-amber-700 space-y-1">
          <li>• Chaque code d'abonnement est lié à une <strong>branche/pharmacie</strong> (pas à un utilisateur)</li>
          <li>• Code <strong>générique</strong> = peut être utilisé par n'importe quelle branche</li>
          <li>• Code <strong>spécifique</strong> = ne fonctionne que pour la branche sélectionnée</li>
          <li>• Une fois activé, l'abonnement est attaché à la branche et tous ses utilisateurs en bénéficient</li>
          <li>• Les codes expirent automatiquement après 90 jours si non utilisés</li>
        </ul>
      </div>
    </div>
  );
}