import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Smartphone,
  AlertCircle,
  CheckCircle2,
  Phone,
} from "lucide-react";

import { authService } from "@/services/authService";
import { useAuthStore } from "@/store/useAuthStore";

type VerificationStatus = "pending" | "verifying" | "success" | "error";

interface StoreUserLike {
  id?: string;
  email?: string;
  nom_complet?: string;
  role?: string;
  tenant_id?: string | null;
  telephone?: string;
  actif?: boolean;
  activated?: boolean;
}

interface VerifyOtpResponse {
  access_token: string;
  token_type?: string;
  subscription_active?: boolean;
  account_activated?: boolean;
  user?: {
    id: string | number;
    email: string;
    nom_complet?: string;
    role?: string;
    tenant_id?: string | null;
    telephone?: string;
    actif?: boolean;
    activated?: boolean;
  };
  tenant?: unknown;
  current_pharmacy?: unknown;
  pharmacies?: unknown[];
  message?: string;
}

export default function VerifyOtp() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, setAuth } = useAuthStore();

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [status, setStatus] = useState<VerificationStatus>("pending");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string>("");

  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const storeUser = user as StoreUserLike | null | undefined;
  const emailParam = searchParams.get("email") || storeUser?.email || "";

  const isUserActivated = useMemo(() => {
    return Boolean(storeUser?.actif === true || storeUser?.activated === true);
  }, [storeUser]);

  const getRedirectPath = useCallback((role?: string) => {
    const normalizedRole = (role || "").toLowerCase().trim();
    return normalizedRole === "super_admin" || normalizedRole === "superadmin"
      ? "/super-admin"
      : "/dashboard";
  }, []);

  useEffect(() => {
    if (storeUser?.telephone) {
      setPhoneNumber(storeUser.telephone);
    } else {
      setPhoneNumber("");
    }
  }, [storeUser]);

  // Redirection immédiate si déjà connecté et déjà activé
  useEffect(() => {
    if (isAuthenticated && isUserActivated) {
      navigate(getRedirectPath(storeUser?.role), { replace: true });
    }
  }, [isAuthenticated, isUserActivated, storeUser?.role, navigate, getRedirectPath]);

  // Si aucun email disponible et pas connecté -> retour login
  useEffect(() => {
    if (!emailParam && !isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [emailParam, isAuthenticated, navigate]);

  useEffect(() => {
    if (status === "pending") {
      const timer = window.setTimeout(() => {
        inputs.current[0]?.focus();
      }, 100);

      return () => window.clearTimeout(timer);
    }
  }, [status]);

  const formatPhoneNumber = (phone: string) => {
    if (!phone) return "";
    if (phone.startsWith("+243")) {
      return phone.replace("+243", "(+243) ");
    }
    return phone;
  };

  const handleVerify = useCallback(
    async (forcedCode?: string) => {
      const code = forcedCode ?? otp.join("");

      if (code.length !== 6 || !emailParam) return;

      // Sécurité supplémentaire : si déjà connecté et actif, on quitte cette page
      if (isAuthenticated && isUserActivated) {
        navigate(getRedirectPath(storeUser?.role), { replace: true });
        return;
      }

      setStatus("verifying");
      setErrorMsg(null);
      setSuccessMsg(null);

      try {
        const response = (await authService.verifySms(emailParam, code)) as VerifyOtpResponse;

        if (!response?.access_token) {
          throw new Error("Réponse serveur invalide");
        }

        const userData = response.user;

        if (userData?.telephone) {
          setPhoneNumber(userData.telephone);
        }

        const mappedUser = {
          id: String(userData?.id ?? ""),
          email: (userData?.email ?? emailParam).toLowerCase(),
          role: userData?.role ?? "user",
          nom_complet: userData?.nom_complet ?? "Utilisateur",
          tenant_id: userData?.tenant_id ?? null,
          telephone: userData?.telephone ?? "",
          actif: true,
          activated: true,
        };

        setAuth(mappedUser as any, response.access_token);

        setStatus("success");
        setSuccessMsg("Vérification réussie. Redirection...");

        const target = getRedirectPath(mappedUser.role);

        window.setTimeout(() => {
          navigate(target, { replace: true });
        }, 1200);
      } catch (err: any) {
        console.error("OTP ERROR:", err);

        const statusCode = err?.response?.status;
        const detail = err?.response?.data?.detail;
        const message =
          typeof detail === "string"
            ? detail
            : detail?.message || "Erreur de vérification.";

        // Cas important : compte déjà activé
        if (
          statusCode === 400 &&
          typeof message === "string" &&
          message.toLowerCase().includes("compte déjà activé")
        ) {
          setStatus("success");
          setSuccessMsg("Compte déjà vérifié. Redirection...");

          window.setTimeout(() => {
            navigate("/login", { replace: true });
          }, 1000);
          return;
        }

        setStatus("error");

        if (statusCode === 400) {
          setErrorMsg(message || "Code incorrect ou expiré.");
        } else if (statusCode === 404) {
          setErrorMsg("Utilisateur introuvable.");
        } else if (statusCode === 423) {
          setErrorMsg("Compte temporairement bloqué après plusieurs tentatives.");
        } else if (statusCode === 429) {
          setErrorMsg("Trop de tentatives. Réessayez plus tard.");
        } else {
          setErrorMsg(message || "Erreur de vérification.");
        }

        setOtp(["", "", "", "", "", ""]);

        window.setTimeout(() => {
          inputs.current[0]?.focus();
        }, 100);
      }
    },
    [
      otp,
      emailParam,
      isAuthenticated,
      isUserActivated,
      navigate,
      setAuth,
      storeUser?.role,
      getRedirectPath,
    ]
  );

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    if (index === 5 && newOtp.every((d) => d !== "")) {
      handleVerify(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleResendCode = async () => {
    if (!emailParam) return;

    try {
      setStatus("pending");
      setErrorMsg(null);
      setSuccessMsg(null);
      setOtp(["", "", "", "", "", ""]);

      await authService.resendSms(emailParam);
      setSuccessMsg("Nouveau code SMS envoyé !");

      window.setTimeout(() => {
        inputs.current[0]?.focus();
      }, 100);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      const message =
        typeof detail === "string"
          ? detail
          : detail?.message || "Erreur lors de l'envoi du SMS";

      setErrorMsg(message);
    }
  };

  if (!emailParam && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto mb-4 text-blue-600" size={32} />
          <p className="text-slate-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Smartphone size={32} />
          </div>

          <h1 className="text-2xl font-bold text-slate-800">
            Vérification SMS
          </h1>

          {phoneNumber ? (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm bg-blue-50 text-blue-700 p-3 rounded-xl">
              <Phone size={16} />
              <span className="font-mono font-bold">{formatPhoneNumber(phoneNumber)}</span>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-600">
              <p>Code envoyé au numéro enregistré</p>
              <p className="text-xs text-slate-400 mt-1">{emailParam}</p>
            </div>
          )}

          <p className="text-xs text-slate-500 mt-3">
            Entrez le code à 6 chiffres reçu par SMS
          </p>

          {!isUserActivated && (
            <p className="text-xs text-amber-600 mt-2 bg-amber-50 p-2 rounded-lg">
              Compte en attente d'activation par SMS
            </p>
          )}
        </div>

        {errorMsg && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-xs flex gap-2 items-center">
            <AlertCircle size={14} />
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3 bg-green-50 text-green-600 rounded-xl text-xs flex gap-2 items-center">
            <CheckCircle2 size={14} />
            {successMsg}
          </div>
        )}

        <div className="flex justify-between gap-2 mb-8">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              type="text"
              inputMode="numeric"
              value={digit}
              maxLength={1}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              disabled={status === "verifying" || status === "success"}
              className={`w-12 h-14 text-center text-2xl font-bold border rounded-xl transition-all ${
                status === "error"
                  ? "border-red-300 bg-red-50"
                  : status === "success"
                  ? "border-green-300 bg-green-50"
                  : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              }`}
              placeholder="•"
            />
          ))}
        </div>

        <button
          onClick={() => handleVerify()}
          disabled={otp.join("").length < 6 || status === "verifying" || status === "success"}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {status === "verifying" ? (
            <>
              <RefreshCw className="animate-spin" size={20} />
              Vérification...
            </>
          ) : status === "success" ? (
            <>
              <CheckCircle2 size={20} />
              Vérifié !
            </>
          ) : (
            "Confirmer le code SMS"
          )}
        </button>

        <div className="mt-4 text-center">
          <button
            onClick={handleResendCode}
            disabled={status === "verifying" || status === "success"}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:text-slate-400 transition-colors flex items-center justify-center gap-1 mx-auto"
          >
            <RefreshCw size={14} />
            Renvoyer le code SMS
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate("/login", { replace: true })}
            className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Retour à la connexion
          </button>
        </div>

        <div className="mt-6 p-3 bg-slate-50 rounded-xl">
          <p className="text-[10px] text-slate-500 text-center">
            ⚡ Le code de vérification est envoyé par SMS.
            Si vous ne recevez pas le code après quelques minutes,
            vous pouvez demander un renvoi.
          </p>
        </div>
      </div>
    </div>
  );
}