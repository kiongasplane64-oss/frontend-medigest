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

function logInfo(message: string, extra?: unknown): void {
  console.log(`ℹ️ ${message}`, extra ?? '');
}

function logSuccess(message: string, extra?: unknown): void {
  console.log(`✅ ${message}`, extra ?? '');
}

function logWarning(message: string, extra?: unknown): void {
  console.warn(`⚠️ ${message}`, extra ?? '');
}

function logError(message: string, extra?: unknown): void {
  console.error(`❌ ${message}`, extra ?? '');
}

function safeLocalStorageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    logError(`Impossible de lire localStorage[${key}]`, error);
    return null;
  }
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    logError(`Impossible d'écrire localStorage[${key}]`, error);
  }
}

function safeLocalStorageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    logError(`Impossible de supprimer localStorage[${key}]`, error);
  }
}

function getStoredAccessToken(): string | null {
  try {
    const state = useAuthStore.getState();
    return state.token ?? safeLocalStorageGet(ACCESS_TOKEN_KEY);
  } catch (error) {
    logError("Impossible de lire le token d'accès", error);
    return safeLocalStorageGet(ACCESS_TOKEN_KEY);
  }
}

function getStoredRefreshToken(): string | null {
  try {
    const state = useAuthStore.getState() as {
      refreshToken?: string | null;
    };
    return state.refreshToken ?? safeLocalStorageGet(REFRESH_TOKEN_KEY);
  } catch (error) {
    logError('Impossible de lire le refresh token', error);
    return safeLocalStorageGet(REFRESH_TOKEN_KEY);
  }
}

function getCurrentPharmacyId(): string | null {
  try {
    const state = useAuthStore.getState() as {
      currentPharmacyId?: string | null;
    };
    return state.currentPharmacyId ?? null;
  } catch (error) {
    logError("Impossible de lire la pharmacie courante", error);
    return null;
  }
}

function getCurrentTenantId(): string | null {
  try {
    const state = useAuthStore.getState() as {
      tenantId?: string | null;
      currentTenantId?: string | null;
      user?: { tenant_id?: string | null } | null;
    };

    return (
      state.currentTenantId ??
      state.tenantId ??
      state.user?.tenant_id ??
      null
    );
  } catch (error) {
    logError("Impossible de lire le tenant courant", error);
    return null;
  }
}

function clearStoredTokens(): void {
  safeLocalStorageRemove(ACCESS_TOKEN_KEY);
  safeLocalStorageRemove(REFRESH_TOKEN_KEY);
}

function setStoredTokens(accessToken?: string, refreshToken?: string): void {
  if (accessToken) {
    safeLocalStorageSet(ACCESS_TOKEN_KEY, accessToken);
  }

  if (refreshToken) {
    safeLocalStorageSet(REFRESH_TOKEN_KEY, refreshToken);
  }

  try {
    const state = useAuthStore.getState() as {
      setToken?: (token: string) => void;
      setAccessToken?: (token: string) => void;
      setRefreshToken?: (token: string) => void;
      setTokens?: (accessToken: string, refreshToken?: string) => void;
    };

    if (accessToken && typeof state.setTokens === 'function') {
      state.setTokens(accessToken, refreshToken);
      return;
    }

    if (accessToken && typeof state.setAccessToken === 'function') {
      state.setAccessToken(accessToken);
    } else if (accessToken && typeof state.setToken === 'function') {
      state.setToken(accessToken);
    }

    if (refreshToken && typeof state.setRefreshToken === 'function') {
      state.setRefreshToken(refreshToken);
    }
  } catch (error) {
    logError("Impossible de synchroniser les tokens avec le store", error);
  }
}

function forceLogout(): void {
  try {
    const state = useAuthStore.getState() as {
      logout?: () => void;
      clearAuth?: () => void;
    };

    if (typeof state.logout === 'function') {
      state.logout();
    } else if (typeof state.clearAuth === 'function') {
      state.clearAuth();
    }
  } catch (error) {
    logError('Erreur pendant la déconnexion', error);
  } finally {
    clearStoredTokens();
  }
}

function isAuthRoute(url?: string): boolean {
  if (!url) return false;

  return [
    '/auth/login',
    '/auth/register',
    '/auth/password/reset/request',
    '/auth/password/reset/confirm',
    '/auth/verify-sms',
    '/auth/resend-sms',
    '/auth/login-with-code',
    '/auth/refresh',
  ].some((path) => url.includes(path));
}

function isPublicRoute(url?: string): boolean {
  if (!url) return false;

  return [
    '/health',
    '/subscriptions/plans',
    '/openapi.json',
  ].some((path) => url.includes(path));
}

function shouldAttachJsonContentType(config: InternalAxiosRequestConfig): boolean {
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
  const responseType = config.responseType;

  if (isFormData) return false;
  if (responseType === 'blob' || responseType === 'arraybuffer') return false;

  return true;
}

function normalizeHeaders(
  config: InternalAxiosRequestConfig,
): AxiosHeaders {
  const headers =
    config.headers instanceof AxiosHeaders
      ? config.headers
      : new AxiosHeaders(config.headers ?? {});

  config.headers = headers;
  return headers;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
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
        },
      );

      const accessToken =
        response.data?.access_token ?? response.data?.token ?? null;
      const nextRefreshToken =
        response.data?.refresh_token ?? refreshToken;

      if (!accessToken) {
        logWarning("Réponse refresh reçue sans nouveau token d'accès");
        return null;
      }

      setStoredTokens(accessToken, nextRefreshToken);
      logSuccess("Token d'accès rafraîchi");

      return accessToken;
    } catch (error) {
      logError('Échec du refresh token', error);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredAccessToken();
    const pharmacyId = getCurrentPharmacyId();
    const tenantId = getCurrentTenantId();
    const headers = normalizeHeaders(config);

    if (shouldAttachJsonContentType(config)) {
      headers.set('Content-Type', 'application/json');
    } else {
      headers.delete('Content-Type');
    }

    headers.set('Accept', 'application/json');

    if (!isPublicRoute(config.url)) {
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      } else {
        headers.delete('Authorization');
      }
    }

    if (pharmacyId) {
      headers.set('X-Pharmacy-ID', pharmacyId);
    } else {
      headers.delete('X-Pharmacy-ID');
    }

    if (tenantId) {
      headers.set('X-Tenant-ID', tenantId);
    } else {
      headers.delete('X-Tenant-ID');
    }

    logInfo(`Requête ${String(config.method).toUpperCase()} ${config.url}`, {
      hasToken: Boolean(token),
      pharmacyId,
      tenantId,
    });

    return config;
  },
  (error) => {
    logError("Erreur intercepteur de requête", error);
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response: AxiosResponse) => {
    logSuccess(`Réponse ${response.status} ${response.config.url}`);
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const originalRequest = error.config as RetryableRequestConfig | undefined;

    if (error.response) {
      logError(`Erreur ${status} sur ${url}`, error.response.data);

      if (status === 401 && originalRequest && !originalRequest._retry && !isAuthRoute(url)) {
        originalRequest._retry = true;

        const newAccessToken = await refreshAccessToken();

        if (newAccessToken) {
          const headers = normalizeHeaders(originalRequest);
          headers.set('Authorization', `Bearer ${newAccessToken}`);

          logInfo(`Nouvelle tentative après refresh pour ${url}`);
          return api(originalRequest);
        }

        const state = useAuthStore.getState() as {
          isAuthenticated?: boolean;
        };

        if (state.isAuthenticated) {
          forceLogout();
        }

        if (!window.location.pathname.includes('/login')) {
          window.location.replace('/login');
        }
      }
    } else if (error.request) {
      logError("Aucune réponse du serveur", error.request);
    } else {
      logError("Erreur de configuration Axios", error.message);
    }

    return Promise.reject(error);
  },
);

export default api;