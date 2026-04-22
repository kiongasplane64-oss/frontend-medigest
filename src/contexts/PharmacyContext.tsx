// src/contexts/PharmacyContext.tsx
'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

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
  
  const [currentPharmacy, setCurrentPharmacy] = useState<Pharmacy | null>(null);
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Charger les pharmacies de l'utilisateur (depuis /api/v1/pharmacies/)
  const loadPharmacies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        console.warn('No auth token found');
        setIsLoading(false);
        return;
      }

      // Utiliser l'endpoint GET /api/v1/pharmacies/
      const response = await fetch('/pharmacies/', {
        headers: getHeaders(),
      });
      
      if (response.status === 401) {
        // Non authentifié, rediriger vers login
        localStorage.removeItem('access_token');
        localStorage.removeItem('currentPharmacy');
        localStorage.removeItem('currentBranch');
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // L'API retourne directement un tableau de pharmacies
      const pharmaciesList = Array.isArray(data) ? data : (data.pharmacies || data.data || []);
      setPharmacies(pharmaciesList);
      
      // Vérifier si une pharmacie est stockée dans localStorage
      const storedPharmacy = localStorage.getItem('currentPharmacy');
      if (storedPharmacy) {
        try {
          const parsed = JSON.parse(storedPharmacy);
          const found = pharmaciesList.find((p: Pharmacy) => p.id === parsed.id);
          if (found && found.is_active) {
            setCurrentPharmacy(found);
            await loadBranches(found.id);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored pharmacy:', e);
        }
      }
      
      // Sinon, utiliser la pharmacie de l'URL ou la première active
      const urlPharmacyId = getPharmacyIdFromUrl();
      if (urlPharmacyId) {
        const found = pharmaciesList.find((p: Pharmacy) => p.id === urlPharmacyId);
        if (found && found.is_active) {
          setCurrentPharmacy(found);
          localStorage.setItem('currentPharmacy', JSON.stringify(found));
          await loadBranches(found.id);
          return;
        }
      }
      
      // Prendre la première pharmacie active
      const firstActive = pharmaciesList.find((p: Pharmacy) => p.is_active === true);
      if (firstActive) {
        setCurrentPharmacy(firstActive);
        localStorage.setItem('currentPharmacy', JSON.stringify(firstActive));
        await loadBranches(firstActive.id);
      } else if (pharmaciesList.length > 0) {
        // Si aucune n'est active, prendre la première
        setCurrentPharmacy(pharmaciesList[0]);
        localStorage.setItem('currentPharmacy', JSON.stringify(pharmaciesList[0]));
        await loadBranches(pharmaciesList[0].id);
      }
    } catch (err) {
      console.error('Error loading pharmacies:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement des pharmacies');
    } finally {
      setIsLoading(false);
    }
  }, [getPharmacyIdFromUrl, getHeaders, getAuthToken]);

  // Rafraîchir la pharmacie courante
  const refreshCurrentPharmacy = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const response = await fetch(`/pharmacies/${currentPharmacy.id}`, {
        headers: getHeaders(),
      });
      
      if (response.ok) {
        const updated = await response.json();
        setCurrentPharmacy(updated);
        localStorage.setItem('currentPharmacy', JSON.stringify(updated));
        
        // Mettre à jour dans la liste
        setPharmacies(prev => 
          prev.map(p => p.id === updated.id ? updated : p)
        );
      }
    } catch (err) {
      console.error('Error refreshing pharmacy:', err);
    }
  }, [currentPharmacy, getHeaders]);

  // Charger les branches d'une pharmacie
  const loadBranches = useCallback(async (pharmacyId: string) => {
    try {
      const response = await fetch(`/pharmacies/${pharmacyId}/branches`, {
        headers: getHeaders(),
      });
      
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      // L'API retourne directement un tableau de branches
      const branchesList = Array.isArray(data) ? data : (data.branches || data.data || []);
      setBranches(branchesList);
      
      // Vérifier si une branche est stockée
      const storedBranch = localStorage.getItem('currentBranch');
      if (storedBranch) {
        try {
          const parsed = JSON.parse(storedBranch);
          const found = branchesList.find((b: Branch) => b.id === parsed.id);
          if (found && found.is_active) {
            setCurrentBranch(found);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored branch:', e);
        }
      }
      
      // Prendre la branche principale ou la première active
      const mainBranch = branchesList.find((b: Branch) => b.is_main_branch === true);
      if (mainBranch && mainBranch.is_active !== false) {
        setCurrentBranch(mainBranch);
        localStorage.setItem('currentBranch', JSON.stringify(mainBranch));
      } else if (branchesList.length > 0) {
        const firstActive = branchesList.find((b: Branch) => b.is_active !== false);
        setCurrentBranch(firstActive || branchesList[0]);
        localStorage.setItem('currentBranch', JSON.stringify(firstActive || branchesList[0]));
      } else {
        // Pas de branches, créer une branche virtuelle
        setCurrentBranch(null);
        localStorage.removeItem('currentBranch');
      }
    } catch (err) {
      console.error('Error loading branches:', err);
      setBranches([]);
      setCurrentBranch(null);
    }
  }, [getHeaders]);

  // Changer de pharmacie
  const switchPharmacy = useCallback(async (pharmacyId: string) => {
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
      
      // Réinitialiser la branche courante
      setCurrentBranch(null);
      localStorage.removeItem('currentBranch');
      
      // Charger les branches de la nouvelle pharmacie
      await loadBranches(pharmacyId);
      
      // Rediriger vers la nouvelle pharmacie si nécessaire
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
  }, [pharmacies, loadBranches, location.pathname, navigate]);

  // Changer de branche
  const switchBranch = useCallback(async (branchId: string) => {
    const branch = branches.find(b => b.id === branchId);
    if (branch) {
      setCurrentBranch(branch);
      localStorage.setItem('currentBranch', JSON.stringify(branch));
    }
  }, [branches]);

  // Nettoyer le localStorage au logout
  const clearPharmacy = useCallback(() => {
    localStorage.removeItem('currentPharmacy');
    localStorage.removeItem('currentBranch');
    setCurrentPharmacy(null);
    setCurrentBranch(null);
    setPharmacies([]);
    setBranches([]);
  }, []);

  // Charger au montage
  useEffect(() => {
    loadPharmacies();
  }, [loadPharmacies]);

  // Synchroniser avec l'URL
  useEffect(() => {
    const urlPharmacyId = getPharmacyIdFromUrl();
    if (urlPharmacyId && currentPharmacy && currentPharmacy.id !== urlPharmacyId) {
      const found = pharmacies.find(p => p.id === urlPharmacyId);
      if (found && found.is_active) {
        setCurrentPharmacy(found);
        localStorage.setItem('currentPharmacy', JSON.stringify(found));
        loadBranches(found.id);
      }
    }
  }, [location.pathname, getPharmacyIdFromUrl, currentPharmacy, pharmacies, loadBranches]);

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
  
  useEffect(() => {
    if (!isLoading && !currentPharmacy && !error) {
      if (pharmacies.length > 0) {
        // Rediriger vers la première pharmacie disponible
        navigate(`/pharmacie/${pharmacies[0].id}`);
      } else {
        // Rediriger vers la création de pharmacie
        navigate('/pharmacies/create');
      }
    }
  }, [currentPharmacy, isLoading, error, pharmacies, navigate]);
  
  return { pharmacy: currentPharmacy, isLoading, error };
}