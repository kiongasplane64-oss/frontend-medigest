// src/lib/axios.ts
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';

// Configuration de base
const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 🔐 Gestion du refresh token avec queue
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
}> = [];

// 🔐 Fonction pour définir le token (avec mise à jour du header)
const setToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('access_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    if (import.meta.env.DEV) {
      console.log(`🔑 Token défini: ${token.substring(0, 15)}...`);
    }
  } else {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    if (import.meta.env.DEV) {
      console.log('🔑 Token supprimé');
    }
  }
};

// 🔐 Fonction pour traiter la queue
const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 🔥 INTERCEPTEUR REQUÊTE : Ajoute le token à CHAQUE requête
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Lire le token à chaque requête pour garantir qu'il est à jour
    const token = localStorage.getItem('access_token') || localStorage.getItem('token');
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      if (import.meta.env.DEV) {
        console.log(`🔑 [${config.method?.toUpperCase()}] ${config.url} - Token OK (${token.substring(0, 15)}...)`);
      }
    } else {
      if (import.meta.env.DEV) {
        console.warn(`⚠️ [${config.method?.toUpperCase()}] ${config.url} - PAS DE TOKEN`);
      }
    }
    
    return config;
  },
  (error: AxiosError) => {
    console.error('❌ Erreur intercepteur requête:', error);
    return Promise.reject(error);
  }
);

// 🔥 INTERCEPTEUR RÉPONSE : Gère les erreurs 401
api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Si ce n'est pas une erreur 401 ou que la requête a déjà été retry, rejeter
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    
    // Marquer la requête comme retry
    originalRequest._retry = true;
    
    // Si un refresh est déjà en cours, ajouter à la queue
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        })
        .catch(err => Promise.reject(err));
    }
    
    isRefreshing = true;
    
    try {
      // Récupérer le refresh token
      const refreshToken = localStorage.getItem('refresh_token') || localStorage.getItem('refreshToken');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      console.log('🔄 401 détecté, refresh token en cours...');
      
      // Appel au endpoint de refresh
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      
      const newToken = response.data?.access_token || response.data?.token;
      
      if (!newToken) {
        throw new Error('No access token in refresh response');
      }
      
      // Mettre à jour le token
      setToken(newToken);
      
      console.log('✅ Token rafraîchi avec succès');
      
      // Traiter la queue
      processQueue(null, newToken);
      
      // Mettre à jour la requête originale
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      
      // Réessayer la requête
      return api(originalRequest);
      
    } catch (refreshError) {
      console.error('❌ Échec du refresh token:', refreshError);
      
      // Traiter la queue avec l'erreur
      processQueue(refreshError instanceof Error ? refreshError : new Error('Refresh failed'), null);
      
      // Nettoyer
      setToken(null);
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('refreshToken');
      
      // Rediriger (éviter les boucles)
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login') && !currentPath.includes('/auth')) {
        console.log('🔐 Redirection vers la page de connexion...');
        window.location.href = '/login';
      }
      
      return Promise.reject(refreshError);
      
    } finally {
      isRefreshing = false;
    }
  }
);

// 🔐 Fonctions utilitaires exportées
export const setAuthToken = (token: string | null) => {
  setToken(token);
};

export const getAuthToken = (): string | null => {
  return localStorage.getItem('access_token') || localStorage.getItem('token');
};

export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;
    if (exp && Date.now() >= exp * 1000) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
};

export const clearAuth = () => {
  setToken(null);
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('refreshToken');
};

export default api;