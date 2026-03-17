// services/dashboard.service.ts
import axios from 'axios';
import axiosRetry from 'axios-retry';

export interface DashboardStats {
  daily_sales: number;
  monthly_sales: number;
  sales_trend: number;
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  expired_count: number;
  expiring_soon_count: number;
  total_stock_value: number;
  total_purchase_value: number;
  potential_profit: number;
  net_profit: number;
  active_users: number;
  total_customers: number;
  tenant?: {
    id: number;
    name: string;
    plan_name: string;
    max_users: number;
    subscription_end: string;
  };
  alerts: Alert[];
  sales_history: SalesHistoryItem[];
}

export interface Alert {
  id: number;
  type: 'low_stock' | 'expired' | 'expiring';
  severity: 'low' | 'medium' | 'high';
  message: string;
  product_id: number;
  product_name: string;
  current_stock: number;
  threshold: number;
  expiry_date?: string;
  created_at: string;
  is_resolved: boolean;
}

export interface Transfer {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  from_pharmacy_id: number;
  from_pharmacy_name: string;
  to_pharmacy_id: number;
  to_pharmacy_name: string;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  created_by_name: string;
}

export interface SalesHistoryItem {
  date: string;
  count: number;
  amount: number;
  transaction_count?: number;
}

export interface DashboardFilters {
  pharmacy_id?: number;
  start_date?: string;
  end_date?: string;
}

class DashboardService {
  private baseURL: string;
  private timeout: number = 30000; // 30 secondes

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'https://backend-medigest.onrender.com';
    
    // Configuration du retry pour les échecs de requête
    axiosRetry(axios, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               error.response?.status === 429 || // Too Many Requests
               (error.response?.status ?? 0) >= 500; // Erreurs serveur
      }
    });
  }

  private getHeaders() {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Token d\'authentification non trouvé');
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Tenant-ID': localStorage.getItem('pharmacyId') || ''
    };
  }

  private handleError(error: any, context: string): never {
    console.error(`Erreur DashboardService.${context}:`, error);
    
    if (error.response) {
      // Erreur de réponse HTTP
      switch (error.response.status) {
        case 401:
          throw new Error('Session expirée. Veuillez vous reconnecter.');
        case 403:
          throw new Error('Accès non autorisé à ces données.');
        case 404:
          throw new Error('Données du tableau de bord non trouvées.');
        case 422:
          throw new Error('Paramètres invalides pour la requête.');
        case 429:
          throw new Error('Trop de requêtes. Veuillez patienter.');
        default:
          throw new Error(error.response.data?.message || `Erreur serveur (${error.response.status})`);
      }
    } else if (error.request) {
      // Pas de réponse du serveur
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    } else {
      // Erreur de configuration
      throw new Error(`Erreur de configuration: ${error.message}`);
    }
  }

  async getDashboardStats(filters?: DashboardFilters): Promise<DashboardStats> {
    try {
      const response = await axios.get(`${this.baseURL}/api/dashboard/stats`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: filters?.pharmacy_id,
          start_date: filters?.start_date,
          end_date: filters?.end_date,
          t: Date.now() // Cache busting
        },
        timeout: this.timeout
      });

      if (!response.data) {
        throw new Error('Aucune donnée reçue du serveur');
      }

      return response.data;
    } catch (error) {
      return this.handleError(error, 'getDashboardStats');
    }
  }

  async getAlerts(
    filters?: {
      pharmacy_id?: number;
      limit?: number;
      type?: 'low_stock' | 'expired' | 'expiring';
      include_resolved?: boolean;
    }
  ): Promise<{ alerts: Alert[]; total: number }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/inventory/alerts`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: filters?.pharmacy_id,
          limit: filters?.limit || 50,
          type: filters?.type,
          include_resolved: filters?.include_resolved || false,
          t: Date.now()
        },
        timeout: this.timeout
      });

      return {
        alerts: response.data.alerts || [],
        total: response.data.total || 0
      };
    } catch (error) {
      return this.handleError(error, 'getAlerts');
    }
  }

  async getPendingTransfers(pharmacyId?: number): Promise<Transfer[]> {
    try {
      const response = await axios.get(`${this.baseURL}/api/transfers/pending`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: pharmacyId,
          status: 'pending',
          direction: 'incoming',
          t: Date.now()
        },
        timeout: this.timeout
      });

      return response.data.transfers || [];
    } catch (error) {
      return this.handleError(error, 'getPendingTransfers');
    }
  }

  async getSalesHistory(
    filters?: {
      pharmacy_id?: number;
      period?: 'day' | 'week' | 'month' | 'year';
      start_date?: string;
      end_date?: string;
      limit?: number;
    }
  ): Promise<SalesHistoryItem[]> {
    try {
      const response = await axios.get(`${this.baseURL}/api/dashboard/sales-history`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: filters?.pharmacy_id,
          period: filters?.period || 'day',
          start_date: filters?.start_date,
          end_date: filters?.end_date,
          limit: filters?.limit || 30,
          t: Date.now()
        },
        timeout: this.timeout
      });

      return response.data.history || [];
    } catch (error) {
      return this.handleError(error, 'getSalesHistory');
    }
  }

  async getExpiryReport(pharmacyId?: number): Promise<{
    expiring_soon: Array<{
      product_id: number;
      product_name: string;
      batch_number: string;
      expiry_date: string;
      quantity: number;
      days_until_expiry: number;
    }>;
    expired: Array<{
      product_id: number;
      product_name: string;
      batch_number: string;
      expiry_date: string;
      quantity: number;
      days_expired: number;
    }>;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/inventory/expiry-report`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: pharmacyId,
          t: Date.now()
        },
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, 'getExpiryReport');
    }
  }

  async getLowStockReport(pharmacyId?: number): Promise<{
    critical: Array<{
      product_id: number;
      product_name: string;
      current_stock: number;
      threshold: number;
      deficit: number;
    }>;
    warning: Array<{
      product_id: number;
      product_name: string;
      current_stock: number;
      threshold: number;
    }>;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/inventory/low-stock-report`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: pharmacyId,
          t: Date.now()
        },
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, 'getLowStockReport');
    }
  }

  async getPerformanceIndicators(pharmacyId?: number): Promise<{
    turnover_rate: number; // Taux de rotation du stock
    average_cart: number; // Panier moyen
    conversion_rate: number; // Taux de conversion
    customer_satisfaction: number; // Satisfaction client
    employee_productivity: number; // Productivité employé
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/api/dashboard/performance`, {
        headers: this.getHeaders(),
        params: {
          pharmacy_id: pharmacyId,
          t: Date.now()
        },
        timeout: this.timeout
      });

      return response.data;
    } catch (error) {
      return this.handleError(error, 'getPerformanceIndicators');
    }
  }

  async resolveAlert(alertId: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/inventory/alerts/${alertId}/resolve`,
        {},
        {
          headers: this.getHeaders(),
          timeout: this.timeout
        }
      );

      return response.data;
    } catch (error) {
      return this.handleError(error, 'resolveAlert');
    }
  }

  async refreshDashboardCache(pharmacyId?: number): Promise<void> {
    try {
      await axios.post(
        `${this.baseURL}/api/dashboard/refresh-cache`,
        { pharmacy_id: pharmacyId },
        {
          headers: this.getHeaders(),
          timeout: this.timeout
        }
      );
    } catch (error) {
      console.warn('Erreur lors du rafraîchissement du cache:', error);
      // Ne pas bloquer le flux principal si le rafraîchissement échoue
    }
  }
}

export const dashboardService = new DashboardService();