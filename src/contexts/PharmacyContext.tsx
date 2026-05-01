// src/contexts/PharmacyContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

// Types
interface Pharmacy {
  id: string;
  name: string;
  tenant_id: string;
  license_number: string;
  address: string;
  city: string;
  country: string;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  opening_hours: string | null;
  pharmacist_in_charge: string | null;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  parent_pharmacy_id: string;
  is_main_branch: boolean;
  is_active: boolean;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  manager_name?: string | null;
}

interface PharmacyContextType {
  currentPharmacy: Pharmacy | null;
  currentBranch: Branch | null;
  pharmacies: Pharmacy[];
  branches: Branch[];
  setCurrentPharmacy: (pharmacy: Pharmacy | null) => void;
  setCurrentBranch: (branch: Branch | null) => void;
  loadPharmacies: () => Promise<void>;
  loadBranches: (pharmacyId: string) => Promise<void>;
  switchPharmacy: (pharmacyId: string) => Promise<void>;
  switchBranch: (branchId: string) => Promise<void>;
  clearPharmacy: () => void;
  isLoading: boolean;
  error: string | null;
  refreshCurrentPharmacy: () => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(undefined);

// Configuration API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://backend-medigest.onrender.com';
const API_VERSION = '/api/v1';

export function usePharmacy() {
  const context = useContext(PharmacyContext);
  if (!context) {
    throw new Error('usePharmacy must be used within a PharmacyProvider');
  }
  return context;
}

interface PharmacyProviderProps {
  children: ReactNode;
}

export function PharmacyProvider({ children }: PharmacyProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  
  const [currentPharmacy, setCurrentPharmacy] = useState<Pharmacy | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ Ref pour éviter les appels multiples
  const initialLoadDoneRef = useRef(false);
  const loadingRef = useRef(false);

  // Récupérer l'ID de la pharmacie depuis l'URL
  const getPharmacyIdFromUrl = useCallback(() => {
    const pathParts = location.pathname?.split('/') || [];
    const pharmacyIndex = pathParts.indexOf('pharmacie');
    if (pharmacyIndex !== -1 && pathParts[pharmacyIndex + 1]) {
      return pathParts[pharmacyIndex + 1];
    }
    return null;
  }, [location.pathname]);

  // Obtenir le token d'authentification
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('access_token');
  }, []);

  // Headers pour les requêtes API
  const getHeaders = useCallback(() => {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };
  }, [getAuthToken]);

  // ✅ Vérifier si l'utilisateur est un vendeur
  const isSeller = useCallback(() => {
    return user?.role === 'seller' || user?.role === 'vendeur';
  }, [user]);

  // ✅ Vérifier si l'utilisateur est admin
  const isAdmin = useCallback(() => {
    return user?.role === 'admin' || user?.role === 'owner' || user?.role === 'pharmacy_admin';
  }, [user]);

  // ✅ Vérifier si l'utilisateur peut changer de contexte
  const canSwitchContext = useCallback(() => {
    return isAdmin() || user?.role === 'super_admin';
  }, [isAdmin, user]);

  // ✅ Charger les branches d'une pharmacie (version stabilisée)
  const loadBranches = useCallback(async (pharmacyId: string) => {
    if (!pharmacyId) return;
    
    try {
      const url = `${API_BASE_URL}${API_VERSION}/pharmacies/${pharmacyId}/branches`;
      console.log('Fetching branches from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Branches data received:', data);
      
      const branchesList = Array.isArray(data) ? data : (data.branches || data.data || []);
      
      // ✅ Filtrer les branches selon le rôle
      let accessibleBranches = branchesList;
      
      if (isSeller() && user?.branch_id) {
        accessibleBranches = branchesList.filter((b: Branch) => b.id === user.branch_id);
        console.log(`🔒 Vendeur filtré: ${accessibleBranches.length} branche(s) accessible(s) (sur ${branchesList.length})`);
      }
      
      setBranches(accessibleBranches);
      
      // ✅ Déterminer la branche courante (sans déclencher de re-rendu infini)
      let targetBranch: Branch | null = null;
      
      // 1. Vendeur: utiliser sa branche assignée
      if (isSeller() && user?.branch_id) {
        targetBranch = accessibleBranches.find((b: Branch) => b.id === user.branch_id) || null;
        if (targetBranch) {
          console.log(`✅ Vendeur affecté à la branche: ${targetBranch.name}`);
        }
      }
      
      // 2. Sinon, vérifier localStorage
      if (!targetBranch) {
        const storedBranch = localStorage.getItem('currentBranch');
        if (storedBranch) {
          try {
            const parsed = JSON.parse(storedBranch);
            const found = accessibleBranches.find((b: Branch) => b.id === parsed.id);
            if (found && found.is_active) {
              targetBranch = found;
            }
          } catch (e) {
            console.error('Error parsing stored branch:', e);
          }
        }
      }
      
      // 3. Prendre la branche principale ou la première active
      if (!targetBranch && accessibleBranches.length > 0) {
        const mainBranch = accessibleBranches.find((b: Branch) => b.is_main_branch === true);
        targetBranch = mainBranch && mainBranch.is_active !== false 
          ? mainBranch 
          : accessibleBranches[0];
      }
      
      // ✅ Mettre à jour uniquement si différent
      setCurrentBranch(prev => {
        if (prev?.id === targetBranch?.id) return prev;
        if (targetBranch) {
          localStorage.setItem('currentBranch', JSON.stringify(targetBranch));
        } else {
          localStorage.removeItem('currentBranch');
        }
        return targetBranch;
      });
      
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
    }
  }, [getHeaders, isSeller, user]);

  // ✅ Charger les pharmacies de l'utilisateur (version corrigée sans boucle)
  const loadPharmacies = useCallback(async () => {
    // Éviter les appels multiples simultanés
    if (loadingRef.current) return;
    loadingRef.current = true;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No auth token found');
        setIsLoading(false);
        loadingRef.current = false;
        return;
      }

      const url = `${API_BASE_URL}${API_VERSION}/pharmacies/`;
      console.log('Fetching pharmacies from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
      });
      
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('currentPharmacy');
        localStorage.removeItem('currentBranch');
        window.location.href = '/login';
        loadingRef.current = false;
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Pharmacies data received:', data);
      
      let pharmaciesList = Array.isArray(data) ? data : (data.pharmacies || data.data || []);
      
      // ✅ Pour un vendeur, déterminer la pharmacie à partir de sa branche
      if (isSeller() && user?.branch_id) {
        try {
          const branchUrl = `${API_BASE_URL}${API_VERSION}/branches/${user.branch_id}`;
          const branchResponse = await fetch(branchUrl, { headers: getHeaders() });
          
          if (branchResponse.ok) {
            const branchData = await branchResponse.json();
            const parentPharmacyId = branchData.parent_pharmacy_id;
            pharmaciesList = pharmaciesList.filter((p: Pharmacy) => p.id === parentPharmacyId);
            console.log(`🔒 Vendeur: pharmacie filtrée à ${pharmaciesList.length} résultat(s)`);
          }
        } catch (err) {
          console.error('Erreur lors de la récupération de la branche vendeur:', err);
        }
      }
      
      setPharmacies(pharmaciesList);
      
      // ✅ Déterminer la pharmacie courante
      let targetPharmacy: Pharmacy | null = null;
      
      // 1. Vendeur: utiliser la pharmacie de sa branche
      if (isSeller() && user?.branch_id && pharmaciesList.length === 1) {
        targetPharmacy = pharmaciesList[0];
        if (targetPharmacy) {
          console.log(`✅ Vendeur affecté à la pharmacie: ${targetPharmacy.name}`);
        }
      }
      
      // 2. Sinon, vérifier localStorage
      if (!targetPharmacy) {
        const storedPharmacy = localStorage.getItem('currentPharmacy');
        if (storedPharmacy) {
          try {
            const parsed = JSON.parse(storedPharmacy);
            const found = pharmaciesList.find((p: Pharmacy) => p.id === parsed.id);
            if (found && found.is_active) {
              targetPharmacy = found;
            }
          } catch (e) {
            console.error('Error parsing stored pharmacy:', e);
          }
        }
      }
      
      // 3. Utiliser l'URL
      if (!targetPharmacy) {
        const urlPharmacyId = getPharmacyIdFromUrl();
        if (urlPharmacyId) {
          const found = pharmaciesList.find((p: Pharmacy) => p.id === urlPharmacyId);
          if (found && found.is_active) {
            targetPharmacy = found;
          }
        }
      }
      
      // 4. Prendre la première active
      if (!targetPharmacy && pharmaciesList.length > 0) {
        const firstActive = pharmaciesList.find((p: Pharmacy) => p.is_active === true);
        targetPharmacy = firstActive || pharmaciesList[0];
      }
      
      // ✅ Mettre à jour la pharmacie courante
      setCurrentPharmacy(prev => {
        if (prev?.id === targetPharmacy?.id) return prev;
        if (targetPharmacy) {
          localStorage.setItem('currentPharmacy', JSON.stringify(targetPharmacy));
        } else {
          localStorage.removeItem('currentPharmacy');
        }
        return targetPharmacy;
      });
      
      // ✅ Charger les branches UNIQUEMENT si on a une pharmacie ET que ce n'est pas un vendeur
      // (les vendeurs n'ont pas besoin de recharger les branches ici)
      if (targetPharmacy && !isSeller()) {
        await loadBranches(targetPharmacy.id);
      }
      
    } catch (err) {
      console.error('Error loading pharmacies:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement des pharmacies');
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [getPharmacyIdFromUrl, getHeaders, getAuthToken, loadBranches, isSeller, user]);

  // Rafraîchir la pharmacie courante
  const refreshCurrentPharmacy = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const url = `${API_BASE_URL}${API_VERSION}/pharmacies/${currentPharmacy.id}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: getHeaders(),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setCurrentPharmacy(updated);
        localStorage.setItem('currentPharmacy', JSON.stringify(updated));
        
        setPharmacies(prev => 
          prev.map(p => p.id === updated.id ? updated : p)
        );
      }
    } catch (err) {
      console.error('Error refreshing pharmacy:', err);
    }
  }, [currentPharmacy, getHeaders]);

  // Changer de pharmacie
  const switchPharmacy = useCallback(async (pharmacyId: string) => {
    if (!canSwitchContext()) {
      console.warn('Utilisateur non autorisé à changer de pharmacie');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const pharmacy = pharmacies.find(p => p.id === pharmacyId);
      if (!pharmacy) {
        throw new Error('Pharmacie non trouvée');
      }
      
      if (!pharmacy.is_active) {
        throw new Error('Cette pharmacie est désactivée');
      }
      
      setCurrentPharmacy(pharmacy);
      localStorage.setItem('currentPharmacy', JSON.stringify(pharmacy));
      
      setCurrentBranch(null);
      localStorage.removeItem('currentBranch');
      
      await loadBranches(pharmacyId);
      
      const newPath = location.pathname?.replace(/\/pharmacie\/[^\/]+/, `/pharmacie/${pharmacyId}`);
      if (newPath && newPath !== location.pathname) {
        navigate(newPath);
      }
    } catch (err) {
      console.error('Error switching pharmacy:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du changement de pharmacie');
    } finally {
      setIsLoading(false);
    }
  }, [pharmacies, loadBranches, location.pathname, navigate, canSwitchContext]);

  // Changer de branche
  const switchBranch = useCallback(async (branchId: string) => {
    if (!canSwitchContext()) {
      console.warn('Utilisateur non autorisé à changer de branche');
      return;
    }
    
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setCurrentBranch(branch);
      localStorage.setItem('currentBranch', JSON.stringify(branch));
    }
  }, [branches, canSwitchContext]);

  const clearPharmacy = useCallback(() => {
    localStorage.removeItem('currentPharmacy');
    localStorage.removeItem('currentBranch');
    setCurrentPharmacy(null);
    setCurrentBranch(null);
    setPharmacies([]);
    setBranches([]);
  }, []);

  // ✅ Charger au montage (UNIQUEMENT une fois)
  useEffect(() => {
    if (!initialLoadDoneRef.current && !loadingRef.current) {
      initialLoadDoneRef.current = true;
      loadPharmacies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Synchroniser avec l'URL (uniquement pour les admins et sans boucle)
  useEffect(() => {
    if (!canSwitchContext()) return;
    if (!currentPharmacy) return;
    
    const urlPharmacyId = getPharmacyIdFromUrl();
    if (urlPharmacyId && currentPharmacy.id !== urlPharmacyId) {
      const found = pharmacies.find(p => p.id === urlPharmacyId);
      if (found && found.is_active && found.id !== currentPharmacy.id) {
        setCurrentPharmacy(found);
        localStorage.setItem('currentPharmacy', JSON.stringify(found));
        loadBranches(found.id);
      }
    }
  }, [location.pathname, getPharmacyIdFromUrl, currentPharmacy, pharmacies, loadBranches, canSwitchContext]);

  const value: PharmacyContextType = {
    currentPharmacy,
    currentBranch,
    pharmacies,
    branches,
    setCurrentPharmacy,
    setCurrentBranch,
    loadPharmacies,
    loadBranches,
    switchPharmacy,
    switchBranch,
    clearPharmacy,
    isLoading,
    error,
    refreshCurrentPharmacy,
  };

  return (
    <PharmacyContext.Provider value={value}>
      {children}
    </PharmacyContext.Provider>
  );
}

// Hook pour les pages qui nécessitent une pharmacie
export function useRequiredPharmacy() {
  const { currentPharmacy, isLoading, error, pharmacies } = usePharmacy();
  const navigate = useNavigate();
  const hasRedirectedRef = useRef(false);
  
  useEffect(() => {
    if (!isLoading && !currentPharmacy && !error && !hasRedirectedRef.current) {
      if (pharmacies.length > 0) {
        hasRedirectedRef.current = true;
        navigate(`/pharmacie/${pharmacies[0].id}`);
      } else if (pharmacies.length === 0) {
        hasRedirectedRef.current = true;
        navigate('/pharmacies/create');
      }
    }
  }, [currentPharmacy, isLoading, error, pharmacies, navigate]);
  
  return { pharmacy: currentPharmacy, isLoading, error };
}