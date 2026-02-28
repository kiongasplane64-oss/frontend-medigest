import { useState } from 'react';
import { 
  ArrowLeft, Wallet, Receipt, Plus, Search,
  TrendingDown, History, User, FileText, Download, RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import ExpenseForm from './ExpenseForm';
import toast from 'react-hot-toast';

// Types pour la base de données
interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  created_by_name: string;
}

interface ActivityLog {
  id: string;
  user: string;
  action: string;
  target: string;
  created_at: string;
  type: 'add' | 'edit' | 'delete';
}

export default function ExpensesManager() {
  const navigate = useNavigate();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Récupération des dépenses (DB)
  const { data: expenses, isLoading: loadingExpenses } = useQuery<Expense[]>({
    queryKey: ['expenses'],
    queryFn: async () => {
      const res = await api.get('/expenses');
      return res.data;
    }
  });

  // 2. Récupération du journal d'audit (DB)
  const { data: logs, isLoading: loadingLogs } = useQuery<ActivityLog[]>({
    queryKey: ['expense-logs'],
    queryFn: async () => {
      const res = await api.get('/expenses/logs');
      return res.data;
    }
  });

  // 3. Calculs dynamiques
  const totalMonth = expenses?.reduce((acc, curr) => acc + curr.amount, 0) || 0;

  const handleExportPDF = async () => {
    toast.loading("Génération du rapport...", { id: "export" });
    try {
      const response = await api.get('/expenses/export/pdf', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Rapport_Depenses_${new Date().getMonth() + 1}.pdf`);
      document.body.appendChild(link);
      link.click();
      toast.success("Téléchargement lancé", { id: "export" });
    } catch (err) {
      toast.error("Erreur lors de l'export", { id: "export" });
    }
  };

  if (loadingExpenses) return (
    <div className="min-h-100 flex flex-col items-center justify-center gap-4 text-slate-400">
      <RefreshCw className="animate-spin" size={40} />
      <p className="font-black uppercase text-[10px] tracking-widest">Synchronisation avec la base de données...</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-10">
      
      <div className="flex-1 space-y-8">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-red-600 transition-all shadow-sm">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">Gestion des Dépenses</h1>
              <p className="text-slate-500 font-medium italic">Flux financiers synchronisés.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={handleExportPDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-5 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all">
              <Download size={18} /> Export PDF
            </button>
            <button onClick={() => setIsFormOpen(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl hover:bg-red-600 transition-all uppercase tracking-widest">
              <Plus size={18} /> Déclarer
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center shadow-inner font-black">
              <TrendingDown size={32}/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Dépenses réelles (DB)</p>
              <p className="text-3xl font-black text-slate-800">{totalMonth.toLocaleString()} <small className="text-xs font-bold text-slate-400 uppercase">fg</small></p>
            </div>
          </div>
          <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-50 text-slate-500 rounded-3xl flex items-center justify-center shadow-inner">
              <Wallet size={32}/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Total Transactions</p>
              <p className="text-3xl font-black text-slate-800">{expenses?.length || 0}</p>
            </div>
          </div>
        </div>

        {/* TABLEAU */}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden min-h-100">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <Receipt size={18} /> Journal de caisse
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer..." 
                className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-red-500" 
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50">
                  <th className="px-8 py-4">Date</th>
                  <th className="px-8 py-4">Catégorie</th>
                  <th className="px-8 py-4">Description</th>
                  <th className="px-8 py-4 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses?.filter(e => e.description.toLowerCase().includes(searchTerm.toLowerCase())).map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-4 text-xs font-bold text-slate-600">{new Date(expense.date).toLocaleDateString()}</td>
                    <td className="px-8 py-4">
                      <span className="text-[9px] font-black uppercase bg-slate-100 px-2 py-1 rounded-lg text-slate-500">{expense.category}</span>
                    </td>
                    <td className="px-8 py-4 text-xs text-slate-500 font-medium">{expense.description}</td>
                    <td className="px-8 py-4 text-right font-black text-red-600">-{expense.amount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!expenses || expenses.length === 0) && (
              <div className="py-20 text-center flex flex-col items-center">
                <FileText size={48} className="text-slate-100 mb-4" />
                <p className="text-slate-400 font-bold italic text-sm tracking-tight">Aucune donnée en base de données.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SIDEBAR AUDIT */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-slate-900 rounded-4xl p-6 shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
            <History size={18} className="text-blue-400" />
            <h3 className="text-white font-black text-xs uppercase tracking-widest">Journal d'audit</h3>
          </div>

          <div className="space-y-6">
            {loadingLogs ? <div className="text-slate-600 text-[10px] animate-pulse">Chargement...</div> :
              logs?.map((log) => (
              <div key={log.id} className="relative pl-6 border-l-2 border-slate-800 group">
                <div className={`absolute -left-2.25 top-0 w-4 h-4 rounded-full border-4 border-slate-900 ${
                  log.type === 'delete' ? 'bg-red-500' : log.type === 'edit' ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User size={12} />
                    <span className="text-[10px] font-black uppercase text-slate-300">{log.user}</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium leading-snug">
                    {log.action} <span className="text-slate-200">{log.target}</span>
                  </p>
                  <p className="text-[9px] text-slate-600 font-bold uppercase">{log.created_at}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isFormOpen && <ExpenseForm onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}