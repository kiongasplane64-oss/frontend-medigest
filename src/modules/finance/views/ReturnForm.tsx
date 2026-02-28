import { useState } from 'react';
import { 
  X, Search, Package, RefreshCcw, 
  ArrowRight, AlertCircle, Save 
} from 'lucide-react'; // CheckCircle2 supprimé (inutilisé)
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

export default function ReturnForm({ onClose }: Props) {
  const queryClient = useQueryClient();
  const [saleId, setSaleId] = useState('');
  const [step, setStep] = useState(1);
  const [returnType, setReturnType] = useState<'retour' | 'echange'>('retour');
  
  // 1. Recherche de la vente (isSearching retiré car inutilisé)
  const { data: saleData } = useQuery({
    queryKey: ['sale-lookup', saleId],
    queryFn: async () => {
      if (!saleId) return null;
      const res = await api.get(`/sales/${saleId}`);
      return res.data;
    },
    enabled: !!saleId && saleId.length > 3
  });

  const mutation = useMutation({
    mutationFn: (data: any) => api.post('/finance/returns', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns-history'] });
      queryClient.invalidateQueries({ queryKey: ['finance-global-stats'] });
      toast.success("Opération enregistrée");
      onClose();
    },
    onError: () => toast.error("Erreur lors de l'enregistrement")
  });

  const handleProcess = () => {
    if (!saleData) return;
    mutation.mutate({
      sale_id: saleData.id,
      type: returnType,
      items: saleData.items,
      reason: "Défaut ou erreur client"
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-4xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
              <RefreshCcw size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">SAV & Retours</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Étape {step} sur 2</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 space-y-8">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Numéro du Ticket</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                  <input 
                    type="text"
                    placeholder="Ex: SL-2026-001"
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500 transition-all"
                    value={saleId}
                    onChange={(e) => setSaleId(e.target.value)}
                  />
                </div>
              </div>

              {saleData && (
                <div className="p-6 border border-green-100 bg-green-50/30 rounded-3xl space-y-4 animate-in slide-in-from-top-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-green-700 uppercase">Vente trouvée</span>
                    <span className="text-xs font-bold text-slate-500">{saleData.date}</span>
                  </div>
                  <div className="space-y-2">
                    {saleData.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-green-100/50 shadow-sm">
                        <span className="text-xs font-bold text-slate-600">{item.product_name} x{item.quantity}</span>
                        <span className="text-xs font-black text-slate-800">{item.total.toLocaleString()} FG</span>
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => setStep(2)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-orange-600 transition-all"
                  >
                    Confirmer les articles <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setReturnType('retour')}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${returnType === 'retour' ? 'border-orange-500 bg-orange-50/50' : 'border-slate-100 opacity-50'}`}
                >
                  <RefreshCcw size={24} className={returnType === 'retour' ? 'text-orange-500' : 'text-slate-400'} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Retour Simple</span>
                </button>
                <button 
                  onClick={() => setReturnType('echange')}
                  className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${returnType === 'echange' ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 opacity-50'}`}
                >
                  <Package size={24} className={returnType === 'echange' ? 'text-blue-500' : 'text-slate-400'} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Échange Standard</span>
                </button>
              </div>

              <div className="flex gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700">
                <AlertCircle size={20} className="shrink-0" />
                <p className="text-[11px] font-medium leading-relaxed italic">
                  {returnType === 'retour' 
                    ? "Le produit sera réintégré au stock et le montant remboursé."
                    : "L'échange remplace l'article sans mouvement financier."}
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setStep(1)}
                  className="flex-1 py-4 border border-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-400 hover:bg-slate-50"
                >
                  Retour
                </button>
                <button 
                  onClick={handleProcess}
                  disabled={mutation.isPending}
                  className="flex-2 py-4 bg-orange-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
                >
                  {mutation.isPending ? <RefreshCcw className="animate-spin" size={16} /> : <Save size={16} />}
                  Valider l'opération
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}