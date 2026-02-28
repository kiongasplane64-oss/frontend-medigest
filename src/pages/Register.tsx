import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Mail, Lock, Phone, MapPin, 
  Building2, CheckCircle2, ArrowRight, ShieldCheck,
  AlertCircle, ChevronRight, Stethoscope
} from 'lucide-react';
import { authService } from '@/services/authService';

const PLANS = [
  { 
    id: 'starter', 
    name: 'Starter', 
    price: '5$', 
    features: ['2 Utilisateurs', '500 Produits', '1 Pharmacie'] 
  },
  { 
    id: 'professional', 
    name: 'Professionnel', 
    price: '10$', 
    features: ['5 Utilisateurs', 'Illimité', '3 Pharmacies'] 
  },
  { 
    id: 'enterprise', 
    name: 'Entreprise', 
    price: '15$', 
    features: ['Utilisateurs ∞', 'Multi-dépôts', 'Support 24/7'] 
  },
];

const PHARMACY_TYPES = [
  { id: 'officine', label: 'Officine de ville' },
  { id: 'hospitaliere', label: 'Pharmacie Hospitalière' },
  { id: 'grossiste', label: 'Grossiste / Distributeur' },
  { id: 'depot', label: 'Dépôt Pharmaceutique' },
];

export default function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [conflict, setConflict] = useState<any>(null); // Pour gérer les suggestions du backend
  
  const [formData, setFormData] = useState({
    email: '', password: '', confirm_password: '',
    nom_complet: '', nom_pharmacie: '', ville: '',
    telephone: '', type_pharmacie: 'officine',
    pays: 'RDC', plan: 'professional', plan_name: 'Professional'
  });

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
      
      // Si le backend renvoie un conflit intelligent (EMAIL_EXISTS, NAME_TAKEN, etc.)
      if (errorData && typeof errorData === 'object') {
        setConflict(errorData);
        // Si c'est un problème de nom ou de téléphone, on retourne à l'étape 2
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-4xl w-full grid md:grid-cols-12 bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100">
        
        {/* Sidebar Info */}
        <div className="md:col-span-4 bg-blue-600 p-8 text-white flex flex-col justify-between">
          <div>
            <div className="text-2xl font-bold tracking-tighter mb-8">Medigest</div>
            <div className="space-y-6">
              {[
                { s: 1, t: "Compte Admin", d: "Vos accès personnels" },
                { s: 2, t: "Pharmacie", d: "Détails de l'établissement" },
                { s: 3, t: "Plan", d: "Sélection de l'offre" }
              ].map((item) => (
                <div key={item.s} className={`flex gap-4 items-center ${step === item.s ? 'opacity-100' : 'opacity-50'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === item.s ? 'bg-white text-blue-600' : 'border-white/30'}`}>
                    {step > item.s ? <CheckCircle2 size={16}/> : item.s}
                  </div>
                  <div>
                    <p className="text-sm font-bold">{item.t}</p>
                    <p className="text-[10px] uppercase tracking-wider font-medium text-blue-100">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-xs text-blue-100 font-medium leading-relaxed">
            <ShieldCheck className="inline mr-2 mb-1" size={14} />
            Sécurité bancaire. Données chiffrées.
          </div>
        </div>

        {/* Formulaire */}
        <div className="md:col-span-8 p-8 md:p-12">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* ETAPE 1 : ADMIN */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Créez votre accès admin</h2>
                
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
                  <div className="relative">
                    <User className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input required className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" 
                           placeholder="Nom complet" value={formData.nom_complet} onChange={e => setFormData({...formData, nom_complet: e.target.value})} />
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input required type="email" className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 ${conflict?.error === 'EMAIL_EXISTS' ? 'border-orange-300' : 'border-slate-200'}`} 
                           placeholder="Email professionnel" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input required type="password" placeholder="Mot de passe" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" 
                             onChange={e => setFormData({...formData, password: e.target.value})} />
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input required type="password" placeholder="Confirmer" className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" 
                             onChange={e => setFormData({...formData, confirm_password: e.target.value})} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ETAPE 2 : PHARMACIE */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Détails de l'établissement</h2>
                
                {/* Suggestion Intelligente pour le Nom */}
                {conflict?.error === 'NAME_TAKEN' && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm font-bold text-blue-800 mb-2">{conflict.message}</p>
                    <div className="flex flex-wrap gap-2">
                      {conflict.suggestions?.map((sugg: string) => (
                        <button key={sugg} type="button" onClick={() => {setFormData({...formData, nom_pharmacie: sugg}); setConflict(null);}}
                                className="text-[11px] bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-colors">
                          Utiliser : {sugg}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-slate-400" size={18} />
                    <input required className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" 
                           placeholder="Nom de la pharmacie" value={formData.nom_pharmacie} onChange={e => setFormData({...formData, nom_pharmacie: e.target.value})} />
                  </div>

                  {/* Nouveau : Sélecteur de type */}
                  <div className="relative">
                    <Stethoscope className="absolute left-3 top-3 text-slate-400" size={18} />
                    <select 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 appearance-none bg-white"
                      value={formData.type_pharmacie}
                      onChange={e => setFormData({...formData, type_pharmacie: e.target.value})}
                    >
                      {PHARMACY_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input required className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500" 
                             placeholder="Ville" value={formData.ville} onChange={e => setFormData({...formData, ville: e.target.value})} />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                      <input required className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 ${conflict?.error === 'PHONE_EXISTS' ? 'border-orange-300' : 'border-slate-200'}`} 
                             placeholder="Téléphone (ex: 081...)" value={formData.telephone} onChange={e => setFormData({...formData, telephone: e.target.value})} />
                    </div>
                  </div>
                  {conflict?.error === 'PHONE_EXISTS' && <p className="text-[11px] text-orange-600 font-medium">Ce numéro est déjà lié à un compte.</p>}
                </div>
              </div>
            )}

            {/* ETAPE 3 : PLAN (Mise à jour pour 3 colonnes) */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Choisissez votre plan</h2>
                <p className="text-sm text-slate-500 mb-6">14 jours d'essai gratuit. Changez de plan à tout moment.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {PLANS.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => setFormData({...formData, plan: p.id, plan_name: p.name})}
                      className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all flex flex-col justify-between ${
                        formData.plan === p.id 
                        ? 'border-blue-600 bg-blue-50/50 shadow-md' 
                        : 'border-slate-100 hover:border-slate-200 bg-white'
                      }`}
                    >
                      {formData.plan === p.id && (
                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full p-1">
                          <CheckCircle2 size={14} />
                        </div>
                      )}
                      
                      <div>
                        <p className={`font-bold ${formData.plan === p.id ? 'text-blue-700' : 'text-slate-800'}`}>
                          {p.name}
                        </p>
                        <p className="text-xl font-black text-slate-900 mt-1">
                          {p.price}<span className="text-[10px] text-slate-400 font-normal">/mois</span>
                        </p>
                        
                        <ul className="space-y-2 mt-4">
                          {p.features.map(f => (
                            <li key={f} className="flex items-start gap-2 text-[10px] text-slate-600">
                              <CheckCircle2 size={12} className="text-blue-500 shrink-0 mt-0.5" />
                              <span>{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                   <p className="text-[11px] text-slate-500 text-center">
                     Besoin d'une solution sur mesure pour une chaîne de plus de 10 pharmacies ? 
                     <span className="text-blue-600 font-bold cursor-pointer ml-1">Contactez notre équipe</span>
                   </p>
                </div>
              </div>
            )}
            
            <div className="pt-6 flex items-center justify-between">
              {step > 1 ? (
                <button type="button" onClick={() => setStep(step - 1)} className="text-sm font-bold text-slate-400 hover:text-slate-600">
                  Retour
                </button>
              ) : <div />}
              
              <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50"
              >
                {loading ? 'Traitement...' : step === 3 ? 'Activer mon essai' : 'Continuer'}
                {!loading && <ArrowRight size={18} />}
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