// AdminGenerateCodePage.tsx
import { useState } from 'react';
import { Copy } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/api/client';

interface GeneratedCode {
  code: string;
  plan_name: string;
  duration_days: number;
  price: number;
  currency: string;
  valid_until: string;
  success?: boolean;
}

export default function AdminGenerateCodePage() {
  const [planType, setPlanType] = useState('pro');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [durationDays, setDurationDays] = useState(30);
  const [price, setPrice] = useState(0);
  const [generatedCode, setGeneratedCode] = useState<GeneratedCode | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const plans = [
    { id: 'starter', name: 'Starter', price: 5 },
    { id: 'pro', name: 'Pro', price: 8 },
    { id: 'enterprise', name: 'Enterprise', price: 15 }
  ];

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/subscription-codes/admin/generate', {
        plan_type: planType,
        billing_cycle: billingCycle,
        duration_days: durationDays,
        price: price,
        notes: `Généré manuellement le ${new Date().toLocaleDateString('fr-FR')}`
      });
      
      setGeneratedCode(response.data);
      toast.success('Code généré avec succès !');
      
    } catch (error: any) {
      toast.error(error.response?.data?.detail?.message || 'Erreur lors de la génération');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Code copié dans le presse-papiers !');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 uppercase italic">
          Générer un code d'abonnement
        </h1>
        <p className="text-sm text-slate-500 mt-2">
          Créez des codes d'activation pour les paiements cash
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Formulaire */}
        <div className="bg-white rounded-4xl p-8 border border-slate-100 shadow-sm">
          <h2 className="text-lg font-black text-slate-800 uppercase mb-6">Paramètres du code</h2>
          
          <div className="space-y-6">
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
                  <option key={plan.id} value={plan.id}>{plan.name} ({plan.price} €/mois)</option>
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
                  Mensuel
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
                  Annuel (-20%)
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
                Prix (laisser 0 pour le prix par défaut)
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
                Nouveau
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
            </div>

            <div className="mt-6 p-4 bg-blue-500/30 rounded-2xl border border-white/20">
              <p className="text-xs text-center text-white/90">
                💡 Ce code peut être envoyé au client pour activer son abonnement
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}