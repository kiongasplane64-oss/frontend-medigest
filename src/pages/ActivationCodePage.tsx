// ActivationCodePage.tsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/api/client';

interface CodeInfo {
  valid: boolean;
  message?: string;
  plan?: {
    type: string;
    name: string;
    duration_days: number;
  };
  price?: number;
  currency?: string;
  valid_until?: string;
  code?: string;
}

interface LocationState {
  plan?: {
    id: string;
    name: string;
    type: string;
    price: number;
  };
  currentPlan?: {
    name: string;
    price: number;
    type: string;
  };
}

export default function ActivationCodePage() {
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [codeInfo, setCodeInfo] = useState<CodeInfo | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;

  const formatCode = (input: string): string => {
    // Supprimer tous les caractères non alphanumériques et mettre en majuscules
    const cleaned = input.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    
    // Formater XXXX-XXXX
    if (cleaned.length >= 8) {
      return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 8)}`;
    }
    
    // Retourner le code partiellement formaté
    const parts = [];
    for (let i = 0; i < cleaned.length && i < 8; i += 4) {
      parts.push(cleaned.substring(i, Math.min(i + 4, cleaned.length)));
    }
    return parts.join('-');
  };

  const cleanCode = (input: string): string => {
    // Nettoyer le code pour l'API (enlever tirets et espaces)
    return input.replace(/[-\s]/g, '').toUpperCase();
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCode(e.target.value);
    setCode(formatted);
    setCodeInfo(null); // Réinitialiser les infos quand l'utilisateur modifie le code
    
    // Valider automatiquement quand le code est complet (9 caractères avec le tiret)
    if (formatted.length === 9) {
      validateCode(formatted);
    }
  };

  const validateCode = async (codeToValidate: string) => {
    // Ne pas valider si le code est vide
    if (!codeToValidate || codeToValidate.length < 9) return;
    
    setIsValidating(true);
    
    try {
      // Nettoyer le code pour l'API
      const cleanCodeValue = cleanCode(codeToValidate);
      
      // Utiliser GET pour la validation (compatible avec le backend)
      const response = await api.get(`/subscription-codes/validate?code=${encodeURIComponent(cleanCodeValue)}`);
      
      if (response.data) {
        setCodeInfo(response.data);
        
        if (response.data.valid) {
          toast.success('✓ Code valide !');
        } else {
          toast.error(response.data.message || 'Code invalide');
        }
      }
    } catch (error: any) {
      console.error('Erreur de validation:', error);
      
      // Gérer les différentes erreurs
      let errorMessage = 'Erreur de validation';
      
      if (error.response) {
        // Le serveur a répondu avec une erreur
        if (error.response.status === 404) {
          errorMessage = 'Code non trouvé ou invalide';
        } else {
          errorMessage = error.response.data?.detail?.message || 
                        error.response.data?.message || 
                        `Erreur ${error.response.status}`;
        }
      } else if (error.request) {
        // La requête a été faite mais pas de réponse
        errorMessage = 'Impossible de contacter le serveur';
      }
      
      toast.error(errorMessage);
      setCodeInfo({ 
        valid: false, 
        message: errorMessage 
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleActivate = async () => {
    if (!codeInfo?.valid) {
      toast.error('Veuillez d\'abord valider un code valide');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Nettoyer le code pour l'activation
      const cleanCodeValue = cleanCode(code);
      
      const response = await api.post('/subscription-codes/activate', { 
        code: cleanCodeValue,
        force: false // Ne pas forcer si déjà actif
      });
      
      if (response.data?.success) {
        toast.success('✅ Abonnement activé avec succès !');
        
        // Rediriger vers le dashboard après 2 secondes
        setTimeout(() => {
          navigate('/dashboard', { 
            state: { 
              activationSuccess: true,
              plan: response.data.subscription 
            }
          });
        }, 2000);
      } else {
        toast.error(response.data?.message || 'Erreur lors de l\'activation');
      }
      
    } catch (error: any) {
      console.error('Erreur d\'activation:', error);
      
      // Gérer les erreurs d'activation
      let errorMessage = 'Erreur d\'activation';
      
      if (error.response) {
        if (error.response.status === 400) {
          const detail = error.response.data?.detail;
          if (detail?.error === 'already_active') {
            errorMessage = 'Vous avez déjà un abonnement actif';
            // Proposer de forcer l'activation
            if (window.confirm('Voulez-vous remplacer votre abonnement actuel ?')) {
              // Réessayer avec force=true
              retryActivationWithForce();
              return;
            }
          } else {
            errorMessage = detail?.message || 'Données invalides';
          }
        } else if (error.response.status === 404) {
          errorMessage = 'Code d\'activation non trouvé';
        } else {
          errorMessage = error.response.data?.detail?.message || 
                        error.response.data?.message || 
                        `Erreur ${error.response.status}`;
        }
      } else if (error.request) {
        errorMessage = 'Impossible de contacter le serveur';
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const retryActivationWithForce = async () => {
    try {
      const cleanCodeValue = cleanCode(code);
      const response = await api.post('/subscription-codes/activate', { 
        code: cleanCodeValue,
        force: true
      });
      
      if (response.data?.success) {
        toast.success('✅ Abonnement remplacé avec succès !');
        setTimeout(() => navigate('/dashboard'), 2000);
      }
    } catch (error: any) {
      toast.error('Échec de l\'activation forcée');
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const formatted = formatCode(pastedText);
    setCode(formatted);
    
    // Valider automatiquement si le code est complet
    if (formatted.length === 9) {
      validateCode(formatted);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-4xl shadow-2xl p-10 relative overflow-hidden">
        {/* Éléments décoratifs */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-100 rounded-full blur-3xl opacity-50" />
        
        <div className="relative">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-linear-to-br from-blue-500 to-purple-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
              <Key size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase italic mb-2">
              Code d'activation
            </h1>
            <p className="text-slate-500">
              {state?.plan 
                ? `Activez votre plan ${state.plan.name}`
                : 'Entrez votre code d\'abonnement reçu après paiement cash'
              }
            </p>
            {state?.currentPlan && (
              <div className="mt-2 text-xs text-slate-400">
                Plan actuel : {state.currentPlan.name}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="activation-code" className="block text-xs font-bold text-slate-600 uppercase mb-2">
                Code d'activation
              </label>
              <input
                id="activation-code"
                type="text"
                value={code}
                onChange={handleCodeChange}
                onPaste={handlePaste}
                placeholder="XXXX-XXXX"
                className="w-full p-4 text-center text-2xl font-mono font-bold bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all uppercase tracking-wider"
                maxLength={9}
                autoFocus
                disabled={isLoading}
              />
              {isValidating && (
                <div className="flex items-center justify-center gap-2 mt-3 text-slate-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-xs font-medium">Validation en cours...</span>
                </div>
              )}
            </div>

            {codeInfo?.valid && codeInfo.plan && (
              <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
                    <CheckCircle size={20} className="text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-green-800 uppercase text-sm mb-1">
                      ✓ Code valide !
                    </p>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-green-700">
                        {codeInfo.plan.name}
                      </p>
                      <p className="text-xs text-green-600">
                        Durée: {codeInfo.plan.duration_days} jours
                      </p>
                      {codeInfo.price && codeInfo.price > 0 && (
                        <p className="text-xs font-bold text-green-700">
                          {codeInfo.price} {codeInfo.currency || 'EUR'}
                        </p>
                      )}
                      {codeInfo.valid_until && (
                        <p className="text-xs text-green-600 opacity-75">
                          Valide jusqu'au {new Date(codeInfo.valid_until).toLocaleDateString('fr-FR', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {codeInfo && !codeInfo.valid && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                    <AlertCircle size={20} className="text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-red-800 uppercase text-sm mb-1">
                      Code invalide
                    </p>
                    <p className="text-xs text-red-700">
                      {codeInfo.message || 'Vérifiez votre code et réessayez'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleActivate}
              disabled={!codeInfo?.valid || isLoading || isValidating}
              className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all transform ${
                !codeInfo?.valid || isLoading || isValidating
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-linear-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 active:scale-95 shadow-xl shadow-blue-200'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-3">
                  <Loader2 className="animate-spin" size={20} />
                  Activation en cours...
                </div>
              ) : (
                'Activer mon abonnement'
              )}
            </button>

            <div className="text-center space-y-3">
              <p className="text-xs text-slate-400">
                Vous avez payé par mobile money ? Votre compte est activé automatiquement.
              </p>
              
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => navigate('/subscription')}
                  className="text-xs text-blue-600 hover:text-blue-800 font-bold uppercase tracking-wider transition-colors"
                >
                  ← Retour
                </button>
                
                <button
                  onClick={() => navigate('/support')}
                  className="text-xs text-slate-400 hover:text-slate-600 font-bold uppercase tracking-wider transition-colors"
                >
                  Aide
                </button>
              </div>
            </div>

            {/* Code de test en développement */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">🔧 Mode développement</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const testCode = 'ABCD-1234';
                      setCode(testCode);
                      validateCode(testCode);
                    }}
                    className="text-xs px-3 py-2 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors"
                  >
                    Tester ABCD-1234
                  </button>
                  <button
                    onClick={() => {
                      const testCode = 'PRO-2024';
                      setCode(testCode);
                      validateCode(testCode);
                    }}
                    className="text-xs px-3 py-2 bg-slate-200 rounded-xl hover:bg-slate-300 transition-colors"
                  >
                    Tester PRO-2024
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}