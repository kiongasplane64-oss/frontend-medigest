// Historique.tsx - Version complète avec nouvel onglet Utilisateur
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowLeft,
  Download,
  Printer,
  Eye,
  TrendingUp,
  Package,
  Users,
  CreditCard,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt,
  Calendar,
  RefreshCw,
  WifiOff,
  Loader2,
  Store,
  User,
  BarChart3,
  FolderTree,
  FileText,
  List,
  ShoppingBag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useOnline } from '@/hooks/useOnline';
import { useToast } from '@/hooks/useToast';
import { useSaleStore, type LocalSale } from '@/store/saleStore';
import { type SaleResponse, type SaleItemResponse } from '@/services/saleService';
import api from '@/api/client';

// Types
interface SaleItem {
  productId?: string;
  id?: string;
  name: string;
  price: number;
  quantity: number;
  code?: string;
  category?: string;
  categoryId?: string;
}

interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  timestamp: number;
  cashierName?: string;
  cashierId?: string;
  posName?: string;
  branchId?: string;
  branchName?: string;
  sessionNumber?: string;
  receiptNumber?: string;
  customerName?: string;
  status?: 'completed' | 'pending' | 'cancelled';
  synced?: boolean;
  isLocal?: boolean;
}

interface CategorySaleStats {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  quantitySold: number;
  saleCount: number;
  percentage: number;
  products: Map<string, { productName: string; quantity: number; amount: number }>;
}

interface BranchStats {
  branchId: string;
  branchName: string;
  totalSales: number;
  totalAmount: number;
  averageTicket: number;
  lastSaleDate: number | null;
  userCount: number;
}

interface DailySaleDetail {
  date: string;
  dayOfWeek: string;
  sales: {
    userId: string;
    userName: string;
    branchId: string;
    branchName: string;
    amount: number;
    count: number;
    timestamp: number;
  }[];
}

interface MonthlyStats {
  month: number;
  monthName: string;
  year: number;
  totalAmount: number;
  totalSales: number;
  byUser: Map<string, { userName: string; amount: number; count: number }>;
  byBranch: Map<string, { branchName: string; amount: number; count: number }>;
}

// Nouveaux types pour l'onglet utilisateur
interface UserSaleDetail {
  id: string;
  time: string;
  hour: string;
  products: { name: string; quantity: number; price: number; total: number }[];
  totalAmount: number;
  timestamp: number;
}

interface UserProductStats {
  productId: string;
  productName: string;
  quantitySold: number;
  timesSold: number;
  totalAmount: number;
  unitPrice: number;
}

interface ProductSummary {
  productId: string;
  productName: string;
  totalQuantity: number;
  unitPrice: number;
  totalAmount: number;
}

type UserViewTab = 'details' | 'stats' | 'summary';

type ViewMode = 'sales' | 'users' | 'branches' | 'analytics' | 'categories';
type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAYS_FR = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export default function Historique() {
  const { user } = useAuthStore();
  const isOnline = useOnline();
  const { toast } = useToast();
  
  const { 
    sales: apiSales, 
    localSales, 
    fetchSales, 
    syncPendingSales,
    loading: storeLoading,
    getPendingCount,
    resetFailedSales,
  } = useSaleStore();

  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('sales');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  
  // Nouveaux states pour l'onglet utilisateur
  const [userViewTab, setUserViewTab] = useState<UserViewTab>('details');
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<string | null>(null);

  const itemsPerPage = 20;
  const pendingCount = getPendingCount();

  // Charger les catégories depuis l'API
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.get('/categories');
        const categoriesData = response.data?.data || response.data || [];
        if (Array.isArray(categoriesData)) {
          setCategories(categoriesData.map((cat: any) => ({ id: cat.id, name: cat.name })));
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
      }
    };
    loadCategories();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      await fetchSales();
      if (isOnline && pendingCount > 0) {
        await syncPendingSales();
      }
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      toast({
        title: "Mode hors-ligne",
        description: "Affichage des données locales uniquement",
        variant: "default",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchSales();
      if (isOnline) {
        await syncPendingSales();
      }
      toast({ title: "Succès", description: "Historique mis à jour" });
    } catch (error) {
      toast({ title: "Erreur", description: "Erreur lors du rafraîchissement", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryFailed = () => {
    resetFailedSales();
    toast({ title: "Réessai", description: "Tentative de re-synchronisation des ventes échouées" });
  };

  const getTotalAmount = (sale: any): number => {
    if (typeof sale.total === 'number') return sale.total;
    if (typeof sale.total === 'string') return parseFloat(sale.total) || 0;
    if (sale.total_amount && typeof sale.total_amount === 'number') return sale.total_amount;
    if (sale.total_amount && typeof sale.total_amount === 'string') return parseFloat(sale.total_amount) || 0;
    return 0;
  };

  const formatPrice = (price: number): string => {
    return price.toFixed(2) + ' FC';
  };

  function normalizeApiSale(sale: SaleResponse): Sale {
    const items = (sale.items || []).map((item: SaleItemResponse) => {
      return {
        id: item.product_id,
        name: item.product_name || (item as any).name || `Produit ${item.product_id?.slice(-6) || 'inconnu'}`,
        price: item.unit_price || 0,
        quantity: item.quantity || 0,
        code: item.product_code,
        productId: item.product_id,
        category: (item as any).category_name,
        categoryId: (item as any).category_id,
      };
    });

    return {
      id: sale.id,
      items,
      total: getTotalAmount(sale),
      paymentMethod: sale.payment_method || 'cash',
      timestamp: new Date(sale.created_at).getTime(),
      cashierName: sale.seller_name,
      cashierId: sale.created_by,
      posName: sale.pharmacy_id,
      branchId: sale.pharmacy_id,
      branchName: sale.pharmacy_id ? `Branche ${sale.pharmacy_id.slice(-4)}` : 'Branche Principale',
      sessionNumber: sale.reference?.slice(0, 8),
      receiptNumber: sale.receipt_number || sale.invoice_number || sale.reference,
      customerName: sale.customer_name || 'Passager',
      status: sale.status as 'completed' | 'pending' | 'cancelled',
      synced: true,
      isLocal: false,
    };
  }

  function normalizeLocalSale(sale: LocalSale): Sale {
    const items = sale.items.map(item => ({
      id: item.id,
      name: item.name || item.product_name || `Produit ${item.id?.slice(-6) || 'inconnu'}`,
      price: item.price || 0,
      quantity: item.quantity || 0,
      code: item.code || item.product_code,
      productId: item.productId || item.id,
      category: item.category,
      categoryId: item.categoryId,
    }));

    return {
      id: sale.id,
      items,
      total: getTotalAmount(sale),
      paymentMethod: sale.paymentMethod,
      timestamp: sale.timestamp,
      cashierName: sale.cashierName,
      cashierId: sale.cashierId || 'unknown',
      posName: sale.posName,
      branchId: sale.branchId || 'main',
      branchName: sale.branchName || 'Branche Principale',
      sessionNumber: sale.sessionNumber,
      receiptNumber: sale.receiptNumber,
      customerName: sale.customerName || 'Passager',
      status: sale.status,
      synced: sale.synced,
      isLocal: true,
    };
  }

  const allSales = useMemo(() => {
    const apiNormalized = apiSales.map(normalizeApiSale);
    const localNormalized = localSales.map(normalizeLocalSale);
    const combined = [...localNormalized, ...apiNormalized];
    combined.sort((a, b) => b.timestamp - a.timestamp);
    return combined;
  }, [apiSales, localSales]);

  const getDateFilteredSales = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (periodType) {
      case 'today': {
        const start = today.getTime();
        const end = start + 24 * 60 * 60 * 1000 - 1;
        return allSales.filter(s => s.timestamp >= start && s.timestamp <= end);
      }
      case 'week': {
        const dayOfWeek = today.getDay();
        const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(today);
        monday.setDate(today.getDate() - mondayOffset);
        const start = monday.getTime();
        const end = start + 7 * 24 * 60 * 60 * 1000 - 1;
        return allSales.filter(s => s.timestamp >= start && s.timestamp <= end);
      }
      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        return allSales.filter(s => s.timestamp >= start && s.timestamp <= end);
      }
      case 'year': {
        const start = new Date(selectedYear, 0, 1).getTime();
        const end = new Date(selectedYear, 11, 31, 23, 59, 59).getTime();
        return allSales.filter(s => s.timestamp >= start && s.timestamp <= end);
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate).getTime();
          const end = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          return allSales.filter(s => s.timestamp >= start && s.timestamp <= end);
        }
        return allSales;
      }
      default:
        return allSales;
    }
  }, [allSales, periodType, customStartDate, customEndDate, selectedYear]);

  const filteredSales = useMemo(() => {
    let filtered = getDateFilteredSales;
    
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(s => s.paymentMethod === paymentFilter);
    }
    
    if (selectedUserId !== 'all') {
      filtered = filtered.filter(s => s.cashierId === selectedUserId);
    }
    
    if (selectedBranchId !== 'all') {
      filtered = filtered.filter(s => s.branchId === selectedBranchId);
    }
    
    if (search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(sale => {
        const saleNumber = getSaleNumber(sale).toLowerCase();
        const client = getCustomerName(sale).toLowerCase();
        const cashier = getCashierName(sale).toLowerCase();
        return (
          saleNumber.includes(term) ||
          client.includes(term) ||
          cashier.includes(term) ||
          sale.items.some(item => item.name.toLowerCase().includes(term))
        );
      });
    }
    
    return filtered;
  }, [getDateFilteredSales, paymentFilter, selectedUserId, selectedBranchId, search]);

  const paginatedSales = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
      items: filteredSales.slice(start, end),
      totalCount: filteredSales.length,
      totalPages: Math.max(1, Math.ceil(filteredSales.length / itemsPerPage)),
    };
  }, [filteredSales, currentPage]);

  // Statistiques par catégorie
  const categoryStats = useMemo((): CategorySaleStats[] => {
    const categoryMap = new Map<string, CategorySaleStats>();
    const totalAmount = filteredSales.reduce((sum, sale) => sum + sale.total, 0);
    
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        let categoryId = item.categoryId || 'uncategorized';
        let categoryName = item.category || 'Non catégorisé';
        
        if (categories.length > 0 && item.categoryId) {
          const found = categories.find(c => c.id === item.categoryId);
          if (found) {
            categoryName = found.name;
          }
        }
        
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            categoryId,
            categoryName,
            totalAmount: 0,
            quantitySold: 0,
            saleCount: 0,
            percentage: 0,
            products: new Map(),
          });
        }
        
        const stats = categoryMap.get(categoryId)!;
        const itemTotal = (item.price || 0) * (item.quantity || 0);
        stats.totalAmount += itemTotal;
        stats.quantitySold += item.quantity || 0;
        stats.saleCount++;
        
        const productKey = item.productId || item.id || item.name;
        if (!stats.products.has(productKey)) {
          stats.products.set(productKey, {
            productName: item.name,
            quantity: 0,
            amount: 0,
          });
        }
        const productStats = stats.products.get(productKey)!;
        productStats.quantity += item.quantity || 0;
        productStats.amount += itemTotal;
      });
    });
    
    const result = Array.from(categoryMap.values());
    result.forEach(stats => {
      stats.percentage = totalAmount > 0 ? (stats.totalAmount / totalAmount) * 100 : 0;
    });
    
    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredSales, categories]);

  // userStats est utilisé dans la vue mais pas déclaré comme variable séparée
  // On va l'utiliser directement dans le JSX si besoin

  const branchStats = useMemo((): BranchStats[] => {
    const branchMap = new Map<string, BranchStats>();
    const uniqueUsersPerBranch = new Map<string, Set<string>>();
    
    filteredSales.forEach(sale => {
      const branchId = sale.branchId || 'main';
      const branchName = sale.branchName || 'Branche Principale';
      const userId = sale.cashierId || 'unknown';
      
      if (!branchMap.has(branchId)) {
        branchMap.set(branchId, {
          branchId,
          branchName,
          totalSales: 0,
          totalAmount: 0,
          averageTicket: 0,
          lastSaleDate: null,
          userCount: 0,
        });
        uniqueUsersPerBranch.set(branchId, new Set());
      }
      
      const stats = branchMap.get(branchId)!;
      stats.totalSales++;
      stats.totalAmount += sale.total;
      uniqueUsersPerBranch.get(branchId)!.add(userId);
      
      if (!stats.lastSaleDate || sale.timestamp > stats.lastSaleDate) {
        stats.lastSaleDate = sale.timestamp;
      }
    });
    
    const result = Array.from(branchMap.values());
    result.forEach(stats => {
      stats.averageTicket = stats.totalSales > 0 ? stats.totalAmount / stats.totalSales : 0;
      stats.userCount = uniqueUsersPerBranch.get(stats.branchId)?.size || 0;
    });
    
    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredSales]);

  const weeklyDetails = useMemo((): DailySaleDetail[] => {
    if (periodType !== 'week') return [];
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    
    const weekDays: DailySaleDetail[] = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() - mondayOffset + i);
      currentDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(currentDate);
      nextDate.setDate(currentDate.getDate() + 1);
      
      const dayStart = currentDate.getTime();
      const dayEnd = nextDate.getTime() - 1;
      
      const daySales = filteredSales.filter(s => s.timestamp >= dayStart && s.timestamp <= dayEnd);
      
      const salesDetails = daySales.map(sale => ({
        userId: sale.cashierId || 'unknown',
        userName: sale.cashierName || 'Inconnu',
        branchId: sale.branchId || 'main',
        branchName: sale.branchName || 'Branche Principale',
        amount: sale.total,
        count: 1,
        timestamp: sale.timestamp,
      }));
      
      const userMap = new Map<string, typeof salesDetails[0]>();
      salesDetails.forEach(detail => {
        if (!userMap.has(detail.userId)) {
          userMap.set(detail.userId, { ...detail, amount: 0, count: 0 });
        }
        const existing = userMap.get(detail.userId)!;
        existing.amount += detail.amount;
        existing.count += detail.count;
      });
      
      weekDays.push({
        date: currentDate.toISOString().split('T')[0],
        dayOfWeek: DAYS_FR[currentDate.getDay()],
        sales: Array.from(userMap.values()),
      });
    }
    
    return weekDays;
  }, [filteredSales, periodType]);

  const monthlyStats = useMemo((): MonthlyStats[] => {
    const monthMap = new Map<string, MonthlyStats>();
    
    filteredSales.forEach(sale => {
      const date = new Date(sale.timestamp);
      const month = date.getMonth();
      const year = date.getFullYear();
      const key = `${year}-${month}`;
      
      if (!monthMap.has(key)) {
        monthMap.set(key, {
          month,
          monthName: MONTHS_FR[month],
          year,
          totalAmount: 0,
          totalSales: 0,
          byUser: new Map(),
          byBranch: new Map(),
        });
      }
      
      const stats = monthMap.get(key)!;
      stats.totalAmount += sale.total;
      stats.totalSales++;
      
      const userId = sale.cashierId || 'unknown';
      const userName = sale.cashierName || 'Inconnu';
      if (!stats.byUser.has(userId)) {
        stats.byUser.set(userId, { userName, amount: 0, count: 0 });
      }
      const userStatsMonth = stats.byUser.get(userId)!;
      userStatsMonth.amount += sale.total;
      userStatsMonth.count++;
      
      const branchId = sale.branchId || 'main';
      const branchName = sale.branchName || 'Branche Principale';
      if (!stats.byBranch.has(branchId)) {
        stats.byBranch.set(branchId, { branchName, amount: 0, count: 0 });
      }
      const branchStatsMonth = stats.byBranch.get(branchId)!;
      branchStatsMonth.amount += sale.total;
      branchStatsMonth.count++;
    });
    
    return Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [filteredSales]);

  const globalStats = useMemo(() => {
    const totalAmount = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce(
      (sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0),
      0
    );
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;
    return { 
      totalAmount: totalAmount || 0, 
      totalSales: totalSales || 0, 
      totalItems: totalItems || 0, 
      averageTicket: averageTicket || 0 
    };
  }, [filteredSales]);

  // Données détaillées par utilisateur pour l'onglet
  const userSalesDetails = useMemo(() => {
    const detailsMap = new Map<string, UserSaleDetail[]>();
    
    filteredSales.forEach(sale => {
      const userId = sale.cashierId || 'unknown';
      if (selectedUserForDetail && selectedUserForDetail !== userId) return;
      
      const saleDate = new Date(sale.timestamp);
      const timeStr = formatDateTime(sale.timestamp);
      const hourStr = saleDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      
      const products = sale.items.map(item => ({
        name: item.name,
        quantity: item.quantity || 0,
        price: item.price || 0,
        total: (item.price || 0) * (item.quantity || 0),
      }));
      
      const detail: UserSaleDetail = {
        id: sale.id,
        time: timeStr,
        hour: hourStr,
        products,
        totalAmount: sale.total,
        timestamp: sale.timestamp,
      };
      
      if (!detailsMap.has(userId)) {
        detailsMap.set(userId, []);
      }
      detailsMap.get(userId)!.push(detail);
    });
    
    // Trier par date décroissante
    for (const [, details] of detailsMap) {
      details.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return detailsMap;
  }, [filteredSales, selectedUserForDetail]);

  // Statistiques produits par utilisateur (nombre de fois vendu)
  const userProductStats = useMemo(() => {
    const statsMap = new Map<string, Map<string, UserProductStats>>();
    
    filteredSales.forEach(sale => {
      const userId = sale.cashierId || 'unknown';
      const userName = sale.cashierName || 'Inconnu';
      void userName; 
      
      if (selectedUserForDetail && selectedUserForDetail !== userId) return;
      
      if (!statsMap.has(userId)) {
        statsMap.set(userId, new Map());
      }
      
      const userProducts = statsMap.get(userId)!;
      
      sale.items.forEach(item => {
        const productId = item.productId || item.id || item.name;
        const productName = item.name;
        const quantity = item.quantity || 0;
        const unitPrice = item.price || 0;
        const total = quantity * unitPrice;
        
        if (!userProducts.has(productId)) {
          userProducts.set(productId, {
            productId,
            productName,
            quantitySold: 0,
            timesSold: 0,
            totalAmount: 0,
            unitPrice: unitPrice,
          });
        }
        
        const stats = userProducts.get(productId)!;
        stats.quantitySold += quantity;
        stats.timesSold += 1;
        stats.totalAmount += total;
        // Garder le prix unitaire (moyen pondéré)
        stats.unitPrice = (stats.unitPrice * (stats.timesSold - 1) + unitPrice) / stats.timesSold;
      });
    });
    
    return statsMap;
  }, [filteredSales, selectedUserForDetail]);

  // Tableau de synthèse global (tous produits confondus)
  const productSummary = useMemo((): ProductSummary[] => {
    const productMap = new Map<string, ProductSummary>();
    
    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const productId = item.productId || item.id || item.name;
        const productName = item.name;
        const quantity = item.quantity || 0;
        const unitPrice = item.price || 0;
        const total = quantity * unitPrice;
        
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            productId,
            productName,
            totalQuantity: 0,
            unitPrice: 0,
            totalAmount: 0,
          });
        }
        
        const summary = productMap.get(productId)!;
        summary.totalQuantity += quantity;
        summary.totalAmount += total;
        // Prix unitaire moyen pondéré
        summary.unitPrice = summary.totalAmount / summary.totalQuantity;
      });
    });
    
    return Array.from(productMap.values()).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredSales]);

  function getSaleNumber(sale: Sale): string {
    return sale.receiptNumber || sale.id.slice(0, 8) || 'N/A';
  }

  function getCashierName(sale: Sale): string {
    return sale.cashierName || user?.nom_complet || user?.email || 'Inconnu';
  }

  function getCustomerName(sale: Sale): string {
    return sale.customerName || 'Passager';
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function formatDateTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'mobile_money': case 'mobile': return 'Mobile Money';
      case 'account': return 'Compte Client';
      default: return method || 'Non défini';
    }
  }

  function getPaymentMethodColor(method: string): string {
    switch (method) {
      case 'cash': return 'bg-emerald-100 text-emerald-700';
      case 'mobile_money': case 'mobile': return 'bg-blue-100 text-blue-700';
      case 'account': return 'bg-violet-100 text-violet-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  async function exportToCSV() {
    try {
      const headers = ['Numero', 'Date', 'Heure', 'Client', 'Caissier', 'Branche', 'Articles', 'Total (FC)', 'Paiement', 'Statut', 'Synchronisé'];

      const csvData = filteredSales.map((sale) => [
        getSaleNumber(sale),
        formatDate(sale.timestamp),
        new Date(sale.timestamp).toLocaleTimeString('fr-FR'),
        getCustomerName(sale),
        getCashierName(sale),
        sale.branchName || 'Branche Principale',
        sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0),
        (sale.total || 0).toFixed(2),
        getPaymentMethodLabel(sale.paymentMethod),
        sale.status === 'cancelled' ? 'Annulée' : 'Terminée',
        sale.synced ? 'Oui' : 'Non',
      ]);

      const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
      const csv = [headers, ...csvData].map(row => row.map(escapeCell).join(',')).join('\n');

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historique_ventes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: "Export réussi", description: "Le fichier CSV a été téléchargé" });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'exporter", variant: "destructive" });
    }
  }

  function printSale(sale: Sale) {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head><title>Vente #${getSaleNumber(sale)}</title><meta charset="UTF-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 20px; background: white; }
            .receipt { max-width: 320px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 16px; }
            .row { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 12px; }
            .total { border-top: 1px solid #000; padding-top: 8px; margin-top: 8px; font-weight: bold; }
            .meta { font-size: 11px; color: #666; margin: 2px 0; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h2>MEDIGEST PRO</h2>
              <div class="meta">Vente #${getSaleNumber(sale)}</div>
              <div class="meta">${formatDateTime(sale.timestamp)}</div>
              <div class="meta">Caissier: ${getCashierName(sale)}</div>
              <div class="meta">Branche: ${sale.branchName || 'Principale'}</div>
              <div class="meta">Client: ${getCustomerName(sale)}</div>
            </div>
            ${sale.items.map(item => `
              <div class="row">
                <span>${item.quantity} x ${escapeHtml(item.name)}</span>
                <span>${((item.price || 0) * (item.quantity || 0)).toFixed(2)} FC</span>
              </div>
            `).join('')}
            <div class="row total"><span>Total</span><span>${(sale.total || 0).toFixed(2)} FC</span></div>
            <div class="meta" style="text-align:center; margin-top:16px;">Paiement: ${getPaymentMethodLabel(sale.paymentMethod)}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  // Impression du détail utilisateur
  function printUserDetails(userId: string, userName: string) {
    const details = userSalesDetails.get(userId) || [];
    if (details.length === 0) return;
    
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;
    
    const totalAmount = details.reduce((sum, d) => sum + d.totalAmount, 0);
    const productStats = userProductStats.get(userId);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Détail ventes - ${userName}</title>
          <meta charset="UTF-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; background: white; }
            .container { max-width: 1200px; margin: 0 auto; }
            h1 { color: #1e293b; margin-bottom: 10px; }
            .header { border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
            .stats { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
            .stat-card { background: #f1f5f9; padding: 15px; border-radius: 12px; min-width: 150px; }
            .stat-card h3 { font-size: 12px; color: #64748b; margin-bottom: 5px; }
            .stat-card p { font-size: 24px; font-weight: bold; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
            th { background: #f8fafc; font-weight: bold; color: #1e293b; }
            .sale-row { background: #fef3c7; }
            .product-row td { background: white; }
            .total-row { background: #dcfce7; font-weight: bold; }
            .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Détail des ventes - ${escapeHtml(userName)}</h1>
              <p>Période: ${formatDate(new Date().getTime())}</p>
            </div>
            <div class="stats">
              <div class="stat-card"><h3>Nombre de ventes</h3><p>${details.length}</p></div>
              <div class="stat-card"><h3>CA total</h3><p>${formatPrice(totalAmount)}</p></div>
              <div class="stat-card"><h3>Ticket moyen</h3><p>${formatPrice(totalAmount / (details.length || 1))}</p></div>
            </div>
            <h3 style="margin-bottom: 15px;">📋 Ventes détaillées</h3>
            <table>
              <thead>
                <tr><th>Heure</th><th>Produit</th><th>Qté</th><th>Prix unit.</th><th>Montant</th></tr>
              </thead>
              <tbody>
                ${details.map(sale => `
                  <tr class="sale-row"><td colspan="5" style="background:#fef3c7;"><strong>🕐 ${sale.time}</strong> - Total: ${formatPrice(sale.totalAmount)}</td></tr>
                  ${sale.products.map(prod => `
                    <tr class="product-row">
                      <td style="padding-left: 20px;"></td>
                      <td>${escapeHtml(prod.name)}</td>
                      <td>${prod.quantity}</td>
                      <td>${formatPrice(prod.price)}</td>
                      <td>${formatPrice(prod.total)}</td>
                    </tr>
                  `).join('')}
                `).join('')}
              </tbody>
            </table>
            ${productStats && productStats.size > 0 ? `
              <h3 style="margin-bottom: 15px;">📊 Statistiques produits</h3>
              <table>
                <thead><tr><th>Produit</th><th>Qté totale</th><th>Nb ventes</th><th>Prix unit. moyen</th><th>Montant total</th></tr></thead>
                <tbody>
                  ${Array.from(productStats.values()).map(stat => `
                    <tr>
                      <td>${escapeHtml(stat.productName)}</td>
                      <td>${stat.quantitySold}</td>
                      <td>${stat.timesSold}</td>
                      <td>${formatPrice(stat.unitPrice)}</td>
                      <td>${formatPrice(stat.totalAmount)}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row"><td colspan="4"><strong>Total général</strong></td><td><strong>${formatPrice(totalAmount)}</strong></td></tr>
                </tbody>
              </table>
            ` : ''}
            <div class="footer">Document généré le ${new Date().toLocaleString('fr-FR')}</div>
          </div>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function resetFilters() {
    setSearch('');
    setPeriodType('today');
    setPaymentFilter('all');
    setSelectedUserId('all');
    setSelectedBranchId('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
    setSelectedUserForDetail(null);
  }

  const isLoading = loading || storeLoading;

  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    allSales.forEach(sale => {
      if (sale.cashierId && sale.cashierName) {
        users.set(sale.cashierId, sale.cashierName);
      }
    });
    return Array.from(users.entries()).map(([id, name]) => ({ id, name }));
  }, [allSales]);

  const uniqueBranches = useMemo(() => {
    const branches = new Map<string, string>();
    allSales.forEach(sale => {
      if (sale.branchId && sale.branchName) {
        branches.set(sale.branchId, sale.branchName);
      }
    });
    return Array.from(branches.entries()).map(([id, name]) => ({ id, name }));
  }, [allSales]);

  return (
    <div className="min-h-screen bg-slate-50">
      {pendingCount > 0 && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            {pendingCount} vente(s) en attente de synchronisation
          </div>
          <button onClick={handleRetryFailed} className="rounded-lg bg-white/20 px-3 py-1 text-xs hover:bg-white/30">
            Réessayer
          </button>
        </div>
      )}

      {!isOnline && pendingCount === 0 && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          <WifiOff size={16} /> Mode hors-ligne - Données locales uniquement
        </div>
      )}

      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/pos" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 md:text-2xl">Historique des ventes</h1>
              <p className="text-sm text-slate-400">Statistiques par utilisateur, branche, catégorie et période</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={resetFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
              Réinitialiser
            </button>
            <button onClick={handleRefresh} disabled={isLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Actualiser
            </button>
            <button onClick={exportToCSV} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              <Download size={18} /> Exporter CSV
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {/* Filtres */}
        <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select
              value={periodType}
              onChange={(e) => { setPeriodType(e.target.value as PeriodType); setCurrentPage(1); }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Aujourd'hui</option>
              <option value="week">Cette semaine</option>
              <option value="month">Ce mois</option>
              <option value="year">Année ({selectedYear})</option>
              <option value="custom">Personnalisé</option>
            </select>

            {periodType === 'year' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            )}

            {periodType === 'custom' && (
              <>
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" />
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3" />
              </>
            )}

            <select value={paymentFilter} onChange={(e) => { setPaymentFilter(e.target.value); setCurrentPage(1); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Tous paiements</option>
              <option value="cash">Espèces</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="account">Compte Client</option>
            </select>

            <select value={selectedUserId} onChange={(e) => { setSelectedUserId(e.target.value); setCurrentPage(1); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Tous les utilisateurs</option>
              {uniqueUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>

            <select value={selectedBranchId} onChange={(e) => { setSelectedBranchId(e.target.value); setCurrentPage(1); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">Toutes les branches</option>
              {uniqueBranches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {/* Statistiques globales */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100"><TrendingUp size={20} className="text-blue-600" /></div>
              <div><p className="text-xs text-slate-400">Chiffre d'affaires</p><p className="text-xl font-black text-slate-800">{formatPrice(globalStats.totalAmount)}</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100"><Package size={20} className="text-emerald-600" /></div>
              <div><p className="text-xs text-slate-400">Articles vendus</p><p className="text-xl font-black text-slate-800">{globalStats.totalItems}</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100"><Users size={20} className="text-violet-600" /></div>
              <div><p className="text-xs text-slate-400">Nombre de ventes</p><p className="text-xl font-black text-slate-800">{globalStats.totalSales}</p></div>
            </div>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100"><CreditCard size={20} className="text-amber-600" /></div>
              <div><p className="text-xs text-slate-400">Ticket moyen</p><p className="text-xl font-black text-slate-800">{formatPrice(globalStats.averageTicket)}</p></div>
            </div>
          </div>
        </div>

        {/* Navigation onglets */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200">
          <button onClick={() => setViewMode('sales')} className={`px-4 py-2 font-semibold transition-colors ${viewMode === 'sales' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            📋 Ventes
          </button>
          <button onClick={() => { setViewMode('users'); setSelectedUserForDetail(null); }} className={`px-4 py-2 font-semibold transition-colors ${viewMode === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            👥 Par Utilisateur
          </button>
          <button onClick={() => setViewMode('branches')} className={`px-4 py-2 font-semibold transition-colors ${viewMode === 'branches' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            🏪 Par Branche
          </button>
          <button onClick={() => setViewMode('categories')} className={`px-4 py-2 font-semibold transition-colors ${viewMode === 'categories' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            📁 Par Catégorie
          </button>
          <button onClick={() => setViewMode('analytics')} className={`px-4 py-2 font-semibold transition-colors ${viewMode === 'analytics' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}>
            📊 Analyses
          </button>
        </div>

        {/* Vue Ventes */}
        {viewMode === 'sales' && (
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 md:p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><Clock size={20} className="text-blue-600" /> Transactions ({paginatedSales.totalCount})</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="flex items-center justify-center p-10 text-slate-400"><Loader2 className="mr-2 animate-spin" size={20} /> Chargement...</div>
              ) : paginatedSales.items.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Aucune vente trouvée</div>
              ) : (
                paginatedSales.items.map((sale) => (
                  <div key={`${sale.isLocal ? 'local-' : 'api-'}${sale.id}`} className="p-4 transition-colors hover:bg-slate-50 md:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-600">#{getSaleNumber(sale)}</span>
                          {!sale.synced && <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700"><Loader2 size={10} className="mr-1 inline animate-spin" /> En attente</span>}
                          <span className="text-sm text-slate-400">{formatDateTime(sale.timestamp)}</span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentMethodColor(sale.paymentMethod)}`}>{getPaymentMethodLabel(sale.paymentMethod)}</span>
                          {sale.status === 'cancelled' && <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">Annulée</span>}
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                          <div><p className="text-xs text-slate-400">Client</p><p className="font-semibold text-slate-800">{getCustomerName(sale)}</p></div>
                          <div><p className="text-xs text-slate-400">Caissier</p><p className="font-semibold text-slate-800">{getCashierName(sale)}</p></div>
                          <div><p className="text-xs text-slate-400">Branche</p><p className="font-semibold text-slate-800">{sale.branchName || 'Principale'}</p></div>
                          <div><p className="text-xs text-slate-400">Articles</p><p className="font-semibold text-slate-800">{sale.items.reduce((sum, item) => sum + (item.quantity || 0), 0)}</p></div>
                          <div><p className="text-xs text-slate-400">Montant</p><p className="text-lg font-black text-blue-600">{formatPrice(sale.total || 0)}</p></div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => setSelectedSale(sale)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Voir détails"><Eye size={18} /></button>
                        <button onClick={() => printSale(sale)} className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600" title="Imprimer"><Printer size={18} /></button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {paginatedSales.totalPages > 1 && (
              <div className="flex flex-col gap-4 border-t border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-slate-400">Affichage {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, paginatedSales.totalCount)} sur {paginatedSales.totalCount} ventes</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={18} /></button>
                  <span className="px-3 py-2 text-sm font-medium text-slate-700">Page {currentPage} / {paginatedSales.totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(paginatedSales.totalPages, p + 1))} disabled={currentPage === paginatedSales.totalPages} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={18} /></button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Vue Utilisateurs - NOUVELLE VERSION */}
        {viewMode === 'users' && (
          <div className="space-y-6">
            {/* Sélecteur d'utilisateur */}
            <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center gap-4">
                <label className="font-semibold text-slate-700">Sélectionner un utilisateur :</label>
                <select
                  value={selectedUserForDetail || ''}
                  onChange={(e) => setSelectedUserForDetail(e.target.value || null)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Tous les utilisateurs --</option>
                  {uniqueUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {selectedUserForDetail && (
                  <button
                    onClick={() => printUserDetails(selectedUserForDetail, uniqueUsers.find(u => u.id === selectedUserForDetail)?.name || 'Utilisateur')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
                  >
                    <Printer size={18} /> Imprimer
                  </button>
                )}
              </div>
            </div>

            {/* Onglets internes */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-white rounded-t-3xl px-4 pt-2">
              <button
                onClick={() => setUserViewTab('details')}
                className={`px-4 py-2 font-semibold transition-colors ${userViewTab === 'details' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FileText size={16} className="inline mr-1" /> Détail des ventes
              </button>
              <button
                onClick={() => setUserViewTab('stats')}
                className={`px-4 py-2 font-semibold transition-colors ${userViewTab === 'stats' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <BarChart3 size={16} className="inline mr-1" /> Statistiques produits
              </button>
              <button
                onClick={() => setUserViewTab('summary')}
                className={`px-4 py-2 font-semibold transition-colors ${userViewTab === 'summary' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List size={16} className="inline mr-1" /> Synthèse générale
              </button>
            </div>

            {/* Onglet 1: Détail des ventes par utilisateur */}
{userViewTab === 'details' && (
  <section className="overflow-hidden rounded-b-3xl rounded-tr-3xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
        <Clock size={20} className="text-blue-600" /> 
        Détail des ventes
        {selectedUserForDetail && <span className="text-sm font-normal text-slate-500"> - {uniqueUsers.find(u => u.id === selectedUserForDetail)?.name}</span>}
      </h2>
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from(userSalesDetails.entries()).length === 0 ? (
        <div className="p-10 text-center text-slate-400">Aucune vente trouvée pour cet utilisateur</div>
      ) : (
        Array.from(userSalesDetails.entries()).map(([userId, sales]) => {
          const userName = uniqueUsers.find(u => u.id === userId)?.name || 'Utilisateur inconnu';
          const userTotal = sales.reduce((sum, s) => sum + s.totalAmount, 0);
          return (
            <div key={userId} className="p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                    <User size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{userName}</h3>
                    <p className="text-xs text-slate-400">
                      ID: {userId} · {sales.length} vente(s) · Total: {formatPrice(userTotal)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => printUserDetails(userId, userName)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
                  title="Imprimer"
                >
                  <Printer size={18} />
                </button>
              </div>
              
              {/* Tableau des ventes */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Heure</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produit</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Qté</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sales.map((sale) => (
                      <React.Fragment key={sale.id}>
                        <tr className="bg-amber-50">
                          <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-amber-700">
                            🕐 {sale.time} - Total: {formatPrice(sale.totalAmount)}
                          </td>
                        </tr>
                        {sale.products.map((product, pIdx) => (
                          <tr key={`${sale.id}-${pIdx}`} className="hover:bg-slate-50">
                            {pIdx === 0 && <td rowSpan={sale.products.length} className="px-4 py-2 text-sm text-slate-500 align-top">{sale.hour}</td>}
                            <td className="px-4 py-2 text-sm text-slate-700">{product.name}</td>
                            <td className="px-4 py-2 text-center text-sm text-slate-600">{product.quantity}</td>
                            <td className="px-4 py-2 text-right text-sm font-medium text-emerald-600">{formatPrice(product.total)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr className="bg-green-50 font-bold">
                      <td colSpan={3} className="px-4 py-3 text-right">TOTAL GÉNÉRAL</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatPrice(userTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  </section>
)}

{/* Onglet 2: Statistiques produits par utilisateur */}
{userViewTab === 'stats' && (
  <section className="overflow-hidden rounded-b-3xl rounded-tr-3xl border border-slate-100 bg-white shadow-sm">
    <div className="border-b border-slate-100 p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
        <BarChart3 size={20} className="text-blue-600" /> 
        Statistiques produits par utilisateur
        <span className="text-sm font-normal text-slate-500">(Nombre de fois chaque produit a été vendu)</span>
      </h2>
    </div>
    <div className="divide-y divide-slate-100">
      {Array.from(userProductStats.entries()).length === 0 ? (
        <div className="p-10 text-center text-slate-400">Aucune donnée produit disponible</div>
      ) : (
        Array.from(userProductStats.entries()).map(([userId, products]) => {
          const userName = uniqueUsers.find(u => u.id === userId)?.name || 'Utilisateur inconnu';
          const userTotal = Array.from(products.values()).reduce((sum, p) => sum + p.totalAmount, 0);
          return (
            <div key={userId} className="p-4 md:p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
                  <User size={18} className="text-purple-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">
                    {userName}
                    <span className="ml-2 text-xs font-normal text-slate-400">(ID: {userId})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {products.size} produit(s) différent(s) · CA total: {formatPrice(userTotal)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produit</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Qté totale</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Nb fois vendu</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Prix unitaire</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Montant total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Array.from(products.values())
                      .sort((a, b) => b.timesSold - a.timesSold)
                      .map((product) => (
                        <tr key={product.productId} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-sm text-slate-700">{product.productName}</td>
                          <td className="px-4 py-2 text-center text-sm text-slate-600">{product.quantitySold}</td>
                          <td className="px-4 py-2 text-center">
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                              {product.timesSold} fois
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-slate-600">{formatPrice(product.unitPrice)}</td>
                          <td className="px-4 py-2 text-right text-sm font-medium text-emerald-600">{formatPrice(product.totalAmount)}</td>
                        </tr>
                      ))}
                    <tr className="bg-green-50 font-bold">
                      <td colSpan={4} className="px-4 py-3 text-right">TOTAL GÉNÉRAL</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatPrice(userTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  </section>
)}
            {/* Onglet 3: Synthèse générale (tous utilisateurs, tous produits) */}
            {userViewTab === 'summary' && (
              <section className="overflow-hidden rounded-b-3xl rounded-tr-3xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4 md:p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                    <ShoppingBag size={20} className="text-blue-600" /> 
                    Synthèse générale des ventes
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    Tous produits vendus - Quantités totales et montants
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produit</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Quantité vendue</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Prix unitaire moyen</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Montant total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productSummary.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-slate-400">Aucun produit vendu</td>
                        </tr>
                      ) : (
                        productSummary.map((product) => (
                          <tr key={product.productId} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-700">{product.productName}</td>
                            <td className="px-4 py-3 text-center text-sm text-slate-600">
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
                                {product.totalQuantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-slate-600">{formatPrice(product.unitPrice)}</td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-blue-600">{formatPrice(product.totalAmount)}</td>
                          </tr>
                        ))
                      )}
                      <tr className="bg-blue-50 font-bold">
                        <td className="px-4 py-4 text-right text-base" colSpan={3}>TOTAL GÉNÉRAL</td>
                        <td className="px-4 py-4 text-right text-xl font-black text-blue-700">{formatPrice(globalStats.totalAmount)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                
                {/* Récapitulatif supplémentaire */}
                <div className="border-t border-slate-100 bg-linear-to-r from-blue-50 to-indigo-50 p-4 md:p-5">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">Nombre total de produits</p>
                      <p className="text-xl font-bold text-slate-800">{productSummary.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Articles vendus</p>
                      <p className="text-xl font-bold text-slate-800">{globalStats.totalItems}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Nombre de ventes</p>
                      <p className="text-xl font-bold text-slate-800">{globalStats.totalSales}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">CA total</p>
                      <p className="text-xl font-bold text-emerald-600">{formatPrice(globalStats.totalAmount)}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Vue Branches */}
        {viewMode === 'branches' && (
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 md:p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><Store size={20} className="text-blue-600" /> Statistiques par branche</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {branchStats.length === 0 ? (
                <div className="p-10 text-center text-slate-400">Aucune donnée branche</div>
              ) : (
                branchStats.map((branch) => (
                  <div key={branch.branchId} className="p-4 md:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100"><Store size={18} className="text-emerald-600" /></div>
                        <div>
                          <h3 className="font-bold text-slate-800">{branch.branchName}</h3>
                          <p className="text-xs text-slate-400">{branch.userCount} utilisateur(s) actif(s)</p>
                        </div>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">Total ventes</p>
                        <p className="text-xl font-bold text-slate-800">{branch.totalSales}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">CA total</p>
                        <p className="text-xl font-bold text-emerald-600">{formatPrice(branch.totalAmount)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">Ticket moyen</p>
                        <p className="text-xl font-bold text-blue-600">{formatPrice(branch.averageTicket)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {/* Vue Catégories */}
        {viewMode === 'categories' && (
          <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 md:p-5">
              <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                <FolderTree size={20} className="text-blue-600" /> 
                Ventes par catégorie
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Total des ventes: <span className="font-bold text-blue-600">{formatPrice(globalStats.totalAmount)}</span>
              </p>
            </div>
            
            {categoryStats.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Aucune donnée de catégorie disponible</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categoryStats.map((category) => (
                  <div key={category.categoryId} className="p-4 md:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                          <FolderTree size={18} className="text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 text-lg">{category.categoryName}</h3>
                          <p className="text-xs text-slate-400">
                            {category.quantitySold} articles vendus · {category.saleCount} ventes concernées
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-600">{formatPrice(category.totalAmount)}</p>
                        <p className="text-xs text-slate-500">{category.percentage.toFixed(1)}% du CA total</p>
                      </div>
                    </div>
                    
                    <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div 
                        className="h-full rounded-full bg-linear-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                        style={{ width: `${category.percentage}%` }}
                      />
                    </div>
                    
                    {category.products.size > 0 && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="mb-2 text-sm font-semibold text-slate-600">
                          📦 Tous les produits vendus dans cette catégorie
                          <span className="ml-2 text-xs font-normal text-slate-400">
                            ({category.products.size} produit{category.products.size > 1 ? 's' : ''})
                          </span>
                        </p>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {Array.from(category.products.entries())
                            .sort((a, b) => b[1].amount - a[1].amount)
                            .map(([productId, product]) => (
                              <div key={productId} className="flex items-center justify-between border-b border-slate-200 pb-2 last:border-0 hover:bg-slate-100/50 p-2 rounded-lg transition-colors">
                                <div className="flex-1">
                                  <p className="font-medium text-slate-700">{product.productName}</p>
                                  <p className="text-xs text-slate-400">
                                    Quantité: {product.quantity} unité{product.quantity > 1 ? 's' : ''}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-emerald-600">{formatPrice(product.amount)}</p>
                                  <p className="text-xs text-slate-400">
                                    {((product.amount / category.totalAmount) * 100).toFixed(1)}% de la catégorie
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                <div className="bg-linear-to-r from-blue-50 to-indigo-50 p-4 md:p-5">
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-slate-500">Nombre de catégories</p>
                      <p className="text-xl font-bold text-slate-800">
                        {categoryStats.length}
                        {(() => {
                          const uncategorizedCount = categoryStats.filter(c => 
                            c.categoryId === 'uncategorized' || 
                            c.categoryName === 'Non catégorisé'
                          ).length;
                          return uncategorizedCount > 0 ? (
                            <span className="text-sm font-normal text-amber-600 ml-1">
                              (dont {uncategorizedCount} non catégorisée{uncategorizedCount > 1 ? 's' : ''})
                            </span>
                          ) : null;
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Catégorie principale</p>
                      <p className="font-bold text-blue-600">{categoryStats[0]?.categoryName || '-'}</p>
                      <p className="text-xs text-slate-500">{categoryStats[0]?.percentage.toFixed(1)}% du CA</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Articles vendus</p>
                      <p className="text-xl font-bold text-slate-800">
                        {categoryStats.reduce((sum, cat) => sum + cat.quantitySold, 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">CA total</p>
                      <p className="text-xl font-bold text-emerald-600">{formatPrice(globalStats.totalAmount)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-amber-50 p-3 text-center text-xs text-amber-700 border-t border-amber-100">
                  <p className="flex items-center justify-center gap-2">
                    📊 Toutes les ventes sont affichées • 
                    {categoryStats.some(c => c.categoryName === 'Non catégorisé') 
                      ? ' ✓ Les produits non catégorisés sont inclus' 
                      : ' Tous les produits sont visibles sans limitation'}
                  </p>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Vue Analyses */}
        {viewMode === 'analytics' && (
          <div className="space-y-6">
            {periodType === 'week' && weeklyDetails.length > 0 && (
              <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4 md:p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><Calendar size={20} className="text-blue-600" /> Détail de la semaine</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {weeklyDetails.map((day) => (
                    <div key={day.date} className="p-4">
                      <h3 className="mb-3 font-bold text-slate-700">{day.dayOfWeek} {new Date(day.date).toLocaleDateString('fr-FR')}</h3>
                      {day.sales.length === 0 ? (
                        <p className="text-sm text-slate-400">Aucune vente ce jour</p>
                      ) : (
                        <div className="space-y-2">
                          {day.sales.map((sale, idx) => (
                            <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2">
                              <div className="flex items-center gap-2">
                                <User size={14} className="text-slate-400" />
                                <span className="font-medium">{sale.userName}</span>
                              </div>
                              <div className="font-semibold text-emerald-600">{formatPrice(sale.amount)}</div>
                              <div className="text-xs text-slate-400">{sale.count} vente(s)</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {monthlyStats.length > 0 && (
              <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-4 md:p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-800"><BarChart3 size={20} className="text-blue-600" /> Statistiques mensuelles</h2>
                </div>
                <div className="divide-y divide-slate-100">
                  {monthlyStats.slice(0, 6).map((month) => (
                    <div key={`${month.year}-${month.month}`} className="p-4">
                      <h3 className="mb-3 font-bold text-slate-700">{month.monthName} {month.year}</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p>CA total: <span className="font-bold text-emerald-600">{formatPrice(month.totalAmount)}</span></p>
                          <p>Ventes: {month.totalSales}</p>
                          <p>Moyenne: {formatPrice(month.totalAmount / (month.totalSales || 1))}</p>
                        </div>
                        <div>
                          <p className="mb-2 text-sm font-semibold text-slate-600">Top utilisateurs</p>
                          <div className="space-y-1">
                            {Array.from(month.byUser.entries()).slice(0, 3).map(([userId, userStats]) => (
                              <div key={userId} className="rounded-lg bg-slate-50 p-2 text-sm">
                                <span className="font-medium">{userStats.userName}</span>: {formatPrice(userStats.amount)}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Modal détails */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600"><Receipt size={22} /></div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 md:text-xl">Détails vente #{getSaleNumber(selectedSale)}</h3>
                    <p className="text-sm text-slate-400">{formatDateTime(selectedSale.timestamp)}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedSale(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={20} /></button>
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-1 text-xs text-slate-400">Date</p><p className="font-bold text-slate-800">{formatDateTime(selectedSale.timestamp)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-1 text-xs text-slate-400">Caissier</p><p className="font-bold text-slate-800">{getCashierName(selectedSale)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-1 text-xs text-slate-400">Branche</p><p className="font-bold text-slate-800">{selectedSale.branchName || 'Principale'}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-1 text-xs text-slate-400">Client</p><p className="font-bold text-slate-800">{getCustomerName(selectedSale)}</p></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-1 text-xs text-slate-400">Paiement</p><span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentMethodColor(selectedSale.paymentMethod)}`}>{getPaymentMethodLabel(selectedSale.paymentMethod)}</span></div>
                <div className="rounded-2xl bg-slate-50 p-4"><p className="mb-1 text-xs text-slate-400">Total</p><p className="text-xl font-bold text-blue-600">{formatPrice(selectedSale.total || 0)}</p></div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <h4 className="font-bold text-slate-800">Articles</h4>
                </div>
                <div className="divide-y divide-slate-100">
                  {selectedSale.items.map((item, idx) => (
                    <div key={idx} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-800">
                            {item.name || 'Produit sans nom'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {item.quantity} × {(item.price || 0).toFixed(2)} FC
                            {item.code ? ` · ${item.code}` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-600">
                            {((item.price || 0) * (item.quantity || 0)).toFixed(2)} FC
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-5 md:p-6">
              <button onClick={() => printSale(selectedSale)} className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"><Printer size={18} /> Imprimer</button>
              <button onClick={() => setSelectedSale(null)} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700 hover:bg-slate-50"><X size={18} /> Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}