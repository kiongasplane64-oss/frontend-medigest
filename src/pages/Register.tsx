import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Mail, Lock, Phone, MapPin, 
  Building2, CheckCircle2, ArrowRight, ShieldCheck,
  AlertCircle, ChevronRight, Stethoscope, Calendar,
  Gift, Clock, Star, Users, Package, Store,
  Award, Sparkles, BadgeCheck
} from 'lucide-react';
import { authService } from '@/services/authService';

const PLANS = [
  { 
    id: 'starter', 
    name: 'Starter', 
    price: '5$', 
    features: ['2 Utilisateurs', '500 Produits', '1 Pharmacie'],
    popular: false,
    icon: Users
  },
  { 
    id: 'professional', 
    name: 'Professionnel', 
    price: '10$', 
    features: ['5 Utilisateurs', 'Illimité', '3 Pharmacies'],
    popular: true,
    icon: Package
  },
  { 
    id: 'enterprise', 
    name: 'Entreprise', 
    price: '15$', 
    features: ['Utilisateurs ∞', 'Multi-dépôts', 'Support 24/7'],
    popular: false,
    icon: Store
  },
];

const PHARMACY_TYPES = [
  { id: 'officine', label: 'Officine de ville' },
  { id: 'hospitaliere', label: 'Pharmacie Hospitalière' },
  { id: 'grossiste', label: 'Grossiste / Distributeur' },
  { id: 'depot', label: 'Dépôt Pharmaceutique' },
];

const TRIAL_DAYS = 14;

// Calcul automatique de la date de fin d'essai
const getTrialEndDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + TRIAL_DAYS);
  return date.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<any>(null);
  const [trialEndDate] = useState(getTrialEndDate());
  
  const [formData, setFormData] = useState({
    email: '', password: '', confirm_password: '',
    nom_complet: '', nom_pharmacie: '', ville: '',
    telephone: '', type_pharmacie: 'officine',
    pays: 'RDC', plan: 'professional', plan_name: 'Professional'
  });

  // Effet pour mettre à jour plan_name quand plan change
  useEffect(() => {
    const selectedPlan = PLANS.find(p => p.id === formData.plan);
    if (selectedPlan) {
      setFormData(prev => ({ ...prev, plan_name: selectedPlan.name }));
    }
  }, [formData.plan]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) return setStep(step + 1);
    
    setLoading(true);
    setConflict(null);

    try {
      await authService.register(formData);
      navigate(`/verify-otp?email=${encodeURIComponent(formData.email)}&phone=${encodeURIComponent(formData.telephone)}`);
    } catch (error: any) {
      const errorData = error.response?.data?.detail;
      
      if (errorData && typeof errorData === 'object') {
        setConflict(errorData);
        if (errorData.error === 'NAME_TAKEN' || errorData.error === 'PHONE_EXISTS') {
            setStep(2);
        } else if (errorData.error === 'EMAIL_EXISTS') {
            setStep(1);
        }
      } else {
        alert(errorData || "Erreur lors de l'inscription");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-5xl w-full grid md:grid-cols-12 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Sidebar améliorée avec offre d'essai */}
        <div className="md:col-span-4 bg-linear-to-br from-blue-600 to-indigo-700 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          {/* Éléments décoratifs */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full -ml-20 -mb-20"></div>
          
          <div>
            <div className="text-2xl font-bold tracking-tighter mb-8 flex items-center gap-2">
              <span className="bg-white/20 p-2 rounded-xl">💊</span>
              Medigest
            </div>
            
            {/* Bannière Essai Gratuit */}
            <div className="bg-linear-to-r from-yellow-400 to-orange-500 text-gray-900 p-4 rounded-xl mb-8 shadow-lg transform hover:scale-105 transition-transform">
              <div className="flex items-center gap-3">
                <div className="bg-white/30 p-2 rounded-full">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-black text-sm uppercase tracking-wider">Offre Spéciale</p>
                  <p className="text-xl font-black">{TRIAL_DAYS} JOURS GRATUITS</p>
                </div>
              </div>
              <div className="mt-2 text-xs opacity-90 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Valable jusqu'au {trialEndDate}</span>
              </div>
            </div>

            <div className="space-y-6 relative z-10">
              {[
                { 
                  s: 1, 
                  t: "Compte Admin", 
                  d: "Vos accès personnels",
                  icon: User
                },
                { 
                  s: 2, 
                  t: "Pharmacie", 
                  d: "Détails de l'établissement",
                  icon: Building2
                },
                { 
                  s: 3, 
                  t: "Plan & Essai", 
                  d: `${TRIAL_DAYS} jours gratuits`,
                  icon: Gift
                }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.s} className={`flex gap-4 items-center transition-all duration-300 ${
                    step === item.s ? 'opacity-100 scale-105' : 'opacity-50'
                  }`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                      step === item.s 
                        ? 'bg-white text-blue-600 border-white shadow-lg' 
                        : step > item.s 
                          ? 'bg-green-500 text-white border-green-500' 
                          : 'border-white/30'
                    }`}>
                      {step > item.s ? <CheckCircle2 size={18}/> : <Icon size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{item.t}</p>
                      <p className="text-[10px] uppercase tracking-wider font-medium text-blue-100">{item.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compteur d'avantages */}
            <div className="mt-8 space-y-3">
              {[
                'Aucun paiement requis',
                'Accès à toutes les fonctionnalités',
                'Support prioritaire inclus',
                'Annulation à tout moment'
              ].map((avantage, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-blue-100">
                  <BadgeCheck className="w-4 h-4 text-yellow-400" />
                  <span>{avantage}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 text-xs text-blue-100 font-medium leading-relaxed bg-white/10 p-3 rounded-xl backdrop-blur-sm">
            <ShieldCheck className="inline mr-2 mb-1" size={14} />
            Sécurité bancaire. Données chiffrées. Aucune carte requise pour l'essai.
          </div>
        </div>

        {/* Formulaire */}
        <div className="md:col-span-8 p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ÉTAPE 1 : ADMIN */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <User className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Créez votre accès admin</h2>
                    <p className="text-sm text-slate-500">Informations du compte principal</p>
                  </div>
                </div>
                
                {conflict?.error === 'EMAIL_EXISTS' && (
                  <div className="mb-6 p-4 bg-orange-50 border border-orange-100 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-orange-500 shrink-0" size={20} />
                    <div>
                      <p className="text-sm font-bold text-orange-800">{conflict.message}</p>
                      <Link to="/login" className="text-sm text-orange-700 underline flex items-center mt-1 font-medium">
                        Se connecter à ce compte <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  <div className="relative group">
                    <User className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      required 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" 
                      placeholder="Nom complet"
                      value={formData.nom_complet}
                      onChange={e => setFormData({...formData, nom_complet: e.target.value})}
                    />
                  </div>
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      required 
                      type="email"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        conflict?.error === 'EMAIL_EXISTS' ? 'border-orange-300' : 'border-slate-200'
                      }`}
                      placeholder="Email professionnel"
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        required 
                        type="password"
                        placeholder="Mot de passe"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        required 
                        type="password"
                        placeholder="Confirmer"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ÉTAPE 2 : PHARMACIE */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-blue-100 p-2 rounded-xl">
                    <Building2 className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800">Détails de l'établissement</h2>
                    <p className="text-sm text-slate-500">Informations de votre pharmacie</p>
                  </div>
                </div>
                
                {/* Suggestion Intelligente pour le Nom */}
                {conflict?.error === 'NAME_TAKEN' && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm font-bold text-blue-800 mb-2">{conflict.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {conflict.suggestions?.map((sugg: string) => (
                        <button 
                          key={sugg}
                          type="button"
                          onClick={() => {
                            setFormData({...formData, nom_pharmacie: sugg});
                            setConflict(null);
                          }}
                          className="text-[11px] bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          Utiliser : {sugg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  <div className="relative group">
                    <Building2 className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      required
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Nom de la pharmacie"
                      value={formData.nom_pharmacie}
                      onChange={e => setFormData({...formData, nom_pharmacie: e.target.value})}
                    />
                  </div>

                  <div className="relative group">
                    <Stethoscope className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <select 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
                      value={formData.type_pharmacie}
                      onChange={e => setFormData({...formData, type_pharmacie: e.target.value})}
                    >
                      {PHARMACY_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                      <MapPin className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        required
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Ville"
                        value={formData.ville}
                        onChange={e => setFormData({...formData, ville: e.target.value})}
                      />
                    </div>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        required
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                          conflict?.error === 'PHONE_EXISTS' ? 'border-orange-300' : 'border-slate-200'
                        }`}
                        placeholder="Téléphone (ex: 081...)"
                        value={formData.telephone}
                        onChange={e => setFormData({...formData, telephone: e.target.value})}
                      />
                    </div>
                  </div>
                  {conflict?.error === 'PHONE_EXISTS' && (
                    <p className="text-[11px] text-orange-600 font-medium">Ce numéro est déjà lié à un compte.</p>
                  )}
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : PLAN AVEC ESSAI GRATUIT MIS EN AVANT */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Bannière d'essai gratuit */}
                <div className="bg-linear-to-r from-green-500 to-emerald-600 text-white p-6 rounded-2xl mb-8 shadow-lg">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-3 rounded-full">
                        <Gift className="w-8 h-8" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black flex items-center gap-2">
                          <Sparkles className="w-5 h-5" />
                          {TRIAL_DAYS} JOURS D'ESSAI GRATUIT
                          <Sparkles className="w-5 h-5" />
                        </h3>
                        <p className="text-sm opacity-90 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          Valable jusqu'au {trialEndDate} • Aucune carte bancaire requise
                        </p>
                      </div>
                    </div>
                    <div className="bg-white/20 px-4 py-2 rounded-full text-sm font-bold">
                      Économisez 100%
                    </div>
                  </div>
                </div>

                <h2 className="text-2xl font-bold text-slate-800 mb-2">Choisissez votre plan</h2>
                <p className="text-sm text-slate-500 mb-6">
                  Testez gratuitement pendant {TRIAL_DAYS} jours. Changez de plan à tout moment.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {PLANS.map(p => {
                    const Icon = p.icon;
                    const isSelected = formData.plan === p.id;
                    
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => setFormData({...formData, plan: p.id, plan_name: p.name})}
                        className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col ${
                          isSelected 
                          ? 'border-blue-600 bg-blue-50/50 shadow-xl scale-105 z-10' 
                          : 'border-slate-100 hover:border-slate-200 hover:shadow-lg bg-white'
                        } ${p.popular ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}
                      >
                        {p.popular && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-linear-to-r from-yellow-400 to-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap">
                            <Star className="inline w-3 h-3 mr-1" />
                            Le plus populaire
                          </div>
                        )}
                        
                        {isSelected && (
                          <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1 shadow-lg">
                            <CheckCircle2 size={16} />
                          </div>
                        )}
                        
                        <div className="flex items-start justify-between mb-3">
                          <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-100' : 'bg-slate-100'}`}>
                            <Icon className={isSelected ? 'text-blue-600' : 'text-slate-600'} size={20} />
                          </div>
                          <div className="text-right">
                            <p className={`font-bold ${isSelected ? 'text-blue-700' : 'text-slate-800'}`}>
                              {p.name}
                            </p>
                            <p className="text-xl font-black text-slate-900">
                              {p.price}<span className="text-[10px] text-slate-400 font-normal">/mois</span>
                            </p>
                          </div>
                        </div>
                        
                        <ul className="space-y-2 mb-4 flex-1">
                          {p.features.map(f => (
                            <li key={f} className="flex items-start gap-2 text-[11px] text-slate-600">
                              <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>

                        {/* Badge Essai Gratuit */}
                        <div className="mt-auto pt-3 border-t border-dashed border-slate-200">
                          <div className="flex items-center justify-center gap-1 text-[10px] font-medium text-green-600 bg-green-50 py-2 rounded-lg">
                            <Gift size={12} />
                            <span>Essai gratuit {TRIAL_DAYS} jours inclus</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Résumé de l'essai */}
                <div className="mt-6 bg-linear-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Award className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900 mb-1">
                        Votre essai gratuit de {TRIAL_DAYS} jours
                      </p>
                      <p className="text-xs text-blue-700">
                        • Aucun paiement maintenant • Accès complet à toutes les fonctionnalités du plan choisi
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        • Rappel 3 jours avant la fin • Passage en paiement automatique si vous continuez
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <p className="text-[11px] text-slate-500 text-center">
                    Besoin d'une solution sur mesure pour une chaîne de plus de 10 pharmacies ? 
                    <span className="text-blue-600 font-bold cursor-pointer ml-1 hover:underline">Contactez notre équipe</span>
                  </p>
                </div>
              </div>
            )}
            
            <div className="pt-6 flex items-center justify-between border-t border-slate-100">
              {step > 1 ? (
                <button 
                  type="button" 
                  onClick={() => setStep(step - 1)} 
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                >
                  <ChevronRight className="rotate-180" size={16} />
                  Retour
                </button>
              ) : <div />}
              
              <button 
                type="submit" 
                disabled={loading}
                className="bg-linear-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Traitement...
                  </>
                ) : step === 3 ? (
                  <>
                    <Gift size={18} />
                    Activer mon essai gratuit ({TRIAL_DAYS} jours)
                  </>
                ) : (
                  <>
                    Continuer
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <p className="mt-8 text-sm text-slate-500">
        Déjà inscrit ? <Link to="/login" className="text-blue-600 font-bold hover:underline">Se connecter</Link>
      </p>
    </div>
  );
}