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

// ✅ type User EXACT du store (copié ici pour TS strict)
// (si tu préfères, exporte User depuis useAuthStore.ts et importe-le ici)
type StoreUser = {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id: string;
  activated: boolean;
};

function toStoreUser(payloadUser: any): StoreUser | null {
  if (!payloadUser) return null;

  const id = payloadUser.id;
  const email = payloadUser.email;
  const role = payloadUser.role;
  const nom_complet = payloadUser.nom_complet;
  const tenant_id = payloadUser.tenant_id;

  // ton backend renvoie parfois "activated" ou "actif"
  const activated =
    typeof payloadUser.activated === 'boolean'
      ? payloadUser.activated
      : typeof payloadUser.actif === 'boolean'
        ? payloadUser.actif
        : true; // après verify otp => on considère activé

  if (!id || !email || !role || !nom_complet || !tenant_id) return null;

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

  const setAuth = useAuthStore((state) => state.setAuth);
  const user = useAuthStore((state) => state.user);

  const email = searchParams.get('email') || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showResendOptions, setShowResendOptions] = useState(false);

  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (user?.activated === true) {
      navigate('/dashboard');
      return;
    }

    inputs.current[0]?.focus();

    const interval = setInterval(() => {
      setTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErrorMsg(null);

    if (!email) {
      setErrorMsg('Email manquant.');
      return;
    }

    const fullCode = otp.join('');
    if (fullCode.length !== 6) return;

    setLoading(true);
    try {
      const res = await authService.verifySms(email, fullCode);

      if (!res?.access_token) {
        setErrorMsg('Réponse invalide du serveur (token manquant).');
        return;
      }

      const mappedUser = toStoreUser(res.user);

      if (!mappedUser) {
        setErrorMsg(
          "Compte vérifié mais données utilisateur incomplètes. Mets à jour le backend pour renvoyer id/email/role/nom_complet/tenant_id."
        );
        return;
      }

      setAuth(mappedUser, res.access_token);

      setIsSuccess(true);
      navigate('/dashboard');
    } catch (err: any) {
      const detail = err?.response?.data?.detail;

      const msg =
        typeof detail === 'string'
          ? detail
          : detail?.message || 'Code incorrect ou expiré.';

      setErrorMsg(msg);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (_method: ResendMethod) => {
    // Backend actuel: /resend-sms ne prend que { email }
    if (!email) {
      setErrorMsg('Email manquant.');
      return;
    }
    if (timer > 0 || loading) return;

    setLoading(true);
    setShowResendOptions(false);
    setErrorMsg(null);

    try {
      await authService.resendSms(email);
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : detail?.message || "Échec de l'envoi du code.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100 relative overflow-hidden">
        {isSuccess && (
          <div className="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center animate-in fade-in">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 size={48} />
            </div>
            <h2 className="text-xl font-bold">Compte vérifié !</h2>
          </div>
        )}

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone size={32} />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Vérification</h1>

          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-slate-500 text-sm font-medium">{email}</span>
            <button
              onClick={() => navigate('/register')}
              className="p-1.5 bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
              type="button"
            >
              <Edit2 size={12} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center justify-center gap-2 border border-red-100">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div className="flex justify-between gap-2 mb-8">
            {otp.map((data, index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                maxLength={1}
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                value={data}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!/^\d*$/.test(val)) return;

                  const newOtp = [...otp];
                  newOtp[index] = val.substring(val.length - 1);
                  setOtp(newOtp);

                  if (val !== '' && index < 5) inputs.current[index + 1]?.focus();
                }}
                className="w-12 h-14 text-center text-2xl font-bold bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-blue-500 outline-none transition-all"
              />
            ))}
          </div>

          <button
            type="submit"
            disabled={loading || otp.join('').length < 6}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : 'Vérifier le code'}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
          {!showResendOptions ? (
            <div>
              <p className="text-slate-400 text-sm">Vous n'avez pas reçu de code ?</p>
              <button
                onClick={() => timer === 0 && setShowResendOptions(true)}
                type="button"
                disabled={timer > 0}
                className={`mt-2 font-bold text-sm ${timer > 0 ? 'text-slate-300' : 'text-blue-600'}`}
              >
                {timer > 0 ? `Renvoyer le code dans ${timer}s` : 'Renvoyer le code'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 animate-in slide-in-from-bottom-2">
              <p className="text-slate-800 text-sm font-bold mb-3 uppercase tracking-wider">Choisir la méthode</p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleResend('sms')}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-blue-50 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-blue-100"
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <Smartphone size={18} className="text-blue-500" /> Par SMS
                  </div>
                  <ArrowLeft size={14} className="rotate-180 text-slate-300" />
                </button>

                <button
                  type="button"
                  onClick={() => handleResend('whatsapp')}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-green-50 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-green-100"
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <MessageCircle size={18} className="text-green-500" /> Par WhatsApp
                  </div>
                  <ArrowLeft size={14} className="rotate-180 text-slate-300" />
                </button>

                <button
                  type="button"
                  onClick={() => handleResend('email')}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-purple-50 rounded-xl text-sm font-medium transition-colors border border-transparent hover:border-purple-100"
                >
                  <div className="flex items-center gap-3 text-slate-700">
                    <Mail size={18} className="text-purple-500" /> Par Email
                  </div>
                  <ArrowLeft size={14} className="rotate-180 text-slate-300" />
                </button>
              </div>
              <button type="button" onClick={() => setShowResendOptions(false)} className="text-xs text-slate-400 mt-2 font-bold">
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
          <LogIn size={16} /> Retour au Login
        </button>
      </div>
    </div>
  );
}