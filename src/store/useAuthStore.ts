// src/store/useAuthStore.ts
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
  subscription_active?: boolean;
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
  setLoading: (loading: boolean) => void;
  hydrateAuth: () => void;
  syncFromStorage: () => boolean;
  refreshSession: () => Promise<string | null>;
  clearAuth: () => void;
  logout: () => void;

  // Getters
  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isTokenExpired: () => boolean;
  getCurrentPharmacyId: () => string | null;
}

const STORAGE_NAME = 'pharma-auth-storage';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/api/v1';

let refreshPromise: Promise<string | null> | null = null;

// ==================== Configuration Axios avec intercepteurs ====================

// Création de l'instance axios
export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// Variables pour gérer le refresh token avec queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

// Fonction pour traiter la queue des requêtes en attente
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

// 🔥 INTERCEPTEUR REQUÊTE : Ajoute le token à chaque requête
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (import.meta.env.DEV) {
        console.log(`🔑 Token ajouté à ${config.method?.toUpperCase()} ${config.url}`);
      }
    } else if (import.meta.env.DEV) {
      console.warn(`⚠️ Pas de token pour ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Erreur intercepteur requête:', error);
    return Promise.reject(error);
  }
);

// 🔥 INTERCEPTEUR RÉPONSE : Gère les erreurs 401 et refresh token
api.interceptors.response.use(
  (response) => {
    if (import.meta.env.DEV) {
      console.log(`✅ Réponse ${response.status} pour ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Si ce n'est pas une erreur 401 ou que la requête a déjà été retry, rejeter l'erreur
    if (error.response?.status !== 401 || originalRequest._retry) {
      if (error.response) {
        console.error(`❌ Erreur ${error.response.status} pour ${originalRequest.url}:`, error.response.data);
      } else if (error.request) {
        console.error('❌ Pas de réponse du serveur:', error.request);
      } else {
        console.error('❌ Erreur de configuration:', error.message);
      }
      return Promise.reject(error);
    }
    
    // Marquer la requête comme retry
    originalRequest._retry = true;
    
    // Essayer de rafraîchir le token
    if (isRefreshing) {
      // Si un refresh est déjà en cours, ajouter la requête à la queue
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
      
      console.log('🔄 401 détecté, tentative de refresh token...');
      
      // Appel au endpoint de refresh
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
      
      // Mettre à jour le token dans localStorage
      localStorage.setItem(ACCESS_TOKEN_KEY, newAccessToken);
      
      // Mettre à jour le header axios par défaut
      api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
      
      // Traiter la queue des requêtes en attente
      processQueue(null, newAccessToken);
      
      // Mettre à jour le header de la requête originale
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      
      console.log('✅ Token rafraîchi avec succès');
      
      // Réessayer la requête originale
      return api(originalRequest);
      
    } catch (refreshError) {
      console.error('❌ Échec du refresh token:', refreshError);
      
      // Traiter la queue avec l'erreur
      processQueue(refreshError instanceof Error ? refreshError : new Error('Refresh failed'), null);
      
      // Nettoyer les tokens
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      delete api.defaults.headers.common['Authorization'];
      
      // Rediriger vers login (éviter les boucles)
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
        window.location.href = '/login';
      }
      
      return Promise.reject(refreshError);
      
    } finally {
      isRefreshing = false;
    }
  }
);

// ==================== Fonctions utilitaires ====================

const safeStorage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error(`❌ Impossible de lire ${key}:`, error);
      return null;
    }
  },

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`❌ Impossible d'écrire ${key}:`, error);
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`❌ Impossible de supprimer ${key}:`, error);
    }
  },
};

const normalizeRole = (role: string | null | undefined): string => {
  if (!role) return 'user';
  
  const normalized = role.toLowerCase().trim();
  
  if (normalized === 'super_admin' || 
      normalized === 'super-admin' || 
      normalized === 'superadmin' ||
      normalized === 'super admin') {
    return 'super_admin';
  }
  
  if (normalized === 'admin') return 'admin';
  if (normalized === 'pharmacien') return 'pharmacien';
  if (normalized === 'caissier') return 'caissier';
  if (normalized === 'comptable') return 'comptable';
  
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
    telephone: user?.telephone ?? user?.phone ?? '',
    phone: user?.phone ?? user?.telephone ?? '',
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

  const payload = decodeJwt(token);
  if (!payload?.exp) return false;

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + 10;
};

const mergeUserWithTokenPayload = (user: UserInput | null, token: string): User => {
  const payload = decodeJwt(token);
  const roleFromUser = user?.role;
  const roleFromPayload = payload?.role;
  const finalRole = roleFromUser ? normalizeRole(roleFromUser) : normalizeRole(roleFromPayload);

  return normalizeUser({
    id: user?.id ?? payload?.sub ?? '',
    email: user?.email ?? String(payload?.email ?? ''),
    role: finalRole,
    nom_complet: user?.nom_complet ?? 'Utilisateur',
    tenant_id: user?.tenant_id ?? payload?.tenant_id ?? null,
    pharmacy_id: user?.pharmacy_id ?? (payload?.pharmacy_id as string | null) ?? null,
    telephone: user?.telephone ?? user?.phone ?? '',
    phone: user?.phone ?? user?.telephone ?? '',
    actif: user?.actif ?? user?.activated ?? true,
    activated: user?.activated ?? user?.actif ?? true,
    permissions: user?.permissions ?? {},
    has_subscription: user?.has_subscription ?? payload?.subscription_active ?? false,
  });
};

const syncUserToStorage = (user: User | null): void => {
  if (!user) {
    safeStorage.remove(USER_KEY);
    return;
  }
  safeStorage.set(USER_KEY, JSON.stringify(user));
};

const syncTokensToStorage = (token: string | null, refreshToken: string | null): void => {
  if (token) {
    safeStorage.set(ACCESS_TOKEN_KEY, token);
  } else {
    safeStorage.remove(ACCESS_TOKEN_KEY);
  }

  if (refreshToken) {
    safeStorage.set(REFRESH_TOKEN_KEY, refreshToken);
  } else {
    safeStorage.remove(REFRESH_TOKEN_KEY);
  }
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

        syncTokensToStorage(token, refreshToken);
        syncUserToStorage(normalizedUser);

        // Mettre à jour le header axios par défaut
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

        syncTokensToStorage(token, refreshToken ?? get().refreshToken);
        syncUserToStorage(nextUser);

        // Mettre à jour le header axios par défaut
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
        syncTokensToStorage(get().token, refreshToken);
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
        if (get().user) {
          syncUserToStorage(get().user);
        }
      },

      setTenantId: (id) => {
        set({ tenantId: id });

        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = {
            ...currentUser,
            tenant_id: id,
          };
          syncUserToStorage(updatedUser);
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

          syncUserToStorage(updatedUser);
          return { user: updatedUser };
        }),

      setLoading: (loading) => set({ isLoading: loading }),

      syncFromStorage: () => {
        const token = safeStorage.get(ACCESS_TOKEN_KEY);
        const refreshToken = safeStorage.get(REFRESH_TOKEN_KEY);
        const userStr = safeStorage.get(USER_KEY);
        
        if (token && userStr) {
          try {
            const user = JSON.parse(userStr);
            const payload = decodeJwt(token);
            
            if (isJwtExpired(token)) {
              console.log('⏰ Token expiré lors de la sync');
              return false;
            }
            
            set({
              user: user,
              token: token,
              refreshToken: refreshToken,
              isAuthenticated: true,
              currentPharmacyId: user.pharmacy_id ?? payload?.pharmacy_id ?? null,
              tenantId: user.tenant_id ?? payload?.tenant_id ?? null,
              subscriptionActive: Boolean(payload?.subscription_active ?? false),
              isLoading: false,
            });
            
            return true;
          } catch (error) {
            console.error('❌ Erreur sync storage:', error);
          }
        }
        
        return false;
      },

      hydrateAuth: () => {
        try {
          const persistedState = safeStorage.get(STORAGE_NAME);
          
          if (persistedState) {
            try {
              const parsed = JSON.parse(persistedState);
              if (parsed.state?.token && parsed.state?.user) {
                const token = parsed.state.token;
                
                if (!isJwtExpired(token)) {
                  set({
                    user: parsed.state.user,
                    token: token,
                    refreshToken: parsed.state.refreshToken,
                    isAuthenticated: true,
                    currentPharmacyId: parsed.state.currentPharmacyId,
                    tenantId: parsed.state.tenantId,
                    subscriptionActive: parsed.state.subscriptionActive,
                    isLoading: false,
                  });
                  console.log('💧 Auth hydratée depuis persistence');
                  return;
                }
              }
            } catch (e) {
              console.error('Erreur parsing persistence:', e);
            }
          }
          
          const synced = get().syncFromStorage();
          
          if (!synced) {
            console.log('❌ Aucune session valide trouvée');
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
          }
        } catch (error) {
          console.error('❌ Erreur hydratation auth:', error);
          get().clearAuth();
          set({ isLoading: false });
        }
      },

      refreshSession: async () => {
        if (refreshPromise) return refreshPromise;

        refreshPromise = (async () => {
          try {
            const refreshToken = get().refreshToken ?? safeStorage.get(REFRESH_TOKEN_KEY);

            if (!refreshToken) {
              console.warn('⚠️ Aucun refresh token disponible');
              return null;
            }

            console.log('🔄 Refresh session manuel...');
            
            const response = await axios.post(
              `${API_BASE_URL}/auth/refresh`,
              { refresh_token: refreshToken },
              {
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'application/json',
                },
                timeout: 20000,
              },
            );

            const newAccessToken = response.data?.access_token ?? response.data?.token ?? null;

            if (!newAccessToken) {
              return null;
            }

            get().setTokens(newAccessToken, refreshToken);
            console.log('✅ Session rafraîchie manuellement');
            return newAccessToken;
          } catch (error) {
            console.error('❌ Échec du refresh manuel:', error);
            get().clearAuth();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      clearAuth: () => {
        console.log('🔐 clearAuth: suppression de toutes les données');
        safeStorage.remove(ACCESS_TOKEN_KEY);
        safeStorage.remove(REFRESH_TOKEN_KEY);
        safeStorage.remove(USER_KEY);
        safeStorage.remove(STORAGE_NAME);
        
        // Supprimer le header axios
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

      isTokenExpired: () => {
        const currentToken = get().token;
        return isJwtExpired(currentToken);
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
        if (!state) return;
        try {
          if (state.user) {
            state.user = normalizeUser(state.user);
          }
          state.isLoading = false;
        } catch (error) {
          console.error('❌ Erreur rehydratation:', error);
        }
      },
    },
  ),
);

// ==================== Hooks utilitaires ====================

export const useInitializeAuth = () => {
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const isTokenExpired = useAuthStore((state) => state.isTokenExpired);
  const token = useAuthStore((state) => state.token);

  const initialize = async () => {
    console.log('🔐 Initialisation auth...');
    hydrateAuth();
    
    if (token && isTokenExpired()) {
      console.log('🔄 Token expiré au démarrage, refresh automatique...');
      await refreshSession();
    }
    
    const finalState = useAuthStore.getState();
    console.log('🔐 Auth initialisée:', {
      isAuthenticated: finalState.isAuthenticated,
      role: finalState.user?.role,
      hasToken: !!finalState.token,
    });
  };

  return { initialize };
};

export const usePharmacyId = () => {
  return useAuthStore((state) => state.getCurrentPharmacyId());
};

export const useHasPharmacy = () => {
  const pharmacyId = useAuthStore((state) => state.getCurrentPharmacyId());
  return Boolean(pharmacyId);
};

// Export de l'instance api pour utilisation dans les composants
export default api;