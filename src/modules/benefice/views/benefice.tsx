import { 
  TrendingUp, 
  Clock, 
  BarChart3, 
  ShieldAlert, 
  ArrowLeft,
  PieChart,
  Target,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

export default function ProfitAnalysis() {
  const navigate = useNavigate();

  // 1. Récupération de l'état du module depuis la DB
  const { data: moduleStatus, isLoading } = useQuery({
    queryKey: ['module-status', 'profit-analysis'],
    queryFn: async () => {
      // Simulation ou appel réel à une table "module_status" ou "system_settings"
      const response = await api.get('/system/module-status/profit-analysis');
      return response.data; // Attendu: { progress: 75, status: 'development', version: '2.0.4' }
    }
  });

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="animate-spin mb-4" size={40} />
        <p className="font-black uppercase text-[10px] tracking-widest">Calcul de l'avancement...</p>
      </div>
    );
  }

  const progress = moduleStatus?.progress || 0;

  return (
    <div className="min-h-[80vh] flex flex-col space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 hover:shadow-lg transition-all group"
          >
            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Analyse des Bénéfices</h1>
            <p className="text-slate-500 font-medium italic">Données financières en temps réel.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100">
          <Clock size={16} className="text-amber-600 animate-pulse" />
          <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest">
            Version {moduleStatus?.version || 'Alpha'}
          </span>
        </div>
      </div>

      {/* CARTE CENTRALE */}
      <div className="flex-1 bg-white rounded-5xl border border-slate-100 shadow-sm relative overflow-hidden flex flex-col items-center justify-center p-8 text-center">
        <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-blue-500 via-indigo-500 to-purple-500" />
        
        <div className="relative z-10 max-w-2xl mx-auto space-y-8 w-full">
          <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
            <BarChart3 size={48} className="animate-bounce" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-slate-800 tracking-tight leading-tight">
              Intelligence Financière <br />
              <span className="text-blue-600 underline decoration-blue-100 underline-offset-8">en cours de développement</span>
            </h2>
            <p className="text-slate-500 text-lg font-medium">
              Nous synchronisons vos marges avec les prix d'achat réels de la base de données.
            </p>
          </div>

          {/* COMPOSANT BARRE DE PROGRESSION DYNAMIQUE */}
          <div className="max-w-md mx-auto w-full space-y-3">
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression du déploiement</span>
              <span className="text-lg font-black text-blue-600">{progress}%</span>
            </div>
            <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner">
              <div 
                className="h-full bg-linear-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-1000 ease-out shadow-lg"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-bold italic">
              Dernière mise à jour : {new Date().toLocaleDateString()}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4">
            {[
              { icon: <TrendingUp size={18} />, label: "Marge Nette" },
              { icon: <PieChart size={18} />, label: "Analytique" },
              { icon: <Target size={18} />, label: "ROI Global" },
            ].map((feature, i) => (
              <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center gap-3 grayscale opacity-60">
                <div className="text-blue-500">{feature.icon}</div>
                <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">{feature.label}</span>
              </div>
            ))}
          </div>

          <div className="inline-flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-slate-200">
            <ShieldAlert size={18} className="text-blue-400" />
            Accès sécurisé bientôt disponible
          </div>
        </div>
      </div>
    </div>
  );
}