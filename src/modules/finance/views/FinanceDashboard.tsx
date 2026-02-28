import { ArrowLeft, DollarSign, Target, Calendar, BarChart3, RefreshCw, Package, ArrowUpRight, Medal, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

interface TopProduct {
  name: string;
  total_sold: number;
  profit_generated: number;
}

interface FinanceStats {
  total_purchase_value: number;
  total_sales_value: number;
  total_products: number;
  monthly_revenue: number;
  top_products: TopProduct[];
}

export default function FinanceAnalysis() {
  const navigate = useNavigate();

  // Récupération des données depuis la DB
  const { data: stats, isLoading } = useQuery<FinanceStats>({
    queryKey: ['finance-global-stats'],
    queryFn: async () => {
      const res = await api.get('/finance/stats-inventory');
      return res.data;
    }
  });

  // Calculs financiers
  const potentialProfit = (stats?.total_sales_value || 0) - (stats?.total_purchase_value || 0);
  const profitMargin = stats?.total_sales_value 
    ? (potentialProfit / stats.total_sales_value) * 100 
    : 0;

  if (isLoading) return (
    <div className="min-h-100 flex flex-col items-center justify-center gap-4 text-slate-400">
      <RefreshCw className="animate-spin" size={40} />
      <p className="font-black uppercase text-[10px] tracking-widest text-center">Calcul des indicateurs financiers...</p>
    </div>
  );

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Analyse Financière</h1>
            <p className="text-slate-500 font-medium italic">Performance commerciale et valeur du stock.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 text-blue-700">
          <Calendar size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">Février 2026</span>
        </div>
      </div>

      {/* CARTES STATISTIQUES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* VALEUR ACHAT */}
        <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm group">
          <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-slate-900 group-hover:text-white transition-all">
            <Package size={24}/>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Valeur Achat Stock</p>
          <p className="text-2xl font-black text-slate-800">
            {stats?.total_purchase_value.toLocaleString()} <small className="text-xs text-slate-400 uppercase">fg</small>
          </p>
          <p className="text-[10px] text-slate-400 mt-1 font-bold italic">{stats?.total_products} références actives</p>
        </div>

        {/* CHIFFRE D'AFFAIRES RÉEL */}
        <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm group">
          <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition-all">
            <DollarSign size={24}/>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">CA Réel (30j)</p>
          <p className="text-2xl font-black text-slate-800">
            {stats?.monthly_revenue.toLocaleString()} <small className="text-xs text-slate-400 uppercase">fg</small>
          </p>
          <div className="flex items-center gap-1 text-green-500 mt-1 italic font-black text-[10px] uppercase">
             Ventes encaissées
          </div>
        </div>

        {/* MARGE BRUTE */}
        <div className="bg-slate-900 p-8 rounded-4xl shadow-2xl shadow-blue-100 group relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-white">
             <Target size={80} />
          </div>
          <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/30">
            <ArrowUpRight size={24}/>
          </div>
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Marge Brute Estimée</p>
          <p className="text-2xl font-black text-white">
            {potentialProfit.toLocaleString()} <small className="text-xs text-slate-400 uppercase">fg</small>
          </p>
          <div className="mt-2 inline-flex items-center gap-2 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-lg border border-blue-500/20">
            <span className="text-[10px] font-black tracking-tighter">+{profitMargin.toFixed(1)}% DE RENTABILITÉ</span>
          </div>
        </div>
      </div>

      {/* GRILLE SECONDAIRE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LISTE TOP PRODUITS */}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
              <Medal size={18} className="text-amber-400" /> Top Produits par Profit
            </h3>
            <Info size={14} className="text-slate-300" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-150">
              <tbody className="divide-y divide-slate-50">
                {stats?.top_products?.map((product, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-black text-slate-300">#{index + 1}</span>
                        <div>
                          <p className="text-xs font-black text-slate-700">{product.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{product.total_sold} vendus</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-xs font-black text-green-600">+{product.profit_generated.toLocaleString()} fg</p>
                      <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">Bénéfice net</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODULE GRAPHIQUE PLACEHOLDER */}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm p-10 text-center flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
          <BarChart3 size={48} className="text-blue-100 mb-6" />
          <h2 className="text-xl font-black text-slate-800 mb-2 italic">Courbe de croissance</h2>
          <p className="text-slate-500 text-xs font-medium max-w-xs mb-6 leading-relaxed">
            La visualisation des tendances de ventes mensuelles arrive bientôt.
          </p>
          <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-xl border border-blue-100">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Synchronisation active</span>
          </div>
        </div>
      </div>
    </div>
  );
}