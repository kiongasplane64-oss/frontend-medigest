// sections/SettingsSection.tsx
import { RefreshCw, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

interface SystemSettings {
  settings: {
    general: {
      platform_name: string;
      support_email: string;
      default_language: string;
      timezone: string;
    };
    registration: {
      allow_new_registrations: boolean;
      default_trial_days: number;
      default_plan: string;
    };
    maintenance: {
      mode: boolean;
      message: string;
    };
  };
}

export default function SettingsSection() {
  const { data: systemSettings, isLoading, refetch } = useQuery({
    queryKey: ['superadmin-system-settings'],
    queryFn: async () => {
      const { data } = await api.get<SystemSettings>('/super-admin/system/settings');
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (!systemSettings) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
        <p className="text-gray-500">Erreur lors du chargement des paramètres</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700">Paramètres système</h3>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} />
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Général</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400">Nom de la plateforme</div>
                <div className="text-sm font-medium">{systemSettings.settings.general.platform_name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Email support</div>
                <div className="text-sm">{systemSettings.settings.general.support_email}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Langue par défaut</div>
                <div className="text-sm">{systemSettings.settings.general.default_language}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Fuseau horaire</div>
                <div className="text-sm">{systemSettings.settings.general.timezone}</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Inscription</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-400">Nouvelles inscriptions</div>
                <div className="text-sm">
                  {systemSettings.settings.registration.allow_new_registrations ? 'Autorisées' : 'Bloquées'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Jours d'essai par défaut</div>
                <div className="text-sm">{systemSettings.settings.registration.default_trial_days} jours</div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Maintenance</h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${systemSettings.settings.maintenance.mode ? 'bg-red-500' : 'bg-green-500'}`} />
              <span className="text-sm">
                {systemSettings.settings.maintenance.mode ? 'Mode maintenance activé' : 'Mode maintenance désactivé'}
              </span>
            </div>
            {systemSettings.settings.maintenance.mode && (
              <div className="mt-2 text-sm text-gray-600">
                Message: {systemSettings.settings.maintenance.message}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}