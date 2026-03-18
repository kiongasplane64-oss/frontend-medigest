import { useState, useEffect } from 'react';
import {
  Activity,
  TrendingDown,
  Package,
  Users,
  DollarSign,
  ShoppingCart,
  BarChart3,
  PieChart,
  Download,
  RefreshCcw,
  Filter,
  Eye,
  FileText,
  AlertTriangle,
  Printer,
  Grid,
  List,
  Maximize2,
  Minimize2,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  MapPin,
  ClipboardList,
  Edit,
  Search,
  X
} from 'lucide-react';
import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';
import { formatCurrency, formatNumber, formatDate } from '@/utils/formatters';

// Types pour les données de monitoring
interface DashboardStats {
  totalRevenue: number;
  totalRevenueChange: number;
  totalSales: number;
  totalSalesChange: number;
  totalProducts: number;
  totalProductsChange: number;
  totalCustomers: number;
  totalCustomersChange: number;
  averageOrderValue: number;
  averageOrderValueChange: number;
  conversionRate: number;
  conversionRateChange: number;
}

interface PharmacySummary {
  id: string;
  name: string;
  location: string;
  isActive: boolean;
  stats: {
    todayRevenue: number;
    todaySales: number;
    weekRevenue: number;
    monthRevenue: number;
    yearRevenue: number;
    productsCount: number;
    lowStockCount: number;
    expiredCount: number;
    customersCount: number;
    profit: number;
    expenses: number;
    margin: number;
  };
  onlineUsers: number;
  lastActivity: string;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  pharmacyId: string;
  pharmacyName: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  profit: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'credit';
  status: 'completed' | 'pending' | 'cancelled' | 'refunded';
  createdAt: string;
  createdBy: string;
}

interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalPrice: number;
  profit: number;
}

interface Product {
  id: string;
  name: string;
  pharmacyId: string;
  pharmacyName: string;
  category: string;
  supplier: string;
  stock: number;
  minStock: number;
  maxStock: number;
  purchasePrice: number;
  sellingPrice: number;
  profit: number;
  margin: number;
  expiryDate: string;
  batchNumber: string;
  location: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'expired';
  lastMovement: string;
}

interface InventoryItem {
  productId: string;
  productName: string;
  theoreticalStock: number;
  actualStock: number;
  difference: number;
  differenceValue: number;
  unitPrice: number;
  lastCount: string;
  countedBy: string;
  notes: string;
}

interface Expense {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  status: 'paid' | 'pending' | 'cancelled';
  date: string;
  createdBy: string;
  receipt: string;
}

interface ProfitLoss {
  period: string;
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  grossMargin: number;
  expenses: number;
  netProfit: number;
  netMargin: number;
}

interface ActivityLog {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  ipAddress: string;
  timestamp: string;
}

interface FilterOptions {
  pharmacies: string[];
  dateRange: 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate: string | null;
  endDate: string | null;
  status: string[];
  paymentMethod: string[];
  categories: string[];
  suppliers: string[];
}

interface Alert {
  id: string;
  type: 'danger' | 'warning' | 'info';
  message: string;
}

interface MonitoringProps {
  tenantId: string;
}

const Monitoring = ({ tenantId }: MonitoringProps) => {
  // On garde useAuthStore pour une utilisation future potentielle
  useAuthStore();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'sales' | 'products' | 'inventory' | 'expenses' | 'analytics' | 'logs'>('overview');
  const [selectedPharmacy, setSelectedPharmacy] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Données principales
  const [pharmacies, setPharmacies] = useState<PharmacySummary[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profitLoss, setProfitLoss] = useState<ProfitLoss[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  // États pour l'inventaire
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [currentInventory, setCurrentInventory] = useState<{
    id?: string;
    pharmacyId: string;
    date: string;
    items: InventoryItem[];
  } | null>(null);
  
  // Filtres
  const [filters, setFilters] = useState<FilterOptions>({
    pharmacies: [],
    dateRange: 'month',
    startDate: null,
    endDate: null,
    status: [],
    paymentMethod: [],
    categories: [],
    suppliers: []
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);

  // Charger les données au montage
  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(refreshData, 60000);
    return () => clearInterval(interval);
  }, [tenantId, selectedPharmacy, filters.dateRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const pharmaciesRes = await api.get(`/api/v1/tenants/${tenantId}/pharmacies`);
      setPharmacies(pharmaciesRes.data);
      
      const statsRes = await api.get(`/api/v1/tenants/${tenantId}/dashboard/stats`, {
        params: {
          pharmacyId: selectedPharmacy !== 'all' ? selectedPharmacy : undefined,
          dateRange: filters.dateRange
        }
      });
      setDashboardStats(statsRes.data);
      
      const salesRes = await api.get(`/api/v1/tenants/${tenantId}/sales/recent`, {
        params: {
          pharmacyId: selectedPharmacy !== 'all' ? selectedPharmacy : undefined,
          limit: 50
        }
      });
      setRecentSales(salesRes.data);
      setTotalItems(salesRes.data.length);
      
      const productsRes = await api.get(`/api/v1/tenants/${tenantId}/products`, {
        params: {
          pharmacyId: selectedPharmacy !== 'all' ? selectedPharmacy : undefined,
          lowStock: true
        }
      });
      setProducts(productsRes.data);
      
      const expensesRes = await api.get(`/api/v1/tenants/${tenantId}/expenses`, {
        params: {
          pharmacyId: selectedPharmacy !== 'all' ? selectedPharmacy : undefined,
          dateRange: filters.dateRange
        }
      });
      setExpenses(expensesRes.data);
      
      const profitRes = await api.get(`/api/v1/tenants/${tenantId}/profit-loss`, {
        params: {
          pharmacyId: selectedPharmacy !== 'all' ? selectedPharmacy : undefined,
          dateRange: filters.dateRange
        }
      });
      setProfitLoss(profitRes.data);
      
      const logsRes = await api.get(`/api/v1/tenants/${tenantId}/activity-logs`, {
        params: {
          pharmacyId: selectedPharmacy !== 'all' ? selectedPharmacy : undefined,
          limit: 100
        }
      });
      setActivityLogs(logsRes.data);
      
      const alertsRes = await api.get(`/api/v1/tenants/${tenantId}/alerts`);
      setAlerts(alertsRes.data);
      
    } catch {
      setError('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const startInventory = async (pharmacyId: string) => {
    try {
      const response = await api.post(`/api/v1/inventory/start`, {
        pharmacyId,
        date: new Date().toISOString()
      });
      
      setCurrentInventory(response.data);
      setInventoryItems(response.data.items);
      setShowInventoryModal(true);
    } catch {
      console.error('Erreur lors du démarrage de l\'inventaire:');
    }
  };

  const updateInventoryItem = (productId: string, actualStock: number) => {
    setInventoryItems(prev =>
      prev.map(item =>
        item.productId === productId
          ? {
              ...item,
              actualStock,
              difference: actualStock - item.theoreticalStock,
              differenceValue: (actualStock - item.theoreticalStock) * item.unitPrice
            }
          : item
      )
    );
  };

  const saveInventory = async () => {
    try {
      await api.post(`/api/v1/inventory/save`, {
        inventoryId: currentInventory?.id,
        items: inventoryItems
      });
      
      setShowInventoryModal(false);
      refreshData();
    } catch {
      console.error('Erreur lors de la sauvegarde de l\'inventaire:');
    }
  };

  const exportData = (format: 'csv' | 'excel' | 'pdf') => {
    window.open(`/api/v1/tenants/${tenantId}/export?format=${format}&pharmacyId=${selectedPharmacy}&dateRange=${filters.dateRange}`);
  };

  const getFilteredData = () => {
    let filtered = [...recentSales];
    
    if (searchTerm) {
      filtered = filtered.filter(sale =>
        sale.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sale.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filters.paymentMethod.length > 0) {
      filtered = filtered.filter(sale => filters.paymentMethod.includes(sale.paymentMethod));
    }
    
    if (filters.status.length > 0) {
      filtered = filtered.filter(sale => filters.status.includes(sale.status));
    }
    
    return filtered;
  };

  const paginatedData = getFilteredData().slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600">Chargement du tableau de bord...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Erreur</h2>
          <p className="text-slate-600 mb-4">{error}</p>
          <button
            onClick={loadDashboardData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-slate-50 ${fullscreen ? 'fixed inset-0 z-50 overflow-auto' : ''}`}>
      {/* En-tête */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Activity className="w-6 h-6 text-blue-600" />
                Monitoring Multi-Pharmacies
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Vue globale de toutes vos pharmacies • Dernière mise à jour: {new Date().toLocaleString()}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={viewMode === 'grid' ? 'Vue liste' : 'Vue grille'}
              >
                {viewMode === 'grid' ? <List className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
              </button>
              
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                title={fullscreen ? 'Quitter plein écran' : 'Plein écran'}
              >
                {fullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Rafraîchissement...' : 'Rafraîchir'}
              </button>
            </div>
          </div>

          {/* Barre de navigation par onglets */}
          <div className="flex items-center gap-1 mt-4 border-b border-slate-200">
            <button
              onClick={() => setSelectedTab('overview')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'overview'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Vue d'ensemble
              </div>
            </button>
            
            <button
              onClick={() => setSelectedTab('sales')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'sales'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Ventes
              </div>
            </button>
            
            <button
              onClick={() => setSelectedTab('products')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'products'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                Produits & Stocks
              </div>
            </button>
            
            <button
              onClick={() => setSelectedTab('inventory')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'inventory'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Inventaire
              </div>
            </button>
            
            <button
              onClick={() => setSelectedTab('expenses')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'expenses'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4" />
                Dépenses
              </div>
            </button>
            
            <button
              onClick={() => setSelectedTab('analytics')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'analytics'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Analyses
              </div>
            </button>
            
            <button
              onClick={() => setSelectedTab('logs')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                selectedTab === 'logs'
                  ? 'text-blue-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Journal d'activité
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="p-6">
        {/* Barre de filtres */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <select
                value={selectedPharmacy}
                onChange={(e) => setSelectedPharmacy(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              >
                <option value="all">Toutes les pharmacies</option>
                {pharmacies.map(pharmacy => (
                  <option key={pharmacy.id} value={pharmacy.id}>
                    {pharmacy.name}
                  </option>
                ))}
              </select>
              
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ ...filters, dateRange: e.target.value as any })}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              >
                <option value="today">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="quarter">Ce trimestre</option>
                <option value="year">Cette année</option>
                <option value="custom">Personnalisé</option>
              </select>
              
              <div className="flex-1 max-w-md relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Rechercher par numéro de facture, client..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                  showFilters ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100'
                }`}
              >
                <Filter className="w-4 h-4" />
                Filtres
              </button>
              
              <button
                onClick={() => exportData('excel')}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
            </div>
          </div>
          
          {showFilters && (
            <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Méthode de paiement
                </label>
                <select
                  multiple
                  value={filters.paymentMethod}
                  onChange={(e) => setFilters({
                    ...filters,
                    paymentMethod: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="cash">Espèces</option>
                  <option value="card">Carte</option>
                  <option value="mobile">Mobile Money</option>
                  <option value="credit">Crédit</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Statut
                </label>
                <select
                  multiple
                  value={filters.status}
                  onChange={(e) => setFilters({
                    ...filters,
                    status: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="completed">Terminé</option>
                  <option value="pending">En attente</option>
                  <option value="cancelled">Annulé</option>
                  <option value="refunded">Remboursé</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Catégorie
                </label>
                <select
                  multiple
                  value={filters.categories}
                  onChange={(e) => setFilters({
                    ...filters,
                    categories: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="medicaments">Médicaments</option>
                  <option value="parapharmacie">Parapharmacie</option>
                  <option value="materiel">Matériel médical</option>
                  <option value="cosmetiques">Cosmétiques</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Fournisseur
                </label>
                <select
                  multiple
                  value={filters.suppliers}
                  onChange={(e) => setFilters({
                    ...filters,
                    suppliers: Array.from(e.target.selectedOptions, option => option.value)
                  })}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="supplier1">PharmaLab</option>
                  <option value="supplier2">MediCorp</option>
                  <option value="supplier3">HealthPlus</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Alertes */}
        {alerts.length > 0 && (
          <div className="mb-6 space-y-2">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className={`flex items-center gap-3 p-4 rounded-xl border ${
                  alert.type === 'danger' ? 'bg-red-50 border-red-200 text-red-700' :
                  alert.type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' :
                  'bg-blue-50 border-blue-200 text-blue-700'
                }`}
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-sm flex-1">{alert.message}</p>
                <button className="text-sm font-medium hover:underline">
                  Voir détails
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Contenu selon l'onglet sélectionné */}
        {selectedTab === 'overview' && (
          <div className="space-y-6">
            {/* Cartes de statistiques */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    (dashboardStats?.totalRevenueChange || 0) >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {dashboardStats?.totalRevenueChange || 0}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(dashboardStats?.totalRevenue || 0)}
                </p>
                <p className="text-sm text-slate-500">Chiffre d'affaires total</p>
                <div className="flex items-center gap-1 mt-2">
                  {(dashboardStats?.totalRevenueChange || 0) >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-slate-500">
                    vs période précédente
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <ShoppingCart className="w-5 h-5 text-green-600" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    (dashboardStats?.totalSalesChange || 0) >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {dashboardStats?.totalSalesChange || 0}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardStats?.totalSales || 0)}
                </p>
                <p className="text-sm text-slate-500">Nombre de ventes</p>
                <div className="flex items-center gap-1 mt-2">
                  {(dashboardStats?.totalSalesChange || 0) >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-slate-500">
                    vs période précédente
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    (dashboardStats?.totalProductsChange || 0) >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {dashboardStats?.totalProductsChange || 0}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardStats?.totalProducts || 0)}
                </p>
                <p className="text-sm text-slate-500">Produits en stock</p>
                <div className="flex items-center gap-1 mt-2">
                  {(dashboardStats?.totalProductsChange || 0) >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-slate-500">
                    vs période précédente
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <Users className="w-5 h-5 text-yellow-600" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    (dashboardStats?.totalCustomersChange || 0) >= 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {dashboardStats?.totalCustomersChange || 0}%
                  </span>
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatNumber(dashboardStats?.totalCustomers || 0)}
                </p>
                <p className="text-sm text-slate-500">Clients</p>
                <div className="flex items-center gap-1 mt-2">
                  {(dashboardStats?.totalCustomersChange || 0) >= 0 ? (
                    <ArrowUpRight className="w-3 h-3 text-green-500" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3 text-red-500" />
                  )}
                  <span className="text-xs text-slate-500">
                    vs période précédente
                  </span>
                </div>
              </div>
            </div>

            {/* Liste des pharmacies */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {pharmacies.map(pharmacy => (
                <div key={pharmacy.id} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        pharmacy.isActive ? 'bg-green-100' : 'bg-slate-100'
                      }`}>
                        <Building2 className={`w-5 h-5 ${
                          pharmacy.isActive ? 'text-green-600' : 'text-slate-500'
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-800">{pharmacy.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {pharmacy.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${
                        pharmacy.isActive ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="text-xs text-slate-500">
                        {pharmacy.onlineUsers} en ligne
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <p className="text-xs text-slate-500">CA aujourd'hui</p>
                      <p className="font-semibold text-slate-800">
                        {formatCurrency(pharmacy.stats.todayRevenue)}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <p className="text-xs text-slate-500">Ventes</p>
                      <p className="font-semibold text-slate-800">
                        {pharmacy.stats.todaySales}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <p className="text-xs text-slate-500">Stock bas</p>
                      <p className={`font-semibold ${
                        pharmacy.stats.lowStockCount > 0 ? 'text-orange-600' : 'text-slate-800'
                      }`}>
                        {pharmacy.stats.lowStockCount}
                      </p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <p className="text-xs text-slate-500">Expirés</p>
                      <p className={`font-semibold ${
                        pharmacy.stats.expiredCount > 0 ? 'text-red-600' : 'text-slate-800'
                      }`}>
                        {pharmacy.stats.expiredCount}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500">Marge:</span>
                      <span className="font-medium text-green-600">
                        {pharmacy.stats.margin}%
                      </span>
                    </div>
                    <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Voir détails
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Évolution des ventes</h3>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400">Graphique des ventes</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Répartition des produits</h3>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400">Graphique des produits</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'sales' && (
          <div className="space-y-6">
            {/* Résumé des ventes */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Ventes du jour</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(1234500)}
                </p>
                <p className="text-xs text-green-600 mt-2">+12% vs hier</p>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Ventes de la semaine</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(5678900)}
                </p>
                <p className="text-xs text-green-600 mt-2">+8% vs semaine dernière</p>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Ventes du mois</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(23456700)}
                </p>
                <p className="text-xs text-green-600 mt-2">+15% vs mois dernier</p>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Ventes de l'année</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(98765400)}
                </p>
                <p className="text-xs text-green-600 mt-2">+23% vs année dernière</p>
              </div>
            </div>

            {/* Tableau des ventes */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Facture
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Pharmacie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Bénéfice
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Paiement
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedData.map((sale) => (
                      <tr key={sale.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-800">
                          {sale.invoiceNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {sale.pharmacyName}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-slate-800">{sale.customerName}</p>
                            <p className="text-xs text-slate-500">{sale.customerPhone}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800">
                          {formatCurrency(sale.total)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-green-600">
                          {formatCurrency(sale.profit)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' :
                            sale.paymentMethod === 'card' ? 'bg-blue-100 text-blue-700' :
                            sale.paymentMethod === 'mobile' ? 'bg-purple-100 text-purple-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {sale.paymentMethod === 'cash' ? 'Espèces' :
                             sale.paymentMethod === 'card' ? 'Carte' :
                             sale.paymentMethod === 'mobile' ? 'Mobile' : 'Crédit'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            sale.status === 'completed' ? 'bg-green-100 text-green-700' :
                            sale.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            sale.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {sale.status === 'completed' ? 'Terminé' :
                             sale.status === 'pending' ? 'En attente' :
                             sale.status === 'cancelled' ? 'Annulé' : 'Remboursé'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(sale.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-700 mr-2">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="text-slate-600 hover:text-slate-700">
                            <Printer className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Affichage {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, totalItems)} sur {totalItems}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">
                    {currentPage}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={currentPage * itemsPerPage >= totalItems}
                    className="px-3 py-1 border border-slate-200 rounded-lg disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'products' && (
          <div className="space-y-6">
            {/* Statistiques produits */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Total produits</p>
                <p className="text-2xl font-bold text-slate-800">1,234</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Stock bas</p>
                <p className="text-2xl font-bold text-orange-600">23</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Rupture de stock</p>
                <p className="text-2xl font-bold text-red-600">12</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Expirés</p>
                <p className="text-2xl font-bold text-red-600">5</p>
              </div>
            </div>

            {/* Tableau des produits */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Produit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Pharmacie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Catégorie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Stock
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Prix achat
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Prix vente
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Marge
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {products.slice(0, 10).map((product) => (
                      <tr key={product.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-slate-800">{product.name}</p>
                            <p className="text-xs text-slate-500">Lot: {product.batchNumber}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {product.pharmacyName}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {product.category}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${
                              product.stock <= product.minStock ? 'text-orange-600' :
                              product.stock === 0 ? 'text-red-600' : 'text-slate-800'
                            }`}>
                              {product.stock}
                            </span>
                            <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  product.stock <= product.minStock ? 'bg-orange-500' :
                                  product.stock === 0 ? 'bg-red-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${Math.min(100, (product.stock / product.maxStock) * 100)}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatCurrency(product.purchasePrice)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800">
                          {formatCurrency(product.sellingPrice)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-green-600">
                            {product.margin}%
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            product.status === 'in_stock' ? 'bg-green-100 text-green-700' :
                            product.status === 'low_stock' ? 'bg-orange-100 text-orange-700' :
                            product.status === 'out_of_stock' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {product.status === 'in_stock' ? 'En stock' :
                             product.status === 'low_stock' ? 'Stock bas' :
                             product.status === 'out_of_stock' ? 'Rupture' : 'Expiré'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-700 mr-2">
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-slate-600 hover:text-slate-700">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Gestion d'inventaire</h2>
              <button
                onClick={() => startInventory(selectedPharmacy === 'all' ? pharmacies[0]?.id : selectedPharmacy)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
              >
                <ClipboardList className="w-4 h-4" />
                Nouvel inventaire
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cartes d'inventaire récent */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-slate-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-semibold text-slate-800">Pharmacie Principale</p>
                      <p className="text-sm text-slate-500">15 Mars 2024</p>
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                      Terminé
                    </span>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Produits comptés:</span>
                      <span className="font-medium">245</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Écarts positifs:</span>
                      <span className="text-green-600">12 (+{formatCurrency(12500)})</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Écarts négatifs:</span>
                      <span className="text-red-600">8 (-{formatCurrency(8700)})</span>
                    </div>
                  </div>
                  
                  <button className="w-full text-center text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Voir détails
                  </button>
                </div>
              ))}
            </div>

            {/* Historique des inventaires */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">Historique des inventaires</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pharmacie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produits</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Écarts</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valeur écart</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-600">15/03/2024</td>
                        <td className="px-6 py-4 text-sm text-slate-800 font-medium">Pharmacie Principale</td>
                        <td className="px-6 py-4 text-sm text-slate-600">245</td>
                        <td className="px-6 py-4 text-sm">
                          <span className="text-green-600">+12</span>
                          <span className="mx-1">/</span>
                          <span className="text-red-600">-8</span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="text-green-600">+{formatCurrency(12500)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                            Terminé
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-700">
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'expenses' && (
          <div className="space-y-6">
            {/* Résumé des dépenses */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Dépenses du mois</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(456700)}</p>
                <p className="text-xs text-red-600 mt-2">+5% vs mois dernier</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Dépenses de l'année</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(2345600)}</p>
                <p className="text-xs text-green-600 mt-2">-2% vs budget</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Ratio dépenses/CA</p>
                <p className="text-2xl font-bold text-slate-800">32%</p>
                <p className="text-xs text-green-600 mt-2">Objectif: 35%</p>
              </div>
            </div>

            {/* Tableau des dépenses */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pharmacie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Catégorie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Montant</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Paiement</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {expenses.map((expense) => (
                      <tr key={expense.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(expense.date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                          {expense.pharmacyName}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {expense.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {expense.description}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-red-600">
                          -{formatCurrency(expense.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {expense.paymentMethod}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            expense.status === 'paid' ? 'bg-green-100 text-green-700' :
                            expense.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {expense.status === 'paid' ? 'Payé' :
                             expense.status === 'pending' ? 'En attente' : 'Annulé'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button className="text-blue-600 hover:text-blue-700 mr-2">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="text-slate-600 hover:text-slate-700">
                            <FileText className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'analytics' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Panier moyen</p>
                <p className="text-2xl font-bold text-slate-800">{formatCurrency(12500)}</p>
                <p className="text-xs text-green-600 mt-2">+8% vs mois dernier</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Taux de conversion</p>
                <p className="text-2xl font-bold text-slate-800">68%</p>
                <p className="text-xs text-green-600 mt-2">+3% vs mois dernier</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Marge brute</p>
                <p className="text-2xl font-bold text-slate-800">28%</p>
                <p className="text-xs text-green-600 mt-2">Objectif: 25%</p>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-sm text-slate-500 mb-1">Rotation stock</p>
                <p className="text-2xl font-bold text-slate-800">45 jours</p>
                <p className="text-xs text-green-600 mt-2">-3 jours</p>
              </div>
            </div>

            {/* Graphiques analytiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Évolution du chiffre d'affaires</h3>
                <div className="h-80 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400">Graphique CA</p>
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Répartition des ventes par pharmacie</h3>
                <div className="h-80 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400">Graphique répartition</p>
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Top produits</h3>
                <div className="h-80 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400">Graphique top produits</p>
                </div>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <h3 className="font-semibold text-slate-800 mb-4">Analyse des marges</h3>
                <div className="h-80 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-lg">
                  <p className="text-slate-400">Graphique marges</p>
                </div>
              </div>
            </div>

            {/* Tableau de profit/perte */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800">État des profits et pertes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Période</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Revenus</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Coût des ventes</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bénéfice brut</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Marge brute</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Dépenses</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bénéfice net</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Marge nette</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {profitLoss.map((pl, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm font-medium text-slate-800">{pl.period}</td>
                        <td className="px-6 py-4 text-sm text-green-600">+{formatCurrency(pl.revenue)}</td>
                        <td className="px-6 py-4 text-sm text-red-600">-{formatCurrency(pl.costOfGoods)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-green-600">+{formatCurrency(pl.grossProfit)}</td>
                        <td className="px-6 py-4 text-sm">{pl.grossMargin}%</td>
                        <td className="px-6 py-4 text-sm text-red-600">-{formatCurrency(pl.expenses)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-green-600">+{formatCurrency(pl.netProfit)}</td>
                        <td className="px-6 py-4 text-sm">{pl.netMargin}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selectedTab === 'logs' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Journal d'activité</h3>
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Exporter les logs
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Date/Heure</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Pharmacie</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Utilisateur</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Entité</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Détails</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {formatDate(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                          {log.pharmacyName}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            <p className="font-medium text-slate-800">{log.userName}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            log.action.includes('create') ? 'bg-green-100 text-green-700' :
                            log.action.includes('update') ? 'bg-blue-100 text-blue-700' :
                            log.action.includes('delete') ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {log.entity}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">
                          {log.details}
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {log.ipAddress}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal d'inventaire */}
      {showInventoryModal && currentInventory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Inventaire - {currentInventory.pharmacyId}</h2>
                <p className="text-sm text-slate-500">{formatDate(currentInventory.date)}</p>
              </div>
              <button
                onClick={() => setShowInventoryModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produit</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock théorique</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock réel</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Écart</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valeur écart</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {inventoryItems.map((item) => (
                    <tr key={item.productId}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.productName}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{item.theoreticalStock}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={item.actualStock}
                          onChange={(e) => updateInventoryItem(item.productId, Number(e.target.value))}
                          className="w-24 p-1 border border-slate-200 rounded-lg"
                        />
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        item.difference > 0 ? 'text-green-600' :
                        item.difference < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        item.differenceValue > 0 ? 'text-green-600' :
                        item.differenceValue < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {item.differenceValue > 0 ? '+' : ''}{formatCurrency(item.differenceValue)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          placeholder="Notes"
                          className="w-full p-1 border border-slate-200 rounded-lg text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
              <div className="text-sm text-slate-600">
                Total produits: {inventoryItems.length} • Écart total: {formatCurrency(
                  inventoryItems.reduce((sum, item) => sum + item.differenceValue, 0)
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowInventoryModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  onClick={saveInventory}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                >
                  Sauvegarder l'inventaire
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Monitoring;