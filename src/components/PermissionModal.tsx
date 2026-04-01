// src/components/PermissionModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  Shield, 
  Package, 
  BarChart3, 
  Settings,
  ShoppingCart,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { UserPermissions, getDefaultPermissions } from '@/services/userService';

// Interface étendue pour l'utilisateur avec les champs supplémentaires
// Sans redéclarer les propriétés de User pour éviter les conflits
interface ExtendedUser {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  name?: string;
  permissions?: UserPermissions;
}

interface PermissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: ExtendedUser;
  onSave: (userId: string, permissions: UserPermissions) => void;
  isLoading?: boolean;
}


const PermissionModal: React.FC<PermissionModalProps> = ({
  isOpen,
  onClose,
  user,
  onSave,
  isLoading = false
}) => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    can_sell: false,
    can_modify_stock: false,
    can_view_reports: false,
    can_view_profits: false,
    can_view_sales: false,
    can_modify_service_hours: false,
    can_use_overtime: false,
    can_modify_settings: false,
    can_do_inventory: false,
    can_manage_users: false,
    can_view_attendance: false,
    can_export_data: false
  });

  const [showSuccess, setShowSuccess] = useState(false);

  // Initialiser les permissions quand l'utilisateur change
  useEffect(() => {
    if (user) {
      if (user.permissions) {
        setPermissions(user.permissions);
      } else {
        // Charger les permissions par défaut basées sur le rôle
        const defaultPerms = getDefaultPermissions(user.role);
        setPermissions(defaultPerms);
      }
    }
  }, [user]);

  // Réinitialiser avec les permissions par défaut du rôle
  const resetToDefault = () => {
    if (user) {
      const defaultPerms = getDefaultPermissions(user.role);
      setPermissions(defaultPerms);
    }
  };

  // Activer/désactiver toutes les permissions
  const toggleAll = (value: boolean) => {
    const newPermissions = { ...permissions };
    Object.keys(newPermissions).forEach(key => {
      newPermissions[key as keyof UserPermissions] = value;
    });
    setPermissions(newPermissions);
  };

  const handleSave = () => {
    if (user) {
      onSave(user.id, permissions);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  if (!isOpen || !user) return null;

  // Grouper les permissions par catégorie
  const permissionGroups = [
    {
      title: "Ventes",
      icon: <ShoppingCart size={16} />,
      permissions: [
        { key: 'can_sell' as const, label: 'Effectuer des ventes' },
        { key: 'can_view_sales' as const, label: 'Voir les ventes' }
      ]
    },
    {
      title: "Stock",
      icon: <Package size={16} />,
      permissions: [
        { key: 'can_modify_stock' as const, label: 'Modifier le stock' },
        { key: 'can_do_inventory' as const, label: "Faire l'inventaire" }
      ]
    },
    {
      title: "Rapports & Finances",
      icon: <BarChart3 size={16} />,
      permissions: [
        { key: 'can_view_reports' as const, label: 'Voir les rapports' },
        { key: 'can_view_profits' as const, label: 'Voir les bénéfices' },
        { key: 'can_export_data' as const, label: 'Exporter les données' }
      ]
    },
    {
      title: "Configuration",
      icon: <Settings size={16} />,
      permissions: [
        { key: 'can_modify_service_hours' as const, label: 'Modifier les heures de service' },
        { key: 'can_use_overtime' as const, label: 'Heures supplémentaires' },
        { key: 'can_modify_settings' as const, label: 'Modifier les paramètres' }
      ]
    },
    {
      title: "Administration",
      icon: <Shield size={16} />,
      permissions: [
        { key: 'can_manage_users' as const, label: 'Gérer les utilisateurs' },
        { key: 'can_view_attendance' as const, label: 'Voir les présences' }
      ]
    }
  ];

  // Fonction pour obtenir le nom d'affichage
  const getDisplayName = (): string => {
    // Utiliser full_name si disponible, sinon name, sinon email
    return user.full_name || user.name || user.email || 'Utilisateur';
  };

  // Fonction pour obtenir le libellé du rôle
  const getRoleLabel = (): string => {
    const roleMap: Record<string, string> = {
      'admin': 'Administrateur',
      'manager': 'Gestionnaire',
      'pharmacist': 'Pharmacien',
      'vendeur': 'Vendeur',
      'caissier': 'Caissier',
      'stockiste': 'Stockiste',
      'comptable': 'Comptable',
      'preparateur': 'Préparateur'
    };
    return roleMap[user.role] || user.role;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-5">
        
        {/* En-tête */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-linear-to-r from-medical/5 to-transparent">
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">
              PERMISSIONS - <span className="text-medical">{getDisplayName()}</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Rôle actuel : {getRoleLabel()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            type="button"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Message de succès */}
        {showSuccess && (
          <div className="mx-6 mt-4 bg-green-100 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} />
            Permissions mises à jour avec succès !
          </div>
        )}

        {/* Actions rapides */}
        <div className="px-6 pt-4 flex items-center gap-2 border-b border-slate-100 pb-4">
          <button
            onClick={() => toggleAll(true)}
            className="text-[10px] font-black px-3 py-1.5 bg-medical/10 text-medical rounded-lg hover:bg-medical/20 transition-colors uppercase tracking-widest"
            type="button"
          >
            Tout activer
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="text-[10px] font-black px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors uppercase tracking-widest"
            type="button"
          >
            Tout désactiver
          </button>
          <button
            onClick={resetToDefault}
            className="text-[10px] font-black px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors uppercase tracking-widest ml-auto"
            type="button"
          >
            Par défaut ({getRoleLabel()})
          </button>
        </div>

        {/* Corps - Liste des permissions */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-6">
            {permissionGroups.map((group) => (
              <div key={group.title} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <div className="flex items-center gap-2 mb-3 text-slate-700">
                  <div className="text-medical">{group.icon}</div>
                  <h3 className="font-black text-xs uppercase tracking-widest">{group.title}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.permissions.map((perm) => (
                    <div key={perm.key} className="flex items-center justify-between p-2 bg-white rounded-xl">
                      <span className="text-xs font-medium text-slate-600">{perm.label}</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={permissions[perm.key]}
                          onChange={(e) => setPermissions({
                            ...permissions,
                            [perm.key]: e.target.checked
                          })}
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-medical"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Note d'information */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 font-medium">
                Les permissions définissent précisément ce que l'utilisateur peut faire dans l'application. 
                Elles prévalent sur le rôle de base. Utilisez "Par défaut" pour revenir aux permissions standards du rôle.
              </p>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="p-6 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
            type="button"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-medical text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-medical/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-medical/20"
            type="button"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save size={16} />
            )}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionModal;