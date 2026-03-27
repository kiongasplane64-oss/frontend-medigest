import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import api from '@/api/client';
import { normalizeUser, LoginResponse } from '@/types/auth';
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
  WifiOff,
  RefreshCw,
  X,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';

type AuthMode = 'login' | 'forgot_password' | 'confirm_reset';

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, user } = useAuthStore();
  
  // Gestion des redirections automatiques
  useAuthRedirect();
  
  // Modal Super Admin
  const [showSuperAdminModal, setShowSuperAdminModal] = useState(false);
  const [superAdminKey, setSuperAdminKey] = useState('');
  const [superAdminKeyError, setSuperAdminKeyError] = useState('');
  const [isKeyVerifying, setIsKeyVerifying] = useState(false);
  const [networkFallback, setNetworkFallback] = useState(false);

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
  
  // État pour le modal d'alerte hors service
  const [showOutOfServiceModal, setShowOutOfServiceModal] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [pendingUserData, setPendingUserData] = useState<{ user: any; token: string } | null>(null);

  // Vérifier si déjà authentifié au chargement
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser && isAuthenticated && user) {
      // La redirection est gérée par useAuthRedirect
      console.log('✅ Utilisateur déjà authentifié');
    }
  }, [isAuthenticated, user]);

  /**
   * Vérifie si la pharmacie est en service avant de rediriger
   */
  const checkServiceStatusAndRedirect = async (pharmacyId: string, userData: any, token: string) => {
    try {
      console.log('🔍 Vérification du statut de service pour:', pharmacyId);
      
      const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
      const status = response.data;
      
      setServiceStatus(status);
      
      if (status.in_service) {
        // ✅ En service - redirection normale
        console.log('✅ Pharmacie en service, redirection vers /dashboard');
        toast.success('Connexion réussie !');
        
        // Stocker l'authentification
        setAuth(userData, token);
        
        // Redirection avec un léger délai
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        // ❌ Hors service - afficher le modal d'alerte
        console.log('❌ Pharmacie hors service');
        setPendingUserData({ user: userData, token });
        setShowOutOfServiceModal(true);
      }
      
    } catch (err: any) {
      console.error('Erreur lors de la vérification du service:', err);
      
      // En cas d'erreur réseau, on permet l'accès par sécurité
      const isNetworkError = err.code === 'ERR_NETWORK' || 
                             err.message === 'Network Error' ||
                             err.message?.includes('NetworkError');
      
      if (isNetworkError) {
        console.warn('⚠️ Erreur réseau - accès autorisé par sécurité');
        toast.success('Connexion réussie !');
        setAuth(userData, token);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      } else {
        toast.error('Impossible de vérifier le statut du service');
        setAuth(userData, token);
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
      }
    }
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
      setNetworkFallback(false);
      
      console.log('🔑 Vérification clé super admin...');
      
      const response = await api.post('/auth/super-admin/verify-key', {
        key: superAdminKey
      });
      
      if (response.data.valid) {
        console.log('✅ Clé valide, redirection vers /superadmin-welcome');
        sessionStorage.setItem('super_admin_temp_key', superAdminKey);
        sessionStorage.setItem('super_admin_access_time', Date.now().toString());
        
        setShowSuperAdminModal(false);
        setSuperAdminKey('');
        
        setTimeout(() => {
          navigate('/superadmin-welcome', { replace: true });
        }, 100);
      } else {
        console.log('❌ Clé invalide');
        setSuperAdminKeyError('Clé d\'accès invalide');
      }
    } catch (error: any) {
      console.error('❌ Erreur vérification clé:', error);
      
      const errorMsg = error.response?.data?.detail || 'Erreur de connexion au serveur';
      
      const isDev = import.meta.env.DEV;
      setSuperAdminKeyError(isDev ? errorMsg : 'Erreur de vérification');
      
      const isNetworkError = error.code === 'ERR_NETWORK' || 
                             error.message === 'Network Error' ||
                             error.message?.includes('NetworkError');
      
      if (isNetworkError) {
        console.log('🌐 Erreur réseau - Mode fallback');
        setNetworkFallback(true);
        toast.error('Serveur indisponible, accès en mode dégradé', { duration: 5000 });
        
        sessionStorage.setItem('super_admin_temp_key', superAdminKey);
        sessionStorage.setItem('super_admin_fallback_mode', 'true');
        
        setTimeout(() => {
          setShowSuperAdminModal(false);
          setSuperAdminKey('');
          navigate('/superadmin-welcome', { replace: true });
        }, 1000);
      }
    } finally {
      setIsKeyVerifying(false);
    }
  };

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

      const { user: userData, access_token } = response.data;

      if (!userData || !access_token) {
        throw new Error('Réponse invalide du serveur');
      }

      console.log('✅ Connexion réussie - Rôle:', userData.role);

      // Normaliser l'utilisateur
      const normalizedUser = normalizeUser(userData);
      
      // Vérifier si l'utilisateur a une pharmacie associée
      // Utiliser pharmacy_id ou tenant_id selon ce qui est disponible
      const pharmacyId = (normalizedUser as any).pharmacy_id || normalizedUser.tenant_id;
      
      if (!pharmacyId) {
        // Si pas de pharmacie, redirection directe
        console.log('⚠️ Utilisateur sans pharmacie associée');
        setAuth(normalizedUser, access_token);
        toast.success('Connexion réussie !');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 100);
        return;
      }
      
      // ✅ Vérifier le statut de service AVANT de rediriger
      await checkServiceStatusAndRedirect(
        pharmacyId,
        normalizedUser,
        access_token
      );

    } catch (err: any) {
      console.error('❌ Erreur connexion:', err);
      
      const status = err?.response?.status;
      const errorData = err?.response?.data;
      const detail = errorData?.detail;

      let msg = 'Erreur de connexion. Veuillez réessayer.';

      if (typeof detail === 'string') {
        if (detail.includes('email') || detail.includes('mot de passe')) {
          msg = 'Email ou mot de passe incorrect.';
        } else if (detail.includes('inactif') || detail.includes('désactivé')) {
          msg = 'Votre compte est désactivé. Contactez l\'administrateur.';
        } else if (detail.includes('abonnement')) {
          msg = 'Abonnement requis pour accéder à la plateforme.';
        } else {
          msg = detail;
        }
      } else if (status === 401) {
        msg = 'Email ou mot de passe incorrect.';
      } else if (status === 403) {
        msg = 'Accès refusé. Votre compte n\'a pas les droits nécessaires.';
      } else if (status === 402) {
        msg = 'Abonnement requis. Veuillez souscrire un abonnement.';
        toast.error('Abonnement requis', { icon: '💰' });
      } else if (status === 429) {
        msg = 'Trop de tentatives. Veuillez réessayer dans quelques minutes.';
      } else if (!status) {
        msg = 'Impossible de contacter le serveur. Vérifiez votre connexion.';
      }

      setError(msg);
      
      if (status !== 402) {
        toast.error(msg);
      }
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
      toast.success('Code envoyé ! Vérifiez vos emails');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const errorMsg = typeof detail === 'string' && detail.trim()
        ? detail
        : "Impossible d'envoyer le code. Vérifiez votre email.";
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
      }, 2000);
      
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const errorMsg = typeof detail === 'string' && detail.trim()
        ? detail
        : 'Code invalide ou expiré. Veuillez réessayer.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Gère la redirection vers OutOfService après confirmation du modal
   */
  const handleGoToOutOfService = () => {
    if (pendingUserData) {
      // Stocker l'authentification quand même pour pouvoir afficher la page hors service
      setAuth(pendingUserData.user, pendingUserData.token);
    }
    setShowOutOfServiceModal(false);
    navigate('/out-of-service', { replace: true, state: { serviceStatus } });
  };
  
  /**
   * Gère la tentative de reconnexion
   */
  const handleRetryCheck = async () => {
    if (!pendingUserData?.user?.pharmacy_id && !pendingUserData?.user?.tenant_id) {
      // Pas de pharmacie, redirection normale
      setAuth(pendingUserData!.user, pendingUserData!.token);
      setShowOutOfServiceModal(false);
      navigate('/dashboard', { replace: true });
      return;
    }
    
    const pharmacyId = pendingUserData!.user.pharmacy_id || pendingUserData!.user.tenant_id;
    
    try {
      const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
      const status = response.data;
      
      setServiceStatus(status);
      
      if (status.in_service) {
        // Maintenant en service
        setAuth(pendingUserData!.user, pendingUserData!.token);
        setShowOutOfServiceModal(false);
        toast.success('La pharmacie est maintenant en service !');
        navigate('/dashboard', { replace: true });
      } else {
        // Toujours hors service
        toast.error('La pharmacie est toujours hors service');
      }
    } catch (err) {
      console.error('Erreur lors de la revérification:', err);
      toast.error('Impossible de vérifier le statut du service');
    }
  };

  // Convertir l'heure UTC en heure locale pour l'affichage
  const convertUTCToLocal = (utcTime: string): string => {
    if (!utcTime) return '';
    const [hours, minutes] = utcTime.split(':').map(Number);
    const date = new Date();
    date.setUTCHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4 relative">
      {/* Bouton Super Admin */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => {
            setShowSuperAdminModal(true);
            setNetworkFallback(false);
            setSuperAdminKeyError('');
            setSuperAdminKey('');
          }}
          className="group relative w-14 h-14 bg-linear-to-br from-gray-800 to-gray-900 hover:from-red-600 hover:to-red-700 rounded-full flex items-center justify-center shadow-2xl shadow-gray-900/30 hover:shadow-red-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Accès Super Admin"
        >
          <span className="absolute inset-0 rounded-full bg-red-500/30 animate-ping opacity-0 group-hover:opacity-100" />
          <span className="absolute inset-0 rounded-full border-2 border-red-500/50 opacity-0 group-hover:opacity-100" />
          <Shield size={24} className="text-white drop-shadow-lg relative z-10" />
        </button>
      </div>

      {/* Modal Super Admin */}
      {showSuperAdminModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-100 bg-linear-to-r from-gray-800 to-gray-900">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/30">
                  <Shield className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Accès Super Admin</h2>
                  <p className="text-sm text-gray-300">Zone réservée aux administrateurs</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSuperAdminModal(false);
                  setSuperAdminKey('');
                  setSuperAdminKeyError('');
                  setNetworkFallback(false);
                }}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6">
              {networkFallback && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
                  <WifiOff size={18} className="text-yellow-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-700">
                    <p className="font-medium">Mode dégradé</p>
                    <p>Connexion au serveur impossible. Accès en mode local.</p>
                  </div>
                </div>
              )}

              <p className="text-sm text-gray-600 mb-4">
                Veuillez entrer la clé d'accès pour accéder à l'interface super administrateur.
              </p>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clé d'accès (25 caractères)
                </label>
                <input
                  type="password"
                  value={superAdminKey}
                  onChange={(e) => {
                    setSuperAdminKey(e.target.value.toUpperCase());
                    setSuperAdminKeyError('');
                  }}
                  maxLength={25}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 font-mono text-center tracking-wider transition-all ${
                    superAdminKeyError ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-red-500'
                  }`}
                  placeholder="•••••••••••••••••••••••••"
                  autoFocus
                  disabled={isKeyVerifying}
                />
                {superAdminKeyError && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {superAdminKeyError}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">{superAdminKey.length}/25 caractères</p>
                  {superAdminKey.length === 25 && !superAdminKeyError && (
                    <p className="text-xs text-green-500 flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      Longueur valide
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleSuperAdminAccess}
                  disabled={isKeyVerifying || superAdminKey.length !== 25}
                  className="flex-1 py-3 bg-linear-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isKeyVerifying ? (
                    <><Loader2 className="animate-spin" size={18} /> Vérification...</>
                  ) : networkFallback ? (
                    <><RefreshCw size={18} /> Accès local</>
                  ) : (
                    <><KeyRound size={18} /> Accéder</>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSuperAdminModal(false);
                    setSuperAdminKey('');
                    setSuperAdminKeyError('');
                    setNetworkFallback(false);
                  }}
                  className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
              
              <p className="mt-4 text-xs text-center text-gray-400">
                ⚠️ Cette clé vous a été fournie par l'administrateur système
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hors Service */}
      {showOutOfServiceModal && serviceStatus && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-100 bg-linear-to-r from-amber-500 to-orange-600">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Clock className="text-white" size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Hors Service</h2>
                  <p className="text-sm text-white/80">La pharmacie n'est pas disponible</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-600 mb-4">
                {serviceStatus.message || "L'application n'est pas disponible pour le moment. Veuillez respecter les heures de service établies."}
              </p>

              <div className="bg-amber-50 p-4 rounded-xl space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Heures de service:</span>
                  <span className="font-medium text-slate-700">
                    {serviceStatus.working_hours?.start || '--'}:00 - {serviceStatus.working_hours?.end || '--'}:00
                  </span>
                </div>
                
                <div className="flex justify-between text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
                  <span>Votre heure locale:</span>
                  <span className="font-medium">
                    {convertUTCToLocal(serviceStatus.working_hours?.start || '08:00')} - {convertUTCToLocal(serviceStatus.working_hours?.end || '20:00')}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 text-sm">Jour actuel:</span>
                  <div className="mt-1">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      serviceStatus.is_working_day 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {serviceStatus.is_working_day ? 'Jour ouvré' : 'Jour fermé'}
                    </span>
                  </div>
                </div>

                {serviceStatus.next_service_time && (
                  <p className="text-sm text-blue-600 mt-2">
                    Prochain service: {new Date(serviceStatus.next_service_time).toLocaleString('fr-FR')}
                  </p>
                )}

                <div className="text-xs text-slate-400 pt-2 border-t border-amber-200">
                  <p>Fuseau horaire de la pharmacie: {serviceStatus.timezone || 'UTC'}</p>
                  <p>• L'accès est restreint en dehors des heures de service</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleGoToOutOfService}
                  className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  <Clock size={18} />
                  Voir les détails
                </button>
                <button
                  onClick={handleRetryCheck}
                  className="px-4 py-3 border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire principal */}
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div className="p-8">
          {/* Logo et titre */}
          <div className="flex flex-col items-center mb-8">
            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg transition-all ${
              mode === 'login'
                ? 'bg-linear-to-br from-red-500 to-red-600 shadow-red-200'
                : 'bg-linear-to-br from-blue-500 to-blue-600 shadow-blue-200'
            }`}>
              {mode === 'login' ? <Shield size={32} /> : <KeyRound size={32} />}
            </div>
            <h1 className="text-3xl font-bold text-slate-800">
              {mode === 'login' ? 'MediGest Pro' : mode === 'forgot_password' ? 'Récupération' : 'Nouveau mot de passe'}
            </h1>
            <p className="text-slate-500 text-sm mt-2 text-center max-w-xs">
              {mode === 'login' 
                ? 'Gérez votre officine en toute sécurité' 
                : mode === 'forgot_password'
                ? 'Un code de vérification vous sera envoyé par email'
                : 'Entrez le code reçu et votre nouveau mot de passe'}
            </p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl text-red-700 text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-200">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <p className="flex-1">{error}</p>
            </div>
          )}
          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-xl text-green-700 text-sm flex items-start gap-3 animate-in slide-in-from-top-2 duration-200">
              <CheckCircle2 size={20} className="shrink-0 mt-0.5" />
              <p className="flex-1">{successMsg}</p>
            </div>
          )}

          {/* Formulaire de connexion */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Adresse email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@pharmacie.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
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
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                className="w-full py-4 bg-linear-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg shadow-red-200 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Se connecter'}
              </button>
            </form>
          )}

          {/* Formulaire demande reset */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email du compte</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <button
                disabled={isLoading}
                type="submit"
                className="w-full py-4 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Envoyer le code</>}
              </button>

              <button
                type="button"
                onClick={() => setMode('login')}
                className="w-full text-slate-500 text-sm flex items-center justify-center gap-2 hover:text-slate-700 py-2 transition-colors"
              >
                <ArrowLeft size={16} /> Retour à la connexion
              </button>
            </form>
          )}

          {/* Formulaire confirmation reset */}
          {mode === 'confirm_reset' && (
            <form onSubmit={handleConfirmReset} className="space-y-5">
              <div className="p-4 bg-blue-50 text-blue-700 text-xs rounded-xl border border-blue-100 text-center">
                📱 Un code à 6 chiffres a été envoyé à <strong>{email}</strong>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Code de vérification</label>
                <input
                  required
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl tracking-[0.5em] font-black py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                  disabled={isLoading}
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
                    placeholder="Minimum 8 caractères"
                    className="w-full px-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    disabled={isLoading}
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-400">Au moins 8 caractères</p>
              </div>

              <button
                disabled={isLoading || resetCode.length !== 6 || newPassword.length < 8}
                type="submit"
                className="w-full py-4 bg-linear-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : 'Réinitialiser'}
              </button>
              
              <button
                type="button"
                onClick={() => setMode('forgot_password')}
                className="w-full text-slate-500 text-sm flex items-center justify-center gap-2 hover:text-slate-700 py-2 transition-colors"
              >
                <ArrowLeft size={16} /> Demander un nouveau code
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
              <p className="text-center text-xs text-slate-400">
                💡 Après inscription, vous devrez choisir un abonnement pour accéder à la plateforme
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}