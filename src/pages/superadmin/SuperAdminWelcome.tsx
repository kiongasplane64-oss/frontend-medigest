import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Shield, LogIn, UserPlus, Loader2, Eye, EyeOff,
  ArrowRight, WifiOff, ShieldAlert, Copy, Check
} from 'lucide-react';
import api from '@/api/client';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/useAuthStore';
import { normalizeUser, LoginResponse, SetupResponse } from '@/types/auth';

interface LoginData { key: string; } // Changé: plus besoin d'email/password
interface SetupData { email: string; password: string; nom_complet: string; setup_key: string; }

interface SuperAdminLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  access_type: string;
  user: {
    id: string;
    email: string;
    nom_complet: string;
    role: string;
    is_newly_created?: boolean;
  };
  temp_password?: string;
  message?: string;
}

export default function SuperAdminWelcome() {
  const navigate = useNavigate();
  const { setAuth, isAuthenticated, isSuperAdmin, isLoading: authLoading } = useAuthStore();
  
  // États UI
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [visibility, setVisibility] = useState({ password: false });
  const [copied, setCopied] = useState(false);
  
  // États d'accès
  const [isChecking, setIsChecking] = useState(true);
  const [keyValid, setKeyValid] = useState<boolean | null>(null);
  const [storedKey, setStoredKey] = useState<string | null>(null);
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{ email: string; password: string } | null>(null);
  const checkPerformed = useRef(false);

  // Formulaires
  const [loginData, setLoginData] = useState({ key: '' });
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

  // 2. LOGIQUE DE VÉRIFICATION DE LA CLÉ (maintenant via le nouveau endpoint)
  const verifyKeyOnServer = useCallback(async (key: string) => {
    try {
      // Utiliser le nouveau endpoint qui vérifie ET génère un token
      const { data } = await api.post<SuperAdminLoginResponse>('/auth/super-admin/login', { key });
      
      if (data.access_token) {
        setKeyValid(true);
        console.log('✅ Clé super admin valide, token généré');
        
        // Si c'est une nouvelle création, stocker les identifiants temporaires
        if (data.user.is_newly_created && data.temp_password) {
          setTempCredentials({
            email: data.user.email,
            password: data.temp_password
          });
          toast.success("Compte Super Admin créé automatiquement !");
        } else {
          toast.success("Authentification réussie !");
        }
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
        const errorMsg = error.response?.data?.detail || "Clé d'accès invalide.";
        toast.error(errorMsg);
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

  // NOUVEAU: Mutation pour le login super admin avec clé (token 100 ans)
  const superAdminLoginMutation = useMutation({
    mutationFn: (data: LoginData) => api.post<SuperAdminLoginResponse>('/auth/super-admin/login', data).then(res => res.data),
    onSuccess: (data) => {
      console.log('🔐 Réponse super admin login reçue:', {
        hasToken: !!data.access_token,
        userRole: data.user?.role,
        userEmail: data.user?.email,
        expiresIn: data.expires_in,
        expiresInYears: (data.expires_in / (365 * 24 * 60 * 60)).toFixed(0)
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
      
      console.log('💾 Sauvegarde du token (100 ans) et de l\'utilisateur...');
      
      // ✅ Sauvegarde explicite dans localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      
      // Sauvegarder le refresh token
      if (data.refresh_token) {
        localStorage.setItem('refresh_token', data.refresh_token);
      }
      
      // Optionnel: sauvegarder l'expiration (pour info)
      localStorage.setItem('token_expires_at', (Date.now() + data.expires_in * 1000).toString());
      
      console.log('✅ Données sauvegardées dans localStorage:', {
        tokenLength: data.access_token.length,
        userRole: normalizedUser.role,
        userEmail: normalizedUser.email,
        tokenValidYears: (data.expires_in / (365 * 24 * 60 * 60)).toFixed(0)
      });
      
      // Mettre à jour le store
      setAuth(normalizedUser, data.access_token, data.refresh_token || null);
      
      // Afficher un message spécial pour le token 100 ans
      toast.success(`Bienvenue, Super Admin ! Token valable ${(data.expires_in / (365 * 24 * 60 * 60)).toFixed(0)} ans.`);
      
      sessionStorage.removeItem('super_admin_temp_key');
      
      // Nettoyer les identifiants temporaires si présents
      setTempCredentials(null);
      
      // ✅ Navigation vers le dashboard
      setTimeout(() => {
        console.log('🚀 Navigation vers /super-admin');
        navigate('/super-admin', { replace: true });
      }, 100);
    },
    onError: (err: any) => {
      console.error('❌ Erreur login super admin:', err);
      setErrors(prev => ({ ...prev, login: err.response?.data?.detail || "Clé d'accès invalide." }));
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: SetupData) => api.post<SetupResponse>('/auth/super-admin/setup', data).then(res => res.data),
    onSuccess: (data) => {
      setCreateSuccess("Super administrateur créé !");
      if (data.credentials) {
        setTempCredentials({
          email: data.credentials.email,
          password: data.credentials.password
        });
        toast.success("Super Admin créé avec succès !");
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

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${type} copié !`);
    setTimeout(() => setCopied(false), 2000);
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

        {/* Affichage des identifiants temporaires si création récente */}
        {tempCredentials && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-green-800 text-sm">🔐 Identifiants générés</h3>
              <button 
                onClick={() => copyToClipboard(`${tempCredentials.email}\n${tempCredentials.password}`, "Identifiants")}
                className="text-green-600 hover:text-green-800"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-green-700 font-medium">Email:</span>
                <code className="ml-2 text-green-600 bg-green-100 px-2 py-1 rounded">{tempCredentials.email}</code>
              </div>
              <div>
                <span className="text-green-700 font-medium">Mot de passe:</span>
                <code className="ml-2 text-green-600 bg-green-100 px-2 py-1 rounded">{tempCredentials.password}</code>
              </div>
            </div>
            <p className="text-xs text-green-600 mt-3">
              ⚠️ Sauvegardez ces identifiants - ils ne seront plus affichés !
            </p>
          </div>
        )}

        <nav className="bg-gray-800 rounded-xl p-1 mb-6 flex">
          <button 
            onClick={() => { setMode('login'); setErrors({login:'', create:''}); setTempCredentials(null); }} 
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
            <form onSubmit={(e) => { e.preventDefault(); superAdminLoginMutation.mutate(loginData); }} className="space-y-4">
              {errors.login && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{errors.login}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Clé d'accès Super Admin
                </label>
                <input 
                  type="password" 
                  placeholder="Entrez votre clé d'accès" 
                  className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-red-500 outline-hidden font-mono" 
                  onChange={e => setLoginData({key: e.target.value})} 
                  required 
                />
                <p className="text-xs text-gray-500 mt-1">
                  Utilisez la clé fournie par l'administrateur système
                </p>
              </div>
              
              <button 
                disabled={superAdminLoginMutation.isPending} 
                className="w-full py-3 bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-70"
              >
                {superAdminLoginMutation.isPending ? <Loader2 className="animate-spin" /> : <>Se connecter <ArrowRight size={18}/></>}
              </button>
              
              <div className="text-center text-xs text-gray-400 border-t pt-4 mt-2">
                🔐 Token valable 100 ans - connexion unique et définitive
              </div>
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