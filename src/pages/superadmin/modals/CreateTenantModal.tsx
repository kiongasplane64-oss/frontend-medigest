// modals/CreateTenantModal.tsx
import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/api/client';

type PlanType = 'starter' | 'professional' | 'enterprise';

interface CreateTenantModalProps {
  onClose: () => void;
}

export default function CreateTenantModal({ onClose }: CreateTenantModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    nom_pharmacie: '',
    email_admin: '',
    password_admin: '',
    ville: '',
    pays: 'RDC',
    telephone: '',
    adresse: '',
    type_pharmacie: '',
    plan: 'professional' as PlanType,
    trial_days: 14
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { data: response } = await api.post('/super-admin/tenants', data);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-tenants'] });
      toast.success('✅ Tenant créé avec succès');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail?.message || 'Erreur lors de la création');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
        {/* En-tête */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-gray-800">Créer un nouveau tenant</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nom de la pharmacie *
              </label>
              <input
                type="text"
                required
                value={formData.nom_pharmacie}
                onChange={(e) => setFormData({ ...formData, nom_pharmacie: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="ex: Pharmacie Centrale"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email admin *
              </label>
              <input
                type="email"
                required
                value={formData.email_admin}
                onChange={(e) => setFormData({ ...formData, email_admin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="admin@pharmacie.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe *
              </label>
              <input
                type="password"
                required
                value={formData.password_admin}
                onChange={(e) => setFormData({ ...formData, password_admin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Minimum 8 caractères"
                minLength={8}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone *
              </label>
              <input
                type="tel"
                required
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="+243 XXX XXX XXX"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ville *
              </label>
              <input
                type="text"
                required
                value={formData.ville}
                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Kinshasa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pays
              </label>
              <input
                type="text"
                value={formData.pays}
                onChange={(e) => setFormData({ ...formData, pays: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adresse
              </label>
              <textarea
                value={formData.adresse}
                onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="Adresse complète"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de pharmacie
              </label>
              <input
                type="text"
                value={formData.type_pharmacie}
                onChange={(e) => setFormData({ ...formData, type_pharmacie: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                placeholder="ex: Privée"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan *
              </label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData({ ...formData, plan: e.target.value as PlanType })}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              >
                <option value="starter">Starter</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jours d'essai
              </label>
              <input
                type="number"
                value={formData.trial_days}
                onChange={(e) => setFormData({ ...formData, trial_days: parseInt(e.target.value) || 14 })}
                min={1}
                max={365}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {mutation.isPending && <Loader2 className="animate-spin" size={18} />}
              Créer le tenant
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-200 rounded-xl hover:bg-gray-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}