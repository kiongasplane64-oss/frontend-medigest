// services/saleService.ts
import api from '@/api/client';
import { PaymentMethod } from './posService';

// ============================================
// TYPES - ALIGNÉS AVEC LE BACKEND
// ============================================

export interface SaleItemCreate {
  product_id: string;
  quantity: number;
  discount_percent?: number;
  product_code?: string;
  batch_number?: string;
  expiry_date?: string;
}

export interface SaleCreate {
  items: SaleItemCreate[];
  payment_method: PaymentMethod | string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  pharmacy_id?: string;
  branch_id?: string;
  is_credit?: boolean;
  credit_due_date?: string;
  global_discount?: number;
  notes?: string;
  invoice_number?: string;
  reference_payment?: string;
  guarantee_deposit?: number;
  guarantor_name?: string;
  guarantor_phone?: string;
}

export interface SaleItemResponse {
  id: string;
  sale_id: string;
  tenant_id: string;
  pharmacy_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  tva_rate: number;
  tva_amount: number;
  subtotal: number;
  total: number;
  batch_number?: string;
  expiry_date?: string;
  created_at: string;
}

export interface SaleResponse {
  id: string;
  reference: string;
  tenant_id: string;
  pharmacy_id: string;
  pharmacy_name?: string;
  pharmacy_code?: string;
  branch_id?: string;
  branch_name?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  created_by: string;
  seller_name: string;
  payment_method: string;
  reference_payment?: string;
  payment_date?: string;
  is_credit: boolean;
  credit_due_date?: string;
  guarantee_deposit: number;
  guarantor_name?: string;
  guarantor_phone?: string;
  global_discount: number;
  notes?: string;
  subtotal: number;
  total_discount: number;
  total_tva: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  invoice_number?: string;
  receipt_number?: string;
  receipt_path?: string;
  invoice_path?: string;
  validated_by?: string;
  validated_at?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  created_at: string;
  updated_at: string;
  items?: SaleItemResponse[];
}

export interface SaleListResponse {
  items: SaleResponse[];
  total: number;
  page: number;
  size: number;
  has_more: boolean;
  page_size?: number;
  pharmacies_summary?: {
    pharmacy_id: string;
    total_sales: number;
    total_amount: number;
  };
}

export interface DailyStatsResponse {
  date?: string;
  total_amount: number;
  sales_count: number;
  average_basket: number;
  items_sold: number;
  top_products: Array<{
    product: string;
    quantity: number;
    amount: number;
  }>;
  by_pharmacy: Array<{
    pharmacy_id: string;
    pharmacy_name: string;
    sales_count: number;
    total_amount: number;
    percentage: number;
  }>;
}

export interface PeriodStats {
  total: number;
  count: number;
  average: number;
}

export interface SaleStatsResponse {
  today: DailyStatsResponse & { date: string };
  week: PeriodStats;
  month: PeriodStats;
  year: PeriodStats;
}

export interface SaleRefundRequest {
  sale_id: string;
  items: Array<{
    product_id: string;
    quantity: number;
    reason: string;
  }>;
  reason: string;
  refund_amount: number;
  branch_id?: string;
}

export interface SaleRefundResponse {
  id: string;
  sale_id: string;
  amount: number;
  reason: string;
  status: string;
  created_at: string;
}

export interface ReceiptData {
  sale: SaleResponse;
  pharmacy_info: {
    name: string;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
    logoUrl?: string;
  };
  currency: string;
  exchange_rate: number;
}

export interface ApiResponse<T = any> {
  success?: boolean;
  message?: string;
  data?: T;
  sale?: T;
  receipt_available?: boolean;
  receipt_url?: string;
  receipt_number?: string;
  pharmacy?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface SaleFilterParams {
  page?: number;
  limit?: number;
  skip?: number;
  status?: string;
  payment_method?: string;
  is_credit?: boolean;
  start_date?: string;
  end_date?: string;
  customer_id?: string;
  seller_id?: string;
  user_id?: string;
  pharmacy_id?: string;
  branch_id?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CreditSaleCreate {
  customer_id: string;
  items: Omit<SaleItemCreate, 'discount_percent'>[];
  due_date: string;
  guarantee_deposit?: number;
  guarantor_name?: string;
  guarantor_phone?: string;
  notes?: string;
  pharmacy_id?: string;
  branch_id?: string;
}

export interface CreditPaymentData {
  amount: number;
  payment_method: string;
  reference_payment?: string;
  notes?: string;
}

export interface PharmacyContext {
  accessible_pharmacies: Array<{
    id: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    is_main: boolean;
    is_active: boolean;
  }>;
  current_pharmacy: {
    id: string;
    name: string;
    code: string;
    address?: string;
    phone?: string;
    is_main: boolean;
    is_active: boolean;
  } | null;
  can_switch: boolean;
}

// ============================================
// SERVICE
// ============================================

class SaleService {
  private baseUrl = '/sales';

  /**
   * Crée une nouvelle vente
   */
  async createSale(data: SaleCreate): Promise<ApiResponse<SaleResponse>> {
    try {
      const response = await api.post(`${this.baseUrl}/`, data);
      const responseData = response.data;
      
      if (responseData && typeof responseData === 'object') {
        if (responseData.sale && !responseData.receipt_number) {
          const saleData = responseData.sale as Record<string, unknown>;
          if (saleData.receipt_number) {
            responseData.receipt_number = saleData.receipt_number as string;
          }
        }
        if (responseData.data && !responseData.receipt_number) {
          const dataObj = responseData.data as Record<string, unknown>;
          if (dataObj.receipt_number) {
            responseData.receipt_number = dataObj.receipt_number as string;
          }
        }
      }
      
      return responseData;
    } catch (error: any) {
      console.error('Erreur création vente:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère la liste des ventes avec filtres
   */
  async getSales(params?: SaleFilterParams): Promise<SaleListResponse> {
    try {
      const response = await api.get(`${this.baseUrl}`, { params });
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération ventes:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère les détails d'une vente
   */
  async getSale(id: string): Promise<SaleResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/${id}`);
      const data = response.data;
      
      if (data && typeof data === 'object' && 'sale' in data) {
        return data.sale as SaleResponse;
      }
      
      // Si la réponse a une structure SaleDetailResponse, extraire les champs
      if (data && typeof data === 'object' && 'id' in data) {
        return {
          id: data.id,
          reference: data.reference,
          tenant_id: data.tenant_id,
          pharmacy_id: data.pharmacy_id,
          pharmacy_name: data.pharmacy_name,
          branch_id: data.branch_id,
          branch_name: data.branch_name,
          customer_id: data.customer_id,
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          created_by: data.created_by,
          seller_name: data.seller_name,
          payment_method: data.payment_method,
          reference_payment: data.reference_payment,
          payment_date: data.payment_date,
          is_credit: data.is_credit,
          credit_due_date: data.credit_due_date,
          guarantee_deposit: data.guarantee_deposit,
          guarantor_name: data.guarantor_name,
          guarantor_phone: data.guarantor_phone,
          global_discount: data.global_discount,
          notes: data.notes,
          subtotal: data.subtotal,
          total_discount: data.total_discount,
          total_tva: data.total_tva,
          total_amount: data.total_amount,
          status: data.status,
          invoice_number: data.invoice_number,
          receipt_path: data.receipt_path,
          invoice_path: data.invoice_path,
          validated_by: data.validated_by,
          validated_at: data.validated_at,
          cancelled_by: data.cancelled_by,
          cancelled_at: data.cancelled_at,
          cancel_reason: data.cancel_reason,
          created_at: data.created_at,
          updated_at: data.updated_at,
          items: data.items
        };
      }
      
      return data as SaleResponse;
    } catch (error: any) {
      console.error('Erreur récupération vente:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère les statistiques quotidiennes
   * Appelée par posService.loadDailyStats()
   */
  async getDailyStats(params?: {
    date?: string;
    pharmacy_id?: string;
    branch_id?: string;
  }): Promise<DailyStatsResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/daily`, { params });
      const data = response.data;
      
      // Normaliser la réponse quel que soit le format
      return {
        date: data?.date || new Date().toISOString().split('T')[0],
        total_amount: data?.total_amount ?? data?.total ?? 0,
        sales_count: data?.sales_count ?? data?.count ?? 0,
        average_basket: data?.average_basket ?? data?.average ?? 0,
        items_sold: data?.items_sold ?? data?.itemsCount ?? 0,
        top_products: data?.top_products ?? [],
        by_pharmacy: data?.by_pharmacy ?? [],
      };
    } catch (error: any) {
      console.error('Erreur récupération stats quotidiennes:', error);
      // Retourner des valeurs par défaut pour ne pas bloquer l'UI
      return {
        date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        sales_count: 0,
        average_basket: 0,
        items_sold: 0,
        top_products: [],
        by_pharmacy: [],
      };
    }
  }

  /**
   * Récupère les statistiques globales
   */
  async getStats(params?: {
    start_date?: string;
    end_date?: string;
    pharmacy_id?: string;
    branch_id?: string;
  }): Promise<SaleStatsResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/overview`, { params });
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération stats:', error);
      const defaultDaily: DailyStatsResponse = {
        date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        sales_count: 0,
        average_basket: 0,
        items_sold: 0,
        top_products: [],
        by_pharmacy: [],
      };
      return {
        today: { ...defaultDaily, date: new Date().toISOString().split('T')[0] },
        week: { total: 0, count: 0, average: 0 },
        month: { total: 0, count: 0, average: 0 },
        year: { total: 0, count: 0, average: 0 },
      };
    }
  }

  /**
   * Annule une vente
   */
  async cancelSale(id: string, reason: string): Promise<ApiResponse<SaleResponse>> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/cancel`, null, {
        params: { cancel_reason: reason }
      });
      return response.data;
    } catch (error: any) {
      console.error('Erreur annulation vente:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Valide une vente (pour les crédits)
   */
  async validateSale(id: string, notes?: string): Promise<ApiResponse<SaleResponse>> {
    try {
      const response = await api.post(`${this.baseUrl}/${id}/validate`, { validator_notes: notes });
      return response.data;
    } catch (error: any) {
      console.error('Erreur validation vente:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Rembourse une vente
   */
  async refundSale(data: SaleRefundRequest): Promise<ApiResponse<SaleRefundResponse>> {
    try {
      const response = await api.post(`${this.baseUrl}/refund`, data);
      return response.data;
    } catch (error: any) {
      console.error('Erreur remboursement vente:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Génère un reçu PDF
   */
  async generateReceipt(saleId: string): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseUrl}/${saleId}/receipt`, {
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Erreur génération reçu:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Envoie un reçu par email
   */
  async sendReceiptByEmail(saleId: string, email: string): Promise<ApiResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/${saleId}/send-receipt`, { email });
      return response.data;
    } catch (error: any) {
      console.error('Erreur envoi reçu par email:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Envoie un reçu par SMS
   */
  async sendReceiptBySMS(saleId: string, phone: string): Promise<ApiResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/${saleId}/send-sms`, { phone });
      return response.data;
    } catch (error: any) {
      console.error('Erreur envoi reçu par SMS:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Exporte les ventes
   */
  async exportSales(params?: {
    format: 'excel' | 'csv' | 'pdf';
    start_date?: string;
    end_date?: string;
    pharmacy_id?: string;
    branch_id?: string;
    status?: string;
  }): Promise<Blob> {
    try {
      const response = await api.get(`${this.baseUrl}/export`, {
        params,
        responseType: 'blob'
      });
      return response.data;
    } catch (error: any) {
      console.error('Erreur export ventes:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère le contexte des pharmacies
   */
  async getPharmacyContext(): Promise<PharmacyContext> {
    try {
      const response = await api.get(`${this.baseUrl}/pharmacy/context`);
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération contexte pharmacie:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Change la pharmacie active
   */
  async switchPharmacy(pharmacyId: string): Promise<{
    message: string;
    pharmacy: {
      id: string;
      name: string;
      code: string;
      is_main: boolean;
      address?: string;
    };
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/pharmacy/switch/${pharmacyId}`);
      return response.data;
    } catch (error: any) {
      console.error('Erreur changement pharmacie:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Crée une vente rapide
   */
  async quickSale(data: {
    product_id: string;
    quantity: number;
    payment_method: string;
    customer_name?: string;
    customer_phone?: string;
    pharmacy_id?: string;
    branch_id?: string;
  }): Promise<ApiResponse<SaleResponse>> {
    try {
      const response = await api.post(`${this.baseUrl}/quick`, data);
      return response.data;
    } catch (error: any) {
      console.error('Erreur vente rapide:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Crée une vente à crédit
   */
  async createCreditSale(data: CreditSaleCreate): Promise<ApiResponse<SaleResponse>> {
    try {
      const response = await api.post(`${this.baseUrl}/credit`, data);
      return response.data;
    } catch (error: any) {
      console.error('Erreur vente à crédit:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère les ventes à crédit
   */
  async getCreditSales(params?: {
    customer_id?: string;
    status?: 'pending' | 'partial' | 'paid' | 'overdue';
    due_before?: string;
    due_after?: string;
    pharmacy_id?: string;
    branch_id?: string;
  }): Promise<SaleListResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/credit`, { params });
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération ventes à crédit:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Enregistre un paiement pour une vente à crédit
   */
  async recordCreditPayment(
    saleId: string,
    data: CreditPaymentData
  ): Promise<ApiResponse> {
    try {
      const response = await api.post(`${this.baseUrl}/${saleId}/credit-payment`, data);
      return response.data;
    } catch (error: any) {
      console.error('Erreur enregistrement paiement crédit:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Récupère le prochain numéro de facture disponible
   */
  async getNextInvoiceNumber(params?: {
    pharmacy_id?: string;
    branch_id?: string;
  }): Promise<{
    invoice_number: string;
    sequence_number: number;
    date: string;
    pharmacy_id: string;
    tenant_id?: string;
    unique: boolean;
  }> {
    try {
      const response = await api.get(`${this.baseUrl}/next-invoice-number`, { params });
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération prochain numéro facture:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Confirme l'utilisation d'un numéro de facture
   */
  async confirmInvoiceNumber(data: {
    invoice_number: string;
    pharmacy_id: string;
  }): Promise<{
    success: boolean;
    invoice_number: string;
    new_sequence: number;
    pharmacy_id: string;
    date: string;
  }> {
    try {
      const response = await api.post(`${this.baseUrl}/confirm-invoice-number`, data);
      return response.data;
    } catch (error: any) {
      console.error('Erreur confirmation numéro facture:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Extrait le numéro de reçu d'une réponse API
   */
  extractReceiptNumber(response: ApiResponse<SaleResponse>): string | undefined {
    if (!response) return undefined;
    
    if (response.receipt_number) return response.receipt_number;
    
    if (response.sale?.receipt_number) return response.sale.receipt_number;
    
    if (response.data?.receipt_number) return response.data.receipt_number;
    
    if (response.data && typeof response.data === 'object' && 'sale' in response.data) {
      const dataWithSale = response.data as { sale: SaleResponse };
      if (dataWithSale.sale.receipt_number) {
        return dataWithSale.sale.receipt_number;
      }
    }
    
    return undefined;
  }

  /**
   * Gère les erreurs API
   */
  private handleError(error: any): Error {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (typeof detail === 'string') {
        return new Error(detail);
      }
      if (typeof detail === 'object' && detail.message) {
        return new Error(detail.message);
      }
    }
    return new Error(error.message || 'Erreur lors de l\'opération');
  }
}

export const saleService = new SaleService();
export default SaleService;