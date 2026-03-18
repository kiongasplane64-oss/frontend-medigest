// types/inventory.types.ts

// =========================================================
// TYPES DE BASE
// =========================================================

export type ID = string | number;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'over_stock';
export type ExpiryStatus = 'valid' | 'warning' | 'critical' | 'expired';
export type MovementType =
  | 'purchase'
  | 'sale'
  | 'transfer_in'
  | 'transfer_out'
  | 'inventory_adjustment'
  | 'return'
  | 'damage'
  | 'loss'
  | 'manual_adjustment';

export type TransferStatus = 'pending' | 'shipped' | 'received' | 'cancelled' | 'in_transit' | 'completed';

export type BillingCurrency = 'CDF' | 'USD' | 'EUR';
export type InventoryViewMode = 'grid' | 'list';

// =========================================================
// FORMATS D'EXPORT
// =========================================================

export type ExportFormat = 'excel' | 'csv' | 'pdf';

export const ExportFormat = {
  EXCEL: 'excel' as ExportFormat,
  CSV: 'csv' as ExportFormat,
  PDF: 'pdf' as ExportFormat,
} as const;

// =========================================================
// UTILITAIRES
// =========================================================

export interface OptionItem {
  label: string;
  value: string;
}

export interface InventoryDashboardCard {
  title: string;
  value: string | number;
  subtitle?: string;
  tone?: 'blue' | 'green' | 'amber' | 'red' | 'violet';
}

// =========================================================
// EMPLACEMENTS
// =========================================================

export interface Location {
  id: string;
  name: string;
  description?: string;
  product_count?: number;
  created_at?: string;
}

// =========================================================
// CATÉGORIES
// =========================================================

export interface Category {
  id: ID;
  name: string;
  description?: string;
  product_count?: number;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryStats {
  category: string;
  product_count: number;
  total_quantity: number;
  total_purchase_value: number;
  total_selling_value: number;
  total_margin: number;
  average_margin: number;
}

// =========================================================
// PRODUITS
// =========================================================

export interface TopProduct {
  id: ID;
  name: string;
  code: string;
  barcode?: string;
  quantity: number;
  value: number;
  sales?: number;
  margin?: number;
}

export interface Product {
  id: ID;
  code: string;
  name: string;
  commercial_name?: string;
  description?: string;

  category?: string | Category;
  category_id?: ID;

  purchase_price: number;
  selling_price: number;

  quantity: number;
  available_quantity: number;
  reserved_quantity: number;

  alert_threshold: number;
  minimum_stock?: number;
  maximum_stock?: number;

  expiry_date?: string | null;

  supplier?: string;
  main_supplier?: string;
  supplier_id?: ID;

  location?: string;
  barcode?: string;

  laboratory?: string;
  galenic_form?: string;
  dci?: string;
  active_ingredient?: string;
  unit?: string;

  has_tva: boolean;
  tva_rate: number;

  is_active: boolean;
  is_available: boolean;

  stock_status: StockStatus;
  expiry_status: ExpiryStatus;

  total_sold: number;
  last_sale_date?: string | null;
  last_adjustment_date?: string | null;

  created_at: string;
  updated_at: string;

  days_until_expiry?: number;

  purchase_value: number;
  selling_value: number;
  total_margin: number;
  margin_rate: number;

  image_url?: string | null;
  notes?: string | null;
}

export interface ProductCreate {
  code: string;
  name: string;
  commercial_name?: string;
  description?: string;
  category?: string;
  category_id?: ID;
  purchase_price: number;
  selling_price: number;
  quantity?: number;
  available_quantity?: number;
  reserved_quantity?: number;
  alert_threshold?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  expiry_date?: string;
  supplier?: string;
  main_supplier?: string;
  supplier_id?: ID;
  location?: string;
  barcode?: string;
  laboratory?: string;
  galenic_form?: string;
  dci?: string;
  active_ingredient?: string;
  unit?: string;
  has_tva?: boolean;
  tva_rate?: number;
  is_active?: boolean;
  is_available?: boolean;
  image_url?: string;
  notes?: string;
}

export interface ProductUpdate {
  code?: string;
  name?: string;
  commercial_name?: string;
  description?: string;
  category?: string;
  category_id?: ID;
  purchase_price?: number;
  selling_price?: number;
  quantity?: number;
  available_quantity?: number;
  reserved_quantity?: number;
  alert_threshold?: number;
  minimum_stock?: number;
  maximum_stock?: number;
  expiry_date?: string | null;
  supplier?: string;
  main_supplier?: string;
  supplier_id?: ID;
  location?: string;
  barcode?: string;
  laboratory?: string;
  galenic_form?: string;
  dci?: string;
  active_ingredient?: string;
  unit?: string;
  has_tva?: boolean;
  tva_rate?: number;
  is_active?: boolean;
  is_available?: boolean;
  image_url?: string | null;
  notes?: string | null;
}

export interface ProductFormInitialValues {
  code?: string;
  barcode?: string;
  name?: string;
  commercial_name?: string;
  description?: string;
  category?: string;
  supplier?: string;
  location?: string;
  laboratory?: string;
  purchase_price?: number;
  selling_price?: number;
  quantity?: number;
  alert_threshold?: number;
  expiry_date?: string;
}

export interface ProductSearch {
  query?: string;
  search?: string;
  category?: string;
  supplier?: string;
  stock_status?: StockStatus | string;
  expiry_status?: ExpiryStatus | string;
  barcode?: string;
  code?: string;
  min_price?: number;
  max_price?: number;
  min_quantity?: number;
  max_quantity?: number;
  expiry_before?: string;
  expiry_after?: string;
  has_tva?: boolean;
  is_active?: boolean;
  is_available?: boolean;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface ProductListResponse {
  total: number;
  page: number;
  limit: number;
  products: Product[];
  summary?: {
    total_value_purchase: number;
    total_value_selling: number;
    total_profit: number;
    total_products?: number;
    out_of_stock?: number;
    low_stock?: number;
    expired_soon?: number;
  };
}

export interface StockSummary {
  total_products: number;
  total_value_purchase: number;
  total_value_selling: number;
  out_of_stock: number;
  low_stock: number;
  expired_soon: number;
}

export interface ProductMergeRequest {
  target_product_id: string;
  source_product_ids: string[];
  keep_attributes?: string[];
  merge_strategy?: 'sum' | 'average' | 'max' | 'min' | 'keep_main';
  expiry_strategy?: 'earliest' | 'latest' | 'keep_main';
}

// =========================================================
// STATISTIQUES ET ALERTES
// =========================================================

export interface StockStats {
  total_products: number;
  total_quantity: number;
  total_value_purchase: number;
  total_value_selling: number;
  total_margin: number;
  total_profit_potential?: number;
  average_margin: number;
  average_margin_rate?: number;
  low_stock_count: number;
  out_of_stock_count: number;
  over_stock_count?: number;
  expired_count: number;
  expiring_soon_count: number;
  low_stock_threshold?: number;
  category_breakdown?: CategoryStats[];
  top_products?: TopProduct[];
}

export interface InventoryAlertItem {
  id: ID;
  name: string;
  code?: string;
  barcode?: string;
  qty?: number;
  quantity?: number;
  min?: number;
  min_stock?: number;
  expiry?: string | null;
  expiry_date?: string | null;
  category?: string;
  location?: string;
}

export interface InventoryAlertsResponse {
  success?: boolean;
  subscription_active?: boolean;
  has_subscription?: boolean;
  access_mode?: 'full' | 'read_only';
  is_read_only?: boolean;
  low_stock_count: number;
  expiring_soon_count: number;
  expired_count: number;
  alerts: {
    low_stock: InventoryAlertItem[];
    expiring_soon: InventoryAlertItem[];
    expired: InventoryAlertItem[];
  };
  low_stock?: StockAlert[];
  expiring_soon?: ExpiryAlert[];
  expired?: ExpiryAlert[];
  restrictions?: {
    can_view: boolean;
    can_create: boolean;
    can_update: boolean;
    can_delete: boolean;
    can_export?: boolean;
    max_items_visible?: number | null;
  } | null;
}

export interface StockAlert {
  product_id: string;
  product_name: string;
  current_stock: number;
  threshold: number;
  type: 'low_stock' | 'out_of_stock';
  created_at: string;
}

export interface ExpiryAlert {
  product_id: string;
  product_name: string;
  expiry_date: string;
  days_remaining: number;
  type: 'expiring_soon' | 'expired';
  created_at: string;
}

// =========================================================
// MOUVEMENTS DE STOCK
// =========================================================

export interface StockMovement {
  id: ID;
  product_id: ID;
  product_name?: string;
  product_code?: string;
  movement_type: MovementType;
  type?: 'in' | 'out' | 'adjustment' | 'return' | 'transfer';
  reason?: string;
  reference_number?: string;
  reference?: string;
  quantity_before: number;
  quantity_after: number;
  quantity_change: number;
  previous_quantity?: number;
  new_quantity?: number;
  quantity?: number;
  unit_cost?: number;
  total_value?: number;
  notes?: string;
  source_location?: string;
  destination_location?: string;
  created_by?: ID;
  created_by_name?: string;
  user_id?: string;
  user_name?: string;
  tenant_id?: ID;
  created_at: string;
  updated_at?: string;
}

export interface StockMovementCreate {
  product_id: ID;
  movement_type?: MovementType;
  type?: 'in' | 'out' | 'adjustment' | 'return';
  quantity_change: number;
  quantity?: number;
  reason?: string;
  reference_number?: string;
  reference?: string;
  notes?: string;
  source_location?: string;
  destination_location?: string;
  unit_cost?: number;
}

export interface StockMovementListResponse {
  total: number;
  page: number;
  limit: number;
  movements: StockMovement[];
}

// =========================================================
// AJUSTEMENTS ET INVENTAIRES
// =========================================================

export interface StockAdjustment {
  product_id: ID;
  new_quantity: number;
  reason: string;
  notes?: string;
}

export interface InventoryCount {
  product_id: ID;
  counted_quantity: number;
  notes?: string;
}

// =========================================================
// ACHATS ET APPROVISIONNEMENTS
// =========================================================

export interface PurchaseItem {
  product_id?: ID;
  code?: string;
  barcode?: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  purchase_price?: number;
  selling_price?: number;
  expiry_date?: string;
  batch_number?: string;
  location?: string;
  has_tva?: boolean;
  tva_rate?: number;
}

export interface Purchase {
  id: ID;
  supplier?: string;
  invoice_number?: string;
  purchase_date: string;
  total_amount: number;
  currency?: BillingCurrency;
  notes?: string;
  items: PurchaseItem[];
  status: 'pending' | 'approved' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  user_id?: string;
}

export interface PurchaseCreate {
  supplier?: string;
  invoice_number?: string;
  purchase_date?: string;
  total_amount?: number;
  currency?: BillingCurrency;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
  }[];
}

export interface RestockRequest {
  product_id: ID;
  quantity: number;
  purchase_price?: number;
  selling_price?: number;
  supplier?: string;
  invoice_number?: string;
  expiry_date?: string;
  batch_number?: string;
  location?: string;
  notes?: string;
}

// =========================================================
// TRANSFERTS DE STOCK
// =========================================================

export interface StockTransfer {
  id: ID;
  product_id: ID;
  product_name?: string;
  product_code?: string;
  quantity: number;
  from_location: string;
  to_location: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
  created_by?: ID;
  approved_by?: ID;
  user_id?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string | null;
}

export interface StockTransferCreate {
  product_id: ID;
  quantity: number;
  from_location: string;
  to_location: string;
  notes?: string;
}

export interface StockTransferUpdate {
  quantity?: number;
  from_location?: string;
  to_location?: string;
  status?: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  notes?: string;
}

export interface Transfers {
  id: ID;
  reference?: string;
  product_id?: string;
  product_name?: string;
  product_code?: string;
  quantity: number;
  source_depot?: string;
  destination_depot?: string;
  from_location?: string;
  to_location?: string;
  date_transfert?: string;
  status: TransferStatus;
  items_count?: number;
  notes?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TransfersResponse {
  data: Transfers[];
  total: number;
  page: number;
  limit: number;
}

export interface PricingUpdate {
  product_id: string;
  purchase_price?: number;
  selling_price?: number;
  received_qty?: number;
  sale_price?: string;
}

// =========================================================
// FUSION / DÉDUPLICATION
// =========================================================

export interface DuplicateGroup {
  products: Product[];
  similarity: number;
}

export interface DuplicatesResponse {
  groups: Array<{
    similarity: number;
    products: Product[];
  }>;
  total_groups: number;
  total_duplicates: number;
  similarity_threshold?: number;
}

// =========================================================
// IMPORT / EXPORT
// =========================================================

export interface BulkImportResult {
  success: boolean;
  message?: string;
  imported_count: number;
  updated_count: number;
  skipped?: number;
  created?: number;
  updated?: number;
  failed_count: number;
  errors?: Array<{
    row?: number;
    field?: string;
    message: string;
  }>;
}

export interface ExportRequest {
  format: ExportFormat;
  search?: string;
  category?: string;
  supplier?: string;
  stock_status?: string;
  expiry_status?: string;
}

export interface ExportResponse {
  success: boolean;
  message: string;
  file_url?: string;
  filename?: string;
}

// =========================================================
// RÉPONSES API
// =========================================================

export interface ApiResponse<T> {
  status?: string;
  success?: boolean;
  message: string;
  data?: T;
  product?: T;
  products?: T[];
  total?: number;
  page?: number;
  limit?: number;
  errors?: string[];
}

export interface PaginatedApiResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  items?: T[];
}

export interface DeleteResponse {
  success: boolean;
  message: string;
  deleted_id?: string;
}

// =========================================================
// ENUMS (pour compatibilité)
// =========================================================

export enum ExportFormatEnum {
  EXCEL = 'excel',
  CSV = 'csv',
  PDF = 'pdf'
}

export enum TransferStatusEnum {
  PENDING = 'pending',
  SHIPPED = 'shipped',
  RECEIVED = 'received',
  CANCELLED = 'cancelled'
}

export enum MovementTypeEnum {
  PURCHASE = 'purchase',
  SALE = 'sale',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  INVENTORY_ADJUSTMENT = 'inventory_adjustment',
  RETURN = 'return',
  DAMAGE = 'damage',
  LOSS = 'loss',
  MANUAL_ADJUSTMENT = 'manual_adjustment'
}