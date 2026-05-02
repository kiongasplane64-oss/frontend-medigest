// store/useAuthStore.ts - VERSION COMPLÈTE CORRIGÉE (avec corrections de types)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';

export interface User {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id?: string | null;
  pharmacy_id?: string | null;
  branch_id?: string; 
  current_pharmacy?: {  
    id: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    is_main?: boolean;
    is_active?: boolean;
  };
  telephone?: string;
  phone?: string;
  actif: boolean;
  activated: boolean;
  permissions?: Record<string, boolean>;
  has_subscription?: boolean;
  subscription_status?: string;
  subscription_end_date?: string;
}

type UserInput = Partial<User> & {
  id?: string | number;
  email?: string;
  role?: string;
  nom_complet?: string;
  tenant_id?: string | null;
  pharmacy_id?: string | null;
  branch_id?: string | null;
  telephone?: string;
  phone?: string;
  actif?: boolean;
  activated?: boolean;
  permissions?: Record<string, boolean>;
};

interface JwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  tenant_id?: string | null;
  pharmacy_id?: string | null;
  branch_id?: string | null;
  subscription_active?: boolean;
  subscription_status?: string;
  subscription_end_date?: string;
  exp?: number;
  type?: string;
  [key: string]: unknown;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  currentPharmacyId: string | null;
  tenantId: string | null;
  subscriptionActive: boolean;
  isLoading: boolean;

  setAuth: (user: UserInput, token: string, refreshToken?: string | null) => void;
  setTokens: (token: string, refreshToken?: string | null) => void;
  setAccessToken: (token: string) => void;
  setRefreshToken: (token: string | null) => void;
  setPharmacy: (id: string | null) => void;
  setTenantId: (id: string | null) => void;
  updateUserActivation: (status: boolean) => void;
  updateUser: (updates: Partial<User>) => void;
  clearAuth: () => void;
  logout: () => void;
  checkTokenValidity: () => boolean;

  // Getters
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  getCurrentPharmacyId: () => string | null;
}

const STORAGE_NAME = 'pharma-auth-storage';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/api/v1';

// ==================== Configuration Axios ====================

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Ne pas tenter de refresh si on est sur la page login
    if (window.location.pathname === '/login') {
      return Promise.reject(error);
    }
    
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    
    originalRequest._retry = true;
    
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          if (token && typeof token === 'string') {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          }
          return Promise.reject(error);
        })
        .catch(err => Promise.reject(err));
    }
    
    isRefreshing = true;
    
    try {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      console.log('🔄 Tentative de refresh token...');
      
      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      
      const newAccessToken = response.data?.access_token || response.data?.token;
      
      if (!newAccessToken) {
        throw new Error('No access token in refresh response');
      }
      
      localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
      api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
      processQueue(null, newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      
      console.log('✅ Token rafraîchi avec succès');
      
      return api(originalRequest);
      
    } catch (refreshError) {
      console.error('❌ Échec du refresh token:', refreshError);
      processQueue(refreshError instanceof Error ? refreshError : new Error('Refresh failed'), null);
      
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      delete api.defaults.headers.common['Authorization'];
      
      // Nettoyer aussi le store Zustand
      const store = useAuthStore.getState();
      store.clearAuth();
      
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
        console.log('🔄 Redirection vers /login après échec refresh');
        window.location.href = '/login';
      }
      
      return Promise.reject(refreshError);
      
    } finally {
      isRefreshing = false;
    }
  }
);

// ==================== Fonctions utilitaires ====================

const normalizeRole = (role: string | null | undefined): string => {
  if (!role) return 'user';
  
  // Convertir en minuscules et supprimer les espaces
  const normalized = role.toLowerCase().trim();
  
  // Super Admin - différents formats possibles
  if (normalized === 'super_admin' || 
      normalized === 'super-admin' || 
      normalized === 'superadmin' ||
      normalized === 'super admin' ||
      normalized === 'super_administrateur' ||
      normalized === 'superadministrateur') {
    return 'super_admin';
  }
  
  // Admin - différents formats possibles
  if (normalized === 'admin' || 
      normalized === 'administrateur' ||
      normalized === 'administrator') {
    return 'admin';
  }
  
  // Seller/Vendeur
  if (normalized === 'seller' || 
      normalized === 'vendeur' ||
      normalized === 'vendeuse') {
    return 'seller';
  }
  
  // Autres rôles métier
  if (normalized === 'pharmacien' || normalized === 'pharmacienne') return 'pharmacien';
  if (normalized === 'caissier' || normalized === 'caissière') return 'caissier';
  if (normalized === 'comptable') return 'comptable';
  
  // Pour tout autre rôle non reconnu, retourner la version normalisée
  return normalized;
};

const normalizeUser = (user: UserInput): User => {
  const actif = Boolean(user?.actif ?? user?.activated ?? false);
  const activated = Boolean(user?.activated ?? user?.actif ?? false);
  const rawRole = user?.role ?? 'user';

  return {
    id: String(user?.id ?? ''),
    email: String(user?.email ?? '').toLowerCase().trim(),
    role: normalizeRole(rawRole),
    nom_complet: String(user?.nom_complet ?? 'Utilisateur').trim(),
    tenant_id: user?.tenant_id ?? null,
    pharmacy_id: user?.pharmacy_id ?? null,
    branch_id: user?.branch_id ?? undefined,
    telephone: String(user?.telephone ?? user?.phone ?? ''),
    phone: String(user?.phone ?? user?.telephone ?? ''),
    actif,
    activated,
    permissions: user?.permissions ?? {},
    has_subscription: user?.has_subscription ?? false,
    subscription_status: user?.subscription_status,
    subscription_end_date: user?.subscription_end_date,
  };
};

const decodeJwt = (token: string): JwtPayload | null => {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;

    const payload = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const decoded = JSON.parse(atob(payload));
    return decoded as JwtPayload;
  } catch (error) {
    console.error('❌ Impossible de décoder le JWT:', error);
    return null;
  }
};

const isJwtExpired = (token: string | null): boolean => {
  if (!token) return true;

  try {
    const payload = decodeJwt(token);
    if (!payload?.exp) return false;

    const nowInSeconds = Math.floor(Date.now() / 1000);
    // Ajouter une marge de 5 minutes pour éviter les problèmes de synchronisation
    const isExpired = payload.exp <= nowInSeconds + 300;
    
    if (isExpired) {
      console.log(`⏰ Token expiré: exp=${payload.exp}, now=${nowInSeconds}`);
    }
    
    return isExpired;
  } catch (error) {
    console.error('Erreur vérification expiration token:', error);
    return true;
  }
};

// ==================== Fonction mergeUserWithTokenPayload améliorée ====================

const mergeUserWithTokenPayload = (user: UserInput | null, token: string): User => {
  try {
    const payload = decodeJwt(token);
    
    console.log('🔍 Decoded JWT payload:', payload);
    
    // Extraire le rôle de l'utilisateur (priorité à l'utilisateur du payload)
    const roleFromUser = user?.role;
    const roleFromPayload = payload?.role;
    let finalRole: string = roleFromPayload ? normalizeRole(String(roleFromPayload)) : 'user';
    
    // Si l'utilisateur a un rôle explicite, on l'utilise (sauf pour super_admin qui prime)
    if (roleFromUser && normalizeRole(roleFromUser) === 'super_admin') {
      finalRole = 'super_admin';
    } else if (roleFromUser && normalizeRole(roleFromUser) === 'admin') {
      finalRole = 'admin';
    } else if (roleFromUser && normalizeRole(roleFromUser) === 'seller') {
      finalRole = 'seller';
    } else if (roleFromUser) {
      finalRole = normalizeRole(roleFromUser);
    }
    
    console.log('🔍 Role determination:', { 
      roleFromUser, 
      roleFromPayload, 
      finalRole,
      normalizedRoleFromUser: roleFromUser ? normalizeRole(roleFromUser) : null
    });
    
    // Extraire l'ID utilisateur
    const userId = user?.id || payload?.sub || payload?.user_id || '';
    
    // Extraire l'email
    const email = user?.email || String(payload?.email || payload?.sub || '');
    
    // Extraire le nom complet (convertir en string)
    let nomComplet: string = 'Utilisateur';
    if (user?.nom_complet) {
      nomComplet = String(user.nom_complet);
    } else if (payload?.nom_complet) {
      nomComplet = String(payload.nom_complet);
    } else if (payload?.full_name) {
      nomComplet = String(payload.full_name);
    }
    
    // Extraire le tenant_id
    const tenantId = user?.tenant_id || payload?.tenant_id || null;
    
    // Extraire le pharmacy_id
    const pharmacyId = user?.pharmacy_id || (payload?.pharmacy_id as string | null) || null;
    
    // Extraire le branch_id
    const branchId = user?.branch_id || (payload?.branch_id as string | null) || undefined;
    
    // Extraire les informations d'abonnement
    const hasSubscription = user?.has_subscription ?? payload?.subscription_active ?? false;
    const subscriptionStatus = user?.subscription_status || (payload?.subscription_status as string) || undefined;
    const subscriptionEndDate = user?.subscription_end_date || (payload?.subscription_end_date as string) || undefined;
    
    // Extraire le téléphone
    let telephone: string = '';
    if (user?.telephone) {
      telephone = String(user.telephone);
    } else if (user?.phone) {
      telephone = String(user.phone);
    } else if (payload?.phone) {
      telephone = String(payload.phone);
    } else if (payload?.telephone) {
      telephone = String(payload.telephone);
    }
    
    // Extraire le phone
    let phone: string = '';
    if (user?.phone) {
      phone = String(user.phone);
    } else if (user?.telephone) {
      phone = String(user.telephone);
    } else if (payload?.phone) {
      phone = String(payload.phone);
    } else if (payload?.telephone) {
      phone = String(payload.telephone);
    }
    
    console.log('🔍 User data extracted:', {
      userId,
      email,
      finalRole,
      tenantId,
      pharmacyId,
      hasSubscription,
      subscriptionStatus
    });
    
    return normalizeUser({
      id: String(userId),
      email: String(email),
      role: finalRole,
      nom_complet: nomComplet,
      tenant_id: tenantId,
      pharmacy_id: pharmacyId,
      branch_id: branchId,
      telephone: telephone,
      phone: phone,
      actif: user?.actif ?? user?.activated ?? true,
      activated: user?.activated ?? user?.actif ?? true,
      permissions: user?.permissions || {},
      has_subscription: hasSubscription,
      subscription_status: subscriptionStatus,
      subscription_end_date: subscriptionEndDate,
    });
  } catch (error) {
    console.error('❌ Erreur dans mergeUserWithTokenPayload:', error);
    // Fallback: retourner un utilisateur basé uniquement sur l'input
    return normalizeUser(user || {});
  }
};

// ==================== Fonction de validation des tokens ====================

const validateAndCleanupTokens = (): { token: string | null; refreshToken: string | null } => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
  
  // Vérifier si le token est expiré
  if (token && isJwtExpired(token)) {
    console.log('⏰ Token expiré trouvé, nettoyage...');
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STORAGE_NAME);
    return { token: null, refreshToken: null };
  }
  
  // Vérifier si le refresh token est expiré
  if (refreshToken && isJwtExpired(refreshToken)) {
    console.log('⏰ Refresh token expiré trouvé, nettoyage...');
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(STORAGE_NAME);
    return { token: null, refreshToken: null };
  }
  
  return { token, refreshToken };
};

// ==================== Store Zustand ====================

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      currentPharmacyId: null,
      tenantId: null,
      subscriptionActive: false,
      isLoading: true,

      setAuth: (userInput, token, refreshToken = null) => {
        const normalizedUser = mergeUserWithTokenPayload(userInput, token);
        const payload = decodeJwt(token);

        const tenantId = normalizedUser.tenant_id ?? payload?.tenant_id ?? null;
        const pharmacyId = normalizedUser.pharmacy_id ?? 
                          (payload?.pharmacy_id as string | null | undefined) ?? 
                          null;
        const subscriptionActive = Boolean(payload?.subscription_active ?? normalizedUser.has_subscription ?? false);

        // Stocker les tokens séparément pour l'intercepteur Axios
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        set({
          user: normalizedUser,
          token,
          refreshToken,
          isAuthenticated: true,
          currentPharmacyId: pharmacyId,
          tenantId,
          subscriptionActive,
          isLoading: false,
        });
        
        console.log('🔐 Auth set:', { email: normalizedUser.email, role: normalizedUser.role });
      },

      setTokens: (token, refreshToken = null) => {
        const currentUser = get().user;
        const nextUser = currentUser
          ? mergeUserWithTokenPayload(currentUser, token)
          : mergeUserWithTokenPayload(null, token);

        const payload = decodeJwt(token);

        localStorage.setItem(ACCESS_TOKEN_KEY, token);
        
        // Vérifier que refreshToken n'est pas null
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else if (get().refreshToken) {
          const currentRefreshToken = get().refreshToken;
          if (currentRefreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, currentRefreshToken);
          }
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        set({
          token,
          refreshToken: refreshToken ?? get().refreshToken,
          user: nextUser,
          isAuthenticated: true,
          tenantId: nextUser.tenant_id ?? payload?.tenant_id ?? null,
          currentPharmacyId: nextUser.pharmacy_id ?? 
                          (payload?.pharmacy_id as string | null | undefined) ?? 
                          get().currentPharmacyId,
          subscriptionActive: Boolean(payload?.subscription_active ?? get().subscriptionActive),
          isLoading: false,
        });
        
        console.log('🔐 Tokens mis à jour');
      },

      setAccessToken: (token) => {
        get().setTokens(token, get().refreshToken);
      },

      setRefreshToken: (refreshToken) => {
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }
        set({ refreshToken });
      },

      setPharmacy: (id) => {
        set({ 
          currentPharmacyId: id,
          user: get().user ? { 
            ...get().user!, 
            pharmacy_id: id 
          } : null 
        });
      },

      setTenantId: (id) => {
        set({ tenantId: id });

        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            tenant_id: id,
          };
          set({ user: updatedUser });
        }
      },

      updateUserActivation: (status) =>
        set((state) => {
          if (!state.user) return state;

          const updatedUser: User = {
            ...state.user,
            actif: status,
            activated: status,
          };

          return { user: updatedUser };
        }),

      updateUser: (updates: Partial<User>) => {
        const currentUser = get().user;
        if (!currentUser) return;
        
        const updatedUser: User = {
          ...currentUser,
          ...updates,
        };
        
        set({ user: updatedUser });
        
        if (updates.branch_id && get().currentPharmacyId !== updates.branch_id) {
          set({ currentPharmacyId: updates.branch_id });
        }
        
        if (updates.pharmacy_id && get().currentPharmacyId !== updates.pharmacy_id) {
          set({ currentPharmacyId: updates.pharmacy_id });
        }
      },

      clearAuth: () => {
        console.log('🔐 clearAuth: suppression de toutes les données');
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(STORAGE_NAME);
        
        delete api.defaults.headers.common['Authorization'];

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          currentPharmacyId: null,
          tenantId: null,
          subscriptionActive: false,
          isLoading: false,
        });
      },

      logout: () => {
        console.log('🔐 Déconnexion utilisateur');
        get().clearAuth();
        window.location.href = '/login';
      },

      checkTokenValidity: () => {
        const { token } = get();
        if (!token) return false;
        return !isJwtExpired(token);
      },

      isSuperAdmin: () => {
        const role = get().user?.role;
        return role === 'super_admin';
      },

      isAdmin: () => {
        const role = get().user?.role;
        return role === 'admin' || role === 'super_admin';
      },

      hasRole: (role) => {
        const currentRole = get().user?.role;
        const normalizedTargetRole = normalizeRole(role);
        return currentRole === normalizedTargetRole;
      },

      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (get().isSuperAdmin()) return true;
        return Boolean(user.permissions?.[permission]);
      },

      getCurrentPharmacyId: () => {
        const state = get();
        return state.user?.pharmacy_id ?? state.currentPharmacyId ?? null;
      },
    }),
    {
      name: STORAGE_NAME,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        currentPharmacyId: state.currentPharmacyId,
        tenantId: state.tenantId,
        subscriptionActive: state.subscriptionActive,
      }),
      onRehydrateStorage: () => (state) => {
        // Vérifier que state n'est pas undefined
        if (!state) {
          return;
        }
        
        // Nettoyer les tokens expirés avant la rehydratation
        const { token: validToken } = validateAndCleanupTokens();
        
        if (!validToken) {
          console.log('🔐 Pas de token valide, réinitialisation de l\'état');
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isLoading = false;
          delete api.defaults.headers.common['Authorization'];
          return;
        }
        
        if (state.token && isJwtExpired(state.token)) {
          console.log('🔄 Token expiré lors de la rehydratation, nettoyage');
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          state.isAuthenticated = false;
          state.user = null;
          state.token = null;
          state.refreshToken = null;
        } else if (state.token) {
          // Remettre le token dans localStorage pour Axios
          localStorage.setItem(ACCESS_TOKEN_KEY, state.token);
          if (state.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, state.refreshToken);
          }
          api.defaults.headers.common['Authorization'] = `Bearer ${state.token}`;
          console.log('🔐 Token restauré avec succès');
        }
        
        // S'assurer que isLoading est false après rehydratation
        state.isLoading = false;
      },
    },
  ),
);

// ==================== Hook d'initialisation simplifié ====================

export const useInitializeAuth = () => {
  const { isAuthenticated, isLoading, checkTokenValidity } = useAuthStore();
  
  const isReady = !isLoading;
  
  return { 
    isReady, 
    isAuthenticated,
    isValid: checkTokenValidity(),
    isLoading 
  };
};

export default api;