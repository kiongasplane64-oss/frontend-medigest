// types/inventory.types.ts

// =========================================================
// TYPES DE BASE
// =========================================================

export type ID = string; // Utiliser string uniquement pour éviter les incohérences

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
  | 'manual_adjustment'
  | 'initial'
  | 'import';

export type TransferStatus = 'pending' | 'shipped' | 'received' | 'cancelled' | 'in_transit' | 'completed';

export type BillingCurrency = 'CDF' | 'USD' | 'EUR';
export type InventoryViewMode = 'grid' | 'list';
export type SalesType = 'wholesale' | 'retail' | 'both';

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
  icon?: string;
  color?: string;
  product_count?: number;
  is_active?: boolean;
  parent_id?: ID | null;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryCreate {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active?: boolean;
  parent_id?: ID | null;
}

export interface CategoryUpdate {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active?: boolean;
  parent_id?: ID | null;
}

export interface CategoryResponse {
  id: ID;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  is_active: boolean;
  parent_id?: ID | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryListResponse {
  total: number;
  skip: number;
  limit: number;
  categories: CategoryResponse[];
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
  selling_price_wholesale?: number;  // AJOUTÉ : prix de vente en gros
  selling_price_retail?: number;     // AJOUTÉ : prix de vente au détail

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
  batch_number?: string;  // AJOUTÉ : numéro de lot

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
  
  pharmacy_id?: string;  // AJOUTÉ : ID de la pharmacie
  branch_id?: string;    // AJOUTÉ : ID de la succursale
}

export interface ProductCreate {
  code: string;
  name: string;
  commercial_name?: string;
  description?: string;
  category?: string;
  category_id?: ID;
  purchase_price: number;
  selling_price?: number;
  selling_price_wholesale?: number;  // AJOUTÉ : prix de vente en gros
  selling_price_retail?: number;     // AJOUTÉ : prix de vente au détail
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
  batch_number?: string;  // AJOUTÉ : numéro de lot
  has_tva?: boolean;
  tva_rate?: number;
  is_active?: boolean;
  is_available?: boolean;
  image_url?: string;
  notes?: string;
  pharmacy_id?: string;
  branch_id?: string;
  calcul_auto_prix?: boolean;
  marge_par_defaut?: number;
  sales_type?: 'wholesale' | 'retail' | 'both';
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
  selling_price_wholesale?: number;  // AJOUTÉ : prix de vente en gros
  selling_price_retail?: number;     // AJOUTÉ : prix de vente au détail
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
  batch_number?: string;  // AJOUTÉ : numéro de lot
  has_tva?: boolean;
  tva_rate?: number;
  is_active?: boolean;
  is_available?: boolean;
  image_url?: string | null;
  notes?: string | null;
  pharmacy_id?: string;
  branch_id?: string;
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
  selling_price_wholesale?: number;  // AJOUTÉ
  selling_price_retail?: number;     // AJOUTÉ
  quantity?: number;
  alert_threshold?: number;
  expiry_date?: string;
  pharmacy_id?: string;  // AJOUTÉ
}

export interface ProductSearch {
  query?: string;
  search?: string;
  category?: string;
  category_id?: string;
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
  skip?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  product_type?: string;
  branch_id?: string;
  pharmacy_id?: string;
  include_sales_stats?: boolean;
  location?: string;  // AJOUTÉ : filtre par emplacement
}

export interface ProductListResponse {
  total: number;
  page: number;
  limit: number;
  products: Product[];
  summary?: {
    total_products?: number;
    total_value_purchase: number;
    total_value_selling: number;
    total_profit: number;
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
  total_purchase_value: number;
  total_selling_value: number;
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
  unit?: string; 
  branch_id?: string;
  pharmacy_id?: string; 
}

export interface ExpiryAlert {
  product_id: string;
  product_name: string;
  expiry_date: string;
  days_remaining: number;
  days_until_expiry?: number; 
  type: 'expiring_soon' | 'expired';
  created_at: string;
  branch_id?: string;
  pharmacy_id?: string;
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
  pharmacy_id?: ID;
  branch_id?: ID;
  batch_number?: string;
  cost_price?: number;
  selling_price?: number;
  sale_id?: ID;
  sale_item_id?: ID;
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
  pharmacy_id?: ID;
  branch_id?: ID;
  batch_number?: string;
}

export interface StockMovementListResponse {
  total: number;
  page: number;
  limit: number;
  movements: StockMovement[];
}

export interface StockMovementResponse {
  id: ID;
  product_id: ID;
  product_name: string;
  product_code: string;
  pharmacy_id: ID;
  quantity_before: number;
  quantity_after: number;
  quantity_change: number;
  movement_type: string;
  reason: string;
  reference?: string;
  batch_number?: string;
  cost_price?: number;
  selling_price?: number;
  sale_id?: ID;
  sale_item_id?: ID;
  created_at: string;
  created_by?: ID;
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
  id: ID;
  tenant_id: ID;
  count_number: string;
  count_date: string;
  location?: string;
  total_products: number;
  counted_products: number;
  discrepancies: number;
  theoretical_value: number;
  actual_value: number;
  difference_value: number;
  status: 'pending' | 'in_progress' | 'completed' | 'validated' | 'cancelled';
  created_by: ID;
  validated_by?: ID;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  validated_at?: string;
  notes?: string;
  progress_percentage?: number;
  difference_percentage?: number;
}

export interface InventoryCountCreate {
  count_date?: string;
  location?: string;
  notes?: string;
}

export interface InventoryCountItem {
  id: ID;
  inventory_count_id: ID;
  product_id: ID;
  product_code?: string;
  product_name?: string;
  theoretical_quantity: number;
  actual_quantity: number;
  quantity_difference: number;
  unit_price: number;
  theoretical_value: number;
  actual_value: number;
  value_difference: number;
  batch_number?: string;
  location?: string;
  status: 'pending' | 'counted' | 'validated';
  comments?: string;
  counted_at?: string;
  validated_at?: string;
  has_discrepancy: boolean;
  discrepancy_percentage: number;
}

export interface InventoryCountComplete {
  inventory_id: ID;
  validate_changes: boolean;
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
// STATISTIQUES AVANCÉES
// =========================================================

export interface StockTurnover {
  average_turnover_rate: number;
  period_days: number;
  products: Array<{
    product_id: string;
    product_name: string;
    product_code: string;
    total_sold: number;
    avg_inventory: number;
    turnover_rate: number;
  }>;
}

export interface StockValuation {
  total_purchase_value: number;
  total_selling_value: number;
  total_profit: number;
  valuation_method?: string;
}

export interface ReorderSuggestion {
  product_id: string;
  product_name: string;
  product_code: string;
  current_stock: number;
  minimum_stock: number;
  daily_consumption: number;
  suggested_order: number;
  priority: 'high' | 'medium' | 'low';
}

export interface SalesImpactResponse {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  total_sold: number;
  total_revenue: number;
  sale_count: number;
  average_price: number;
  current_stock?: number;
  alert_threshold?: number;
  stock_status?: string;
  stock_value?: number;
  stock_impact?: number;
}

export interface ProductSalesStats {
  product_id: string;
  product_name: string;
  product_code: string;
  total_sold: number;
  total_revenue: number;
  sale_count: number;
  average_quantity_per_sale: number;
  daily_average: number;
  weekly_average: number;
  monthly_average: number;
  stock_turnover_rate: number;
  forecast: Array<{
    period_days: number;
    forecast_quantity: number;
    confidence: string;
  }>;
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
// TYPES POUR L'IMPORT AVEC PRÉVISUALISATION
// =========================================================

export interface ImportPreviewProduct {
  // Identifiants
  id?: string;
  code?: string;
  barcode?: string;
  
  // Informations de base
  name: string;
  generic_name?: string;
  description?: string;
  
  // Catégorie
  category_id?: string;
  category_name?: string;
  location?: string;
  
  // Prix et coûts
  purchase_price: number;
  selling_price: number;
  selling_price_wholesale?: number;  // AJOUTÉ
  selling_price_retail?: number;     // AJOUTÉ
  wholesale_price?: number;
  
  // Stock
  current_stock: number;
  min_stock: number;
  max_stock?: number;
  reorder_point?: number;
  reorder_quantity?: number;
  
  // Informations pharmaceutiques
  manufacturer?: string;
  supplier?: string;
  dosage_form?: string;
  strength?: string;
  prescription_required?: boolean;
  
  // Dates
  expiry_date?: string;
  manufacturing_date?: string;
  
  // Statut
  status?: 'active' | 'inactive' | 'discontinued';
  is_active?: boolean;
  
  // Métadonnées d'import
  row_index?: number;
  validation_errors?: string[];
  is_duplicate?: boolean;
  duplicate_reason?: string;
  existing_product_id?: string;
  existing_product_code?: string;
  changes_detected?: {
    field: string;
    old_value: any;
    new_value: any;
  }[];
  
  // Pour compatibilité avec l'ancien type
  existingProduct?: Product | null;
  action?: 'update' | 'merge_quantity' | 'keep_both' | 'skip';
}

export interface ImportPreviewResponse {
  // Produits à importer
  products: ImportPreviewProduct[];
  
  // Doublons détectés
  duplicates: ImportPreviewProduct[];
  
  // Nouveaux produits (non existants)
  newProducts: ImportPreviewProduct[];
  
  // Résumé de la prévisualisation
  summary: {
    total_products: number;
    new_products_count: number;
    duplicates_count: number;
    errors_count: number;
    categories_missing: string[];
    manufacturers_missing: string[];
    suppliers_missing: string[];
  };
  
  // En-têtes du fichier importé
  headers?: string[];
  
  // Version du template
  template_version?: string;
}

export interface ImportValidationResult {
  valid: boolean;
  errors: Array<{
    row: number;
    field: string;
    message: string;
    value: any;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
    value: any;
  }>;
  summary: {
    total_rows: number;
    valid_rows: number;
    error_rows: number;
    warning_rows: number;
  };
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
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  INITIAL = 'initial',
  IMPORT = 'import'
}

// =========================================================
// CONFIGURATION
// =========================================================

export interface PharmacyConfig {
  currencies?: Array<{
    code: string;
    symbol: string;
    isActive: boolean;
    exchangeRate: number;
  }>;
  primaryCurrency?: string;
  taxRate?: number;
  lowStockThreshold?: number;
  expiryWarningDays?: number;
  allowNegativeStock?: boolean;
  
  // AJOUTÉ : type de vente configuré pour la pharmacie
  salesType?: SalesType;
  
  workingHours?: {
    enabled: boolean;
    startTime: string;
    endTime: string;
    overtimeEndTime?: string;
    daysOff: Record<string, boolean>;
    timezone?: string;
  };
  marginConfig?: {
    defaultMargin: number;
    minMargin: number;
    maxMargin: number;
  };
  automaticPricing?: {
    enabled: boolean;
    method: 'percentage' | 'coefficient' | 'margin';
    value: number;
  };
  productReturnDays?: number;
  theme?: string;
  pharmacyInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
    logoUrl?: string;
  };
  calcul_auto_prix?: boolean;
  marge_par_defaut?: number;
  taux_tva?: number;
  lock_stock_modification?: boolean;
}

// Ajouter ces interfaces

export interface BranchStockOverview {
  pharmacy: {
    id: string;
    name: string;
  };
  total_branches: number;
  total_overall: {
    total_products: number;
    total_quantity: number;
    total_value: number;
    out_of_stock: number;
    low_stock: number;
    expired: number;
    expiring_soon: number;
  };
  branches: Array<{
    branch: {
      id: string;
      name: string;
      code: string;
      is_main_branch: boolean;
    };
    stats: {
      total_products: number;
      total_quantity: number;
      total_purchase_value: number;
      total_selling_value: number;
      out_of_stock: number;
      low_stock: number;
      expired: number;
      expiring_soon: number;
    };
    products: Product[];
  }>;
}

export interface BranchStockDashboard {
  pharmacy: {
    id: string;
    name: string;
  };
  branches: Array<{
    branch: {
      id: string;
      name: string;
      code: string;
    };
    stock_stats: {
      total_products: number;
      total_quantity: number;
      total_value: number;
      out_of_stock: number;
      low_stock: number;
    };
    sales_stats: {
      last_30_days_sold: number;
      last_30_days_revenue: number;
    };
    turnover_rate: number;
  }>;
  comparison: {
    best_selling_branch: string | null;
    highest_value_branch: string | null;
    lowest_stock_branch: string | null;
  };
}

export interface BranchTransferRequest {
  product_id: string;
  quantity: number;
  from_branch_id: string;
  to_branch_id: string;
  reason?: string;
}