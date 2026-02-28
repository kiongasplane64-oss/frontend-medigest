import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';
import { 
  Lock, Mail, Loader2, AlertCircle, UserPlus, 
  CheckCircle2, ArrowLeft, Send, KeyRound 
} from 'lucide-react';

type AuthMode = 'login' | 'forgot_password' | 'confirm_reset';

export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  
  // États de base
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // États pour la réinitialisation
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // --- LOGIQUE DE CONNEXION ---
  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);
  setError('');

  try {
    const response = await api.post('/auth/login', { email, password });
    
    // 1. Extraire les données de la réponse
    const { user, access_token } = response.data;

    // 2. Mettre à jour le store global
    setAuth(user, access_token);

    // 3. LOGIQUE DE REDIRECTION CORRIGÉE
    // Votre backend renvoie 'user.actif' (booléen)
    if (user.actif === true) {
      // Si le compte est déjà vérifié, direction Dashboard
      navigate('/dashboard');
    } else {
      // Uniquement si actif est false, on demande l'OTP
      navigate(`/verify-otp?email=${encodeURIComponent(user.email)}`);
    }

  } catch (err: any) {
    // Gestion des erreurs 403 (Comptes bloqués ou non activés selon votre backend)
    const errorData = err.response?.data;
    
    if (err.response?.status === 403 && errorData?.detail?.verification_required) {
      // Cas où le backend refuse la connexion car non activé (HTTP 403)
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
    } else {
      const errorMsg = errorData?.detail || "Erreur de connexion.";
      setError(typeof errorMsg === 'string' ? errorMsg : "Identifiants invalides.");
    }
  } finally {
    setIsLoading(false);
  }
};

  // --- LOGIQUE MOT DE PASSE OUBLIÉ (Demande) ---
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/password/reset/request', { email });
      setSuccessMsg("Code envoyé par SMS/WhatsApp.");
      setMode('confirm_reset');
    } catch (err: any) {
      setError("Impossible d'envoyer le code.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- LOGIQUE CONFIRMATION RÉINITIALISATION ---
  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.post('/auth/password/reset/confirm', { 
        email, 
        code: resetCode, 
        new_password: newPassword 
      });
      setSuccessMsg("Mot de passe modifié avec succès !");
      setMode('login');
      setNewPassword('');
    } catch (err: any) {
      setError(err.response?.data?.detail || "Code invalide ou expiré.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-8">
          
          {/* Header Dynamique */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-4 shadow-lg shadow-blue-200">
              {mode === 'login' ? <Lock size={24} /> : <KeyRound size={24} />}
            </div>
            <h2 className="text-2xl font-bold text-slate-800">
              {mode === 'login' ? 'PharmaSaaS ERP' : mode === 'forgot_password' ? 'Récupération' : 'Nouveau mot de passe'}
            </h2>
            <p className="text-slate-500 text-sm mt-1 text-center">
              {mode === 'login' ? 'Gérez votre officine en toute sécurité' : 'Un code vous sera envoyé par SMS/WhatsApp'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs flex items-center gap-3 animate-pulse">
              <AlertCircle size={16} />
              <p>{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 text-green-700 text-xs flex items-center gap-3">
              <CheckCircle2 size={16} />
              <p>{successMsg}</p>
            </div>
          )}

          {/* --- FORMULAIRE CONNEXION --- */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="email" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="nom@pharmacie.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Mot de passe</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="password" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                    placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode('forgot_password')} className="text-xs text-blue-600 hover:underline font-bold">
                  Mot de passe oublié ?
                </button>
              </div>
              <button disabled={isLoading} type="submit" className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Se connecter"}
              </button>
            </form>
          )}

          {/* --- FORMULAIRE MOT DE PASSE OUBLIÉ (DEMANDE) --- */}
          {mode === 'forgot_password' && (
            <form onSubmit={handleRequestReset} className="space-y-5 animate-in slide-in-from-right-4 duration-300">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirmez votre Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="email" required className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                    value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.com" />
                </div>
              </div>
              <button disabled={isLoading} type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Envoyer le code</>}
              </button>
              <button type="button" onClick={() => setMode('login')} className="w-full text-slate-500 text-sm flex items-center justify-center gap-2">
                <ArrowLeft size={16} /> Retour
              </button>
            </form>
          )}

          {/* --- FORMULAIRE CONFIRMATION (CODE + NOUVEAU MDP) --- */}
          {mode === 'confirm_reset' && (
            <form onSubmit={handleConfirmReset} className="space-y-5 animate-in slide-in-from-right-4">
              <div className="p-3 bg-blue-50 text-blue-700 text-[10px] rounded-lg border border-blue-100 uppercase tracking-widest font-bold text-center">
                Vérifiez vos messages (SMS/WhatsApp)
              </div>
              <div>
                <input required maxLength={6} className="w-full text-center text-2xl tracking-[1em] font-black py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl focus:border-blue-500 outline-none" 
                  placeholder="000000" value={resetCode} onChange={(e) => setResetCode(e.target.value)} />
              </div>
              <div>
                <input type="password" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" 
                  placeholder="Nouveau mot de passe" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <button disabled={isLoading} type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">
                {isLoading ? <Loader2 className="animate-spin" /> : "Réinitialiser"}
              </button>
            </form>
          )}

          {/* Footer d'inscription */}
          {mode === 'login' && (
            <div className="mt-8 pt-8 border-t border-slate-50">
              <Link to="/register" className="w-full py-3 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                <UserPlus size={18} /> Créer un compte 
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}