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
  ProductSalesStats
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
  // GESTION DES PRODUITS
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
  // CATÉGORIES - Utilisation du type Category
  // =========================================================

  async getCategories(params?: { skip?: number; limit?: number; parent_id?: string }): Promise<CategoryListResponse> {
    try {
      const response = await api.get(`${this.categoriesUrl}`, {
        params: this.cleanParams(params),
      });
      const data = response.data as CategoryListResponse;
      
      // Mettre en cache les catégories pour utilisation ultérieure
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
      // Invalider le cache
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
      // Invalider le cache
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
      // Invalider le cache
      this.categoriesCache = null;
      return response.data;
    } catch (error) {
      console.error(`Erreur suppression catégorie ${id}:`, error);
      throw error;
    }
  }

  /**
   * Récupère les catégories depuis le cache ou l'API
   */
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
      // Invalider le cache des transferts
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
  // STATISTIQUES ET ALERTES - Utilisation des types StockAlert et ExpiryAlert
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
      
      // Transformer les données en type StockAlert
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
      
      // Transformer les données en type ExpiryAlert
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
  // TRANSFERTS - Utilisation du type Transfers
  // =========================================================

  /**
   * Récupère la liste des transferts
   */
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
      
      // Normaliser la réponse en tableau de Transfers
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
      
      // Mettre en cache
      this.transfersCache = transfers;
      return transfers;
    } catch (error) {
      console.error('Erreur récupération transferts:', error);
      return [];
    }
  }

  /**
   * Récupère les transferts depuis le cache
   */
  async getCachedTransfers(): Promise<Transfers[]> {
    if (this.transfersCache) {
      return this.transfersCache;
    }
    return this.getTransfers();
  }

  /**
   * Récupère les transferts avec pagination
   */
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

  // =========================================================
  // EXPORT / IMPORT
  // =========================================================

  async exportStock(format: ExportFormat = 'csv', pharmacy_id?: string, category_id?: string): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseUrl}/export`, {
        params: this.cleanParams({ format, pharmacy_id, category_id }),
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Erreur export stock:', error);
      throw error;
    }
  }

  async getImportTemplate(): Promise<{ template: string[] }> {
    try {
      const response = await api.get(`${this.baseUrl}/template`);
      return response.data;
    } catch (error) {
      console.error('Erreur récupération template import:', error);
      return { template: [] };
    }
  }

  async importProducts(file: File, mode: 'add' | 'replace' | 'update' = 'add'): Promise<BulkImportResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post(`${this.baseUrl}/import`, formData, {
        params: { import_mode: mode },
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      return response.data;
    } catch (error) {
      console.error('Erreur import produits:', error);
      throw error;
    }
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

  /**
   * Récupère la configuration d'une pharmacie pour les calculs de prix
   */
  async getPharmacyConfig(pharmacy_id?: string): Promise<{
    calcul_auto_prix: boolean;
    marge_par_defaut: number;
    taux_tva: number;
    lock_stock_modification: boolean;
  }> {
    try {
      // Utiliser pharmacy_id pour récupérer la configuration spécifique
      console.log(`Récupération configuration pour pharmacie: ${pharmacy_id || 'par défaut'}`);
      
      return {
        calcul_auto_prix: true,
        marge_par_defaut: 30,
        taux_tva: 0,
        lock_stock_modification: false,
      };
    } catch (error) {
      console.error('Erreur récupération configuration:', error);
      return {
        calcul_auto_prix: true,
        marge_par_defaut: 30,
        taux_tva: 0,
        lock_stock_modification: false,
      };
    }
  }
}

// Export d'une instance unique
export const inventoryService = new InventoryService();

// Export également la classe pour pouvoir créer des instances si nécessaire
export default InventoryService;