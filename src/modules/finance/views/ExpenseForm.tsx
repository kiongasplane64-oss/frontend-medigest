import { useState } from 'react';
import { 
  X, Save, CreditCard, Receipt, 
  Calendar, MessageSquare, Tag, AlertCircle 
} from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import toast from 'react-hot-toast';

interface ExpenseFormProps {
  onClose: () => void;
}

const CATEGORIES = [
  { id: 'loyer', label: 'Loyer & Charges', icon: '🏠' },
  { id: 'salaire', label: 'Salaires', icon: '👥' },
  { id: 'stock', label: 'Achat Stock (Hors Transfert)', icon: '📦' },
  { id: 'marketing', label: 'Marketing/Pub', icon: '📣' },
  { id: 'autre', label: 'Autres frais', icon: '✨' },
];

export default function ExpenseForm({ onClose }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    amount: '',
    category: 'autre',
    description: '',
    date: new Date().toISOString().split('T')[0],
  });

  // Mutation pour sauvegarder en DB
  const { mutate: saveExpense, isPending } = useMutation({
    mutationFn: (data: typeof formData) => api.post('/expenses', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Dépense enregistrée !');
      onClose();
    },
    onError: () => {
      toast.error('Erreur lors de l\'enregistrement.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || Number(formData.amount) <= 0) {
      return toast.error('Veuillez saisir un montant valide');
    }
    saveExpense(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-lg rounded-4xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-red-100">
              <Receipt size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Nouvelle Dépense</h2>
              <p className="text-xs text-slate-500 font-medium tracking-wide uppercase">Sortie de caisse</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* MONTANT */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <CreditCard size={12} /> Montant (FG)
            </label>
            <input 
              autoFocus
              type="number"
              required
              className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-2xl font-black text-slate-800 focus:ring-2 focus:ring-red-500 outline-none transition-all"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* CATEGORIE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Tag size={12} /> Catégorie
              </label>
              <select 
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                ))}
              </select>
            </div>

            {/* DATE */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Calendar size={12} /> Date
              </label>
              <input 
                type="date"
                className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500"
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
              />
            </div>
          </div>

          {/* DESCRIPTION */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <MessageSquare size={12} /> Note / Justificatif
            </label>
            <textarea 
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-500 transition-all"
              placeholder="Détails de la dépense..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="bg-red-50 p-4 rounded-2xl flex gap-3">
            <AlertCircle className="text-red-500 shrink-0" size={18} />
            <p className="text-[10px] text-red-700 font-bold leading-relaxed">
              Attention : Cette action est irréversible et sera immédiatement déduite du calcul de vos bénéfices nets.
            </p>
          </div>

          {/* ACTIONS */}
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button 
              type="submit"
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-red-600 transition-all disabled:opacity-50"
            >
              {isPending ? 'Enregistrement...' : <><Save size={18} /> Valider la dépense</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}