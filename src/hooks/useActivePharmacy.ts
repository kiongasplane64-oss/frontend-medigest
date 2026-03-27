// hooks/useActivePharmacy.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import * as pharmacyService from '@/services/pharmacyService';
import type { 
  PharmacyConfig, 
  Branch, 
  ServiceStatus, 
  ActivePharmacy,
  SalesConfig,
  WorkingHours,
  CurrencyConfig,
  AutomaticPricingConfig
} from '@/services/pharmacyService';

// Types pour le hook
interface ActivePharmacyState {
  id: string | null;
  name: string | null;
  licenseNumber: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  country: string | null;
  isActive: boolean;
  config: PharmacyConfig | null;
  isLoading: boolean;
  error: Error | null;
  lastChecked: Date | null;
  defaultBranchId: string | null;
  defaultBranch: Branch | null;
  branches: Branch[];
  serviceStatus: ServiceStatus | null;
  activePharmacyData: ActivePharmacy | null;
}

interface UseActivePharmacyReturn extends ActivePharmacyState {
  setActivePharmacy: (pharmacyId: string) => Promise<void>;
  clearActivePharmacy: () => void;
  refreshActivePharmacy: () => Promise<void>;
  checkServiceStatus: () => Promise<void>;
  updateConfig: (config: Partial<PharmacyConfig>) => Promise<PharmacyConfig>;
  updateSalesConfig: (salesConfig: SalesConfig) => Promise<SalesConfig>;
  updateWorkingHours: (workingHours: WorkingHours) => Promise<WorkingHours>;
  updateCurrencies: (currencies: CurrencyConfig[]) => Promise<CurrencyConfig[]>;
  updatePricing: (pricing: AutomaticPricingConfig) => Promise<AutomaticPricingConfig>;
  updateTheme: (theme: 'light' | 'dark' | 'system') => Promise<string>;
  uploadLogo: (file: File) => Promise<string>;
  isOpen: boolean;
  hasBranches: boolean;
  branchesCount: number;
  mainBranch: Branch | null;
}

// Clé pour le stockage local
const STORAGE_KEY = 'active_pharmacy_id';

/**
 * Hook pour gérer la pharmacie active de l'utilisateur
 * 
 * Utilise le contexte de l'utilisateur connecté pour déterminer
 * la pharmacie active, avec persistance dans localStorage
 */
export function useActivePharmacy(): UseActivePharmacyReturn {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [activePharmacyData, setActivePharmacyData] = useState<ActivePharmacy | null>(null);
  const [isLoadingService, setIsLoadingService] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Charger la pharmacie active depuis localStorage et du serveur au montage
  useEffect(() => {
    const loadActivePharmacy = async () => {
      try {
        // Essayer de récupérer la pharmacie active depuis le serveur
        const activePharmacy = await pharmacyService.getActivePharmacy();
        if (activePharmacy && activePharmacy.id) {
          setActivePharmacyData(activePharmacy);
          setActiveId(activePharmacy.id);
          localStorage.setItem(STORAGE_KEY, activePharmacy.id);
        } else {
          // Fallback sur localStorage
          const savedId = localStorage.getItem(STORAGE_KEY);
          if (savedId) {
            setActiveId(savedId);
          }
        }
      } catch (error) {
        // En cas d'erreur, utiliser localStorage
        console.warn('Impossible de récupérer la pharmacie active depuis le serveur:', error);
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          setActiveId(savedId);
        }
      }
    };

    loadActivePharmacy();
  }, []);

  // Récupérer les détails de la pharmacie active
  const {
    data: pharmacy,
    isLoading: isLoadingPharmacy,
    error: pharmacyError,
    refetch: refetchPharmacy,
  } = useQuery({
    queryKey: ['active-pharmacy', activeId],
    queryFn: async () => {
      if (!activeId) return null;
      try {
        const data = await pharmacyService.getPharmacyById(activeId);
        return data;
      } catch (err) {
        // Si la pharmacie n'existe plus ou est inaccessible, effacer
        if (err instanceof Error && (err.message.includes('404') || err.message.includes('not found'))) {
          localStorage.removeItem(STORAGE_KEY);
          setActiveId(null);
          setActivePharmacyData(null);
        }
        throw err;
      }
    },
    enabled: !!activeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  // Récupérer la configuration de la pharmacie
  const {
    data: config,
    isLoading: isLoadingConfig,
    error: configError,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['pharmacy-config', activeId],
    queryFn: async () => {
      if (!activeId) return null;
      return await pharmacyService.getPharmacyConfig(activeId);
    },
    enabled: !!activeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Récupérer les branches de la pharmacie
  const {
    data: branchesData,
    isLoading: isLoadingBranches,
    refetch: refetchBranches,
  } = useQuery({
    queryKey: ['pharmacy-branches', activeId],
    queryFn: async () => {
      if (!activeId) return [];
      return await pharmacyService.getPharmacyBranches(activeId, true);
    },
    enabled: !!activeId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Mettre à jour les branches dans l'état
  useEffect(() => {
    if (branchesData) {
      setBranches(branchesData);
    }
  }, [branchesData]);

  // Vérifier le statut de service
  const checkServiceStatus = useCallback(async () => {
    if (!activeId) return;

    setIsLoadingService(true);
    try {
      const status = await pharmacyService.checkPharmacyServiceStatus(activeId);
      setServiceStatus({
        in_service: status.in_service,
        restrictions_enabled: status.restrictions_enabled,
        current_time_utc: status.current_time_utc,
        current_time_local: status.current_time_local,
        timezone: status.timezone,
        current_day: status.current_day,
        is_working_day: status.is_working_day,
        is_open_today: status.is_open_today,
        is_within_hours: status.is_within_hours,
        working_hours: status.working_hours,
        message: status.message,
        next_service_time: status.next_service_time,
      });
    } catch (err) {
      console.error('Erreur lors de la vérification du service:', err);
      setServiceStatus({
        in_service: true,
        restrictions_enabled: false,
        current_time_utc: new Date().toISOString(),
        current_time_local: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        current_day: new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase(),
        is_working_day: true,
        is_open_today: true,
        is_within_hours: true,
        working_hours: { start: '00:00', end: '23:59' },
        message: 'Service disponible (vérification impossible)',
        next_service_time: undefined,
      });
    } finally {
      setIsLoadingService(false);
    }
  }, [activeId]);

  // Vérifier le statut de service périodiquement (toutes les 5 minutes)
  useEffect(() => {
    if (!activeId) return;

    checkServiceStatus();

    const interval = setInterval(checkServiceStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeId, checkServiceStatus]);

  // Mutation pour définir la pharmacie active sur le serveur
  const setActiveMutation = useMutation({
    mutationFn: async (pharmacyId: string) => {
      const setActiveResult = await pharmacyService.setActivePharmacy(pharmacyId);
      // Mettre à jour les données ActivePharmacy
      const activePharmacy = await pharmacyService.getActivePharmacy();
      setActivePharmacyData(activePharmacy);
      // Utiliser le résultat pour éviter l'erreur "result is declared but never used"
      console.log('Pharmacie active définie:', setActiveResult.message);
      return setActiveResult;
    },
    onSuccess: (result, pharmacyId) => {
      setActiveId(pharmacyId);
      localStorage.setItem(STORAGE_KEY, pharmacyId);
      // Utiliser result pour confirmer le succès
      console.log('Succès:', result.message);
      // Invalider les caches
      queryClient.invalidateQueries({ queryKey: ['active-pharmacy'] });
    },
  });

  // Définir la pharmacie active
  const setActivePharmacy = useCallback(async (pharmacyId: string) => {
    await setActiveMutation.mutateAsync(pharmacyId);
  }, [setActiveMutation]);

  // Effacer la pharmacie active
  const clearActivePharmacy = useCallback(() => {
    setActiveId(null);
    setActivePharmacyData(null);
    localStorage.removeItem(STORAGE_KEY);
    setServiceStatus(null);
    setBranches([]);
  }, []);

  // Rafraîchir la pharmacie active
  const refreshActivePharmacy = useCallback(async () => {
    // Rafraîchir les données ActivePharmacy
    const activePharmacy = await pharmacyService.getActivePharmacy();
    setActivePharmacyData(activePharmacy);
    
    await Promise.all([
      refetchPharmacy(),
      refetchConfig(),
      refetchBranches(),
      checkServiceStatus(),
    ]);
  }, [refetchPharmacy, refetchConfig, refetchBranches, checkServiceStatus]);

  // Mettre à jour la configuration
  const updateConfig = useCallback(async (configUpdate: Partial<PharmacyConfig>) => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const updatedConfig = await pharmacyService.updatePharmacyConfig(activeId, configUpdate);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    await queryClient.invalidateQueries({ queryKey: ['active-pharmacy', activeId] });
    
    return updatedConfig;
  }, [activeId, queryClient]);

  // Mettre à jour la configuration de vente
  const updateSalesConfig = useCallback(async (salesConfig: SalesConfig) => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const updatedSalesConfig = await pharmacyService.updateSalesConfig(activeId, salesConfig);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    
    return updatedSalesConfig;
  }, [activeId, queryClient]);

  // Mettre à jour les heures de service
  const updateWorkingHours = useCallback(async (workingHours: WorkingHours) => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const updatedWorkingHours = await pharmacyService.updateWorkingHours(activeId, workingHours);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    await checkServiceStatus(); // Re-vérifier le statut immédiatement
    
    return updatedWorkingHours;
  }, [activeId, queryClient, checkServiceStatus]);

  // Mettre à jour les devises
  const updateCurrencies = useCallback(async (currencies: CurrencyConfig[]) => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const updatedCurrencies = await pharmacyService.updateCurrenciesConfig(activeId, currencies);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    
    return updatedCurrencies;
  }, [activeId, queryClient]);

  // Mettre à jour la configuration des prix
  const updatePricing = useCallback(async (pricing: AutomaticPricingConfig) => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const updatedPricing = await pharmacyService.updatePricingConfig(activeId, pricing);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    
    return updatedPricing;
  }, [activeId, queryClient]);

  // Mettre à jour le thème
  const updateTheme = useCallback(async (theme: 'light' | 'dark' | 'system') => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const updatedTheme = await pharmacyService.updateTheme(activeId, theme);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    
    return updatedTheme;
  }, [activeId, queryClient]);

  // Uploader le logo
  const uploadLogo = useCallback(async (file: File) => {
    if (!activeId) throw new Error('Aucune pharmacie active');

    const uploadResult = await pharmacyService.uploadPharmacyLogo(activeId, file);
    
    // Invalider les caches
    await queryClient.invalidateQueries({ queryKey: ['pharmacy-config', activeId] });
    await queryClient.invalidateQueries({ queryKey: ['active-pharmacy', activeId] });
    
    return uploadResult.logo_url;
  }, [activeId, queryClient]);

  // Déterminer la branche par défaut
  const defaultBranch = useMemo(() => {
    if (!branches || branches.length === 0) return null;
    
    // Chercher la branche principale
    const mainBranchFound = branches.find((branch) => branch.is_main_branch === true);
    if (mainBranchFound) return mainBranchFound;
    
    // Sinon, prendre la première branche active
    return branches[0];
  }, [branches]);

  const defaultBranchId = useMemo(() => {
    return defaultBranch?.id || null;
  }, [defaultBranch]);

  // Branche principale
  const mainBranch = useMemo(() => {
    if (!branches || branches.length === 0) return null;
    return branches.find((branch) => branch.is_main_branch === true) || null;
  }, [branches]);

  // Déterminer si la pharmacie est ouverte
  const isOpen = useMemo(() => {
    if (!serviceStatus) return true;
    return serviceStatus.in_service;
  }, [serviceStatus]);

  // Vérifier si la pharmacie a des branches
  const hasBranches = useMemo(() => {
    return branches.length > 0;
  }, [branches]);

  // Nombre de branches
  const branchesCount = useMemo(() => {
    return branches.length;
  }, [branches]);

  // État de chargement combiné
  const isLoading = isLoadingPharmacy || isLoadingConfig || isLoadingBranches || isLoadingService;

  // Erreur combinée
  const error = pharmacyError || configError;

  return {
    // États de base
    id: activeId,
    name: pharmacy?.name || null,
    licenseNumber: pharmacy?.license_number || null,
    address: pharmacy?.address || null,
    phone: pharmacy?.phone || null,
    email: pharmacy?.email || null,
    city: pharmacy?.city || null,
    country: pharmacy?.country || null,
    isActive: pharmacy?.is_active ?? true,
    config: config || null,
    isLoading,
    error: error as Error | null,
    lastChecked: new Date(),
    
    // Données ActivePharmacy
    activePharmacyData,
    
    // Branches
    defaultBranchId,
    defaultBranch,
    branches,
    hasBranches,
    branchesCount,
    mainBranch,
    
    // Statut de service
    serviceStatus,
    isOpen,
    
    // Actions
    setActivePharmacy,
    clearActivePharmacy,
    refreshActivePharmacy,
    checkServiceStatus,
    
    // Configuration
    updateConfig,
    updateSalesConfig,
    updateWorkingHours,
    updateCurrencies,
    updatePricing,
    updateTheme,
    uploadLogo,
  };
}

export default useActivePharmacy;