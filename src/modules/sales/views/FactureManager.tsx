// modules/sales/views/FactureManager.tsx
import React, { useState, useEffect, useCallback} from 'react';
import {
  Search,
  Eye,
  Printer,
  Download,
  RefreshCw,
  X,
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2,
  Receipt
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import { Toaster } from '@/components/ui/Toaster';
import api from '@/api/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { FacturePrinter } from './FacturePrinter';

// ==================== TYPES ====================

export interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  discount_amount: number;
  subtotal: number;
  total: number;
  tva_rate?: number;
  tva_amount?: number;
  batch_number?: string;
  expiry_date?: string;
}

export interface Sale {
  id: string;
  reference: string;
  invoice_number: string;
  customer_name: string;
  customer_phone?: string;
  customer_id?: string;
  seller_name: string;
  created_by?: string;
  payment_method: string;
  reference_payment?: string;
  subtotal: number;
  total_discount: number;
  total_tva: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  items?: SaleItem[];
  branch_id?: string;
  pharmacy_id?: string;
  pharmacy_name?: string;
  is_credit?: boolean;
  credit_due_date?: string;
  notes?: string;
}

interface SalesListResponse {
  items: Sale[];
  total: number;
  page: number;
  size: number;
  has_more: boolean;
}

interface SaleDetailResponse {
  id: string;
  tenant_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  branch_id: string;
  reference: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  created_by: string;
  seller_name: string;
  created_at: string;
  updated_at: string;
  payment_method: string;
  reference_payment?: string;
  is_credit: boolean;
  credit_due_date?: string;
  guarantee_deposit: number;
  global_discount: number;
  notes?: string;
  subtotal: number;
  total_discount: number;
  total_tva: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled';
  invoice_number: string;
  items: SaleItem[];
}

interface Seller {
  id: string;
  email: string;
  nom_complet?: string;
  name?: string;
  role: string;
  is_active: boolean;
}

interface BranchInfo {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  parent_pharmacy_id?: string;
}

type PeriodType = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';
type MonthType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

interface FilterState {
  period: PeriodType;
  startDate: string;
  endDate: string;
  selectedMonth: MonthType;
  selectedYear: number;
  sellerId: string;
  paymentMethod: string;
  status: string;
}

interface ReturnData {
  saleId: string;
  items: Array<{
    product_id: string;
    quantity: number;
    reason: string;
    condition?: 'new' | 'opened' | 'damaged' | 'expired';
  }>;
  reason: string;
  restocking_fee_percent?: number;
  return_type?: 'customer' | 'supplier' | 'internal';
}

interface ReturnItemCreate {
  product_id: string;
  quantity: number;
  reason: string;
  condition?: string;
  sale_item_id?: string;
  unit_price?: number;
  discount_percent?: number;
}

interface FacturePrinterSaleData {
  id: string;
  receiptNumber: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    code?: string;
    discount_percent?: number;
    discount_amount?: number;
  }>;
  subtotal: number;
  total: number;
  discount_percent: number;
  discount_amount: number;
  paymentMethod: string;
  timestamp: number;
  cashierName: string;
  cashierId?: string;
  posName: string;
  branchId?: string;
  branchName?: string;
  sessionNumber: string;
  customerName?: string;
  pharmacy_id?: string;
}

// ==================== HELPER ====================

const convertToFacturePrinterSale = (sale: Sale | SaleDetailResponse): FacturePrinterSaleData => {
  const timestamp = typeof sale.created_at === 'string' 
    ? new Date(sale.created_at).getTime() 
    : Date.now();
  
  const items = (sale.items || []).map(item => ({
    id: item.id,
    name: item.product_name,
    price: item.unit_price,
    quantity: item.quantity,
    code: item.product_code,
    discount_percent: item.discount_percent,
    discount_amount: item.discount_amount
  }));
  
  const subtotal = sale.subtotal;
  const discountAmount = sale.total_discount;
  const discountPercent = subtotal > 0 ? (discountAmount / subtotal) * 100 : 0;
  
  return {
    id: sale.id,
    receiptNumber: sale.invoice_number || sale.reference,
    items: items,
    subtotal: subtotal,
    total: sale.total_amount,
    discount_percent: discountPercent,
    discount_amount: discountAmount,
    paymentMethod: sale.payment_method,
    timestamp: timestamp,
    cashierName: sale.seller_name,
    cashierId: sale.created_by,
    posName: sale.pharmacy_name || 'Caisse Principale',
    branchId: sale.branch_id,
    branchName: sale.pharmacy_name,
    sessionNumber: `SESS-${new Date(timestamp).toISOString().slice(0, 10)}`,
    customerName: sale.customer_name,
    pharmacy_id: sale.pharmacy_id
  };
};

// ==================== COMPOSANT PRINCIPAL ====================

const FactureManager: React.FC = () => {
  const { toast } = useToast();
  
  // États
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [availableSellers, setAvailableSellers] = useState<Seller[]>([]);
  const [userBranch, setUserBranch] = useState<BranchInfo | null>(null);
  const [branchLoading, setBranchLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [filters, setFilters] = useState<FilterState>({
    period: 'today',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    selectedMonth: (new Date().getMonth() + 1) as MonthType,
    selectedYear: new Date().getFullYear(),
    sellerId: '',
    paymentMethod: '',
    status: ''
  });
  
  const [selectedSale, setSelectedSale] = useState<SaleDetailResponse | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [saleToPrint, setSaleToPrint] = useState<FacturePrinterSaleData | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnData, setReturnData] = useState<ReturnData | null>(null);
  const [returnProcessing, setReturnProcessing] = useState(false);

  // ==================== FONCTIONS API ====================

  const loadUserProfile = useCallback(async () => {
    try {
      const response = await api.get('/users/me/profile');
      return response.data;
    } catch (error) {
      console.error('Erreur chargement profil:', error);
      return null;
    }
  }, []);

  const loadUserBranch = useCallback(async () => {
    setBranchLoading(true);
    try {
      const profile = await loadUserProfile();
      if (!profile) {
        console.error('Impossible de charger le profil');
        setBranchLoading(false);
        return;
      }
      
      const branchId = profile.active_branch_id || profile.branch_id || profile.current_branch_id;
      if (!branchId) {
        toast({ title: "Attention", description: "Aucune branche associée à votre compte", variant: "destructive" });
        setBranchLoading(false);
        return;
      }
      
      const branchResponse = await api.get(`/branches/${branchId}`);
      const branchData = branchResponse.data;
      
      setUserBranch({
        id: branchData.id,
        name: branchData.name,
        code: branchData.code || branchData.name.substring(0, 4).toUpperCase(),
        is_active: branchData.is_active,
        parent_pharmacy_id: branchData.parent_pharmacy_id
      });
    } catch (error: any) {
      console.error('Erreur chargement branche:', error);
      toast({ title: "Erreur", description: "Impossible de charger les informations de votre branche", variant: "destructive" });
    } finally {
      setBranchLoading(false);
    }
  }, [toast, loadUserProfile]);

  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filters.period) {
      case 'today': {
        const dateStr = today.toISOString().split('T')[0];
        return { startDate: dateStr, endDate: dateStr };
      }
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dateStr = yesterday.toISOString().split('T')[0];
        return { startDate: dateStr, endDate: dateStr };
      }
      case 'week': {
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        monday.setDate(today.getDate() - offset);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        return {
          startDate: monday.toISOString().split('T')[0],
          endDate: sunday.toISOString().split('T')[0]
        };
      }
      case 'month': {
        const year = filters.selectedYear;
        const month = filters.selectedMonth;
        const startDate = new Date(year, month - 1, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, month, 0);
        endDate.setHours(23, 59, 59, 999);
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }
      case 'year': {
        const year = filters.selectedYear;
        const startDate = new Date(year, 0, 1);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(year, 11, 31);
        endDate.setHours(23, 59, 59, 999);
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }
      case 'custom': {
        let startDate = filters.startDate;
        let endDate = filters.endDate;
        if (!startDate) startDate = today.toISOString().split('T')[0];
        if (!endDate) endDate = today.toISOString().split('T')[0];
        return { startDate, endDate };
      }
      default: {
        const dateStr = today.toISOString().split('T')[0];
        return { startDate: dateStr, endDate: dateStr };
      }
    }
  }, [filters]);

  const loadSales = useCallback(async () => {
    if (!userBranch?.id) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      
      const params: Record<string, any> = {
        branch_id: userBranch.id,
        skip: (currentPage - 1) * pageSize,
        limit: pageSize,
        start_date: startDate,
        end_date: endDate,
        sort_by: "created_at",
        sort_order: "desc"
      };
      
      if (filters.sellerId) params.user_id = filters.sellerId;
      if (filters.paymentMethod) params.payment_method = filters.paymentMethod;
      if (filters.status) params.status = filters.status;
      if (searchTerm) params.search = searchTerm;
      
      const response = await api.get<SalesListResponse>('/sales', { params });
      const data = response.data;
      
      let items: Sale[] = [];
      let total = 0;
      
      if (data && data.items && Array.isArray(data.items)) {
        items = data.items;
        total = data.total || items.length;
      } else if (Array.isArray(data)) {
        items = data;
        total = items.length;
      }
      
      const salesWithBranch: Sale[] = items.map(sale => ({
        ...sale,
        status: sale.status === 'pending' || sale.status === 'completed' || sale.status === 'cancelled'
          ? sale.status
          : 'completed' as const
      }));
      
      setSales(salesWithBranch);
      setTotalSales(total);
    } catch (error: any) {
      console.error('Erreur chargement ventes:', error);
      let errorMessage = "Impossible de charger les ventes";
      if (error.response?.data?.detail) errorMessage = error.response.data.detail;
      toast({ title: "Erreur", description: errorMessage, variant: "destructive" });
      setSales([]);
      setTotalSales(0);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters, searchTerm, toast, getDateRange, userBranch]);

  const loadAvailableSellers = useCallback(async () => {
    if (!userBranch?.id) return;
    try {
      const { startDate, endDate } = getDateRange();
      const response = await api.get('/sales', {
        params: {
          branch_id: userBranch.id,
          start_date: startDate,
          end_date: endDate,
          group_by_seller: true,
          limit: 1000
        }
      });
      
      if (response.data?.type === 'seller_stats' && response.data.stats) {
        const sellersWithSales = response.data.stats.map((stat: any) => ({
          id: stat.seller_id,
          nom_complet: stat.seller_name,
          email: stat.seller_name,
          role: 'vendeur',
          is_active: true
        }));
        setAvailableSellers(sellersWithSales);
      } else {
        const sellersResponse = await api.get('/users/sellers', { params: { branch_id: userBranch.id } });
        let sellersList: Seller[] = [];
        if (sellersResponse.data?.users && Array.isArray(sellersResponse.data.users)) {
          sellersList = sellersResponse.data.users;
        } else if (sellersResponse.data?.sellers && Array.isArray(sellersResponse.data.sellers)) {
          sellersList = sellersResponse.data.sellers;
        } else if (Array.isArray(sellersResponse.data)) {
          sellersList = sellersResponse.data;
        }
        setAvailableSellers(sellersList);
      }
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
    }
  }, [userBranch, getDateRange]);

  const loadSaleDetails = useCallback(async (saleId: string) => {
    try {
      const response = await api.get<SaleDetailResponse>(`/sales/${saleId}`);
      const data = response.data;
      setSelectedSale({
        ...data,
        items: data.items || [],
        status: data.status === 'pending' || data.status === 'completed' || data.status === 'cancelled'
          ? data.status
          : 'completed'
      });
      setShowDetailModal(true);
    } catch (error: any) {
      toast({ title: "Erreur", description: "Impossible de charger les détails de la vente", variant: "destructive" });
    }
  }, [toast]);

  // ==================== GESTION DES RETOURS ====================

  const handleReturn = useCallback(async () => {
    if (!returnData || !selectedSale || !userBranch?.id) return;
    
    setReturnProcessing(true);
    try {
      const returnItems: ReturnItemCreate[] = (selectedSale.items || [])
        .filter(item => {
          const returnItem = returnData.items.find(i => i.product_id === item.product_id);
          return returnItem ? returnItem.quantity > 0 : false;
        })
        .map(item => {
          const returnItem = returnData.items.find(i => i.product_id === item.product_id);
          return {
            product_id: item.product_id,
            quantity: returnItem?.quantity || item.quantity,
            reason: returnItem?.reason || returnData.reason,
            condition: returnItem?.condition || 'opened',
            sale_item_id: item.id,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
          };
        });

      if (returnItems.length === 0 && returnData.items.length === 0) {
        (selectedSale.items || []).forEach(item => {
          returnItems.push({
            product_id: item.product_id,
            quantity: item.quantity,
            reason: returnData.reason,
            condition: 'opened',
            sale_item_id: item.id,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
          });
        });
      }

      const returnPayload = {
        return_type: returnData.return_type || 'customer',
        reason: returnData.reason,
        sale_id: selectedSale.id,
        invoice_number: selectedSale.invoice_number,
        customer_id: selectedSale.customer_id,
        customer_name: selectedSale.customer_name,
        customer_phone: selectedSale.customer_phone,
        branch_id: userBranch.id,
        items: returnItems,
        restocking_fee_percent: returnData.restocking_fee_percent || 0,
        notes: `Retour depuis FactureManager - ${new Date().toISOString()}`
      };

      const response = await api.post('/returns', returnPayload);
      const createdReturn = response.data;

      if (createdReturn?.return_obj?.id) {
        try {
          await api.put(`/returns/${createdReturn.return_obj.id}/approve`, {
            notes: `Approbation automatique depuis retour de vente`
          });
          
          await api.post(`/returns/${createdReturn.return_obj.id}/process`, {
            restore_stock: true,
            refund_amount: selectedSale.total_amount,
            refund_method: selectedSale.payment_method,
            generate_credit_note: true
          });
          
          toast({
            title: "Succès",
            description: `Le retour de la vente ${selectedSale.invoice_number} a été effectué. Le stock a été restauré.`,
            variant: "success"
          });
        } catch (processError) {
          toast({
            title: "Retour créé",
            description: `La demande de retour a été créée et est en attente de traitement.`,
            variant: "info"
          });
        }
      } else {
        toast({
          title: "Succès",
          description: `Demande de retour créée pour la vente ${selectedSale.invoice_number}`,
          variant: "success"
        });
      }
      
      setShowReturnModal(false);
      setReturnData(null);
      setSelectedSale(null);
      await loadSales();
    } catch (error: any) {
      console.error('Erreur création retour:', error);
      let errorMessage = "Impossible de créer la demande de retour";
      if (error.response?.data?.detail) errorMessage = error.response.data.detail;
      toast({ title: "Erreur", description: errorMessage, variant: "destructive" });
    } finally {
      setReturnProcessing(false);
    }
  }, [returnData, selectedSale, userBranch, toast, loadSales]);

  const openReturnModal = (sale: Sale) => {
    const detailData: SaleDetailResponse = {
      id: sale.id,
      tenant_id: '',
      pharmacy_id: sale.pharmacy_id || '',
      pharmacy_name: sale.pharmacy_name || '',
      branch_id: sale.branch_id || '',
      reference: sale.reference,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      customer_id: sale.customer_id,
      created_by: sale.created_by || '',
      seller_name: sale.seller_name,
      created_at: sale.created_at,
      updated_at: sale.updated_at || sale.created_at,
      payment_method: sale.payment_method,
      is_credit: sale.is_credit || false,
      guarantee_deposit: 0,
      global_discount: sale.total_discount,
      subtotal: sale.subtotal,
      total_discount: sale.total_discount,
      total_tva: sale.total_tva,
      total_amount: sale.total_amount,
      status: sale.status,
      invoice_number: sale.invoice_number,
      items: sale.items || []
    };
    
    setSelectedSale(detailData);
    setReturnData({
      saleId: sale.id,
      items: [],
      reason: '',
      restocking_fee_percent: 0,
      return_type: 'customer'
    });
    setShowReturnModal(true);
  };

  const toggleReturnItem = (productId: string, currentQuantity: number) => {
    if (!returnData) return;
    
    const existingItem = returnData.items.find(i => i.product_id === productId);
    const newItems = [...returnData.items];
    
    if (existingItem) {
      const index = newItems.findIndex(i => i.product_id === productId);
      newItems.splice(index, 1);
    } else {
      newItems.push({
        product_id: productId,
        quantity: currentQuantity,
        reason: returnData.reason,
        condition: 'opened'
      });
    }
    
    setReturnData({ ...returnData, items: newItems });
  };

  // ==================== EXPORT PDF ====================

  const exportToPDF = async (sale: Sale | FacturePrinterSaleData) => {
    try {
      let items: any[] = [];
      
      if ('receiptNumber' in sale && !('created_at' in sale)) {
        const totalAmount = typeof sale.total === 'number' ? sale.total : parseFloat(String(sale.total));
        
        const element = document.createElement('div');
        element.className = 'p-6 font-mono';
        element.style.backgroundColor = 'white';
        element.style.width = '300px';
        
        element.innerHTML = `
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="font-weight: bold;">${userBranch?.name || 'Pharmacie'}</h2>
            <p>Branche: ${userBranch?.code || ''}</p>
            <p>N° ${sale.receiptNumber}</p>
            <p>${formatDateTime(sale.timestamp)}</p>
          </div>
          <div style="margin-bottom: 10px;">
            <p>Client: ${sale.customerName || 'Passager'}</p>
            <p>Vendeur: ${sale.cashierName}</p>
            <p>Paiement: ${sale.paymentMethod === 'cash' ? 'Espèces' : sale.paymentMethod === 'mobile_money' ? 'Mobile Money' : 'Compte'}</p>
          </div>
          <hr style="border-top: 1px dashed #ccc; margin: 10px 0;" />
          <div style="margin-bottom: 10px;">
            ${(sale.items || []).map((item: any) => {
              const itemTotal = (item.price || 0) * (item.quantity || 0);
              return `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                  <span>${item.name} x${item.quantity}</span>
                  <span>${itemTotal.toFixed(2)} FC</span>
                </div>
                ${item.discount_percent > 0 ? `<div style="font-size: 10px; color: green;">Remise: ${item.discount_percent}%</div>` : ''}
              `;
            }).join('')}
          </div>
          <hr style="border-top: 1px dashed #ccc; margin: 10px 0;" />
          <div style="display: flex; justify-content: space-between; font-weight: bold;">
            <span>TOTAL</span>
            <span>${totalAmount.toFixed(2)} FC</span>
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 10px;">
            <p>Merci de votre visite !</p>
          </div>
        `;
        
        document.body.appendChild(element);
        const canvas = await html2canvas(element, { scale: 2 });
        document.body.removeChild(element);
        
        const pdf = new jsPDF({ unit: 'mm', format: [80, canvas.height * 80 / canvas.width], orientation: 'portrait' });
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', 0, 0, 80, canvas.height * 80 / canvas.width);
        pdf.save(`facture-${sale.receiptNumber}.pdf`);
        
        toast({ title: "Succès", description: "PDF généré avec succès", variant: "success" });
        return;
      }
      
      const saleAsSale = sale as Sale;
      const totalAmount = typeof saleAsSale.total_amount === 'number' ? saleAsSale.total_amount : parseFloat(String(saleAsSale.total_amount || 0));
      
      if (!saleAsSale.items || saleAsSale.items.length === 0) {
        try {
          const detailsResponse = await api.get<SaleDetailResponse>(`/sales/${saleAsSale.id}`);
          items = detailsResponse.data.items || [];
          saleAsSale.items = items;
        } catch (e) {
          items = [];
        }
      } else {
        items = saleAsSale.items;
      }
      
      const element = document.createElement('div');
      element.className = 'p-6 font-mono';
      element.style.backgroundColor = 'white';
      element.style.width = '300px';
      
      element.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-weight: bold;">${userBranch?.name || 'Pharmacie'}</h2>
          <p>Branche: ${userBranch?.code || ''}</p>
          <p>N° ${saleAsSale.invoice_number || saleAsSale.reference}</p>
          <p>${formatDateTime(saleAsSale.created_at)}</p>
        </div>
        <div style="margin-bottom: 10px;">
          <p>Client: ${saleAsSale.customer_name || 'Passager'}</p>
          <p>Vendeur: ${saleAsSale.seller_name}</p>
          <p>Paiement: ${saleAsSale.payment_method === 'cash' ? 'Espèces' : saleAsSale.payment_method === 'mobile_money' ? 'Mobile Money' : 'Compte'}</p>
        </div>
        <hr style="border-top: 1px dashed #ccc; margin: 10px 0;" />
        <div style="margin-bottom: 10px;">
          ${items.map((item: SaleItem) => {
            const itemTotal = typeof item.total === 'number' ? item.total : parseFloat(String(item.total || 0));
            return `
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span>${item.product_name} x${item.quantity}</span>
                <span>${itemTotal.toFixed(2)} FC</span>
              </div>
              ${item.discount_percent > 0 ? `<div style="font-size: 10px; color: green;">Remise: ${item.discount_percent}%</div>` : ''}
            `;
          }).join('')}
        </div>
        <hr style="border-top: 1px dashed #ccc; margin: 10px 0;" />
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>TOTAL</span>
          <span>${totalAmount.toFixed(2)} FC</span>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 10px;">
          <p>Merci de votre visite !</p>
        </div>
      `;
      
      document.body.appendChild(element);
      const canvas = await html2canvas(element, { scale: 2 });
      document.body.removeChild(element);
      
      const pdf = new jsPDF({ unit: 'mm', format: [80, canvas.height * 80 / canvas.width], orientation: 'portrait' });
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 80, canvas.height * 80 / canvas.width);
      pdf.save(`facture-${saleAsSale.invoice_number || saleAsSale.reference}.pdf`);
      
      toast({ title: "Succès", description: "PDF généré avec succès", variant: "success" });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
    }
  };

  const openPrintModal = useCallback((sale: Sale) => {
    setSaleToPrint(convertToFacturePrinterSale(sale));
    setShowPrintModal(true);
  }, []);

  // ==================== RENDU ====================

  const totalPages = Math.ceil(totalSales / pageSize);
  const totalPagesArray = totalPages > 1 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"><CheckCircle size={10} /> Complétée</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"><X size={10} /> Annulée</span>;
      case 'pending':
        return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">En attente</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{status}</span>;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'mobile_money': return 'Mobile Money';
      case 'bank_transfer': return 'Virement';
      case 'check': return 'Chèque';
      default: return method || 'N/A';
    }
  };

  // Effets
  useEffect(() => { loadUserBranch(); }, [loadUserBranch]);
  useEffect(() => { if (userBranch?.id) { loadSales(); loadAvailableSellers(); } }, [loadSales, loadAvailableSellers, userBranch]);
  useEffect(() => { if (userBranch?.id) loadSales(); }, [currentPage, filters.period, filters.selectedMonth, filters.selectedYear, filters.sellerId, filters.paymentMethod, filters.status, userBranch]);

  if (branchLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin text-blue-600" size={40} />
          <p className="mt-4 text-slate-600 dark:text-slate-400">Chargement de votre branche...</p>
        </div>
      </div>
    );
  }

  if (!userBranch) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-900">
        <div className="text-center max-w-md p-6 bg-white rounded-2xl shadow-sm dark:bg-slate-800">
          <Building2 size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Aucune branche associée</h2>
          <p className="text-slate-600 dark:text-slate-400">Votre compte n'est associé à aucune branche. Veuillez contacter l'administrateur.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Toaster />
      
      {/* En-tête */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 p-2">
              <Receipt size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-800 dark:text-slate-200">Gestion des Factures</h1>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Building2 size={14} />
                <span>Branche: {userBranch.name} ({userBranch.code})</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => loadSales()}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </header>

      <main className="p-6">
        {/* Filtres */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-slate-400" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Période:</span>
            </div>
            
            <select
              value={filters.period}
              onChange={(e) => setFilters({ ...filters, period: e.target.value as PeriodType })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Cette année</option>
              <option value="custom">Personnalisé</option>
            </select>
            
            {filters.period === 'month' && (
              <>
                <select
                  value={filters.selectedMonth}
                  onChange={(e) => setFilters({ ...filters, selectedMonth: parseInt(e.target.value) as MonthType })}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                >
                  <option value={1}>Janvier</option><option value={2}>Février</option><option value={3}>Mars</option>
                  <option value={4}>Avril</option><option value={5}>Mai</option><option value={6}>Juin</option>
                  <option value={7}>Juillet</option><option value={8}>Août</option><option value={9}>Septembre</option>
                  <option value={10}>Octobre</option><option value={11}>Novembre</option><option value={12}>Décembre</option>
                </select>
                <input
                  type="number"
                  value={filters.selectedYear}
                  onChange={(e) => setFilters({ ...filters, selectedYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
              </>
            )}
            
            {filters.period === 'custom' && (
              <>
                <input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700" />
                <span className="text-slate-400">à</span>
                <input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700" />
              </>
            )}
            
            <select
              value={filters.sellerId}
              onChange={(e) => setFilters({ ...filters, sellerId: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="">Tous les vendeurs</option>
              {availableSellers.map(seller => (
                <option key={seller.id} value={seller.id}>{seller.nom_complet || seller.name || seller.email}</option>
              ))}
            </select>
            
            <select
              value={filters.paymentMethod}
              onChange={(e) => setFilters({ ...filters, paymentMethod: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="">Tous les modes</option>
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Virement</option>
              <option value="check">Chèque</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="">Tous les statuts</option>
              <option value="completed">Complétées</option>
              <option value="pending">En attente</option>
              <option value="cancelled">Annulées</option>
            </select>
            
            <div className="relative flex-1 min-w-50">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Rechercher par numéro, client, vendeur..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
              />
            </div>
          </div>
        </div>

        {/* Tableau des ventes */}
        <div className="rounded-2xl bg-white shadow-sm dark:bg-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">N° Facture</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Vendeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Paiement</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Montant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Statut</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center">
                      <Loader2 className="mx-auto animate-spin text-blue-600" size={24} />
                      <p className="mt-2 text-sm text-slate-400">Chargement...</p>
                    </td>
                  </tr>
                ) : sales.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Aucune vente trouvée</td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">{sale.invoice_number || sale.reference}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatDate(sale.created_at)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{sale.customer_name || 'Passager'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{sale.seller_name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{getPaymentMethodLabel(sale.payment_method)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">{sale.total_amount.toLocaleString()} FC</td>
                      <td className="px-4 py-3">{getStatusBadge(sale.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => loadSaleDetails(sale.id)} className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50" title="Voir détails"><Eye size={16} /></button>
                          <button onClick={() => openPrintModal(sale)} className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50" title="Imprimer"><Printer size={16} /></button>
                          <button onClick={() => exportToPDF(sale)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" title="Exporter PDF"><Download size={16} /></button>
                          {sale.status === 'completed' && (
                            <button onClick={() => openReturnModal(sale)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Retour/Annulation"><ArrowLeftRight size={16} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 dark:border-slate-700">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600">
                <ChevronLeft size={16} />
              </button>
              <div className="flex gap-1">
                {totalPagesArray.slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2)).map(page => (
                  <button key={page} onClick={() => setCurrentPage(page)} className={`rounded-lg px-3 py-1 text-sm ${currentPage === page ? 'bg-blue-600 text-white' : 'border border-slate-200 dark:border-slate-600'}`}>
                    {page}
                  </button>
                ))}
              </div>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Modal Détails */}
      {showDetailModal && selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">Détails de la vente #{selectedSale.invoice_number || selectedSale.reference}</h3>
              <button onClick={() => setShowDetailModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 dark:bg-slate-700/50">
                <div className="flex items-center gap-2 text-sm"><Building2 size={14} /><span>Pharmacie: {selectedSale.pharmacy_name || userBranch.name}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-xs text-slate-400">Date</p><p className="font-medium">{formatDateTime(selectedSale.created_at)}</p></div>
                <div><p className="text-xs text-slate-400">Client</p><p className="font-medium">{selectedSale.customer_name || 'Passager'}</p></div>
                <div><p className="text-xs text-slate-400">Vendeur</p><p className="font-medium">{selectedSale.seller_name}</p></div>
                <div><p className="text-xs text-slate-400">Mode de paiement</p><p className="font-medium">{getPaymentMethodLabel(selectedSale.payment_method)}</p></div>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-700" />
              
              <div>
                <h4 className="mb-3 text-sm font-bold">Produits vendus</h4>
                <div className="space-y-2">
                  {selectedSale.items?.map((item) => (
                    <div key={item.id} className="flex justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
                      <div><p className="text-sm font-medium">{item.product_name}</p><p className="text-xs text-slate-400">Code: {item.product_code}</p></div>
                      <div className="text-right"><p className="text-sm">{item.quantity} x {item.unit_price.toLocaleString()} FC</p><p className="text-sm font-semibold text-green-600">{item.total.toLocaleString()} FC</p></div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-700" />
              
              <div className="space-y-1 text-right">
                <div className="flex justify-between text-sm"><span className="text-slate-500">Sous-total:</span><span>{selectedSale.subtotal.toLocaleString()} FC</span></div>
                {selectedSale.total_discount > 0 && (<div className="flex justify-between text-sm text-green-600"><span>Remise:</span><span>-{selectedSale.total_discount.toLocaleString()} FC</span></div>)}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-black"><span>TOTAL:</span><span className="text-blue-600">{selectedSale.total_amount.toLocaleString()} FC</span></div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 p-4 dark:border-slate-700">
              <div className="flex justify-end gap-3">
                <button onClick={() => { setSaleToPrint(convertToFacturePrinterSale(selectedSale)); setShowPrintModal(true); setShowDetailModal(false); }} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Printer size={16} /> Imprimer</button>
                <button onClick={() => { exportToPDF(convertToFacturePrinterSale(selectedSale)); }} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white"><Download size={16} /> PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Impression */}
      {showPrintModal && saleToPrint && (
        <FacturePrinter
          sale={saleToPrint}
          pharmacyId={userBranch?.parent_pharmacy_id || saleToPrint.pharmacy_id}
          onClose={() => { setShowPrintModal(false); setSaleToPrint(null); }}
          onPrint={() => { setShowPrintModal(false); setSaleToPrint(null); toast({ title: "Succès", description: "Impression lancée", variant: "success" }); }}
        />
      )}

      {/* Modal Retour */}
      {showReturnModal && selectedSale && returnData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
              <div className="flex items-center gap-2"><AlertTriangle size={20} className="text-red-500" /><h3 className="text-lg font-black">Retour / Annulation</h3></div>
              <button onClick={() => setShowReturnModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                <p className="text-sm">Vente #{selectedSale.invoice_number} du {formatDate(selectedSale.created_at)}</p>
                <p className="text-sm font-bold">Montant: {selectedSale.total_amount.toLocaleString()} FC</p>
              </div>
              
              {/* Sélection des produits */}
              <div>
                <label className="mb-2 block text-sm font-medium">Produits à retourner</label>
                <div className="space-y-2 max-h-60 overflow-y-auto border rounded-xl p-2 dark:border-slate-600">
                  {(selectedSale.items || []).map((item) => {
                    const isSelected = returnData.items.some(i => i.product_id === item.product_id);
                    return (
                      <div key={item.id} onClick={() => toggleReturnItem(item.product_id, item.quantity)} className={`flex items-center justify-between p-2 rounded-lg cursor-pointer ${isSelected ? 'bg-red-50 border border-red-200 dark:bg-red-900/20' : 'bg-slate-50 dark:bg-slate-700/50'}`}>
                        <div><p className="text-sm font-medium">{item.product_name}</p><p className="text-xs text-slate-500">{item.quantity} x {item.unit_price.toLocaleString()} FC</p></div>
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="rounded border-slate-300 text-red-600" />
                      </div>
                    );
                  })}
                </div>
                {returnData.items.length === 0 && <p className="text-xs text-amber-600 mt-1">⚠️ Aucun produit sélectionné - la vente entière sera retournée</p>}
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium">Raison du retour</label>
                <textarea value={returnData.reason} onChange={(e) => setReturnData({ ...returnData, reason: e.target.value })} className="w-full rounded-xl border p-3 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:bg-slate-700" rows={3} placeholder="Ex: Produit défectueux, Erreur de commande..." />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Frais de restockage (%)</label>
                <input type="number" min="0" max="100" step="5" value={returnData.restocking_fee_percent} onChange={(e) => setReturnData({ ...returnData, restocking_fee_percent: parseFloat(e.target.value) || 0 })} className="w-full rounded-xl border p-2 text-sm outline-none focus:ring-2 focus:ring-red-500 dark:bg-slate-700" />
              </div>
              
              <div className="rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-700"><AlertTriangle size={14} className="inline mr-1" /> Cette action va créer une demande de retour et restaurer le stock après validation.</p>
              </div>
            </div>
            
            <div className="flex gap-3 border-t border-slate-100 p-4 dark:border-slate-700">
              <button onClick={() => setShowReturnModal(false)} className="flex-1 rounded-xl border py-2 font-medium">Annuler</button>
              <button onClick={handleReturn} disabled={returnProcessing || !returnData.reason.trim()} className="flex-1 rounded-xl bg-red-600 py-2 font-medium text-white disabled:bg-slate-300">
                {returnProcessing ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'Créer la demande de retour'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactureManager;