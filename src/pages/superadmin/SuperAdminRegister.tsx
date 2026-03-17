// src/pages/superadmin/SuperAdminRegister.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Shield,
  Mail,
  Lock,
  User,
  Phone,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  CheckCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import api from '@/api/client';
import toast from 'react-hot-toast';

// ==================== TYPES ====================
interface SuperAdminSetupData {
  email: string;
  password: string;
  nom_complet: string;
  setup_key: string;
}

interface SuperAdminCreateData {
  email: string;
  password: string;
  nom_complet: string;
  telephone?: string;
}

interface SetupResponse {
  message: string;
  credentials?: {
    email: string;
    password: string;
  };
}

interface CreateResponse {
  message: string;
  user: {
    id: string;
    email: string;
    nom_complet: string;
    role: string;
  };
}

// ==================== SERVICES ====================
const superAdminAuthService = {
  // Pour le premier super admin (setup initial)
  setupFirstSuperAdmin: async (data: SuperAdminSetupData): Promise<SetupResponse> => {
    const response = await api.post('/auth/super-admin/setup', data);
    return response.data;
  },

  // Pour créer des super admins supplémentaires (nécessite d'être déjà super admin)
  createSuperAdmin: async (data: SuperAdminCreateData): Promise<CreateResponse> => {
    const response = await api.post('/super-admin/users/super-admins', data);
    return response.data;
  }
};

// ==================== COMPOSANT PRINCIPAL ====================
export default function SuperAdminRegister() {
  const navigate = useNavigate();
  const [isFirstSetup, setIsFirstSetup] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showSetupKey, setShowSetupKey] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    nom_complet: '',
    telephone: '',
    setup_key: ''
  });
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Mutations
  const setupMutation = useMutation({
    mutationFn: superAdminAuthService.setupFirstSuperAdmin,
    onSuccess: (data) => {
      toast.success('Super administrateur créé avec succès !');
      toast.success('Veuillez noter vos identifiants dans un endroit sécurisé.', {
        duration: 10000
      });
      
      // Afficher les identifiants dans une alerte (pour le premier setup)
      if (data.credentials) {
        alert(`
          ⚠️ IMPORTANT - CONSERVEZ CES INFORMATIONS ⚠️
          
          Email: ${data.credentials.email}
          Mot de passe: ${data.credentials.password}
          
          Veuillez changer ce mot de passe dès votre première connexion.
          Cette information ne sera plus jamais affichée.
        `);
      }
      
      // Rediriger vers la page de connexion après 3 secondes
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Erreur lors de la création';
      toast.error(message);
    }
  });

  const createMutation = useMutation({
    mutationFn: superAdminAuthService.createSuperAdmin,
    onSuccess: () => {
      toast.success('Super administrateur créé avec succès !');
      setFormData({
        email: '',
        password: '',
        confirmPassword: '',
        nom_complet: '',
        telephone: '',
        setup_key: ''
      });
    },
    onError: (error: any) => {
      const message = error.response?.data?.detail || 'Erreur lors de la création';
      toast.error(message);
    }
  });

  // Calculer la force du mot de passe
  const calculatePasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[a-z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    return Math.min(100, (strength / 6) * 100);
  };

  // Gérer les changements de mot de passe
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setFormData({ ...formData, password: newPassword });
    setPasswordStrength(calculatePasswordStrength(newPassword));
  };

  // Valider le formulaire
  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.nom_complet) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return false;
    }

    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères');
      return false;
    }

    if (isFirstSetup && !formData.setup_key) {
      toast.error('La clé d\'installation est requise');
      return false;
    }

    return true;
  };

  // Soumettre le formulaire
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (isFirstSetup) {
      setupMutation.mutate({
        email: formData.email,
        password: formData.password,
        nom_complet: formData.nom_complet,
        setup_key: formData.setup_key
      });
    } else {
      createMutation.mutate({
        email: formData.email,
        password: formData.password,
        nom_complet: formData.nom_complet,
        telephone: formData.telephone || undefined
      });
    }
  };

  // Obtenir la couleur de la force du mot de passe
  const getStrengthColor = () => {
    if (passwordStrength < 30) return 'bg-red-500';
    if (passwordStrength < 60) return 'bg-orange-500';
    if (passwordStrength < 80) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (passwordStrength < 30) return 'Faible';
    if (passwordStrength < 60) return 'Moyen';
    if (passwordStrength < 80) return 'Bon';
    return 'Fort';
  };

  return (
    <div className="min-h-screen -bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="inline-flex h-20 w-20 -bg-gradient-to-br from-red-500 to-red-600 rounded-2xl shadow-xl shadow-red-500/20 items-center justify-center mb-4">
            <Shield className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {isFirstSetup ? 'Configuration Initiale' : 'Créer un Super Admin'}
          </h1>
          <p className="text-slate-400">
            {isFirstSetup 
              ? 'Configurez le premier super administrateur de la plateforme'
              : 'Ajoutez un nouveau super administrateur'
            }
          </p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="superadmin@example.com"
                />
              </div>
            </div>

            {/* Nom complet */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nom complet <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  required
                  value={formData.nom_complet}
                  onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="Jean Dupont"
                />
              </div>
            </div>

            {/* Téléphone (optionnel pour le premier setup) */}
            {!isFirstSetup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    placeholder="+243 XXX XXX XXX"
                  />
                </div>
              </div>
            )}

            {/* Mot de passe */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handlePasswordChange}
                  className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {/* Indicateur de force du mot de passe */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex gap-1 flex-1">
                      <div className={`h-1 flex-1 rounded-full ${passwordStrength > 0 ? getStrengthColor() : 'bg-slate-200'}`} />
                      <div className={`h-1 flex-1 rounded-full ${passwordStrength > 30 ? getStrengthColor() : 'bg-slate-200'}`} />
                      <div className={`h-1 flex-1 rounded-full ${passwordStrength > 60 ? getStrengthColor() : 'bg-slate-200'}`} />
                      <div className={`h-1 flex-1 rounded-full ${passwordStrength > 80 ? getStrengthColor() : 'bg-slate-200'}`} />
                    </div>
                    <span className={`text-xs font-medium ml-2 ${
                      passwordStrength < 30 ? 'text-red-500' :
                      passwordStrength < 60 ? 'text-orange-500' :
                      passwordStrength < 80 ? 'text-yellow-600' :
                      'text-green-500'
                    }`}>
                      {getStrengthText()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirmation mot de passe */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirmer le mot de passe <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full pl-10 pr-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 ${
                    formData.confirmPassword && formData.password !== formData.confirmPassword
                      ? 'border-red-500 bg-red-50'
                      : formData.confirmPassword && formData.password === formData.confirmPassword
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200'
                  }`}
                  placeholder="••••••••"
                />
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                )}
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-500">Les mots de passe ne correspondent pas</p>
              )}
            </div>

            {/* Clé d'installation (uniquement pour le premier setup) */}
            {isFirstSetup && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Clé d'installation <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type={showSetupKey ? 'text' : 'password'}
                    required
                    value={formData.setup_key}
                    onChange={(e) => setFormData({ ...formData, setup_key: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    placeholder="Clé secrète d'installation"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupKey(!showSetupKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showSetupKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Cette clé est fournie dans la configuration du serveur
                </p>
              </div>
            )}

            {/* Bouton de soumission */}
            <button
              type="submit"
              disabled={setupMutation.isPending || createMutation.isPending}
              className="w-full py-3 -bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {(setupMutation.isPending || createMutation.isPending) ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Création en cours...
                </>
              ) : (
                'Créer le Super Administrateur'
              )}
            </button>

            {/* Message d'avertissement pour le premier setup */}
            {isFirstSetup && (
              <div className="mt-4 p-4 bg-orange-50 rounded-xl border border-orange-200">
                <div className="flex gap-2">
                  <AlertCircle className="text-orange-500 shrink-0" size={18} />
                  <div className="text-xs text-orange-700">
                    <p className="font-medium mb-1">⚠️ Attention - Configuration initiale</p>
                    <p>Cette action créera le premier super administrateur. Les identifiants ne seront affichés qu'une seule fois. Assurez-vous de les conserver dans un endroit sécurisé.</p>
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Bas de page */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/login')}
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1 mx-auto"
            >
              <ArrowLeft size={14} />
              Retour à la connexion
            </button>
          </div>
        </div>

        {/* Toggle entre premier setup et création additionnelle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsFirstSetup(!isFirstSetup)}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            {isFirstSetup 
              ? 'Déjà configuré ? Créer un super admin supplémentaire'
              : 'Première installation ? Configurer le super admin initial'
            }
          </button>
        </div>
      </div>
    </div>
  );
}