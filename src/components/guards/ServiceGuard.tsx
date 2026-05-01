// components/guards/ServiceGuard.tsx
import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';
import { Clock, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

interface ServiceGuardProps {
  children: ReactNode;
}

// ✅ Définition correcte du composant avec React.FC
export const ServiceGuard: React.FC<ServiceGuardProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  
  const [checking, setChecking] = useState(true);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [isOutOfService, setIsOutOfService] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const hasCheckedRef = useRef(false);
  const isRedirectingRef = useRef(false);

  const isAdminUser = useCallback((): boolean => {
    if (!user) return false;
    const role = user.role;
    return role === 'admin' || role === 'owner' || role === 'pharmacy_admin';
  }, [user]);

  const isSeller = useCallback((): boolean => {
    if (!user) return false;
    const role = user.role;
    return role === 'seller' || role === 'vendeur';
  }, [user]);

  const isSuperAdmin = useCallback((): boolean => {
    if (!user) return false;
    return user.role === 'super_admin';
  }, [user]);

  // ✅ MODIFICATION: Récupérer l'ID de la branche active au lieu de la pharmacie
  const getActiveBranchId = useCallback((): string | null => {
    if (!user) return null;
    // Priorité: active_branch_id (stocké dans l'utilisateur)
    if ((user as any).active_branch_id) {
      return (user as any).active_branch_id;
    }
    // Fallback: main_branch_id
    if ((user as any).main_branch_id) {
      return (user as any).main_branch_id;
    }
    // Fallback: branch_id du token
    if ((user as any).branch_id) {
      return (user as any).branch_id;
    }
    return null;
  }, [user]);

  // ✅ MODIFICATION: Utiliser l'endpoint des branches au lieu des pharmacies
  const checkServiceStatus = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      setError(null);
      console.log(`🔍 Vérification du service pour la branche: ${branchId}`);
      const response = await api.get<ServiceStatus>(`/branches/${branchId}/service-status`);
      const status = response.data;
      setServiceStatus(status);
      console.log(`✅ Statut du service: ${status.in_service ? 'EN SERVICE' : 'HORS SERVICE'}`);
      return status.in_service;
    } catch (err: any) {
      console.error('❌ Erreur lors de la vérification du service:', err);
      
      if (err.response?.status === 404) {
        setError('Branche non trouvée');
      } else if (err.response?.status === 403) {
        // Abonnement expiré
        setError('Abonnement expiré');
        return false;
      } else if (err.code === 'ERR_NETWORK') {
        setError('Erreur de connexion réseau');
      } else {
        setError('Service indisponible');
      }
      
      // En cas d'erreur, on autorise l'accès par sécurité
      return true;
    }
  }, []);

  useEffect(() => {
    if (hasCheckedRef.current) return;
    
    if (!isAuthenticated || !user) {
      setChecking(false);
      hasCheckedRef.current = true;
      return;
    }

    // Les vendeurs et super admins n'ont pas de restriction de service
    if (isSeller() || isSuperAdmin()) {
      console.log('👤 Vendeur ou Super Admin - pas de vérification de service');
      setChecking(false);
      hasCheckedRef.current = true;
      return;
    }

    // Seuls les admins sont concernés par la vérification du service
    if (!isAdminUser()) {
      setChecking(false);
      hasCheckedRef.current = true;
      return;
    }

    const branchId = getActiveBranchId();
    
    if (!branchId) {
      console.warn('⚠️ Aucun ID de branche trouvé pour l\'utilisateur');
      setError('Branche non trouvée');
      setChecking(false);
      hasCheckedRef.current = true;
      return;
    }

    const verify = async () => {
      setChecking(true);
      console.log('🔐 Vérification du service pour admin...');
      const inService = await checkServiceStatus(branchId);
      setIsOutOfService(!inService);
      setChecking(false);
      hasCheckedRef.current = true;
    };

    verify();
  }, [isAuthenticated, user, isAdminUser, isSeller, isSuperAdmin, getActiveBranchId, checkServiceStatus]);

  useEffect(() => {
    if (checking || isRedirectingRef.current) return;
    
    const currentPath = location.pathname;
    const isOnOutOfServicePage = currentPath === '/out-of-service';
    const isOnSubscriptionPage = currentPath === '/subscription';
    const isOnLoginPage = currentPath === '/login';
    
    if (isOnOutOfServicePage || isOnSubscriptionPage || isOnLoginPage) return;
    
    if (isOutOfService && !isSeller() && !isSuperAdmin()) {
      console.log('🚫 Service hors service, redirection vers /out-of-service');
      isRedirectingRef.current = true;
      
      if (serviceStatus) {
        sessionStorage.setItem('service_status', JSON.stringify(serviceStatus));
      }
      if (user) {
        sessionStorage.setItem('pending_user', JSON.stringify(user));
        const token = localStorage.getItem('access_token');
        if (token) sessionStorage.setItem('pending_token', token);
      }
      
      navigate('/out-of-service', { replace: true, state: { serviceStatus } });
      
      setTimeout(() => {
        isRedirectingRef.current = false;
      }, 500);
    }
    
    if (!isOutOfService && currentPath === '/out-of-service') {
      console.log('✅ Service rétabli, redirection vers dashboard');
      isRedirectingRef.current = true;
      navigate('/dashboard', { replace: true });
      toast.success('La pharmacie est maintenant en service !');
      
      setTimeout(() => {
        isRedirectingRef.current = false;
      }, 500);
    }
  }, [isOutOfService, checking, location.pathname, navigate, serviceStatus, user, isSeller, isSuperAdmin]);

  const handleRetry = () => {
    console.log('🔄 Nouvelle tentative de vérification');
    hasCheckedRef.current = false;
    setChecking(true);
    setIsOutOfService(false);
    setError(null);
    
    const branchId = getActiveBranchId();
    if (branchId) {
      checkServiceStatus(branchId).then(inService => {
        setIsOutOfService(!inService);
        setChecking(false);
        hasCheckedRef.current = true;
      });
    } else {
      setError('Aucune branche trouvée');
      setChecking(false);
      hasCheckedRef.current = true;
    }
  };

  const convertUTCToLocal = (utcTime: string): string => {
    if (!utcTime) return '';
    const [hours, minutes] = utcTime.split(':').map(Number);
    const date = new Date();
    date.setUTCHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  if (checking && isAdminUser() && !isSeller() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin w-10 h-10 text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Vérification du service...</p>
        </div>
      </div>
    );
  }

  if (error && !isOutOfService) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 bg-linear-to-r from-red-500 to-red-600">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                <AlertCircle className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Erreur</h2>
                <p className="text-sm text-white/80">Vérification du service</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="w-full py-3 bg-blue-500 text-white font-bold rounded-xl hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw size={18} />
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isOutOfService && !isSeller() && !isSuperAdmin()) {
    return (
      <div className="min-h-screen bg-linear-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-6 bg-linear-to-r from-amber-500 to-orange-600">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Clock className="text-white" size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Hors Service</h2>
                <p className="text-sm text-white/80">Succursale non disponible</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <p className="text-slate-600 mb-4">
              {serviceStatus?.message || "L'application n'est pas disponible pour le moment. Veuillez respecter les heures de service établies ou renouveler votre abonnement."}
            </p>

            <div className="bg-amber-50 p-4 rounded-xl space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Heures de service:</span>
                <span className="font-medium text-slate-700">
                  {serviceStatus?.working_hours?.start || '--'}:00 - {serviceStatus?.working_hours?.end || '--'}:00
                </span>
              </div>
              
              <div className="flex justify-between text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
                <span>Votre heure locale:</span>
                <span className="font-medium">
                  {convertUTCToLocal(serviceStatus?.working_hours?.start || '08:00')} - {convertUTCToLocal(serviceStatus?.working_hours?.end || '20:00')}
                </span>
              </div>

              <div>
                <span className="text-slate-500 text-sm">Jour actuel:</span>
                <div className="mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    serviceStatus?.is_working_day 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {serviceStatus?.is_working_day ? 'Jour ouvré' : 'Jour fermé'}
                  </span>
                </div>
              </div>

              {serviceStatus?.next_service_time && (
                <p className="text-sm text-blue-600 mt-2">
                  Prochain service: {new Date(serviceStatus.next_service_time).toLocaleString('fr-FR')}
                </p>
              )}

              <div className="text-xs text-slate-400 pt-2 border-t border-amber-200">
                <p>Fuseau horaire: {serviceStatus?.timezone || 'UTC'}</p>
                <p>• Accès restreint en dehors des heures de service</p>
                <p>• Abonnement expiré = mode lecture seule</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/subscription', { replace: true })}
                className="flex-1 py-3 border border-amber-300 rounded-xl hover:bg-amber-50 transition-colors"
              >
                Gérer l'abonnement
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw size={18} />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// ✅ Export par défaut avec le même typage
export default ServiceGuard;