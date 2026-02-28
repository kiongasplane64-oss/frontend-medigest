import { useState } from 'react';
import { X, UserPlus, Shield, Mail, Lock } from 'lucide-react';
import { UserCreate } from '@/services/userService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: UserCreate) => void;
  isLoading: boolean;
}

export default function UserModal({ isOpen, onClose, onSubmit, isLoading }: Props) {
  const [formData, setFormData] = useState<UserCreate>({
    full_name: '',
    email: '',
    password: '',
    role: 'pharmacist',
    is_active: true
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 shadow-2xl relative animate-in zoom-in-95 duration-300">
        
        <button onClick={onClose} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors">
          <X size={24} />
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-medical/10 text-medical rounded-2xl flex items-center justify-center">
            <UserPlus size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase italic">Nouvel Utilisateur</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ajouter un membre à l'équipe</p>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); onSubmit(formData); }} className="space-y-5">
          {/* Nom Complet */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nom Complet</label>
            <div className="relative">
              <input 
                required
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-4 text-sm font-bold focus:ring-2 focus:ring-medical/20 outline-none transition-all"
                placeholder="Ex: Dr. Jean Dupont"
                onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              />
              <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Professionnel</label>
            <div className="relative">
              <input 
                required type="email"
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-4 text-sm font-bold focus:ring-2 focus:ring-medical/20 outline-none transition-all"
                placeholder="jean@pharmacie.com"
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Rôle */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rôle</label>
              <div className="relative">
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-4 text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-medical/20"
                  onChange={(e) => setFormData({...formData, role: e.target.value as any})}
                >
                  <option value="pharmacist">Pharmacien</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Administrateur</option>
                </select>
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              </div>
            </div>

            {/* Mot de passe */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mot de passe</label>
              <div className="relative">
                <input 
                  required type="password"
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-12 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-medical/20"
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
              </div>
            </div>
          </div>

          <button 
            disabled={isLoading}
            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-medical transition-all disabled:opacity-50 mt-4"
          >
            {isLoading ? 'Création...' : 'Confirmer l\'ajout'}
          </button>
        </form>
      </div>
    </div>
  );
}