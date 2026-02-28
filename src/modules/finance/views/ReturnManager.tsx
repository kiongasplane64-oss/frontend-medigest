import { useState } from 'react';
import { 
  ArrowLeft, RefreshCcw, Search, Plus, 
  History, Package, CheckCircle2, 
  AlertCircle, ShoppingBag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';
import ReturnForm from './ReturnForm'; // Assure-toi que le chemin est correct

interface ReturnTransaction {
  id: string;
  original_sale_id: string;
  product_name: string;
  customer_name: string;
  type: 'retour' | 'echange';
  reason: string;
  amount_refunded: number;
  status: 'completed' | 'pending';
  created_at: string;
}

export default function ReturnsManager() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false); // État pour le formulaire

  // 1. Fetch des retours depuis la DB
  const { data: returns, isLoading } = useQuery<ReturnTransaction[]>({
    queryKey: ['returns-history'],
    queryFn: async () => {
      const res = await api.get('/finance/returns');
      return res.data;
    }
  });

  if (isLoading) return (
    <div className="min-h-100 flex flex-col items-center justify-center gap-4 text-slate-400">
      <RefreshCcw className="animate-spin" size={40} />
      <p className="font-black uppercase text-[10px] tracking-widest">Chargement des registres...</p>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-8 pb-10 relative">
      <div className="flex-1 space-y-8">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-3 bg-white border border-slate-100 rounded-2xl text-slate-400 hover:text-orange-600 transition-all shadow-sm">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">SAV & Retours</h1>
              <p className="text-slate-500 font-medium italic">Gestion des échanges et remboursements.</p>
            </div>
          </div>
          
          {/* BOUTON MODIFIÉ POUR OUVRIR LE FORMULAIRE */}
          <button 
            onClick={() => setIsFormOpen(true)} 
            className="flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl shadow-orange-100 hover:bg-slate-900 transition-all uppercase tracking-widest"
          >
            <Plus size={18} /> Nouveau Retour / Échange
          </button>
        </div>

        {/* QUICK STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-4xl border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center shadow-inner">
              <RefreshCcw size={24}/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Taux de retour</p>
              <p className="text-2xl font-black text-slate-800">2.4% <small className="text-xs font-bold text-slate-300">Mensuel</small></p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-4xl border border-slate-100 shadow-sm flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center shadow-inner">
              <ShoppingBag size={24}/>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Échanges effectués</p>
              <p className="text-2xl font-black text-slate-800">
                {returns?.filter(r => r.type === 'echange').length || 0}
              </p>
            </div>
          </div>
        </div>

        {/* TABLEAU DES RETOURS */}
        <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
            <h3 className="font-black text-[10px] uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <History size={18} /> Historique des opérations
            </h3>
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input 
                type="text" 
                placeholder="Rechercher une vente ou produit..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-150">
              <thead>
                <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-50">
                  <th className="px-8 py-4">Transaction</th>
                  <th className="px-8 py-4">Produit concerné</th>
                  <th className="px-8 py-4">Type</th>
                  <th className="px-8 py-4">Raison</th>
                  <th className="px-8 py-4 text-right">Remboursement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {returns?.filter(r => r.product_name.toLowerCase().includes(searchTerm.toLowerCase())).map((ret) => (
                  <tr key={ret.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700">#{ret.original_sale_id}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">{new Date(ret.created_at).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-3">
                        <Package size={16} className="text-slate-300" />
                        <span>{ret.product_name}</span>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg ${
                        ret.type === 'echange' ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500'
                      }`}>
                        {ret.type}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-[11px] text-slate-400 italic font-medium">
                      {ret.reason}
                    </td>
                    <td className="px-8 py-4 text-right font-black text-slate-800">
                      {ret.amount_refunded.toLocaleString()} <small className="text-[9px]">FG</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SIDEBAR */}
      <div className="w-full lg:w-80 space-y-6">
        <div className="bg-slate-900 rounded-4xl p-6 shadow-2xl">
          <h3 className="text-white font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-400" /> Politique SAV
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/50 rounded-2xl border border-slate-700">
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium italic">
                "Tout retour doit être accompagné du ticket de caisse original."
              </p>
            </div>
            <div className="pt-4 border-t border-slate-800 space-y-3">
               <div className="flex items-center gap-3 text-slate-400">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span className="text-[10px] font-bold uppercase">Réintégration Stock Auto</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* RENDU DU FORMULAIRE EN OVERLAY */}
      {isFormOpen && <ReturnForm onClose={() => setIsFormOpen(false)} />}
    </div>
  );
}