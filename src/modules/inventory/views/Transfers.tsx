import { useQuery } from '@tanstack/react-query';
import { getTransfers, StockTransfer } from '@/services/transferService'; // Import du type
import { ArrowRightLeft, Clock, CheckCircle2 } from 'lucide-react'; // XCircle supprimé

export default function Transfers() {
  // On définit explicitement que data sera un tableau de StockTransfer ou undefined
  const { data: transfers, isLoading } = useQuery<StockTransfer[]>({
    queryKey: ['stock-transfers'],
    queryFn: getTransfers
  });

  if (isLoading) return <div className="p-10 text-center text-slate-500">Chargement des transferts...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Transferts inter-pharmacies</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-blue-100">
          Nouveau transfert
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Produit & Quantité</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Flux (De → À)</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Date</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {/* Le point d'interrogation et le typage générique règlent l'erreur .map */}
              {transfers?.map((t: StockTransfer) => (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <p className="font-bold text-slate-700">{t.product_name}</p>
                    <p className="text-xs text-blue-600 font-bold">{t.quantity} Unités</p>
                  </td>
                  <td className="p-4 text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">{t.from_pharmacy}</span>
                      <ArrowRightLeft size={14} className="text-slate-300" />
                      <span className="text-slate-900 font-bold">{t.to_pharmacy}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-500">{t.date}</td>
                  <td className="p-4">
                    {t.status === 'completed' && (
                      <span className="flex items-center gap-1 text-green-600 bg-green-50 px-2 py-1 rounded-full text-[10px] font-bold w-fit">
                        <CheckCircle2 size={12} /> REÇU
                      </span>
                    )}
                    {t.status === 'pending' && (
                      <span className="flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded-full text-[10px] font-bold w-fit">
                        <Clock size={12} /> EN TRANSIT
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {transfers?.length === 0 && (
            <div className="p-10 text-center text-slate-400 text-sm italic">
              Aucun transfert enregistré.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}