// stock_report.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid as MuiGrid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  FormControl,
  InputLabel,
  Select,
  Stack,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Divider,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  GetApp as ExportIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  Store as StoreIcon,
  Inventory as InventoryIcon,
  TrendingUp as TrendingUpIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  PictureAsPdf as PdfIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Types avec meilleure organisation
interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  available_quantity: number;
  alert_threshold: number;
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock';
  expiry_status: 'valid' | 'expiring_soon' | 'expired';
  expiry_date: string | null;
  branch_id: string | null;
  pharmacy_id: string;
  barcode?: string;
}

interface StockMovement {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  branch_id: string;
  branch_name: string;
  pharmacy_id: string;
  quantity_before: number;
  quantity_after: number;
  quantity_change: number;
  movement_type: 'sale' | 'purchase' | 'adjustment' | 'inventory' | 'transfer_in' | 'transfer_out';
  reason: string;
  reference: string;
  batch_number: string | null;
  selling_price: number;
  purchase_price: number;
  created_at: string;
  created_by: string;
  seller_name: string;
  sale_id: string | null;
}

interface User {
  id: string;
  email: string;
  nom_complet: string;
  role: string;
  branch_id: string | null;
  branch_name?: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  parent_pharmacy_id: string;
  is_main_branch: boolean;
}

interface DailyStockStats {
  date: string;
  stock_before: number;
  stock_after: number;
  quantity_sold: number;
  revenue: number;
  profit: number;
}

interface UserStockStats {
  user_id: string;
  user_name: string;
  branch_id: string;
  branch_name: string;
  total_quantity_sold: number;
  total_revenue: number;
  total_profit: number;
  sale_count: number;
  movements: StockMovement[];
  daily_stats: DailyStockStats[];
}

interface BranchStockStats {
  branch_id: string;
  branch_name: string;
  products_count: number;
  total_quantity: number;
  total_value: number;
  total_sold_30d: number;
  total_revenue_30d: number;
  out_of_stock_count: number;
  low_stock_count: number;
  users: UserStockStats[];
  daily_stats: DailyStockStats[];
}

interface FIFOSyncResult {
  product_id: string;
  product_name: string;
  initial_stock: number;
  remaining_stock: number;
  synced_quantity: number;
  ignored_quantity: number;
  transactions: {
    user_id: string;
    user_name: string;
    quantity: number;
    is_synced: boolean;
    sync_order: number;
    timestamp: string;
  }[];
}

interface StockReportData {
  products: Product[];
  movements: StockMovement[];
  branches: BranchStockStats[];
  users: UserStockStats[];
  fifo_results: FIFOSyncResult[];
  summary: {
    total_products: number;
    total_quantity: number;
    total_value: number;
    total_sold_period: number;
    total_revenue_period: number;
    total_profit_period: number;
    out_of_stock: number;
    low_stock: number;
    expired: number;
    expiring_soon: number;
  };
}

interface FilterState {
  startDate: Date | null;
  endDate: Date | null;
  branchId: string;
  userId: string;
  productId: string;
  movementType: string;
  searchTerm: string;
  groupBy: 'day' | 'week' | 'month' | 'year';
}

interface BranchesApiResponse {
  items: Branch[];
}

interface UsersApiResponse {
  items: User[];
}

interface ProductsApiResponse {
  products: Product[];
}

// Service pour les appels API
class StockReportService {
  private static async fetchWithAuth<T>(url: string, options?: RequestInit): Promise<T> {
    const token = localStorage.getItem('access_token');
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options?.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      
      // Vérifier si la réponse est du JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error('La réponse du serveur n\'est pas au format JSON');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erreur HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error (${url}):`, error);
      throw error;
    }
  }

  static async getBranches(): Promise<Branch[]> {
    const response = await this.fetchWithAuth<BranchesApiResponse>('/branches/');
    return response.items || [];
  }

  static async getUsers(): Promise<User[]> {
    const response = await this.fetchWithAuth<UsersApiResponse>('/users/');
    return response.items || [];
  }

  static async getProducts(): Promise<ProductsApiResponse> {
    return await this.fetchWithAuth<ProductsApiResponse>('/stock/?get_all=true');
  }

  static async getMovements(startDate: string, endDate: string, limit = 10000): Promise<StockMovement[]> {
    const response = await this.fetchWithAuth<StockMovement[]>(
      `/stock/movements?start_date=${startDate}&end_date=${endDate}&limit=${limit}`
    );
    return Array.isArray(response) ? response : [];
  }
}

// Composant principal
const StockReport: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StockReportData | null>(null);
  const [filteredData, setFilteredData] = useState<StockReportData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filters, setFilters] = useState<FilterState>({
    startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
    endDate: new Date(),
    branchId: '',
    userId: '',
    productId: '',
    movementType: '',
    searchTerm: '',
    groupBy: 'day',
  });
  const [expandedBranch, setExpandedBranch] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Calculer les statistiques par branche (memoized)
  const calculateBranchStats = useCallback((products: Product[], movements: StockMovement[], branchesList: Branch[]): BranchStockStats[] => {
    const branchMap = new Map<string, BranchStockStats>();
    
    branchesList.forEach(branch => {
      branchMap.set(branch.id, {
        branch_id: branch.id,
        branch_name: branch.name,
        products_count: 0,
        total_quantity: 0,
        total_value: 0,
        total_sold_30d: 0,
        total_revenue_30d: 0,
        out_of_stock_count: 0,
        low_stock_count: 0,
        users: [],
        daily_stats: [],
      });
    });

    products.forEach(product => {
      const branchId = product.branch_id;
      if (branchId && branchMap.has(branchId)) {
        const stats = branchMap.get(branchId)!;
        stats.products_count++;
        stats.total_quantity += product.quantity || 0;
        stats.total_value += (product.selling_price || 0) * (product.quantity || 0);
        if (product.stock_status === 'out_of_stock') stats.out_of_stock_count++;
        if (product.stock_status === 'low_stock') stats.low_stock_count++;
      }
    });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    movements.forEach(movement => {
      const branchId = movement.branch_id;
      if (branchId && branchMap.has(branchId) && movement.movement_type === 'sale') {
        const stats = branchMap.get(branchId)!;
        const movementDate = new Date(movement.created_at);
        if (movementDate >= thirtyDaysAgo) {
          stats.total_sold_30d += Math.abs(movement.quantity_change);
          stats.total_revenue_30d += (movement.selling_price || 0) * Math.abs(movement.quantity_change);
        }
      }
    });

    // Calculer les daily stats pour chaque branche
    branchMap.forEach((stats, branchId) => {
      const branchMovements = movements.filter(m => m.branch_id === branchId && m.movement_type === 'sale');
      stats.daily_stats = calculateDailyStats(branchMovements, filters.groupBy);
    });

    return Array.from(branchMap.values());
  }, [filters.groupBy]);

  // Calculer les statistiques par utilisateur (memoized)
  const calculateUserStats = useCallback((movements: StockMovement[], usersList: User[]): UserStockStats[] => {
    const userMap = new Map<string, UserStockStats>();
    
    usersList.forEach(user => {
      userMap.set(user.id, {
        user_id: user.id,
        user_name: user.nom_complet,
        branch_id: user.branch_id || '',
        branch_name: user.branch_name || '',
        total_quantity_sold: 0,
        total_revenue: 0,
        total_profit: 0,
        sale_count: 0,
        movements: [],
        daily_stats: [],
      });
    });

    movements.forEach(movement => {
      if (movement.movement_type === 'sale' && movement.created_by && userMap.has(movement.created_by)) {
        const stats = userMap.get(movement.created_by)!;
        const quantity = Math.abs(movement.quantity_change);
        const revenue = (movement.selling_price || 0) * quantity;
        const profit = ((movement.selling_price || 0) - (movement.purchase_price || 0)) * quantity;
        
        stats.total_quantity_sold += quantity;
        stats.total_revenue += revenue;
        stats.total_profit += profit;
        stats.sale_count++;
        stats.movements.push(movement);
      }
    });

    return Array.from(userMap.values())
      .filter(u => u.total_quantity_sold > 0)
      .sort((a, b) => b.total_quantity_sold - a.total_quantity_sold);
  }, []);

  // Calculer les statistiques quotidiennes
  const calculateDailyStats = useCallback((movements: StockMovement[], groupBy: string): DailyStockStats[] => {
    const dailyMap = new Map<string, DailyStockStats>();
    
    const sortedMovements = [...movements].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    let currentStock = 0;
    
    sortedMovements.forEach(movement => {
      const date = new Date(movement.created_at);
      let key: string;
      
      switch(groupBy) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'year':
          key = `${date.getFullYear()}`;
          break;
        default:
          key = movement.created_at.split('T')[0];
      }
      
      const stockBefore = currentStock;
      const quantityChange = movement.quantity_change;
      currentStock += quantityChange;
      const stockAfter = currentStock;
      
      const existing = dailyMap.get(key) || {
        date: key,
        stock_before: stockBefore,
        stock_after: stockAfter,
        quantity_sold: 0,
        revenue: 0,
        profit: 0,
      };
      
      if (movement.movement_type === 'sale') {
        existing.quantity_sold += Math.abs(quantityChange);
        existing.revenue += (movement.selling_price || 0) * Math.abs(quantityChange);
        existing.profit += ((movement.selling_price || 0) - (movement.purchase_price || 0)) * Math.abs(quantityChange);
      }
      
      existing.stock_before = Math.min(existing.stock_before, stockBefore);
      existing.stock_after = Math.max(existing.stock_after, stockAfter);
      
      dailyMap.set(key, existing);
    });
    
    return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, []);

  // Calculer le résumé global
  const calculateSummary = useCallback((products: Product[], movements: StockMovement[]) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let total_sold_period = 0;
    let total_revenue_period = 0;
    let total_profit_period = 0;
    
    movements.forEach(m => {
      if (m.movement_type === 'sale' && new Date(m.created_at) >= thirtyDaysAgo) {
        const quantity = Math.abs(m.quantity_change);
        total_sold_period += quantity;
        total_revenue_period += (m.selling_price || 0) * quantity;
        total_profit_period += ((m.selling_price || 0) - (m.purchase_price || 0)) * quantity;
      }
    });
    
    const now = new Date();
    const expiringSoon = products.filter(p => {
      if (!p.expiry_date) return false;
      const expiryDate = new Date(p.expiry_date);
      const daysUntil = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil >= 0 && daysUntil <= 30;
    }).length;
    
    return {
      total_products: products.length,
      total_quantity: products.reduce((sum, p) => sum + (p.quantity || 0), 0),
      total_value: products.reduce((sum, p) => sum + ((p.selling_price || 0) * (p.quantity || 0)), 0),
      total_sold_period,
      total_revenue_period,
      total_profit_period,
      out_of_stock: products.filter(p => p.stock_status === 'out_of_stock').length,
      low_stock: products.filter(p => p.stock_status === 'low_stock').length,
      expired: products.filter(p => p.expiry_status === 'expired').length,
      expiring_soon: expiringSoon,
    };
  }, []);

  // Exécuter la synchronisation FIFO
  const executeFIFOSync = useCallback((movements: StockMovement[], products: Product[], usersList: User[]): FIFOSyncResult[] => {
    const productMovements = new Map<string, StockMovement[]>();
    
    movements.forEach(m => {
      if (m.movement_type === 'sale') {
        if (!productMovements.has(m.product_id)) {
          productMovements.set(m.product_id, []);
        }
        productMovements.get(m.product_id)!.push(m);
      }
    });
    
    const results: FIFOSyncResult[] = [];
    
    for (const [productId, productMovementsList] of productMovements) {
      const product = products.find(p => p.id === productId);
      if (!product) continue;
      
      const sortedMovements = [...productMovementsList].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      let remainingStock = product.quantity || 0;
      const totalSold = sortedMovements.reduce((sum, m) => sum + Math.abs(m.quantity_change), 0);
      const totalInitialStock = remainingStock + totalSold;
      let syncedQuantity = 0;
      let ignoredQuantity = 0;
      
      const transactions = sortedMovements.map((movement, index) => {
        const quantity = Math.abs(movement.quantity_change);
        const isSynced = quantity <= remainingStock;
        
        if (isSynced) {
          syncedQuantity += quantity;
          remainingStock -= quantity;
        } else {
          ignoredQuantity += quantity;
        }
        
        const user = usersList.find(u => u.id === movement.created_by);
        
        return {
          user_id: movement.created_by || '',
          user_name: user?.nom_complet || movement.seller_name || 'Inconnu',
          quantity,
          is_synced: isSynced,
          sync_order: index + 1,
          timestamp: movement.created_at,
        };
      });
      
      results.push({
        product_id: productId,
        product_name: product.name,
        initial_stock: totalInitialStock,
        remaining_stock: remainingStock,
        synced_quantity: syncedQuantity,
        ignored_quantity: ignoredQuantity,
        transactions,
      });
    }
    
    return results;
  }, []);

  // Charger les données
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Charger toutes les données en parallèle
      const [branchesData, usersData, productsData, movementsData] = await Promise.all([
        StockReportService.getBranches().catch(err => {
          console.error('Erreur chargement branches:', err);
          return [];
        }),
        StockReportService.getUsers().catch(err => {
          console.error('Erreur chargement users:', err);
          return [];
        }),
        StockReportService.getProducts().catch(err => {
          console.error('Erreur chargement produits:', err);
          throw new Error('Impossible de charger les produits');
        }),
        (async () => {
          if (filters.startDate && filters.endDate) {
            const startDate = filters.startDate.toISOString().split('T')[0];
            const endDate = filters.endDate.toISOString().split('T')[0];
            return StockReportService.getMovements(startDate, endDate).catch(err => {
              console.error('Erreur chargement mouvements:', err);
              return [];
            });
          }
          return [];
        })()
      ]);
      
      setBranches(branchesData);
      setUsers(usersData);
      
      // Filtrer les mouvements par type
      let movements = movementsData;
      if (filters.movementType && movementsData) {
        movements = movementsData.filter(m => m.movement_type === filters.movementType);
      }
      
      const products = productsData.products || [];
      
      // Calculer les statistiques
      const branchStats = calculateBranchStats(products, movements, branchesData);
      const userStats = calculateUserStats(movements, usersData);
      const summary = calculateSummary(products, movements);
      const fifoResults = executeFIFOSync(movements, products, usersData);
      
      const reportData: StockReportData = {
        products,
        movements,
        branches: branchStats,
        users: userStats,
        fifo_results: fifoResults,
        summary,
      };
      
      setData(reportData);
      setFilteredData(reportData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erreur lors du chargement des données';
      setError(errorMessage);
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate, filters.movementType, calculateBranchStats, calculateUserStats, calculateSummary, executeFIFOSync]);

  // Appliquer les filtres
  const applyFilters = useCallback(() => {
    if (!data) return;
    
    let filteredMovements = [...data.movements];
    let filteredProducts = [...data.products];
    
    if (filters.branchId) {
      filteredMovements = filteredMovements.filter(m => m.branch_id === filters.branchId);
      filteredProducts = filteredProducts.filter(p => p.branch_id === filters.branchId);
    }
    
    if (filters.userId) {
      filteredMovements = filteredMovements.filter(m => m.created_by === filters.userId);
    }
    
    if (filters.productId) {
      filteredMovements = filteredMovements.filter(m => m.product_id === filters.productId);
      filteredProducts = filteredProducts.filter(p => p.id === filters.productId);
    }
    
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filteredProducts = filteredProducts.filter(p => 
        p.name.toLowerCase().includes(term) || 
        p.code?.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
      );
      filteredMovements = filteredMovements.filter(m => 
        m.product_name.toLowerCase().includes(term) ||
        m.product_code.toLowerCase().includes(term)
      );
    }
    
    const branchStats = calculateBranchStats(filteredProducts, filteredMovements, branches);
    const userStats = calculateUserStats(filteredMovements, users);
    const summary = calculateSummary(filteredProducts, filteredMovements);
    
    setFilteredData({
      ...data,
      products: filteredProducts,
      movements: filteredMovements,
      branches: branchStats,
      users: userStats,
      summary,
    });
  }, [data, filters, branches, users, calculateBranchStats, calculateUserStats, calculateSummary]);

  // Réinitialiser les filtres
  const resetFilters = useCallback(() => {
    setFilters({
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
      endDate: new Date(),
      branchId: '',
      userId: '',
      productId: '',
      movementType: '',
      searchTerm: '',
      groupBy: 'day',
    });
  }, []);

  // Exporter en PDF
  const exportToPDF = useCallback(() => {
    if (!filteredData) return;
    
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text('Rapport de Gestion de Stock', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, pageWidth / 2, 22, { align: 'center' });
    
    doc.setFontSize(12);
    doc.text('Résumé Global', 14, 35);
    autoTable(doc, {
      startY: 40,
      head: [['Produits', 'Quantité totale', 'Valeur totale', 'Vendus (30j)', 'CA (30j)', 'Profit (30j)']],
      body: [[
        filteredData.summary.total_products.toString(),
        filteredData.summary.total_quantity.toString(),
        `${filteredData.summary.total_value.toLocaleString()} Fc`,
        filteredData.summary.total_sold_period.toString(),
        `${filteredData.summary.total_revenue_period.toLocaleString()} Fc`,
        `${filteredData.summary.total_profit_period.toLocaleString()} Fc`,
      ]],
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
    });
    
    let y = (doc as any).lastAutoTable.finalY + 10;
    doc.text('Alertes', 14, y);
    autoTable(doc, {
      startY: y + 5,
      head: [['Type', 'Nombre']],
      body: [
        ['Rupture de stock', filteredData.summary.out_of_stock.toString()],
        ['Stock faible', filteredData.summary.low_stock.toString()],
        ['Expirés', filteredData.summary.expired.toString()],
        ['Expiration proche', filteredData.summary.expiring_soon.toString()],
      ],
      theme: 'striped',
      headStyles: { fillColor: [231, 76, 60] },
    });
    
    // Statistiques par branche
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y + 50 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = 20;
    }
    doc.text('Statistiques par Branche', 14, y);
    autoTable(doc, {
      startY: y + 5,
      head: [['Branche', 'Produits', 'Quantité', 'Valeur', 'Vendus (30j)', 'CA (30j)']],
      body: filteredData.branches.map(b => [
        b.branch_name,
        b.products_count.toString(),
        b.total_quantity.toString(),
        `${b.total_value.toLocaleString()} Fc`,
        b.total_sold_30d.toString(),
        `${b.total_revenue_30d.toLocaleString()} Fc`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [46, 204, 113] },
    });
    
    // Statistiques par utilisateur
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y + 50 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = 20;
    }
    doc.text('Statistiques par Utilisateur', 14, y);
    autoTable(doc, {
      startY: y + 5,
      head: [['Utilisateur', 'Branche', 'Ventes', 'Quantité', 'CA', 'Profit']],
      body: filteredData.users.map(u => [
        u.user_name,
        u.branch_name,
        u.sale_count.toString(),
        u.total_quantity_sold.toString(),
        `${u.total_revenue.toLocaleString()} Fc`,
        `${u.total_profit.toLocaleString()} Fc`,
      ]),
      theme: 'striped',
      headStyles: { fillColor: [155, 89, 182] },
    });
    
    // Résultats FIFO
    y = (doc as any).lastAutoTable.finalY + 10;
    if (y + 50 > doc.internal.pageSize.getHeight()) {
      doc.addPage();
      y = 20;
    }
    doc.text('Synchronisation FIFO - Résultats', 14, y);
    autoTable(doc, {
      startY: y + 5,
      head: [['Produit', 'Stock initial', 'Synchro OK', 'Ignoré', 'Stock restant']],
      body: filteredData.fifo_results.map(r => [
        r.product_name,
        r.initial_stock.toString(),
        r.synced_quantity.toString(),
        r.ignored_quantity.toString(),
        r.remaining_stock.toString(),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [52, 73, 94] },
    });
    
    doc.save(`rapport_stock_${new Date().toISOString().split('T')[0]}.pdf`);
  }, [filteredData]);

  // Exporter en Excel
  const exportToExcel = useCallback(() => {
    if (!filteredData) return;
    
    const workbook = XLSX.utils.book_new();
    
    const productsSheet = XLSX.utils.json_to_sheet(
      filteredData.products.map(p => ({
        'Code': p.code,
        'Nom': p.name,
        'Catégorie': p.category,
        'Quantité': p.quantity,
        'Disponible': p.available_quantity,
        'Prix Achat': p.purchase_price,
        'Prix Vente': p.selling_price,
        'Valeur Stock': (p.selling_price || 0) * (p.quantity || 0),
        'Seuil Alerte': p.alert_threshold,
        'Statut Stock': p.stock_status,
        'Statut Expiration': p.expiry_status,
        'Date Expiration': p.expiry_date,
        'Branche': branches.find(b => b.id === p.branch_id)?.name || '',
      }))
    );
    XLSX.utils.book_append_sheet(workbook, productsSheet, 'Produits');
    
    const movementsSheet = XLSX.utils.json_to_sheet(
      filteredData.movements.map(m => ({
        'Date': new Date(m.created_at).toLocaleString('fr-FR'),
        'Produit': m.product_name,
        'Code': m.product_code,
        'Type': m.movement_type,
        'Quantité Avant': m.quantity_before,
        'Quantité Après': m.quantity_after,
        'Variation': m.quantity_change,
        'Prix Vente': m.selling_price,
        'Utilisateur': m.seller_name,
        'Branche': m.branch_name,
        'Raison': m.reason,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, movementsSheet, 'Mouvements');
    
    const branchesSheet = XLSX.utils.json_to_sheet(
      filteredData.branches.map(b => ({
        'Branche': b.branch_name,
        'Produits': b.products_count,
        'Quantité Totale': b.total_quantity,
        'Valeur Totale': b.total_value,
        'Vendus (30j)': b.total_sold_30d,
        'CA (30j)': b.total_revenue_30d,
        'Rupture Stock': b.out_of_stock_count,
        'Stock Faible': b.low_stock_count,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, branchesSheet, 'Branches');
    
    const usersSheet = XLSX.utils.json_to_sheet(
      filteredData.users.map(u => ({
        'Utilisateur': u.user_name,
        'Branche': u.branch_name,
        'Nombre Ventes': u.sale_count,
        'Quantité Vendue': u.total_quantity_sold,
        'CA': u.total_revenue,
        'Profit': u.total_profit,
      }))
    );
    XLSX.utils.book_append_sheet(workbook, usersSheet, 'Utilisateurs');
    
    const fifoSheet = XLSX.utils.json_to_sheet(
      filteredData.fifo_results.flatMap(r => 
        r.transactions.map(t => ({
          'Produit': r.product_name,
          'Utilisateur': t.user_name,
          'Quantité': t.quantity,
          'Synchro FIFO': t.is_synced ? 'OK' : 'Ignoré',
          'Ordre': t.sync_order,
          'Timestamp': new Date(t.timestamp).toLocaleString('fr-FR'),
        }))
      )
    );
    XLSX.utils.book_append_sheet(workbook, fifoSheet, 'FIFO');
    
    XLSX.writeFile(workbook, `rapport_stock_${new Date().toISOString().split('T')[0]}.xlsx`);
  }, [filteredData, branches]);

  // Effets
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // Memoized top products
  const topProducts = useMemo(() => {
    if (!filteredData) return [];
    
    const productSales = new Map<string, { quantity: number; revenue: number; currentStock: number; name: string }>();
    
    filteredData.movements
      .filter(m => m.movement_type === 'sale')
      .forEach(m => {
        const existing = productSales.get(m.product_id) || { quantity: 0, revenue: 0, currentStock: 0, name: m.product_name };
        existing.quantity += Math.abs(m.quantity_change);
        existing.revenue += (m.selling_price || 0) * Math.abs(m.quantity_change);
        const product = filteredData.products.find(p => p.id === m.product_id);
        existing.currentStock = product?.quantity || 0;
        productSales.set(m.product_id, existing);
      });
    
    return Array.from(productSales.entries())
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, 10);
  }, [filteredData]);

  // Memoized daily stats
  const dailyStatsCombined = useMemo(() => {
    if (!filteredData) return [];
    
    const dailyStatsMap = new Map<string, DailyStockStats>();
    filteredData.branches.forEach(b => {
      b.daily_stats.forEach(ds => {
        const existing = dailyStatsMap.get(ds.date);
        if (existing) {
          existing.quantity_sold += ds.quantity_sold;
          existing.revenue += ds.revenue;
          existing.profit += ds.profit;
        } else {
          dailyStatsMap.set(ds.date, { ...ds });
        }
      });
    });
    
    return Array.from(dailyStatsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredData]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={loadData}>
              Réessayer
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
        {/* En-tête */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                Gestion de Stock
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Suivi FIFO, ventes par utilisateur, statistiques par branche
              </Typography>
            </Box>
            <Stack direction="row" spacing={2}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PdfIcon />}
                onClick={exportToPDF}
              >
                Export PDF
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<ExportIcon />}
                onClick={exportToExcel}
              >
                Export Excel
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={loadData}
              >
                Actualiser
              </Button>
            </Stack>
          </Box>
        </Paper>

        {/* Cartes de résumé */}
        <MuiGrid container spacing={3} sx={{ mb: 3 }}>
          <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Produits
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {filteredData?.summary.total_products || 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {filteredData?.summary.total_quantity || 0} unités
                    </Typography>
                  </Box>
                  <InventoryIcon sx={{ fontSize: 40, color: '#3498db', opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </MuiGrid>
          <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Valeur du Stock
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {Math.round(filteredData?.summary.total_value || 0).toLocaleString()} Fc
                    </Typography>
                  </Box>
                  <TrendingUpIcon sx={{ fontSize: 40, color: '#2ecc71', opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </MuiGrid>
          <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Ventes (30j)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {filteredData?.summary.total_sold_period || 0}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {Math.round(filteredData?.summary.total_revenue_period || 0).toLocaleString()} Fc CA
                    </Typography>
                  </Box>
                  <StoreIcon sx={{ fontSize: 40, color: '#e67e22', opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </MuiGrid>
          <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography color="textSecondary" gutterBottom variant="body2">
                      Utilisateurs Actifs
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                      {filteredData?.users.length || 0}
                    </Typography>
                  </Box>
                  <PeopleIcon sx={{ fontSize: 40, color: '#9b59b6', opacity: 0.7 }} />
                </Box>
              </CardContent>
            </Card>
          </MuiGrid>
        </MuiGrid>

        {/* Filtres */}
        <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom>
            <FilterIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Filtres
          </Typography>
          <MuiGrid container spacing={2} sx={{ mt: 1 }}>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <DatePicker
                label="Date début"
                value={filters.startDate}
                onChange={(date: Date | null) => setFilters(prev => ({ ...prev, startDate: date }))}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <DatePicker
                label="Date fin"
                value={filters.endDate}
                onChange={(date: Date | null) => setFilters(prev => ({ ...prev, endDate: date }))}
                slotProps={{ textField: { fullWidth: true, size: 'small' } }}
              />
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Branche</InputLabel>
                <Select
                  value={filters.branchId}
                  onChange={(e) => setFilters(prev => ({ ...prev, branchId: e.target.value }))}
                  label="Branche"
                >
                  <MenuItem value="">Toutes</MenuItem>
                  {branches.map(branch => (
                    <MenuItem key={branch.id} value={branch.id}>{branch.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Utilisateur</InputLabel>
                <Select
                  value={filters.userId}
                  onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
                  label="Utilisateur"
                >
                  <MenuItem value="">Tous</MenuItem>
                  {users.map(user => (
                    <MenuItem key={user.id} value={user.id}>{user.nom_complet}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Type Mouvement</InputLabel>
                <Select
                  value={filters.movementType}
                  onChange={(e) => setFilters(prev => ({ ...prev, movementType: e.target.value }))}
                  label="Type Mouvement"
                >
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="sale">Vente</MenuItem>
                  <MenuItem value="purchase">Achat</MenuItem>
                  <MenuItem value="adjustment">Ajustement</MenuItem>
                  <MenuItem value="inventory">Inventaire</MenuItem>
                  <MenuItem value="transfer_in">Transfert Entrant</MenuItem>
                  <MenuItem value="transfer_out">Transfert Sortant</MenuItem>
                </Select>
              </FormControl>
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Grouper par</InputLabel>
                <Select
                  value={filters.groupBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, groupBy: e.target.value as FilterState['groupBy'] }))}
                  label="Grouper par"
                >
                  <MenuItem value="day">Jour</MenuItem>
                  <MenuItem value="week">Semaine</MenuItem>
                  <MenuItem value="month">Mois</MenuItem>
                  <MenuItem value="year">Année</MenuItem>
                </Select>
              </FormControl>
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size="small"
                label="Recherche"
                placeholder="Nom, code, code-barres..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon />
                      </InputAdornment>
                    ),
                  }
                }}
              />
            </MuiGrid>
            <MuiGrid size={{ xs: 12, sm: 6, md: 3 }}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                startIcon={<ClearIcon />}
                onClick={resetFilters}
                sx={{ height: 40 }}
              >
                Réinitialiser
              </Button>
            </MuiGrid>
          </MuiGrid>
        </Paper>

        {/* Onglets */}
        <Paper sx={{ borderRadius: 2 }}>
          <Tabs
            value={activeTab}
            onChange={(_: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
            sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
          >
            <Tab label="Vue d'ensemble" />
            <Tab label="Par Branche" />
            <Tab label="Par Utilisateur" />
            <Tab label="Mouvements" />
            <Tab label="Synchronisation FIFO" />
          </Tabs>

          {/* Onglet Vue d'ensemble */}
          {activeTab === 0 && filteredData && (
            <Box sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Top Produits Vendus (30j)
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 4 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Quantité Vendue</TableCell>
                      <TableCell align="right">CA</TableCell>
                      <TableCell align="right">Stock Actuel</TableCell>
                      <TableCell>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topProducts.map(([id, data]) => (
                      <TableRow key={id}>
                        <TableCell>{data.name}</TableCell>
                        <TableCell align="right">{data.quantity}</TableCell>
                        <TableCell align="right">{data.revenue.toLocaleString()} Fc</TableCell>
                        <TableCell align="right">{data.currentStock}</TableCell>
                        <TableCell>
                          <Chip
                            label={data.currentStock <= 0 ? 'Rupture' : data.currentStock <= 10 ? 'Stock faible' : 'Normal'}
                            size="small"
                            color={data.currentStock <= 0 ? 'error' : data.currentStock <= 10 ? 'warning' : 'success'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="h6" gutterBottom>
                Évolution du Stock
              </Typography>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell>Période</TableCell>
                      <TableCell align="right">Stock Début</TableCell>
                      <TableCell align="right">Vendus</TableCell>
                      <TableCell align="right">Stock Fin</TableCell>
                      <TableCell align="right">CA</TableCell>
                      <TableCell align="right">Profit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dailyStatsCombined.map(([date, stats]) => (
                      <TableRow key={date}>
                        <TableCell>{date}</TableCell>
                        <TableCell align="right">{stats.stock_before}</TableCell>
                        <TableCell align="right">{stats.quantity_sold}</TableCell>
                        <TableCell align="right">{stats.stock_after}</TableCell>
                        <TableCell align="right">{stats.revenue.toLocaleString()} Fc</TableCell>
                        <TableCell align="right">{stats.profit.toLocaleString()} Fc</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Onglet Par Branche */}
          {activeTab === 1 && filteredData && (
            <Box sx={{ p: 3 }}>
              {filteredData.branches.map(branch => (
                <Paper key={branch.branch_id} variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: '#f8f9fa',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => setExpandedBranch(expandedBranch === branch.branch_id ? null : branch.branch_id)}
                  >
                    <Typography variant="h6">
                      {branch.branch_name}
                    </Typography>
                    <Stack direction="row" spacing={3}>
                      <Typography variant="body2">
                        Produits: {branch.products_count} | Quantité: {branch.total_quantity}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        Valeur: {branch.total_value.toLocaleString()} Fc
                      </Typography>
                    </Stack>
                  </Box>
                  
                  {expandedBranch === branch.branch_id && (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Ventes (30j): {branch.total_sold_30d} unités | CA: {branch.total_revenue_30d.toLocaleString()} Fc
                      </Typography>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Évolution quotidienne
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell align="right">Stock Début</TableCell>
                              <TableCell align="right">Vendus</TableCell>
                              <TableCell align="right">Stock Fin</TableCell>
                              <TableCell align="right">CA</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {branch.daily_stats.map(stat => (
                              <TableRow key={stat.date}>
                                <TableCell>{stat.date}</TableCell>
                                <TableCell align="right">{stat.stock_before}</TableCell>
                                <TableCell align="right">{stat.quantity_sold}</TableCell>
                                <TableCell align="right">{stat.stock_after}</TableCell>
                                <TableCell align="right">{stat.revenue.toLocaleString()} Fc</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Paper>
              ))}
            </Box>
          )}

          {/* Onglet Par Utilisateur */}
          {activeTab === 2 && filteredData && (
            <Box sx={{ p: 3 }}>
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell>Utilisateur</TableCell>
                      <TableCell>Branche</TableCell>
                      <TableCell align="right">Ventes</TableCell>
                      <TableCell align="right">Quantité</TableCell>
                      <TableCell align="right">CA</TableCell>
                      <TableCell align="right">Profit</TableCell>
                      <TableCell align="center">Détails</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.users.map(user => (
                      <React.Fragment key={user.user_id}>
                        <TableRow>
                          <TableCell>{user.user_name}</TableCell>
                          <TableCell>{user.branch_name}</TableCell>
                          <TableCell align="right">{user.sale_count}</TableCell>
                          <TableCell align="right">{user.total_quantity_sold}</TableCell>
                          <TableCell align="right">{user.total_revenue.toLocaleString()} Fc</TableCell>
                          <TableCell align="right">{user.total_profit.toLocaleString()} Fc</TableCell>
                          <TableCell align="center">
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => setExpandedUser(expandedUser === user.user_id ? null : user.user_id)}
                            >
                              {expandedUser === user.user_id ? 'Masquer' : 'Voir détails'}
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedUser === user.user_id && (
                          <TableRow>
                            <TableCell colSpan={7} sx={{ p: 2, bgcolor: '#fafafa' }}>
                              <Typography variant="subtitle2" gutterBottom>
                                Détail des ventes
                              </Typography>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Produit</TableCell>
                                    <TableCell align="right">Quantité</TableCell>
                                    <TableCell align="right">Prix Unitaire</TableCell>
                                    <TableCell align="right">Total</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {user.movements.slice(0, 20).map(m => (
                                    <TableRow key={m.id}>
                                      <TableCell>{new Date(m.created_at).toLocaleString('fr-FR')}</TableCell>
                                      <TableCell>{m.product_name}</TableCell>
                                      <TableCell align="right">{Math.abs(m.quantity_change)}</TableCell>
                                      <TableCell align="right">{m.selling_price?.toLocaleString()} Fc</TableCell>
                                      <TableCell align="right">
                                        {((m.selling_price || 0) * Math.abs(m.quantity_change)).toLocaleString()} Fc
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* Onglet Mouvements */}
          {activeTab === 3 && filteredData && (
            <Box sx={{ p: 3 }}>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8f9fa' }}>
                      <TableCell>Date/Heure</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align="right">Avant</TableCell>
                      <TableCell align="right">Après</TableCell>
                      <TableCell align="right">Variation</TableCell>
                      <TableCell>Utilisateur</TableCell>
                      <TableCell>Branche</TableCell>
                      <TableCell>Raison</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredData.movements
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map(movement => (
                        <TableRow key={movement.id}>
                          <TableCell style={{ whiteSpace: 'nowrap' }}>
                            {new Date(movement.created_at).toLocaleString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={movement.product_code || ''}>
                              <span>{movement.product_name}</span>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={
                                movement.movement_type === 'sale' ? 'Vente' :
                                movement.movement_type === 'purchase' ? 'Achat' :
                                movement.movement_type === 'adjustment' ? 'Ajustement' :
                                movement.movement_type === 'inventory' ? 'Inventaire' :
                                movement.movement_type === 'transfer_in' ? 'Transfert In' :
                                movement.movement_type === 'transfer_out' ? 'Transfert Out' : movement.movement_type
                              }
                              size="small"
                              color={
                                movement.movement_type === 'sale' ? 'primary' :
                                movement.movement_type === 'purchase' ? 'success' : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell align="right">{movement.quantity_before}</TableCell>
                          <TableCell align="right">{movement.quantity_after}</TableCell>
                          <TableCell align="right" style={{ color: movement.quantity_change < 0 ? '#e74c3c' : '#27ae60' }}>
                            {movement.quantity_change < 0 ? movement.quantity_change : `+${movement.quantity_change}`}
                          </TableCell>
                          <TableCell>{movement.seller_name}</TableCell>
                          <TableCell>{movement.branch_name}</TableCell>
                          <TableCell>{movement.reason}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50, 100]}
                component="div"
                count={filteredData.movements.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(_: unknown, newPage: number) => setPage(newPage)}
                onRowsPerPageChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setRowsPerPage(parseInt(e.target.value, 10));
                  setPage(0);
                }}
                labelRowsPerPage="Lignes par page"
              />
            </Box>
          )}

          {/* Onglet FIFO */}
          {activeTab === 4 && filteredData && (
            <Box sx={{ p: 3 }}>
              {filteredData.fifo_results.length === 0 ? (
                <Alert severity="info">Aucune donnée de synchronisation FIFO disponible</Alert>
              ) : (
                filteredData.fifo_results.map(result => (
                  <Paper key={result.product_id} variant="outlined" sx={{ mb: 3, overflow: 'hidden' }}>
                    <Box sx={{ p: 2, bgcolor: '#f8f9fa' }}>
                      <Typography variant="h6">{result.product_name}</Typography>
                      <MuiGrid container spacing={2} sx={{ mt: 1 }}>
                        <MuiGrid size={{ xs: 3 }}>
                          <Typography variant="caption" color="textSecondary">Stock initial</Typography>
                          <Typography variant="h6">{result.initial_stock}</Typography>
                        </MuiGrid>
                        <MuiGrid size={{ xs: 3 }}>
                          <Typography variant="caption" color="success.main">Synchro OK</Typography>
                          <Typography variant="h6" sx={{ color: 'success.main' }}>{result.synced_quantity}</Typography>
                        </MuiGrid>
                        <MuiGrid size={{ xs: 3 }}>
                          <Typography variant="caption" color="error.main">Ignoré</Typography>
                          <Typography variant="h6" sx={{ color: 'error.main' }}>{result.ignored_quantity}</Typography>
                        </MuiGrid>
                        <MuiGrid size={{ xs: 3 }}>
                          <Typography variant="caption" color="textSecondary">Stock restant</Typography>
                          <Typography variant="h6">{result.remaining_stock}</Typography>
                        </MuiGrid>
                      </MuiGrid>
                    </Box>
                    
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Ordre FIFO</TableCell>
                            <TableCell>Utilisateur</TableCell>
                            <TableCell align="right">Quantité</TableCell>
                            <TableCell>Date/Heure</TableCell>
                            <TableCell>Statut</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {result.transactions.map(t => (
                            <TableRow key={`${t.user_id}-${t.sync_order}`} style={{ opacity: t.is_synced ? 1 : 0.6 }}>
                              <TableCell>#{t.sync_order}</TableCell>
                              <TableCell>{t.user_name}</TableCell>
                              <TableCell align="right">{t.quantity}</TableCell>
                              <TableCell>{new Date(t.timestamp).toLocaleString('fr-FR')}</TableCell>
                              <TableCell>
                                <Chip
                                  label={t.is_synced ? 'Synchronisé ✓' : 'Ignoré ✗'}
                                  size="small"
                                  color={t.is_synced ? 'success' : 'error'}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                ))
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </LocalizationProvider>
  );
};

export default StockReport;