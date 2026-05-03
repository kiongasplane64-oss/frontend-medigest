// supplierCreditPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  InputAdornment,
  Divider,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  TablePagination,
  InputBase,
  alpha,
  styled,
  Fade,
  Grow,
  Zoom,
} from '@mui/material';
import {
  TrendingUp,
  AccountBalance,
  Warning,
  Payment,
  ShoppingCart,
  CreditCard,
  Add,
  Search as SearchIcon,
  Refresh,
  Delete,
  Edit,
  Visibility,
  CheckCircle,
  Cancel,
  Receipt,
  Business,
  LocationOn,
  People,
  Assessment,
  Dashboard as DashboardIconMui,
  ContactSupport as ContactSupportIconMui,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useSnackbar } from 'notistack';
import api from '@/api/client';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';

// ==============================================
// TYPES COMPLETS BASÉS SUR LES SCHÉMAS BACKEND
// ==============================================

// Types pour les fournisseurs (de cost.py)
interface Supplier {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  company_name?: string;
  type_supplier?: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
  email?: string;
  phone?: string;
  phone_secondary?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  bank_name?: string;
  bank_account?: string;
  bank_swift?: string;
  payment_terms?: string;
  categories?: string[];
  website?: string;
  contact_person?: string;
  notes?: string;
  is_preferred?: boolean;
  status: 'active' | 'inactive' | 'blocked';
  created_at: string;
  updated_at?: string;
}

// Types pour la configuration de crédit fournisseur
interface SupplierCreditConfig {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  credit_limit: number;
  payment_delay_days: number;
  interest_rate: number;
  auto_approve: boolean;
  payment_frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'semester' | 'yearly';
  repayment_percentage_of_sale?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

// Types pour les achats à crédit
interface PurchaseCredit {
  id: string;
  purchase_id?: string;
  supplier_id: string;
  supplier_name?: string;
  config_id?: string;
  debt_id?: string;
  credit_amount: number;
  repaid_amount: number;
  remaining_amount: number;
  interest_rate_applied?: number;
  payment_frequency?: string;
  repayment_percentage?: number;
  due_date: string;
  status: 'active' | 'partially_paid' | 'fully_paid' | 'overdue' | 'cancelled';
  created_at: string;
  updated_at?: string;
  paid_at?: string;
  created_by?: string;
  notes?: string;
  total_amount?: number;
  paid_amount?: number;
}

// Types pour la balance fournisseur
interface SupplierBalance {
  supplier_id: string;
  supplier_name: string;
  current_debt: number;
  total_credit_purchases: number;
  total_repayments: number;
  active_credits_count: number;
  overdue_credits_count: number;
  paid_credits_count?: number;
  total_interest_accrued?: number;
  total_late_fees?: number;
  debt_ratio?: number;
  credits?: PurchaseCredit[];
  config?: SupplierCreditConfig;
}

// Types pour le capital ajusté
interface AdjustedCapital {
  id?: string;
  tenant_id?: string;
  pharmacy_id?: string;
  gross_capital: number;
  adjusted_capital: number;
  equity_capital: number;
  total_supplier_debt: number;
  calculated_at?: string;
  formula?: string;
}

// Types pour le bénéfice réel
interface RealProfitResponse {
  start_date: string;
  end_date: string;
  gross_profit: number;
  adjusted_profit: number;
  debt_variation: number;
  opening_debt?: number;
  closing_debt?: number;
}

// Types pour les transactions de crédit
interface SupplierCreditTransaction {
  id: string;
  debtor_id?: string;
  supplier_id: string;
  transaction_type: 'credit_purchase' | 'repayment' | 'interest_accrual' | 'late_fee' | 'adjustment';
  amount: number;
  balance_before: number;
  balance_after: number;
  purchase_credit_id?: string;
  sale_allocation_id?: string;
  payment_reference?: string;
  description?: string;
  transaction_date: string;
  created_at: string;
  created_by?: string;
}

// Types pour le tableau de bord
interface DashboardStats {
  summary: {
    total_supplier_debt: number;
    active_credits: number;
    overdue_credits: number;
    suppliers_with_debt: number;
    total_credit_purchases?: number;
    total_repayments?: number;
    average_interest_rate?: number;
  };
  adjusted_capital: AdjustedCapital;
  alerts: {
    overdue_alert: boolean;
    high_debt_ratio: number;
    critical_debt_threshold?: number;
    warning_debt_threshold?: number;
  };
  recent_transactions?: SupplierCreditTransaction[];
  top_debt_suppliers?: Array<{ supplier_name: string; current_debt: number }>;
}

// Types pour les coûts (de cost.py)
interface Cost {
  id: string;
  reference: string;
  category: string;
  subcategory?: string;
  amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  exchange_rate: number;
  description: string;
  payment_date: string;
  due_date?: string;
  payment_method: string;
  is_paid: boolean;
  invoice_number?: string;
  supplier_id?: string;
  supplier_name?: string;
  is_recurring: boolean;
  frequency?: string;
  recurring_until?: string;
  next_payment_date?: string;
  budget_id?: string;
  budget_name?: string;
  notes?: string;
  tags: string[];
  justification?: string;
  status: string;
  created_at: string;
  updated_at?: string;
  created_by?: string;
  approved_by?: string;
  approval_date?: string;
}

// Types pour les budgets
interface Budget {
  id: string;
  name: string;
  code: string;
  description?: string;
  category: string;
  subcategory?: string;
  period_type: string;
  start_date: string;
  end_date: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  warning_threshold: number;
  critical_threshold: number;
  is_active: boolean;
  owner_id?: string;
  owner_name?: string;
  notes?: string;
  created_at: string;
}

// Types pour les requêtes
interface ManualRepaymentRequest {
  supplier_id: string;
  amount: number;
  payment_reference?: string;
  notes?: string;
}

interface SupplierCreateRequest {
  name: string;
  company_name?: string;
  type_supplier?: string;
  tax_id?: string;
  rccm?: string;
  id_nat?: string;
  email?: string;
  phone?: string;
  phone_secondary?: string;
  address?: string;
  city?: string;
  province?: string;
  country?: string;
  bank_name?: string;
  bank_account?: string;
  bank_swift?: string;
  payment_terms?: string;
  categories?: string[];
  website?: string;
  contact_person?: string;
  notes?: string;
}

interface SupplierCreditConfigCreate {
  supplier_id: string;
  credit_limit: number;
  payment_delay_days: number;
  interest_rate: number;
  auto_approve: boolean;
  payment_frequency?: string;
  repayment_percentage_of_sale?: number;
}

// Composant Avatar manquant
const Avatar = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '50%',
})) as React.ComponentType<{ sx?: any; children?: React.ReactNode }>;

// ==============================================
// STYLES PERSONNALISÉS
// ==============================================

const SearchInput = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
}));

// ==============================================
// COMPOSANT PRINCIPAL
// ==============================================

const SupplierCreditPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  
  // États principaux
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [suppliersBalances, setSuppliersBalances] = useState<SupplierBalance[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierBalance | null>(null);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [configs, setConfigs] = useState<SupplierCreditConfig[]>([]);
  const [transactions, setTransactions] = useState<SupplierCreditTransaction[]>([]);
  
  // États pour la pagination
  const [supplierPage, setSupplierPage] = useState(0);
  const [supplierRowsPerPage, setSupplierRowsPerPage] = useState(10);
  
  // États pour les filtres
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // États pour les dialogues
  const [repaymentDialogOpen, setRepaymentDialogOpen] = useState(false);
  const [repaymentAmount, setRepaymentAmount] = useState('');
  const [repaymentReference, setRepaymentReference] = useState('');
  const [repaymentNotes, setRepaymentNotes] = useState('');
  
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<SupplierCreateRequest>({
    name: '',
    company_name: '',
    type_supplier: 'regular',
    tax_id: '',
    rccm: '',
    id_nat: '',
    email: '',
    phone: '',
    phone_secondary: '',
    address: '',
    city: '',
    province: '',
    country: 'RDC',
    bank_name: '',
    bank_account: '',
    bank_swift: '',
    payment_terms: '',
    categories: [],
    website: '',
    contact_person: '',
    notes: '',
  });
  
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SupplierCreditConfig | null>(null);
  const [selectedSupplierForConfig, setSelectedSupplierForConfig] = useState<string>('');
  const [configForm, setConfigForm] = useState({
    credit_limit: '',
    payment_delay_days: '30',
    interest_rate: '0',
    auto_approve: true,
    payment_frequency: 'monthly',
    repayment_percentage_of_sale: '0',
  });
  
  const [profitPeriod, setProfitPeriod] = useState<{ start: Date | null; end: Date | null }>({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    end: new Date(),
  });
  const [realProfit, setRealProfit] = useState<RealProfitResponse | null>(null);
  
  const [viewTransactionDialogOpen, setViewTransactionDialogOpen] = useState(false);
  
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  
  const [supplierDetailDialogOpen, setSupplierDetailDialogOpen] = useState(false);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<Supplier | null>(null);
  
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');

  // ==============================================
  // FONCTIONS DE CHARGEMENT DES DONNÉES
  // ==============================================

  // Charger le tableau de bord
  const loadDashboard = useCallback(async () => {
    try {
      const dashboardRes = await api.get('/supplier-credit/dashboard');
      setDashboardStats(dashboardRes.data);
    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
      enqueueSnackbar('Erreur lors du chargement des données du tableau de bord', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Charger tous les fournisseurs avec leurs balances
  const loadAllSuppliersBalances = useCallback(async () => {
    setLoadingBalance(true);
    try {
      const balancesRes = await api.get('/supplier-credit/all-supplier-balances');
      setSuppliersBalances(balancesRes.data.suppliers || []);
    } catch (error) {
      console.error('Erreur chargement balances:', error);
      enqueueSnackbar('Erreur lors du chargement des balances fournisseurs', { variant: 'error' });
    } finally {
      setLoadingBalance(false);
    }
  }, [enqueueSnackbar]);

  // Charger la liste des fournisseurs (depuis cost.py)
  const loadSuppliers = useCallback(async () => {
    try {
      const response = await api.get('/costs/suppliers', {
        params: { limit: 1000, status: 'active' }
      });
      setSuppliersList(response.data);
    } catch (error) {
      console.error('Erreur chargement fournisseurs:', error);
      enqueueSnackbar('Erreur lors du chargement des fournisseurs', { variant: 'error' });
    }
  }, [enqueueSnackbar]);

  // Charger les configurations de crédit
  const loadConfigs = useCallback(async () => {
    try {
      // Récupérer les configurations pour chaque fournisseur
      const configPromises = suppliersList.map(supplier =>
        api.get(`/supplier-credit/config/${supplier.id}`).catch(() => ({ data: null }))
      );
      const configResults = await Promise.all(configPromises);
      const existingConfigs = configResults
        .map((res, index) => ({ ...res.data, supplier_name: suppliersList[index]?.name }))
        .filter(config => config && config.id);
      setConfigs(existingConfigs);
    } catch (error) {
      console.error('Erreur chargement configurations:', error);
    }
  }, [suppliersList]);

  // Charger les coûts
  const loadCosts = useCallback(async () => {
    try {
      const params: any = { limit: 100 };
      if (filterCategory !== 'all') params.category = filterCategory;
      if (filterStatus !== 'all') params.status = filterStatus;
      
      const response = await api.get('/costs/', { params });
      setCosts(response.data);
    } catch (error) {
      console.error('Erreur chargement coûts:', error);
    }
  }, [filterCategory, filterStatus]);

  // Charger les budgets
  const loadBudgets = useCallback(async () => {
    try {
      const response = await api.get('/costs/budgets', {
        params: { is_active: true }
      });
      setBudgets(response.data);
    } catch (error) {
      console.error('Erreur chargement budgets:', error);
    }
  }, []);

  // Charger les transactions pour un fournisseur
  const loadSupplierTransactions = useCallback(async (supplierId: string) => {
    setLoadingTransactions(true);
    try {
      const response = await api.get(`/supplier-credit/supplier-balance/${supplierId}`);
      if (response.data.transactions) {
        setTransactions(response.data.transactions);
      }
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
    } finally {
      setLoadingTransactions(false);
    }
  }, []);

  // Charger tous les fournisseurs pour le dialogue de configuration
  const loadAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadDashboard(),
      loadAllSuppliersBalances(),
      loadSuppliers(),
      loadCosts(),
      loadBudgets(),
    ]);
    setLoading(false);
  }, [loadDashboard, loadAllSuppliersBalances, loadSuppliers, loadCosts, loadBudgets]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (suppliersList.length > 0) {
      loadConfigs();
    }
  }, [suppliersList, loadConfigs]);

  useEffect(() => {
    if (activeTab === 1) {
      loadAllSuppliersBalances();
    }
    if (activeTab === 0) {
      loadDashboard();
    }
    if (activeTab === 4) {
      loadCosts();
    }
    if (activeTab === 5) {
      loadBudgets();
    }
  }, [activeTab, loadAllSuppliersBalances, loadDashboard, loadCosts, loadBudgets]);

  // ==============================================
  // FONCTIONS FOURNISSEURS
  // ==============================================

  // Créer un fournisseur
  const handleCreateSupplier = async () => {
    if (!supplierForm.name.trim()) {
      enqueueSnackbar('Le nom du fournisseur est requis', { variant: 'warning' });
      return;
    }

    try {
      if (editingSupplier) {
        // Mise à jour
        await api.put(`/costs/suppliers/${editingSupplier.id}`, supplierForm);
        enqueueSnackbar('Fournisseur mis à jour avec succès', { variant: 'success' });
      } else {
        // Création
        await api.post('/costs/suppliers', supplierForm);
        enqueueSnackbar('Fournisseur créé avec succès', { variant: 'success' });
      }
      setSupplierDialogOpen(false);
      resetSupplierForm();
      await loadSuppliers();
      await loadAllSuppliersBalances();
    } catch (error: any) {
      console.error('Erreur création/mise à jour fournisseur:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de l\'opération', { variant: 'error' });
    }
  };

  // Modifier un fournisseur
  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      company_name: supplier.company_name || '',
      type_supplier: supplier.type_supplier || 'regular',
      tax_id: supplier.tax_id || '',
      rccm: supplier.rccm || '',
      id_nat: supplier.id_nat || '',
      email: supplier.email || '',
      phone: supplier.phone || '',
      phone_secondary: supplier.phone_secondary || '',
      address: supplier.address || '',
      city: supplier.city || '',
      province: supplier.province || '',
      country: supplier.country || 'RDC',
      bank_name: supplier.bank_name || '',
      bank_account: supplier.bank_account || '',
      bank_swift: supplier.bank_swift || '',
      payment_terms: supplier.payment_terms || '',
      categories: supplier.categories || [],
      website: supplier.website || '',
      contact_person: supplier.contact_person || '',
      notes: supplier.notes || '',
    });
    setSupplierDialogOpen(true);
  };

  // Voir les détails d'un fournisseur
  const handleViewSupplierDetail = async (supplier: Supplier) => {
    try {
      const response = await api.get(`/costs/suppliers/${supplier.id}`);
      setSelectedSupplierDetail(response.data);
      setSupplierDetailDialogOpen(true);
    } catch (error) {
      console.error('Erreur chargement détails fournisseur:', error);
      enqueueSnackbar('Erreur lors du chargement des détails', { variant: 'error' });
    }
  };

  // Réinitialiser le formulaire fournisseur
  const resetSupplierForm = () => {
    setEditingSupplier(null);
    setSupplierForm({
      name: '',
      company_name: '',
      type_supplier: 'regular',
      tax_id: '',
      rccm: '',
      id_nat: '',
      email: '',
      phone: '',
      phone_secondary: '',
      address: '',
      city: '',
      province: '',
      country: 'RDC',
      bank_name: '',
      bank_account: '',
      bank_swift: '',
      payment_terms: '',
      categories: [],
      website: '',
      contact_person: '',
      notes: '',
    });
  };

  // ==============================================
  // FONCTIONS CONFIGURATION CRÉDIT
  // ==============================================

  // Créer une configuration
  const handleCreateConfig = async () => {
    if (!selectedSupplierForConfig) {
      enqueueSnackbar('Veuillez sélectionner un fournisseur', { variant: 'warning' });
      return;
    }

    const creditLimit = parseFloat(configForm.credit_limit);
    if (isNaN(creditLimit) || creditLimit < 0) {
      enqueueSnackbar('Limite de crédit invalide', { variant: 'warning' });
      return;
    }

    const interestRate = parseFloat(configForm.interest_rate);
    if (isNaN(interestRate) || interestRate < 0) {
      enqueueSnackbar('Taux d\'intérêt invalide', { variant: 'warning' });
      return;
    }

    try {
      const configData: SupplierCreditConfigCreate = {
        supplier_id: selectedSupplierForConfig,
        credit_limit: creditLimit,
        payment_delay_days: parseInt(configForm.payment_delay_days),
        interest_rate: interestRate,
        auto_approve: configForm.auto_approve,
        payment_frequency: configForm.payment_frequency,
        repayment_percentage_of_sale: parseFloat(configForm.repayment_percentage_of_sale) || 0,
      };

      if (editingConfig) {
        await api.put(`/supplier-credit/config/${editingConfig.id}`, configData);
        enqueueSnackbar('Configuration mise à jour avec succès', { variant: 'success' });
      } else {
        await api.post('/supplier-credit/config', configData);
        enqueueSnackbar('Configuration créée avec succès', { variant: 'success' });
      }
      
      setConfigDialogOpen(false);
      resetConfigForm();
      await loadConfigs();
      await loadAllSuppliersBalances();
    } catch (error: any) {
      console.error('Erreur création/mise à jour config:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de l\'opération', { variant: 'error' });
    }
  };

  // Modifier une configuration
  const handleEditConfig = (config: SupplierCreditConfig) => {
    setEditingConfig(config);
    setSelectedSupplierForConfig(config.supplier_id);
    setConfigForm({
      credit_limit: config.credit_limit.toString(),
      payment_delay_days: config.payment_delay_days.toString(),
      interest_rate: config.interest_rate.toString(),
      auto_approve: config.auto_approve,
      payment_frequency: config.payment_frequency || 'monthly',
      repayment_percentage_of_sale: (config.repayment_percentage_of_sale || 0).toString(),
    });
    setConfigDialogOpen(true);
  };

  // Supprimer une configuration
  const handleDeleteConfig = async (config: SupplierCreditConfig) => {
    setConfirmTitle('Supprimer la configuration');
    setConfirmMessage(`Êtes-vous sûr de vouloir supprimer la configuration de crédit pour ${config.supplier_name} ?`);
    setConfirmAction(() => async () => {
      try {
        await api.delete(`/supplier-credit/config/${config.id}`);
        enqueueSnackbar('Configuration supprimée avec succès', { variant: 'success' });
        await loadConfigs();
      } catch (error: any) {
        console.error('Erreur suppression config:', error);
        enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la suppression', { variant: 'error' });
      } finally {
        setConfirmDialogOpen(false);
      }
    });
    setConfirmDialogOpen(true);
  };

  // Réinitialiser le formulaire de configuration
  const resetConfigForm = () => {
    setEditingConfig(null);
    setSelectedSupplierForConfig('');
    setConfigForm({
      credit_limit: '',
      payment_delay_days: '30',
      interest_rate: '0',
      auto_approve: true,
      payment_frequency: 'monthly',
      repayment_percentage_of_sale: '0',
    });
  };

  // ==============================================
  // FONCTIONS REMBOURSEMENT ET CRÉDIT
  // ==============================================

  // Remboursement manuel
  const handleManualRepayment = async () => {
    if (!selectedSupplier) return;
    const amount = parseFloat(repaymentAmount);
    if (isNaN(amount) || amount <= 0) {
      enqueueSnackbar('Montant invalide', { variant: 'warning' });
      return;
    }

    if (amount > selectedSupplier.current_debt) {
      enqueueSnackbar(`Le montant ne peut pas dépasser la dette actuelle (${formatCurrency(selectedSupplier.current_debt)})`, { variant: 'warning' });
      return;
    }

    try {
      const request: ManualRepaymentRequest = {
        supplier_id: selectedSupplier.supplier_id,
        amount: amount,
        payment_reference: repaymentReference || `REP_${Date.now()}`,
        notes: repaymentNotes,
      };
      
      await api.post('/supplier-credit/manual-repayment', request);

      enqueueSnackbar(`Remboursement de ${formatCurrency(amount)} enregistré`, { variant: 'success' });
      setRepaymentDialogOpen(false);
      setRepaymentAmount('');
      setRepaymentReference('');
      setRepaymentNotes('');
      
      await loadAllSuppliersBalances();
      await loadDashboard();
      
      const updatedSupplier = suppliersBalances.find(s => s.supplier_id === selectedSupplier.supplier_id);
      if (updatedSupplier) {
        setSelectedSupplier(updatedSupplier);
      }
    } catch (error: any) {
      console.error('Erreur remboursement:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du remboursement', { variant: 'error' });
    }
  };

  // Achat à crédit (transformer un achat)
  const handleCreatePurchaseCredit = async (purchaseId: string, configId?: string) => {
    try {
      const url = configId 
        ? `/supplier-credit/purchase-credit/${purchaseId}?config_id=${configId}`
        : `/supplier-credit/purchase-credit/${purchaseId}`;
      await api.post(url);
      enqueueSnackbar('Achat converti en crédit avec succès', { variant: 'success' });
      await loadAllSuppliersBalances();
      await loadDashboard();
    } catch (error: any) {
      console.error('Erreur création crédit achat:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors de la conversion', { variant: 'error' });
    }
  };

  // ==============================================
  // FONCTIONS BÉNÉFICE RÉEL
  // ==============================================

  // Calculer le bénéfice réel
  const handleCalculateRealProfit = async () => {
    if (!profitPeriod.start || !profitPeriod.end) {
      enqueueSnackbar('Veuillez sélectionner une période', { variant: 'warning' });
      return;
    }

    try {
      const response = await api.post<RealProfitResponse>('/supplier-credit/real-profit', {
        start_date: profitPeriod.start.toISOString().split('T')[0],
        end_date: profitPeriod.end.toISOString().split('T')[0],
      });
      setRealProfit(response.data);
      enqueueSnackbar('Bénéfice réel calculé avec succès', { variant: 'success' });
    } catch (error: any) {
      console.error('Erreur calcul bénéfice réel:', error);
      enqueueSnackbar(error.response?.data?.detail || 'Erreur lors du calcul', { variant: 'error' });
    }
  };

  // ==============================================
  // FONCTIONS UTILITAIRES
  // ==============================================

  // Obtenir la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'primary';
      case 'partially_paid':
        return 'warning';
      case 'fully_paid':
        return 'success';
      case 'overdue':
        return 'error';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  };

  // Obtenir le label du statut
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active':
        return 'Actif';
      case 'partially_paid':
        return 'Partiel';
      case 'fully_paid':
        return 'Soldé';
      case 'overdue':
        return 'En retard';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  };

  // Sélectionner un fournisseur
  const handleSelectSupplier = async (supplier: SupplierBalance) => {
    setLoadingBalance(true);
    setSelectedSupplier(supplier);
    await loadSupplierTransactions(supplier.supplier_id);
    setLoadingBalance(false);
  };

  // Voir les transactions
  const handleViewTransactions = () => {
    setViewTransactionDialogOpen(true);
  };

  // Recharger toutes les données
  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([
      loadDashboard(),
      loadAllSuppliersBalances(),
      loadSuppliers(),
      loadCosts(),
      loadBudgets(),
      loadConfigs(),
    ]);
    setLoading(false);
    enqueueSnackbar('Données actualisées', { variant: 'success' });
  };

  // Filtrer les fournisseurs
  const filteredSuppliers = suppliersBalances.filter(supplier =>
    supplier.supplier_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filtrer les configurations
  const filteredConfigs = configs.filter(config =>
    config.supplier_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Pagination
  const paginatedSuppliers = filteredSuppliers.slice(
    supplierPage * supplierRowsPerPage,
    supplierPage * supplierRowsPerPage + supplierRowsPerPage
  );

  // ==============================================
  // RENDU
  // ==============================================

  if (loading && !dashboardStats && suppliersBalances.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box sx={{ p: 3 }}>
        {/* En-tête */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCard fontSize="large" color="primary" />
              Crédit Fournisseurs
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Gérez les achats à crédit, suivez vos dettes fournisseurs et analysez votre santé financière
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Actualiser
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetSupplierForm();
                setSupplierDialogOpen(true);
              }}
            >
              Nouveau fournisseur
            </Button>
          </Box>
        </Box>

        {/* Onglets */}
        <Tabs 
          value={activeTab} 
          onChange={(_, v) => setActiveTab(v)} 
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<DashboardIconMui />} label="Tableau de bord" iconPosition="start" />
          <Tab icon={<People />} label="Fournisseurs" iconPosition="start" />
          <Tab icon={<CreditCard />} label="Configurations" iconPosition="start" />
          <Tab icon={<Assessment />} label="Bénéfice réel" iconPosition="start" />
          <Tab icon={<Receipt />} label="Coûts" iconPosition="start" />
          <Tab icon={<AccountBalance />} label="Budgets" iconPosition="start" />
        </Tabs>

        {/* ============================================== */}
        {/* TAB 0: TABLEAU DE BORD */}
        {/* ============================================== */}
        {activeTab === 0 && dashboardStats && (
          <Fade in>
            <Box>
              {/* Cartes KPI */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={300}>
                    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Dette totale
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main', mt: 0.5 }}>
                              {formatCurrency(dashboardStats.summary.total_supplier_debt)}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'error.light', width: 48, height: 48 }}>
                            <AccountBalance sx={{ color: 'error.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={400}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Crédits actifs
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                              {dashboardStats.summary.active_credits}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>
                            <ShoppingCart sx={{ color: 'primary.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={500}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Crédits en retard
                            </Typography>
                            <Typography 
                              variant="h5" 
                              sx={{ 
                                fontWeight: 'bold', 
                                mt: 0.5,
                                color: dashboardStats.summary.overdue_credits > 0 ? 'warning.main' : 'inherit'
                              }}
                            >
                              {dashboardStats.summary.overdue_credits}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'warning.light', width: 48, height: 48 }}>
                            <Warning sx={{ color: 'warning.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={600}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Fournisseurs débiteurs
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                              {dashboardStats.summary.suppliers_with_debt}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'info.light', width: 48, height: 48 }}>
                            <Business sx={{ color: 'info.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>
              </Grid>

              {/* Capital ajusté et Alertes */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Zoom in timeout={400}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccountBalance color="primary" />
                          Capital ajusté
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                          Formule: Capital réel = Actif total - Dettes fournisseurs
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6 }}>
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Actif total
                              </Typography>
                              <Typography variant="h6">{formatCurrency(dashboardStats.adjusted_capital.gross_capital)}</Typography>
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Dettes fournisseurs
                              </Typography>
                              <Typography variant="h6" sx={{ color: 'error.main' }}>
                                -{formatCurrency(dashboardStats.adjusted_capital.total_supplier_debt)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
                              <Typography variant="caption">Capital ajusté</Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(dashboardStats.adjusted_capital.adjusted_capital)}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Zoom in timeout={500}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUp color="primary" />
                          Indicateurs de santé financière
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Ratio d'endettement</Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: dashboardStats.alerts.high_debt_ratio > 70 ? 'error.main' 
                                  : dashboardStats.alerts.high_debt_ratio > 50 ? 'warning.main' 
                                  : 'success.main'
                              }}
                            >
                              {dashboardStats.alerts.high_debt_ratio.toFixed(1)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(dashboardStats.alerts.high_debt_ratio, 100)}
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: dashboardStats.alerts.high_debt_ratio > 70 ? 'error.main' 
                                  : dashboardStats.alerts.high_debt_ratio > 50 ? 'warning.main' 
                                  : 'success.main'
                              }
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                            {dashboardStats.alerts.high_debt_ratio > 70 
                              ? 'Endettement critique - Action nécessaire immédiate'
                              : dashboardStats.alerts.high_debt_ratio > 50 
                              ? 'Endettement élevé - Surveiller attentivement'
                              : 'Endettement maîtrisé'}
                          </Typography>
                        </Box>

                        {dashboardStats.alerts.overdue_alert && (
                          <Alert severity="warning" icon={<Warning />} sx={{ mt: 2 }}>
                            Des crédits fournisseurs sont en retard de paiement. Veuillez vérifier les échéances.
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>
              </Grid>

              {/* Top fournisseurs débiteurs */}
              {dashboardStats.top_debt_suppliers && dashboardStats.top_debt_suppliers.length > 0 && (
                <Card sx={{ mb: 4 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top 5 fournisseurs débiteurs
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Fournisseur</TableCell>
                            <TableCell align="right">Dette</TableCell>
                            <TableCell align="right">% de la dette totale</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dashboardStats.top_debt_suppliers.map((supplierItem, index) => (
                            <TableRow key={index}>
                              <TableCell>{supplierItem.supplier_name}</TableCell>
                              <TableCell align="right" sx={{ color: 'error.main' }}>
                                {formatCurrency(supplierItem.current_debt)}
                              </TableCell>
                              <TableCell align="right">
                                {((supplierItem.current_debt / dashboardStats.summary.total_supplier_debt) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 1: FOURNISSEURS */}
        {/* ============================================== */}
        {activeTab === 1 && (
          <Fade in>
            <Grid container spacing={3}>
              {/* Liste des fournisseurs */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Fournisseurs</Typography>
                      <Button size="small" startIcon={<Add />} onClick={() => {
                        resetSupplierForm();
                        setSupplierDialogOpen(true);
                      }}>
                        Ajouter
                      </Button>
                    </Box>
                    
                    {/* Barre de recherche */}
                    <SearchInput sx={{ mb: 2 }}>
                      <SearchIconWrapper>
                        <SearchIcon />
                      </SearchIconWrapper>
                      <StyledInputBase
                        placeholder="Rechercher..."
                        inputProps={{ 'aria-label': 'search' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </SearchInput>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    {loadingBalance && suppliersBalances.length === 0 ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={30} />
                      </Box>
                    ) : (
                      <>
                        {paginatedSuppliers.map((supplier) => (
                          <Box
                            key={supplier.supplier_id}
                            onClick={() => handleSelectSupplier(supplier)}
                            sx={{
                              p: 2,
                              mb: 1,
                              borderRadius: 2,
                              cursor: 'pointer',
                              bgcolor: selectedSupplier?.supplier_id === supplier.supplier_id ? 'primary.light' : 'grey.50',
                              '&:hover': { bgcolor: 'grey.100' },
                              transition: 'all 0.2s',
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontWeight: 'bold' }}>{supplier.supplier_name}</Typography>
                                {supplier.active_credits_count > 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {supplier.active_credits_count} crédit(s) actif(s)
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Chip
                                  label={formatCurrency(supplier.current_debt)}
                                  size="small"
                                  color={supplier.current_debt > 0 ? 'error' : 'success'}
                                />
                                <Tooltip title="Voir les détails du fournisseur">
                                  <IconButton 
                                    size="small" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const supplierInfo = suppliersList.find(s => s.id === supplier.supplier_id);
                                      if (supplierInfo) {
                                        handleViewSupplierDetail(supplierInfo);
                                      }
                                    }}
                                  >
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                            {supplier.overdue_credits_count > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <Warning fontSize="small" sx={{ mr: 0.5, color: 'warning.main' }} />
                                <Typography variant="caption" sx={{ color: 'warning.main' }}>
                                  {supplier.overdue_credits_count} crédit(s) en retard
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        ))}
                        
                        {/* Pagination */}
                        <TablePagination
                          component="div"
                          count={filteredSuppliers.length}
                          page={supplierPage}
                          onPageChange={(_, newPage) => setSupplierPage(newPage)}
                          rowsPerPage={supplierRowsPerPage}
                          onRowsPerPageChange={(e) => {
                            setSupplierRowsPerPage(parseInt(e.target.value, 10));
                            setSupplierPage(0);
                          }}
                          labelRowsPerPage="Lignes par page"
                          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Détails du fournisseur sélectionné */}
              <Grid size={{ xs: 12, md: 8 }}>
                {selectedSupplier ? (
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                          <Typography variant="h6">{selectedSupplier.supplier_name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ID: {selectedSupplier.supplier_id.slice(0, 8)}...
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Tooltip title="Voir les détails du fournisseur">
                            <IconButton 
                              onClick={() => {
                                const supplierInfo = suppliersList.find(s => s.id === selectedSupplier.supplier_id);
                                if (supplierInfo) {
                                  handleViewSupplierDetail(supplierInfo);
                                }
                              }}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Voir les transactions">
                            <IconButton onClick={() => handleViewTransactions()}>
                              <Receipt />
                            </IconButton>
                          </Tooltip>
                          <Button
                            variant="contained"
                            startIcon={<Payment />}
                            onClick={() => setRepaymentDialogOpen(true)}
                            disabled={selectedSupplier.current_debt <= 0}
                          >
                            Rembourser
                          </Button>
                        </Box>
                      </Box>

                      {/* Cartes de résumé */}
                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Dette actuelle
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'error.main' }}>
                              {formatCurrency(selectedSupplier.current_debt)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Achats à crédit
                            </Typography>
                            <Typography variant="h6">
                              {formatCurrency(selectedSupplier.total_credit_purchases)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Remboursements
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'success.main' }}>
                              {formatCurrency(selectedSupplier.total_repayments)}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {/* Configuration du crédit */}
                      {selectedSupplier.config && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                          <Typography variant="subtitle2">Configuration de crédit</Typography>
                          <Typography variant="body2">
                            Limite: {formatCurrency(selectedSupplier.config.credit_limit)} | 
                            Délai: {selectedSupplier.config.payment_delay_days} jours | 
                            Taux d'intérêt: {selectedSupplier.config.interest_rate}%
                          </Typography>
                        </Alert>
                      )}

                      {/* Historique des crédits */}
                      <Typography variant="subtitle2" gutterBottom>
                        Historique des crédits
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Montant</TableCell>
                              <TableCell>Restant dû</TableCell>
                              <TableCell>Échéance</TableCell>
                              <TableCell>Statut</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {loadingBalance ? (
                              <TableRow>
                                <TableCell colSpan={6} align="center">
                                  <CircularProgress size={30} />
                                </TableCell>
                              </TableRow>
                            ) : (selectedSupplier.credits || []).map((credit) => (
                              <TableRow key={credit.id}>
                                <TableCell>{formatDate(credit.created_at)}</TableCell>
                                <TableCell>{formatCurrency(credit.credit_amount)}</TableCell>
                                <TableCell>{formatCurrency(credit.remaining_amount)}</TableCell>
                                <TableCell>
                                  {formatDate(credit.due_date)}
                                  {new Date(credit.due_date) < new Date() && credit.status !== 'fully_paid' && (
                                    <Warning fontSize="small" sx={{ ml: 1, color: 'warning.main' }} />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={getStatusLabel(credit.status)}
                                    size="small"
                                    color={getStatusColor(credit.status)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Tooltip title="Détails">
                                    <IconButton size="small">
                                      <Visibility fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(selectedSupplier.credits || []).length === 0 && !loadingBalance && (
                              <TableRow>
                                <TableCell colSpan={6} align="center">
                                  <Typography color="text.secondary">Aucun crédit trouvé</Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                ) : (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: 'text.secondary' }}>
                      Sélectionnez un fournisseur pour voir les détails
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 2: CONFIGURATIONS CRÉDIT */}
        {/* ============================================== */}
        {activeTab === 2 && (
          <Fade in>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">Configurations crédit fournisseurs</Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<CreditCard />} 
                    onClick={() => {
                      resetConfigForm();
                      setConfigDialogOpen(true);
                    }}
                  >
                    Nouvelle configuration
                  </Button>
                </Box>

                {/* Barre de recherche */}
                <SearchInput sx={{ mb: 2, width: '100%', maxWidth: 300 }}>
                  <SearchIconWrapper>
                    <SearchIcon />
                  </SearchIconWrapper>
                  <StyledInputBase
                    placeholder="Rechercher un fournisseur..."
                    inputProps={{ 'aria-label': 'search' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </SearchInput>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fournisseur</TableCell>
                        <TableCell align="right">Limite de crédit</TableCell>
                        <TableCell align="right">Délai (jours)</TableCell>
                        <TableCell align="right">Taux d'intérêt</TableCell>
                        <TableCell align="center">Auto-approbation</TableCell>
                        <TableCell align="center">Fréquence</TableCell>
                        <TableCell align="center">Statut</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredConfigs.length > 0 ? (
                        filteredConfigs.map((config) => (
                          <TableRow key={config.id}>
                            <TableCell>{config.supplier_name}</TableCell>
                            <TableCell align="right">{formatCurrency(config.credit_limit)}</TableCell>
                            <TableCell align="right">{config.payment_delay_days}</TableCell>
                            <TableCell align="right">{config.interest_rate}%</TableCell>
                            <TableCell align="center">
                              {config.auto_approve ? (
                                <CheckCircle color="success" fontSize="small" />
                              ) : (
                                <Cancel color="error" fontSize="small" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={config.payment_frequency || 'Mensuel'} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={config.is_active ? 'Actif' : 'Inactif'} 
                                size="small"
                                color={config.is_active ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Modifier">
                                <IconButton size="small" onClick={() => handleEditConfig(config)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Supprimer">
                                <IconButton size="small" onClick={() => handleDeleteConfig(config)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography color="text.secondary">
                              {searchQuery ? 'Aucune configuration trouvée' : 'Aucune configuration créée'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Fournisseurs sans configuration */}
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Fournisseurs sans configuration
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fournisseur</TableCell>
                          <TableCell align="right">Type</TableCell>
                          <TableCell align="right">Téléphone</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {suppliersList
                          .filter(s => !configs.some(c => c.supplier_id === s.id))
                          .slice(0, 10)
                          .map((supplier) => (
                            <TableRow key={supplier.id}>
                              <TableCell>{supplier.name}</TableCell>
                              <TableCell align="right">{supplier.type_supplier || '-'}</TableCell>
                              <TableCell align="right">{supplier.phone || '-'}</TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setSelectedSupplierForConfig(supplier.id);
                                    resetConfigForm();
                                    setConfigDialogOpen(true);
                                  }}
                                >
                                  Configurer
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 3: BÉNÉFICE RÉEL */}
        {/* ============================================== */}
        {activeTab === 3 && (
          <Fade in>
            <Box>
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assessment color="primary" />
                    Calcul du bénéfice réel
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                    Le bénéfice réel tient compte de la variation de la dette fournisseurs pour donner une vision plus précise de la santé financière.
                  </Typography>
                  <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <DatePicker
                        label="Date début"
                        value={profitPeriod.start}
                        onChange={(date) => setProfitPeriod({ ...profitPeriod, start: date })}
                        sx={{ width: '100%' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <DatePicker
                        label="Date fin"
                        value={profitPeriod.end}
                        onChange={(date) => setProfitPeriod({ ...profitPeriod, end: date })}
                        sx={{ width: '100%' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Button variant="contained" fullWidth onClick={handleCalculateRealProfit}>
                        Calculer
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {realProfit && (
                <Zoom in>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Résultats pour la période
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
                        Du {formatDate(realProfit.start_date)} au {formatDate(realProfit.end_date)}
                      </Typography>

                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Bénéfice brut
                            </Typography>
                            <Typography variant="h5" sx={{ color: realProfit.gross_profit >= 0 ? 'success.main' : 'error.main' }}>
                              {formatCurrency(realProfit.gross_profit)}
                            </Typography>
                            <TrendingUp sx={{ mt: 1, color: realProfit.gross_profit >= 0 ? 'success.main' : 'error.main' }} />
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Variation de la dette
                            </Typography>
                            <Typography variant="h5" sx={{ color: realProfit.debt_variation <= 0 ? 'success.main' : 'error.main' }}>
                              {formatCurrency(Math.abs(realProfit.debt_variation))}
                            </Typography>
                            <Typography variant="caption" component="div">
                              {realProfit.debt_variation > 0 ? '(Augmentation de la dette ↗)' : '(Diminution de la dette ↘)'}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper
                            sx={{
                              p: 3,
                              textAlign: 'center',
                              bgcolor: realProfit.adjusted_profit >= 0 ? 'success.light' : 'error.light',
                              color: 'white',
                            }}
                          >
                            <Typography variant="caption">Bénéfice réel</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(realProfit.adjusted_profit)}
                            </Typography>
                            <Typography variant="caption" component="div">
                              = Bénéfice brut - Augmentation de la dette
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      <Alert severity="info" sx={{ mt: 3 }}>
                        Le bénéfice réel est calculé en soustrayant l'augmentation de la dette fournisseurs
                        du bénéfice brut. Cela donne une vision plus précise de la santé financière réelle
                        de votre entreprise.
                        {realProfit.opening_debt !== undefined && realProfit.closing_debt !== undefined && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" component="div">
                              Dette d'ouverture: {formatCurrency(realProfit.opening_debt)}
                            </Typography>
                            <Typography variant="caption" component="div">
                              Dette de clôture: {formatCurrency(realProfit.closing_debt)}
                            </Typography>
                          </Box>
                        )}
                      </Alert>
                    </CardContent>
                  </Card>
                </Zoom>
              )}
            </Box>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 4: COÛTS */}
        {/* ============================================== */}
        {activeTab === 4 && (
          <Fade in>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="h6">Coûts enregistrés</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Catégorie</InputLabel>
                      <Select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        label="Catégorie"
                      >
                        <MenuItem value="all">Toutes</MenuItem>
                        <MenuItem value="stock">Stock</MenuItem>
                        <MenuItem value="services">Services</MenuItem>
                        <MenuItem value="salaries">Salaires</MenuItem>
                        <MenuItem value="rent">Loyer</MenuItem>
                        <MenuItem value="utilities">Utilités</MenuItem>
                        <MenuItem value="marketing">Marketing</MenuItem>
                        <MenuItem value="other">Autres</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Statut</InputLabel>
                      <Select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        label="Statut"
                      >
                        <MenuItem value="all">Tous</MenuItem>
                        <MenuItem value="paid">Payé</MenuItem>
                        <MenuItem value="draft">Brouillon</MenuItem>
                        <MenuItem value="pending">En attente</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Référence</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Catégorie</TableCell>
                        <TableCell align="right">Montant</TableCell>
                        <TableCell>Date paiement</TableCell>
                        <TableCell>Fournisseur</TableCell>
                        <TableCell align="center">Statut</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell>{cost.reference}</TableCell>
                          <TableCell>{cost.description}</TableCell>
                          <TableCell>{cost.category}</TableCell>
                          <TableCell align="right">{formatCurrency(cost.total_amount)}</TableCell>
                          <TableCell>{formatDate(cost.payment_date)}</TableCell>
                          <TableCell>{cost.supplier_name || '-'}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={cost.status}
                              size="small"
                              color={cost.is_paid ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Voir détails">
                              <IconButton size="small">
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {cost.supplier_id && !cost.is_paid && (
                              <Tooltip title="Convertir en crédit">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleCreatePurchaseCredit(cost.id)}
                                >
                                  <CreditCard fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {costs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography color="text.secondary">Aucun coût trouvé</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 5: BUDGETS */}
        {/* ============================================== */}
        {activeTab === 5 && (
          <Fade in>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Budgets en cours</Typography>
                <Grid container spacing={3}>
                  {budgets.map((budget) => {
                    const percentage = (budget.spent_amount / budget.allocated_amount) * 100;
                    return (
                      <Grid size={{ xs: 12, md: 6 }} key={budget.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                  {budget.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Catégorie: {budget.category}
                                </Typography>
                              </Box>
                              <Chip
                                label={budget.is_active ? 'Actif' : 'Inactif'}
                                size="small"
                                color={budget.is_active ? 'success' : 'default'}
                              />
                            </Box>
                            
                            <Box sx={{ mt: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">Progression</Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: percentage >= budget.critical_threshold ? 'error.main' 
                                      : percentage >= budget.warning_threshold ? 'warning.main' 
                                      : 'success.main'
                                  }}
                                >
                                  {percentage.toFixed(1)}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(percentage, 100)}
                                sx={{ 
                                  height: 8, 
                                  borderRadius: 4,
                                  bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: percentage >= budget.critical_threshold ? 'error.main' 
                                      : percentage >= budget.warning_threshold ? 'warning.main' 
                                      : 'success.main'
                                  }
                                }}
                              />
                            </Box>
                            
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid size={{ xs: 4 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Alloué
                                </Typography>
                                <Typography variant="body2">{formatCurrency(budget.allocated_amount)}</Typography>
                              </Grid>
                              <Grid size={{ xs: 4 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Dépensé
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'warning.main' }}>
                                  {formatCurrency(budget.spent_amount)}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 4 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Restant
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'success.main' }}>
                                  {formatCurrency(budget.remaining_amount)}
                                </Typography>
                              </Grid>
                            </Grid>
                            
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                              Période: {formatDate(budget.start_date)} - {formatDate(budget.end_date)}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                  {budgets.length === 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">Aucun budget trouvé</Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* ============================================== */}
        {/* DIALOGUE: AJOUT/MODIFICATION FOURNISSEUR */}
        {/* ============================================== */}
        <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Nom *"
                  value={supplierForm.name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  margin="normal"
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Nom de l'entreprise"
                  value={supplierForm.company_name}
                  onChange={(e) => setSupplierForm({ ...supplierForm, company_name: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Type de fournisseur</InputLabel>
                  <Select
                    value={supplierForm.type_supplier}
                    onChange={(e) => setSupplierForm({ ...supplierForm, type_supplier: e.target.value })}
                    label="Type de fournisseur"
                  >
                    <MenuItem value="regular">Régulier</MenuItem>
                    <MenuItem value="preferred">Préféré</MenuItem>
                    <MenuItem value="occasional">Occasionnel</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Téléphone"
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Téléphone secondaire"
                  value={supplierForm.phone_secondary}
                  onChange={(e) => setSupplierForm({ ...supplierForm, phone_secondary: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={supplierForm.address}
                  onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Ville"
                  value={supplierForm.city}
                  onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Province"
                  value={supplierForm.province}
                  onChange={(e) => setSupplierForm({ ...supplierForm, province: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Pays"
                  value={supplierForm.country}
                  onChange={(e) => setSupplierForm({ ...supplierForm, country: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={supplierForm.notes}
                  onChange={(e) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  margin="normal"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSupplierDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateSupplier} variant="contained">
              {editingSupplier ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============================================== */}
        {/* DIALOGUE: REMBOURSEMENT */}
        {/* ============================================== */}
        <Dialog open={repaymentDialogOpen} onClose={() => setRepaymentDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Remboursement fournisseur
            {selectedSupplier && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSupplier.supplier_name} - Dette: {formatCurrency(selectedSupplier.current_debt)}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Montant à rembourser"
              type="number"
              value={repaymentAmount}
              onChange={(e) => setRepaymentAmount(e.target.value)}
              margin="normal"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">FCFA</InputAdornment>,
                },
              }}
            />
            <TextField
              fullWidth
              label="Référence de paiement"
              value={repaymentReference}
              onChange={(e) => setRepaymentReference(e.target.value)}
              margin="normal"
              placeholder="Facture #, Réf bancaire..."
            />
            <TextField
              fullWidth
              label="Notes (optionnel)"
              value={repaymentNotes}
              onChange={(e) => setRepaymentNotes(e.target.value)}
              margin="normal"
              multiline
              rows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRepaymentDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleManualRepayment}
              variant="contained"
              disabled={!repaymentAmount || parseFloat(repaymentAmount) <= 0}
            >
              Confirmer le remboursement
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============================================== */}
        {/* DIALOGUE: CONFIGURATION CRÉDIT */}
        {/* ============================================== */}
        <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingConfig ? 'Modifier la configuration' : 'Configuration crédit fournisseur'}
          </DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Fournisseur</InputLabel>
              <Select
                value={selectedSupplierForConfig}
                onChange={(e: SelectChangeEvent) => setSelectedSupplierForConfig(e.target.value)}
                label="Fournisseur"
              >
                {suppliersList.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Limite de crédit"
              type="number"
              value={configForm.credit_limit}
              onChange={(e) => setConfigForm({ ...configForm, credit_limit: e.target.value })}
              margin="normal"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">FCFA</InputAdornment>,
                },
              }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Délai de paiement (jours)</InputLabel>
              <Select
                value={configForm.payment_delay_days}
                onChange={(e: SelectChangeEvent) => setConfigForm({ ...configForm, payment_delay_days: e.target.value })}
                label="Délai de paiement (jours)"
              >
                <MenuItem value="7">7 jours</MenuItem>
                <MenuItem value="15">15 jours</MenuItem>
                <MenuItem value="30">30 jours</MenuItem>
                <MenuItem value="45">45 jours</MenuItem>
                <MenuItem value="60">60 jours</MenuItem>
                <MenuItem value="90">90 jours</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Taux d'intérêt (%)"
              type="number"
              value={configForm.interest_rate}
              onChange={(e) => setConfigForm({ ...configForm, interest_rate: e.target.value })}
              margin="normal"
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                },
              }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Fréquence de paiement</InputLabel>
              <Select
                value={configForm.payment_frequency}
                onChange={(e: SelectChangeEvent) => setConfigForm({ ...configForm, payment_frequency: e.target.value })}
                label="Fréquence de paiement"
              >
                <MenuItem value="daily">Quotidien</MenuItem>
                <MenuItem value="weekly">Hebdomadaire</MenuItem>
                <MenuItem value="monthly">Mensuel</MenuItem>
                <MenuItem value="quarterly">Trimestriel</MenuItem>
                <MenuItem value="semester">Semestriel</MenuItem>
                <MenuItem value="yearly">Annuel</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Pourcentage de remboursement sur vente (%)"
              type="number"
              value={configForm.repayment_percentage_of_sale}
              onChange={(e) => setConfigForm({ ...configForm, repayment_percentage_of_sale: e.target.value })}
              margin="normal"
              helperText="Pourcentage de chaque vente utilisé pour rembourser la dette"
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                },
              }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={configForm.auto_approve}
                  onChange={(e) => setConfigForm({ ...configForm, auto_approve: e.target.checked })}
                />
              }
              label="Auto-approbation des achats à crédit"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateConfig} variant="contained">
              {editingConfig ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============================================== */}
        {/* DIALOGUE: TRANSACTIONS */}
        {/* ============================================== */}
        <Dialog open={viewTransactionDialogOpen} onClose={() => setViewTransactionDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Transactions
            {selectedSupplier && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSupplier.supplier_name}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Référence</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingTransactions ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <CircularProgress size={30} />
                      </TableCell>
                    </TableRow>
                  ) : transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDateTime(transaction.transaction_date)}</TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.transaction_type}
                          size="small"
                          color={
                            transaction.transaction_type === 'repayment' ? 'success'
                              : transaction.transaction_type === 'credit_purchase' ? 'primary'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: transaction.transaction_type === 'repayment' ? 'success.main' : 'error.main' }}>
                        {transaction.transaction_type === 'repayment' ? '-' : ''}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>{transaction.payment_reference || '-'}</TableCell>
                      <TableCell>{transaction.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && !loadingTransactions && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary">Aucune transaction trouvée</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewTransactionDialogOpen(false)}>Fermer</Button>
          </DialogActions>
        </Dialog>

        {/* ============================================== */}
        {/* DIALOGUE: DÉTAILS FOURNISSEUR */}
        {/* ============================================== */}
        <Dialog open={supplierDetailDialogOpen} onClose={() => setSupplierDetailDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Détails du fournisseur
            {selectedSupplierDetail && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSupplierDetail.code}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {selectedSupplierDetail && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Business fontSize="small" />
                      Informations générales
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Nom:</strong> {selectedSupplierDetail.name}</Typography>
                    <Typography variant="body2"><strong>Entreprise:</strong> {selectedSupplierDetail.company_name || '-'}</Typography>
                    <Typography variant="body2"><strong>Type:</strong> {selectedSupplierDetail.type_supplier || '-'}</Typography>
                    <Typography variant="body2"><strong>Statut:</strong> {selectedSupplierDetail.status}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ContactSupportIconMui fontSize="small" />
                      Contact
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Email:</strong> {selectedSupplierDetail.email || '-'}</Typography>
                    <Typography variant="body2"><strong>Téléphone:</strong> {selectedSupplierDetail.phone || '-'}</Typography>
                    <Typography variant="body2"><strong>Contact:</strong> {selectedSupplierDetail.contact_person || '-'}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocationOn fontSize="small" />
                      Adresse
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Adresse:</strong> {selectedSupplierDetail.address || '-'}</Typography>
                    <Typography variant="body2"><strong>Ville:</strong> {selectedSupplierDetail.city || '-'}</Typography>
                    <Typography variant="body2"><strong>Province:</strong> {selectedSupplierDetail.province || '-'}</Typography>
                    <Typography variant="body2"><strong>Pays:</strong> {selectedSupplierDetail.country || '-'}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AccountBalance fontSize="small" />
                      Informations bancaires
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Banque:</strong> {selectedSupplierDetail.bank_name || '-'}</Typography>
                    <Typography variant="body2"><strong>Compte:</strong> {selectedSupplierDetail.bank_account || '-'}</Typography>
                    <Typography variant="body2"><strong>SWIFT:</strong> {selectedSupplierDetail.bank_swift || '-'}</Typography>
                  </Paper>
                </Grid>
                {selectedSupplierDetail.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2">Notes</Typography>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="body2">{selectedSupplierDetail.notes}</Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSupplierDetailDialogOpen(false)}>Fermer</Button>
            {selectedSupplierDetail && (
              <Button
                variant="contained"
                onClick={() => {
                  setSupplierDetailDialogOpen(false);
                  handleEditSupplier(selectedSupplierDetail);
                }}
              >
                Modifier
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* ============================================== */}
        {/* DIALOGUE: CONFIRMATION */}
        {/* ============================================== */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
          <DialogTitle>{confirmTitle}</DialogTitle>
          <DialogContent>
            <Typography>{confirmMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)}>Annuler</Button>
            <Button onClick={confirmAction} color="error" variant="contained">
              Confirmer
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default SupplierCreditPage;