// Rapports.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, TrendingUp, Package, Users, 
  CreditCard, Download, ArrowLeft,
  Activity, DollarSign, ShoppingBag,
  Printer, WifiOff, PieChart, Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { saleService, type SaleResponse} from '@/services/saleService';
import { useOnline } from '@/hooks/useOnline';
import { useToast } from '@/hooks/useToast';
import { formatCurrency, formatDate } from '@/utils/formatters';

interface ProductSales {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  category?: string;
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
  topProduct: { name: string; quantity: number; revenue: number };
  bestCashier: { name: string; sales: number; revenue: number };
  paymentBreakdown: PaymentBreakdown;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';
type ReportType = 'sales' | 'products' | 'cashiers' | 'payment';

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

function calculatePercentage(value: number, total: number): string {
  if (total === 0) return '0%';
  return ((value / total) * 100).toFixed(1) + '%';
}

export default function Rapports() {
  const isOnline = useOnline();
  const { toast } = useToast();
  
  const [sales, setSales] = useState<SaleResponse[]>([]);
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

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [sales, period, customStartDate, customEndDate]);

  async function loadData() {
    setLoading(true);
    try {
      const response = await saleService.getSales({
        limit: 1000,
        sort_by: 'created_at',
        sort_order: 'desc',
      });
      setSales(response.items || []);
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement des données",
        variant: "destructive",
      });
      setSales([]);
    } finally {
      setLoading(false);
    }
  }

  function getFilteredSales(): SaleResponse[] {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (period) {
      case 'today': {
        const start = today.getTime();
        const end = start + 24 * 60 * 60 * 1000 - 1;
        return sales.filter(s => {
          const date = new Date(s.created_at).getTime();
          return date >= start && date <= end;
        });
      }
      
      case 'week': {
        const start = today.getTime() - 7 * 24 * 60 * 60 * 1000;
        const end = today.getTime() + 24 * 60 * 60 * 1000 - 1;
        return sales.filter(s => {
          const date = new Date(s.created_at).getTime();
          return date >= start && date <= end;
        });
      }
      
      case 'month': {
        const start = today.getTime() - 30 * 24 * 60 * 60 * 1000;
        const end = today.getTime() + 24 * 60 * 60 * 1000 - 1;
        return sales.filter(s => {
          const date = new Date(s.created_at).getTime();
          return date >= start && date <= end;
        });
      }
      
      case 'year': {
        const start = today.getTime() - 365 * 24 * 60 * 60 * 1000;
        const end = today.getTime() + 24 * 60 * 60 * 1000 - 1;
        return sales.filter(s => {
          const date = new Date(s.created_at).getTime();
          return date >= start && date <= end;
        });
      }
      
      case 'custom':
        if (customStartDate && customEndDate) {
          const start = new Date(customStartDate).getTime();
          const end = new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1;
          return sales.filter(s => {
            const date = new Date(s.created_at).getTime();
            return date >= start && date <= end;
          });
        }
        return sales;
      
      default:
        return sales;
    }
  }

  const calculateStats = useCallback(() => {
    const filteredSales = getFilteredSales();
    
    const totalRevenue = filteredSales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
    const totalSales = filteredSales.length;
    const totalItems = filteredSales.reduce((sum, sale) => 
      sum + (sale.items ? sale.items.reduce((itemSum, item) => itemSum + (item.quantity || 0), 0) : 0), 0
    );
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    const paymentBreakdown = {
      cash: filteredSales.filter(s => s.payment_method === 'cash').reduce((sum, s) => sum + (s.total_amount || 0), 0),
      mobile: filteredSales.filter(s => s.payment_method === 'mobile_money').reduce((sum, s) => sum + (s.total_amount || 0), 0),
      account: filteredSales.filter(s => s.payment_method === 'account').reduce((sum, s) => sum + (s.total_amount || 0), 0)
    };

    const productsMap = new Map<string, ProductSales>();
    filteredSales.forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          const existing = productsMap.get(item.product_name) || {
            id: item.product_id,
            name: item.product_name,
            quantity: 0,
            revenue: 0,
            category: item.product_code || 'Autre'
          };
          existing.quantity += item.quantity;
          existing.revenue += (item.unit_price || 0) * (item.quantity || 0);
          productsMap.set(item.product_name, existing);
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

    const cashiersMap = new Map<string, CashierPerformance>();
    filteredSales.forEach(sale => {
      const cashierName = sale.seller_name || 'Inconnu';
      const existing = cashiersMap.get(cashierName) || {
        id: cashierName,
        name: cashierName,
        sales: 0,
        revenue: 0,
        average: 0
      };
      existing.sales += 1;
      existing.revenue += sale.total_amount || 0;
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

    const hourlyMap = new Map<string, { sales: number; revenue: number }>();
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(`${i}h`, { sales: 0, revenue: 0 });
    }
    
    filteredSales.forEach(sale => {
      if (sale.created_at) {
        const hour = new Date(sale.created_at).getHours();
        const hourData = hourlyMap.get(`${hour}h`) || { sales: 0, revenue: 0 };
        hourData.sales += 1;
        hourData.revenue += sale.total_amount || 0;
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

  function exportReport() {
    try {
      const filteredSales = getFilteredSales();
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
        totalSales: sales.length,
        sales: filteredSales.map(s => ({
          id: s.id,
          reference: s.reference,
          date: s.created_at,
          total: s.total_amount,
          paymentMethod: s.payment_method,
          cashier: s.seller_name,
          client: s.client_name,
          items: s.items?.length || 0
        }))
      };
      
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_${period}_${formatDate(new Date()).replace(/\//g, '-')}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export réussi",
        description: "Le rapport a été exporté",
      });
    } catch (error) {
      console.error('Erreur export:', error);
      toast({
        title: "Erreur",
        description: "Erreur lors de l'export",
        variant: "destructive",
      });
    }
  }

  function printReport() {
    window.print();
  }

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
          <Loader2 className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Chargement des rapports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {!isOnline && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          <WifiOff size={16} />
          Mode hors-ligne - Données locales uniquement
        </div>
      )}

      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/pos" 
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-2xl font-bold text-slate-800">Rapports et analyses</h1>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={printReport}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <Printer size={18} />
              Imprimer
            </button>
            <button
              onClick={exportReport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              <Download size={18} />
              Exporter
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 print:p-0">
        <div className="bg-white rounded-2xl p-6 border border-slate-100 mb-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            {period === 'custom' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-400 mb-2">
                  Période personnalisée
                </label>
                <div className="flex gap-3">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Date début"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Date fin"
                  />
                </div>
              </div>
            )}

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <DollarSign size={24} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Chiffre d'affaires</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(stats.totalRevenue)}
                </p>
                <p className="text-xs text-slate-400">{stats.totalSales} vente(s)</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                <ShoppingBag size={24} className="text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Nombre de ventes</p>
                <p className="text-2xl font-bold text-slate-800">{stats.totalSales}</p>
                <p className="text-xs text-slate-400">{stats.totalItems} articles</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Package size={24} className="text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Articles vendus</p>
                <p className="text-2xl font-bold text-slate-800">{stats.totalItems}</p>
                <p className="text-xs text-slate-400">
                  Moy. {(stats.totalItems / (stats.totalSales || 1)).toFixed(1)} art./vente
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <TrendingUp size={24} className="text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Ticket moyen</p>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(stats.averageTicket)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {reportType === 'sales' && (
            <>
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 p-5">
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                      <BarChart3 size={20} className="text-blue-600" />
                      Top 10 des produits
                    </h2>
                  </div>
                  <div className="p-5">
                    <div className="space-y-1">
                      {productSales.slice(0, 10).map((product, index) => (
                        <div key={product.id} className="flex items-center justify-between py-2 hover:bg-slate-50 px-2 rounded-lg transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-slate-400 w-6">#{index + 1}</span>
                            <div>
                              <p className="font-medium text-slate-700">{product.name}</p>
                              <p className="text-xs text-slate-400">{product.category || 'Produit'}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-blue-600">{product.quantity} vendus</p>
                            <p className="text-xs text-slate-400">{formatCurrency(product.revenue)}</p>
                          </div>
                        </div>
                      ))}
                      {productSales.length === 0 && (
                        <p className="text-center text-slate-400 py-8">Aucune donnée disponible</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-white rounded-2xl border border-slate-100">
                  <div className="border-b border-slate-100 p-5">
                    <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                      <Activity size={20} className="text-blue-600" />
                      Ventes par heure
                    </h2>
                  </div>
                  <div className="p-5">
                    <div className="space-y-2">
                      {hourlyData.filter(h => h.sales > 0).map(data => (
                        <div key={data.hour} className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 w-10">{data.hour}</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 rounded-full transition-all duration-500"
                              style={{ width: `${(data.sales / maxHourlySales) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium min-w-15 text-right">{data.sales} ventes</span>
                        </div>
                      ))}
                      {hourlyData.every(h => h.sales === 0) && (
                        <p className="text-center text-slate-400 py-8">Aucune vente sur cette période</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {reportType === 'products' && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-slate-100">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                    <Package size={20} className="text-blue-600" />
                    Détail des produits vendus
                  </h2>
                </div>
                <div className="p-5 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-3 text-sm font-medium text-slate-400">Produit</th>
                        <th className="text-right py-3 text-sm font-medium text-slate-400">Quantité</th>
                        <th className="text-right py-3 text-sm font-medium text-slate-400">Chiffre d'affaires</th>
                        <th className="text-right py-3 text-sm font-medium text-slate-400">Prix moyen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productSales.map((product) => (
                        <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50">
                          <td className="py-3 font-medium text-slate-700">{product.name}</td>
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
                          <td colSpan={4} className="text-center py-8 text-slate-400">
                            Aucune donnée disponible
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportType === 'cashiers' && (
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-slate-100">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                    <Users size={20} className="text-blue-600" />
                    Performance des caissiers
                  </h2>
                </div>
                <div className="p-5 overflow-x-auto">
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
              </div>
            </div>
          )}

          {reportType === 'payment' && (
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 p-6">
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
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6">
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
                </div>

                <div className="bg-white rounded-2xl border border-slate-100 p-6">
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
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 mt-6">
                <div className="border-b border-slate-100 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
                    <PieChart size={20} className="text-blue-600" />
                    Répartition des paiements
                  </h2>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {(['cash', 'mobile', 'account'] as const).map((method) => {
                      const value = stats.paymentBreakdown[method];
                      const percentage = stats.totalRevenue > 0 ? (value / stats.totalRevenue) * 100 : 0;
                      const colors = {
                        cash: 'bg-green-500',
                        mobile: 'bg-blue-500',
                        account: 'bg-purple-500'
                      };
                      const labels = {
                        cash: 'Espèces',
                        mobile: 'Mobile Money',
                        account: 'Compte Client'
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
                            {labels[method]}: {percentage.toFixed(1)}%
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="lg:col-span-3 mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="p-6">
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

                {!isOnline && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <p className="text-xs text-blue-600 flex items-center gap-1">
                      <WifiOff size={12} />
                      Données locales uniquement
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}