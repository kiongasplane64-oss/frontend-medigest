// components/EditUserModal.tsx
import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, Building2, MapPin, Mail, Phone, User, Key, Shield } from 'lucide-react';
import { UpdateUserData } from '@/services/userService';
import { Pharmacy, BranchSummary } from '@/services/pharmacyService';

// Interface étendue pour inclure les champs de formulaire
interface ExtendedUpdateUserData extends UpdateUserData {
  password?: string;
  active_pharmacy_id?: string;
  active_branch_id?: string;
  pharmacy_id?: string;
  branch_id?: string;
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onSave: (userId: string, userData: ExtendedUpdateUserData) => void;
  isLoading: boolean;
  pharmacies: Pharmacy[];
}

export default function EditUserModal({ 
  isOpen, 
  onClose, 
  user, 
  onSave, 
  isLoading,
  pharmacies 
}: EditUserModalProps) {
  const [formData, setFormData] = useState<ExtendedUpdateUserData>({});
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Initialiser le formulaire avec les données de l'utilisateur
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || user.name || '',
        email: user.email || '',
        role: user.role || 'vendeur',
        is_active: user.is_active !== undefined ? user.is_active : true,
        telephone: user.telephone || '',
        adresse: user.adresse || ''
      });
      setSelectedPharmacyId(user.pharmacy_id || user.active_pharmacy_id || '');
      setSelectedBranchId(user.branch_id || user.active_branch_id || '');
    }
  }, [user]);

  // Récupérer les branches pour la pharmacie sélectionnée
  const getBranchesForPharmacy = (pharmacyId: string): BranchSummary[] => {
    const pharmacy = pharmacies.find(p => p.id === pharmacyId);
    return pharmacy?.config?.branchConfig?.branches || [];
  };

  const branches = getBranchesForPharmacy(selectedPharmacyId);

  const handleChange = (field: keyof ExtendedUpdateUserData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Effacer l'erreur du champ
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handlePharmacyChange = (pharmacyId: string) => {
    setSelectedPharmacyId(pharmacyId);
    setSelectedBranchId(''); // Reset branch when pharmacy changes
    setFormData(prev => ({
      ...prev,
      active_pharmacy_id: pharmacyId,
      active_branch_id: undefined
    }));
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    setFormData(prev => ({ ...prev, active_branch_id: branchId }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.full_name || formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Le nom doit contenir au moins 2 caractères';
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (formData.password && formData.password.length > 0 && formData.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // Préparer les données à envoyer - inclure seulement les champs modifiés
    const updateData: ExtendedUpdateUserData = {};
    
    if (formData.full_name !== undefined) updateData.full_name = formData.full_name;
    if (formData.email !== undefined) updateData.email = formData.email;
    if (formData.role !== undefined) updateData.role = formData.role;
    if (formData.is_active !== undefined) updateData.is_active = formData.is_active;
    if (formData.telephone !== undefined) updateData.telephone = formData.telephone;
    if (formData.adresse !== undefined) updateData.adresse = formData.adresse;
    
    // Ajouter l'affectation de pharmacie
    if (selectedPharmacyId) {
      updateData.active_pharmacy_id = selectedPharmacyId;
    }
    
    // Ajouter l'affectation de branche
    if (selectedBranchId) {
      updateData.active_branch_id = selectedBranchId;
    }
    
    // Ajouter le mot de passe seulement s'il a été modifié et non vide
    if (formData.password && formData.password.trim() !== '') {
      updateData.password = formData.password;
    }
    
    onSave(user.id, updateData);
  };

  if (!isOpen) return null;

  // Traduction des rôles
  const roleOptions = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'manager', label: 'Gestionnaire' },
    { value: 'pharmacist', label: 'Pharmacien' },
    { value: 'vendeur', label: 'Vendeur' },
    { value: 'caissier', label: 'Caissier' },
    { value: 'stockiste', label: 'Stockiste' },
    { value: 'comptable', label: 'Comptable' },
    { value: 'preparateur', label: 'Préparateur' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-10 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-8 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
              MODIFIER <span className="text-medical">L'UTILISATEUR</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              {user?.email}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Informations personnelles */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <User size={18} className="text-medical" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Informations personnelles</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Nom complet *
                </label>
                <input
                  type="text"
                  value={formData.full_name || ''}
                  onChange={(e) => handleChange('full_name', e.target.value)}
                  className={`w-full p-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent transition-all ${
                    errors.full_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Jean Dupont"
                />
                {errors.full_name && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.full_name}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Email *
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className={`w-full pl-10 p-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent ${
                      errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                    placeholder="jean@pharmacie.com"
                  />
                </div>
                {errors.email && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.email}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={formData.telephone || ''}
                    onChange={(e) => handleChange('telephone', e.target.value)}
                    className="w-full pl-10 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
                    placeholder="+243 XXX XXX XXX"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={formData.adresse || ''}
                  onChange={(e) => handleChange('adresse', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
                  placeholder="Adresse complète"
                />
              </div>
            </div>
          </div>

          {/* Sécurité */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Key size={18} className="text-medical" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sécurité</h3>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Nouveau mot de passe (laisser vide pour ne pas modifier)
              </label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password || ''}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className={`w-full pl-10 p-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Nouveau mot de passe (8 caractères minimum)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  {showPassword ? "Cacher" : "Afficher"}
                </button>
              </div>
              {errors.password && (
                <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={10} /> {errors.password}
                </p>
              )}
              <p className="text-[10px] text-slate-400 mt-2">
                Le mot de passe doit contenir au moins 8 caractères
              </p>
            </div>
          </div>

          {/* Rôle et affectation */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
              <Shield size={18} className="text-medical" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Rôle et affectation</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Rôle *
                </label>
                <select
                  value={formData.role || 'vendeur'}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
                >
                  {roleOptions.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Statut
                </label>
                <div className="flex items-center gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.is_active === true}
                      onChange={() => handleChange('is_active', true)}
                      className="w-4 h-4 text-medical focus:ring-medical"
                    />
                    <span className="text-sm text-slate-600">Actif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={formData.is_active === false}
                      onChange={() => handleChange('is_active', false)}
                      className="w-4 h-4 text-red-500 focus:ring-red-500"
                    />
                    <span className="text-sm text-slate-600">Inactif</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  <Building2 size={12} className="inline mr-1" /> Pharmacie
                </label>
                <select
                  value={selectedPharmacyId}
                  onChange={(e) => handlePharmacyChange(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent"
                >
                  <option value="">Sélectionner une pharmacie</option>
                  {pharmacies.map(pharmacy => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Définit la pharmacie active par défaut pour cet utilisateur
                </p>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  <MapPin size={12} className="inline mr-1" /> Succursale
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => handleBranchChange(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!selectedPharmacyId}
                >
                  <option value="">Aucune succursale</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {!selectedPharmacyId && (
                  <p className="text-[10px] text-amber-500 mt-1">
                    Sélectionnez d'abord une pharmacie
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-2xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-medical text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-medical/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={14} />
              )}
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}