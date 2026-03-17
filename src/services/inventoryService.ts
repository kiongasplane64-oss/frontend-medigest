import api from '@/api/client';
import type {
  ApiResponse,
  BulkImportResult,
  Category,
  CategoryStats,
  DeleteResponse,
  ExpiryAlert,
  ExportFormat,
  InventoryAlertsResponse,
  InventoryCount,
  PaginatedApiResponse,
  Product,
  ProductCreate,
  ProductListResponse,
  ProductMergeRequest,
  ProductSearch,
  ProductUpdate,
  Purchase,
  PurchaseCreate,
  RestockRequest,
  StockAdjustment,
  StockAlert,
  StockMovement,
  StockMovementCreate,
  StockMovementListResponse,
  StockStats,
  StockTransfer,
  StockTransferCreate,
  StockTransferUpdate,
} from '@/types/inventory.types';

class InventoryService {
  private stockBaseUrl = '/stock';
  private inventoryBaseUrl = '/inventory';

  // =========================================================
  // HELPERS
  // =========================================================

  private cleanParams<T extends Record<string, unknown>>(params?: T): Partial<T> | undefined {
    if (!params) return undefined;

    const cleaned = Object.fromEntries(
      Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
    ) as Partial<T>;

    return Object.keys(cleaned).length > 0 ? cleaned : undefined;
  }

  private normalizeProductListResponse(data: unknown): ProductListResponse {
    if (Array.isArray(data)) {
      return {
        total: data.length,
        page: 1,
        limit: data.length,
        products: data as Product[],
      };
    }

    const response = data as Partial<ProductListResponse> | undefined;

    return {
      total: Number(response?.total ?? response?.products?.length ?? 0),
      page: Number(response?.page ?? 1),
      limit: Number(response?.limit ?? response?.products?.length ?? 0),
      products: Array.isArray(response?.products) ? response!.products : [],
      summary: response?.summary,
    };
  }

  private resolveApiPayload<T>(data: unknown): T {
    const response = data as ApiResponse<T> | T;
    if (response && typeof response === 'object' && 'data' in (response as Record<string, unknown>)) {
      return (response as ApiResponse<T>).data as T;
    }
    if (response && typeof response === 'object' && 'product' in (response as Record<string, unknown>)) {
      return (response as ApiResponse<T>).product as T;
    }
    return response as T;
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
  // GESTION DES PRODUITS
  // =========================================================

  async getProducts(params?: {
    skip?: number;
    limit?: number;
    page?: number;
    search?: string;
    query?: string;
    category?: string;
    supplier?: string;
    stock_status?: string;
    expiry_status?: string;
    barcode?: string;
    code?: string;
    is_active?: boolean;
  }): Promise<ProductListResponse> {
    const response = await api.get(`${this.stockBaseUrl}/`, {
      params: this.cleanParams(params),
    });

    return this.normalizeProductListResponse(response.data);
  }

  async getProduct(id: string): Promise<Product> {
    const response = await api.get(`${this.stockBaseUrl}/${id}`);
    return this.resolveApiPayload<Product>(response.data);
  }

  async createProduct(data: ProductCreate): Promise<ApiResponse<Product>> {
    const response = await api.post(`${this.stockBaseUrl}/`, data);
    return response.data;
  }

  async updateProduct(id: string, data: ProductUpdate): Promise<ApiResponse<Product>> {
    const response = await api.put(`${this.stockBaseUrl}/${id}`, data);
    return response.data;
  }

  async patchProduct(id: string, data: ProductUpdate): Promise<ApiResponse<Product>> {
    const response = await api.patch(`${this.stockBaseUrl}/${id}`, data);
    return response.data;
  }

  async deleteProduct(id: string): Promise<DeleteResponse | { message: string; product_id: string }> {
    const response = await api.delete(`${this.stockBaseUrl}/${id}`);
    return response.data;
  }

  async activateProduct(id: string): Promise<ApiResponse<Product>> {
    const response = await api.post(`${this.stockBaseUrl}/${id}/activate`);
    return response.data;
  }

  async deactivateProduct(id: string): Promise<ApiResponse<Product>> {
    const response = await api.post(`${this.stockBaseUrl}/${id}/deactivate`);
    return response.data;
  }

  // =========================================================
  // CATÉGORIES
  // =========================================================

  async getCategories(): Promise<Category[]> {
    try {
      const response = await api.get(`${this.stockBaseUrl}/categories`);
      const data = response.data;

      if (Array.isArray(data)) return data as Category[];
      if (Array.isArray(data?.categories)) return data.categories as Category[];

      return [];
    } catch {
      return [];
    }
  }

  async getCategoryStats(): Promise<{ categories: CategoryStats[] }> {
    const response = await api.get(`${this.stockBaseUrl}/stats/categories`);
    return response.data;
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
    const response = await api.post(`${this.stockBaseUrl}/adjust`, adjustment);
    return response.data;
  }

  async inventoryCount(count: InventoryCount): Promise<{
    message: string;
    product: Product;
    inventory: {
      counted_quantity: number;
      system_quantity: number;
      difference: number;
      notes?: string;
    };
  }> {
    const response = await api.post(`${this.stockBaseUrl}/inventory/count`, count);
    return response.data;
  }

  async restockProduct(payload: RestockRequest): Promise<ApiResponse<Product>> {
    const response = await api.post(`${this.stockBaseUrl}/restock`, payload);
    return response.data;
  }

  // =========================================================
  // STATISTIQUES ET ALERTES
  // =========================================================

  async getStats(): Promise<StockStats> {
    const response = await api.get(`${this.stockBaseUrl}/stats/overview`);
    return response.data;
  }

  async getStockAlerts(): Promise<StockAlert> {
    const response = await api.get(`${this.stockBaseUrl}/alerts/stock`);
    return response.data;
  }

  async getExpiryAlerts(days: number = 30): Promise<ExpiryAlert> {
    const response = await api.get(`${this.stockBaseUrl}/alerts/expiry`, {
      params: { days },
    });
    return response.data;
  }

  async getAlerts(): Promise<InventoryAlertsResponse> {
    const response = await api.get(`${this.inventoryBaseUrl}/alerts`);
    return response.data;
  }

  async analyzeStockValue(): Promise<unknown> {
    const response = await api.get(`${this.stockBaseUrl}/analysis/value`);
    return response.data;
  }

  async analyzeABC(): Promise<unknown> {
    const response = await api.get(`${this.stockBaseUrl}/analysis/abc`);
    return response.data;
  }

  // =========================================================
  // MOUVEMENTS DE STOCK
  // =========================================================

  async getMovements(params?: {
    page?: number;
    limit?: number;
    product_id?: string;
    movement_type?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<StockMovementListResponse | PaginatedApiResponse<StockMovement>> {
    const response = await api.get(`${this.stockBaseUrl}/movements`, {
      params: this.cleanParams(params),
    });
    return response.data;
  }

  async createMovement(data: StockMovementCreate): Promise<ApiResponse<StockMovement>> {
    const response = await api.post(`${this.stockBaseUrl}/movements`, data);
    return response.data;
  }

  async getProductMovements(productId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<StockMovementListResponse | PaginatedApiResponse<StockMovement>> {
    const response = await api.get(`${this.stockBaseUrl}/${productId}/movements`, {
      params: this.cleanParams(params),
    });
    return response.data;
  }

  // =========================================================
  // TRANSFERTS DE STOCK
  // =========================================================

  async getTransfers(params?: {
    page?: number;
    limit?: number;
    status?: string;
    product_id?: string;
  }): Promise<PaginatedApiResponse<StockTransfer> | { transfers: StockTransfer[] }> {
    const response = await api.get(`${this.stockBaseUrl}/transfers`, {
      params: this.cleanParams(params),
    });
    return response.data;
  }

  async createTransfer(data: StockTransferCreate): Promise<ApiResponse<StockTransfer>> {
    const response = await api.post(`${this.stockBaseUrl}/transfers`, data);
    return response.data;
  }

  async updateTransfer(id: string, data: StockTransferUpdate): Promise<ApiResponse<StockTransfer>> {
    const response = await api.put(`${this.stockBaseUrl}/transfers/${id}`, data);
    return response.data;
  }

  async completeTransfer(id: string): Promise<ApiResponse<StockTransfer>> {
    const response = await api.post(`${this.stockBaseUrl}/transfers/${id}/complete`);
    return response.data;
  }

  async cancelTransfer(id: string): Promise<ApiResponse<StockTransfer>> {
    const response = await api.post(`${this.stockBaseUrl}/transfers/${id}/cancel`);
    return response.data;
  }

  // =========================================================
  // ACHATS / APPROVISIONNEMENTS
  // =========================================================

  async getPurchases(params?: {
    page?: number;
    limit?: number;
    supplier?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<PaginatedApiResponse<Purchase> | { purchases: Purchase[] }> {
    const response = await api.get(`${this.stockBaseUrl}/purchases`, {
      params: this.cleanParams(params),
    });
    return response.data;
  }

  async createPurchase(data: PurchaseCreate): Promise<ApiResponse<Purchase>> {
    const response = await api.post(`${this.stockBaseUrl}/purchases`, data);
    return response.data;
  }

  async approvePurchase(id: string): Promise<ApiResponse<Purchase>> {
    const response = await api.post(`${this.stockBaseUrl}/purchases/${id}/approve`);
    return response.data;
  }

  // =========================================================
  // FUSION / DÉDUPLICATION
  // =========================================================

  async mergeProducts(request: ProductMergeRequest): Promise<{
    message: string;
    merged_product: Product;
    merged_details: unknown;
  }> {
    const response = await api.post(`${this.stockBaseUrl}/merge`, request);
    return response.data;
  }

  async findDuplicates(similarity_threshold: number = 0.8): Promise<{
    duplicates: unknown[];
    total_groups: number;
    similarity_threshold: number;
  }> {
    const response = await api.get(`${this.stockBaseUrl}/duplicates`, {
      params: { similarity_threshold },
    });
    return response.data;
  }

  // =========================================================
  // EXPORT / IMPORT
  // =========================================================

  async exportStock(
    format: ExportFormat = 'excel',
    search?: ProductSearch,
  ): Promise<Blob> {
    const response = await api.post(
      `${this.stockBaseUrl}/export`,
      { search },
      {
        params: { export_format: format },
        responseType: 'blob',
      },
    );
    return response.data;
  }

  async exportInventory(
    format: ExportFormat = 'excel',
    filters?: ProductSearch,
  ): Promise<Blob> {
    return this.exportStock(format, filters);
  }

  async getImportTemplate(format: ExportFormat = 'excel'): Promise<Blob> {
    const response = await api.post(
      `${this.stockBaseUrl}/import/template`,
      {},
      {
        params: { export_format: format },
        responseType: 'blob',
      },
    );
    return response.data;
  }

  async importProducts(
    file: File,
    mode: 'add' | 'replace' | 'update' = 'add',
  ): Promise<BulkImportResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post(`${this.stockBaseUrl}/import`, formData, {
      params: { import_mode: mode },
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return response.data;
  }

  // =========================================================
  // RECHERCHE
  // =========================================================

  async advancedSearch(
    search: ProductSearch,
    skip: number = 0,
    limit: number = 100,
  ): Promise<ProductListResponse> {
    const response = await api.post(`${this.stockBaseUrl}/search/advanced`, search, {
      params: { skip, limit },
    });

    return this.normalizeProductListResponse(response.data);
  }

  async searchByBarcode(barcode: string): Promise<Product> {
    const response = await api.get(`${this.stockBaseUrl}/barcode/${barcode}`);
    return this.resolveApiPayload<Product>(response.data);
  }

  async searchByCode(code: string): Promise<Product> {
    const response = await api.get(`${this.stockBaseUrl}/code/${code}`);
    return this.resolveApiPayload<Product>(response.data);
  }

  async findProductByCodeOrBarcode(value: string): Promise<Product | null> {
    if (!value?.trim()) return null;

    try {
      return await this.searchByBarcode(value.trim());
    } catch {
      try {
        return await this.searchByCode(value.trim());
      } catch {
        return null;
      }
    }
  }

  // =========================================================
  // INVENTAIRE PHYSIQUE
  // =========================================================

  async getInventoryAlerts(): Promise<InventoryAlertsResponse> {
    const response = await api.get(`${this.inventoryBaseUrl}/alerts`);
    return response.data;
  }

  async getInventorySummary(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<Record<string, unknown>> {
    const response = await api.get(`${this.inventoryBaseUrl}/stats/summary`, {
      params: this.cleanParams(params),
    });
    return response.data;
  }

  // =========================================================
  // UTILITAIRES
  // =========================================================

  async testConnection(): Promise<{ message: string; version: string }> {
    const response = await api.get(`${this.stockBaseUrl}/test`);
    return response.data;
  }

  async getHealth(): Promise<Record<string, unknown>> {
    const response = await api.get('/health');
    return response.data;
  }
}

export const inventoryService = new InventoryService();