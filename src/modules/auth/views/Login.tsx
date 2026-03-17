import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';
import {
  Lock,
  Mail,
  Loader2,
  AlertCircle,
  UserPlus,
  CheckCircle2,
  ArrowLeft,
  Send,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react';
import toast from 'react-hot-toast';

type AuthMode = 'login' | 'forgot_password' | 'confirm_reset';

interface UserResponse {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id?: string | null;
  activated: boolean;
  phone?: string;
  telephone?: string;
  actif?: boolean;
  has_subscription?: boolean;
  subscription_status?: string;
  subscription_end_date?: string;
  permissions?: Record<string, boolean>;
}

interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

interface ErrorResponse {
  detail?: string | { message?: string; verification_required?: boolean };
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, user, isSuperAdmin } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Rediriger si déjà authentifié
  useEffect(() => {
    if (isAuthenticated && user) {
      redirectBasedOnRoleAndSubscription();
    }
  }, [isAuthenticated, user]);

  const redirectBasedOnRoleAndSubscription = () => {
    const currentUser = user;
    
    console.log('🔍 Vérification des droits utilisateur:', {
      role: currentUser?.role,
      isSuperAdmin: isSuperAdmin(),
      hasSubscription: (currentUser as any)?.has_subscription,
      subscriptionStatus: (currentUser as any)?.subscription_status
    });

    // CAS 1: SUPER ADMIN - toujours vers /super-admin
    if (isSuperAdmin()) {
      console.log('👑 Super Admin détecté - Redirection vers /super-admin');
      navigate('/super-admin', { replace: true });
      return;
    }

    // CAS 2: Utilisateur standard sans abonnement actif
    if (!(currentUser as any)?.has_subscription) {
      console.log('💰 Compte sans abonnement - Redirection vers /subscription');
      navigate('/subscription', { 
        state: { 
          requiresSubscription: true,
          message: 'Veuillez choisir un abonnement pour continuer'
        },
        replace: true 
      });
      return;
    }

    // CAS 3: Utilisateur standard avec abonnement actif
    console.log('🏢 Utilisateur standard avec abonnement - Redirection vers /super-admin/register');
    navigate('/super-admin/register', { replace: true });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      console.log('🔐 Tentative de connexion pour:', email);
      
      const response = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      const { user: userData, access_token } = response.data;

      if (!userData || !access_token) {
        throw new Error('Réponse de connexion invalide.');
      }

      console.log('✅ Connexion réussie pour:', userData.email);
      console.log('🔑 Token reçu:', access_token.substring(0, 20) + '...');
      console.log('👤 Rôle utilisateur:', userData.role);
      console.log('💰 Statut abonnement:', userData.has_subscription ? 'Actif' : 'Inactif');

      // Normaliser l'utilisateur pour correspondre à l'interface User du store
      const normalizedUser = {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        nom_complet: userData.nom_complet,
        tenant_id: userData.tenant_id,
        activated: userData.activated ?? userData.actif ?? true,
        actif: userData.actif ?? userData.activated ?? true,
        telephone: userData.telephone || userData.phone || '',
        phone: userData.phone || userData.telephone || '',
        permissions: userData.permissions ?? {},
        // Propriétés étendues (seront accessibles via cast)
        has_subscription: userData.has_subscription ?? false,
        subscription_status: userData.subscription_status || 'none',
        subscription_end_date: userData.subscription_end_date,
      };

      // Sauvegarde dans le store
      setAuth(normalizedUser, access_token);

      // Vérification que le token est bien sauvegardé
      const storeState = useAuthStore.getState();
      console.log('💾 Token dans le store:', storeState.token ? 'présent' : 'absent');
      console.log('💾 Utilisateur authentifié:', storeState.isAuthenticated);
      console.log('👑 Super Admin:', storeState.isSuperAdmin());
      console.log('💰 A abonnement:', (storeState.user as any)?.has_subscription);

      // Rediriger basé sur le rôle et l'abonnement
      redirectBasedOnRoleAndSubscription();

    } catch (err: any) {
      console.error('❌ Erreur de connexion:', err);
      
      const status = err?.response?.status;
      const errorData = err?.response?.data as ErrorResponse | undefined;
      const detail = errorData?.detail;

      // Gestion des erreurs
      let msg = 'Erreur de connexion.';

      if (typeof detail === 'string' && detail.trim()) {
        msg = detail;
      } else if (detail && typeof detail === 'object' && 'message' in detail) {
        msg = detail.message || msg;
      } else if (status === 401) {
        msg = 'Email ou mot de passe incorrect.';
      } else if (status === 403) {
        msg = 'Accès refusé. Vérifiez votre compte.';
      } else if (status === 402) {
        msg = 'Abonnement requis. Veuillez souscrire à un plan.';
        toast.error('Abonnement requis', {
          icon: '💰',
          duration: 5000,
        });
      } else if (status === 429) {
        msg = 'Trop de tentatives. Réessayez plus tard.';
      } else if (!status) {
        msg = 'Impossible de contacter le serveur.';
      }

      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      console.log('🔐 Demande de réinitialisation pour:', email);
      
      await api.post('/auth/password/reset/request', {
        email: email.trim(),
      });

      setSuccessMsg('📱 Code de réinitialisation envoyé par SMS/WhatsApp.');
      setMode('confirm_reset');
      toast.success('Code envoyé ! Vérifiez votre téléphone.');
    } catch (err: any) {
      console.error('❌ Erreur demande reset:', err);
      
      const detail = err?.response?.data?.detail;
      const errorMsg = typeof detail === 'string' && detail.trim()
        ? detail
        : "Impossible d'envoyer le code de réinitialisation.";
      
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      console.log('🔐 Confirmation réinitialisation pour:', email);
      
      await api.post('/auth/password/reset/confirm', {
        email: email.trim(),
        code: resetCode.trim(),
        new_password: newPassword,
      });

      setSuccessMsg('✅ Mot de passe modifié avec succès !');
      setMode('login');
      setResetCode('');
      setNewPassword('');
      setPassword('');
      
      toast.success('Mot de passe réinitialisé ! Vous pouvez maintenant vous connecter.');
    } catch (err: any) {
      console.error('❌ Erreur confirmation reset:', err);
      
      const detail = err?.response?.data?.detail;
      const errorMsg = typeof detail === 'string' && detail.trim()
        ? detail
        : 'Code invalide ou expiré.';
      
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all hover:scale-[1.02] duration-300">
        <div className="p-8">
          {/* Logo et titre */}
          <div className="flex flex-col items-center mb-8">
            <div
              className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg ${
                mode === 'login'
                  ? 'bg-linear-to-br from-red-500 to-red-600 shadow-red-200'
                  : 'bg-linear-to-br from-blue-500 to-blue-600 shadow-blue-200'
              }`}
            >
              {mode === 'login' ? <Shield size={32} /> : <KeyRound size={32} />}
            </div>

            <h1 className="text-3xl font-bold text-slate-800">
              {mode === 'login'
                ? 'MEDIGEST PRO'
                : mode === 'forgot_password'
                ? 'Récupération'
                : 'Nouveau mot de passe'}
            </h1>

            <p className="text-slate-500 text-sm mt-2 text-center max-w-xs">
              {mode === 'login'
                ? 'Gérez votre officine en toute sécurité'
                : 'Un code de vérification vous sera envoyé'}
            </p>
          </div>

          {/* Messages d'erreur/succès */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-700 text-sm flex items-start gap-3 animate-shake">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="flex-1">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl text-green-700 text-sm flex items-start gap-3">
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <p className="flex-1">{successMsg}</p>
            </div>
          )}

          {/* Formulaire de connexion */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Adresse email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@pharmacie.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Mot de passe
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setSuccessMsg('');
                    setMode('forgot_password');
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
                  disabled={isLoading}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="w-full py-4 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Connexion en cours...</span>
                  </>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>
          )}

          {/* Formulaire demande reset */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email du compte
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="w-full py-4 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Envoi en cours...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Envoyer le code</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setSuccessMsg('');
                  setMode('login');
                }}
                className="w-full text-slate-500 text-sm flex items-center justify-center gap-2 hover:text-slate-700 transition-colors py-2"
                disabled={isLoading}
              >
                <ArrowLeft size={16} />
                Retour à la connexion
              </button>
            </form>
          )}

          {/* Formulaire confirmation reset */}
          {mode === 'confirm_reset' && (
            <form onSubmit={handleConfirmReset} className="space-y-5">
              <div className="p-4 bg-blue-50 text-blue-700 text-xs rounded-xl border border-blue-100 font-medium text-center">
                📱 Un code à 6 chiffres vous a été envoyé par SMS/WhatsApp
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Code de vérification
                </label>
                <input
                  required
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[0.5em] font-black py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl focus:border-blue-500 outline-none transition-all"
                  disabled={isLoading}
                  inputMode="numeric"
                  pattern="\d{6}"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Nouveau mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 caractères"
                    className="w-full px-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                disabled={isLoading || resetCode.length !== 6 || newPassword.length < 8}
                type="submit"
                className="w-full py-4 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    <span>Réinitialisation...</span>
                  </>
                ) : (
                  'Réinitialiser le mot de passe'
                )}
              </button>
            </form>
          )}

          {/* Lien inscription */}
          {mode === 'login' && (
            <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
              <Link
                to="/register"
                className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 hover:border-red-200 transition-all flex items-center justify-center gap-2 group"
              >
                <UserPlus size={18} className="group-hover:text-red-500 transition-colors" />
                <span>Créer un compte pharmacie</span>
              </Link>
              
              {/* Info sur l'abonnement */}
              <p className="text-center text-xs text-slate-400">
                💡 Après inscription, vous devrez choisir un abonnement pour activer votre compte
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}