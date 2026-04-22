// src/modules/finance/capital/capital.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
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
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  Minus,
  DollarSign,
  Package,
  Wallet,
  Plus,
  Minus as MinusIcon,
  Download,
  RefreshCw,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/useToast';
import { usePharmacy } from '@/contexts/PharmacyContext';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';

// Types
interface CapitalData {
  id: string;
  tenant_id: string;
  pharmacy_id: string;
  branch_id: string | null;
  initial_capital: number;
  current_capital: number;
  cash_capital: number;
  stock_capital: number;
  equipment_capital: number;
  other_capital: number;
  start_date: string;
  last_update_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stock_value_real: number;
  stock_variance: number;
}

interface CapitalTransaction {
  id: string;
  capital_id: string;
  tenant_id: string;
  pharmacy_id: string;
  branch_id: string | null;
  transaction_type: 'initial' | 'increase' | 'decrease' | 'profit_added' | 'loss_deducted';
  transaction_category: 'cash' | 'stock' | 'equipment' | 'other' | 'turnover' | 'expense';
  amount: number;
  previous_capital: number;
  new_capital: number;
  reference_id: string | null;
  reference_type: string | null;
  description: string | null;
  notes: string | null;
  transaction_date: string;
  created_at: string;
  created_by: string | null;
}

interface CapitalPerformance {
  current_capital: number;
  initial_capital: number;
  variation: number;
  growth_rate: number;
  stock_value: number;
  cash_value: number;
  equipment_value: number;
  other_value: number;
  total_sales: number;
  total_expenses: number;
  total_debts: number;
  net_profit: number;
  roi: number;
}

interface CapitalEvolution {
  period: string;
  date: string;
  capital: number;
  transactions_count: number;
}

interface TurnoverStats {
  total_turnover: number;
  net_turnover: number;
  tax_amount: number;
  discount_amount: number;
  sales_count: number;
  items_sold: number;
  period_type: string;
  period_start: string;
  period_end: string;
  daily_average: number;
  weekly_average: number;
  monthly_average: number;
  comparison: {
    previous_total?: number;
    variation?: number;
    trend?: string;
  };
}

interface TurnoverTrend {
  year: number;
  month: number;
  month_name: string;
  period: string;
  total_turnover: number;
  expenses: number;
  profit: number;
  sales_count: number;
  days_in_month: number;
  moving_average_3m: number;
}

interface FinancialReport {
  pharmacy: { id: string; name: string; license_number: string };
  branch: { id: string | null; name: string | null };
  period: { start_date: string; end_date: string; days: number };
  balance_sheet: {
    assets: {
      stock_value: number;
      cash_capital: number;
      equipment_capital: number;
      other_assets: number;
      receivables: number;
      total_assets: number;
    };
    liabilities: {
      debts: number;
      total_liabilities: number;
    };
    equity: {
      initial_capital: number;
      current_capital: number;
      retained_earnings: number;
      total_equity: number;
    };
  };
  income_statement: {
    revenue: { total_sales: number; total_revenue: number };
    expenses: { total_expenses: number; expenses_breakdown: Array<{ category: string; amount: number }> };
    profit: { gross_profit: number; net_profit: number; profit_margin: number };
  };
  cash_flow: {
    beginning_cash: number;
    cash_in: number;
    cash_out: number;
    ending_cash: number;
  };
  key_metrics: {
    roe: number;
    profit_margin: number;
    stock_turnover: number;
    debt_to_equity: number;
    current_ratio: number;
  };
}

// Composant StatCard
const StatCard: React.FC<{
  title: string;
  value: number;
  currency?: string;
  icon: React.ReactNode;
  trend?: number;
  trendLabel?: string;
  loading?: boolean;
}> = ({ title, value, currency = 'CDF', icon, trend, trendLabel, loading }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      {loading ? (
        <Skeleton className="h-8 w-32" />
      ) : (
        <>
          <div className="text-2xl font-bold">
            {formatCurrency(value, currency as any)}
          </div>
          {trend !== undefined && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {trend > 0 ? (
                <ArrowUpRight className="h-3 w-3 text-green-500" />
              ) : trend < 0 ? (
                <ArrowDownRight className="h-3 w-3 text-red-500" />
              ) : (
                <Minus className="h-3 w-3 text-gray-500" />
              )}
              <span className={trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'}>
                {Math.abs(trend).toFixed(2)}%
              </span>
              {trendLabel && <span className="text-muted-foreground">{trendLabel}</span>}
            </p>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

const TransactionBadge: React.FC<{ type: string; category: string }> = ({ type, category }) => {
  const getColor = () => {
    if (type === 'initial') return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    if (type === 'increase') return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    if (type === 'decrease') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    if (type === 'profit_added') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
    if (type === 'loss_deducted') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  };

  const getLabel = () => {
    const labels: Record<string, string> = {
      initial: 'Initial',
      increase: 'Augmentation',
      decrease: 'Diminution',
      profit_added: 'Bénéfice',
      loss_deducted: 'Perte',
    };
    return labels[type] || type;
  };

  return (
    <Badge className={cn(getColor(), 'font-medium')}>
      {getLabel()} - {category}
    </Badge>
  );
};

// Page principale
export default function CapitalPage() {
  const { toast } = useToast();
  const { currentPharmacy } = usePharmacy();
  const [loading, setLoading] = useState(true);
  
  // États des données
  const [capital, setCapital] = useState<CapitalData | null>(null);
  const [transactions, setTransactions] = useState<CapitalTransaction[]>([]);
  const [performance, setPerformance] = useState<CapitalPerformance | null>(null);
  const [evolution, setEvolution] = useState<CapitalEvolution[]>([]);
  const [turnoverStats, setTurnoverStats] = useState<TurnoverStats | null>(null);
  const [turnoverTrend, setTurnoverTrend] = useState<TurnoverTrend[]>([]);
  const [financialReport, setFinancialReport] = useState<FinancialReport | null>(null);
  
  // États des filtres
  const [periodType, setPeriodType] = useState('month');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const evolutionMonths = 12;
  
  // États des dialogues
  const [addCapitalOpen, setAddCapitalOpen] = useState(false);
  const [withdrawCapitalOpen, setWithdrawCapitalOpen] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addCategory, setAddCategory] = useState('cash');
  const [addDescription, setAddDescription] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCategory, setWithdrawCategory] = useState('cash');
  const [withdrawDescription, setWithdrawDescription] = useState('');
  
  // États d'export
  const [exporting, setExporting] = useState(false);

  // Fonctions d'appel API
  const fetchCapital = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const branchParam = selectedBranch !== 'all' ? `&branch_id=${selectedBranch}` : '';
      const response = await fetch(`/capital/?include_transactions=true${branchParam}`);
      if (!response.ok) throw new Error('Erreur lors du chargement du capital');
      const data = await response.json();
      setCapital(data);
      if (data.transactions) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Error fetching capital:', error);
      toast({ title: 'Erreur', description: 'Impossible de charger les données du capital', variant: 'destructive' });
    }
  }, [currentPharmacy, selectedBranch, toast]);

  const fetchPerformance = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const branchParam = selectedBranch !== 'all' ? `&branch_id=${selectedBranch}` : '';
      const response = await fetch(`/capital/performance${branchParam}`);
      if (!response.ok) throw new Error('Erreur lors du chargement des performances');
      const data = await response.json();
      setPerformance(data);
    } catch (error) {
      console.error('Error fetching performance:', error);
    }
  }, [currentPharmacy, selectedBranch]);

  const fetchEvolution = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      params.append('months', evolutionMonths.toString());
      
      const response = await fetch(`/capital/evolution?${params}`);
      if (!response.ok) throw new Error('Erreur lors du chargement de l\'évolution');
      const data = await response.json();
      setEvolution(data.evolution || []);
    } catch (error) {
      console.error('Error fetching evolution:', error);
    }
  }, [currentPharmacy, selectedBranch, evolutionMonths]);

  const fetchTurnoverStats = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      params.append('period_type', periodType);
      
      const response = await fetch(`/capital/turnover?${params}`);
      if (!response.ok) throw new Error('Erreur lors du chargement du CA');
      const data = await response.json();
      setTurnoverStats(data);
    } catch (error) {
      console.error('Error fetching turnover stats:', error);
    }
  }, [currentPharmacy, selectedBranch, periodType]);

  const fetchTurnoverTrend = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      params.append('months', '12');
      
      const response = await fetch(`/capital/turnover/trend?${params}`);
      if (!response.ok) throw new Error('Erreur lors du chargement de la tendance');
      const data = await response.json();
      setTurnoverTrend(data.trend || []);
    } catch (error) {
      console.error('Error fetching turnover trend:', error);
    }
  }, [currentPharmacy, selectedBranch]);

  const fetchFinancialReport = useCallback(async () => {
    if (!currentPharmacy) return;
    
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      
      const response = await fetch(`/capital/financial-report?${params}`);
      if (!response.ok) throw new Error('Erreur lors du chargement du rapport');
      const data = await response.json();
      setFinancialReport(data);
    } catch (error) {
      console.error('Error fetching financial report:', error);
    }
  }, [currentPharmacy, selectedBranch]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchCapital(),
      fetchPerformance(),
      fetchEvolution(),
      fetchTurnoverStats(),
      fetchTurnoverTrend(),
      fetchFinancialReport(),
    ]);
    setLoading(false);
  }, [fetchCapital, fetchPerformance, fetchEvolution, fetchTurnoverStats, fetchTurnoverTrend, fetchFinancialReport]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Actions
  const handleAddCapital = async () => {
    if (!addAmount || parseFloat(addAmount) <= 0) {
      toast({ title: 'Erreur', description: 'Montant invalide', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch('/capital/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(addAmount),
          category: addCategory,
          description: addDescription || undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Erreur lors de l\'ajout');
      
      toast({ title: 'Succès', description: 'Capital ajouté avec succès' });
      setAddCapitalOpen(false);
      setAddAmount('');
      setAddDescription('');
      fetchAllData();
    } catch (error) {
      console.error('Error adding capital:', error);
      toast({ title: 'Erreur', description: 'Impossible d\'ajouter le capital', variant: 'destructive' });
    }
  };

  const handleWithdrawCapital = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast({ title: 'Erreur', description: 'Montant invalide', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch('/capital/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          category: withdrawCategory,
          description: withdrawDescription || undefined,
        }),
      });
      
      if (!response.ok) throw new Error('Erreur lors du retrait');
      
      toast({ title: 'Succès', description: 'Capital retiré avec succès' });
      setWithdrawCapitalOpen(false);
      setWithdrawAmount('');
      setWithdrawDescription('');
      fetchAllData();
    } catch (error) {
      console.error('Error withdrawing capital:', error);
      toast({ title: 'Erreur', description: 'Impossible de retirer le capital', variant: 'destructive' });
    }
  };

  const handleExportReport = async (format: string) => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      params.append('format', format);
      
      const response = await fetch(`/capital/financial-report?${params}`);
      if (!response.ok) throw new Error('Erreur lors de l\'export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_financier_${new Date().toISOString().split('T')[0]}.${format === 'csv' ? 'csv' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: 'Succès', description: 'Rapport exporté avec succès' });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({ title: 'Erreur', description: 'Erreur lors de l\'export', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  const handleSyncTurnover = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedBranch !== 'all') params.append('branch_id', selectedBranch);
      params.append('force_update', 'true');
      
      const response = await fetch(`/capital/turnover/sync?${params}`, { method: 'POST' });
      if (!response.ok) throw new Error('Erreur lors de la synchronisation');
      
      toast({ title: 'Succès', description: 'CA synchronisé avec succès' });
      fetchTurnoverStats();
      fetchTurnoverTrend();
    } catch (error) {
      console.error('Error syncing turnover:', error);
      toast({ title: 'Erreur', description: 'Erreur lors de la synchronisation', variant: 'destructive' });
    }
  };

  // Préparation des données pour les graphiques
  const evolutionChartData = evolution.map(item => ({
    name: item.period,
    capital: item.capital,
  }));

  const turnoverTrendData = turnoverTrend.map(item => ({
    name: item.month_name.substring(0, 3),
    turnover: item.total_turnover,
    expenses: item.expenses,
    profit: item.profit,
  }));

  // Rendu conditionnel du chargement
  if (loading && !capital) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gestion du Capital</h1>
          <p className="text-muted-foreground">
            Suivi du capital, chiffre d'affaires et performance financière
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedBranch} onValueChange={setSelectedBranch}>
            <SelectTrigger className="w-45">
              <SelectValue placeholder="Toutes les branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les branches</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleSyncTurnover()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Sync CA
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('excel')} disabled={exporting}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Export...' : 'Rapport'}
          </Button>
        </div>
      </div>

      {/* Cartes de résumé */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Capital Actuel"
          value={capital?.current_capital || 0}
          icon={<Wallet className="h-4 w-4 text-muted-foreground" />}
          trend={performance?.growth_rate}
          trendLabel="depuis création"
          loading={loading}
        />
        <StatCard
          title="Capital Initial"
          value={capital?.initial_capital || 0}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
        />
        <StatCard
          title="Valeur du Stock"
          value={capital?.stock_value_real || 0}
          icon={<Package className="h-4 w-4 text-muted-foreground" />}
          loading={loading}
        />
        <StatCard
          title="Chiffre d'Affaires (mois)"
          value={turnoverStats?.total_turnover || 0}
          icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
          trend={turnoverStats?.comparison.variation}
          trendLabel="vs mois précédent"
          loading={loading}
        />
      </div>

      {/* Onglets principaux */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="evolution">Évolution</TabsTrigger>
          <TabsTrigger value="turnover">Chiffre d'Affaires</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="financial">Rapport Financier</TabsTrigger>
        </TabsList>

        {/* Onglet Aperçu */}
        <TabsContent value="overview" className="space-y-4">
          {/* Actions rapides */}
          <div className="flex gap-3">
            <Dialog open={addCapitalOpen} onOpenChange={setAddCapitalOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter du capital
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ajouter du capital</DialogTitle>
                  <DialogDescription>
                    Ajoutez un montant au capital (investissement supplémentaire)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={addAmount}
                      onChange={(e) => setAddAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={addCategory} onValueChange={setAddCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Caisse</SelectItem>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="equipment">Équipement</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optionnel)</Label>
                    <Input
                      placeholder="Description..."
                      value={addDescription}
                      onChange={(e) => setAddDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddCapitalOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleAddCapital} className="bg-green-600">
                    Ajouter
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={withdrawCapitalOpen} onOpenChange={setWithdrawCapitalOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <MinusIcon className="h-4 w-4 mr-2" />
                  Retirer du capital
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Retirer du capital</DialogTitle>
                  <DialogDescription>
                    Retirez un montant du capital (prélèvement)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      placeholder="0.00"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Catégorie</Label>
                    <Select value={withdrawCategory} onValueChange={setWithdrawCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Caisse</SelectItem>
                        <SelectItem value="stock">Stock</SelectItem>
                        <SelectItem value="equipment">Équipement</SelectItem>
                        <SelectItem value="other">Autre</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description (optionnel)</Label>
                    <Input
                      placeholder="Description..."
                      value={withdrawDescription}
                      onChange={(e) => setWithdrawDescription(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setWithdrawCapitalOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleWithdrawCapital} variant="destructive">
                    Retirer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Graphique d'évolution */}
          <Card>
            <CardHeader>
              <CardTitle>Évolution du Capital</CardTitle>
              <CardDescription>
                Suivi de l'évolution du capital sur les {evolutionMonths} derniers mois
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolutionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number, 'CDF')} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="capital"
                      name="Capital"
                      stroke="#8884d8"
                      fill="#8884d8"
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Indicateurs de performance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performance?.roi.toFixed(2) || 0}%
                </div>
                <Progress
                  value={Math.min(Math.abs(performance?.roi || 0), 100)}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Retour sur investissement
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Marge Bénéficiaire</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {financialReport?.income_statement.profit.profit_margin.toFixed(2) || 0}%
                </div>
                <Progress
                  value={financialReport?.income_statement.profit.profit_margin || 0}
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Sur les 30 derniers jours
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Bénéfice Net</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(performance?.net_profit || 0, 'CDF')}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">
                    CA: {formatCurrency(performance?.total_sales || 0, 'CDF')}
                  </Badge>
                  <Badge variant="outline">
                    Dépenses: {formatCurrency(performance?.total_expenses || 0, 'CDF')}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Onglet Évolution */}
        <TabsContent value="evolution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Évolution détaillée du Capital</CardTitle>
              <CardDescription>
                Graphique détaillé de l'évolution du capital avec les transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number, 'CDF')} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="capital"
                      name="Capital"
                      stroke="#8884d8"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Points d'évolution</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Période</TableHead>
                    <TableHead>Capital</TableHead>
                    <TableHead>Variation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evolution.map((item, index) => {
                    const prevCapital = index > 0 ? evolution[index - 1].capital : item.capital;
                    const variation = item.capital - prevCapital;
                    return (
                      <TableRow key={item.period}>
                        <TableCell>{item.period}</TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(item.capital, 'CDF')}
                        </TableCell>
                        <TableCell>
                          <span className={variation >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {variation >= 0 ? '+' : ''}{formatCurrency(variation, 'CDF')}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Chiffre d'Affaires */}
        <TabsContent value="turnover" className="space-y-4">
          {/* Filtres CA */}
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Select value={periodType} onValueChange={setPeriodType}>
                <SelectTrigger className="w-37.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Journalier</SelectItem>
                  <SelectItem value="week">Hebdomadaire</SelectItem>
                  <SelectItem value="month">Mensuel</SelectItem>
                  <SelectItem value="year">Annuel</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleSyncTurnover}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Période: {turnoverStats?.period_start} - {turnoverStats?.period_end}
            </div>
          </div>

          {/* Cartes CA */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="CA Total"
              value={turnoverStats?.total_turnover || 0}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={turnoverStats?.comparison.variation}
              trendLabel="vs période précédente"
            />
            <StatCard
              title="CA Net HT"
              value={turnoverStats?.net_turnover || 0}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <StatCard
              title="TVA"
              value={turnoverStats?.tax_amount || 0}
              icon={<AlertCircle className="h-4 w-4" />}
            />
            <StatCard
              title="Articles vendus"
              value={turnoverStats?.items_sold || 0}
              icon={<Package className="h-4 w-4" />}
            />
          </div>

          {/* Graphique tendance CA */}
          <Card>
            <CardHeader>
              <CardTitle>Tendance du Chiffre d'Affaires</CardTitle>
              <CardDescription>
                Évolution sur les 12 derniers mois avec moyenne mobile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={turnoverTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value as number, 'CDF')} />
                    <Legend />
                    <Bar dataKey="turnover" name="CA" fill="#8884d8" />
                    <Bar dataKey="expenses" name="Dépenses" fill="#ff8042" />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name="Bénéfice"
                      stroke="#00C49F"
                      strokeWidth={2}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Transactions */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Historique des Transactions</CardTitle>
              <CardDescription>
                Toutes les opérations ayant modifié le capital
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Capital avant</TableHead>
                    <TableHead>Capital après</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{formatDate(tx.transaction_date)}</TableCell>
                      <TableCell>
                        <TransactionBadge type={tx.transaction_type} category={tx.transaction_category} />
                      </TableCell>
                      <TableCell className={tx.transaction_type === 'increase' ? 'text-green-600' : 'text-red-600'}>
                        {tx.transaction_type === 'increase' ? '+' : '-'}
                        {formatCurrency(tx.amount, 'CDF')}
                      </TableCell>
                      <TableCell>{formatCurrency(tx.previous_capital, 'CDF')}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(tx.new_capital, 'CDF')}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {tx.description || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Aucune transaction trouvée
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Rapport Financier */}
        <TabsContent value="financial" className="space-y-4">
          {/* Bilan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Bilan - Actif</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Stock</span>
                  <span className="font-medium">
                    {formatCurrency(financialReport?.balance_sheet.assets.stock_value || 0, 'CDF')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Caisse</span>
                  <span className="font-medium">
                    {formatCurrency(financialReport?.balance_sheet.assets.cash_capital || 0, 'CDF')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Équipement</span>
                  <span className="font-medium">
                    {formatCurrency(financialReport?.balance_sheet.assets.equipment_capital || 0, 'CDF')}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold">
                  <span>Total Actif</span>
                  <span>{formatCurrency(financialReport?.balance_sheet.assets.total_assets || 0, 'CDF')}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Bilan - Passif et Capitaux Propres</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Dettes</span>
                  <span className="font-medium text-red-600">
                    {formatCurrency(financialReport?.balance_sheet.liabilities.debts || 0, 'CDF')}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between">
                  <span>Capital actuel</span>
                  <span>{formatCurrency(financialReport?.balance_sheet.equity.current_capital || 0, 'CDF')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Réserves</span>
                  <span className="text-green-600">
                    {formatCurrency(financialReport?.balance_sheet.equity.retained_earnings || 0, 'CDF')}
                  </span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold">
                  <span>Total Capitaux Propres</span>
                  <span>{formatCurrency(financialReport?.balance_sheet.equity.total_equity || 0, 'CDF')}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Compte de résultat */}
          <Card>
            <CardHeader>
              <CardTitle>Compte de Résultat</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Chiffre d'affaires</span>
                <span className="font-medium text-green-600">
                  {formatCurrency(financialReport?.income_statement.revenue.total_sales || 0, 'CDF')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Dépenses</span>
                <span className="font-medium text-red-600">
                  {formatCurrency(financialReport?.income_statement.expenses.total_expenses || 0, 'CDF')}
                </span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between font-bold">
                <span>Bénéfice Net</span>
                <span className={(financialReport?.income_statement.profit.net_profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {formatCurrency(financialReport?.income_statement.profit.net_profit || 0, 'CDF')}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Marge bénéficiaire</span>
                <span>{financialReport?.income_statement.profit.profit_margin.toFixed(2) || 0}%</span>
              </div>
            </CardContent>
          </Card>

          {/* Indicateurs clés */}
          <Card>
            <CardHeader>
              <CardTitle>Indicateurs Clés de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">ROE</p>
                  <p className="text-xl font-bold">{financialReport?.key_metrics.roe.toFixed(2) || 0}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Marge</p>
                  <p className="text-xl font-bold">{financialReport?.key_metrics.profit_margin.toFixed(2) || 0}%</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Dette/Capitaux</p>
                  <p className="text-xl font-bold">{financialReport?.key_metrics.debt_to_equity.toFixed(2) || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Liquidité</p>
                  <p className="text-xl font-bold">{financialReport?.key_metrics.current_ratio.toFixed(2) || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}