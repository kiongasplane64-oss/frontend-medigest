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
  is_main: boolean;
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

  // Charger les pharmacies de l'utilisateur
  const loadPharmacies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/v1/pharmacies/user');
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des pharmacies');
      }
      const data = await response.json();
      setPharmacies(data.pharmacies || []);
      
      // Vérifier si une pharmacie est stockée dans localStorage
      const storedPharmacy = localStorage.getItem('currentPharmacy');
      if (storedPharmacy) {
        try {
          const parsed = JSON.parse(storedPharmacy);
          const found = (data.pharmacies || []).find((p: Pharmacy) => p.id === parsed.id);
          if (found) {
            setCurrentPharmacy(found);
            await loadBranches(found.id);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored pharmacy:', e);
        }
      }
      
      // Sinon, utiliser la pharmacie de l'URL ou la première
      const urlPharmacyId = getPharmacyIdFromUrl();
      if (urlPharmacyId) {
        const found = (data.pharmacies || []).find((p: Pharmacy) => p.id === urlPharmacyId);
        if (found) {
          setCurrentPharmacy(found);
          localStorage.setItem('currentPharmacy', JSON.stringify(found));
          await loadBranches(found.id);
          return;
        }
      }
      
      // Prendre la première pharmacie active
      const firstActive = (data.pharmacies || []).find((p: Pharmacy) => p.is_active);
      if (firstActive) {
        setCurrentPharmacy(firstActive);
        localStorage.setItem('currentPharmacy', JSON.stringify(firstActive));
        await loadBranches(firstActive.id);
      }
    } catch (err) {
      console.error('Error loading pharmacies:', err);
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setIsLoading(false);
    }
  }, [getPharmacyIdFromUrl]);

  // Charger les branches d'une pharmacie
  const loadBranches = useCallback(async (pharmacyId: string) => {
    try {
      const response = await fetch(`/api/v1/pharmacies/${pharmacyId}/branches`);
      if (!response.ok) {
        throw new Error('Erreur lors du chargement des branches');
      }
      const data = await response.json();
      setBranches(data.branches || []);
      
      // Vérifier si une branche est stockée
      const storedBranch = localStorage.getItem('currentBranch');
      if (storedBranch) {
        try {
          const parsed = JSON.parse(storedBranch);
          const found = (data.branches || []).find((b: Branch) => b.id === parsed.id);
          if (found) {
            setCurrentBranch(found);
            return;
          }
        } catch (e) {
          console.error('Error parsing stored branch:', e);
        }
      }
      
      // Prendre la branche principale ou la première
      const mainBranch = (data.branches || []).find((b: Branch) => b.is_main_branch);
      if (mainBranch) {
        setCurrentBranch(mainBranch);
        localStorage.setItem('currentBranch', JSON.stringify(mainBranch));
      } else if (data.branches && data.branches.length > 0) {
        setCurrentBranch(data.branches[0]);
        localStorage.setItem('currentBranch', JSON.stringify(data.branches[0]));
      }
    } catch (err) {
      console.error('Error loading branches:', err);
    }
  }, []);

  // Changer de pharmacie
  const switchPharmacy = useCallback(async (pharmacyId: string) => {
    setIsLoading(true);
    try {
      const pharmacy = pharmacies.find(p => p.id === pharmacyId);
      if (pharmacy) {
        setCurrentPharmacy(pharmacy);
        localStorage.setItem('currentPharmacy', JSON.stringify(pharmacy));
        await loadBranches(pharmacyId);
        
        // Rediriger vers la nouvelle pharmacie
        const newPath = location.pathname?.replace(/\/pharmacie\/[^\/]+/, `/pharmacie/${pharmacyId}`);
        if (newPath && newPath !== location.pathname) {
          navigate(newPath);
        }
      }
    } catch (err) {
      console.error('Error switching pharmacy:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du changement');
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
      if (found) {
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
  };

  return (
    <PharmacyContext.Provider value={value}>
      {children}
    </PharmacyContext.Provider>
  );
}

// Hook pour les pages qui nécessitent une pharmacie
export function useRequiredPharmacy() {
  const { currentPharmacy, isLoading, error } = usePharmacy();
  
  useEffect(() => {
    if (!isLoading && !currentPharmacy && !error) {
      // Rediriger vers la sélection de pharmacie
      window.location.href = '/pharmacies';
    }
  }, [currentPharmacy, isLoading, error]);
  
  return { pharmacy: currentPharmacy, isLoading, error };
}