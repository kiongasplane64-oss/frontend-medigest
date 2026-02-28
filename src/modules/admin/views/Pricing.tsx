import { useState } from 'react';
import { Check, Zap, Building2, Rocket, Loader2, ChevronRight } from 'lucide-react';
import { createCheckoutSession, PaymentProvider } from '@/services/paymentService';

export default function Pricing() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const plans = [
    {
      name: 'Starter',
      icon: <Rocket className="text-blue-500" />,
      monthlyPrice: 5,
      description: 'Pour les petites officines de quartier.',
      features: ['1 Utilisateur', 'Gestion de stock de base', 'Ventes POS', 'Rapports quotidiens'],
      limit: '1 Pharmacie',
      color: 'border-slate-100'
    },
    {
      name: 'Pro',
      icon: <Zap className="text-orange-500" />,
      monthlyPrice: 8,
      description: 'Le choix idéal pour une pharmacie en croissance.',
      features: ['5 Utilisateurs', 'Transferts inter-stocks', 'Gestion des dettes', 'PWA (Mode Offline)', 'Support Prioritaire'],
      limit: "Jusqu'à 3 Pharmacies",
      popular: true,
      color: 'border-blue-500'
    },
    {
      name: 'Entreprise',
      icon: <Building2 className="text-purple-500" />,
      monthlyPrice: 15,
      description: 'Pour les chaînes de pharmacies et groupements.',
      features: ['Utilisateurs illimités', 'Analytique avancée', 'API d\'inventaire', 'Audit Logs complets', 'Gestion multi-dépôts'],
      limit: 'Pharmacies illimitées',
      color: 'border-slate-100'
    }
  ];

  const calculateDisplayPrice = (monthlyPrice: number) => {
    // Si annuel : (Prix * 12 mois) * 0.8 (pour les 20% de réduction)
    return isAnnual ? (monthlyPrice * 12 * 0.8).toFixed(0) : monthlyPrice;
  };

  return (
    <div className="relative space-y-10 py-10">
      {/* 1. Header & Toggle */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-extrabold text-slate-900">Choisissez votre plan</h1>
        <div className="flex items-center justify-center gap-4 mt-8">
          <span className={`text-sm font-bold ${!isAnnual ? 'text-blue-600' : 'text-slate-400'}`}>Mensuel</span>
          <button 
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-14 h-7 bg-slate-200 rounded-full relative p-1 transition-colors"
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${isAnnual ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-bold ${isAnnual ? 'text-blue-600' : 'text-slate-400'}`}>
            Annuel <span className="ml-1 bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[10px] uppercase"> -20%</span>
          </span>
        </div>
      </div>

      {/* 2. Grille des Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto px-4">
        {plans.map((plan) => (
          <div key={plan.name} className={`relative bg-white rounded-3xl p-8 border-2 transition-all ${plan.popular ? 'border-blue-500 scale-105 shadow-xl' : 'border-slate-100 shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-slate-50 rounded-2xl">{plan.icon}</div>
              <h3 className="text-xl font-bold text-slate-800">{plan.name}</h3>
            </div>
            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-black text-slate-900">${calculateDisplayPrice(plan.monthlyPrice)}</span>
                <span className="text-slate-500 font-medium">{isAnnual ? '/an' : '/mois'}</span>
              </div>
            </div>
            <button 
              onClick={() => setSelectedPlan(plan)}
              className={`w-full py-4 rounded-2xl font-bold mb-8 transition-colors ${plan.popular ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Choisir ce plan
            </button>
            <ul className="space-y-4">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-slate-600">
                  <Check size={16} className="text-blue-500" /> {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* 3. Modal de Paiement */}
      {selectedPlan && (
        <PaymentModal 
          plan={selectedPlan} 
          isAnnual={isAnnual} 
          onClose={() => setSelectedPlan(null)} 
        />
      )}
    </div>
  );
}

function PaymentModal({ plan, isAnnual, onClose }: any) {
  const [loadingProvider, setLoadingProvider] = useState<PaymentProvider | null>(null);

  const handlePayment = async (provider: PaymentProvider) => {
    setLoadingProvider(provider);
    try {
      const session = await createCheckoutSession(plan.name, isAnnual ? 'yearly' : 'monthly', provider);
      window.location.href = session.checkout_url;
    } catch (err) {
      alert("Erreur d'initialisation du paiement.");
      setLoadingProvider(null);
    }
  };

  return (
    <div className="fixed inset-0 z-100 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-200">
        <h3 className="text-xl font-bold text-slate-800 mb-2">Méthode de paiement</h3>
        <p className="text-sm text-slate-500 mb-6">Paiement pour le plan <strong>{plan.name}</strong></p>

        <div className="space-y-3">
          <button 
            disabled={!!loadingProvider}
            onClick={() => handlePayment('stripe')}
            className="w-full flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:border-blue-500 transition-all group disabled:opacity-50"
          >
            <span className="font-bold text-slate-700">Carte Bancaire / Stripe</span>
            {loadingProvider === 'stripe' ? <Loader2 className="animate-spin" size={18}/> : <ChevronRight size={18}/>}
          </button>

          <button 
            disabled={!!loadingProvider}
            onClick={() => handlePayment('serdipay')}
            className="w-full flex items-center justify-between p-4 border border-slate-100 rounded-2xl hover:border-orange-500 transition-all group disabled:opacity-50"
          >
            <span className="font-bold text-slate-700">Mobile Money / Serdipay</span>
            {loadingProvider === 'serdipay' ? <Loader2 className="animate-spin" size={18}/> : <ChevronRight size={18}/>}
          </button>
        </div>

        <button onClick={onClose} className="w-full mt-6 text-slate-400 text-xs font-bold uppercase hover:text-slate-600">
          Annuler
        </button>
      </div>
    </div>
  );
}