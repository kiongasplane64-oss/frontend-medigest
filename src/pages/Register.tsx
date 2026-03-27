import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, Mail, Lock, Phone, MapPin, 
  Building2, CheckCircle2, ArrowRight, ShieldCheck,
  AlertCircle, ChevronRight, Stethoscope, Calendar,
  Gift, Clock, Star, Users, Package, Store,
  Award, Sparkles, BadgeCheck, LogIn, Loader2,
  Eye, EyeOff, Check, X
} from 'lucide-react';
import { authService } from '@/services/authService';

// Types
interface Plan {
  id: string;
  name: string;
  price: string;
  features: string[];
  popular: boolean;
  icon: React.ElementType;
}

interface PharmacyType {
  id: string;
  label: string;
}

interface FormData {
  email: string;
  password: string;
  confirm_password: string;
  nom_complet: string;
  nom_pharmacie: string;
  ville: string;
  telephone: string;
  type_pharmacie: string;
  pays: string;
  plan: string;
  plan_name: string;
}

interface ConflictError {
  error?: string;
  message?: string;
  suggestion?: string;
  suggestions?: string[];
}

interface PasswordValidation {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special?: boolean;
}

// Constantes
const PLANS: Plan[] = [
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

const PHARMACY_TYPES: PharmacyType[] = [
  { id: 'officine', label: 'Officine de ville' },
  { id: 'hospitaliere', label: 'Pharmacie Hospitalière' },
  { id: 'grossiste', label: 'Grossiste / Distributeur' },
  { id: 'depot', label: 'Dépôt Pharmaceutique' },
];

const TRIAL_DAYS = 14;

// Fonctions utilitaires
const getTrialEndDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() + TRIAL_DAYS);
  return date.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
};

const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 9 && cleaned.length <= 12;
};

const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 9) return cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('243')) return cleaned;
  if (cleaned.length === 12 && cleaned.startsWith('243')) return cleaned.slice(1);
  return cleaned;
};

// Validation du mot de passe
const validatePassword = (password: string): PasswordValidation => {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
};

const isPasswordValid = (validation: PasswordValidation): boolean => {
  return validation.length && validation.uppercase && validation.lowercase && validation.number;
};

export default function Register(): React.ReactElement {
  const navigate = useNavigate();
  const [step, setStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [conflict, setConflict] = useState<ConflictError | null>(null);
  const [trialEndDate] = useState<string>(getTrialEndDate());
  const [registrationSuccess, setRegistrationSuccess] = useState<boolean>(false);
  const [userCredentials, setUserCredentials] = useState<{ email: string; password: string } | null>(null);
  const [passwordError, setPasswordError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
  });
  
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    confirm_password: '',
    nom_complet: '',
    nom_pharmacie: '',
    ville: '',
    telephone: '',
    type_pharmacie: 'officine',
    pays: 'RDC',
    plan: 'professional',
    plan_name: 'Professionnel'
  });

  // Validation du mot de passe en temps réel
  useEffect(() => {
    const validation = validatePassword(formData.password);
    setPasswordValidation(validation);
    
    if (formData.password || formData.confirm_password) {
      if (formData.password.length > 0 && !validation.length) {
        setPasswordError('Le mot de passe doit contenir au moins 8 caractères');
      } else if (!validation.uppercase) {
        setPasswordError('Le mot de passe doit contenir au moins une majuscule');
      } else if (!validation.lowercase) {
        setPasswordError('Le mot de passe doit contenir au moins une minuscule');
      } else if (!validation.number) {
        setPasswordError('Le mot de passe doit contenir au moins un chiffre');
      } else if (formData.confirm_password && formData.password !== formData.confirm_password) {
        setPasswordError('Les mots de passe ne correspondent pas');
      } else {
        setPasswordError('');
      }
    } else {
      setPasswordError('');
    }
  }, [formData.password, formData.confirm_password]);

  // Mise à jour du plan_name
  useEffect(() => {
    const selectedPlan = PLANS.find(p => p.id === formData.plan);
    if (selectedPlan) {
      setFormData(prev => ({ ...prev, plan_name: selectedPlan.name }));
    }
  }, [formData.plan]);

  const updateFormField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (conflict) setConflict(null);
  }, [conflict]);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    
    // Validation du formulaire avant soumission
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Validation finale du mot de passe
    const validation = validatePassword(formData.password);
    if (!isPasswordValid(validation)) {
      setPasswordError('Veuillez respecter toutes les règles de sécurité du mot de passe');
      return;
    }

    if (formData.password !== formData.confirm_password) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    if (!validatePhone(formData.telephone)) {
      alert('Numéro de téléphone invalide (9-12 chiffres requis)');
      return;
    }

    setLoading(true);
    setConflict(null);

    try {
      // Préparer les données pour l'API
      const submissionData = {
        ...formData,
        telephone: formatPhone(formData.telephone),
        email: formData.email.toLowerCase().trim(),
        nom_complet: formData.nom_complet.trim(),
        nom_pharmacie: formData.nom_pharmacie.trim(),
        ville: formData.ville.trim()
      };

      // Appel API
      await authService.register(submissionData);
      
      // Stocker les identifiants pour affichage
      setUserCredentials({
        email: formData.email,
        password: formData.password
      });
      
      setRegistrationSuccess(true);
      
      // Redirection automatique après 5 secondes
      setTimeout(() => {
        navigate('/login', { 
          state: { 
            registrationSuccess: true,
            email: formData.email 
          }
        });
      }, 5000);
      
    } catch (error: any) {
      const errorData = error.response?.data?.detail;
      
      if (errorData && typeof errorData === 'object') {
        setConflict(errorData);
        
        // Rediriger vers l'étape appropriée selon l'erreur
        if (errorData.error === 'pharmacy_name_exists' || errorData.error === 'phone_already_used') {
          setStep(2);
        } else if (errorData.error === 'email_already_used') {
          setStep(1);
        }
      } else {
        const errorMessage = typeof errorData === 'string' 
          ? errorData 
          : "Erreur lors de l'inscription. Veuillez réessayer.";
        alert(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Gestionnaire de suggestion pour le nom de pharmacie
  const handleSuggestionClick = useCallback((suggestion: string): void => {
    updateFormField('nom_pharmacie', suggestion);
    setConflict(null);
  }, [updateFormField]);

  // Composant de validation visuelle
  const ValidationItem = ({ label, isValid }: { label: string; isValid: boolean }) => (
    <li className={`flex items-center gap-2 text-xs ${isValid ? 'text-green-600' : 'text-slate-400'}`}>
      {isValid ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <X className="w-3 h-3 text-slate-300" />
      )}
      <span className={isValid ? 'text-green-700' : 'text-slate-500'}>{label}</span>
    </li>
  );

  // Écran de confirmation post-inscription
  if (registrationSuccess) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-linear-to-br from-green-500 to-emerald-600 p-8 text-white text-center">
            <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Inscription réussie !</h2>
            <p className="text-green-100">Votre compte a été créé avec succès</p>
          </div>
          
          <div className="p-8">
            <div className="bg-blue-50 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                <Mail className="w-4 h-4" />
                Vos identifiants de connexion
              </h3>
              <div className="space-y-2">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-slate-500 mb-1">Email</p>
                  <p className="font-mono text-sm font-bold text-blue-700 break-all">{userCredentials?.email}</p>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <p className="text-xs text-slate-500 mb-1">Mot de passe</p>
                  <p className="font-mono text-sm font-bold text-blue-700">••••••••</p>
                </div>
              </div>
              <p className="text-xs text-blue-600 mt-3 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Conservez ces identifiants précieusement
              </p>
            </div>

            <div className="bg-linear-to-r from-orange-50 to-amber-50 rounded-xl p-4 mb-6 border border-orange-100">
              <div className="flex items-start gap-3">
                <Gift className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-orange-800 text-sm">Période d'essai active</p>
                  <p className="text-xs text-orange-700 mt-1">
                    Vous bénéficiez de {TRIAL_DAYS} jours d'essai gratuit jusqu'au {trialEndDate}
                  </p>
                  <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Un SMS de bienvenue vous sera envoyé lors de votre première connexion
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => navigate('/login', { 
                  state: { 
                    registrationSuccess: true,
                    email: userCredentials?.email 
                  }
                })}
                className="w-full bg-linear-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200"
              >
                <LogIn className="w-4 h-4" />
                Se connecter maintenant
              </button>
              
              <p className="text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Redirection automatique dans quelques secondes...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 flex flex-col items-center justify-center p-4 font-sans">
      <div className="max-w-5xl w-full grid md:grid-cols-12 bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        
        {/* Sidebar avec offre d'essai */}
        <div className="md:col-span-4 bg-linear-to-br from-blue-600 to-indigo-700 p-8 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full -ml-20 -mb-20"></div>
          
          <div>
            <div className="text-2xl font-bold tracking-tighter mb-8 flex items-center gap-2">
              <span className="bg-white/20 p-2 rounded-xl">💊</span>
              Medigest
            </div>
            
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
                { s: 1, t: "Compte Admin", d: "Vos accès personnels", icon: User },
                { s: 2, t: "Pharmacie", d: "Détails de l'établissement", icon: Building2 },
                { s: 3, t: "Plan & Essai", d: `${TRIAL_DAYS} jours gratuits`, icon: Gift }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = step === item.s;
                const isCompleted = step > item.s;
                
                return (
                  <div key={item.s} className={`flex gap-4 items-center transition-all duration-300 ${isActive ? 'opacity-100 scale-105' : 'opacity-50'}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all ${
                      isActive 
                        ? 'bg-white text-blue-600 border-white shadow-lg' 
                        : isCompleted 
                          ? 'bg-green-500 text-white border-green-500' 
                          : 'border-white/30'
                    }`}>
                      {isCompleted ? <CheckCircle2 size={18}/> : <Icon size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold">{item.t}</p>
                      <p className="text-[10px] uppercase tracking-wider font-medium text-blue-100">{item.d}</p>
                    </div>
                  </div>
                );
              })}
            </div>

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
                
                {conflict?.error === 'email_already_used' && (
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
                      onChange={e => updateFormField('nom_complet', e.target.value)}
                    />
                  </div>
                  
                  <div className="relative group">
                    <Mail className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      required 
                      type="email"
                      className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        conflict?.error === 'email_already_used' ? 'border-orange-300' : 'border-slate-200'
                      }`}
                      placeholder="Email professionnel"
                      value={formData.email}
                      onChange={e => updateFormField('email', e.target.value)}
                    />
                  </div>
                  
                  {/* Champ Mot de passe avec validation visuelle */}
                  <div>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        required 
                        type={showPassword ? "text" : "password"}
                        placeholder="Mot de passe"
                        className={`w-full pl-10 pr-12 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                          passwordError && formData.password ? 'border-red-300' : 'border-slate-200'
                        } ${isPasswordValid(passwordValidation) && formData.password ? 'border-green-500' : ''}`}
                        value={formData.password}
                        onChange={e => updateFormField('password', e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    
                    {/* Barre de progression de la force du mot de passe */}
                    {formData.password && (
                      <div className="mt-2">
                        <div className="flex gap-1 h-1.5 mb-2">
                          <div className={`flex-1 rounded-full transition-all ${
                            passwordValidation.length ? 'bg-green-500' : 'bg-slate-200'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all ${
                            passwordValidation.uppercase ? 'bg-green-500' : 'bg-slate-200'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all ${
                            passwordValidation.lowercase ? 'bg-green-500' : 'bg-slate-200'
                          }`} />
                          <div className={`flex-1 rounded-full transition-all ${
                            passwordValidation.number ? 'bg-green-500' : 'bg-slate-200'
                          }`} />
                        </div>
                        
                        {/* Liste des règles de validation */}
                        <ul className="grid grid-cols-2 gap-1 mt-2">
                          <ValidationItem 
                            label="8 caractères minimum" 
                            isValid={passwordValidation.length} 
                          />
                          <ValidationItem 
                            label="Une majuscule" 
                            isValid={passwordValidation.uppercase} 
                          />
                          <ValidationItem 
                            label="Une minuscule" 
                            isValid={passwordValidation.lowercase} 
                          />
                          <ValidationItem 
                            label="Un chiffre" 
                            isValid={passwordValidation.number} 
                          />
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Confirmation du mot de passe */}
                  <div className="relative group">
                    <Lock className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <input 
                      required 
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirmer le mot de passe"
                      className={`w-full pl-10 pr-12 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                        formData.confirm_password && formData.password !== formData.confirm_password ? 'border-red-300' : 
                        formData.confirm_password && formData.password === formData.confirm_password ? 'border-green-500' : 'border-slate-200'
                      }`}
                      value={formData.confirm_password}
                      onChange={e => updateFormField('confirm_password', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  
                  {passwordError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {passwordError}
                    </p>
                  )}
                  
                  {isPasswordValid(passwordValidation) && formData.confirm_password === formData.password && formData.confirm_password && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Mot de passe valide
                    </p>
                  )}
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
                
                {conflict?.error === 'pharmacy_name_exists' && conflict.suggestion && (
                  <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <p className="text-sm font-bold text-blue-800 mb-2">{conflict.message}</p>
                    <button 
                      type="button"
                      onClick={() => handleSuggestionClick(conflict.suggestion!)}
                      className="text-[11px] bg-white border border-blue-200 text-blue-600 px-3 py-1 rounded-full hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      Utiliser : {conflict.suggestion}
                    </button>
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
                      onChange={e => updateFormField('nom_pharmacie', e.target.value)}
                    />
                  </div>

                  <div className="relative group">
                    <Stethoscope className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                    <select 
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all appearance-none bg-white"
                      value={formData.type_pharmacie}
                      onChange={e => updateFormField('type_pharmacie', e.target.value)}
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
                        onChange={e => updateFormField('ville', e.target.value)}
                      />
                    </div>
                    <div className="relative group">
                      <Phone className="absolute left-3 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                      <input 
                        required
                        className={`w-full pl-10 pr-4 py-3 rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                          conflict?.error === 'phone_already_used' ? 'border-orange-300' : 'border-slate-200'
                        }`}
                        placeholder="Téléphone (ex: 081...)"
                        value={formData.telephone}
                        onChange={e => updateFormField('telephone', e.target.value)}
                      />
                    </div>
                  </div>
                  {conflict?.error === 'phone_already_used' && (
                    <p className="text-[11px] text-orange-600 font-medium">{conflict.message}</p>
                  )}
                </div>
              </div>
            )}

            {/* ÉTAPE 3 : PLAN AVEC ESSAI GRATUIT */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-300">
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
                  {PLANS.map(plan => {
                    const Icon = plan.icon;
                    const isSelected = formData.plan === plan.id;
                    
                    return (
                      <div 
                        key={plan.id} 
                        onClick={() => {
                          updateFormField('plan', plan.id);
                          updateFormField('plan_name', plan.name);
                        }}
                        className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 flex flex-col ${
                          isSelected 
                            ? 'border-blue-600 bg-blue-50/50 shadow-xl scale-105 z-10' 
                            : 'border-slate-100 hover:border-slate-200 hover:shadow-lg bg-white'
                        } ${plan.popular ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}`}
                      >
                        {plan.popular && (
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
                              {plan.name}
                            </p>
                            <p className="text-xl font-black text-slate-900">
                              {plan.price}<span className="text-[10px] text-slate-400 font-normal">/mois</span>
                            </p>
                          </div>
                        </div>
                        
                        <ul className="space-y-2 mb-4 flex-1">
                          {plan.features.map(feature => (
                            <li key={feature} className="flex items-start gap-2 text-[11px] text-slate-600">
                              <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

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
                    <button 
                      type="button"
                      className="text-blue-600 font-bold ml-1 hover:underline"
                      onClick={() => window.location.href = 'mailto:support@medigest.com'}
                    >
                      Contactez notre équipe
                    </button>
                  </p>
                </div>
              </div>
            )}
            
            <div className="pt-6 flex items-center justify-between border-t border-slate-100">
              {step > 1 && (
                <button 
                  type="button" 
                  onClick={() => setStep(step - 1)} 
                  className="text-sm font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                  disabled={loading}
                >
                  <ChevronRight className="rotate-180" size={16} />
                  Retour
                </button>
              )}
              
              <button 
                type="submit" 
                disabled={
                  loading || 
                  (step === 1 && (!isPasswordValid(passwordValidation) || formData.password !== formData.confirm_password))
                }
                className={`bg-linear-to-r from-blue-600 to-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                  step === 1 ? 'ml-auto' : ''
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création en cours...
                  </>
                ) : step === 3 ? (
                  <>
                    <Gift size={18} />
                    Créer mon compte
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