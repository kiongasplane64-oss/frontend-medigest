import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Shield, LogIn, UserPlus, Loader2, Eye, EyeOff,
  ArrowRight, WifiOff, ShieldAlert
} from 'lucide-react';
import api from '@/api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { normalizeUser, LoginResponse, SetupResponse } from '@/types/auth';

interface LoginData { email: string; password: string; }
interface SetupData { email: string; password: string; nom_complet: string; setup_key: string; }

export default function SuperAdminWelcome() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, isSuperAdmin, isLoading: authLoading } = useAuthStore();
  
  // États UI
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [visibility, setVisibility] = useState({ password: false });
  
  // États d'accès
  const [isChecking, setIsChecking] = useState(true);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const checkPerformed = useRef(false);

  // Formulaires
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [createData, setCreateData] = useState({
    email: '', password: '', confirmPassword: '', nom_complet: '', setup_key: ''
  });

  const [errors, setErrors] = useState({ login: '', create: '' });
  const [createSuccess, setCreateSuccess] = useState('');

  // 1. GARDE-FOU : Redirection automatique si déjà connecté
  useEffect(() => {
    if (!authLoading && isAuthenticated && isSuperAdmin()) {
      console.log('✅ Déjà authentifié en tant que Super Admin, redirection vers /super-admin');
      navigate('/super-admin', { replace: true });
    }
  }, [isAuthenticated, isSuperAdmin, authLoading, navigate]);

  // 2. LOGIQUE DE VÉRIFICATION DE LA CLÉ
  const verifyKeyOnServer = useCallback(async (key: string) => {
    try {
      const { data } = await api.post('/auth/super-admin/verify-key', { key });
      
      if (data.valid) {
        setKeyValid(true);
        console.log('✅ Clé super admin valide');
      } else {
        setKeyValid(false);
        toast.error("Clé d'accès invalide.");
      }
    } catch (error: any) {
      const isNetworkError = error.code === 'ERR_NETWORK' || error.message?.includes('Network');
      if (isNetworkError) {
        setKeyValid(true);
        setIsFallbackMode(true);
        toast.error("Serveur injoignable. Mode local activé.");
      } else {
        setKeyValid(false);
        toast.error("Erreur de vérification.");
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    if (checkPerformed.current) return;
    checkPerformed.current = true;

    const tempKey = sessionStorage.getItem('super_admin_temp_key');
    if (!tempKey) {
      navigate('/login', { replace: true });
      return;
    }

    setStoredKey(tempKey);
    verifyKeyOnServer(tempKey);
  }, [navigate, verifyKeyOnServer]);

  // --- MUTATIONS AVEC SAUVEGARDE EXPLICITE DU TOKEN ---

  const loginMutation = useMutation({
    mutationFn: (data: LoginData) => api.post<LoginResponse>('/auth/login', data).then(res => res.data),
    onSuccess: (data) => {
      console.log('🔐 Réponse login reçue:', {
        hasToken: !!data.access_token,
        userRole: data.user?.role,
        userEmail: data.user?.email
      });

      if (data.user.role !== 'super_admin') {
        setErrors(prev => ({ ...prev, login: "Accès réservé au Super Admin." }));
        return;
      }

      if (!data.access_token) {
        console.error('❌ Pas de token dans la réponse');
        setErrors(prev => ({ ...prev, login: "Erreur d'authentification: token manquant" }));
        return;
      }

      // Normaliser l'utilisateur
      const normalizedUser = normalizeUser(data.user);
      
      console.log('💾 Sauvegarde du token et de l\'utilisateur...');
      
      // ✅ Sauvegarde explicite dans localStorage AVANT setAuth
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      // Sauvegarder le refresh token s'il existe (optionnel)
      const refreshToken = (data as any).refresh_token;
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
      
      console.log('✅ Données sauvegardées dans localStorage:', {
        tokenLength: data.access_token.length,
        userRole: normalizedUser.role,
        userEmail: normalizedUser.email,
        hasRefreshToken: !!refreshToken
      });
      
      // Mettre à jour le store
      setAuth(normalizedUser, data.access_token, refreshToken || null);
      
      toast.success("Bienvenue, Super Admin !");
      sessionStorage.removeItem('super_admin_temp_key');
      
      // ✅ Attendre un court instant pour que le store soit mis à jour
      setTimeout(() => {
        console.log('🚀 Navigation vers /super-admin');
        navigate('/super-admin', { replace: true });
      }, 100);
    },
    onError: (err: any) => {
      console.error('❌ Erreur login:', err);
      setErrors(prev => ({ ...prev, login: err.response?.data?.detail || "Erreur de connexion." }));
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: SetupData) => api.post<SetupResponse>('/auth/super-admin/setup', data).then(res => res.data),
    onSuccess: (data) => {
      setCreateSuccess("Super administrateur créé !");
      if (data.credentials) {
        alert(`IDENTIFIANTS GÉNÉRÉS :\nEmail: ${data.credentials.email}\nPass: ${data.credentials.password}`);
      }
      setTimeout(() => setMode('login'), 2000);
    },
    onError: (err: any) => {
      setErrors(prev => ({ ...prev, create: err.response?.data?.detail || "Erreur lors de la création." }));
    }
  });

  const cleanExit = () => {
    sessionStorage.removeItem('super_admin_temp_key');
    navigate('/login', { replace: true });
  };

  // Affichage du loader pendant la vérification initiale
  if (isChecking || authLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={40} />
      </div>
    );
  }

  // Écran d'erreur si la clé est invalide
  if (keyValid === false) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 text-center shadow-2xl">
          <ShieldAlert className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-2xl font-bold mb-6 text-gray-800">Accès non autorisé</h2>
          <button onClick={cleanExit} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors">
            Retour au portail
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <header className="text-center mb-8">
          <div className="inline-flex h-16 w-16 bg-red-600 rounded-xl items-center justify-center mb-4 shadow-lg">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white">Administration Système</h1>
          {isFallbackMode && (
            <span className="text-xs text-yellow-500 flex items-center justify-center gap-1 mt-1">
              <WifiOff size={12}/> Mode Hors-ligne
            </span>
          )}
        </header>

        <nav className="bg-gray-800 rounded-xl p-1 mb-6 flex">
          <button 
            onClick={() => { setMode('login'); setErrors({login:'', create:''}); }} 
            className={`flex-1 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${mode === 'login' ? 'bg-red-500 text-white' : 'text-gray-400'}`}
          >
            <LogIn size={16} /> Connexion
          </button>
          <button 
            onClick={() => { setMode('create'); setErrors({login:'', create:''}); }} 
            className={`flex-1 py-2 rounded-lg text-sm transition-all flex items-center justify-center gap-2 ${mode === 'create' ? 'bg-red-500 text-white' : 'text-gray-400'}`}
          >
            <UserPlus size={16} /> Création
          </button>
        </nav>

        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          {mode === 'login' ? (
            <form onSubmit={(e) => { e.preventDefault(); loginMutation.mutate(loginData); }} className="space-y-4">
              {errors.login && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{errors.login}</div>}
              <input 
                type="email" 
                placeholder="Email Super Admin" 
                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-red-500 outline-hidden" 
                onChange={e => setLoginData({...loginData, email: e.target.value})} 
                required 
              />
              <div className="relative">
                <input 
                  type={visibility.password ? 'text' : 'password'} 
                  placeholder="Mot de passe" 
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-red-500 outline-hidden" 
                  onChange={e => setLoginData({...loginData, password: e.target.value})} 
                  required 
                />
                <button type="button" onClick={() => setVisibility({password: !visibility.password})} className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600">
                  {visibility.password ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button 
                disabled={loginMutation.isPending} 
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-70"
              >
                {loginMutation.isPending ? <Loader2 className="animate-spin" /> : <>Se connecter <ArrowRight size={18}/></>}
              </button>
            </form>
          ) : (
            <form onSubmit={(e) => {
              e.preventDefault();
              if (createData.password !== createData.confirmPassword) return toast.error("Mots de passe différents");
              if (createData.password.length < 8) return toast.error("Le mot de passe doit faire 8 caractères minimum");
              createMutation.mutate({ ...createData, setup_key: storedKey || '' });
            }} className="space-y-4">
              {errors.create && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{errors.create}</div>}
              {createSuccess && <div className="text-green-600 text-sm bg-green-50 p-3 rounded-lg border border-green-100">{createSuccess}</div>}
              <input 
                placeholder="Nom complet" 
                className="w-full p-3 border rounded-xl outline-hidden" 
                onChange={e => setCreateData({...createData, nom_complet: e.target.value})} 
                required 
              />
              <input 
                type="email" 
                placeholder="Email" 
                className="w-full p-3 border rounded-xl outline-hidden" 
                onChange={e => setCreateData({...createData, email: e.target.value})} 
                required 
              />
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="password" 
                  placeholder="Mot de passe" 
                  className="w-full p-3 border rounded-xl outline-hidden" 
                  onChange={e => setCreateData({...createData, password: e.target.value})} 
                  required 
                />
                <input 
                  type="password" 
                  placeholder="Confirmer" 
                  className="w-full p-3 border rounded-xl outline-hidden" 
                  onChange={e => setCreateData({...createData, confirmPassword: e.target.value})} 
                  required 
                />
              </div>
              <button 
                disabled={createMutation.isPending} 
                className="w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-colors disabled:opacity-70"
              >
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : "Initialiser le système"}
              </button>
            </form>
          )}
          <button onClick={cleanExit} className="w-full text-center text-xs text-gray-400 mt-6 hover:text-red-500 transition-colors">
            Annuler et retourner au portail standard
          </button>
        </div>
      </div>
    </div>
  );
}