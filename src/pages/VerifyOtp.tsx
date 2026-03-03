import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  LogIn,
  Mail,
  MessageCircle,
  Edit2,
} from 'lucide-react';

import { authService } from '@/services/authService';
import { useAuthStore } from '@/store/useAuthStore';

type ResendMethod = 'sms' | 'whatsapp' | 'email';
type VerificationStatus = 'pending' | 'verifying' | 'success' | 'error';

// Interface pour l'utilisateur du store
interface User {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id: string;
  activated: boolean;
}

// Fonction pour mapper la réponse utilisateur au format du store
function mapUserToStore(userData: any): User | null {
  if (!userData) return null;

  // Extraction des champs avec gestion des différentes conventions
  const id = userData.id || userData.user_id;
  const email = userData.email;
  const role = userData.role || userData.user_role || 'user';
  const nom_complet = userData.nom_complet || userData.full_name || userData.name;
  const tenant_id = userData.tenant_id || userData.tenantId;
  
  // Gestion de l'activation (peut venir sous différentes formes)
  const activated = 
    userData.activated === true || 
    userData.actif === true || 
    userData.is_active === true ||
    userData.isActivated === true;

  // Vérification que tous les champs requis sont présents
  if (!id || !email || !nom_complet || !tenant_id) {
    console.warn('Champs utilisateur manquants:', { id, email, nom_complet, tenant_id });
    return null;
  }

  return {
    id: String(id),
    email: String(email).toLowerCase(),
    role: String(role),
    nom_complet: String(nom_complet),
    tenant_id: String(tenant_id),
    activated,
  };
}

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { user, isAuthenticated, setAuth } = useAuthStore();
  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('pending');
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResendOptions, setShowResendOptions] = useState(false);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Vérification de l'autorisation au chargement
  useEffect(() => {
    const checkAuthorization = async () => {
      try {
        // Si l'utilisateur est déjà authentifié et activé, rediriger vers dashboard
        if (isAuthenticated && user?.activated) {
          navigate('/dashboard');
          return;
        }

        // Si l'email est manquant, rediriger vers login
        if (!email) {
          navigate('/login');
          return;
        }

        // Focus sur le premier input
        setTimeout(() => {
          inputs.current[0]?.focus();
        }, 100);

      } catch (error) {
        console.error('Erreur de vérification:', error);
        setErrorMsg('Impossible de vérifier votre statut. Veuillez réessayer.');
      }
    };

    checkAuthorization();
  }, [email, isAuthenticated, user?.activated, navigate]);

  // Timer pour le renvoi du code
  useEffect(() => {
    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);
    setVerificationStatus('verifying');

    if (!email) {
      setErrorMsg('Email manquant.');
      setVerificationStatus('error');
      return;
    }

    const fullCode = otp.join('');
    if (fullCode.length !== 6) {
      setVerificationStatus('error');
      return;
    }

    try {
      // Utilisation de verifySms du authService
      const response = await authService.verifySms(email, fullCode);

      if (!response?.access_token) {
        throw new Error('Token manquant dans la réponse');
      }

      // Mapper l'utilisateur au format du store
      const mappedUser = mapUserToStore(response.user);
      
      if (!mappedUser) {
        throw new Error('Données utilisateur incomplètes');
      }

      // Mise à jour du store
      setAuth(mappedUser, response.access_token);
      
      setVerificationStatus('success');
      
      // Redirection après un court délai
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);

    } catch (err: any) {
      console.error('Erreur de vérification:', err);
      
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string' 
        ? detail 
        : err?.message || 'Code incorrect ou expiré.';

      setErrorMsg(msg);
      setOtp(['', '', '', '', '', '']);
      setVerificationStatus('error');
      
      // Refocus sur le premier input
      setTimeout(() => {
        inputs.current[0]?.focus();
      }, 100);
    }
  };

  const handleResend = async (method: ResendMethod) => {
    if (!email) {
      setErrorMsg('Email manquant.');
      return;
    }
    
    if (timer > 0 || verificationStatus === 'verifying') return;

    setVerificationStatus('verifying');
    setShowResendOptions(false);
    setErrorMsg(null);

    try {
      // Le backend ne supporte que resendSms pour l'instant
      // On passe la méthode comme paramètre optionnel si supporté
      await authService.resendSms(email, method);
      
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      setVerificationStatus('pending');
      
      setTimeout(() => {
        inputs.current[0]?.focus();
      }, 100);
      
    } catch (err: any) {
      console.error('Erreur renvoi:', err);
      
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : err?.message || "Échec de l'envoi du code.";
      
      setErrorMsg(msg);
      setVerificationStatus('error');
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Ne permettre que les chiffres
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Focus automatique sur le prochain input
    if (value !== '' && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // Si tous les chiffres sont saisis, vérifier automatiquement
    if (index === 5 && value !== '' && newOtp.every(digit => digit !== '')) {
      handleVerify();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Gestion de la touche Backspace
    if (e.key === 'Backspace') {
      if (otp[index] === '' && index > 0) {
        // Si l'input courant est vide, aller à l'input précédent
        inputs.current[index - 1]?.focus();
      } else if (otp[index] !== '') {
        // Si l'input courant a une valeur, l'effacer
        const newOtp = [...otp];
        newOtp[index] = '';
        setOtp(newOtp);
      }
    }
    
    // Gestion des flèches
    if (e.key === 'ArrowLeft' && index > 0) {
      inputs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowRight' && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');
    
    if (digits.length > 0) {
      const newOtp = [...otp];
      digits.forEach((digit, index) => {
        if (index < 6) newOtp[index] = digit;
      });
      setOtp(newOtp);
      
      // Focus sur le dernier input rempli ou le suivant
      const focusIndex = Math.min(digits.length, 5);
      inputs.current[focusIndex]?.focus();
      
      // Si on a 6 chiffres, vérifier automatiquement
      if (digits.length === 6) {
        setTimeout(() => handleVerify(), 100);
      }
    }
  };

  // Si l'utilisateur est déjà autorisé, ne pas afficher la page
  if (isAuthenticated && user?.activated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100 relative overflow-hidden">
        {/* Animation de succès */}
        {verificationStatus === 'success' && (
          <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-in fade-in">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Compte vérifié !</h2>
            <p className="text-slate-500 text-sm mt-2">Redirection en cours...</p>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Vérification à deux facteurs
          </h1>

          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-slate-500 text-sm font-medium">{email}</span>
            <button
              onClick={() => navigate('/register')}
              className="p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
              type="button"
              aria-label="Modifier l'email"
            >
              <Edit2 size={12} />
            </button>
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Entrez le code à 6 chiffres envoyé sur votre téléphone
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center justify-center gap-2 border border-red-100">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="flex justify-between gap-2 mb-8">
            {otp.map((digit, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                disabled={verificationStatus === 'verifying' || verificationStatus === 'success'}
                className={`w-12 h-14 text-center text-2xl font-bold bg-slate-50 border-2 rounded-xl outline-none transition-all
                  ${verificationStatus === 'error' 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-slate-100 focus:border-blue-500'
                  }
                  ${digit ? 'border-blue-200 bg-blue-50' : ''}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
                aria-label={`Chiffre ${index + 1} du code`}
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={
              verificationStatus === 'verifying' || 
              verificationStatus === 'success' || 
              otp.join('').length < 6
            }
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
          >
            {verificationStatus === 'verifying' ? (
              <>
                <RefreshCw className="animate-spin" size={20} />
                Vérification en cours...
              </>
            ) : (
              'Vérifier le code'
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          {!showResendOptions ? (
            <div>
              <p className="text-slate-400 text-sm">Vous n'avez pas reçu de code ?</p>
              <button
                onClick={() => timer === 0 && setShowResendOptions(true)}
                type="button"
                disabled={timer > 0 || verificationStatus === 'verifying'}
                className={`mt-2 font-bold text-sm transition-colors
                  ${timer > 0 || verificationStatus === 'verifying'
                    ? 'text-slate-300 cursor-not-allowed' 
                    : 'text-blue-600 hover:text-blue-700'
                  }`}
              >
                {timer > 0 ? `Renvoyer le code dans ${timer}s` : 'Renvoyer le code'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <p className="text-slate-800 text-sm font-bold mb-3 uppercase tracking-wider">
                Choisir la méthode
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleResend('sms')}
                  disabled={verificationStatus === 'verifying'}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <Smartphone size={18} className="text-blue-500" /> Par SMS
                  </div>
                  <ArrowLeft size={14} className="rotate-180 text-slate-300" />
                </button>

                <button
                  type="button"
                  onClick={() => handleResend('whatsapp')}
                  disabled={verificationStatus === 'verifying'}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-green-50 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <MessageCircle size={18} className="text-green-500" /> Par WhatsApp
                  </div>
                  <ArrowLeft size={14} className="rotate-180 text-slate-300" />
                </button>

                <button
                  type="button"
                  onClick={() => handleResend('email')}
                  disabled={verificationStatus === 'verifying'}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-purple-50 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-purple-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <Mail size={18} className="text-purple-500" /> Par Email
                  </div>
                  <ArrowLeft size={14} className="rotate-180 text-slate-300" />
                </button>
              </div>
              <button 
                type="button" 
                onClick={() => setShowResendOptions(false)} 
                className="text-xs text-slate-400 mt-2 font-bold hover:text-slate-600 transition-colors"
              >
                ANNULER
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-8 flex items-center justify-center gap-2 w-full text-sm text-slate-500 font-bold hover:text-blue-600 transition-colors"
        >
          <LogIn size={16} /> Retour à la connexion
        </button>
      </div>
    </div>
  );
}