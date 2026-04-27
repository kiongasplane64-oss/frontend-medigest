// modules/sales/FactureManager.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Users,
  Clock,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  Filter,
  Building2
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import { Toaster } from '@/components/ui/Toaster';
import api from '@/api/client';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatDate, formatDateTime } from '@/utils/formatters';

// Types
interface SaleItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  discount_amount: number;
  total: number;
}

interface Sale {
  id: string;
  reference: string;
  receipt_number: string;
  customer_name: string;
  seller_name: string;
  seller_id: string;
  payment_method: string;
  subtotal: number;
  total_discount: number;
  total_tva: number;
  total_amount: number;
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  created_at: string;
  items?: SaleItem[];
  branch_id?: string;
  branch_name?: string;
}

interface SalesResponse {
  items: Sale[];
  total: number;
  page: number;
  size: number;
  has_more: boolean;
}

interface SaleDetailResponse {
  sale: Sale;
  items: SaleItem[];
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

interface RefundData {
  saleId: string;
  items: Array<{
    product_id: string;
    quantity: number;
    reason: string;
  }>;
  reason: string;
  refund_amount: number;
}

const FactureManager: React.FC = () => {
  const { user } = useAuthStore();
  const { toast } = useToast();
  
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  
  // Branche de l'utilisateur connecté
  const [userBranch, setUserBranch] = useState<BranchInfo | null>(null);
  const [branchLoading, setBranchLoading] = useState(true);
  
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
  
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleDetails, setSaleDetails] = useState<SaleItem[]>([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundData, setRefundData] = useState<RefundData | null>(null);
  const [refundProcessing, setRefundProcessing] = useState(false);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');

  // Récupérer la branche de l'utilisateur connecté
  const loadUserBranch = useCallback(async () => {
    setBranchLoading(true);
    try {
      const userId = user?.id;
      if (!userId) {
        console.error('Utilisateur non connecté');
        setBranchLoading(false);
        return;
      }

      // Récupérer les détails de l'utilisateur pour obtenir sa branche
      const userResponse = await api.get(`/users/${userId}`);
      const userData = userResponse.data;
      
      const branchId = userData.branch_id || userData.current_branch_id;
      
      if (!branchId) {
        toast({ 
          title: "Erreur", 
          description: "Aucune branche associée à votre compte", 
          variant: "destructive" 
        });
        setBranchLoading(false);
        return;
      }
      
      // Récupérer les détails de la branche
      const branchResponse = await api.get(`/branches/${branchId}`);
      const branchData = branchResponse.data;
      
      setUserBranch({
        id: branchData.id,
        name: branchData.name,
        code: branchData.code,
        is_active: branchData.is_active,
        parent_pharmacy_id: branchData.parent_pharmacy_id
      });
      
    } catch (error) {
      console.error('Erreur chargement branche:', error);
      toast({ 
        title: "Erreur", 
        description: "Impossible de charger les informations de votre branche", 
        variant: "destructive" 
      });
    } finally {
      setBranchLoading(false);
    }
  }, [user, toast]);

  // Calculer la plage de dates en fonction de la période
  const getDateRange = useCallback((): { startDate: string; endDate: string } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    switch (filters.period) {
      case 'today':
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
      
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return {
          startDate: yesterday.toISOString().split('T')[0],
          endDate: yesterday.toISOString().split('T')[0]
        };
      
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
        const endDate = new Date(year, month, 0);
        return {
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0]
        };
      }
      
      case 'year': {
        const year = filters.selectedYear;
        return {
          startDate: `${year}-01-01`,
          endDate: `${year}-12-31`
        };
      }
      
      case 'custom':
        return {
          startDate: filters.startDate,
          endDate: filters.endDate
        };
      
      default:
        return {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
    }
  }, [filters]);

  // Charger les ventes de la branche
  const loadSales = useCallback(async () => {
    if (!userBranch?.id) {
      console.warn('Aucune branche disponible');
      return;
    }
    
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();
      const branchId = userBranch.id;
      
      const params: any = {
        branch_id: branchId,
        page: currentPage,
        limit: pageSize,
        start_date: startDate,
        end_date: endDate,
      };
      
      if (filters.sellerId) params.seller_id = filters.sellerId;
      if (filters.paymentMethod) params.payment_method = filters.paymentMethod;
      if (filters.status) params.status = filters.status;
      if (searchTerm) params.search = searchTerm;
      
      const response = await api.get<SalesResponse>('/sales', { params });
      
      // Ajouter le nom de la branche aux ventes si nécessaire
      const salesWithBranch = (response.data.items || []).map(sale => ({
        ...sale,
        branch_name: userBranch.name
      }));
      
      setSales(salesWithBranch);
      setTotalSales(response.data.total || 0);
      
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
      toast({ title: "Erreur", description: "Impossible de charger les ventes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters, searchTerm, toast, getDateRange, userBranch]);

  // Charger la liste des vendeurs de la branche
  const loadSellers = useCallback(async () => {
    if (!userBranch?.id) return;
    
    try {
      const branchId = userBranch.id;
      const response = await api.get('/users/sellers', { 
        params: { branch_id: branchId } 
      });
      setSellers(response.data.users || response.data || []);
    } catch (error) {
      console.error('Erreur chargement vendeurs:', error);
    }
  }, [userBranch]);

  // Charger les détails d'une vente
  const loadSaleDetails = useCallback(async (saleId: string) => {
    try {
      const response = await api.get<SaleDetailResponse>(`/sales/${saleId}`);
      const data = response.data;
      
      if (data.sale) {
        setSelectedSale({
          ...data.sale,
          branch_name: userBranch?.name
        });
        setSaleDetails(data.items || []);
      } else if (data.items) {
        setSelectedSale({
          ...(sales.find(s => s.id === saleId) || {}),
          branch_name: userBranch?.name
        } as Sale);
        setSaleDetails(data.items);
      }
      
      setShowDetailModal(true);
    } catch (error) {
      console.error('Erreur chargement détails:', error);
      toast({ title: "Erreur", description: "Impossible de charger les détails de la vente", variant: "destructive" });
    }
  }, [sales, toast, userBranch]);

  // Annuler/Rembourser une vente
  const handleRefund = useCallback(async () => {
    if (!refundData || !selectedSale || !userBranch?.id) return;
    
    setRefundProcessing(true);
    try {
      await api.post('/sales/refund', {
        ...refundData,
        branch_id: userBranch.id,
        sale_id: selectedSale.id
      });
      
      toast({
        title: "Succès",
        description: `La vente ${selectedSale.receipt_number} a été annulée et le stock a été remis`,
        variant: "success"
      });
      
      setShowRefundModal(false);
      setRefundData(null);
      setSelectedSale(null);
      
      loadSales();
      
    } catch (error: any) {
      console.error('Erreur remboursement:', error);
      toast({
        title: "Erreur",
        description: error.response?.data?.message || "Impossible d'annuler la vente",
        variant: "destructive"
      });
    } finally {
      setRefundProcessing(false);
    }
  }, [refundData, selectedSale, userBranch, toast, loadSales]);

  // Ouvrir le modal de remboursement
  const openRefundModal = (sale: Sale) => {
    setSelectedSale(sale);
    setRefundData({
      saleId: sale.id,
      items: [],
      reason: '',
      refund_amount: sale.total_amount
    });
    setShowRefundModal(true);
  };

  // Exporter en PDF
  const exportToPDF = async (sale: Sale) => {
    try {
      let items = sale.items;
      if (!items) {
        const detailsResponse = await api.get<SaleDetailResponse>(`/sales/${sale.id}`);
        items = detailsResponse.data.items || [];
      }
      
      const element = document.createElement('div');
      element.className = 'p-6 font-mono';
      element.style.backgroundColor = 'white';
      element.style.width = '300px';
      
      element.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="font-weight: bold;">${userBranch?.name || 'Pharmacie'}</h2>
          <p>Branche: ${userBranch?.code || ''}</p>
          <p>N° ${sale.receipt_number}</p>
          <p>${formatDateTime(sale.created_at)}</p>
        </div>
        <div style="margin-bottom: 10px;">
          <p>Client: ${sale.customer_name || 'Passager'}</p>
          <p>Vendeur: ${sale.seller_name}</p>
          <p>Paiement: ${sale.payment_method === 'cash' ? 'Espèces' : sale.payment_method === 'mobile_money' ? 'Mobile Money' : 'Compte'}</p>
        </div>
        <hr style="border-top: 1px dashed #ccc; margin: 10px 0;" />
        <div style="margin-bottom: 10px;">
          ${items.map(item => `
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>${item.product_name} x${item.quantity}</span>
              <span>${item.total.toFixed(2)} FC</span>
            </div>
            ${item.discount_percent > 0 ? `<div style="font-size: 10px; color: green;">Remise: ${item.discount_percent}%</div>` : ''}
          `).join('')}
        </div>
        <hr style="border-top: 1px dashed #ccc; margin: 10px 0;" />
        <div style="display: flex; justify-content: space-between; font-weight: bold;">
          <span>TOTAL</span>
          <span>${sale.total_amount.toFixed(2)} FC</span>
        </div>
        <div style="text-align: center; margin-top: 20px; font-size: 10px;">
          <p>Merci de votre visite !</p>
        </div>
      `;
      
      document.body.appendChild(element);
      const canvas = await html2canvas(element, { scale: 2 });
      document.body.removeChild(element);
      
      const pdf = new jsPDF({
        unit: 'mm',
        format: [80, canvas.height * 80 / canvas.width],
        orientation: 'portrait'
      });
      
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 0, 0, 80, canvas.height * 80 / canvas.width);
      pdf.save(`facture-${sale.receipt_number}.pdf`);
      
      toast({ title: "Succès", description: "PDF généré avec succès", variant: "success" });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      toast({ title: "Erreur", description: "Impossible de générer le PDF", variant: "destructive" });
    }
  };

  // Imprimer
  const handlePrint = (sale: Sale) => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Facture #${sale.receipt_number}</title>
          <style>
            body { font-family: monospace; margin: 0; padding: 10px; width: 300px; }
            .text-center { text-align: center; }
            .border-dashed { border-top: 1px dashed #ccc; margin: 10px 0; }
            .flex { display: flex; justify-content: space-between; }
            .font-bold { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <h2>${userBranch?.name || 'Pharmacie'}</h2>
            <p>Branche: ${userBranch?.code || ''}</p>
            <p>N° ${sale.receipt_number}</p>
            <p>${formatDateTime(sale.created_at)}</p>
          </div>
          <div>
            <p>Client: ${sale.customer_name || 'Passager'}</p>
            <p>Vendeur: ${sale.seller_name}</p>
          </div>
          <div class="border-dashed"></div>
          <div>
            ${sale.items?.map(item => `
              <div class="flex">
                <span>${item.product_name} x${item.quantity}</span>
                <span>${item.total.toFixed(2)} FC</span>
              </div>
            `).join('') || '<p>Chargement...</p>'}
          </div>
          <div class="border-dashed"></div>
          <div class="flex font-bold">
            <span>TOTAL</span>
            <span>${sale.total_amount.toFixed(2)} FC</span>
          </div>
          <div class="text-center" style="margin-top: 20px;">
            <p>Merci de votre visite !</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
  };

  // Statistiques par utilisateur
  const getUserStats = useMemo(() => {
    const stats: Record<string, { total: number; count: number; name: string }> = {};
    
    sales.forEach(sale => {
      if (!stats[sale.seller_id]) {
        stats[sale.seller_id] = { total: 0, count: 0, name: sale.seller_name };
      }
      stats[sale.seller_id].total += sale.total_amount;
      stats[sale.seller_id].count += 1;
    });
    
    return Object.entries(stats).map(([id, data]) => ({
      id,
      name: data.name,
      total: data.total,
      count: data.count
    }));
  }, [sales]);

  // Statistiques globales
  const globalStats = useMemo(() => {
    const total = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
    const average = sales.length > 0 ? total / sales.length : 0;
    const completed = sales.filter(s => s.status === 'completed').length;
    const cancelled = sales.filter(s => s.status === 'cancelled' || s.status === 'refunded').length;
    
    return { total, average, completed, cancelled, count: sales.length };
  }, [sales]);

  // Charger la branche au montage
  useEffect(() => {
    loadUserBranch();
  }, [loadUserBranch]);

  // Charger les ventes et vendeurs quand la branche est disponible
  useEffect(() => {
    if (userBranch?.id) {
      loadSales();
      loadSellers();
    }
  }, [loadSales, loadSellers, userBranch]);

  // Recharger quand les filtres changent
  useEffect(() => {
    if (userBranch?.id) {
      loadSales();
    }
  }, [currentPage, filters.period, filters.selectedMonth, filters.selectedYear, filters.sellerId, filters.paymentMethod, filters.status, userBranch]);

  const totalPages = Math.ceil(totalSales / pageSize);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"><CheckCircle size={10} /> Complétée</span>;
      case 'cancelled':
        return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"><X size={10} /> Annulée</span>;
      case 'refunded':
        return <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700"><ArrowLeftRight size={10} /> Remboursée</span>;
      default:
        return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700"><Clock size={10} /> En attente</span>;
    }
  };

  // Affichage du chargement de la branche
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

  // Affichage si aucune branche
  if (!userBranch) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center dark:bg-slate-900">
        <div className="text-center max-w-md p-6 bg-white rounded-2xl shadow-sm dark:bg-slate-800">
          <Building2 size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Aucune branche associée</h2>
          <p className="text-slate-600 dark:text-slate-400">
            Votre compte n'est associé à aucune branche. Veuillez contacter l'administrateur.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Toaster />
      
      {/* Header */}
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
            onClick={loadSales}
            className="flex items-center gap-2 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"
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
              <option value="week">Cette semaine (Lun-Dim)</option>
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
                  <option value={1}>Janvier</option>
                  <option value={2}>Février</option>
                  <option value={3}>Mars</option>
                  <option value={4}>Avril</option>
                  <option value={5}>Mai</option>
                  <option value={6}>Juin</option>
                  <option value={7}>Juillet</option>
                  <option value={8}>Août</option>
                  <option value={9}>Septembre</option>
                  <option value={10}>Octobre</option>
                  <option value={11}>Novembre</option>
                  <option value={12}>Décembre</option>
                </select>
                
                <input
                  type="number"
                  value={filters.selectedYear}
                  onChange={(e) => setFilters({ ...filters, selectedYear: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-24 rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                  placeholder="Année"
                />
              </>
            )}
            
            {filters.period === 'custom' && (
              <>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
                <span className="text-slate-400">à</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
                />
              </>
            )}
            
            <select
              value={filters.sellerId}
              onChange={(e) => setFilters({ ...filters, sellerId: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="">Tous les vendeurs</option>
              {sellers.map(seller => (
                <option key={seller.id} value={seller.id}>{seller.name}</option>
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
              <option value="account">Compte</option>
            </select>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-700"
            >
              <option value="">Tous les statuts</option>
              <option value="completed">Complétées</option>
              <option value="cancelled">Annulées</option>
              <option value="refunded">Remboursées</option>
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

        {/* Statistiques */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-100 p-2 dark:bg-blue-900">
                <Receipt size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ventes</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-200">{globalStats.count}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-2 dark:bg-green-900">
                <DollarSign size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-xl font-black text-green-600">{globalStats.total.toLocaleString()} FC</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-purple-100 p-2 dark:bg-purple-900">
                <DollarSign size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Moyenne</p>
                <p className="text-xl font-black text-purple-600">{globalStats.average.toLocaleString()} FC</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-green-100 p-2 dark:bg-green-900">
                <CheckCircle size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Complétées</p>
                <p className="text-xl font-black text-green-600">{globalStats.completed}</p>
              </div>
            </div>
          </div>
          
          <div className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-red-100 p-2 dark:bg-red-900">
                <X size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Annulées</p>
                <p className="text-xl font-black text-red-600">{globalStats.cancelled}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistiques par vendeur */}
        {getUserStats.length > 0 && (
          <div className="mb-6 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              <Users size={16} />
              Ventes par vendeur
            </h3>
            <div className="space-y-2">
              {getUserStats.map(stat => (
                <div key={stat.id} className="flex items-center justify-between">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{stat.name}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-500">{stat.count} vente(s)</span>
                    <span className="text-sm font-semibold text-green-600">{stat.total.toLocaleString()} FC</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      Aucune vente trouvée
                    </td>
                  </tr>
                ) : (
                  sales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {sale.receipt_number || sale.reference}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {formatDate(sale.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {sale.customer_name || 'Passager'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {sale.seller_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">
                        {sale.payment_method === 'cash' ? 'Espèces' : sale.payment_method === 'mobile_money' ? 'Mobile Money' : 'Compte'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-green-600">
                        {sale.total_amount.toLocaleString()} FC
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(sale.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => loadSaleDetails(sale.id)}
                            className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                            title="Voir détails"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => exportToPDF(sale)}
                            className="rounded-lg p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30"
                            title="Exporter PDF"
                          >
                            <Download size={16} />
                          </button>
                          <button
                            onClick={() => handlePrint(sale)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Imprimer"
                          >
                            <Printer size={16} />
                          </button>
                          {sale.status === 'completed' && (
                            <button
                              onClick={() => openRefundModal(sale)}
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                              title="Annuler/Rembourser"
                            >
                              <ArrowLeftRight size={16} />
                            </button>
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
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Page {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600"
              >
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
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                Détails de la vente #{selectedSale.receipt_number}
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 dark:bg-slate-700/50">
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Building2 size={14} />
                  <span>Branche: {selectedSale.branch_name || userBranch.name}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-slate-400">Date</p>
                  <p className="font-medium">{formatDateTime(selectedSale.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Client</p>
                  <p className="font-medium">{selectedSale.customer_name || 'Passager'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Vendeur</p>
                  <p className="font-medium">{selectedSale.seller_name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Mode de paiement</p>
                  <p className="font-medium">
                    {selectedSale.payment_method === 'cash' ? 'Espèces' : 
                     selectedSale.payment_method === 'mobile_money' ? 'Mobile Money' : 'Compte'}
                  </p>
                </div>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-700" />
              
              <div>
                <h4 className="mb-3 text-sm font-bold text-slate-700 dark:text-slate-300">Produits vendus</h4>
                <div className="space-y-2">
                  {saleDetails.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
                      <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.product_name}</p>
                        <p className="text-xs text-slate-400">Code: {item.product_code}</p>
                        {item.discount_percent > 0 && (
                          <p className="text-xs text-green-600">Remise: {item.discount_percent}%</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600 dark:text-slate-400">{item.quantity} x {item.unit_price.toFixed(2)} FC</p>
                        <p className="text-sm font-semibold text-green-600">{item.total.toFixed(2)} FC</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-slate-100 dark:border-slate-700" />
              
              <div className="space-y-1 text-right">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Sous-total:</span>
                  <span>{selectedSale.subtotal.toFixed(2)} FC</span>
                </div>
                {selectedSale.total_discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Remise:</span>
                    <span>-{selectedSale.total_discount.toFixed(2)} FC</span>
                  </div>
                )}
                {selectedSale.total_tva > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>TVA:</span>
                    <span>{selectedSale.total_tva.toFixed(2)} FC</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-black">
                  <span>TOTAL:</span>
                  <span className="text-blue-600">{selectedSale.total_amount.toFixed(2)} FC</span>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 p-4 dark:border-slate-700">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => exportToPDF(selectedSale)}
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                >
                  <Download size={16} />
                  PDF
                </button>
                <button
                  onClick={() => handlePrint(selectedSale)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Printer size={16} />
                  Imprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Remboursement */}
      {showRefundModal && selectedSale && refundData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-500" />
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
                  Annuler la vente
                </h3>
              </div>
              <button
                onClick={() => setShowRefundModal(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-900/20">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Vente #{selectedSale.receipt_number} du {formatDate(selectedSale.created_at)}
                </p>
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
                  Montant: {selectedSale.total_amount.toFixed(2)} FC
                </p>
              </div>
              
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Raison de l'annulation
                </label>
                <textarea
                  value={refundData.reason}
                  onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                  rows={3}
                  placeholder="Ex: Produit défectueux, Erreur de caisse, Client insatisfait..."
                />
              </div>
              
              <div className="rounded-xl bg-red-50 p-3 dark:bg-red-900/20">
                <p className="text-sm text-red-700 dark:text-red-400">
                  <AlertTriangle size={14} className="inline mr-1" />
                  Cette action va:
                </p>
                <ul className="mt-2 ml-4 list-disc text-xs text-red-600 dark:text-red-400">
                  <li>Annuler la vente définitivement</li>
                  <li>Remettre les produits en stock</li>
                  <li>Ne pourra pas être inversée</li>
                </ul>
              </div>
            </div>
            
            <div className="flex gap-3 border-t border-slate-100 p-4 dark:border-slate-700">
              <button
                onClick={() => setShowRefundModal(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2 font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400"
              >
                Annuler
              </button>
              <button
                onClick={handleRefund}
                disabled={refundProcessing || !refundData.reason.trim()}
                className="flex-1 rounded-xl bg-red-600 py-2 font-medium text-white hover:bg-red-700 disabled:bg-slate-300 dark:disabled:bg-slate-600"
              >
                {refundProcessing ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'Confirmer l\'annulation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Icon Receipt
const Receipt = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
    <path d="M8 7h8" />
    <path d="M8 12h8" />
    <path d="M8 17h5" />
  </svg>
);

export default FactureManager;