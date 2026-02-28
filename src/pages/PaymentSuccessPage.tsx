// PaymentSuccessPage.tsx
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CheckCircle,
  Download,
  Home,
  Mail,
  Calendar,
  Users,
  Package,
} from "lucide-react";

interface PaymentState {
  payment?: {
    reference?: string;
    amount?: number;
  };
  plan?: {
    name?: string;
    price?: number;
    max_products?: number | "Illimité";
    max_users?: number | "Illimité";
  };
}

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { payment, plan } = (location.state as PaymentState) || {};

  useEffect(() => {
    if (!payment) {
      navigate("/subscription", { replace: true });
    }
  }, [payment, navigate]);

  return (
    <div className="min-h-screen -bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full animate-in fade-in duration-500">
        <div className="bg-white rounded-4xl shadow-2xl p-10 relative overflow-hidden">
          {/* Décoration */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-green-100 rounded-full blur-3xl" />

          {/* Contenu */}
          <div className="text-center relative z-10">
            {/* Icône */}
            <div className="w-24 h-24 bg-green-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-green-200 rotate-12">
              <CheckCircle size={48} className="text-white -rotate-12" />
            </div>

            <h1 className="text-4xl font-black text-slate-900 uppercase italic mb-3">
              Paiement réussi !
            </h1>
            <p className="text-lg text-slate-600 mb-10">
              Votre abonnement est maintenant actif. Merci pour votre confiance.
            </p>

            {/* Détails */}
            <div className="bg-slate-50 rounded-3xl p-8 mb-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <InfoBlock
                  icon={<Calendar size={24} />}
                  label="Démarre le"
                  value={new Date().toLocaleDateString("fr-FR")}
                />
                <InfoBlock
                  icon={<Package size={24} />}
                  label="Produits"
                  value={plan?.max_products ?? "—"}
                />
                <InfoBlock
                  icon={<Users size={24} />}
                  label="Utilisateurs"
                  value={plan?.max_users ?? "—"}
                />
              </div>

              <div className="border-t border-slate-200 pt-6 space-y-4">
                <Row label="Nouveau plan" value={plan?.name} highlight />
                <Row
                  label="Référence"
                  value={
                    <code className="font-mono font-bold bg-slate-100 px-3 py-1 rounded-lg">
                      {payment?.reference ?? "N/A"}
                    </code>
                  }
                />
                <Row
                  label="Montant"
                  value={`${payment?.amount ?? plan?.price ?? 0} €`}
                  big
                />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
              >
                <Home size={20} />
                Tableau de bord
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ActionButton icon={<Download size={18} />}>
                  Télécharger la facture
                </ActionButton>
                <ActionButton icon={<Mail size={18} />}>
                  Recevoir par email
                </ActionButton>
              </div>

              <button
                onClick={() => navigate("/subscription")}
                className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                ← Retour aux abonnements
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function InfoBlock({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-medical-light rounded-2xl flex items-center justify-center mx-auto mb-3 text-medical">
        {icon}
      </div>
      <p className="text-xs font-bold text-slate-600 uppercase mb-1">
        {label}
      </p>
      <p className="font-black text-slate-900">{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  big,
}: {
  label: string;
  value?: React.ReactNode;
  highlight?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-600">{label}</span>
      <span
        className={[
          "font-black",
          highlight && "text-medical",
          big ? "text-2xl" : "text-lg",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function ActionButton({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button className="py-4 bg-white text-slate-700 border-2 border-slate-200 rounded-2xl font-bold text-sm hover:border-medical hover:text-medical transition-all flex items-center justify-center gap-3">
      {icon}
      {children}
    </button>
  );
}
