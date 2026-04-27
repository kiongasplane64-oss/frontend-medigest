// pages/Expense.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';
import { toast } from 'sonner';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';

// UI Components
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';

// Icons
import {
  Plus,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Receipt,
  AlertCircle,
  FileText,
  Upload,
  MoreHorizontal,
  BarChart3,
  RefreshCw,
  Ban,
} from 'lucide-react';

// Chart imports
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
  Cell,
} from 'recharts';

// ============================================================================
// TYPES
// ============================================================================

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_type: string;
  expense_date: string;
  created_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  branch_id?: string;
  user_id: string;
  approved_by?: string;
  approved_at?: string;
  receipt_url?: string;
  notes?: string;
  branch_name?: string;
  user_name?: string;
  approver_name?: string;
}

interface ExpenseCreate {
  description: string;
  amount: number;
  expense_type: string;
  expense_date: string;
  branch_id?: string;
  notes?: string;
  receipt?: File;
}

interface ExpenseUpdate {
  description?: string;
  amount?: number;
  expense_type?: string;
  expense_date?: string;
  notes?: string;
}

interface ExpenseFilters {
  branch_id?: string;
  user_id?: string;
  expense_type?: string;
  approval_status?: string;
  start_date?: string;
  end_date?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
}

interface ExpenseListResponse {
  items: Expense[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

interface ExpenseSummary {
  total_amount: number;
  average_amount: number;
  count: number;
  by_type: Record<string, { total: number; count: number }>;
  by_status: Record<string, { total: number; count: number }>;
  daily_trend: Array<{ date: string; total: number; count: number }>;
  period_comparison: {
    current_period: { total: number; count: number };
    previous_period: { total: number; count: number };
    percent_change: number;
  };
}

interface Branch {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  is_main_branch: boolean;
}

interface User {
  id: string;
  nom_complet: string;
  email: string;
  branch_id?: string;
}

interface ExpenseConfig {
  enabled: boolean;
  min_amount: number;
  max_amount: number;
  period: 'day' | 'week' | 'month' | 'year';
  require_approval_threshold: number;
  allowed_types: string[];
  require_receipt_threshold: number;
}

const EXPENSE_TYPES = [
  { value: 'rent', label: 'Loyer', icon: '🏢' },
  { value: 'utilities', label: 'Électricité/Eau', icon: '💡' },
  { value: 'salaries', label: 'Salaires', icon: '💰' },
  { value: 'inventory', label: 'Achats stock', icon: '📦' },
  { value: 'transport', label: 'Transport', icon: '🚗' },
  { value: 'marketing', label: 'Marketing', icon: '📢' },
  { value: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { value: 'taxes', label: 'Taxes', icon: '📋' },
  { value: 'insurance', label: 'Assurances', icon: '🛡️' },
  { value: 'software', label: 'Logiciels', icon: '💻' },
  { value: 'office_supplies', label: 'Fournitures bureau', icon: '📎' },
  { value: 'medical_supplies', label: 'Fournitures médicales', icon: '💊' },
  { value: 'other', label: 'Autre', icon: '📌' },
];

const STATUS_CONFIG = {
  pending: { label: 'En attente', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock },
  approved: { label: 'Approuvé', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
  rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

const PERIODS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'week', label: 'Cette semaine' },
  { value: 'last_week', label: 'Semaine dernière' },
  { value: 'month', label: 'Ce mois' },
  { value: 'last_month', label: 'Mois dernier' },
  { value: 'year', label: 'Cette année' },
  { value: 'custom', label: 'Personnalisé' },
];

// ============================================================================
// API SERVICES
// ============================================================================

const expenseApi = {
  getExpenses: (params: {
    page?: number;
    per_page?: number;
    branch_id?: string;
    user_id?: string;
    expense_type?: string;
    approval_status?: string;
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
    search?: string;
    sort_by?: string;
    sort_desc?: boolean;
  }) => api.get<ExpenseListResponse>('/expenses', { params }),

  getExpense: (id: string) => api.get<Expense>(`/expenses/${id}`),

  createExpense: (data: FormData) =>
    api.post<Expense>('/expenses', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),

  updateExpense: (id: string, data: ExpenseUpdate) =>
    api.put<Expense>(`/expenses/${id}`, data),

  deleteExpense: (id: string) => api.delete(`/expenses/${id}`),

  approveExpense: (id: string, approved: boolean, rejection_reason?: string) =>
    api.post<Expense>(`/expenses/${id}/approve`, { approved, rejection_reason }),

  getSummary: (start_date: string, end_date: string) =>
    api.get<ExpenseSummary>('/expenses/reports/summary', {
      params: { start_date, end_date },
    }),

  getByBranch: (start_date: string, end_date: string) =>
    api.get<any[]>('/expenses/reports/by-branch', { params: { start_date, end_date } }),

  getByUser: (start_date: string, end_date: string) =>
    api.get<any[]>('/expenses/reports/by-user', { params: { start_date, end_date } }),

  getExpenseDetails: (id: string) => api.get(`/expenses/${id}/details`),
};

const configApi = {
  getPharmacyConfig: (pharmacyId: string) =>
    api.get(`/pharmacies/${pharmacyId}/config`),
  getBranches: (pharmacyId: string) =>
    api.get(`/pharmacies/${pharmacyId}/branches`),
  getUsers: (branchId?: string) =>
    api.get('/users', { params: { branch_id: branchId } }),
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const Expense: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // États
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [expenseConfig, setExpenseConfig] = useState<ExpenseConfig | null>(null);
  const [primaryCurrency, setPrimaryCurrency] = useState('CDF');

  // États de filtrage
  const [filters, setFilters] = useState<ExpenseFilters>({});
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [activeTab, setActiveTab] = useState('list');
  const [selectedPeriod, setSelectedPeriod] = useState('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // États pour les dialogues
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // États pour le formulaire de création
  const [formData, setFormData] = useState<ExpenseCreate>({
    description: '',
    amount: 0,
    expense_type: 'other',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // États pour le formulaire de modification
  const [editFormData, setEditFormData] = useState<ExpenseUpdate>({});

  // États de chargement
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Vérifier si l'utilisateur est admin ou manager
  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'super_admin';
  }, [user]);

  const isManager = useMemo(() => {
    return user?.role === 'manager' || user?.role === 'MANAGER' || isAdmin;
  }, [user, isAdmin]);

  // Charger la pharmacie active
  useEffect(() => {
    const loadActivePharmacy = async () => {
      try {
        const response = await api.get('/pharmacies/active');
        setPharmacyId(response.data.id);
        await loadPharmacyData(response.data.id);
      } catch (error) {
        console.error('Erreur chargement pharmacie:', error);
      }
    };
    loadActivePharmacy();
  }, []);

  // Charger les données de la pharmacie
  const loadPharmacyData = async (id: string) => {
    try {
      // Charger la configuration
      const configRes = await configApi.getPharmacyConfig(id);
      const config = configRes.data.config || {};
      if (config.expenseLimits) setExpenseConfig(config.expenseLimits);
      if (config.primaryCurrency) setPrimaryCurrency(config.primaryCurrency);

      // Charger les branches
      const branchesRes = await configApi.getBranches(id);
      setBranches(branchesRes.data.filter((b: Branch) => b.is_active));

      // Charger les utilisateurs
      const usersRes = await configApi.getUsers();
      setUsers(usersRes.data);
    } catch (error) {
      console.error('Erreur chargement données:', error);
    }
  };

  // Calculer les dates de période
  const getPeriodDates = useCallback(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        return {
          start_date: format(startOfDay(now), 'yyyy-MM-dd'),
          end_date: format(endOfDay(now), 'yyyy-MM-dd'),
        };
      case 'yesterday':
        const yesterday = subDays(now, 1);
        return {
          start_date: format(startOfDay(yesterday), 'yyyy-MM-dd'),
          end_date: format(endOfDay(yesterday), 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          start_date: format(startOfWeek(now, { locale: fr }), 'yyyy-MM-dd'),
          end_date: format(endOfWeek(now, { locale: fr }), 'yyyy-MM-dd'),
        };
      case 'last_week':
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { locale: fr });
        const lastWeekEnd = endOfWeek(subWeeks(now, 1), { locale: fr });
        return {
          start_date: format(lastWeekStart, 'yyyy-MM-dd'),
          end_date: format(lastWeekEnd, 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          start_date: format(startOfMonth(now), 'yyyy-MM-dd'),
          end_date: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'last_month':
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(subMonths(now, 1));
        return {
          start_date: format(lastMonthStart, 'yyyy-MM-dd'),
          end_date: format(lastMonthEnd, 'yyyy-MM-dd'),
        };
      case 'year':
        return {
          start_date: format(startOfYear(now), 'yyyy-MM-dd'),
          end_date: format(endOfYear(now), 'yyyy-MM-dd'),
        };
      case 'custom':
        return {
          start_date: customStartDate || format(startOfMonth(now), 'yyyy-MM-dd'),
          end_date: customEndDate || format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      default:
        return {
          start_date: format(startOfMonth(now), 'yyyy-MM-dd'),
          end_date: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
    }
  }, [selectedPeriod, customStartDate, customEndDate]);

  // Requête pour récupérer les dépenses
  const {
    data: expensesResponse,
    isLoading: expensesLoading,
    refetch: refetchExpenses,
  } = useQuery({
    queryKey: ['expenses', filters, page, perPage],
    queryFn: () =>
      expenseApi.getExpenses({
        page,
        per_page: perPage,
        ...filters,
        ...(filters.start_date ? {} : getPeriodDates()),
      }),
    enabled: !!pharmacyId,
  });

  const expensesData = expensesResponse?.data;

  // Requête pour le résumé
  const { data: summaryResponse, isLoading: summaryLoading } = useQuery({
    queryKey: ['expense-summary', selectedPeriod, customStartDate, customEndDate],
    queryFn: () => {
      const { start_date, end_date } = getPeriodDates();
      return expenseApi.getSummary(start_date, end_date);
    },
    enabled: !!pharmacyId,
  });

  const summaryData = summaryResponse?.data;

  // Requête pour les rapports par branche
  const { data: branchReportResponse } = useQuery({
    queryKey: ['expense-branch-report', selectedPeriod, customStartDate, customEndDate],
    queryFn: () => {
      const { start_date, end_date } = getPeriodDates();
      return expenseApi.getByBranch(start_date, end_date);
    },
    enabled: !!pharmacyId && activeTab === 'reports',
  });

  const branchReportData = branchReportResponse?.data;

  // Requête pour les rapports par utilisateur
  const { data: userReportResponse } = useQuery({
    queryKey: ['expense-user-report', selectedPeriod, customStartDate, customEndDate],
    queryFn: () => {
      const { start_date, end_date } = getPeriodDates();
      return expenseApi.getByUser(start_date, end_date);
    },
    enabled: !!pharmacyId && activeTab === 'reports',
  });

  const userReportData = userReportResponse?.data;

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await expenseApi.createExpense(data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Dépense créée avec succès');
      setCreateDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
    onError: (error: any) => {
      const detail = error.response?.data?.detail;
      if (typeof detail === 'object' && detail.errors) {
        const errors: Record<string, string> = {};
        detail.errors.forEach((err: any) => {
          errors[err.field] = err.message;
        });
        setFormErrors(errors);
      } else {
        toast.error(detail || "Erreur lors de la création");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ExpenseUpdate }) =>
      expenseApi.updateExpense(id, data),
    onSuccess: () => {
      toast.success('Dépense modifiée avec succès');
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erreur lors de la modification");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expenseApi.deleteExpense(id),
    onSuccess: () => {
      toast.success('Dépense supprimée avec succès');
      setDeleteDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erreur lors de la suppression");
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, approved, reason }: { id: string; approved: boolean; reason?: string }) =>
      expenseApi.approveExpense(id, approved, reason),
    onSuccess: (_, variables) => {
      toast.success(variables.approved ? 'Dépense approuvée' : 'Dépense rejetée');
      setApproveDialogOpen(false);
      setRejectionReason('');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erreur lors de l'approbation");
    },
  });

  // Fonctions utilitaires
  const resetForm = () => {
    setFormData({
      description: '',
      amount: 0,
      expense_type: 'other',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
    setReceiptFile(null);
    setFormErrors({});
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.description.trim()) {
      errors.description = 'La description est requise';
    }
    if (formData.amount <= 0) {
      errors.amount = 'Le montant doit être supérieur à 0';
    }
    if (expenseConfig) {
      if (formData.amount < expenseConfig.min_amount) {
        errors.amount = `Le montant minimum est de ${expenseConfig.min_amount} ${primaryCurrency}`;
      }
      if (formData.amount > expenseConfig.max_amount) {
        errors.amount = `Le montant maximum est de ${expenseConfig.max_amount} ${primaryCurrency}`;
      }
    }
    if (!formData.expense_date) {
      errors.expense_date = 'La date est requise';
    }
    if (expenseConfig?.require_receipt_threshold && formData.amount >= expenseConfig.require_receipt_threshold && !receiptFile) {
      errors.receipt = 'Un justificatif est requis pour ce montant';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const submitData = new FormData();
      submitData.append('description', formData.description);
      submitData.append('amount', String(formData.amount));
      submitData.append('expense_type', formData.expense_type);
      submitData.append('expense_date', formData.expense_date);
      if (formData.branch_id) submitData.append('branch_id', formData.branch_id);
      if (formData.notes) submitData.append('notes', formData.notes);
      if (receiptFile) submitData.append('receipt', receiptFile);

      await createMutation.mutateAsync(submitData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedExpense) return;
    await updateMutation.mutateAsync({
      id: selectedExpense.id,
      data: editFormData,
    });
  };

  const handleDelete = async () => {
    if (!selectedExpense) return;
    await deleteMutation.mutateAsync(selectedExpense.id);
  };

  const handleApprove = async (approved: boolean) => {
    if (!selectedExpense) return;
    await approveMutation.mutateAsync({
      id: selectedExpense.id,
      approved,
      reason: approved ? undefined : rejectionReason,
    });
  };

  const openEditDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setEditFormData({
      description: expense.description,
      amount: expense.amount,
      expense_type: expense.expense_type,
      expense_date: expense.expense_date.split('T')[0],
      notes: expense.notes,
    });
    setEditDialogOpen(true);
  };

  const openApproveDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setRejectionReason('');
    setApproveDialogOpen(true);
  };

  const openDeleteDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setDeleteDialogOpen(true);
  };

  const openViewDialog = (expense: Expense) => {
    setSelectedExpense(expense);
    setViewDialogOpen(true);
  };

  // Calculer les KPI
  const kpiData = useMemo(() => {
    if (!summaryData) return null;
    return {
      total: summaryData.total_amount,
      average: summaryData.average_amount,
      count: summaryData.count,
      percentChange: summaryData.period_comparison?.percent_change || 0,
      isPositive: (summaryData.period_comparison?.percent_change || 0) < 0,
    };
  }, [summaryData]);

  // Préparer les données pour les graphiques
  const chartData = useMemo(() => {
    if (!summaryData?.daily_trend) return [];
    return summaryData.daily_trend.map((item) => ({
      date: format(parseISO(item.date), 'dd/MM', { locale: fr }),
      total: item.total,
      count: item.count,
    }));
  }, [summaryData]);

  const typeChartData = useMemo(() => {
    if (!summaryData?.by_type) return [];
    return Object.entries(summaryData.by_type).map(([type, data]) => ({
      name: EXPENSE_TYPES.find(t => t.value === type)?.label || type,
      value: data.total,
      count: data.count,
    }));
  }, [summaryData]);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4'];

  // Rendu du badge de statut
  const renderStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
    if (!config) return <Badge variant="outline">{status}</Badge>;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} border-none`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Rendu du filtre par période
  const renderPeriodFilter = () => (
    <div className="flex flex-wrap gap-3 items-center">
      <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="Période" />
        </SelectTrigger>
        <SelectContent>
          {PERIODS.map((period) => (
            <SelectItem key={period.value} value={period.value}>
              {period.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedPeriod === 'custom' && (
        <div className="flex gap-2 items-center">
          <Input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="w-36"
          />
          <span>→</span>
          <Input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="w-36"
          />
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          refetchExpenses();
          queryClient.invalidateQueries({ queryKey: ['expense-summary'] });
        }}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Actualiser
      </Button>
    </div>
  );

  // Rendu des cartes KPI
  const renderKPICards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total des dépenses</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {kpiData?.total?.toLocaleString()} {primaryCurrency}
              </div>
              <p className="text-xs text-muted-foreground">
                {kpiData?.count} transaction(s)
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Dépense moyenne</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {kpiData?.average?.toLocaleString()} {primaryCurrency}
              </div>
              <p className="text-xs text-muted-foreground">
                Par transaction
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Évolution</CardTitle>
          {kpiData?.isPositive ? (
            <TrendingDown className="h-4 w-4 text-green-500" />
          ) : (
            <TrendingUp className="h-4 w-4 text-red-500" />
          )}
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <div className={`text-2xl font-bold ${kpiData?.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(kpiData?.percentChange || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                vs période précédente
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">En attente</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {summaryLoading ? (
            <Skeleton className="h-8 w-32" />
          ) : (
            <>
              <div className="text-2xl font-bold">
                {summaryData?.by_status?.pending?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {summaryData?.by_status?.pending?.total?.toLocaleString()} {primaryCurrency}
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // Rendu des graphiques
  const renderCharts = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card>
        <CardHeader>
          <CardTitle>Évolution quotidienne</CardTitle>
          <CardDescription>Tendance des dépenses sur la période</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total"
                stroke="#8884d8"
                name={`Montant (${primaryCurrency})`}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="count"
                stroke="#82ca9d"
                name="Nombre"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Répartition par type</CardTitle>
          <CardDescription>Ventilation des dépenses par catégorie</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={typeChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {typeChartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value?.toLocaleString()} ${primaryCurrency}`} />
            </RePieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );

  // Rendu du tableau des dépenses
  const renderExpensesTable = () => (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Liste des dépenses</CardTitle>
            <CardDescription>
              Gérez et suivez toutes les dépenses
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={filters.search || ''}
                onChange={(e) => {
                  setFilters({ ...filters, search: e.target.value });
                  setPage(1);
                }}
                className="pl-9 w-48"
              />
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle dépense
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Nouvelle dépense</DialogTitle>
                  <DialogDescription>
                    Enregistrez une nouvelle dépense
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Description *</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Ex: Achat de médicaments"
                    />
                    {formErrors.description && (
                      <p className="text-sm text-red-500 mt-1">{formErrors.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Montant *</Label>
                      <div className="flex">
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.amount || ''}
                          onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
                          placeholder="0.00"
                          className="flex-1"
                        />
                        <span className="ml-2 flex items-center text-muted-foreground">
                          {primaryCurrency}
                        </span>
                      </div>
                      {formErrors.amount && (
                        <p className="text-sm text-red-500 mt-1">{formErrors.amount}</p>
                      )}
                    </div>

                    <div>
                      <Label>Type de dépense *</Label>
                      <Select
                        value={formData.expense_type}
                        onValueChange={(value) => setFormData({ ...formData, expense_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EXPENSE_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <span className="flex items-center gap-2">
                                <span>{type.icon}</span>
                                <span>{type.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Date *</Label>
                      <Input
                        type="date"
                        value={formData.expense_date}
                        onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                      />
                      {formErrors.expense_date && (
                        <p className="text-sm text-red-500 mt-1">{formErrors.expense_date}</p>
                      )}
                    </div>

                    <div>
                      <Label>Branche</Label>
                      <Select
                        value={formData.branch_id || ''}
                        onValueChange={(value) => setFormData({ ...formData, branch_id: value || undefined })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner (optionnel)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Aucune (siège)</SelectItem>
                          {branches.map((branch) => (
                            <SelectItem key={branch.id} value={branch.id}>
                              {branch.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Notes (optionnel)</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Informations complémentaires..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Justificatif</Label>
                    <div className="mt-1 flex items-center gap-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('receipt-upload')?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Choisir un fichier
                      </Button>
                      <Input
                        id="receipt-upload"
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                      />
                      {receiptFile && (
                        <span className="text-sm text-muted-foreground">
                          {receiptFile.name}
                        </span>
                      )}
                    </div>
                    {formErrors.receipt && (
                      <p className="text-sm text-red-500 mt-1">{formErrors.receipt}</p>
                    )}
                    {expenseConfig?.require_receipt_threshold && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Un justificatif est requis pour les dépenses ≥ {expenseConfig.require_receipt_threshold} {primaryCurrency}
                      </p>
                    )}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Annuler
                  </Button>
                  <Button onClick={handleCreate} disabled={isSubmitting}>
                    {isSubmitting ? 'Création...' : 'Créer'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {expensesLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Branche</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expensesData?.items.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(expense.expense_date), 'dd/MM/yyyy')}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {expense.description}
                    </TableCell>
                    <TableCell>
                      {EXPENSE_TYPES.find(t => t.value === expense.expense_type)?.label || expense.expense_type}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {expense.amount.toLocaleString()} {primaryCurrency}
                    </TableCell>
                    <TableCell>{renderStatusBadge(expense.approval_status)}</TableCell>
                    <TableCell>{expense.branch_name || 'Siège'}</TableCell>
                    <TableCell>{expense.user_name || expense.user_id}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openViewDialog(expense)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Voir
                          </DropdownMenuItem>
                          {expense.approval_status === 'pending' && expense.user_id === user?.id && (
                            <DropdownMenuItem onClick={() => openEditDialog(expense)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                          )}
                          {(isManager || expense.user_id === user?.id) && expense.approval_status === 'pending' && (
                            <DropdownMenuItem onClick={() => openDeleteDialog(expense)} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          )}
                          {isAdmin && expense.approval_status === 'pending' && (
                            <DropdownMenuItem onClick={() => openApproveDialog(expense)}>
                              <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                              Approuver/Rejeter
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {(expensesData?.items || []).length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Aucune dépense trouvée
              </div>
            )}

            {/* Pagination */}
            {expensesData && expensesData.total_pages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <p className="text-sm text-muted-foreground">
                  {expensesData.total} résultat(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 py-1 text-sm">
                    Page {page} / {expensesData.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(expensesData.total_pages, p + 1))}
                    disabled={page === expensesData.total_pages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  // Rendu des filtres supplémentaires
  const renderFilters = () => (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <Label>Type de dépense</Label>
            <Select
              value={filters.expense_type || ''}
              onValueChange={(value) => {
                setFilters({ ...filters, expense_type: value || undefined });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Tous les types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les types</SelectItem>
                {EXPENSE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Statut</Label>
            <Select
              value={filters.approval_status || ''}
              onValueChange={(value) => {
                setFilters({ ...filters, approval_status: value || undefined });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="approved">Approuvé</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Branche</Label>
            <Select
              value={filters.branch_id || ''}
              onValueChange={(value) => {
                setFilters({ ...filters, branch_id: value || undefined });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Toutes les branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Toutes les branches</SelectItem>
                <SelectItem value="null">Siège</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Utilisateur</Label>
            <Select
              value={filters.user_id || ''}
              onValueChange={(value) => {
                setFilters({ ...filters, user_id: value || undefined });
                setPage(1);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tous les utilisateurs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tous les utilisateurs</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nom_complet}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
          >
            <Filter className="h-4 w-4 mr-2" />
            Réinitialiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // Rendu des dialogues modaux
  const renderDialogs = () => (
    <>
      {/* Dialog de visualisation */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de la dépense</DialogTitle>
          </DialogHeader>
          {selectedExpense && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="font-medium">{selectedExpense.description}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Montant</p>
                  <p className="font-medium text-lg">
                    {selectedExpense.amount.toLocaleString()} {primaryCurrency}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p>{EXPENSE_TYPES.find(t => t.value === selectedExpense.expense_type)?.label}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date</p>
                  <p>{format(parseISO(selectedExpense.expense_date), 'dd MMMM yyyy', { locale: fr })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Statut</p>
                  <div>{renderStatusBadge(selectedExpense.approval_status)}</div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Branche</p>
                  <p>{selectedExpense.branch_name || 'Siège'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Utilisateur</p>
                  <p>{selectedExpense.user_name || selectedExpense.user_id}</p>
                </div>
                {selectedExpense.approved_by && (
                  <div>
                    <p className="text-sm text-muted-foreground">Approuvé par</p>
                    <p>{selectedExpense.approver_name || selectedExpense.approved_by}</p>
                  </div>
                )}
                {selectedExpense.approved_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Date d'approbation</p>
                    <p>{format(parseISO(selectedExpense.approved_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
              {selectedExpense.rejection_reason && (
                <div>
                  <p className="text-sm text-muted-foreground">Motif du rejet</p>
                  <p className="text-red-600">{selectedExpense.rejection_reason}</p>
                </div>
              )}
              {selectedExpense.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{selectedExpense.notes}</p>
                </div>
              )}
              {selectedExpense.receipt_url && (
                <div>
                  <Button
                    variant="outline"
                    onClick={() => window.open(selectedExpense.receipt_url, '_blank')}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Voir le justificatif
                  </Button>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewDialogOpen(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de modification */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la dépense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                value={editFormData.description || ''}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Montant</Label>
              <Input
                type="number"
                step="0.01"
                value={editFormData.amount || ''}
                onChange={(e) => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={editFormData.expense_type}
                onValueChange={(value) => setEditFormData({ ...editFormData, expense_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={editFormData.expense_date}
                onChange={(e) => setEditFormData({ ...editFormData, expense_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={editFormData.notes || ''}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdate}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog d'approbation */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approuver / Rejeter la dépense</DialogTitle>
            <DialogDescription>
              {selectedExpense?.description} - {selectedExpense?.amount?.toLocaleString()} {primaryCurrency}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Action</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleApprove(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approuver
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleApprove(false)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Rejeter
                </Button>
              </div>
            </div>
            <div>
              <Label>Motif du rejet (si rejet)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Expliquez pourquoi cette dépense est rejetée..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La dépense "{selectedExpense?.description}" sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // Rendu du rapport par branche
  const renderBranchReport = () => (
    <Card>
      <CardHeader>
        <CardTitle>Dépenses par branche</CardTitle>
        <CardDescription>Répartition des dépenses par succursale</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={branchReportData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="branch_name" />
            <YAxis />
            <Tooltip formatter={(value) => `${value?.toLocaleString()} ${primaryCurrency}`} />
            <Legend />
            <Bar dataKey="total_amount" name={`Total (${primaryCurrency})`} fill="#8884d8" />
            <Bar dataKey="count" name="Nombre de dépenses" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );

  // Rendu du rapport par utilisateur
  const renderUserReport = () => (
    <Card>
      <CardHeader>
        <CardTitle>Dépenses par utilisateur</CardTitle>
        <CardDescription>Classement des utilisateurs par montant de dépenses</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Branche</TableHead>
              <TableHead className="text-right">Nombre</TableHead>
              <TableHead className="text-right">Total ({primaryCurrency})</TableHead>
              <TableHead className="text-right">Moyenne</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(userReportData || []).map((report: any) => (
              <TableRow key={report.user_id}>
                <TableCell className="font-medium">{report.user_name}</TableCell>
                <TableCell>{report.branch_name || 'Siège'}</TableCell>
                <TableCell className="text-right">{report.count}</TableCell>
                <TableCell className="text-right font-medium">
                  {report.total_amount.toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  {report.average_amount.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {(userReportData || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune donnée disponible
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  // Rendu des informations de configuration
  const renderConfigInfo = () => (
    <Card className="mb-6 bg-muted/50">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">Configuration des dépenses</p>
            <p className="text-sm text-muted-foreground">
              {expenseConfig?.enabled ? (
                <>
                  Montants autorisés: entre {expenseConfig.min_amount} et {expenseConfig.max_amount} {primaryCurrency} |
                  Approbation requise au-delà de {expenseConfig.require_approval_threshold} {primaryCurrency} |
                  Justificatif requis au-delà de {expenseConfig.require_receipt_threshold} {primaryCurrency}
                </>
              ) : (
                "Les dépenses sont désactivées dans la configuration. Contactez l'administrateur."
              )}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Gestion des dépenses</h1>
        <p className="text-muted-foreground">
          Enregistrez, suivez et analysez toutes les dépenses de votre pharmacie
        </p>
      </div>

      {/* Sélecteur de branche */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Branche:</span>
        </div>
        <Select value={selectedBranchId || 'all'} onValueChange={setSelectedBranchId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sélectionner une branche" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              Toutes les branches
            </SelectItem>
            <SelectItem value="null">
              Siège uniquement
            </SelectItem>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name} {branch.is_main_branch && '(Principale)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {expenseConfig && !expenseConfig.enabled && (
        <div className="mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Ban className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="font-medium text-yellow-800 dark:text-yellow-300">
                Module de dépenses désactivé
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                La gestion des dépenses est actuellement désactivée dans la configuration de votre pharmacie.
                Veuillez contacter un administrateur pour l'activer.
              </p>
            </div>
          </div>
        </div>
      )}

      {expenseConfig?.enabled && (
        <>
          {renderConfigInfo()}
          {renderPeriodFilter()}
          {renderKPICards()}
          {renderCharts()}

          <Tabs defaultValue="list" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList>
              <TabsTrigger value="list">
                <Receipt className="h-4 w-4 mr-2" />
                Liste des dépenses
              </TabsTrigger>
              <TabsTrigger value="reports">
                <BarChart3 className="h-4 w-4 mr-2" />
                Rapports
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              {renderFilters()}
              {renderExpensesTable()}
            </TabsContent>

            <TabsContent value="reports">
              <div className="space-y-6">
                {renderBranchReport()}
                {renderUserReport()}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {renderDialogs()}
    </div>
  );
};

export default Expense;