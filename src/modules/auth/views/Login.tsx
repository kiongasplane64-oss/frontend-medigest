import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import api, { setAuthToken } from '@/api/client';
import { normalizeUser, LoginResponse } from '@/types/auth';
import {
  Lock,
  Mail,
  Loader2,
  UserPlus,
  ArrowLeft,
  Send,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

type AuthMode = 'login' | 'forgot_password' | 'confirm_reset';

export default function Login() {
  const { setAuth } = useAuthStore();
  
  // ✅ Le hook gère les redirections - une seule fois
  useAuthRedirect();
  
  // Modal Super Admin
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [superAdminKey, setSuperAdminKey] = useState('');
  const [superAdminKeyError, setSuperAdminKeyError] = useState('');
  const [isKeyVerifying, setIsKeyVerifying] = useState(false);

  // Auth state
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reset password state
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  /**
   * Stocke l'authentification et initialise le token
   */
  const handleSetAuth = (userData: any, token: string, refreshToken?: string | null) => {
    setAuth(userData, token, refreshToken);
    setAuthToken(token, refreshToken);
    localStorage.setItem('access_token', token);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    console.log('🔐 Authentification stockée');
  };

  const handleSuperAdminAccess = async () => {
    if (!superAdminKey.trim()) {
      setSuperAdminKeyError('Veuillez entrer la clé d\'accès');
      return;
    }
    
    if (superAdminKey.length !== 25) {
      setSuperAdminKeyError('La clé doit contenir exactement 25 caractères');
      return;
    }
    
    try {
      setIsKeyVerifying(true);
      setSuperAdminKeyError('');
      
      const response = await api.post('/auth/super-admin/verify-key', {
        key: superAdminKey
      });
      
      if (response.data.valid) {
        sessionStorage.setItem('super_admin_temp_key', superAdminKey);
        sessionStorage.setItem('super_admin_access_time', Date.now().toString());
        
        setShowSuperAdminModal(false);
        setSuperAdminKey('');
        
        // ✅ Redirection via navigate, pas de conflit
        setTimeout(() => {
          window.location.href = '/superadmin-welcome';
        }, 100);
      } else {
        setSuperAdminKeyError('Clé d\'accès invalide');
      }
    } catch (error: any) {
      console.error('Erreur vérification clé:', error);
      setSuperAdminKeyError('Erreur de vérification');
    } finally {
      setIsKeyVerifying(false);
    }
  };

  /**
   * ✅ FONCTION DE CONNEXION SIMPLIFIÉE
   * Ne fait QUE l'authentification - PAS de redirection
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      console.log('🔐 Connexion pour:', email);
      
      const response = await api.post<LoginResponse>('/auth/login', {
        email: email.trim(),
        password,
      });

      const { user: userData, access_token, refresh_token } = response.data;
      const refreshToken = refresh_token || null;

      if (!userData || !access_token) {
        throw new Error('Réponse invalide du serveur');
      }

      console.log('✅ Connexion réussie - Rôle:', userData.role);

      // Normaliser l'utilisateur
      const normalizedUser = normalizeUser(userData);
      
      // ✅ UNIQUEMENT stocker l'authentification
      handleSetAuth(normalizedUser, access_token, refreshToken);
      
      toast.success('Connexion réussie !');
      
      // ✅ PAS de navigate() ici - le hook useAuthRedirect s'en charge
      
    } catch (err: any) {
      console.error('❌ Erreur connexion:', err);
      
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;

      let msg = 'Erreur de connexion. Veuillez réessayer.';

      if (status === 401) {
        msg = 'Email ou mot de passe incorrect.';
      } else if (status === 403) {
        msg = 'Accès refusé. Votre compte n\'a pas les droits nécessaires.';
      } else if (status === 429) {
        msg = 'Trop de tentatives. Veuillez réessayer dans quelques minutes.';
      } else if (!status) {
        msg = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
      } else if (typeof detail === 'string') {
        msg = detail;
      }

      setError(msg);
      toast.error(msg);
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
      await api.post('/auth/password/reset/request', { email: email.trim() });
      setSuccessMsg('📱 Un code de réinitialisation a été envoyé à votre email');
      setMode('confirm_reset');
      toast.success('Code envoyé !');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : "Impossible d'envoyer le code");
      toast.error('Erreur lors de l\'envoi');
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
      await api.post('/auth/password/reset/confirm', {
        email: email.trim(),
        code: resetCode.trim(),
        new_password: newPassword,
      });

      setSuccessMsg('✅ Mot de passe modifié avec succès !');
      toast.success('Mot de passe réinitialisé !');
      
      setTimeout(() => {
        setMode('login');
        setResetCode('');
        setNewPassword('');
        setPassword('');
        setEmail('');
        setSuccessMsg('');
      }, 2000);
      
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Code invalide ou expiré');
      toast.error('Erreur lors de la réinitialisation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 relative">
      {/* Bouton Super Admin */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowSuperAdminModal(true)}
          className="group relative w-14 h-14 bg-linear-to-br from-gray-800 to-gray-900 hover:from-red-600 hover:to-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-gray-900/30 hover:shadow-red-500/50 transition-all duration-300 hover:scale-110"
          title="Accès Super Admin"
        >
          <Shield size={24} className="text-white drop-shadow-lg" />
        </button>
      </div>

      {/* Modal Super Admin */}
      {showSuperAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-linear-to-r from-gray-800 to-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center">
                    <Shield className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Accès Super Admin</h2>
                    <p className="text-sm text-gray-300">Zone réservée</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSuperAdminModal(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Veuillez entrer la clé d'accès (25 caractères).
              </p>
              
              <div className="mb-4">
                <input
                  type="password"
                  value={superAdminKey}
                  onChange={(e) => {
                    setSuperAdminKey(e.target.value.toUpperCase());
                    setSuperAdminKeyError('');
                  }}
                  maxLength={25}
                  className={`w-full px-4 py-3 border rounded-xl text-center font-mono tracking-wider ${
                    superAdminKeyError ? 'border-red-500 bg-red-50' : 'border-gray-200'
                  }`}
                  placeholder="•••••••••••••••••••••••••"
                  autoFocus
                />
                {superAdminKeyError && (
                  <p className="mt-1 text-xs text-red-500">{superAdminKeyError}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">{superAdminKey.length}/25</p>
              </div>

              <button
                onClick={handleSuperAdminAccess}
                disabled={isKeyVerifying || superAdminKey.length !== 25}
                className="w-full py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50"
              >
                {isKeyVerifying ? <Loader2 className="animate-spin mx-auto" /> : 'Accéder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire principal */}
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-8">
          {/* Logo et titre */}
          <div className="flex flex-col items-center mb-8">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg ${
              mode === 'login'
                ? 'bg-linear-to-br from-red-500 to-red-600'
                : 'bg-linear-to-br from-blue-500 to-blue-600'
            }`}>
              {mode === 'login' ? <Shield size={32} /> : <KeyRound size={32} />}
            </div>
            <h1 className="text-3xl font-bold text-slate-800">
              {mode === 'login' ? 'MediGest Pro' : mode === 'forgot_password' ? 'Récupération' : 'Nouveau mot de passe'}
            </h1>
            <p className="text-slate-500 text-sm mt-2 text-center">
              {mode === 'login' 
                ? 'Connectez-vous à votre espace'
                : mode === 'forgot_password'
                ? 'Recevez un code de réinitialisation'
                : 'Entrez le code et votre nouveau mot de passe'}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-700 text-sm">
              <p>{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl text-green-700 text-sm">
              <p>{successMsg}</p>
            </div>
          )}

          {/* Formulaire de connexion */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setMode('forgot_password')}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="w-full py-4 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Se connecter'}
              </button>
            </form>
          )}

          {/* Formulaire demande reset */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Envoyer</>}
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-slate-500 text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Retour
              </button>
            </form>
          )}

          {/* Formulaire confirmation reset */}
          {mode === 'confirm_reset' && (
            <form onSubmit={handleConfirmReset} className="space-y-5">
              <div className="p-4 bg-blue-50 text-blue-700 text-xs rounded-xl text-center">
                📱 Code envoyé à <strong>{email}</strong>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Code</label>
                <input
                  required
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-wider py-3 bg-slate-50 border rounded-xl"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 pr-12 py-3 bg-slate-50 border rounded-xl"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                disabled={isLoading || resetCode.length !== 6 || newPassword.length < 8}
                type="submit"
                className="w-full py-4 bg-blue-500 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Réinitialiser'}
              </button>
              
              <button
                type="button"
                onClick={() => setMode('forgot_password')}
                className="w-full text-slate-500 text-sm flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} /> Nouveau code
              </button>
            </form>
          )}

          {/* Lien inscription */}
          {mode === 'login' && (
            <div className="mt-8 pt-8 border-t border-slate-100">
              <Link
                to="/register"
                className="w-full py-3 bg-white border-2 border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 flex items-center justify-center gap-2"
              >
                <UserPlus size={18} />
                <span>Créer un compte</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}