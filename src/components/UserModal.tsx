// components/UserModal.tsx
import { useState, useEffect } from 'react';
import { X, UserPlus, Mail, Lock, User, Shield, AlertCircle, Building2, MapPin, Phone, Key } from 'lucide-react';
import { UserCreate } from '@/services/userService';
import { Pharmacy, BranchSummary } from '@/services/pharmacyService';

// ✅ CORRECTION : Aligner les rôles avec le backend
// Le backend accepte: admin, gestionnaire, pharmacien, vendeur, caissier, stockiste, comptable, preparateur
type UserRole = 'admin' | 'gestionnaire' | 'pharmacien' | 'vendeur' | 'caissier' | 'stockiste' | 'comptable' | 'preparateur';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (userData: UserCreate & { pharmacy_id?: string; branch_id?: string }) => void;
  isLoading: boolean;
  pharmacies: Pharmacy[];
  defaultPharmacyId?: string;
  defaultBranchId?: string;
}

export default function UserModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading,
  pharmacies,
  defaultPharmacyId = '',
  defaultBranchId = ''
}: UserModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'vendeur' as UserRole,
    is_active: true,
    telephone: '',
    adresse: '',
    pharmacy_id: defaultPharmacyId,
    branch_id: defaultBranchId
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Réinitialiser le formulaire quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '',
        email: '',
        password: '',
        role: 'vendeur',
        is_active: true,
        telephone: '',
        adresse: '',
        pharmacy_id: defaultPharmacyId,
        branch_id: defaultBranchId
      });
      setErrors({});
      setShowPassword(false);
    }
  }, [isOpen, defaultPharmacyId, defaultBranchId]);

  const getBranchesForPharmacy = (pharmacyId: string): BranchSummary[] => {
    const pharmacy = pharmacies.find(p => p.id === pharmacyId);
    return pharmacy?.config?.branchConfig?.branches || [];
  };

  const branches = getBranchesForPharmacy(formData.pharmacy_id);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleRoleChange = (role: string) => {
    setFormData(prev => ({ ...prev, role: role as UserRole }));
    if (errors.role) {
      setErrors(prev => ({ ...prev, role: '' }));
    }
  };

  const handlePharmacyChange = (pharmacyId: string) => {
    setFormData(prev => ({ 
      ...prev, 
      pharmacy_id: pharmacyId,
      branch_id: '' 
    }));
    if (errors.pharmacy_id) {
      setErrors(prev => ({ ...prev, pharmacy_id: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Le nom complet est requis';
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = 'Le nom doit contenir au moins 2 caractères';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
    }
    
    if (!formData.pharmacy_id) {
      newErrors.pharmacy_id = 'La pharmacie est requise';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    // ✅ CORRECTION : Convertir le rôle pour le backend si nécessaire
    // Le rôle est déjà au bon format grâce au type UserRole aligné
    onSubmit({
      full_name: formData.full_name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      role: formData.role,
      is_active: formData.is_active,
      telephone: formData.telephone || undefined,
      adresse: formData.adresse || undefined,
      pharmacy_id: formData.pharmacy_id,
      branch_id: formData.branch_id || undefined
    });
  };

  if (!isOpen) return null;

  // ✅ CORRECTION : Options de rôles alignées avec le backend
  const roleOptions: { value: UserRole; label: string }[] = [
    { value: 'admin', label: 'Administrateur' },
    { value: 'gestionnaire', label: 'Gestionnaire' },
    { value: 'pharmacien', label: 'Pharmacien' },
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
              AJOUTER <span className="text-medical">UN UTILISATEUR</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Créer un nouveau compte utilisateur
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
                  value={formData.full_name}
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
                    value={formData.email}
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
                    value={formData.telephone}
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
                  value={formData.adresse}
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
              <Lock size={18} className="text-medical" />
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Sécurité</h3>
            </div>
            
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Mot de passe *
              </label>
              <div className="relative">
                <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className={`w-full pl-10 p-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent ${
                    errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                  placeholder="Mot de passe (8 caractères minimum)"
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
                  value={formData.role}
                  onChange={(e) => handleRoleChange(e.target.value)}
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
                  <Building2 size={12} className="inline mr-1" /> Pharmacie *
                </label>
                <select
                  value={formData.pharmacy_id}
                  onChange={(e) => handlePharmacyChange(e.target.value)}
                  className={`w-full p-3 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent ${
                    errors.pharmacy_id ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                >
                  <option value="">Sélectionner une pharmacie</option>
                  {pharmacies.map(pharmacy => (
                    <option key={pharmacy.id} value={pharmacy.id}>
                      {pharmacy.name}
                    </option>
                  ))}
                </select>
                {errors.pharmacy_id && (
                  <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={10} /> {errors.pharmacy_id}
                  </p>
                )}
                {defaultPharmacyId && !formData.pharmacy_id && (
                  <p className="text-[10px] text-amber-500 mt-1">
                    La pharmacie par défaut sera utilisée
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  <MapPin size={12} className="inline mr-1" /> Succursale
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => handleChange('branch_id', e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-medical focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!formData.pharmacy_id}
                >
                  <option value="">Aucune succursale</option>
                  {branches.map(branch => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
                {defaultBranchId && !formData.branch_id && formData.pharmacy_id === defaultPharmacyId && (
                  <p className="text-[10px] text-amber-500 mt-1">
                    La succursale par défaut sera utilisée
                  </p>
                )}
                {!formData.pharmacy_id && (
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
                <UserPlus size={14} />
              )}
              Créer l'utilisateur
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}