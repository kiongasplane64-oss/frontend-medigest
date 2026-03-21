// SuperAdminLayout.tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Bell, RefreshCw, LogOut, Globe, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';
import SuperAdminSidebar from './SuperAdminSidebar';
import OverviewSection from './sections/OverviewSection';
import TenantsSection from './sections/TenantsSection';
import UsersSection from './sections/UsersSection';
import SubscriptionsSection from './sections/SubscriptionsSection';
import AnalyticsSection from './sections/AnalysticsSection';
import SystemSection from './sections/SystemSection';
import LogsSection from './sections/LogsSection';
import SettingsSection from './sections/SettingsSection';
import GenerateCodeSection from './sections/GenerateCodeSection';

export type ActiveMenu = 
  | 'overview' 
  | 'tenants' 
  | 'users' 
  | 'subscriptions' 
  | 'analytics' 
  | 'system' 
  | 'logs' 
  | 'settings'
  | 'generate-codes';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string };
    services: { status: string };
    performance: { status: string };
  };
  recommendations?: string[];
}

interface DashboardOverview {
  platform: {
    total_tenants: number;
    active_tenants: number;
    trial_tenants: number;
    total_users: number;
    super_admins: number;
  };
  growth: {
    new_today: number;
    new_week: number;
    new_month: number;
    growth_rate: number;
  };
  distribution: {
    by_plan: Record<string, number>;
  };
  recent_activity: {
    audit_logs: Array<{
      id: string;
      action: string;
      description: string;
      created_at: string;
    }>;
  };
  timestamp: string;
}

export default function SuperAdminLayout() {
  const navigate = useNavigate();
  const { user, logout, refreshSession, token } = useAuthStore();
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('overview');
  const [isInitialized, setIsInitialized] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Vérification d'authentification avec gestion du token
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const storedToken = localStorage.getItem('access_token');
        
        if (!storedToken && !token) {
          console.log('🔑 No access token found');
          setAuthError('Authentification requise');
          logout();
          navigate('/login', { replace: true });
          return;
        }
        
        // Vérifier le rôle
        if (user?.role !== 'super_admin') {
          console.error('❌ User is not super admin:', user?.role);
          setAuthError('Accès non autorisé - Rôle super admin requis');
          logout();
          navigate('/login', { replace: true });
          return;
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Auth check error:', error);
        setAuthError('Erreur d\'authentification');
        logout();
        navigate('/login', { replace: true });
      }
    };
    
    if (!isInitialized) {
      checkAuth();
    }
  }, [user, logout, navigate, isInitialized, token]);

  // Vérifier périodiquement si le token est expiré et le rafraîchir
  useEffect(() => {
    if (!isInitialized) return;

    const checkTokenExpiration = async () => {
      try {
        const tokenExpired = useAuthStore.getState().isTokenExpired();
        if (tokenExpired) {
          console.log('🔄 Token expiré, tentative de refresh...');
          const newToken = await refreshSession();
          if (newToken) {
            console.log('✅ Token rafraîchi avec succès');
            toast.success('Session rafraîchie automatiquement');
          } else {
            console.error('❌ Échec du refresh token');
            setAuthError('Session expirée, veuillez vous reconnecter');
            logout();
            navigate('/login', { replace: true });
          }
        }
      } catch (error) {
        console.error('Erreur lors de la vérification du token:', error);
      }
    };

    // Vérifier toutes les 5 minutes
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    
    // Vérifier immédiatement au montage
    checkTokenExpiration();

    return () => clearInterval(interval);
  }, [isInitialized, refreshSession, logout, navigate]);

  // Requêtes API (l'intercepteur gère automatiquement le token)
  const { 
    data: overview, 
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview
  } = useQuery({
    queryKey: ['superadmin-overview'],
    queryFn: async () => {
      const { data } = await api.get<DashboardOverview>('/super-admin/dashboard/overview');
      return data;
    },
    refetchInterval: 60000,
    enabled: isInitialized && !!user && user?.role === 'super_admin',
    retry: 1,
    staleTime: 30000
  });

  const { 
    data: healthData, 
    refetch: refetchHealth,
    error: healthError
  } = useQuery({
    queryKey: ['superadmin-health'],
    queryFn: async () => {
      const { data } = await api.get<SystemHealth>('/super-admin/system/health');
      return data;
    },
    refetchInterval: 300000,
    enabled: isInitialized && !!user && user?.role === 'super_admin',
    retry: 1
  });

  // Afficher une notification si erreur santé
  useEffect(() => {
    if (healthError) {
      console.error('Health check error:', healthError);
      toast.error('Erreur de connexion au service santé');
    }
  }, [healthError]);

  const handleRefresh = useCallback(() => {
    toast.promise(
      Promise.all([refetchOverview(), refetchHealth()]),
      {
        loading: 'Rafraîchissement des données...',
        success: '✅ Données mises à jour',
        error: '❌ Erreur lors du rafraîchissement'
      }
    );
  }, [refetchOverview, refetchHealth]);

  const handleLogout = useCallback(() => {
    toast.success('Déconnexion réussie');
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  const handleNotification = useCallback(() => {
    toast('Fonctionnalité à venir', {
      icon: '🔔',
      duration: 3000,
    });
  }, []);

  // Afficher un écran de chargement
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-red-500 mx-auto mb-4" size={48} />
          <p className="text-gray-600">Vérification des accès...</p>
        </div>
      </div>
    );
  }

  // Afficher une erreur d'authentification
  if (authError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Erreur d'authentification</h2>
          <p className="text-gray-500 mb-4">{authError}</p>
          <button
            onClick={() => {
              setAuthError(null);
              logout();
              navigate('/login', { replace: true });
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Retour à la connexion
          </button>
        </div>
      </div>
    );
  }

  // Afficher une erreur de chargement des données
  if (overviewError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-red-100 p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Erreur de chargement</h2>
          <p className="text-gray-500 mb-4">
            {overviewError instanceof Error ? overviewError.message : 'Impossible de charger le tableau de bord'}
          </p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <SuperAdminSidebar activeMenu={activeMenu} onMenuChange={setActiveMenu} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">Super Administration</h1>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Globe size={12} /> Plateforme MEDIGEST • {user?.nom_complet || 'Super Admin'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Indicateur système */}
                <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-xl">
                  <div className={`w-2 h-2 rounded-full ${
                    healthData?.status === 'healthy' 
                      ? 'bg-green-500 animate-pulse' 
                      : healthData?.status === 'degraded'
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-red-500 animate-pulse'
                  }`} />
                  <span className="text-xs font-medium text-gray-600">
                    {healthData?.status === 'healthy' 
                      ? 'Système OK' 
                      : healthData?.status === 'degraded'
                        ? 'Système dégradé'
                        : healthData?.status === 'unhealthy'
                          ? 'Problème détecté'
                          : 'État inconnu'}
                  </span>
                </div>

                {/* Notifications */}
                <button 
                  className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  onClick={handleNotification}
                >
                  <Bell size={18} className="text-gray-600" />
                </button>

                {/* Rafraîchir */}
                <button 
                  onClick={handleRefresh}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  title="Rafraîchir les données"
                >
                  <RefreshCw size={18} className="text-gray-600" />
                </button>

                {/* Déconnexion */}
                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-600"
                  title="Déconnexion"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-auto">
          {activeMenu === 'overview' && (
            <OverviewSection 
              overview={overview} 
              health={healthData}
              isLoading={overviewLoading}
              onRefresh={refetchOverview}
            />
          )}
          {activeMenu === 'tenants' && <TenantsSection />}
          {activeMenu === 'users' && <UsersSection />}
          {activeMenu === 'subscriptions' && <SubscriptionsSection />}
          {activeMenu === 'analytics' && <AnalyticsSection />}
          {activeMenu === 'system' && <SystemSection />}
          {activeMenu === 'logs' && <LogsSection />}
          {activeMenu === 'settings' && <SettingsSection />}
          {activeMenu === 'generate-codes' && <GenerateCodeSection />}
        </main>
      </div>
    </div>
  );
}