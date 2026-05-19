/**
 * Service de tableau de bord - Version optimisée pour gros volumes
 * Gère 100 000+ produits/ventes avec timeouts adaptés et retry intelligent
 * Avril 2026
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

// ===================================================================
// TYPES ET INTERFACES
// ===================================================================

export interface DashboardFilters {
  branch_id?: string;
  start_date?: string;
  end_date?: string;
  period?: 'day' | 'week' | 'month';
  limit?: number;
  severity?: 'low' | 'medium' | 'high';
  type?: 'low_stock' | 'expired' | 'expiring';
  include_resolved?: boolean;
}

export interface DashboardBranchInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  city: string;
  parent_pharmacy_id: string;
  parent_pharmacy_name: string;
  manager_name?: string;
}

export interface DashboardStats {
  branch_info?: DashboardBranchInfo;
  daily_sales: number;
  daily_sales_count: number;
  weekly_sales: number;
  monthly_sales: number;
  sales_trend: number;
  daily_transactions: number;
  monthly_transactions: number;
  sales_history: SalesHistoryItem[];
  total_products: number;
  out_of_stock_count: number;
  low_stock_count: number;
  expired_count: number;
  expiring_soon_count: number;
  total_stock_value: number;
  total_purchase_value: number;
  potential_profit: number;
  monthly_expenses: number;
  daily_expenses: number;
  net_profit: number;
  daily_profit: number;
  profit_margin: number;
  stock_turnover: number;
  monthly_debts: number;
  total_debts: number;
  unpaid_debts: number;
  recovery_rate: number;
  monthly_purchases: number;
  daily_purchases: number;
  suppliers_count: number;
  pending_orders: number;
  total_customers: number;
  average_basket: number;
  active_users: number;
  pending_transfers: number;
  in_transit_transfers: number;
  tenant?: {
    id: string;
    name: string;
    plan_name: string;
    max_users: number;
    subscription_end: string | null;
  };
  has_critical_alerts: boolean;
  recent_transactions: RecentTransaction[];
  recent_purchases: RecentPurchase[];
  debt_list: DebtItem[];
  expense_categories: ExpenseCategory[];
  low_stock_products: LowStockProduct[];
  expiring_products: ExpiringProduct[];
  period_start?: string;
  period_end?: string;
}

export interface SalesHistoryItem {
  date: string;
  count: number;
  amount: number;
  transaction_count?: number;
  total_revenue?: number;
  average_basket?: number;
}

export interface DashboardAlert {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'expired' | 'expiring';
  severity: 'low' | 'medium' | 'high';
  severity_priority?: number;
  title: string;
  message: string;
  product_id: string | null;
  product_name: string;
  product_code?: string | null;
  current_stock: number;
  threshold: number;
  expiry_date?: string | null;
  days_remaining?: number | null;
  created_at: string;
  is_resolved: boolean;
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[];
  total: number;
  critical_count: number;
  warning_count: number;
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

export interface StockValueHistoryResponse {
  history: StockValueHistoryItem[];
  total_stock_value: number;
  start_date: string;
  end_date: string;
}

export interface StockValueHistoryItem {
  date: string;
  value: number;
}

export interface SalesHistoryResponse {
  history: SalesHistoryItem[];
  total_revenue: number;
  total_sales: number;
  average_daily_revenue: number;
  start_date: string;
  end_date: string;
}

export interface ProfitHistoryResponse {
  history: ProfitHistoryItem[];
  total_profit: number;
  average_profit: number;
  start_date: string;
  end_date: string;
}

export interface ProfitHistoryItem {
  date: string;
  profit: number;
}

// ===================================================================
// CONFIGURATION
// ===================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://backend-medigest.onrender.com';
const DASHBOARD_TIMEOUT = 120000; // 120 secondes pour les gros volumes
const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 secondes

// ===================================================================
// CLIENT AXIOS OPTIMISÉ
// ===================================================================

class DashboardApiClient {
  private client: AxiosInstance;
  private static instance: DashboardApiClient;

  private constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: DASHBOARD_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      withCredentials: false,
    });

    // Intercepteur pour ajouter le token
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = this.getAuthToken();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        // Ajouter timestamp anti-cache
        if (config.params) {
          config.params.t = Date.now();
        } else {
          config.params = { t: Date.now() };
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Intercepteur pour gérer les erreurs 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          const refreshed = await this.refreshToken();
          if (refreshed && error.config) {
            const token = this.getAuthToken();
            if (error.config.headers) {
              error.config.headers.Authorization = `Bearer ${token}`;
            }
            return this.client.request(error.config);
          }
        }
        return Promise.reject(error);
      }
    );

    // Configuration du retry
    axiosRetry(this.client, {
      retries: MAX_RETRIES,
      retryDelay: (retryCount) => {
        console.log(`🔄 Tentative ${retryCount}/${MAX_RETRIES}...`);
        return RETRY_DELAY * retryCount;
      },
      retryCondition: (error: AxiosError) => {
        return (
          error.code === 'ECONNABORTED' ||
          error.code === 'ERR_NETWORK' ||
          error.code === 'ETIMEDOUT' ||
          (error.response?.status ?? 0) >= 500 ||
          error.response?.status === 429
        );
      },
      onRetry: (retryCount, error, requestConfig) => {
        console.warn(`⚠️ Retry ${retryCount} pour ${requestConfig.url}:`, error.message);
      }
    });
  }

  static getInstance(): DashboardApiClient {
    if (!DashboardApiClient.instance) {
      DashboardApiClient.instance = new DashboardApiClient();
    }
    return DashboardApiClient.instance;
  }

  private getAuthToken(): string | null {
    return localStorage.getItem('access_token') || localStorage.getItem('token');
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return false;

      const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken
      });

      if (response.data.access_token) {
        localStorage.setItem('access_token', response.data.access_token);
        if (response.data.refresh_token) {
          localStorage.setItem('refresh_token', response.data.refresh_token);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Refresh token failed:', error);
      localStorage.clear();
      window.location.href = '/login';
      return false;
    }
  }

  getClient(): AxiosInstance {
    return this.client;
  }
}

// ===================================================================
// SERVICE PRINCIPAL
// ===================================================================

class DashboardService {
  private api: AxiosInstance;

  constructor() {
    this.api = DashboardApiClient.getInstance().getClient();
  }

  private handleError(error: unknown, context: string): never {
    console.error(`Erreur DashboardService.${context}:`, error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        throw new Error('Le serveur met trop de temps à répondre. Réessayez dans quelques instants.');
      }
      
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Connexion au serveur impossible. Vérifiez votre connexion internet.');
      }
      
      if (error.message?.includes('CORS')) {
        throw new Error('Problème de configuration CORS. Contactez le support.');
      }
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            throw new Error('Session expirée. Veuillez vous reconnecter.');
          case 403:
            throw new Error('Accès non autorisé à ces données.');
          case 404:
            throw new Error('Données du tableau de bord non trouvées.');
          case 429:
            throw new Error('Trop de requêtes. Veuillez patienter.');
          default:
            const message = error.response.data?.message || 
                           error.response.data?.detail || 
                           `Erreur serveur (${error.response.status})`;
            throw new Error(message);
        }
      }
      
      throw new Error(`Erreur réseau: ${error.message}`);
    }
    
    if (error instanceof Error) {
      throw new Error(`Erreur: ${error.message}`);
    }
    
    throw new Error('Une erreur inconnue est survenue');
  }

  private buildParams(filters?: DashboardFilters): Record<string, any> {
    const params: Record<string, any> = {};
    
    if (filters?.branch_id) params.branch_id = filters.branch_id;
    if (filters?.start_date) params.start_date = filters.start_date;
    if (filters?.end_date) params.end_date = filters.end_date;
    if (filters?.period) params.period = filters.period;
    if (filters?.limit) params.limit = filters.limit;
    if (filters?.severity) params.severity = filters.severity;
    if (filters?.type) params.type = filters.type;
    if (filters?.include_resolved !== undefined) params.include_resolved = filters.include_resolved;
    
    return params;
  }

  // ===================================================================
  // ENDPOINTS PRINCIPAUX
  // ===================================================================

  async getDashboardStats(filters?: DashboardFilters): Promise<DashboardStats> {
    try {
      console.log(`📊 Dashboard stats request: branch=${filters?.branch_id || 'current'}`);
      const response = await this.api.get('/api/v1/dashboard/stats', {
        params: this.buildParams(filters),
        timeout: DASHBOARD_TIMEOUT,
      });
      console.log(`✅ Dashboard stats reçues`);
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getDashboardStats');
    }
  }

  async getAlerts(filters?: DashboardFilters): Promise<DashboardAlertsResponse> {
    try {
      const response = await this.api.get('/dashboard/alerts', {
        params: {
          ...this.buildParams(filters),
          limit: filters?.limit || 50,
        },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getAlerts');
    }
  }

  async getStockValueHistory(branchId: string, days: number = 30): Promise<StockValueHistoryResponse> {
    try {
      const response = await this.api.get('/dashboard/stock-value-history', {
        params: { branch_id: branchId, days },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getStockValueHistory');
    }
  }

  async getSalesHistory(branchId: string, days: number = 30): Promise<SalesHistoryResponse> {
    try {
      const response = await this.api.get('/dashboard/sales-history', {
        params: { branch_id: branchId, days },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesHistory');
    }
  }

  async getProfitHistory(branchId: string, days: number = 30): Promise<ProfitHistoryResponse> {
    try {
      const response = await this.api.get('/dashboard/profit-history', {
        params: { branch_id: branchId, days },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getProfitHistory');
    }
  }

  async getSalesHistoryLegacy(filters?: DashboardFilters): Promise<{ history: SalesHistoryItem[] }> {
    try {
      const response = await this.api.get('/dashboard/sales-history', {
        params: this.buildParams(filters),
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesHistoryLegacy');
    }
  }

  async getSalesTrends(branchId: string, period: 'day' | 'week' | 'month' | 'year' = 'week'): Promise<SalesTrend[]> {
    try {
      const response = await this.api.get('/dashboard/sales/trends', {
        params: { branch_id: branchId, period },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesTrends');
    }
  }

  async getProductsByCategory(branchId?: string): Promise<ProductCategory[]> {
    try {
      const response = await this.api.get('/dashboard/products/categories', {
        params: { branch_id: branchId },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getProductsByCategory');
    }
  }

  async getExpiryReport(branchId?: string, days: number = 30): Promise<ExpiryProductsResponse> {
    try {
      const response = await this.api.get('/dashboard/expired-products', {
        params: { branch_id: branchId, days },
        timeout: 45000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getExpiryReport');
    }
  }

  async getNeverSoldProducts(branchId?: string, limit: number = 50): Promise<NeverSoldProductsResponse> {
    try {
      const response = await this.api.get('/dashboard/products/never-sold', {
        params: { branch_id: branchId, limit },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getNeverSoldProducts');
    }
  }

  async getSalesByUser(
    branchId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<SalesByUserResponse> {
    try {
      const response = await this.api.get('/dashboard/sales/by-user', {
        params: { branch_id: branchId, start_date: startDate, end_date: endDate },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSalesByUser');
    }
  }

  async getDailyProfit(branchId?: string, targetDate?: string): Promise<DailyProfitResponse> {
    try {
      const response = await this.api.get('/dashboard/daily-profit', {
        params: { branch_id: branchId, target_date: targetDate },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getDailyProfit');
    }
  }

  async getPerformanceIndicators(
    branchId?: string,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<PerformanceIndicators> {
    try {
      const response = await this.api.get('/dashboard/performance', {
        params: { branch_id: branchId, period },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getPerformanceIndicators');
    }
  }

  async refreshDashboardCache(branchId?: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.api.post('/dashboard/refresh-cache', { branch_id: branchId });
      return response.data;
    } catch (error) {
      console.warn('Erreur lors du rafraîchissement du cache:', error);
      return { success: false, message: 'Erreur lors du rafraîchissement' };
    }
  }

  async getLowStockReport(branchId?: string, thresholdMultiplier: number = 1.0): Promise<LowStockReportResponse> {
    try {
      const response = await this.api.get('/dashboard/low-stock-report', {
        params: { branch_id: branchId, threshold_multiplier: thresholdMultiplier },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getLowStockReport');
    }
  }

  async resolveAlert(alertId: string): Promise<{ success: boolean; message: string; alert_id: string }> {
    try {
      const response = await this.api.post(`/dashboard/alerts/${alertId}/resolve`, {});
      return response.data;
    } catch (error) {
      return this.handleError(error, 'resolveAlert');
    }
  }

  // ===================================================================
  // SESSIONS UTILISATEUR
  // ===================================================================

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
      const response = await this.api.post('/dashboard/session/register', null, { params });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'registerSession');
    }
  }

  async getUserSessions(includeInactive: boolean = false): Promise<UserSessionsResponse> {
    try {
      const response = await this.api.get('/dashboard/sessions', {
        params: { include_inactive: includeInactive },
        timeout: 30000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getUserSessions');
    }
  }

  async getSessionSales(
    sessionId: string,
    startDate?: string,
    endDate?: string
  ): Promise<{ session: any; sales: any[]; summary: any }> {
    try {
      const response = await this.api.get(`/dashboard/sessions/${sessionId}/sales`, {
        params: { start_date: startDate, end_date: endDate },
        timeout: 60000,
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getSessionSales');
    }
  }

  async logoutSession(sessionId?: string): Promise<{ message: string; sessions_count: number }> {
    try {
      const response = await this.api.post('/dashboard/session/logout', null, {
        params: sessionId ? { session_id: sessionId } : {}
      });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'logoutSession');
    }
  }

  async updateSessionActivity(sessionId: string): Promise<{ message: string }> {
    try {
      const response = await this.api.post(`/dashboard/session/${sessionId}/activity`, {});
      return response.data;
    } catch (error) {
      return this.handleError(error, 'updateSessionActivity');
    }
  }

  // ===================================================================
  // ENDPOINTS DE TEST
  // ===================================================================

  async testDashboard(): Promise<{
    message: string;
    version: string;
    user: { id: string; email: string; role: string };
    features: string[];
  }> {
    try {
      const response = await this.api.get('/dashboard/test', { timeout: 10000 });
      return response.data;
    } catch (error) {
      return this.handleError(error, 'testDashboard');
    }
  }
}

// ===================================================================
// EXPORT
// ===================================================================

export const dashboardService = new DashboardService();
export default dashboardService;

export const checkDashboardHealth = async (): Promise<boolean> => {
  try {
    await dashboardService.testDashboard();
    return true;
  } catch {
    return false;
  }
};