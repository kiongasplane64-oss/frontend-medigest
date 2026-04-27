// api/client.ts
import axios, {
  AxiosError,
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

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ============================================================
// FONCTIONS SIMPLIFIÉES
// ============================================================

// Récupération du token - UNE SEULE SOURCE DE VÉRITÉ
const getToken = (): string | null => {
  // Essayer d'abord localStorage
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) return token;
  
  // Sinon essayer le store (et synchroniser)
  const state = useAuthStore.getState();
  if (state.token) {
    localStorage.setItem(ACCESS_TOKEN_KEY, state.token);
    return state.token;
  }
  
  return null;
};

// 🔥 CORRECTION: Utiliser setTokens au lieu de setToken
const setTokens = (token: string, refreshToken?: string | null): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }
  
  // Utiliser la méthode setTokens du store
  const state = useAuthStore.getState();
  state.setTokens(token, refreshToken);
};

// Suppression du token - Utiliser clearAuth ou logout
const clearAuth = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  
  const state = useAuthStore.getState();
  state.clearAuth(); // ou state.logout()
};

// Vérification si route publique
const isPublicRoute = (url?: string): boolean => {
  if (!url) return false;
  const publicPaths = [
    '/health', 
    '/subscriptions/plans', 
    '/openapi.json', 
    '/auth/login', 
    '/auth/refresh',
    '/auth/register',
    '/auth/password/reset'
  ];
  return publicPaths.some(path => url.includes(path));
};

// ============================================================
// 🔥 INTERCEPTEUR REQUÊTE - CORRIGÉ
// ============================================================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 🔥 CRITIQUE: Récupérer le token À CHAQUE REQUÊTE
    const token = getToken();
    
    // Log pour débogage (uniquement en développement)
    if (import.meta.env.DEV) {
      console.log(`📤 [${config.method?.toUpperCase()}] ${config.url}`);
      console.log(`   Token présent: ${!!token}`);
    }
    
    // 🔥 CORRECTION: Ne JAMAIS sauter l'ajout du token
    // Sauf pour les routes publiques explicites
    const isPublic = isPublicRoute(config.url);
    
    if (!isPublic && token) {
      // Format exact attendu par le backend
      config.headers.Authorization = `Bearer ${token}`;
      if (import.meta.env.DEV) {
        console.log(`   ✅ Token AJOUTÉ`);
      }
    } else if (!isPublic && !token) {
      if (import.meta.env.DEV) {
        console.warn(`   ⚠️ PAS DE TOKEN - La requête va probablement échouer`);
      }
    } else if (import.meta.env.DEV) {
      console.log(`   ℹ️ Route publique - pas de token requis`);
    }
    
    // Headers additionnels
    try {
      const state = useAuthStore.getState();
      const pharmacyId = state.getCurrentPharmacyId();
      if (pharmacyId) {
        config.headers['X-Pharmacy-ID'] = pharmacyId;
      }
      if (state.tenantId) {
        config.headers['X-Tenant-ID'] = state.tenantId;
      }
    } catch (e) {
      // Ignorer les erreurs de lecture du store
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Erreur intercepteur requête:', error);
    return Promise.reject(error);
  }
);

// ============================================================
// 🔥 INTERCEPTEUR RÉPONSE - GESTION DES ERREURS
// ============================================================
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.status} ${response.config.url}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const originalRequest = error.config as RetryableRequestConfig;
    
    if (import.meta.env.DEV) {
      console.error(`❌ Erreur ${status} ${url}`);
    }
    
    // 🔥 Gestion des 401 (token expiré)
    if (status === 401 && originalRequest && !originalRequest._retry && !isPublicRoute(url)) {
      originalRequest._retry = true;
      
      if (import.meta.env.DEV) {
        console.log(`🔄 Tentative de refresh token pour ${url}`);
      }
      
      try {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/auth/refresh`,
            { refresh_token: refreshToken },
            { headers: { 'Content-Type': 'application/json' } }
          );
          
          const newToken = response.data?.access_token || response.data?.token;
          const newRefreshToken = response.data?.refresh_token || refreshToken;
          
          if (newToken) {
            // 🔥 CORRECTION: Utiliser setTokens
            setTokens(newToken, newRefreshToken);
            
            // Mettre à jour le header de la requête originale
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            if (import.meta.env.DEV) {
              console.log(`✅ Token rafraîchi, nouvelle tentative`);
            }
            return api(originalRequest);
          }
        }
      } catch (refreshError) {
        if (import.meta.env.DEV) {
          console.error('❌ Échec du refresh token:', refreshError);
        }
      }
      
      // Refresh échoué - déconnexion
      if (import.meta.env.DEV) {
        console.log('🔒 Déconnexion suite à token invalide');
      }
      clearAuth();
      
      // Rediriger vers login si pas déjà dessus
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // 🔥 IMPORTANT: Transformer le HTML en erreur JSON pour éviter les erreurs de parsing
    if (error.response?.data && typeof error.response.data === 'string') {
      const data = error.response.data as string;
      if (data.includes('<!doctype html') || data.includes('<html')) {
        // Créer une erreur formatée
        const jsonError = {
          ...error,
          response: {
            ...error.response,
            data: {
              detail: `Erreur ${status}: Le serveur a retourné une page HTML`,
              status_code: status,
              path: url,
              original_response_type: 'html'
            }
          }
        };
        return Promise.reject(jsonError);
      }
    }
    
    // Gestion des 403
    if (status === 403 && import.meta.env.DEV) {
      console.warn(`🚫 Accès interdit ${url}`);
    }
    
    return Promise.reject(error);
  }
);

// ============================================================
// UTILITAIRES POUR FORCER L'AJOUT DU TOKEN MANUELLEMENT
// ============================================================

/**
 * Force la mise à jour du token dans les headers par défaut
 * À appeler après une connexion réussie
 */
export const setAuthToken = (token: string | null, refreshToken?: string | null): void => {
  if (token) {
    setTokens(token, refreshToken);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (import.meta.env.DEV) {
      console.log('🔐 Token configuré globalement');
    }
  } else {
    delete api.defaults.headers.common['Authorization'];
    if (import.meta.env.DEV) {
      console.log('🔓 Token supprimé');
    }
  }
};

/**
 * Rafraîchit manuellement le token
 */
export const refreshTokenManually = async (): Promise<string | null> => {
  const state = useAuthStore.getState();
  return state.refreshSession();
};

/**
 * Vérifie si l'utilisateur est authentifié
 */
export const isAuthenticated = (): boolean => {
  const token = getToken();
  if (!token) return false;
  
  const state = useAuthStore.getState();
  return !state.isTokenExpired();
};

// ============================================================
// INITIALISATION - FORCER LE TOKEN DANS LES HEADERS PAR DÉFAUT
// ============================================================
const initToken = (): void => {
  const token = getToken();
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (import.meta.env.DEV) {
      console.log('🔐 Token initialisé dans les headers par défaut');
    }
  }
};
initToken();

// ============================================================
// EXPORT
// ============================================================
export default api;