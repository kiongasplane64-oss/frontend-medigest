import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSalesReport } from '@/services/reportService';
import { FileDown, Calendar, ArrowUpRight, ShoppingCart } from 'lucide-react';

export default function Reports() {
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily');
  
  const { data: report, isLoading } = useQuery({
    queryKey: ['sales-report', period],
    queryFn: () => getSalesReport(period)
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Rapports & Statistiques</h1>
        <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm">
          {(['daily', 'monthly', 'yearly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                period === p ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {p === 'daily' ? 'Jour' : p === 'monthly' ? 'Mois' : 'Année'}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center text-slate-400 italic">Génération du rapport...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Métriques Clés */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-green-50 text-green-600 rounded-2xl"><ArrowUpRight size={24}/></div>
                <button className="text-slate-400 hover:text-blue-600"><FileDown size={20}/></button>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-4">Ventes Totales ({period})</p>
              <h3 className="text-2xl font-bold text-slate-800">{report?.total_sales.toLocaleString()} FG</h3>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><ShoppingCart size={24}/></div>
              </div>
              <p className="text-sm font-medium text-slate-500 mt-4">Transactions</p>
              <h3 className="text-2xl font-bold text-slate-800">{report?.total_transactions}</h3>
            </div>
          </div>

          {/* Top Produit */}
          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-xl shadow-blue-100 flex flex-col justify-between">
            <div>
              <Calendar className="mb-4 opacity-60" size={32} />
              <p className="text-sm font-medium opacity-80">Meilleure vente</p>
              <h3 className="text-xl font-bold mt-1">{report?.top_selling_product || "N/A"}</h3>
            </div>
            <button className="mt-6 w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-all backdrop-blur-sm">
              Voir le détail complet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}