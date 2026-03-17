import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  BarChart3, TrendingUp, Package, Users, 
  CreditCard, Download, ArrowLeft,
  Activity, DollarSign, ShoppingBag,
  Printer, WifiOff, PieChart
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { db } from '@/db/offlineDb';
import { useOnline } from '@/hooks/useOnline';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { DateRangePicker } from '@/components/ui/DateRangePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

// Types
interface SaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface Sale {
  id?: number;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  timestamp: number;
  cashierId?: string;
  cashierName: string;
  status?: 'pending' | 'synced';
}

interface ProductSales {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  category: string;
}

interface CashierPerformance {
  id: string;
  name: string;
  sales: number;
  revenue: number;
  average: number;
}

interface HourlyData {
  hour: string;
  sales: number;
  revenue: number;
}

interface PaymentBreakdown {
  cash: number;
  mobile: number;
  account: number;
}

interface Stats {
  totalRevenue: number;
  totalSales: number;
  totalItems: number;
  averageTicket: number;
  topProduct: {
    name: string;
    quantity: number;
    revenue: number;
  };
  bestCashier: {
    name: string;
    sales: number;
    revenue: number;
  };
  paymentBreakdown: PaymentBreakdown;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
type ReportType = 'sales' | 'products' | 'cashiers' | 'payment';

// Constantes
const PERIOD_OPTIONS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Personnalisé' }
] as const;

const REPORT_TYPE_OPTIONS = [
  { value: 'sales', label: 'Ventes', icon: BarChart3 },
  { value: 'products', label: 'Produits', icon: Package },
  { value: 'cashiers', label: 'Caissiers', icon: Users },
  { value: 'payment', label: 'Paiements', icon: CreditCard }
] as const;

// Fonction utilitaire pour calculer le pourcentage
const calculatePercentage = (value: number, total: number): string => {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return percentage.toFixed(1) + '%';
};

// Composants memoïsés
const StatCard = memo(({ 
  icon: Icon, 
  label, 
  value, 
  color = 'blue',
  subValue 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number;
  color?: 'blue' | 'green' | 'purple' | 'orange';
  subValue?: string;
}) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600'
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colors[color]}`}>
            <Icon size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {subValue && <p className="text-xs text-slate-400">{subValue}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StatCard.displayName = 'StatCard';

const ProductRow = memo(({ product, index }: { product: ProductSales; index: number }) => (
  <div className="flex items-center justify-between py-2 hover:bg-slate-50 px-2 rounded-lg transition-colors">
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-400 w-6">#{index + 1}</span>
      <div>
        <p className="font-medium text-slate-700">{product.name}</p>
        <p className="text-xs text-slate-400">{product.category}</p>
      </div>
    </div>
    <div className="text-right">
      <p className="font-bold text-blue-600">{product.quantity} vendus</p>
      <p className="text-xs text-slate-400">{formatCurrency(product.revenue)}</p>
    </div>
  </div>
));

ProductRow.displayName = 'ProductRow';

const HourlyBar = memo(({ data, max }: { data: HourlyData; max: number }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-slate-400 w-10">{data.hour}</span>
    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
      <div 
        className="h-full bg-blue-600 rounded-full transition-all duration-500"
        style={{ width: `${(data.sales / max) * 100}%` }}
      />
    </div>
    <span className="text-xs font-medium min-w-15 text-right">{data.sales} ventes</span>
  </div>
));

HourlyBar.displayName = 'HourlyBar';

export default function Rapports() {
  const isOnline = useOnline();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportType, setReportType] = useState<ReportType>('sales');
  
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    totalSales: 0,
    totalItems: 0,
    averageTicket: 0,
    topProduct: { name: '', quantity: 0, revenue: 0 },
    bestCashier: { name: '', sales: 0, revenue: 0 },
    paymentBreakdown: { cash: 0, mobile: 0, account: 0 }
  });

  const [productSales, setProductSales] = useState<ProductSales[]>([]);
  const [cashierPerformance, setCashierPerformance] = useState<CashierPerformance[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);

  // Chargement des données
  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [sales, period, customStartDate, customEndDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const localSales = await db.sales.toArray();
      setSales(localSales as Sale[]);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredSales = useCallback((): Sale[] => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    switch (period) {
      case 'today':
        return sales.filter(s => s.timestamp && s.timestamp >= today);
      
      case 'week': {
        const weekAgo = today - 7 * 24 * 60 * 60 * 1000;
        return sales.filter(s => s.timestamp && s.timestamp >= weekAgo);
      }
      
      case 'month': {
        const monthAgo = today - 30 * 24 * 60 * 60 * 1000;
        return sales.filter(s => s.timestamp && s.timestamp >= monthAgo);
      }
      
      case 'year': {
        const yearAgo = today - 365 * 24 * 60 * 60 * 1000;
        return sales.filter(s => s.timestamp && s.timestamp >= yearAgo);
      }
      
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate).getTime();
          const end = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          return sales.filter(s => s.timestamp && s.timestamp >= start && s.timestamp <= end);
        }
        return sales;
      
      default:
        return sales;
    }
  }, [sales, period, customStartDate, customEndDate]);

  const calculateStats = useCallback(() => {
    const filteredSales = getFilteredSales();
    
    // Statistiques générales
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => 
      sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) : 0), 0
    );
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    // Ventilation par paiement
    const paymentBreakdown = {
      cash: filteredSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + (s.total || 0), 0),
      mobile: filteredSales.filter(s => s.paymentMethod === 'mobile').reduce((sum, s) => sum + (s.total || 0), 0),
      account: filteredSales.filter(s => s.paymentMethod === 'account').reduce((sum, s) => sum + (s.total || 0), 0)
    };

    // Meilleurs produits
    const productsMap = new Map<string, ProductSales>();
    filteredSales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const existing = productsMap.get(item.name) || {
            id: item.id,
            name: item.name,
            quantity: 0,
            revenue: 0,
            category: item.category || 'Autre'
          };
          existing.quantity += item.quantity || 0;
          existing.revenue += (item.price || 0) * (item.quantity || 0);
          productsMap.set(item.name, existing);
        });
      }
    });
    
    const products = Array.from(productsMap.values());
    const topProduct = products.sort((a, b) => b.revenue - a.revenue)[0] || { 
      name: 'Aucun', 
      quantity: 0, 
      revenue: 0 
    };
    
    setProductSales(products.sort((a, b) => b.quantity - a.quantity));

    // Performance des caissiers
    const cashiersMap = new Map<string, CashierPerformance>();
    filteredSales.forEach(sale => {
      const cashierName = sale.cashierName || 'Inconnu';
      const existing = cashiersMap.get(cashierName) || {
        id: sale.cashierId || cashierName,
        name: cashierName,
        sales: 0,
        revenue: 0,
        average: 0
      };
      existing.sales += 1;
      existing.revenue += sale.total || 0;
      existing.average = existing.sales > 0 ? existing.revenue / existing.sales : 0;
      cashiersMap.set(cashierName, existing);
    });
    
    const cashiers = Array.from(cashiersMap.values());
    const bestCashier = cashiers.sort((a, b) => b.revenue - a.revenue)[0] || { 
      name: 'Aucun', 
      sales: 0, 
      revenue: 0, 
      average: 0 
    };
    
    setCashierPerformance(cashiers.sort((a, b) => b.revenue - a.revenue));

    // Données horaires
    const hourlyMap = new Map<string, { sales: number; revenue: number }>();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(`${i}h`, { sales: 0, revenue: 0 });
    }
    
    filteredSales.forEach(sale => {
      if (sale.timestamp) {
        const hour = new Date(sale.timestamp).getHours();
        const hourData = hourlyMap.get(`${hour}h`) || { sales: 0, revenue: 0 };
        hourData.sales += 1;
        hourData.revenue += sale.total || 0;
        hourlyMap.set(`${hour}h`, hourData);
      }
    });
    
    setHourlyData(
      Array.from(hourlyMap.entries()).map(([hour, data]) => ({
        hour,
        sales: data.sales,
        revenue: data.revenue
      }))
    );

    setStats({
      totalRevenue,
      totalSales,
      totalItems,
      averageTicket,
      topProduct: {
        name: topProduct.name,
        quantity: topProduct.quantity,
        revenue: topProduct.revenue
      },
      bestCashier: {
        name: bestCashier.name,
        sales: bestCashier.sales,
        revenue: bestCashier.revenue
      },
      paymentBreakdown
    });
  }, [getFilteredSales]);

  const exportReport = useCallback(() => {
    try {
      const reportData = {
        period,
        generatedAt: new Date().toISOString(),
        filters: {
          customStartDate: customStartDate || undefined,
          customEndDate: customEndDate || undefined
        },
        summary: stats,
        products: productSales.slice(0, 50),
        cashiers: cashierPerformance,
        hourly: hourlyData.filter(h => h.sales > 0),
        totalSales: sales.length
      };
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_${period}_${formatDate(new Date()).replace(/\//g, '-')}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Rapport exporté avec succès');
    } catch (error) {
      console.error('Erreur export:', error);
      toast.error('Erreur lors de l\'export');
    }
  }, [period, customStartDate, customEndDate, stats, productSales, cashierPerformance, hourlyData, sales.length]);

  const printReport = useCallback(() => {
    window.print();
  }, []);

  // Trouver le mode de paiement principal
  const mainPaymentMethod = useMemo(() => {
    const entries = Object.entries(stats.paymentBreakdown) as [keyof PaymentBreakdown, number][];
    const maxEntry = entries.reduce((max, entry) => entry[1] > max[1] ? entry : max, entries[0] || ['cash', 0]);
    
    switch (maxEntry[0]) {
      case 'cash': return 'Espèces';
      case 'mobile': return 'Mobile Money';
      case 'account': return 'Compte Client';
      default: return 'Non défini';
    }
  }, [stats.paymentBreakdown]);

  const maxHourlySales = useMemo(() => 
    Math.max(...hourlyData.map(h => h.sales), 1),
    [hourlyData]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement des rapports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bannière hors-ligne */}
      {!isOnline && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          <WifiOff size={16} />
          Mode hors-ligne - Données locales uniquement
        </div>
      )}

      {/* En-tête */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/pos" 
              className="text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Retour au POS"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">Rapports et analyses</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors print:hidden"
            >
              <Printer size={18} />
              Imprimer
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors print:hidden"
            >
              <Download size={18} />
              Exporter
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 print:p-0">
        {/* Filtres - Masqués à l'impression */}
        <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Période */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Période
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {PERIOD_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* DateRangePicker pour les périodes personnalisées */}
            {period === 'custom' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Période personnalisée
                </label>
                <DateRangePicker
                  value={{
                    startDate: customStartDate ? new Date(customStartDate) : null,
                    endDate: customEndDate ? new Date(customEndDate) : null
                  }}
                  onChange={(range) => {
                    if (range.startDate) {
                      setCustomStartDate(range.startDate.toISOString().split('T')[0]);
                    }
                    if (range.endDate) {
                      setCustomEndDate(range.endDate.toISOString().split('T')[0]);
                    }
                    if (!range.startDate && !range.endDate) {
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }
                  }}
                  placeholder="Sélectionner une période"
                  maxDate={new Date()}
                />
              </div>
            )}

            {/* Type de rapport */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                Type de rapport
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {REPORT_TYPE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon={DollarSign}
            label="Chiffre d'affaires"
            value={formatCurrency(stats.totalRevenue)}
            color="blue"
            subValue={`${stats.totalSales} vente${stats.totalSales > 1 ? 's' : ''}`}
          />
          <StatCard
            icon={ShoppingBag}
            label="Nombre de ventes"
            value={stats.totalSales}
            color="green"
            subValue={`${stats.totalItems} article${stats.totalItems > 1 ? 's' : ''}`}
          />
          <StatCard
            icon={Package}
            label="Articles vendus"
            value={stats.totalItems}
            color="purple"
            subValue={`Moy. ${(stats.totalItems / (stats.totalSales || 1)).toFixed(1)} art./vente`}
          />
          <StatCard
            icon={TrendingUp}
            label="Ticket moyen"
            value={formatCurrency(stats.averageTicket)}
            color="orange"
          />
        </div>

        {/* Contenu du rapport selon le type */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rapport de ventes */}
          {reportType === 'sales' && (
            <>
              {/* Top produits */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 size={20} className="text-blue-600" />
                      Top 10 des produits
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      {productSales.slice(0, 10).map((product, index) => (
                        <ProductRow key={product.id} product={product} index={index} />
                      ))}
                      {productSales.length === 0 && (
                        <p className="text-center text-slate-400 py-8">
                          Aucune donnée disponible
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Ventes par heure */}
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity size={20} className="text-blue-600" />
                      Ventes par heure
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {hourlyData.filter(h => h.sales > 0).map(data => (
                        <HourlyBar key={data.hour} data={data} max={maxHourlySales} />
                      ))}
                      {hourlyData.every(h => h.sales === 0) && (
                        <p className="text-center text-slate-400 py-8">
                          Aucune vente sur cette période
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {/* Rapport produits */}
          {reportType === 'products' && (
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package size={20} className="text-blue-600" />
                    Détail des produits vendus
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 text-sm font-medium text-slate-400">Produit</th>
                          <th className="text-left py-3 text-sm font-medium text-slate-400">Catégorie</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Quantité</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Chiffre d'affaires</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Prix moyen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {productSales.map((product) => (
                          <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-3 font-medium text-slate-700">{product.name}</td>
                            <td className="py-3 text-slate-600">{product.category}</td>
                            <td className="py-3 text-right">{product.quantity}</td>
                            <td className="py-3 text-right font-medium text-blue-600">
                              {formatCurrency(product.revenue)}
                            </td>
                            <td className="py-3 text-right">
                              {formatCurrency(product.revenue / (product.quantity || 1))}
                            </td>
                          </tr>
                        ))}
                        {productSales.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400">
                              Aucune donnée disponible
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Rapport par caissiers */}
          {reportType === 'cashiers' && (
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users size={20} className="text-blue-600" />
                    Performance des caissiers
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="text-left py-3 text-sm font-medium text-slate-400">Caissier</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Ventes</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Chiffre d'affaires</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Moyenne/vente</th>
                          <th className="text-right py-3 text-sm font-medium text-slate-400">Part</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cashierPerformance.map((cashier) => (
                          <tr key={cashier.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="py-3 font-medium text-slate-700">{cashier.name}</td>
                            <td className="py-3 text-right">{cashier.sales}</td>
                            <td className="py-3 text-right font-medium text-blue-600">
                              {formatCurrency(cashier.revenue)}
                            </td>
                            <td className="py-3 text-right">{formatCurrency(cashier.average)}</td>
                            <td className="py-3 text-right">
                              {calculatePercentage(cashier.revenue, stats.totalRevenue)}
                            </td>
                          </tr>
                        ))}
                        {cashierPerformance.length === 0 && (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-slate-400">
                              Aucune donnée disponible
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Rapport par mode de paiement */}
          {reportType === 'payment' && (
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 bg-green-100 rounded-xl flex items-center justify-center">
                        <CreditCard size={24} className="text-green-600" />
                      </div>
                      <h3 className="font-bold text-lg">Espèces</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-2">
                      {formatCurrency(stats.paymentBreakdown.cash)}
                    </p>
                    <p className="text-sm text-slate-400">
                      {calculatePercentage(stats.paymentBreakdown.cash, stats.totalRevenue)} du total
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {stats.paymentBreakdown.cash > 0 
                        ? `Soit ${formatCurrency(stats.paymentBreakdown.cash / (stats.totalSales || 1))} par vente`
                        : 'Aucune vente'
                      }
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <CreditCard size={24} className="text-blue-600" />
                      </div>
                      <h3 className="font-bold text-lg">Mobile Money</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-2">
                      {formatCurrency(stats.paymentBreakdown.mobile)}
                    </p>
                    <p className="text-sm text-slate-400">
                      {calculatePercentage(stats.paymentBreakdown.mobile, stats.totalRevenue)} du total
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {stats.paymentBreakdown.mobile > 0
                        ? `Soit ${formatCurrency(stats.paymentBreakdown.mobile / (stats.totalSales || 1))} par vente`
                        : 'Aucune vente'
                      }
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-12 w-12 bg-purple-100 rounded-xl flex items-center justify-center">
                        <Users size={24} className="text-purple-600" />
                      </div>
                      <h3 className="font-bold text-lg">Compte Client</h3>
                    </div>
                    <p className="text-3xl font-bold text-slate-800 mb-2">
                      {formatCurrency(stats.paymentBreakdown.account)}
                    </p>
                    <p className="text-sm text-slate-400">
                      {calculatePercentage(stats.paymentBreakdown.account, stats.totalRevenue)} du total
                    </p>
                    <p className="text-xs text-slate-400 mt-2">
                      {stats.paymentBreakdown.account > 0
                        ? `Soit ${formatCurrency(stats.paymentBreakdown.account / (stats.totalSales || 1))} par vente`
                        : 'Aucune vente'
                      }
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Graphique de répartition */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart size={20} className="text-blue-600" />
                    Répartition des paiements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {(['cash', 'mobile', 'account'] as const).map((method) => {
                      const value = stats.paymentBreakdown[method];
                      const percentage = stats.totalRevenue > 0 ? (value / stats.totalRevenue) * 100 : 0;
                      const colors = {
                        cash: 'bg-green-500',
                        mobile: 'bg-blue-500',
                        account: 'bg-purple-500'
                      };
                      
                      return (
                        <div key={method} className="flex-1">
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${colors[method]} transition-all duration-500`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <p className="text-xs text-slate-400 mt-1 text-center">
                            {method === 'cash' ? 'Espèces' : method === 'mobile' ? 'Mobile' : 'Compte'}: {percentage.toFixed(1)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Résumé exécutif - Toujours affiché */}
          <div className="lg:col-span-3 mt-6">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4 text-blue-900">Résumé exécutif</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-blue-700 mb-1">Meilleur produit</p>
                    <p className="font-bold text-blue-900 text-lg">{stats.topProduct.name || 'Aucun'}</p>
                    <p className="text-xs text-blue-600">
                      {stats.topProduct.quantity} vendus · {formatCurrency(stats.topProduct.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 mb-1">Meilleur caissier</p>
                    <p className="font-bold text-blue-900 text-lg">{stats.bestCashier.name || 'Aucun'}</p>
                    <p className="text-xs text-blue-600">
                      {stats.bestCashier.sales} ventes · {formatCurrency(stats.bestCashier.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-blue-700 mb-1">Mode de paiement principal</p>
                    <p className="font-bold text-blue-900 text-lg">{mainPaymentMethod}</p>
                    <p className="text-xs text-blue-600">
                      {formatCurrency(Math.max(...Object.values(stats.paymentBreakdown)))}
                    </p>
                  </div>
                </div>

                {/* Indicateur de statut des données */}
                {!isOnline && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <WifiOff size={12} />
                      Données locales uniquement
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}