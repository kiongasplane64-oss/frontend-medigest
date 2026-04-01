// services/sessionService.ts
import api from '@/api/client';
import { UAParser } from 'ua-parser-js';

export interface UserSession {
  session_id: string;
  platform: string;
  device_type: string;
  device_name: string;
  browser: string;
  os: string;
  ip_address: string;
  location_city?: string;
  location_country?: string;
  is_active: boolean;
  last_activity: string;
  created_at: string;
  expires_at: string;
}

export interface SessionSale {
  id: string;
  reference: string;
  total_amount: number;
  payment_method: string;
  created_at: string;
  items_count: number;
}

export interface SessionSalesResponse {
  session: {
    session_id: string;
    platform: string;
    device_name: string;
    device_type: string;
    started_at: string;
    ended_at?: string;
  };
  sales: SessionSale[];
  summary: {
    total_sales: number;
    total_amount: number;
    average_basket: number;
  };
}

class SessionService {
  constructor() {
    // Pas besoin de baseURL, le client centralisé s'en charge
  }

  // Plus besoin de getHeaders(), l'intercepteur du client ajoute automatiquement le token

  /**
   * Détecte les informations de la plateforme actuelle
   */
  getCurrentPlatformInfo(): Record<string, any> {
    const parser = new UAParser();
    const result = parser.getResult();
    
    // Déterminer la plateforme
    let platform = 'web';
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
      platform = 'mobile';
    }
    if (/tablet|ipad/i.test(userAgent)) {
      platform = 'tablet';
    }
    if (/pos|terminal|caisse/i.test(userAgent)) {
      platform = 'pos';
    }
    
    // Détecter si c'est une PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      platform = 'pwa';
    }
    
    return {
      platform,
      device_type: result.device.type || 'desktop',
      device_name: result.device.model || (result.device.vendor ? `${result.device.vendor} ${result.device.model}` : 'Unknown'),
      browser: result.browser.name,
      browser_version: result.browser.version,
      os: result.os.name,
      os_version: result.os.version,
      user_agent: navigator.userAgent,
      language: navigator.language,
      screen_resolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    };
  }

  /**
   * Enregistre la session actuelle
   */
  async registerSession(ipInfo?: { city?: string; country?: string }): Promise<{ session_id: string }> {
    try {
      const platformInfo = this.getCurrentPlatformInfo();
      
      const response = await api.post('/dashboard/session/register', null, {
        params: {
          ...platformInfo,
          location_city: ipInfo?.city,
          location_country: ipInfo?.country
        }
      });
      
      // Stocker l'ID de session dans localStorage
      if (response.data.session_id) {
        localStorage.setItem('current_session_id', response.data.session_id);
      }
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la session:', error);
      throw error;
    }
  }

  /**
   * Récupère toutes les sessions de l'utilisateur
   */
  async getUserSessions(includeInactive: boolean = false): Promise<{
    sessions: UserSession[];
    active_count: number;
    total_count: number;
  }> {
    try {
      const response = await api.get('/dashboard/sessions', {
        params: { include_inactive: includeInactive, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des sessions:', error);
      throw error;
    }
  }

  /**
   * Récupère les ventes d'une session spécifique
   */
  async getSessionSales(sessionId: string, startDate?: string, endDate?: string): Promise<SessionSalesResponse> {
    try {
      const response = await api.get(`/dashboard/sessions/${sessionId}/sales`, {
        params: { start_date: startDate, end_date: endDate, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la récupération des ventes de session:', error);
      throw error;
    }
  }

  /**
   * Déconnecte une session spécifique
   */
  async logoutSession(sessionId?: string): Promise<{ message: string; sessions_count: number }> {
    try {
      const response = await api.post('/dashboard/session/logout', null, {
        params: sessionId ? { session_id: sessionId } : {}
      });
      
      // Si c'est la session actuelle, effacer l'ID
      const currentSessionId = localStorage.getItem('current_session_id');
      if (sessionId === currentSessionId || !sessionId) {
        localStorage.removeItem('current_session_id');
      }
      
      return response.data;
    } catch (error) {
      console.error('Erreur lors de la déconnexion de la session:', error);
      throw error;
    }
  }

  /**
   * Met à jour la dernière activité de la session
   */
  async updateSessionActivity(): Promise<void> {
    try {
      const sessionId = localStorage.getItem('current_session_id');
      if (!sessionId) return;
      
      await api.post(`/dashboard/session/${sessionId}/activity`, {});
    } catch (error) {
      // Ne pas bloquer l'utilisateur si l'update échoue
      console.warn('Erreur lors de la mise à jour de l\'activité:', error);
    }
  }
}

export const sessionService = new SessionService();