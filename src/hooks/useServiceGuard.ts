// hooks/useServiceGuard.ts
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';

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

export const useServiceGuard = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isOutOfService, setIsOutOfService] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = useCallback(() => {
    if (!user) return false;
    const role = user.role;
    return role === 'admin' || role === 'owner' || role === 'pharmacy_admin';
  }, [user]);

  const isSeller = useCallback(() => {
    if (!user) return false;
    const role = user.role;
    return role === 'seller' || role === 'vendeur';
  }, [user]);

  const isSuperAdmin = useCallback(() => {
    if (!user) return false;
    return user.role === 'super_admin';
  }, [user]);

  // ✅ MODIFICATION: Récupérer l'ID de la branche active
  const getActiveBranchId = useCallback(() => {
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

  // ✅ MODIFICATION: Fonction pour vérifier manuellement le service
  const checkServiceStatus = useCallback(async (branchId: string): Promise<boolean> => {
    try {
      setError(null);
      console.log(`🔍 [useServiceGuard] Vérification du service pour la branche: ${branchId}`);
      const response = await api.get(`/branches/${branchId}/service-status`);
      const status = response.data;
      setServiceStatus(status);
      const inService = status.in_service;
      setIsOutOfService(!inService);
      console.log(`✅ [useServiceGuard] Statut du service: ${inService ? 'EN SERVICE' : 'HORS SERVICE'}`);
      return inService;
    } catch (err: any) {
      console.error('❌ [useServiceGuard] Erreur vérification service:', err);
      
      if (err.response?.status === 404) {
        setError('Branche non trouvée');
      } else if (err.response?.status === 403) {
        setError('Abonnement expiré - mode lecture seule');
        setIsOutOfService(true);
        return false;
      } else if (err.code === 'ERR_NETWORK') {
        setError('Erreur de connexion réseau');
      } else {
        setError('Service indisponible');
      }
      
      // En cas d'erreur réseau, on autorise l'accès par sécurité
      setIsOutOfService(false);
      return true;
    }
  }, []);

  // ✅ MODIFICATION: Fonction pour rafraîchir le statut
  const refreshServiceStatus = useCallback(async () => {
    const branchId = getActiveBranchId();
    if (!branchId) {
      console.warn('⚠️ [useServiceGuard] Aucun ID de branche trouvé');
      setError('Aucune branche trouvée');
      setIsChecking(false);
      return false;
    }
    
    setIsChecking(true);
    const inService = await checkServiceStatus(branchId);
    setIsChecking(false);
    return inService;
  }, [getActiveBranchId, checkServiceStatus]);

  useEffect(() => {
    const checkService = async () => {
      console.log('🔐 [useServiceGuard] Début de la vérification du service');
      
      // Ne pas vérifier pour les non-admin
      if (!isAuthenticated || !user) {
        console.log('❌ [useServiceGuard] Utilisateur non authentifié');
        setIsChecking(false);
        return;
      }

      // Les vendeurs et super admins n'ont pas de restriction de service
      if (isSeller() || isSuperAdmin()) {
        console.log('👤 [useServiceGuard] Vendeur ou Super Admin - pas de vérification');
        setIsChecking(false);
        return;
      }

      // Seuls les admins sont concernés par la vérification du service
      if (!isAdmin()) {
        console.log('❌ [useServiceGuard] Utilisateur non admin - pas de vérification');
        setIsChecking(false);
        return;
      }

      const branchId = getActiveBranchId();
      if (!branchId) {
        console.warn('⚠️ [useServiceGuard] Aucun ID de branche trouvé pour l\'admin');
        setError('Branche non trouvée');
        setIsChecking(false);
        return;
      }

      console.log(`🔍 [useServiceGuard] Vérification pour admin - branche: ${branchId}`);
      await checkServiceStatus(branchId);
      setIsChecking(false);
    };

    checkService();
  }, [isAuthenticated, user, isAdmin, isSeller, isSuperAdmin, getActiveBranchId, checkServiceStatus]);

  return { 
    isChecking, 
    isOutOfService, 
    serviceStatus,
    error,
    refreshServiceStatus,
    checkServiceStatus: () => {
      const branchId = getActiveBranchId();
      if (branchId) {
        return checkServiceStatus(branchId);
      }
      return Promise.resolve(false);
    }
  };
};

// ✅ Export par défaut
export default useServiceGuard;