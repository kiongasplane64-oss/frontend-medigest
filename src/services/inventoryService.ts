// services/inventoryService.ts
import api from '@/api/client';
import type {
  Product,
  ProductCreate,
  ProductUpdate,
  ProductListResponse,
  ProductSearch,
  StockStats,
  StockAlert,
  ExpiryAlert,
  StockMovement,
  StockMovementCreate,
  StockMovementListResponse,
  StockAdjustment,
  Category,
  CategoryCreate,
  CategoryUpdate,
  CategoryResponse,
  CategoryListResponse,
  RestockRequest,
  BulkImportResult,
  ExportFormat,
  ApiResponse,
  DeleteResponse,
  Transfers,
  InventoryCount,
  InventoryCountCreate,
  InventoryCountItem,
  StockValuation,
  StockTurnover,
  ReorderSuggestion,
  SalesImpactResponse,
  StockMovementResponse,
  ProductSalesStats,
  ImportPreviewResponse,
  ImportPreviewProduct,
  PharmacyConfig,
  BranchStockOverview,
  BranchStockDashboard,
} from '@/types/inventory.types';

// =========================================================
// TYPES DE PARAMÈTRES
// =========================================================

interface ProductListParams extends Record<string, unknown> {
  skip?: number;
  limit?: number;
  search?: string;
  category_id?: string;
  category?: string;
  stock_status?: string;
  expiry_status?: string;
  product_type?: string;
  min_price?: number;
  max_price?: number;
  include_sales_stats?: boolean;
  branch_id?: string;
  pharmacy_id?: string;
}

interface MovementParams extends Record<string, unknown> {
  skip?: number;
  limit?: number;
  product_id?: string;
  movement_type?: string;
  start_date?: string;
  end_date?: string;
}

interface InventoryCountParams extends Record<string, unknown> {
  skip?: number;
  limit?: number;
  status?: string;
}

interface SalesImpactParams extends Record<string, unknown> {
  product_id?: string;
  pharmacy_id?: string;
  start_date?: string;
  end_date?: string;
  include_stock_info?: boolean;
}

interface BranchTransferParams {
  product_id: string;
  quantity: number;
  from_branch_id: string;
  to_branch_id: string;
  reason?: string;
}

// =========================================================
// CLASSE PRINCIPALE
// =========================================================

class InventoryService {
  private baseUrl = '/stock';
  private categoriesUrl = '/stock/categories';
  private inventoryUrl = '/stock/inventory-counts';

  // Cache pour les catégories et transferts
  private categoriesCache: Category[] | null = null;
  private transfersCache: Transfers[] | null = null;

  // =========================================================
  // HELPERS PRIVÉS
  // =========================================================

  private cleanParams<T extends Record<string, unknown>>(params?: T): Record<string, unknown> | undefined {
    if (!params) return undefined;

    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    );

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  private normalizeProductListResponse(data: unknown): ProductListResponse {
    if (Array.isArray(data)) {
      return {
        total: data.length,
        page: 1,
        limit: data.length,
        products: data as Product[],
        summary: {
          total_products: data.length,
          total_value_purchase: 0,
          total_value_selling: 0,
          total_profit: 0,
          out_of_stock: 0,
          low_stock: 0,
          expired_soon: 0,
        },
      };
    }

    const response = data as Record<string, unknown>;

    if (response.products && Array.isArray(response.products)) {
      const summary = response.summary as ProductListResponse['summary'];
      return {
        total: Number(response.total ?? response.products.length),
        page: Number(response.page ?? 1),
        limit: Number(response.limit ?? response.products.length),
        products: response.products as Product[],
        summary: summary || {
          total_products: response.products.length,
          total_value_purchase: 0,
          total_value_selling: 0,
          total_profit: 0,
          out_of_stock: 0,
          low_stock: 0,
          expired_soon: 0,
        },
      };
    }

    return {
      total: 0,
      page: 1,
      limit: 0,
      products: [],
      summary: {
        total_products: 0,
        total_value_purchase: 0,
        total_value_selling: 0,
        total_profit: 0,
        out_of_stock: 0,
        low_stock: 0,
        expired_soon: 0,
      },
    };
  }

  private resolveApiPayload<T>(data: unknown): T {
    const response = data as ApiResponse<T> | T;
    
    if (response && typeof response === 'object') {
      const obj = response as Record<string, unknown>;
      
      if ('data' in obj) {
        return obj.data as T;
      }
      if ('product' in obj) {
        return obj.product as T;
      }
      if ('products' in obj) {
        return obj.products as T;
      }
    }
    
    return response as T;
  }

  // =========================================================
  // GESTION DES PRODUITS (AVEC FILTRAGE PAR BRANCHE)
  // =========================================================

  async getProducts(params?: ProductListParams): Promise<ProductListResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/`, {
        params: this.cleanParams(params),
      });
      return this.normalizeProductListResponse(response.data);
    } catch (error) {
      console.error('Erreur récupération produits:', error);
      throw error;
    }
  }

  async getProduct(id: string): Promise<Product> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      return this.resolveApiPayload<Product>(response.data);
    } catch (error) {
      console.error(`Erreur récupération produit ${id}:`, error);
      throw error;
    }
  }

  async createProduct(data: ProductCreate): Promise<ApiResponse<Product>> {
    try {
      const response = await api.post(`${this.baseUrl}/`, data);
      return response.data;
    } catch (error) {
      console.error('Erreur création produit:', error);
      throw error;
    }
  }

  async updateProduct(id: string, data: ProductUpdate): Promise<ApiResponse<Product>> {
    try {
      const response = await api.put(`${this.baseUrl}/${id}`, data);
      return response.data;
    } catch (error) {
      console.error(`Erreur mise à jour produit ${id}:`, error);
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<DeleteResponse> {
    try {
      const response = await api.delete(`${this.baseUrl}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur suppression produit ${id}:`, error);
      throw error;
    }
  }

  // =========================================================
  // GESTION DU STOCK PAR BRANCHE (NOUVEAUX ENDPOINTS)
  // =========================================================

  /**
   * Vue d'ensemble du stock par branche
   */
  async getBranchesStockOverview(): Promise<BranchStockOverview> {
    try {
      const response = await api.get(`${this.baseUrl}/branches-stock-overview`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération vue d\'ensemble stock par branche:', error);
      throw error;
    }
  }

  /**
   * Tableau de bord comparatif du stock par branche
   */
  async getBranchStockDashboard(): Promise<BranchStockDashboard> {
    try {
      const response = await api.get(`${this.baseUrl}/branch-stock-dashboard`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération tableau de bord stock par branche:', error);
      throw error;
    }
  }

  /**
   * Récupérer le stock d'une branche spécifique
   */
  async getStockByBranch(
  branchId: string, 
  params?: {
    skip?: number;
    limit?: number;
    search?: string;
    category_id?: string;
  }
): Promise<{
  branch: { id: string; name: string; code: string; parent_pharmacy_id?: string };
  exchange_rate: number;
  primary_currency: string;
  stats: {
    total_products: number;
    total_quantity: number;
    total_value_cdf: number;
    total_value_usd: number;
    out_of_stock: number;
    low_stock: number;
  };
  total: number;
  skip: number;
  limit: number;
  products: Product[];
}> {
  try {
    const response = await api.get(`${this.baseUrl}/by-branch/${branchId}`, {
      params: this.cleanParams(params),
    });
    return response.data;
  } catch (error) {
    console.error(`Erreur récupération stock de la branche ${branchId}:`, error);
    throw error;
  }
}

  /**
   * Transférer du stock entre branches
   */
  async transferStockBetweenBranches(params: BranchTransferParams): Promise<{
    message: string;
    product_name: string;
    quantity: number;
    from_branch: string;
    to_branch: string;
    source_remaining_stock: number;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/transfer-between-branches`, null, {
        params: {
          product_id: params.product_id,
          quantity: params.quantity,
          from_branch_id: params.from_branch_id,
          to_branch_id: params.to_branch_id,
          reason: params.reason,
        },
      });
      return response.data;
    } catch (error) {
      console.error('Erreur transfert entre branches:', error);
      throw error;
    }
  }

  /**
   * Exporter le stock par branche
   */
  async exportStockByBranch(format: ExportFormat = 'excel', branchId?: string): Promise<Blob> {
    try {
      const params = this.cleanParams({ format, branch_id: branchId });
      const response = await api.get(`${this.baseUrl}/export-by-branch`, {
        params,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Erreur export stock par branche:', error);
      throw error;
    }
  }

  // =========================================================
  // CATÉGORIES
  // =========================================================

  async getCategories(params?: { skip?: number; limit?: number; parent_id?: string }): Promise<CategoryListResponse> {
    try {
      const response = await api.get(`${this.categoriesUrl}`, {
        params: this.cleanParams(params),
      });
      const data = response.data as CategoryListResponse;
      
      this.categoriesCache = data.categories;
      
      return data;
    } catch (error) {
      console.error('Erreur récupération catégories:', error);
      return { total: 0, skip: 0, limit: 0, categories: [] };
    }
  }

  async getSimpleCategories(): Promise<{ id: string; name: string; parent_id: string | null }[]> {
    try {
      const response = await api.get(`${this.categoriesUrl}/simple`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération catégories simples:', error);
      return [];
    }
  }

  async getCategory(id: string): Promise<CategoryResponse> {
    try {
      const response = await api.get(`${this.categoriesUrl}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur récupération catégorie ${id}:`, error);
      throw error;
    }
  }

  async createCategory(data: CategoryCreate): Promise<CategoryResponse> {
    try {
      const response = await api.post(`${this.categoriesUrl}`, data);
      this.categoriesCache = null;
      return response.data;
    } catch (error) {
      console.error('Erreur création catégorie:', error);
      throw error;
    }
  }

  async updateCategory(id: string, data: CategoryUpdate): Promise<CategoryResponse> {
    try {
      const response = await api.put(`${this.categoriesUrl}/${id}`, data);
      this.categoriesCache = null;
      return response.data;
    } catch (error) {
      console.error(`Erreur mise à jour catégorie ${id}:`, error);
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<DeleteResponse> {
    try {
      const response = await api.delete(`${this.categoriesUrl}/${id}`);
      this.categoriesCache = null;
      return response.data;
    } catch (error) {
      console.error(`Erreur suppression catégorie ${id}:`, error);
      throw error;
    }
  }

  async getCachedCategories(): Promise<Category[]> {
    if (this.categoriesCache) {
      return this.categoriesCache;
    }
    const response = await this.getCategories();
    return response.categories;
  }

  // =========================================================
  // GESTION DU STOCK
  // =========================================================

  async adjustStock(adjustment: StockAdjustment): Promise<{
    message: string;
    product: Product;
    adjustment: {
      old_quantity: number;
      new_quantity: number;
      difference: number;
      reason: string;
      notes?: string;
    };
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/adjust`, adjustment);
      return response.data;
    } catch (error) {
      console.error('Erreur ajustement stock:', error);
      throw error;
    }
  }

  async transferStock(
    product_id: string,
    quantity: number,
    from_pharmacy_id: string,
    to_pharmacy_id: string,
    reason?: string
  ): Promise<{
    message: string;
    product: string;
    quantity: number;
    from_pharmacy: string;
    to_pharmacy: string;
    source_remaining_stock: number;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/transfer`, null, {
        params: {
          product_id,
          quantity,
          from_pharmacy_id,
          to_pharmacy_id,
          reason,
        },
      });
      this.transfersCache = null;
      return response.data;
    } catch (error) {
      console.error('Erreur transfert stock:', error);
      throw error;
    }
  }

  async restockProduct(payload: RestockRequest): Promise<ApiResponse<Product>> {
    try {
      const response = await api.post(`${this.baseUrl}/restock`, payload);
      return response.data;
    } catch (error) {
      console.error('Erreur réapprovisionnement:', error);
      throw error;
    }
  }

  // =========================================================
  // STATISTIQUES ET ALERTES
  // =========================================================

  async getStats(): Promise<StockStats> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/overview`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      throw error;
    }
  }

  async getStockAlerts(): Promise<{
    out_of_stock: StockAlert[];
    low_stock: StockAlert[];
    over_stock: any[];
    counts: {
      out_of_stock: number;
      low_stock: number;
      over_stock: number;
    };
    pharmacy_id?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/alerts/stock`);
      const data = response.data;
      
      const outOfStockAlerts: StockAlert[] = (data.out_of_stock || []).map((alert: any) => ({
        product_id: alert.id,
        product_name: alert.name,
        current_stock: 0,
        threshold: 0,
        type: 'out_of_stock',
        created_at: new Date().toISOString(),
      }));
      
      const lowStockAlerts: StockAlert[] = (data.low_stock || []).map((alert: any) => ({
        product_id: alert.id,
        product_name: alert.name,
        current_stock: alert.current_stock,
        threshold: alert.threshold,
        type: 'low_stock',
        created_at: new Date().toISOString(),
      }));
      
      return {
        out_of_stock: outOfStockAlerts,
        low_stock: lowStockAlerts,
        over_stock: data.over_stock || [],
        counts: {
          out_of_stock: outOfStockAlerts.length,
          low_stock: lowStockAlerts.length,
          over_stock: (data.over_stock || []).length,
        },
        pharmacy_id: data.pharmacy_id,
      };
    } catch (error) {
      console.error('Erreur récupération alertes stock:', error);
      return {
        out_of_stock: [],
        low_stock: [],
        over_stock: [],
        counts: { out_of_stock: 0, low_stock: 0, over_stock: 0 },
      };
    }
  }

  async getExpiryAlerts(days: number = 30): Promise<{
    expired: ExpiryAlert[];
    expiring_soon: ExpiryAlert[];
    counts: {
      expired: number;
      expiring_soon: number;
    };
    days_threshold: number;
    pharmacy_id?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/alerts/expiry`, {
        params: { days },
      });
      const data = response.data;
      
      const expiredAlerts: ExpiryAlert[] = (data.expired || []).map((alert: any) => ({
        product_id: alert.id,
        product_name: alert.name,
        expiry_date: alert.expiry_date,
        days_remaining: alert.days_until_expiry,
        type: 'expired',
        created_at: new Date().toISOString(),
      }));
      
      const expiringSoonAlerts: ExpiryAlert[] = (data.expiring_soon || []).map((alert: any) => ({
        product_id: alert.id,
        product_name: alert.name,
        expiry_date: alert.expiry_date,
        days_remaining: alert.days_until_expiry,
        type: 'expiring_soon',
        created_at: new Date().toISOString(),
      }));
      
      return {
        expired: expiredAlerts,
        expiring_soon: expiringSoonAlerts,
        counts: {
          expired: expiredAlerts.length,
          expiring_soon: expiringSoonAlerts.length,
        },
        days_threshold: data.days_threshold || days,
        pharmacy_id: data.pharmacy_id,
      };
    } catch (error) {
      console.error('Erreur récupération alertes expiration:', error);
      return {
        expired: [],
        expiring_soon: [],
        counts: { expired: 0, expiring_soon: 0 },
        days_threshold: days,
      };
    }
  }

  async getReorderSuggestions(safety_days: number = 30, pharmacy_id?: string): Promise<{
    suggestions: ReorderSuggestion[];
    count: number;
    safety_days: number;
    pharmacy_id?: string;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/reorder-suggestions`, {
        params: this.cleanParams({ safety_days, pharmacy_id }),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération suggestions réapprovisionnement:', error);
      return { suggestions: [], count: 0, safety_days };
    }
  }

  async getStockTurnover(days: number = 365, pharmacy_id?: string): Promise<StockTurnover> {
    try {
      const response = await api.get(`${this.baseUrl}/turnover`, {
        params: this.cleanParams({ days, pharmacy_id }),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération taux rotation:', error);
      return { average_turnover_rate: 0, period_days: days, products: [] };
    }
  }

  async getStockValuation(method: 'purchase' | 'selling' | 'average' = 'purchase', pharmacy_id?: string): Promise<StockValuation> {
    try {
      const response = await api.get(`${this.baseUrl}/valuation`, {
        params: this.cleanParams({ method, pharmacy_id }),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération valeur stock:', error);
      return { total_purchase_value: 0, total_selling_value: 0, total_profit: 0 };
    }
  }

  // =========================================================
  // MOUVEMENTS DE STOCK
  // =========================================================

  async getMovements(params?: MovementParams): Promise<StockMovementListResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/movements`, {
        params: this.cleanParams(params),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération mouvements:', error);
      return { total: 0, page: 1, limit: 0, movements: [] };
    }
  }

  async createMovement(data: StockMovementCreate): Promise<ApiResponse<StockMovement>> {
    try {
      const response = await api.post(`${this.baseUrl}/movements`, data);
      return response.data;
    } catch (error) {
      console.error('Erreur création mouvement:', error);
      throw error;
    }
  }

  // =========================================================
  // COMMUNICATION AVEC LE MODULE VENTES
  // =========================================================

  async getSalesImpact(params?: SalesImpactParams): Promise<SalesImpactResponse[]> {
    try {
      const response = await api.get(`${this.baseUrl}/sales-impact`, {
        params: this.cleanParams(params),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération impact ventes:', error);
      return [];
    }
  }

  async getSalesMovements(
    start_date?: string,
    end_date?: string,
    pharmacy_id?: string,
    product_id?: string,
    limit: number = 100
  ): Promise<StockMovementResponse[]> {
    try {
      const response = await api.get(`${this.baseUrl}/movements/from-sales`, {
        params: this.cleanParams({ start_date, end_date, pharmacy_id, product_id, limit }),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération mouvements ventes:', error);
      return [];
    }
  }

  async getProductSalesStats(
    product_id: string,
    start_date?: string,
    end_date?: string,
    pharmacy_id?: string
  ): Promise<ProductSalesStats> {
    try {
      const response = await api.get(`${this.baseUrl}/product-sales-stats/${product_id}`, {
        params: this.cleanParams({ start_date, end_date, pharmacy_id }),
      });
      return response.data;
    } catch (error) {
      console.error(`Erreur récupération stats ventes produit ${product_id}:`, error);
      throw error;
    }
  }

  // =========================================================
  // INVENTAIRES PHYSIQUES
  // =========================================================

  async getInventoryCounts(params?: InventoryCountParams): Promise<{
    total: number;
    skip: number;
    limit: number;
    inventories: InventoryCount[];
  }> {
    try {
      const response = await api.get(`${this.inventoryUrl}`, {
        params: this.cleanParams(params),
      });
      return response.data;
    } catch (error) {
      console.error('Erreur récupération inventaires:', error);
      return { total: 0, skip: 0, limit: 0, inventories: [] };
    }
  }

  async getInventoryCount(id: string): Promise<InventoryCount> {
    try {
      const response = await api.get(`${this.inventoryUrl}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Erreur récupération inventaire ${id}:`, error);
      throw error;
    }
  }

  async createInventoryCount(data: InventoryCountCreate): Promise<{
    message: string;
    inventory: InventoryCount;
  }> {
    try {
      const response = await api.post(`${this.inventoryUrl}`, data);
      return response.data;
    } catch (error) {
      console.error('Erreur création inventaire:', error);
      throw error;
    }
  }

  async addInventoryItem(
    inventory_id: string,
    product_id: string,
    actual_quantity: number,
    comments?: string
  ): Promise<{
    message: string;
    item: InventoryCountItem;
    has_discrepancy: boolean;
  }> {
    try {
      const response = await api.post(`${this.inventoryUrl}/${inventory_id}/items`, null, {
        params: { product_id, actual_quantity, comments },
      });
      return response.data;
    } catch (error) {
      console.error('Erreur ajout item inventaire:', error);
      throw error;
    }
  }

  async completeInventoryCount(
    inventory_id: string,
    validate_changes: boolean = true
  ): Promise<{
    message: string;
    inventory: InventoryCount;
    adjustments_applied: boolean;
  }> {
    try {
      const response = await api.post(`${this.inventoryUrl}/${inventory_id}/complete`, null, {
        params: { validate_changes },
      });
      return response.data;
    } catch (error) {
      console.error('Erreur finalisation inventaire:', error);
      throw error;
    }
  }

  // =========================================================
  // TRANSFERTS
  // =========================================================

  async getTransfers(params?: {
    skip?: number;
    limit?: number;
    status?: string;
    product_id?: string;
    from_pharmacy?: string;
    to_pharmacy?: string;
  }): Promise<Transfers[]> {
    try {
      const response = await api.get(`${this.baseUrl}/transfers`, {
        params: this.cleanParams(params),
      });
      const data = response.data;
      
      let transfers: Transfers[] = [];
      if (Array.isArray(data)) {
        transfers = data;
      } else if (data && typeof data === 'object') {
        const obj = data as Record<string, unknown>;
        if (obj.data && Array.isArray(obj.data)) {
          transfers = obj.data as Transfers[];
        } else if (obj.transfers && Array.isArray(obj.transfers)) {
          transfers = obj.transfers as Transfers[];
        } else if (obj.items && Array.isArray(obj.items)) {
          transfers = obj.items as Transfers[];
        }
      }
      
      this.transfersCache = transfers;
      return transfers;
    } catch (error) {
      console.error('Erreur récupération transferts:', error);
      return [];
    }
  }

  async getCachedTransfers(): Promise<Transfers[]> {
    if (this.transfersCache) {
      return this.transfersCache;
    }
    return this.getTransfers();
  }

  async getTransfersPaginated(params?: {
    page?: number;
    limit?: number;
    status?: string;
    product_id?: string;
    from_pharmacy?: string;
    to_pharmacy?: string;
  }): Promise<{
    data: Transfers[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const transfers = await this.getTransfers(params);
      const page = params?.page || 1;
      const limit = params?.limit || 10;
      const start = (page - 1) * limit;
      const paginated = transfers.slice(start, start + limit);
      
      return {
        data: paginated,
        total: transfers.length,
        page,
        limit,
      };
    } catch (error) {
      console.error('Erreur récupération transferts paginés:', error);
      return {
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      };
    }
  }

  // services/inventoryService.ts (fonctions corrigées)

// =========================================================
// EXPORT / IMPORT (PARTIE CORRIGÉE)
// =========================================================

async exportStock(format: ExportFormat = 'excel', filters?: {
  pharmacy_id?: string;
  branch_id?: string;
  category_id?: string;
  category?: string;
  search?: string;
  stock_status?: string;
  expiry_status?: string;
  include_sales_stats?: boolean;
}): Promise<Blob> {
  try {
    const params = this.cleanParams({
      format,
      ...filters
    });
    
    const response = await api.get(`${this.baseUrl}/export`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('Erreur export stock:', error);
    throw error;
  }
}

async getImportTemplate(format: 'excel' | 'csv' = 'excel'): Promise<Blob> {
  try {
    const response = await api.get(`${this.baseUrl}/import/template`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  } catch (error) {
    console.error('Erreur récupération template import:', error);
    throw error;
  }
}

async previewImport(file: File): Promise<ImportPreviewResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`${this.baseUrl}/import/preview`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = response.data;
    
    const normalizeNumber = (value: any): number => {
      if (value === undefined || value === null || value === '') return 0;
      const num = typeof value === 'string' ? parseFloat(value) : Number(value);
      return isNaN(num) ? 0 : num;
    };
    
    const products: ImportPreviewProduct[] = (data.products || []).map((p: any) => ({
      name: p.name || '',
      code: p.code || '',
      barcode: p.barcode || '',
      quantity: normalizeNumber(p.quantity),
      purchase_price: normalizeNumber(p.purchase_price),
      selling_price: normalizeNumber(p.selling_price),
      selling_price_wholesale: p.selling_price_wholesale ? normalizeNumber(p.selling_price_wholesale) : undefined,
      selling_price_retail: p.selling_price_retail ? normalizeNumber(p.selling_price_retail) : undefined,
      expiry_date: p.expiry_date || '',
      category: p.category || '',
      location: p.location || '',
      supplier: p.supplier || '',
      batch_number: p.batch_number || '',
      existingProduct: p.existing_product || null,
      action: p.action || 'update'
    }));

    const duplicates: ImportPreviewProduct[] = (data.duplicates || []).map((p: any) => ({
      name: p.name || '',
      code: p.code || '',
      barcode: p.barcode || '',
      quantity: normalizeNumber(p.quantity),
      purchase_price: normalizeNumber(p.purchase_price),
      selling_price: normalizeNumber(p.selling_price),
      selling_price_wholesale: p.selling_price_wholesale ? normalizeNumber(p.selling_price_wholesale) : undefined,
      selling_price_retail: p.selling_price_retail ? normalizeNumber(p.selling_price_retail) : undefined,
      expiry_date: p.expiry_date || '',
      category: p.category || '',
      location: p.location || '',
      supplier: p.supplier || '',
      batch_number: p.batch_number || '',
      existingProduct: p.existing_product || null,
      action: p.action || 'update'
    }));

    const newProducts: ImportPreviewProduct[] = (data.new_products || []).map((p: any) => ({
      name: p.name || '',
      code: p.code || '',
      barcode: p.barcode || '',
      quantity: normalizeNumber(p.quantity),
      purchase_price: normalizeNumber(p.purchase_price),
      selling_price: normalizeNumber(p.selling_price),
      selling_price_wholesale: p.selling_price_wholesale ? normalizeNumber(p.selling_price_wholesale) : undefined,
      selling_price_retail: p.selling_price_retail ? normalizeNumber(p.selling_price_retail) : undefined,
      expiry_date: p.expiry_date || '',
      category: p.category || '',
      location: p.location || '',
      supplier: p.supplier || '',
      batch_number: p.batch_number || '',
      existingProduct: null,
      action: 'create'
    }));

    return {
      products,
      duplicates,
      newProducts,
      summary: {
        total_products: products.length,
        new_products_count: newProducts.length,
        duplicates_count: duplicates.length,
        errors_count: data.skipped_rows || 0,
        categories_missing: data.categories_missing || [],
        manufacturers_missing: data.manufacturers_missing || [],
        suppliers_missing: data.suppliers_missing || []
      },
      headers: data.columns_used || [],
      template_version: data.template_version || '1.0'
    };
  } catch (error) {
    console.error('Erreur preview import:', error);
    throw error;
  }
}

/**
 * Importer des produits depuis un fichier
 * @param formData - FormData contenant le fichier et les options d'import
 *                    Options possibles:
 *                    - file: le fichier à importer
 *                    - mode: 'add' | 'replace' | 'update'
 *                    - duplicate_actions: JSON string des actions pour les doublons
 *                    - preserve_prices: 'true' pour conserver les prix du fichier
 *                    - preserve_quantities: 'true' pour conserver les quantités du fichier
 */
async importProducts(formData: FormData): Promise<BulkImportResult> {
  try {
    const response = await api.post(`${this.baseUrl}/import`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    const data = response.data;
    
    return {
      success: data.success ?? true,
      message: data.message || 'Import terminé',
      imported_count: data.created || data.imported_count || 0,
      updated_count: data.updated || data.updated_count || 0,
      created: data.created || 0,
      updated: data.updated || 0,
      skipped: data.skipped || 0,
      failed_count: data.skipped || data.failed_count || 0,
      errors: data.errors || []
    };
  } catch (error) {
    console.error('Erreur import produits:', error);
    throw error;
  }
}

// Version alternative avec paramètres individuels (pour compatibilité)
async importProductsWithParams(
  file: File, 
  mode: 'add' | 'replace' | 'update' = 'add',
  duplicateActions?: Record<string, string>,
  options?: { preserve_prices?: boolean; preserve_quantities?: boolean }
): Promise<BulkImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', mode);
  
  if (duplicateActions) {
    formData.append('duplicate_actions', JSON.stringify(duplicateActions));
  }
  
  if (options?.preserve_prices) {
    formData.append('preserve_prices', 'true');
  }
  
  if (options?.preserve_quantities) {
    formData.append('preserve_quantities', 'true');
  }
  
  return this.importProducts(formData);
}

  // =========================================================
  // RECHERCHE
  // =========================================================

  async advancedSearch(search: ProductSearch, skip: number = 0, limit: number = 100): Promise<ProductListResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/search/advanced`, search, {
        params: { skip, limit },
      });
      return this.normalizeProductListResponse(response.data);
    } catch (error) {
      console.error('Erreur recherche avancée:', error);
      throw error;
    }
  }

  async searchByBarcode(barcode: string): Promise<Product | null> {
    try {
      const response = await api.get(`${this.baseUrl}/barcode/${barcode}`);
      return this.resolveApiPayload<Product>(response.data);
    } catch (error) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        return null;
      }
      console.error(`Erreur recherche par code-barres ${barcode}:`, error);
      return null;
    }
  }

  async searchByCode(code: string): Promise<Product | null> {
    try {
      const response = await api.get(`${this.baseUrl}/code/${code}`);
      return this.resolveApiPayload<Product>(response.data);
    } catch (error) {
      const err = error as { response?: { status?: number } };
      if (err.response?.status === 404) {
        return null;
      }
      console.error(`Erreur recherche par code ${code}:`, error);
      return null;
    }
  }

  async findProductByCodeOrBarcode(value: string): Promise<Product | null> {
    if (!value?.trim()) return null;

    const trimmed = value.trim();
    
    const productByBarcode = await this.searchByBarcode(trimmed);
    if (productByBarcode) return productByBarcode;
    
    return this.searchByCode(trimmed);
  }

  // Dans inventoryService.ts
async getAllProducts(pharmacy_id: string): Promise<Product[]> {
  const allProducts: Product[] = [];
  let skip = 0;
  const limit = 500;
  let hasMore = true;
  
  while (hasMore) {
    try {
      const response = await this.getProducts({
        pharmacy_id,
        limit,
        skip,
        include_sales_stats: false,
      });
      
      const products = response?.products || [];
      allProducts.push(...products);
      
      hasMore = products.length === limit;
      skip += limit;
      
    } catch (error) {
      console.error('Erreur lors de la récupération paginée:', error);
      break;
    }
  }
  
  return allProducts;
}

  // =========================================================
  // UTILITAIRES
  // =========================================================

  async testConnection(): Promise<{ message: string; version: string; user?: { id: string; email: string; role: string } }> {
    try {
      const response = await api.get(`${this.baseUrl}/test`);
      return response.data;
    } catch (error) {
      console.error('Erreur test connexion:', error);
      throw error;
    }
  }

  async getHealth(): Promise<Record<string, unknown>> {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Erreur récupération health:', error);
      return { status: 'error' };
    }
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  }

  // =========================================================
  // CONFIGURATION ET PARAMÈTRES
  // =========================================================

  async getPharmacyConfig(pharmacy_id?: string): Promise<PharmacyConfig> {
    try {
      const response = await api.get(`/pharmacies/${pharmacy_id || 'current'}/config`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération configuration:', error);
      return {
        primaryCurrency: 'CDF',
        taxRate: 0,
        lowStockThreshold: 10,
        expiryWarningDays: 30,
        calcul_auto_prix: true,
        marge_par_defaut: 30,
        taux_tva: 0,
        lock_stock_modification: false
      };
    }
  }
}

// Export d'une instance unique
export const inventoryService = new InventoryService();

// Export également la classe pour pouvoir créer des instances si nécessaire
export default InventoryService;