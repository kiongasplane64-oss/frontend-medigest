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
  AlertTriangle,
  Table,
  ChevronUp,
  ChevronDown,
  Minus
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { profitService } from '@/services/profitService';

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

  // 3. Tous les vendeurs
  const { data: allSellers } = useQuery<TopSeller[]>({
    queryKey: ['all-sellers', period, dateRange],
    queryFn: () => profitService.getProfitByUser(
      period, 1000, // Récupère tous les vendeurs
      dateRange.from?.toISOString().split('T')[0],
      dateRange.to?.toISOString().split('T')[0]
    )
  });

  // 4. Tous les produits
  const { data: bestPerformers } = useQuery<BestPerformer>({
    queryKey: ['best-performers', period, dateRange],
    queryFn: () => profitService.getBestPerformers(
      period, 1000, // Récupère tous les produits
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

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'CDF' }).format(value);
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short'
    });
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <ChevronUp className="text-emerald-500" size={16} />;
      case 'down':
        return <ChevronDown className="text-red-500" size={16} />;
      default:
        return <Minus className="text-slate-500" size={16} />;
    }
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw size={48} className="animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-slate-600 text-lg">Chargement des analyses de bénéfices...</p>
          <div className="mt-6 space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-96 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 mt-6">
        {/* Cartes KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Tableaux de données */}
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="all">Toutes les données</TabsTrigger>
            <TabsTrigger value="sellers">Vendeurs</TabsTrigger>
            <TabsTrigger value="products">Produits</TabsTrigger>
            <TabsTrigger value="categories">Catégories</TabsTrigger>
          </TabsList>

          {/* Tableau complet */}
          <TabsContent value="all" className="mt-6 space-y-6">
            {/* Évolution quotidienne */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity size={20} className="text-blue-500" />
                  Évolution des bénéfices (30 jours)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Date</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Bénéfice</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Chiffre d'affaires</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyProfit?.map((day, index) => (
                        <tr 
                          key={day.date} 
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-slate-700">
                            {formatDate(day.date)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600">
                            {formatCurrency(day.profit)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(day.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              (day.profit / day.revenue * 100) > 20 
                                ? 'bg-emerald-100 text-emerald-700' 
                                : 'bg-amber-100 text-amber-700'
                            }`}>
                              {((day.profit / day.revenue) * 100).toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Tendance mensuelle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp size={20} className="text-blue-500" />
                  Tendance mensuelle
                  {trend && (
                    <span className={`ml-2 text-xs px-2 py-1 rounded-full font-bold ${
                      trend.trend_direction === 'up' ? 'bg-emerald-100 text-emerald-700' :
                      trend.trend_direction === 'down' ? 'bg-red-100 text-red-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {getTrendIcon(trend.trend_direction)}
                      {Math.abs(trend.trend_percentage).toFixed(1)}%
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Mois</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Bénéfice</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Chiffre d'affaires</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Prévision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trend?.monthly_data?.map((month, index) => (
                        <tr 
                          key={month.month}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4 font-medium text-slate-700">{month.month}</td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600">
                            {formatCurrency(month.profit)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(month.revenue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {trend?.forecast?.find(f => f.month === month.month) ? (
                              <span className="text-blue-600 font-medium">
                                {formatCurrency(trend.forecast.find(f => f.month === month.month)!.projected_profit)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendeurs */}
          <TabsContent value="sellers" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table size={20} className="text-blue-500" />
                  Tous les vendeurs ({allSellers?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">#</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Vendeur</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Rôle</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Bénéfice</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">CA</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Ventes</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSellers?.map((seller, index) => (
                        <tr 
                          key={seller.user_id}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs ${
                              index === 0 ? 'bg-amber-500' :
                              index === 1 ? 'bg-slate-500' :
                              index === 2 ? 'bg-amber-700' :
                              'bg-blue-500'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">{seller.user_name}</td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs text-slate-600">
                              {seller.user_role}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600">
                            {formatCurrency(seller.total_profit)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(seller.total_revenue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-1 bg-blue-50 rounded-full text-xs font-medium text-blue-600">
                              {seller.sale_count}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              seller.margin_rate > 25 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {seller.margin_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Produits */}
          <TabsContent value="products" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table size={20} className="text-blue-500" />
                  Tous les produits ({bestPerformers?.top_products.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">#</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Produit</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Code</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Bénéfice</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Unités vendues</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Marge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestPerformers?.top_products.map((product, index) => (
                        <tr 
                          key={product.product_id}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 font-bold text-xs">
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">{product.product_name}</td>
                          <td className="py-3 px-4">
                            <code className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                              {product.product_code}
                            </code>
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-emerald-600">
                            {formatCurrency(product.profit)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-1 bg-blue-50 rounded-full text-xs font-medium text-blue-600">
                              {product.total_sold}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.margin_rate > 25 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                            }`}>
                              {product.margin_rate.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Catégories */}
          <TabsContent value="categories" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Table size={20} className="text-blue-500" />
                  Répartition par catégorie
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200">
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">#</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Catégorie</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Chiffre d'affaires</th>
                        <th className="text-right py-3 px-4 text-slate-600 font-semibold">Part (%)</th>
                        <th className="text-left py-3 px-4 text-slate-600 font-semibold">Répartition</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bestPerformers?.top_categories.map((category, index) => (
                        <tr 
                          key={category.category}
                          className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                            index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <span className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 font-bold text-xs">
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-slate-700">{category.category}</td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatCurrency(category.total_revenue)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="px-2 py-1 bg-blue-50 rounded-full text-xs font-medium text-blue-600">
                              {category.percentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-full bg-slate-100 rounded-full h-2">
                              <div 
                                className="bg-purple-500 h-2 rounded-full transition-all" 
                                style={{ width: `${category.percentage}%` }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Comparaison des périodes */}
        {comparison && (
          <Card className="bg-linear-to-r from-blue-50 to-indigo-50 border-blue-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-700">
                <Activity size={20} />
                Comparaison des périodes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="text-left py-3 px-4 text-blue-700 font-semibold">Période précédente</th>
                      <th className="text-center py-3 px-4 text-blue-700 font-semibold">Évolution</th>
                      <th className="text-right py-3 px-4 text-blue-700 font-semibold">Période actuelle</th>
                      <th className="text-right py-3 px-4 text-blue-700 font-semibold">Variation</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white/50">
                      <td className="py-4 px-4 font-medium text-slate-600">
                        {formatCurrency(comparison.period2.profit)}
                        <div className="text-xs text-slate-400 mt-1">
                          {formatDate(comparison.period2.start)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        {getTrendIcon(comparison.trend)}
                      </td>
                      <td className="py-4 px-4 text-right font-bold text-slate-800">
                        {formatCurrency(comparison.period1.profit)}
                        <div className="text-xs text-slate-400 mt-1">
                          {formatDate(comparison.period1.start)}
                        </div>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          comparison.trend === 'up' ? 'bg-emerald-100 text-emerald-700' :
                          comparison.trend === 'down' ? 'bg-red-100 text-red-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {comparison.percentage_change > 0 ? '+' : ''}
                          {comparison.percentage_change.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
                {comparison.analysis && (
                  <div className="mt-4 p-3 bg-white/50 rounded-xl">
                    <p className="text-sm text-slate-600 italic">{comparison.analysis}</p>
                  </div>
                )}
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
                <table className="w-full text-sm">
                  <tbody>
                    {swot.strengths.map((s, i) => (
                      <tr key={i} className="border-b border-green-100 last:border-0">
                        <td className="py-2 px-1">
                          <span className="text-green-500 mr-2">✓</span>
                          {s.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <TrendingDown size={20} /> Faiblesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {swot.weaknesses.map((w, i) => (
                      <tr key={i} className="border-b border-red-100 last:border-0">
                        <td className="py-2 px-1">
                          <span className="text-red-500 mr-2">⚠</span>
                          {w.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Target size={20} /> Opportunités
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {swot.opportunities.map((o, i) => (
                      <tr key={i} className="border-b border-blue-100 last:border-0">
                        <td className="py-2 px-1">
                          <span className="text-blue-500 mr-2">💡</span>
                          {o.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle size={20} /> Menaces
                </CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <tbody>
                    {swot.threats.map((t, i) => (
                      <tr key={i} className="border-b border-amber-100 last:border-0">
                        <td className="py-2 px-1">
                          <span className="text-amber-500 mr-2">⚠</span>
                          {t.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              <table className="w-full text-sm">
                <tbody>
                  {swot.recommendations.map((rec, i) => (
                    <tr key={i} className="border-b border-indigo-100 last:border-0">
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {i + 1}
                          </div>
                          <p className="text-slate-700">{rec}</p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}