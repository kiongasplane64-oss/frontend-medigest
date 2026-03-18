// src/components/UserModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Save, UserPlus, Store, Users } from 'lucide-react';
import { UserCreate } from '@/services/userService';
import { Pharmacy } from '@/services/pharmacyService';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: UserCreate & { pharmacy_id: string; branch_id?: string }) => void;
  isLoading?: boolean;
  pharmacies: Pharmacy[];
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  pharmacies
}) => {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'vendeur' as const,
    is_active: true,
    pharmacy_id: '',
    branch_id: '',
    telephone: '',
    adresse: ''
  });

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  // Mettre à jour les branches quand la pharmacie change
  useEffect(() => {
    if (formData.pharmacy_id) {
      const pharmacy = pharmacies.find(p => p.id === formData.pharmacy_id);
      if (pharmacy?.config?.branchConfig?.branches) {
        setBranches(pharmacy.config.branchConfig.branches);
      } else {
        setBranches([]);
      }
    } else {
      setBranches([]);
    }
  }, [formData.pharmacy_id, pharmacies]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5">
        
        {/* En-tête */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-medical/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-medical/10 rounded-xl flex items-center justify-center">
              <UserPlus size={20} className="text-medical" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
                NOUVEL <span className="text-medical">UTILISATEUR</span>
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Créer un compte pour votre pharmacie
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="space-y-6">
            {/* Informations personnelles */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-medical rounded-full" />
                Informations personnelles
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                    placeholder="Jean Dupont"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                    placeholder="jean.dupont@email.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Mot de passe
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                    placeholder="********"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    name="telephone"
                    value={formData.telephone}
                    onChange={handleChange}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                    placeholder="+243 XXX XXX XXX"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Adresse
                  </label>
                  <textarea
                    name="adresse"
                    value={formData.adresse}
                    onChange={handleChange}
                    rows={2}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                    placeholder="Adresse complète"
                  />
                </div>
              </div>
            </div>

            {/* Rôle et affectation */}
            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-medical rounded-full" />
                Rôle et affectation
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Rôle
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                  >
                    <option value="admin">Administrateur</option>
                    <option value="manager">Gestionnaire</option>
                    <option value="pharmacist">Pharmacien</option>
                    <option value="vendeur">Vendeur</option>
                    <option value="caissier">Caissier</option>
                    <option value="stockiste">Stockiste</option>
                    <option value="comptable">Comptable</option>
                    <option value="preparateur">Préparateur</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    Statut
                  </label>
                  <div className="flex items-center gap-3 h-full pt-2">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active}
                        onChange={handleChange}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-medical"></div>
                    </label>
                    <span className="text-sm text-slate-600">
                      {formData.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                    <Store size={12} className="inline mr-1" />
                    Pharmacie
                  </label>
                  <select
                    name="pharmacy_id"
                    value={formData.pharmacy_id}
                    onChange={handleChange}
                    required
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                  >
                    <option value="">Sélectionner une pharmacie</option>
                    {pharmacies.map((pharmacy) => (
                      <option key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.name}
                      </option>
                    ))}
                  </select>
                </div>
                {branches.length > 0 && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">
                      <Users size={12} className="inline mr-1" />
                      Succursale
                    </label>
                    <select
                      name="branch_id"
                      value={formData.branch_id}
                      onChange={handleChange}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-medical focus:border-transparent transition-all"
                    >
                      <option value="">Principale</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Note d'information */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
              <p className="text-[10px] text-blue-700">
                <span className="font-black">🔐 Note :</span> Les permissions par défaut seront attribuées en fonction du rôle choisi. 
                Vous pourrez les modifier ultérieurement.
              </p>
            </div>
          </div>
        </form>

        {/* Pied de page */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-medical text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-medical/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-medical/20"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Créer l'utilisateur
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserModal;