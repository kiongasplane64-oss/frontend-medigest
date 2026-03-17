import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import axios from 'axios';

export interface User {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id?: string | null;
  telephone?: string;
  phone?: string;
  actif: boolean;
  activated: boolean;
  permissions?: Record<string, boolean>;
}

type UserInput = Partial<User> & {
  id?: string | number;
  email?: string;
  role?: string;
  nom_complet?: string;
  tenant_id?: string | null;
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
  refreshSession: () => Promise<string | null>;
  clearAuth: () => void;
  logout: () => void;

  isSuperAdmin: () => boolean;
  isAdmin: () => boolean;
  hasRole: (role: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isTokenExpired: () => boolean;
}

const STORAGE_NAME = 'pharma-auth-storage';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/api/v1';

let refreshPromise: Promise<string | null> | null = null;

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

const normalizeUser = (user: UserInput): User => {
  const actif = Boolean(user?.actif ?? user?.activated ?? false);
  const activated = Boolean(user?.activated ?? user?.actif ?? false);

  return {
    id: String(user?.id ?? ''),
    email: String(user?.email ?? '').toLowerCase().trim(),
    role: String(user?.role ?? 'user').trim(),
    nom_complet: String(user?.nom_complet ?? 'Utilisateur').trim(),
    tenant_id: user?.tenant_id ?? null,
    telephone: user?.telephone ?? user?.phone ?? '',
    phone: user?.phone ?? user?.telephone ?? '',
    actif,
    activated,
    permissions: user?.permissions ?? {},
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

  return normalizeUser({
    id: user?.id ?? payload?.sub ?? '',
    email: user?.email ?? String(payload?.email ?? ''),
    role: user?.role ?? String(payload?.role ?? 'user'),
    nom_complet: user?.nom_complet ?? 'Utilisateur',
    tenant_id: user?.tenant_id ?? payload?.tenant_id ?? null,
    telephone: user?.telephone ?? user?.phone ?? '',
    phone: user?.phone ?? user?.telephone ?? '',
    actif: user?.actif ?? user?.activated ?? true,
    activated: user?.activated ?? user?.actif ?? true,
    permissions: user?.permissions ?? {},
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
  if (token) safeStorage.set(ACCESS_TOKEN_KEY, token);
  else safeStorage.remove(ACCESS_TOKEN_KEY);

  if (refreshToken) safeStorage.set(REFRESH_TOKEN_KEY, refreshToken);
  else safeStorage.remove(REFRESH_TOKEN_KEY);
};

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
        const pharmacyId = (payload?.pharmacy_id as string | null | undefined) ?? null;
        const subscriptionActive = Boolean(payload?.subscription_active ?? false);

        syncTokensToStorage(token, refreshToken);
        syncUserToStorage(normalizedUser);

        set({
          user: normalizedUser,
          token,
          refreshToken,
          isAuthenticated: Boolean(token),
          currentPharmacyId: pharmacyId,
          tenantId,
          subscriptionActive,
          isLoading: false,
        });

        console.log('🔐 Auth enregistrée:', {
          email: normalizedUser.email,
          role: normalizedUser.role,
          hasToken: Boolean(token),
          hasRefreshToken: Boolean(refreshToken),
          tenantId,
          pharmacyId,
          subscriptionActive,
        });
      },

      setTokens: (token, refreshToken = null) => {
        const currentUser = get().user;
        const nextUser = currentUser
          ? mergeUserWithTokenPayload(currentUser, token)
          : mergeUserWithTokenPayload(null, token);

        const payload = decodeJwt(token);

        syncTokensToStorage(token, refreshToken ?? get().refreshToken);
        syncUserToStorage(nextUser);

        set({
          token,
          refreshToken: refreshToken ?? get().refreshToken,
          user: nextUser,
          isAuthenticated: true,
          tenantId: nextUser.tenant_id ?? payload?.tenant_id ?? null,
          currentPharmacyId:
            (payload?.pharmacy_id as string | null | undefined) ?? get().currentPharmacyId,
          subscriptionActive: Boolean(payload?.subscription_active ?? get().subscriptionActive),
          isLoading: false,
        });
      },

      setAccessToken: (token) => {
        get().setTokens(token, get().refreshToken);
      },

      setRefreshToken: (refreshToken) => {
        syncTokensToStorage(get().token, refreshToken);

        set({
          refreshToken,
        });
      },

      setPharmacy: (id) => {
        set({ currentPharmacyId: id });
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

      hydrateAuth: () => {
        try {
          const persistedToken = safeStorage.get(ACCESS_TOKEN_KEY);
          const persistedRefreshToken = safeStorage.get(REFRESH_TOKEN_KEY);
          const persistedUser = safeStorage.get(USER_KEY);

          if (!persistedToken) {
            set({
              user: null,
              token: null,
              refreshToken: persistedRefreshToken,
              isAuthenticated: false,
              currentPharmacyId: null,
              tenantId: null,
              subscriptionActive: false,
              isLoading: false,
            });
            return;
          }

          const payload = decodeJwt(persistedToken);

          let parsedUser: User | null = null;
          if (persistedUser) {
            parsedUser = normalizeUser(JSON.parse(persistedUser));
          }

          const normalizedUser = parsedUser
            ? mergeUserWithTokenPayload(parsedUser, persistedToken)
            : mergeUserWithTokenPayload(null, persistedToken);

          syncUserToStorage(normalizedUser);

          set({
            user: normalizedUser,
            token: persistedToken,
            refreshToken: persistedRefreshToken,
            isAuthenticated: true,
            currentPharmacyId:
              (payload?.pharmacy_id as string | null | undefined) ?? null,
            tenantId: normalizedUser.tenant_id ?? payload?.tenant_id ?? null,
            subscriptionActive: Boolean(payload?.subscription_active ?? false),
            isLoading: false,
          });

          console.log('🔐 Auth hydratée depuis le stockage');
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

            const newAccessToken =
              response.data?.access_token ??
              response.data?.token ??
              null;

            const newRefreshToken =
              response.data?.refresh_token ?? refreshToken;

            if (!newAccessToken) {
              console.warn('⚠️ Refresh effectué sans nouveau token');
              return null;
            }

            get().setTokens(newAccessToken, newRefreshToken);

            console.log('✅ Session rafraîchie automatiquement');
            return newAccessToken as string;
          } catch (error) {
            console.error('❌ Échec du refresh automatique:', error);
            get().clearAuth();
            return null;
          } finally {
            refreshPromise = null;
          }
        })();

        return refreshPromise;
      },

      clearAuth: () => {
        safeStorage.remove(ACCESS_TOKEN_KEY);
        safeStorage.remove(REFRESH_TOKEN_KEY);
        safeStorage.remove(USER_KEY);
        safeStorage.remove(STORAGE_NAME);

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
        const role = get().user?.role?.toLowerCase().trim();
        return role === 'super-admin' || role === 'superadmin';
      },

      isAdmin: () => {
        const role = get().user?.role?.toLowerCase().trim();
        return role === 'admin' || role === 'super-admin' || role === 'superadmin';
      },

      hasRole: (role) => {
        const currentRole = get().user?.role?.toLowerCase().trim();
        return currentRole === role.toLowerCase().trim();
      },

      hasPermission: (permission) => {
        const user = get().user;
        if (!user) return false;
        if (get().isSuperAdmin()) return true;

        return Boolean(user.permissions?.[permission]);
      },

      isTokenExpired: () => {
        return isJwtExpired(get().token);
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
          console.error('❌ Erreur rehydratation persist:', error);
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
          state.currentPharmacyId = null;
          state.tenantId = null;
          state.subscriptionActive = false;
          state.isLoading = false;
        }
      },
    },
  ),
);

export const useInitializeAuth = () => {
  const hydrateAuth = useAuthStore((state) => state.hydrateAuth);
  const refreshSession = useAuthStore((state) => state.refreshSession);
  const isTokenExpired = useAuthStore((state) => state.isTokenExpired);

  const initialize = async () => {
    console.log('🔐 Initialisation auth...');
    hydrateAuth();

    const state = useAuthStore.getState();

    if (state.token && isTokenExpired()) {
      console.log('🔄 Token expiré détecté au démarrage, tentative de refresh...');
      await refreshSession();
    }
  };

  return { initialize };
};