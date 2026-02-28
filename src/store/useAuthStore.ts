import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Interface alignée sur votre backend (auth.py)
interface User {
  id: string;
  email: string;
  role: string;
  nom_complet: string; // Harmonisé avec le backend
  tenant_id: string;   // Nécessaire pour les requêtes multi-tenant
  activated: boolean;  // Crucial pour les AuthGuards
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  currentPharmacyId: string | null;
  setAuth: (user: User, token: string) => void;
  setPharmacy: (id: string) => void;
  updateUserActivation: (status: boolean) => void; // Pour mettre à jour après le SMS
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      currentPharmacyId: null,

      // Appelé lors de la connexion ou après l'inscription
      setAuth: (user, token) => set({ 
        user, 
        token, 
        isAuthenticated: !!token 
      }),

      setPharmacy: (id) => set({ 
        currentPharmacyId: id 
      }),

      // Utile pour passer l'état à 'true' juste après la validation du code SMS
      updateUserActivation: (status) => set((state) => ({
        user: state.user ? { ...state.user, activated: status } : null
      })),

      logout: () => set({ 
        user: null, 
        token: null, 
        isAuthenticated: false, 
        currentPharmacyId: null 
      }),
    }),
    { 
      name: 'pharma-auth-storage' 
    }
  )
);