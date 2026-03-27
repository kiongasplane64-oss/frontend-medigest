// frontend/src/pages/ProfitAnalysis.tsx
import { 
  TrendingUp, 
  ArrowLeft,
  Target,
  RefreshCw,
  Store,
  TrendingDown,
  Award,
  DollarSign,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery} from '@tanstack/react-query';
import { useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { profitService } from '@/services/profitService';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell
} from 'recharts';

// Types pour les données
interface DailyProfitData {
  date: string;
  profit: number;
  revenue: number;
}

interface TrendData {
  trend_direction: 'up' | 'down' | 'stable';
  trend_percentage: number;
  monthly_data: Array<{ month: string; profit: number; revenue: number }>;
  forecast: Array<{ month: string; projected_profit: number }>;
}

interface TopSeller {
  user_id: string;
  user_name: string;
  user_role: string;
  total_profit: number;
  total_revenue: number;
  sale_count: number;
  margin_rate: number;
}

interface BestPerformer {
  top_products: Array<{
    product_id: string;
    product_name: string;
    product_code: string;
    profit: number;
    total_sold: number;
    margin_rate: number;
  }>;
  top_categories: Array<{
    category: string;
    total_revenue: number;
    percentage: number;
  }>;
}

interface SWOTAnalysis {
  strengths: Array<{ description: string }>;
  weaknesses: Array<{ description: string }>;
  opportunities: Array<{ description: string }>;
  threats: Array<{ description: string }>;
  recommendations: string[];
}

interface ProfitStats {
  gross_profit: number;
  net_profit: number;
  expected_profit: number;
  remaining_profit: number;
  total_revenue: number;
  margin_rate: number;
  selling_value: number;
  purchase_value: number;
}

interface ProfitComparison {
  period1: { start: string; profit: number };
  period2: { start: string; profit: number };
  trend: 'up' | 'down' | 'stable';
  percentage_change: number;
  analysis: string;
}

export default function ProfitAnalysis() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});

  // 1. Statistiques globales
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<ProfitStats>({
    queryKey: ['profit-stats', period, dateRange],
    queryFn: () => profitService.getStats({
      period,
      startDate: dateRange.from?.toISOString().split('T')[0],
      endDate: dateRange.to?.toISOString().split('T')[0]
    }),
    refetchInterval: 30000
  });

  // 2. Bénéfices journaliers
  const { data: dailyProfit } = useQuery<DailyProfitData[]>({
    queryKey: ['daily-profit'],
    queryFn: () => profitService.getDailyProfit(30)
  });

  // 3. Top vendeurs
  const { data: topSellers } = useQuery<TopSeller[]>({
    queryKey: ['top-sellers', period, dateRange],
    queryFn: () => profitService.getProfitByUser(
      period, 5, 
      dateRange.from?.toISOString().split('T')[0],
      dateRange.to?.toISOString().split('T')[0]
    )
  });

  // 4. Top produits
  const { data: bestPerformers } = useQuery<BestPerformer>({
    queryKey: ['best-performers', period, dateRange],
    queryFn: () => profitService.getBestPerformers(
      period, 5,
      dateRange.from?.toISOString().split('T')[0],
      dateRange.to?.toISOString().split('T')[0]
    )
  });

  // 5. Tendance
  const { data: trend } = useQuery<TrendData>({
    queryKey: ['profit-trend'],
    queryFn: () => profitService.getProfitTrend(12)
  });

  // 6. Analyse SWOT
  const { data: swot } = useQuery<SWOTAnalysis>({
    queryKey: ['swot-analysis'],
    queryFn: () => profitService.getSWOTAnalysis()
  });

  // 7. Comparaison
  const { data: comparison } = useQuery<ProfitComparison>({
    queryKey: ['profit-comparison', period],
    queryFn: () => {
      const now = new Date();
      const previousPeriod = new Date();
      if (period === 'month') {
        previousPeriod.setMonth(previousPeriod.getMonth() - 1);
      } else if (period === 'week') {
        previousPeriod.setDate(previousPeriod.getDate() - 7);
      } else {
        previousPeriod.setFullYear(previousPeriod.getFullYear() - 1);
      }
      return profitService.compareProfit(
        period, period,
        previousPeriod.toISOString().split('T')[0],
        now.toISOString().split('T')[0]
      );
    }
  });

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'CDF' }).format(value);
  };

  // Formateur compatible avec toutes les signatures de Recharts
  const tooltipFormatter = (value: any): React.ReactNode => {
    // Gérer undefined, null
    if (value === undefined || value === null) {
      return '0 FCFA';
    }
    
    // Gérer les tableaux (stacked charts)
    if (Array.isArray(value)) {
      const firstValue = value[0];
      if (typeof firstValue === 'number') {
        return formatCurrency(firstValue);
      }
      return String(firstValue || '0');
    }
    
    // Gérer les nombres
    if (typeof value === 'number') {
      return formatCurrency(value);
    }
    
    // Gérer les strings
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return formatCurrency(parsed);
      }
      return value;
    }
    
    // Fallback
    return '0 FCFA';
  };

  if (statsLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col space-y-8 pb-10">
        <div className="flex justify-between items-center">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => navigate(-1)}
                className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-blue-600 hover:shadow-lg transition-all group"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              </button>
              <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">Analyse des Bénéfices</h1>
                <p className="text-slate-500 font-medium">Suivi en temps réel de la rentabilité</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select value={period} onValueChange={(v: 'day' | 'week' | 'month' | 'year') => setPeriod(v)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Jour</SelectItem>
                  <SelectItem value="week">Semaine</SelectItem>
                  <SelectItem value="month">Mois</SelectItem>
                  <SelectItem value="year">Année</SelectItem>
                </SelectContent>
              </Select>

              <DateRangePicker
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                className="w-auto"
              />

              <button 
                onClick={() => refetchStats()}
                className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-500 hover:text-blue-600 transition-all"
              >
                <RefreshCw size={18} className={statsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 mt-8">
        {/* Cartes KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-linear-to-br from-blue-50 to-white border-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Bénéfice Brut</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {formatCurrency(stats?.gross_profit || 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Marge: {stats?.margin_rate.toFixed(1)}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <TrendingUp className="text-blue-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-emerald-50 to-white border-emerald-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-emerald-600">Bénéfice Net</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {formatCurrency(stats?.net_profit || 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    CA: {formatCurrency(stats?.total_revenue || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                  <DollarSign className="text-emerald-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-purple-50 to-white border-purple-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Profit Attendu</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {formatCurrency(stats?.expected_profit || 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Restant: {formatCurrency(stats?.remaining_profit || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
                  <Target className="text-purple-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-linear-to-br from-amber-50 to-white border-amber-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Valeur Stock</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {formatCurrency(stats?.selling_value || 0)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    Achat: {formatCurrency(stats?.purchase_value || 0)}
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <Store className="text-amber-600" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Graphiques principaux */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Évolution quotidienne */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity size={20} className="text-blue-500" />
                Évolution des bénéfices (30 jours)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyProfit}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip 
                    formatter={tooltipFormatter}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} name="Bénéfice" dot={false} />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} name="CA" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Tendance avec prévisions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp size={20} className="text-blue-500" />
                Tendance & Prévisions
                {trend && (
                  <span className={`ml-2 text-xs px-2 py-1 rounded-full font-bold ${
                    trend.trend_direction === 'up' ? 'bg-emerald-100 text-emerald-700' :
                    trend.trend_direction === 'down' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {trend.trend_direction === 'up' ? '↑ +' : trend.trend_direction === 'down' ? '↓ ' : '→ '}
                    {Math.abs(trend.trend_percentage).toFixed(1)}%
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trend?.monthly_data?.slice(-6)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, angle: -45, textAnchor: 'end' }} height={80} />
                  <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={tooltipFormatter} />
                  <Bar dataKey="profit" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Bénéfice" />
                  <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} name="CA" />
                </BarChart>
              </ResponsiveContainer>
              {trend?.forecast && trend.forecast.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs font-bold text-blue-700 mb-2">📈 Prévisions 3 mois</p>
                  <div className="flex justify-between">
                    {trend.forecast.map((f, i) => (
                      <div key={i} className="text-center">
                        <p className="text-xs text-slate-500">{f.month.split(' ')[0]}</p>
                        <p className="text-sm font-bold text-blue-600">{formatCurrency(f.projected_profit)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="sellers" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="sellers">Top Vendeurs</TabsTrigger>
            <TabsTrigger value="products">Top Produits</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
          </TabsList>

          {/* Top Vendeurs */}
          <TabsContent value="sellers" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topSellers?.map((seller, index) => (
                <Card key={seller.user_id} className="hover:shadow-lg transition-all">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold ${
                        index === 0 ? 'bg-linear-to-br from-amber-400 to-amber-600' :
                        index === 1 ? 'bg-linear-to-br from-slate-400 to-slate-600' :
                        'bg-linear-to-br from-blue-400 to-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-slate-800">{seller.user_name}</p>
                        <p className="text-xs text-slate-500">{seller.user_role}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">{formatCurrency(seller.total_profit)}</p>
                        <p className="text-xs text-slate-500">{seller.sale_count} ventes</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">CA: {formatCurrency(seller.total_revenue)}</span>
                        <span className="text-slate-500">Marge: {seller.margin_rate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Top Produits */}
          <TabsContent value="products" className="mt-6">
            <div className="space-y-3">
              {bestPerformers?.top_products.map((product, index) => (
                <Card key={product.product_id} className="hover:shadow-md transition-all">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{product.product_name}</p>
                          <p className="text-xs text-slate-500">Code: {product.product_code}</p>
                        </div>
                      </div>
                      <div className="flex gap-6">
                        <div className="text-right">
                          <p className="text-sm font-bold text-blue-600">{formatCurrency(product.profit)}</p>
                          <p className="text-xs text-slate-500">Bénéfice</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-emerald-600">{product.total_sold} unités</p>
                          <p className="text-xs text-slate-500">Vendues</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-purple-600">{product.margin_rate.toFixed(1)}%</p>
                          <p className="text-xs text-slate-500">Marge</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Catégories */}
          <TabsContent value="categories" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Répartition des ventes par catégorie</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RePieChart>
                      <Pie
                        data={bestPerformers?.top_categories}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="total_revenue"
                        nameKey="category"
                      >
                        {bestPerformers?.top_categories.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipFormatter} />
                      <Legend />
                    </RePieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Détail par catégorie</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {bestPerformers?.top_categories.map((category, index) => (
                    <div key={category.category} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                        <span className="font-medium">{category.category}</span>
                      </div>
                      <div className="flex gap-4">
                        <span className="font-bold">{formatCurrency(category.total_revenue)}</span>
                        <span className="text-slate-500">{category.percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Comparaison des périodes */}
        {comparison && (
          <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-100">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-medium text-blue-600">Comparaison des périodes</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(comparison.period2.start).toLocaleDateString()} → {new Date(comparison.period1.start).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Période précédente</p>
                    <p className="text-xl font-bold text-slate-700">{formatCurrency(comparison.period2.profit)}</p>
                  </div>
                  <div className="text-2xl font-bold">
                    {comparison.trend === 'up' ? '→' : comparison.trend === 'down' ? '←' : '•'}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Période actuelle</p>
                    <p className="text-xl font-bold text-slate-800">{formatCurrency(comparison.period1.profit)}</p>
                  </div>
                  <div className={`px-3 py-2 rounded-xl font-bold ${
                    comparison.trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
                    comparison.trend === 'down' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {comparison.percentage_change > 0 ? '+' : ''}{comparison.percentage_change.toFixed(1)}%
                  </div>
                </div>
                <p className="text-sm text-slate-600 italic max-w-md">{comparison.analysis}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analyse SWOT */}
        {swot && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <TrendingUp size={20} /> Forces
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {swot.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-green-500">✓</span>
                      <span>{s.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <TrendingDown size={20} /> Faiblesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {swot.weaknesses.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-red-500">⚠</span>
                      <span>{w.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Target size={20} /> Opportunités
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {swot.opportunities.map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-blue-500">💡</span>
                      <span>{o.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle size={20} /> Menaces
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {swot.threats.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500">⚠</span>
                      <span>{t.description}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recommandations */}
        {swot?.recommendations && swot.recommendations.length > 0 && (
          <Card className="bg-linear-to-r from-indigo-50 to-purple-50 border-indigo-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award size={20} className="text-indigo-600" />
                Recommandations stratégiques
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {swot.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl">
                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                      {i + 1}
                    </div>
                    <p className="text-sm text-slate-700">{rec}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}