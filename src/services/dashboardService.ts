// services/dashboard.service.ts
/**
 * Service de tableau de bord
 * Communication 100% avec les endpoints dashboard.py
 * Version unifiée - mars 2026
 */

import api from '@/api/client';
import axios from 'axios';
import axiosRetry from 'axios-retry';

// ===================================================================
// TYPES ET INTERFACES
// ===================================================================

export interface DashboardStats {
  // Ventes
  daily_sales: number;
  daily_sales_count: number;
  weekly_sales: number;
  monthly_sales: number;
  sales_trend: number;
  daily_transactions: number;
  monthly_transactions: number;
  sales_history: SalesHistoryItem[];

  // Stock
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  expired_count: number;
  expiring_soon_count: number;

  // Finances
  total_stock_value: number;
  total_purchase_value: number;
  potential_profit: number;
  monthly_costs: number;
  daily_expenses: number;
  net_profit: number;
  daily_profit: number;
  profit_margin: number;
  stock_turnover: number;

  // Dettes
  monthly_debts: number;
  total_debts: number;
  unpaid_debts: number;
  recovery_rate: number;

  // Achats
  monthly_purchases: number;
  daily_purchases: number;
  suppliers_count: number;
  pending_orders: number;

  // Clients
  total_customers: number;
  average_basket: number;

  // Utilisateurs
  active_users: number;

  // Transferts
  pending_transfers_count: number;

  // Tenant
  tenant?: {
    id: string;
    name: string;
    plan_name: string;
    max_users: number;
    subscription_end: string | null;
  };

  // Alertes
  alerts: DashboardAlert[];
  has_critical_alerts: boolean;

  // Données supplémentaires
  recent_transactions: RecentTransaction[];
  recent_purchases: RecentPurchase[];
  debt_list: DebtItem[];
  expense_categories: ExpenseCategory[];
  low_stock_products: LowStockProduct[];
  expiring_products: ExpiringProduct[];
}

export interface SalesHistoryItem {
  date: string;
  count: number;
  amount: number;
  transaction_count?: number;
}

export interface DashboardAlert {
  id: string;
  type: 'low_stock' | 'expired' | 'expiring';
  severity: 'low' | 'medium' | 'high';
  severity_priority?: number;
  message: string;
  product_id: string | null;
  product_name: string;
  product_code?: string | null;
  current_stock: number;
  threshold: number;
  expiry_date?: string | null;
  created_at: string;
  is_resolved: boolean;
}

export interface RecentTransaction {
  reference: string;
  amount: number;
  date: string;
  payment_method: string;
}

export interface RecentPurchase {
  supplier_name: string;
  amount: number;
  date: string;
}

export interface DebtItem {
  customer_name: string;
  amount: number;
  due_date: string;
}

export interface ExpenseCategory {
  name: string;
  amount: number;
}

export interface LowStockProduct {
  name: string;
  current_stock: number;
  threshold: number;
}

export interface ExpiringProduct {
  name: string;
  expiry_date: string;
  quantity: number;
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[];
  total: number;
  has_critical: boolean;
}

export interface SalesTrend {
  period: string;
  count: number;
  amount: number;
}

export interface ProductCategory {
  category: string;
  count: number;
  total_quantity: number;
  total_value: number;
}

export interface ExpiryProductsResponse {
  expired: ExpiryProduct[];
  expiring_soon: ExpiryProduct[];
  out_of_stock: OutOfStockProduct[];
  summary: {
    expired_count: number;
    expiring_soon_count: number;
    out_of_stock_count: number;
    total_affected: number;
  };
}

export interface ExpiryProduct {
  id: string;
  name: string;
  code: string;
  expiry_date: string;
  quantity: number;
  unit: string;
  selling_price: number;
  purchase_price?: number;
  days_left?: number;
}

export interface OutOfStockProduct {
  id: string;
  name: string;
  code: string;
  quantity: number;
  unit: string;
  threshold: number;
}

export interface NeverSoldProductsResponse {
  products: NeverSoldProduct[];
  total_count: number;
  total_value: number;
}

export interface NeverSoldProduct {
  id: string;
  name: string;
  code: string;
  quantity: number;
  category: string;
  unit: string;
  purchase_price: number;
  selling_price: number;
  stock_value: number;
  created_at: string | null;
  days_in_stock: number;
}

export interface SalesByUserResponse {
  period: {
    start_date: string;
    end_date: string;
    days: number;
  };
  users: UserSales[];
  summary: {
    total_users: number;
    total_sales_count: number;
    total_amount: number;
    average_per_user: number;
    total_items_sold: number;
  };
}

export interface UserSales {
  user_id: string;
  user_name: string;
  user_email: string;
  user_role: string;
  sales_count: number;
  total_amount: number;
  average_basket: number;
  items_sold: number;
  percentage: number;
}

export interface DailyProfitResponse {
  date: string;
  summary: {
    total_sales: number;
    total_cost: number;
    gross_profit: number;
    operational_costs: number;
    net_profit: number;
    profit_margin: number;
    sales_count: number;
  };
  sales: DailyProfitSale[];
}

export interface DailyProfitSale {
  sale_id: string;
  reference: string;
  total_amount: number;
  cost_amount: number;
  profit: number;
  profit_margin: number;
  payment_method: string;
  created_at: string | null;
}

export interface PerformanceIndicators {
  turnover_rate: number;
  average_cart: number;
  conversion_rate: number;
  customer_satisfaction: number;
  employee_productivity: number;
}

export interface LowStockReportResponse {
  critical: LowStockCritical[];
  warning: LowStockWarning[];
}

export interface LowStockCritical {
  product_id: string;
  product_name: string;
  current_stock: number;
  threshold: number;
  deficit: number;
}

export interface LowStockWarning {
  product_id: string;
  product_name: string;
  current_stock: number;
  threshold: number;
}

export interface UserSession {
  session_id: string;
  platform: string;
  device_type: string | null;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  location_city: string | null;
  location_country: string | null;
  is_active: boolean;
  last_activity: string | null;
  created_at: string;
  expires_at: string;
}

export interface UserSessionsResponse {
  sessions: UserSession[];
  active_count: number;
  total_count: number;
}

export interface DashboardFilters {
  pharmacy_id?: number;
  start_date?: string;
  end_date?: string;
  limit?: number;
  severity?: 'low' | 'medium' | 'high';
  type?: 'low_stock' | 'expired' | 'expiring';
  include_resolved?: boolean;
  period?: 'day' | 'week' | 'month' | 'year';
}

// ===================================================================
// SERVICE
// ===================================================================

class DashboardService {
  constructor() {
    // Configuration du retry sur l'instance api centralisée
    axiosRetry(api, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
               error.response?.status === 429 ||
               (error.response?.status ?? 0) >= 500;
      }
    });
  }

  private handleError(error: unknown, context: string): never {
    console.error(`Erreur DashboardService.${context}:`, error);
    
    if (axios.isAxiosError(error) && error.response) {
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
          const message = error.response.data?.message || 
                         error.response.data?.detail || 
                         `Erreur serveur (${error.response.status})`;
          throw new Error(message);
      }
    } else if (axios.isAxiosError(error) && error.request) {
      throw new Error('Impossible de contacter le serveur. Vérifiez votre connexion.');
    } else if (error instanceof Error) {
      throw new Error(`Erreur: ${error.message}`);
    } else {
      throw new Error('Une erreur inconnue est survenue');
    }
  }

  // ===================================================================
  // ENDPOINTS PRINCIPAUX
  // ===================================================================

  /**
   * Récupère toutes les statistiques du dashboard
   * GET /dashboard/stats
   */
  async getDashboardStats(filters?: DashboardFilters): Promise<DashboardStats> {
    try {
      const response = await api.get('/dashboard/stats', {
        params: {
          pharmacy_id: filters?.pharmacy_id,
          start_date: filters?.start_date,
          end_date: filters?.end_date,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getDashboardStats');
    }
  }

  /**
   * Récupère les alertes d'inventaire
   * GET /dashboard/alerts
   */
  async getAlerts(filters?: DashboardFilters): Promise<DashboardAlertsResponse> {
    try {
      const response = await api.get('/dashboard/alerts', {
        params: {
          pharmacy_id: filters?.pharmacy_id,
          limit: filters?.limit || 10,
          severity: filters?.severity,
          type: filters?.type,
          include_resolved: filters?.include_resolved || false,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getAlerts');
    }
  }

  /**
   * Marque une alerte comme résolue
   * POST /dashboard/alerts/{alert_id}/resolve
   */
  async resolveAlert(alertId: string): Promise<{ success: boolean; message: string; alert_id: string }> {
    try {
      const response = await api.post(`/dashboard/alerts/${alertId}/resolve`, {});
      return response.data;
    } catch (error) {
      return this.handleError(error, 'resolveAlert');
    }
  }

  /**
   * Récupère l'historique des ventes
   * GET /dashboard/sales-history
   */
  async getSalesHistory(filters?: DashboardFilters): Promise<{ history: SalesHistoryItem[] }> {
    try {
      const response = await api.get('/dashboard/sales-history', {
        params: {
          pharmacy_id: filters?.pharmacy_id,
          period: filters?.period || 'day',
          start_date: filters?.start_date,
          end_date: filters?.end_date,
          limit: filters?.limit || 30,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesHistory');
    }
  }

  /**
   * Récupère les tendances des ventes
   * GET /dashboard/sales/trends
   */
  async getSalesTrends(period: 'day' | 'week' | 'month' | 'year' = 'week', pharmacyId?: number): Promise<SalesTrend[]> {
    try {
      const response = await api.get('/dashboard/sales/trends', {
        params: {
          pharmacy_id: pharmacyId,
          period,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesTrends');
    }
  }

  /**
   * Récupère la distribution des produits par catégorie
   * GET /dashboard/products/categories
   */
  async getProductsByCategory(pharmacyId?: number): Promise<ProductCategory[]> {
    try {
      const response = await api.get('/dashboard/products/categories', {
        params: { pharmacy_id: pharmacyId, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getProductsByCategory');
    }
  }

  /**
   * Récupère les produits expirés et ceux qui expirent bientôt
   * GET /dashboard/expired-products
   */
  async getExpiryReport(pharmacyId?: number, days: number = 30): Promise<ExpiryProductsResponse> {
    try {
      const response = await api.get('/dashboard/expired-products', {
        params: { pharmacy_id: pharmacyId, days, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getExpiryReport');
    }
  }

  /**
   * Récupère les produits qui n'ont jamais été vendus
   * GET /dashboard/products/never-sold
   */
  async getNeverSoldProducts(pharmacyId?: number, limit: number = 50): Promise<NeverSoldProductsResponse> {
    try {
      const response = await api.get('/dashboard/products/never-sold', {
        params: { pharmacy_id: pharmacyId, limit, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getNeverSoldProducts');
    }
  }

  /**
   * Récupère les ventes par utilisateur
   * GET /dashboard/sales/by-user
   */
  async getSalesByUser(
    startDate?: string,
    endDate?: string,
    pharmacyId?: number
  ): Promise<SalesByUserResponse> {
    try {
      const response = await api.get('/dashboard/sales/by-user', {
        params: {
          pharmacy_id: pharmacyId,
          start_date: startDate,
          end_date: endDate,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesByUser');
    }
  }

  /**
   * Récupère le bénéfice journalier détaillé
   * GET /dashboard/daily-profit
   */
  async getDailyProfit(targetDate?: string, pharmacyId?: number): Promise<DailyProfitResponse> {
    try {
      const response = await api.get('/dashboard/daily-profit', {
        params: {
          pharmacy_id: pharmacyId,
          target_date: targetDate,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getDailyProfit');
    }
  }

  /**
   * Récupère les indicateurs de performance
   * GET /dashboard/performance
   */
  async getPerformanceIndicators(period: 'day' | 'week' | 'month' | 'year' = 'month', pharmacyId?: number): Promise<PerformanceIndicators> {
    try {
      const response = await api.get('/dashboard/performance', {
        params: { pharmacy_id: pharmacyId, period, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getPerformanceIndicators');
    }
  }

  /**
   * Rafraîchit le cache du dashboard
   * POST /dashboard/refresh-cache
   */
  async refreshDashboardCache(pharmacyId?: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post('/dashboard/refresh-cache', { pharmacy_id: pharmacyId });
      return response.data;
    } catch (error) {
      console.warn('Erreur lors du rafraîchissement du cache:', error);
      return { success: false, message: 'Erreur lors du rafraîchissement' };
    }
  }

  /**
   * Récupère le rapport des produits en stock bas
   * GET /dashboard/low-stock-report
   */
  async getLowStockReport(pharmacyId?: number, thresholdMultiplier: number = 1.0): Promise<LowStockReportResponse> {
    try {
      const response = await api.get('/dashboard/low-stock-report', {
        params: {
          pharmacy_id: pharmacyId,
          threshold_multiplier: thresholdMultiplier,
          t: Date.now()
        }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getLowStockReport');
    }
  }

  // ===================================================================
  // SESSIONS UTILISATEUR
  // ===================================================================

  /**
   * Enregistre une nouvelle session utilisateur
   * POST /dashboard/session/register
   */
  async registerSession(params: {
    platform?: string;
    device_type?: string;
    device_name?: string;
    browser?: string;
    browser_version?: string;
    os?: string;
    os_version?: string;
    ip_address?: string;
    user_agent?: string;
    location_city?: string;
    location_country?: string;
  }): Promise<{ session_id: string; platform: string; device_name: string | null; created_at: string; expires_at: string }> {
    try {
      const response = await api.post('/dashboard/session/register', null, {
        params
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'registerSession');
    }
  }

  /**
   * Récupère les sessions de l'utilisateur
   * GET /dashboard/sessions
   */
  async getUserSessions(includeInactive: boolean = false): Promise<UserSessionsResponse> {
    try {
      const response = await api.get('/dashboard/sessions', {
        params: { include_inactive: includeInactive, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getUserSessions');
    }
  }

  /**
   * Récupère les ventes d'une session spécifique
   * GET /dashboard/sessions/{session_id}/sales
   */
  async getSessionSales(
    sessionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ session: any; sales: any[]; summary: any }> {
    try {
      const response = await api.get(`/dashboard/sessions/${sessionId}/sales`, {
        params: { start_date: startDate, end_date: endDate, t: Date.now() }
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSessionSales');
    }
  }

  /**
   * Déconnecte une session
   * POST /dashboard/session/logout
   */
  async logoutSession(sessionId?: string): Promise<{ message: string; sessions_count: number }> {
    try {
      const response = await api.post('/dashboard/session/logout', null, {
        params: sessionId ? { session_id: sessionId } : {}
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error, 'logoutSession');
    }
  }

  /**
   * Met à jour l'activité d'une session
   * POST /dashboard/session/{session_id}/activity
   */
  async updateSessionActivity(sessionId: string): Promise<{ message: string }> {
    try {
      const response = await api.post(`/dashboard/session/${sessionId}/activity`, {});
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateSessionActivity');
    }
  }
}

// ===================================================================
// EXPORT
// ===================================================================

export const dashboardService = new DashboardService();
export default dashboardService;