// services/saleService.ts
import api from '@/api/client';
import { PaymentMethod } from './posService';

// ============================================
// TYPES
// ============================================

export interface SaleItemCreate {
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tva_rate?: number;
  batch_number?: string;
  expiry_date?: string;
}

export interface SaleCreate {
  items: SaleItemCreate[];
  total_amount: number;
  payment_method: PaymentMethod | string;
  client_id?: string;
  client_name?: string;
  client_phone?: string;
  pharmacy_id?: string;
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
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tva_rate: number;
  subtotal: number;
  discount_amount: number;
  tva_amount: number;
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
  client_id?: string;
  client_name?: string;
  client_phone?: string;
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
  pharmacies_summary?: {
    pharmacy_id: string;
    total_sales: number;
    total_amount: number;
  };
}

export interface DailyStatsResponse {
  date: string;
  sales_count: number;
  total_amount: number;
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

export interface SaleStatsResponse {
  today: DailyStatsResponse;
  week: {
    total: number;
    count: number;
    average: number;
  };
  month: {
    total: number;
    count: number;
    average: number;
  };
  year: {
    total: number;
    count: number;
    average: number;
  };
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
      
      // Normaliser la réponse pour avoir toujours receipt_number
      if (responseData && typeof responseData === 'object') {
        // Vérifier si la réponse a un champ sale
        if (responseData.sale && !responseData.receipt_number) {
          // Accéder directement à receipt_number avec une assertion de type
          const saleData = responseData.sale as Record<string, unknown>;
          if (saleData.receipt_number) {
            responseData.receipt_number = saleData.receipt_number as string;
          }
        }
        // Vérifier si la réponse a un champ data
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
  async getSales(params?: {
    page?: number;
    limit?: number;
    status?: string;
    payment_method?: string;
    is_credit?: boolean;
    start_date?: string;
    end_date?: string;
    client_id?: string;
    seller_id?: string;
    pharmacy_id?: string;
    search?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }): Promise<SaleListResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/`, { params });
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
      
      // La réponse peut être directement l'objet vente ou avoir une propriété sale
      if (data && typeof data === 'object' && 'sale' in data) {
        return data.sale as SaleResponse;
      }
      
      // Sinon, retourner directement les données
      return data as SaleResponse;
    } catch (error: any) {
      console.error('Erreur récupération vente:', error);
      throw this.handleError(error);
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
   * Récupère les statistiques quotidiennes
   */
  async getDailyStats(params?: {
    date?: string;
    pharmacy_id?: string;
  }): Promise<DailyStatsResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/daily`, { params });
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération stats quotidiennes:', error);
      // Retourner des valeurs par défaut en cas d'erreur
      return {
        date: params?.date || new Date().toISOString().split('T')[0],
        sales_count: 0,
        total_amount: 0,
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
  }): Promise<SaleStatsResponse> {
    try {
      const response = await api.get(`${this.baseUrl}/stats/overview`, { params });
      return response.data;
    } catch (error: any) {
      console.error('Erreur récupération stats:', error);
      // Retourner des valeurs par défaut en mode offline
      const today = new Date().toISOString().split('T')[0];
      const defaultStats: DailyStatsResponse = {
        date: today,
        sales_count: 0,
        total_amount: 0,
        average_basket: 0,
        items_sold: 0,
        top_products: [],
        by_pharmacy: [],
      };
      return {
        today: defaultStats,
        week: { total: 0, count: 0, average: 0 },
        month: { total: 0, count: 0, average: 0 },
        year: { total: 0, count: 0, average: 0 },
      };
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
  async getPharmacyContext(): Promise<{
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
  }> {
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
   * Crée une vente rapide (sans vérification détaillée)
   */
  async quickSale(data: {
    product_id: string;
    quantity: number;
    price?: number;
    payment_method: string;
    client_name?: string;
    client_phone?: string;
    pharmacy_id?: string;
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
  async createCreditSale(data: {
    client_id: string;
    items: SaleItemCreate[];
    total_amount: number;
    due_date: string;
    guarantee_deposit?: number;
    guarantor_name?: string;
    guarantor_phone?: string;
    notes?: string;
    pharmacy_id?: string;
  }): Promise<ApiResponse<SaleResponse>> {
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
    client_id?: string;
    status?: 'pending' | 'partial' | 'paid' | 'overdue';
    due_before?: string;
    due_after?: string;
    pharmacy_id?: string;
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
    data: {
      amount: number;
      payment_method: string;
      reference_payment?: string;
      notes?: string;
    }
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
   * Extrait le numéro de reçu d'une réponse API
   */
  extractReceiptNumber(response: ApiResponse<SaleResponse>): string | undefined {
    if (!response) return undefined;
    
    // Vérifier dans receipt_number direct
    if (response.receipt_number) return response.receipt_number;
    
    // Vérifier dans sale (si c'est un ApiResponse)
    if (response.sale?.receipt_number) return response.sale.receipt_number;
    
    // Vérifier dans data
    if (response.data?.receipt_number) return response.data.receipt_number;
    
    // Vérifier si data a une propriété sale
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

// Export d'une instance unique
export const saleService = new SaleService();

// Export également la classe
export default SaleService;