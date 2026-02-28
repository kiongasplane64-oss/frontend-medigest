import { useAuthStore } from '@/store/useAuthStore';
import { StatCard } from '../components/StatCard';
import { 
  ShoppingBag, AlertTriangle, Users, TrendingUp, 
  Truck, RefreshCw, ArrowRight, ShieldCheck
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '@/api/client';

export default function Dashboard() {
  const { user, currentPharmacyId } = useAuthStore(); 
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // 1. Récupération des stats et des infos du plan (tenant)
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-stats', currentPharmacyId],
    queryFn: async () => {
      const response = await api.get('/dashboard/stats', {
        params: { pharmacy_id: currentPharmacyId }
      });
      return response.data; // Doit inclure dashboardData.tenant (plan_name, max_users, etc.)
    }
  });

  const { data: incomingTransfers } = useQuery({
    queryKey: ['incoming-transfers'],
    queryFn: async () => {
      const response = await api.get('/transfers/pending-incoming');
      return response.data;
    },
    refetchInterval: 30000 
  });

  if (isLoading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="animate-spin mb-4" size={40} />
        <p className="font-bold tracking-widest uppercase text-xs">Initialisation...</p>
      </div>
    );
  }

  // Calcul du pourcentage d'utilisation des utilisateurs pour la barre de progression
  const userLimit = dashboardData?.tenant?.max_users || 5;
  const currentUsers = dashboardData?.active_users || 0;
  const usagePercentage = Math.min((currentUsers / userLimit) * 100, 100);

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Tableau de Bord</h1>
          <p className="text-slate-500 font-medium">
            Ravi de vous revoir, <span className="text-blue-600 font-bold">{user?.nom_complet}</span>
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vue Pharmacie</label>
            <select className="bg-white border-none shadow-sm ring-1 ring-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 min-w-50">
              <option value="">Toutes les pharmacies</option>
            </select>
          </div>
        )}
      </div>

      {/* ALERTES TRANSFERTS */}
      {incomingTransfers && incomingTransfers.length > 0 && (
        <div className="bg-linear-to-r from-blue-600 to-indigo-700 p-1 rounded-4xl shadow-xl shadow-blue-100">
          <div className="bg-white/5 backdrop-blur-md p-5 rounded-[1.8rem] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white">
                <Truck className="animate-bounce" size={24} />
              </div>
              <div className="text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Logistique</p>
                <p className="font-bold">Vous avez {incomingTransfers.length} transfert(s) en attente.</p>
              </div>
            </div>
            <Link to="/inventory/transfers" className="bg-white text-blue-700 px-6 py-3 rounded-2xl font-black text-xs hover:bg-blue-50 transition-all flex items-center gap-2 shadow-lg">
              VÉRIFIER ET FIXER LES PRIX <ArrowRight size={16}/>
            </Link>
          </div>
        </div>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Ventes du jour" 
          value={`${dashboardData?.daily_sales?.toLocaleString() || 0} FG`} 
          icon={<ShoppingBag size={22}/>} 
          trend={`${dashboardData?.sales_trend || 0}%`}
          trendUp={(dashboardData?.sales_trend || 0) > 0}
        />

        <StatCard 
          title="Ruptures" 
          value={dashboardData?.out_of_stock_count || "0"} 
          icon={<AlertTriangle size={22}/>} 
          color="bg-red-500"
          description="Produits critiques"
        />

        {isAdmin && (
          <>
            <StatCard 
              title="Bénéfice Net" 
              value={`${dashboardData?.net_profit?.toLocaleString() || 0} FG`} 
              icon={<TrendingUp size={22}/>} 
              color="bg-green-500"
              description="Ce mois"
            />
            <StatCard 
              title="Staff Actif" 
              value={`${currentUsers} / ${userLimit}`} 
              icon={<Users size={22}/>} 
              color="bg-purple-500"
              description="Utilisateurs"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GRAPH */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm min-h-87.5">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-8">Activité Hebdomadaire</h3>
          <div className="h-48 flex items-end justify-between gap-2 px-4">
             {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
               <div key={i} className="w-full bg-slate-50 rounded-t-xl relative group">
                 <div className="absolute bottom-0 w-full bg-blue-100 group-hover:bg-blue-500 transition-all rounded-t-xl" style={{ height: `${h}%` }} />
               </div>
             ))}
          </div>
        </div>
        
        {/* PLAN / ABONNEMENT */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-black text-blue-600 uppercase text-xs tracking-widest flex items-center gap-2 mb-6">
              <ShieldCheck size={16}/> Votre Abonnement
            </h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-black text-slate-800">Plan {dashboardData?.tenant?.plan_name || '...'}</span>
                  <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-lg font-bold">ACTIF</span>
                </div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">Utilisateurs</span>
                  <span className={usagePercentage > 80 ? 'text-orange-600' : 'text-slate-800'}>
                    {currentUsers} / {userLimit}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ${usagePercentage > 80 ? 'bg-orange-500' : 'bg-blue-500'}`} 
                    style={{ width: `${usagePercentage}%` }} 
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                {usagePercentage > 80 
                  ? `Attention ! Vous utilisez ${usagePercentage}% des capacités de votre plan ${dashboardData?.tenant?.plan_name}.`
                  : `Votre plan ${dashboardData?.tenant?.plan_name} permet d'ajouter encore ${userLimit - currentUsers} utilisateurs.`
                }
              </p>
            </div>
          </div>
          <button className="w-full mt-6 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-blue-600 transition-all shadow-lg shadow-slate-200">
            GÉRER L'ABONNEMENT
          </button>
        </div>
      </div>
    </div>
  );
}