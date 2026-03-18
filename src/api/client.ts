import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/store/useAuthStore';

const API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000/api/v1';

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

interface RefreshResponse {
  access_token?: string;
  token?: string;
  refresh_token?: string;
}

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Fonctions de logging simplifiées
const logInfo = (message: string, extra?: unknown) => 
  console.log(`ℹ️ ${message}`, extra ?? '');
const logSuccess = (message: string, extra?: unknown) => 
  console.log(`✅ ${message}`, extra ?? '');
const logWarning = (message: string, extra?: unknown) => 
  console.warn(`⚠️ ${message}`, extra ?? '');
const logError = (message: string, extra?: unknown) => 
  console.error(`❌ ${message}`, extra ?? '');

// Gestion sécurisée du localStorage
const safeLocalStorage = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      logError(`Impossible de lire localStorage[${key}]`, error);
      return null;
    }
  },
  set: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      logError(`Impossible d'écrire localStorage[${key}]`, error);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logError(`Impossible de supprimer localStorage[${key}]`, error);
    }
  }
};

// Récupération des tokens depuis le store ou localStorage
const getStoredAccessToken = (): string | null => {
  try {
    const state = useAuthStore.getState();
    return state.token || safeLocalStorage.get(ACCESS_TOKEN_KEY);
  } catch (error) {
    logError("Erreur lecture token", error);
    return safeLocalStorage.get(ACCESS_TOKEN_KEY);
  }
};

const getStoredRefreshToken = (): string | null => {
  try {
    const state = useAuthStore.getState();
    return state.refreshToken || safeLocalStorage.get(REFRESH_TOKEN_KEY);
  } catch (error) {
    logError("Erreur lecture refresh token", error);
    return safeLocalStorage.get(REFRESH_TOKEN_KEY);
  }
};

// Récupération des IDs de contexte
const getCurrentPharmacyId = (): string | null => {
  try {
    const state = useAuthStore.getState();
    return state.user?.pharmacy_id || null;
  } catch (error) {
    logError("Erreur lecture pharmacie", error);
    return null;
  }
};

const getCurrentTenantId = (): string | null => {
  try {
    const state = useAuthStore.getState();
    return state.user?.tenant_id || null;
  } catch (error) {
    logError("Erreur lecture tenant", error);
    return null;
  }
};

// Gestion des tokens
const clearStoredTokens = (): void => {
  safeLocalStorage.remove(ACCESS_TOKEN_KEY);
  safeLocalStorage.remove(REFRESH_TOKEN_KEY);
};

const setStoredTokens = (accessToken?: string, refreshToken?: string): void => {
  if (accessToken) {
    safeLocalStorage.set(ACCESS_TOKEN_KEY, accessToken);
  }
  if (refreshToken) {
    safeLocalStorage.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  // Mise à jour du store si les méthodes existent
  try {
    const state = useAuthStore.getState() as any;
    if (accessToken && state.setToken) state.setToken(accessToken);
    if (refreshToken && state.setRefreshToken) state.setRefreshToken(refreshToken);
  } catch (error) {
    logError("Erreur synchronisation store", error);
  }
};

// Déconnexion forcée
const forceLogout = (): void => {
  try {
    const state = useAuthStore.getState() as any;
    if (state.logout) {
      state.logout();
    } else if (state.clearAuth) {
      state.clearAuth();
    }
  } catch (error) {
    logError('Erreur déconnexion', error);
  } finally {
    clearStoredTokens();
    if (!window.location.pathname.includes('/login')) {
      window.location.replace('/login');
    }
  }
};

// Vérification des routes
const isAuthRoute = (url?: string): boolean => {
  if (!url) return false;
  const authPaths = [
    '/auth/login', '/auth/register', '/auth/refresh',
    '/auth/password/reset/request', '/auth/password/reset/confirm',
    '/auth/verify-sms', '/auth/resend-sms', '/auth/login-with-code'
  ];
  return authPaths.some(path => url.includes(path));
};

const isPublicRoute = (url?: string): boolean => {
  if (!url) return false;
  const publicPaths = ['/health', '/subscriptions/plans', '/openapi.json'];
  return publicPaths.some(path => url.includes(path));
};

// Vérification du content-type
const shouldAttachJsonContentType = (config: InternalAxiosRequestConfig): boolean => {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  const isFileUpload = config.data instanceof Blob || config.data instanceof File;
  const responseType = config.responseType;
  
  return !isFormData && !isFileUpload && responseType !== 'blob' && responseType !== 'arraybuffer';
};

// Normalisation des headers
const normalizeHeaders = (config: InternalAxiosRequestConfig): AxiosHeaders => {
  return config.headers instanceof AxiosHeaders
    ? config.headers
    : new AxiosHeaders(config.headers || {});
};

// Gestion du refresh token
let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  // Si un refresh est déjà en cours, on retourne la même promesse
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = getStoredRefreshToken();

    if (!refreshToken) {
      logWarning('Aucun refresh token disponible');
      return null;
    }

    try {
      const response = await axios.post<RefreshResponse>(
        `${API_BASE_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout: 20000,
        }
      );

      const accessToken = response.data?.access_token || response.data?.token || null;
      const newRefreshToken = response.data?.refresh_token || refreshToken;

      if (!accessToken) {
        logWarning("Pas de nouveau token dans la réponse");
        return null;
      }

      setStoredTokens(accessToken, newRefreshToken);
      logSuccess("Token rafraîchi avec succès");

      return accessToken;
    } catch (error) {
      logError('Échec du refresh token', error);
      forceLogout(); // Déconnexion en cas d'échec du refresh
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Intercepteur de requête
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    const pharmacyId = getCurrentPharmacyId();
    const tenantId = getCurrentTenantId();
    const headers = normalizeHeaders(config);

    // Gestion du Content-Type
    if (shouldAttachJsonContentType(config)) {
      headers.set('Content-Type', 'application/json');
    } else {
      headers.delete('Content-Type');
    }

    headers.set('Accept', 'application/json');

    // Ajout du token pour les routes non-publiques
    if (!isPublicRoute(config.url) && !isAuthRoute(config.url)) {
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } else {
      headers.delete('Authorization');
    }

    // Headers contextuels
    if (pharmacyId) {
      headers.set('X-Pharmacy-ID', pharmacyId);
    }
    if (tenantId) {
      headers.set('X-Tenant-ID', tenantId);
    }

    if (process.env.NODE_ENV === 'development') {
      logInfo(`➡️ ${config.method?.toUpperCase()} ${config.url}`, {
        hasToken: !!token,
        pharmacyId,
        tenantId
      });
    }

    return config;
  },
  (error) => {
    logError("Erreur intercepteur requête", error);
    return Promise.reject(error);
  }
);

// Intercepteur de réponse
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (process.env.NODE_ENV === 'development') {
      logSuccess(`⬅️ ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const originalRequest = error.config as RetryableRequestConfig;

    // Log de l'erreur
    if (error.response) {
      logError(`Erreur ${status} ${url}`, error.response.data);
    } else if (error.request) {
      logError("Pas de réponse serveur", url);
    } else {
      logError("Erreur configuration", error.message);
    }

    // Gestion spécifique des 401
    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute(url)) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      
      if (newToken) {
        // Mise à jour du header et nouvelle tentative
        originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
        logInfo(`🔄 Nouvelle tentative ${url}`);
        return api(originalRequest);
      }
      
      // Si le refresh échoue, on force la déconnexion
      forceLogout();
      return Promise.reject(error);
    }

    // Gestion des 403 (accès interdit)
    if (status === 403) {
      logWarning(`Accès interdit ${url}`);
      // Redirection vers une page d'erreur ou dashboard
      if (!window.location.pathname.includes('/unauthorized')) {
        // window.location.replace('/unauthorized');
      }
    }

    return Promise.reject(error);
  }
);

export default api;