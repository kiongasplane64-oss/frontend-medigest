import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, PartyPopper, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  // On peut imaginer un petit effet de redirection automatique après 5 secondes
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate('/');
    }, 8000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl shadow-blue-100/50 p-10 text-center border border-slate-50 relative overflow-hidden">
        
        {/* Décoration d'arrière-plan discrète */}
        <div className="absolute -top-10 -right-10 text-blue-50 opacity-50">
          <PartyPopper size={120} />
        </div>

        <div className="relative">
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-slow">
            <CheckCircle2 size={48} strokeWidth={1.5} />
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-4">
            Paiement Réussi !
          </h1>
          
          <p className="text-slate-500 leading-relaxed mb-8">
            Félicitations ! Votre abonnement a été activé avec succès. Vous avez désormais accès à toutes les fonctionnalités de votre plan.
          </p>

          <div className="bg-slate-50 rounded-3xl p-6 mb-8 space-y-3 text-left">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Utilisateur</span>
              <span className="text-slate-700 font-bold">{user?.nom_complet || 'Client Pharma'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">Statut du compte</span>
              <span className="flex items-center gap-1 text-blue-600 font-bold italic">
                <ShieldCheck size={14} /> Actif
              </span>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => navigate('/')}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-blue-300 transition-all flex items-center justify-center gap-2 group"
            >
              Accéder au Dashboard
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            <p className="text-[11px] text-slate-400">
              Redirection automatique vers le tableau de bord dans quelques secondes...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}