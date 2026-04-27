// pages/ConfigView.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';
import { useTimezoneWithConverter } from '@/hooks/useTimezone';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/Switch';
import { Badge } from '@/components/ui/Badge';
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
import {
  Building2,
  Store,
  Landmark,
  Percent,
  Receipt,
  Users,
  Clock,
  Calendar,
  Moon,
  Sun,
  Laptop,
  Package,
  AlertTriangle,
  Plus,
  Trash2,
  Edit,
  Save,
  Check,
  Shield,
  HelpCircle,
  Settings,
  Star,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface WorkingHoursConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  timezone: string;
  daysOff: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface CurrencyConfig {
  code: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  is_active: boolean;
  is_main_branch: boolean;
  manager_name?: string;
  manager_id?: string;
  config?: Record<string, any>;
}

interface User {
  id: string;
  nom_complet: string;
  email: string;
  role: string;
  branch_id?: string;
  is_active: boolean;
}

interface Holiday {
  id: string;
  date: string;
  name: string;
  is_recurring: boolean;
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ln', name: 'Lingala', nativeName: 'Lingála', flag: '🇨🇩' },
];

const THEMES = [
  { value: 'light', label: 'Clair', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Sombre', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'Système', icon: <Laptop className="h-4 w-4" /> },
];

const SALES_TYPES = [
  { value: 'retail', label: 'Vente en détail uniquement' },
  { value: 'wholesale', label: 'Vente en gros uniquement' },
  { value: 'both', label: 'Vente en gros et en détail' },
];

const ROUNDING_TYPES = [
  { value: 'none', label: "Pas d'arrondissement" },
  { value: 'up', label: "Arrondir à l'unité supérieure" },
  { value: 'down', label: "Arrondir à l'unité inférieure" },
  { value: 'nearest', label: "Arrondir à l'unité la plus proche" },
  { value: 'nearest_50', label: 'Arrondir à 50 FCFA près' },
  { value: 'nearest_100', label: 'Arrondir à 100 FCFA près' },
  { value: 'nearest_500', label: 'Arrondir à 500 FCFA près' },
  { value: 'nearest_1000', label: 'Arrondir à 1000 FCFA près' },
];

const DAYS = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
];

// ============================================================================
// API SERVICES
// ============================================================================

const configApi = {
  // Branches
  getBranches: (pharmacyId: string) =>
    api.get(`/pharmacies/${pharmacyId}/branches`),
  getBranch: (pharmacyId: string, branchId: string) =>
    api.get(`/pharmacies/${pharmacyId}/branches/${branchId}`),
  createBranch: (pharmacyId: string, data: any) =>
    api.post(`/pharmacies/${pharmacyId}/branches`, data),
  updateBranch: (pharmacyId: string, branchId: string, data: any) =>
    api.put(`/pharmacies/${pharmacyId}/branches/${branchId}`, data),
  deleteBranch: (pharmacyId: string, branchId: string) =>
    api.delete(`/pharmacies/${pharmacyId}/branches/${branchId}`),
  setMainBranch: (pharmacyId: string, branchId: string) =>
    api.post(`/pharmacies/${pharmacyId}/branches/${branchId}/set-main`),
  getBranchConfig: (pharmacyId: string, branchId: string) =>
    api.get(`/pharmacies/${pharmacyId}/branches/${branchId}/config`),
  updateBranchConfig: (pharmacyId: string, branchId: string, config: any) =>
    api.patch(`/pharmacies/${pharmacyId}/branches/${branchId}/config`, config),
  updateWorkingHours: (pharmacyId: string, branchId: string, workingHours: WorkingHoursConfig) =>
    api.post(`/pharmacies/${pharmacyId}/branches/${branchId}/working-hours/override`, workingHours),
  removeWorkingHoursOverride: (pharmacyId: string, branchId: string) =>
    api.delete(`/pharmacies/${pharmacyId}/branches/${branchId}/working-hours/override`),

  // Pharmacy Config
  getPharmacyConfig: (pharmacyId: string) =>
    api.get(`/pharmacies/${pharmacyId}/config`),
  updatePharmacyConfig: (pharmacyId: string, config: any) =>
    api.patch(`/pharmacies/${pharmacyId}/config`, config),
  updatePharmacyWorkingHours: (pharmacyId: string, workingHours: WorkingHoursConfig) =>
    api.patch(`/pharmacies/${pharmacyId}/config/working-hours`, workingHours),
  updateCurrencies: (pharmacyId: string, currencies: CurrencyConfig[]) =>
    api.patch(`/pharmacies/${pharmacyId}/config/currencies`, currencies),
  updatePricingConfig: (pharmacyId: string, pricing: any) =>
    api.patch(`/pharmacies/${pharmacyId}/config/pricing`, pricing),
  updateTheme: (pharmacyId: string, theme: string) =>
    api.patch(`/pharmacies/${pharmacyId}/config/theme`, { theme }),
  uploadLogo: (pharmacyId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/pharmacies/${pharmacyId}/logo`, formData);
  },

  // Pharmacy Info
  getPharmacy: (pharmacyId: string) => api.get(`/pharmacies/${pharmacyId}`),
  updatePharmacy: (pharmacyId: string, data: any) =>
    api.put(`/pharmacies/${pharmacyId}`, data),
  getActivePharmacy: () => api.get('/pharmacies/active'),
  setActivePharmacy: (pharmacyId: string) =>
    api.post(`/pharmacies/active/${pharmacyId}`),

  // Users
  getUsers: (branchId?: string) =>
    api.get('/users', { params: { branch_id: branchId } }),
  assignUserToBranch: (userId: string, branchId: string) =>
    api.patch(`/users/${userId}`, { branch_id: branchId }),

  // Holidays
  getHolidays: (pharmacyId: string) =>
    api.get(`/pharmacies/${pharmacyId}/holidays`),
  addHoliday: (pharmacyId: string, data: any) =>
    api.post(`/pharmacies/${pharmacyId}/holidays`, data),
  deleteHoliday: (pharmacyId: string, holidayId: string) =>
    api.delete(`/pharmacies/${pharmacyId}/holidays/${holidayId}`),

  // Settings
  getSettings: () => api.get('/settings'),
  updateSettings: (data: any) => api.patch('/settings', data),
};

// ============================================================================
// COMPOSANTS PRINCIPAUX
// ============================================================================

const ConfigView: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { timezone, convertUTCToLocal } = useTimezoneWithConverter();
  
  // États
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('working-hours');
  const [workingHours, setWorkingHours] = useState<WorkingHoursConfig>({
    enabled: true,
    startTime: '08:00',
    endTime: '22:00',
    overtimeEndTime: '23:59',
    timezone: 'Africa/Kinshasa',
    daysOff: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: false,
    },
  });
  
  const [currencies, setCurrencies] = useState<CurrencyConfig[]>([
    { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 2500 },
    { code: 'USD', symbol: '$', isActive: true, exchangeRate: 1 },
  ]);
  
  const [primaryCurrency, setPrimaryCurrency] = useState('CDF');
  const [taxRate, setTaxRate] = useState(16);
  const [marginConfig, setMarginConfig] = useState({
    defaultMargin: 30,
    minMargin: 5,
    maxMargin: 100,
  });
  const [automaticPricing, setAutomaticPricing] = useState({
    enabled: true,
    method: 'percentage',
    value: 30,
  });
  const [lowStockThreshold, setLowStockThreshold] = useState(5);
  const [expiryWarningDays, setExpiryWarningDays] = useState(90);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [productReturnDays, setProductReturnDays] = useState(7);
  const [salesType, setSalesType] = useState('both');
  const [roundingConfig, setRoundingConfig] = useState({
    enabled: false,
    type: 'none',
  });
  const [theme, setTheme] = useState('system');
  const [language, setLanguage] = useState('fr');
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [autoSaveInvoice, setAutoSaveInvoice] = useState(true);
  const [initialCapital, setInitialCapital] = useState(0);
  const [purchaseCurrency, setPurchaseCurrency] = useState('CDF');
  const [debtEligibility, setDebtEligibility] = useState({
    minDaysAsCustomer: 30,
    minTotalPurchases: 50000,
    maxDebtAmount: 500000,
  });
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [, setExpenseLimits] = useState({
    minAmount: 0,
    maxAmount: 1000000,
    period: 'day',
  });
  const [downloadPath, setDownloadPath] = useState('downloads');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', is_recurring: false });
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [pharmacyInfo, setPharmacyInfo] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: 'RDC',
    license_number: '',
  });
  
  const [, setIsLoading] = useState(false);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: 'RDC',
    phone: '',
    email: '',
    manager_name: '',
  });
  
  // Vérifier si l'utilisateur est admin
  const isAdmin = useMemo(() => {
    return user?.role === 'admin' || user?.role === 'ADMIN' || user?.role === 'super_admin';
  }, [user]);
  
  // Charger la pharmacie active
  useEffect(() => {
    const loadActivePharmacy = async () => {
      try {
        const response = await configApi.getActivePharmacy();
        setPharmacyId(response.data.id);
        await loadPharmacyData(response.data.id);
      } catch (error) {
        console.error('Erreur chargement pharmacie:', error);
      }
    };
    loadActivePharmacy();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Charger toutes les données de la pharmacie
  const loadPharmacyData = async (id: string) => {
    setIsLoading(true);
    try {
      // Charger la config
      const configRes = await configApi.getPharmacyConfig(id);
      const config = configRes.data.config || {};
      
      // Charger les branches
      const branchesRes = await configApi.getBranches(id);
      setBranches(branchesRes.data);
      
      // Charger les utilisateurs
      const usersRes = await configApi.getUsers();
      setUsers(usersRes.data);
      
      // Charger les jours fériés
      const holidaysRes = await configApi.getHolidays(id);
      setHolidays(holidaysRes.data || []);
      
      // Charger les infos de la pharmacie
      const pharmacyRes = await configApi.getPharmacy(id);
      setPharmacyInfo({
        name: pharmacyRes.data.name || '',
        email: pharmacyRes.data.email || '',
        phone: pharmacyRes.data.phone || '',
        address: pharmacyRes.data.address || '',
        city: pharmacyRes.data.city || '',
        country: pharmacyRes.data.country || 'RDC',
        license_number: pharmacyRes.data.license_number || '',
      });
      
      // Appliquer la configuration
      if (config.workingHours) setWorkingHours(config.workingHours);
      if (config.currencies) setCurrencies(config.currencies);
      if (config.primaryCurrency) setPrimaryCurrency(config.primaryCurrency);
      if (config.taxRate) setTaxRate(config.taxRate);
      if (config.marginConfig) setMarginConfig(config.marginConfig);
      if (config.automaticPricing) setAutomaticPricing(config.automaticPricing);
      if (config.lowStockThreshold) setLowStockThreshold(config.lowStockThreshold);
      if (config.expiryWarningDays) setExpiryWarningDays(config.expiryWarningDays);
      if (config.allowNegativeStock !== undefined) setAllowNegativeStock(config.allowNegativeStock);
      if (config.productReturnDays) setProductReturnDays(config.productReturnDays);
      if (config.salesType) setSalesType(config.salesType);
      if (config.roundingConfig) setRoundingConfig(config.roundingConfig);
      if (config.theme) setTheme(config.theme);
      if (config.language) setLanguage(config.language);
      if (config.autoInvoice !== undefined) setAutoInvoice(config.autoInvoice);
      if (config.autoSaveInvoice !== undefined) setAutoSaveInvoice(config.autoSaveInvoice);
      if (config.initialCapital !== undefined) setInitialCapital(config.initialCapital);
      if (config.purchaseCurrency) setPurchaseCurrency(config.purchaseCurrency);
      if (config.debtEligibility) setDebtEligibility(config.debtEligibility);
      if (config.expenseLimits) setExpenseLimits(config.expenseLimits);
      if (config.downloadPath) setDownloadPath(config.downloadPath);
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      toast.error('Erreur lors du chargement de la configuration');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Sauvegarder la configuration de la pharmacie
  const savePharmacyConfig = async (updates: any) => {
    if (!pharmacyId) return;
    try {
      await configApi.updatePharmacyConfig(pharmacyId, updates);
      toast.success('Configuration sauvegardée');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-config'] });
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };
  
  // Sauvegarder les heures de service
  const saveWorkingHours = async () => {
    if (!pharmacyId) return;
    
    try {
      if (selectedBranchId && selectedBranchId !== 'main') {
        await configApi.updateWorkingHours(pharmacyId, selectedBranchId, workingHours);
      } else {
        await configApi.updatePharmacyWorkingHours(pharmacyId, workingHours);
      }
      toast.success('Horaires de service sauvegardés');
    } catch (error) {
      console.error('Erreur sauvegarde horaires:', error);
      toast.error('Erreur lors de la sauvegarde');
    }
  };
  
  // Créer une branche
  const createBranch = async () => {
    if (!pharmacyId) return;
    try {
      await configApi.createBranch(pharmacyId, branchForm);
      // Recharger les branches
      const branchesRes = await configApi.getBranches(pharmacyId);
      setBranches(branchesRes.data);
      setBranchDialogOpen(false);
      setBranchForm({
        name: '',
        code: '',
        address: '',
        city: '',
        country: 'RDC',
        phone: '',
        email: '',
        manager_name: '',
      });
      toast.success('Branche créée avec succès');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };
  
  // Mettre à jour une branche
  const updateBranch = async () => {
    if (!pharmacyId || !editingBranch) return;
    try {
      await configApi.updateBranch(pharmacyId, editingBranch.id, branchForm);
      // Recharger les branches
      const branchesRes = await configApi.getBranches(pharmacyId);
      setBranches(branchesRes.data);
      setBranchDialogOpen(false);
      setEditingBranch(null);
      setBranchForm({
        name: '',
        code: '',
        address: '',
        city: '',
        country: 'RDC',
        phone: '',
        email: '',
        manager_name: '',
      });
      toast.success('Branche mise à jour');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour');
    }
  };
  
  // Supprimer une branche
  const deleteBranch = async (branchId: string) => {
    if (!pharmacyId) return;
    if (!confirm('Êtes-vous sûr de vouloir désactiver cette branche ?')) return;
    
    try {
      await configApi.deleteBranch(pharmacyId, branchId);
      setBranches(branches.filter(b => b.id !== branchId));
      if (selectedBranchId === branchId) {
        setSelectedBranchId(null);
      }
      toast.success('Branche désactivée');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };
  
  // Définir la branche principale
  const setMainBranch = async (branchId: string) => {
    if (!pharmacyId) return;
    try {
      await configApi.setMainBranch(pharmacyId, branchId);
      // Recharger les branches pour obtenir les statuts mis à jour
      const branchesRes = await configApi.getBranches(pharmacyId);
      setBranches(branchesRes.data);
      toast.success('Branche principale définie');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };
  
  // Assigner un utilisateur à une branche
  const assignUserToBranch = async (userId: string, branchId: string) => {
    try {
      await configApi.assignUserToBranch(userId, branchId);
      setUsers(users.map(u => u.id === userId ? { ...u, branch_id: branchId } : u));
      toast.success('Utilisateur assigné à la branche');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur');
    }
  };
  
  // Uploader le logo
  const uploadLogo = async (file: File) => {
    if (!pharmacyId) return;
    try {
      await configApi.uploadLogo(pharmacyId, file);
      toast.success('Logo téléchargé avec succès');
    } catch (error) {
      toast.error('Erreur lors du téléchargement du logo');
    }
  };
  
  // Ajouter un jour férié
  const addHoliday = async () => {
    if (!pharmacyId || !newHoliday.date) return;
    try {
      const response = await configApi.addHoliday(pharmacyId, newHoliday);
      setHolidays([...holidays, response.data]);
      setNewHoliday({ date: '', name: '', is_recurring: false });
      toast.success('Jour férié ajouté');
    } catch (error) {
      toast.error("Erreur lors de l'ajout");
    }
  };
  
  // Supprimer un jour férié
  const deleteHoliday = async (holidayId: string) => {
    if (!pharmacyId) return;
    try {
      await configApi.deleteHoliday(pharmacyId, holidayId);
      setHolidays(holidays.filter(h => h.id !== holidayId));
      toast.success('Jour férié supprimé');
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };
  
  // Mettre à jour les devises
  const updateCurrencies = async () => {
    await savePharmacyConfig({ currencies, primaryCurrency });
  };
  
  // Sauvegarder la configuration des taxes et marges
  const saveTaxMarginConfig = async () => {
    await savePharmacyConfig({
      taxRate,
      marginConfig,
      automaticPricing,
      purchaseCurrency,
    });
  };
  
  // Sauvegarder la configuration des ventes
  const saveSalesConfig = async () => {
    await savePharmacyConfig({
      salesType,
      autoInvoice,
      autoSaveInvoice,
      roundingConfig,
    });
  };
  
  // Sauvegarder la configuration du stock
  const saveInventoryConfig = async () => {
    await savePharmacyConfig({
      lowStockThreshold,
      expiryWarningDays,
      allowNegativeStock,
      productReturnDays,
    });
  };
  
  // Sauvegarder les informations générales de la pharmacie
  const savePharmacyInfo = async () => {
    if (!pharmacyId) return;
    try {
      await configApi.updatePharmacy(pharmacyId, pharmacyInfo);
      toast.success('Informations de la pharmacie mises à jour');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };
  
  // Sauvegarder la configuration avancée
  const saveAdvancedConfig = async () => {
    await savePharmacyConfig({
      initialCapital,
      debtEligibility,
      language,
      theme,
      downloadPath,
    });
  };
  
  // Convertir les heures UTC vers locale pour affichage
  const formatLocalTime = (utcTime: string) => {
    return convertUTCToLocal(utcTime);
  };
  
  // Rendu conditionnel si pas admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">Accès non autorisé</CardTitle>
            <CardDescription className="text-center">
              Vous n'avez pas les droits d'administration pour accéder à cette page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <p>Seuls les administrateurs peuvent accéder à la configuration.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Configuration</h1>
        <p className="text-muted-foreground">
          Gérez tous les paramètres de votre pharmacie et de ses branches
        </p>
      </div>
      
      {/* Sélecteur de branche */}
      <div className="mb-6 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Branche:</span>
        </div>
        <Select value={selectedBranchId || 'main'} onValueChange={setSelectedBranchId}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Sélectionner une branche" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                <span>Pharmacie principale</span>
                <Badge variant="outline" className="ml-2">Principale</Badge>
              </div>
            </SelectItem>
            {branches.filter(b => b.is_active).map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  <span>{branch.name}</span>
                  {branch.is_main_branch && <Badge variant="outline">Principale</Badge>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        {isAdmin && selectedBranchId !== 'main' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const branch = branches.find(b => b.id === selectedBranchId);
                if (branch) {
                  setEditingBranch(branch);
                  setBranchForm({
                    name: branch.name,
                    code: branch.code,
                    address: branch.address || '',
                    city: branch.city || '',
                    country: branch.country || 'RDC',
                    phone: branch.phone || '',
                    email: branch.email || '',
                    manager_name: branch.manager_name || '',
                  });
                  setBranchDialogOpen(true);
                }
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => selectedBranchId && deleteBranch(selectedBranchId)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Supprimer
            </Button>
          </div>
        )}
      </div>
      
      {/* Tabs de configuration */}
      <Tabs defaultValue="working-hours" value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="working-hours" className="gap-2">
            <Clock className="h-4 w-4" />
            Horaires
          </TabsTrigger>
          <TabsTrigger value="branches" className="gap-2">
            <Store className="h-4 w-4" />
            Branches
          </TabsTrigger>
          <TabsTrigger value="currencies" className="gap-2">
            <Landmark className="h-4 w-4" />
            Devises
          </TabsTrigger>
          <TabsTrigger value="tax-margin" className="gap-2">
            <Percent className="h-4 w-4" />
            Taxes & Marges
          </TabsTrigger>
          <TabsTrigger value="sales" className="gap-2">
            <Receipt className="h-4 w-4" />
            Ventes
          </TabsTrigger>
          <TabsTrigger value="inventory" className="gap-2">
            <Package className="h-4 w-4" />
            Stock
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            Général
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="holidays" className="gap-2">
            <Calendar className="h-4 w-4" />
            Jours fériés
          </TabsTrigger>
          <TabsTrigger value="advanced" className="gap-2">
            <Settings className="h-4 w-4" />
            Avancé
          </TabsTrigger>
        </TabsList>
        
        {/* ==================== HORAIRES DE SERVICE ==================== */}
        <TabsContent value="working-hours">
          <Card>
            <CardHeader>
              <CardTitle>Heures de service</CardTitle>
              <CardDescription>
                Configurez les jours et heures d'ouverture. En dehors de ces plages, les utilisateurs verront une page "Hors service".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Activer les restrictions horaires</Label>
                  <p className="text-sm text-muted-foreground">
                    Si désactivé, l'application sera accessible 24h/24
                  </p>
                </div>
                <Switch
                  checked={workingHours.enabled}
                  onCheckedChange={(checked) => setWorkingHours({ ...workingHours, enabled: checked })}
                />
              </div>
              
              {workingHours.enabled && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label>Heure de début (UTC)</Label>
                      <Input
                        type="time"
                        value={workingHours.startTime}
                        onChange={(e) => setWorkingHours({ ...workingHours, startTime: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Heure locale: {formatLocalTime(workingHours.startTime)}
                      </p>
                    </div>
                    <div>
                      <Label>Heure de fin (UTC)</Label>
                      <Input
                        type="time"
                        value={workingHours.endTime}
                        onChange={(e) => setWorkingHours({ ...workingHours, endTime: e.target.value })}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Heure locale: {formatLocalTime(workingHours.endTime)}
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <Label>Heure supplémentaire maximum (optionnel)</Label>
                    <Input
                      type="time"
                      value={workingHours.overtimeEndTime || ''}
                      onChange={(e) => setWorkingHours({ ...workingHours, overtimeEndTime: e.target.value })}
                      className="mt-1"
                      placeholder="Dépassement autorisé jusqu'à"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Heure limite pour les utilisateurs ayant des heures supplémentaires accordées
                    </p>
                  </div>
                  
                  <div>
                    <Label>Jours d'ouverture</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Les jours sélectionnés sont les jours où l'application sera accessible
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
                      {DAYS.map((day) => (
                        <div
                          key={day.key}
                          className={`flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors ${
                            workingHours.daysOff[day.key as keyof typeof workingHours.daysOff]
                              ? 'bg-green-50 border-green-300 dark:bg-green-900/20 dark:border-green-700'
                              : 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700'
                          }`}
                          onClick={() => setWorkingHours({
                            ...workingHours,
                            daysOff: {
                              ...workingHours.daysOff,
                              [day.key]: !workingHours.daysOff[day.key as keyof typeof workingHours.daysOff],
                            },
                          })}
                        >
                          <span className="font-medium">{day.label}</span>
                          <Badge
                            variant={workingHours.daysOff[day.key as keyof typeof workingHours.daysOff] ? 'default' : 'destructive'}
                            className="mt-2"
                          >
                            {workingHours.daysOff[day.key as keyof typeof workingHours.daysOff] ? 'Ouvert' : 'Fermé'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">Information importante</p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                          L'application utilise l'heure UTC du serveur, pas l'heure de l'appareil utilisateur.
                          Les horaires ci-dessus sont en UTC. L'interface convertira automatiquement les heures dans votre fuseau horaire local ({timezone}).
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              
              <div className="flex justify-end">
                <Button onClick={saveWorkingHours}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder les horaires
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== GESTION DES BRANCHES ==================== */}
        <TabsContent value="branches">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Branches / Succursales</CardTitle>
                <CardDescription>
                  Gérez vos différentes succursales et assignez les utilisateurs
                </CardDescription>
              </div>
              <Dialog open={branchDialogOpen} onOpenChange={setBranchDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingBranch(null);
                    setBranchForm({
                      name: '',
                      code: '',
                      address: '',
                      city: '',
                      country: 'RDC',
                      phone: '',
                      email: '',
                      manager_name: '',
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle branche
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingBranch ? 'Modifier la branche' : 'Créer une branche'}</DialogTitle>
                    <DialogDescription>
                      {editingBranch ? 'Modifiez les informations de la branche' : 'Ajoutez une nouvelle succursale'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Nom de la branche *</Label>
                      <Input
                        value={branchForm.name}
                        onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                        placeholder="Ex: Pharmacie Centrale"
                      />
                    </div>
                    <div>
                      <Label>Code (unique)</Label>
                      <Input
                        value={branchForm.code}
                        onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                        placeholder="Ex: PC001"
                      />
                    </div>
                    <div>
                      <Label>Adresse</Label>
                      <Input
                        value={branchForm.address}
                        onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Ville</Label>
                        <Input
                          value={branchForm.city}
                          onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Téléphone</Label>
                        <Input
                          value={branchForm.phone}
                          onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={branchForm.email}
                        onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Nom du responsable</Label>
                      <Input
                        value={branchForm.manager_name}
                        onChange={(e) => setBranchForm({ ...branchForm, manager_name: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBranchDialogOpen(false)}>
                      Annuler
                    </Button>
                    <Button onClick={editingBranch ? updateBranch : createBranch}>
                      {editingBranch ? 'Mettre à jour' : 'Créer'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className={`p-4 rounded-lg border ${
                      branch.is_main_branch ? 'border-blue-300 bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg">{branch.name}</h3>
                          <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                            {branch.is_active ? 'Actif' : 'Inactif'}
                          </Badge>
                          {branch.is_main_branch && (
                            <Badge variant="default" className="bg-blue-500">
                              Branche principale
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">Code: {branch.code}</p>
                        {branch.address && (
                          <p className="text-sm text-muted-foreground">📍 {branch.address}, {branch.city}</p>
                        )}
                        {branch.phone && (
                          <p className="text-sm text-muted-foreground">📞 {branch.phone}</p>
                        )}
                        {branch.manager_name && (
                          <p className="text-sm text-muted-foreground">👤 Responsable: {branch.manager_name}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingBranch(branch);
                            setBranchForm({
                              name: branch.name,
                              code: branch.code,
                              address: branch.address || '',
                              city: branch.city || '',
                              country: branch.country || 'RDC',
                              phone: branch.phone || '',
                              email: branch.email || '',
                              manager_name: branch.manager_name || '',
                            });
                            setBranchDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {!branch.is_main_branch && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setMainBranch(branch.id)}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => deleteBranch(branch.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {branches.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Aucune branche. Cliquez sur "Nouvelle branche" pour en créer une.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== DEVISES ==================== */}
        <TabsContent value="currencies">
          <Card>
            <CardHeader>
              <CardTitle>Devises</CardTitle>
              <CardDescription>
                Configurez les devises acceptées et leurs taux de change
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                {currencies.map((currency, index) => (
                  <div key={currency.code} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold">{currency.symbol} {currency.code}</span>
                        <Badge variant={currency.isActive ? 'default' : 'secondary'}>
                          {currency.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        {currency.code !== 'USD' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPrimaryCurrency(currency.code)}
                          >
                            {primaryCurrency === currency.code ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              'Définir par défaut'
                            )}
                          </Button>
                        )}
                        <Switch
                          checked={currency.isActive}
                          onCheckedChange={(checked) => {
                            const newCurrencies = [...currencies];
                            newCurrencies[index].isActive = checked;
                            setCurrencies(newCurrencies);
                          }}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Code</Label>
                        <Input
                          value={currency.code}
                          onChange={(e) => {
                            const newCurrencies = [...currencies];
                            newCurrencies[index].code = e.target.value.toUpperCase();
                            setCurrencies(newCurrencies);
                          }}
                        />
                      </div>
                      <div>
                        <Label>Symbole</Label>
                        <Input
                          value={currency.symbol}
                          onChange={(e) => {
                            const newCurrencies = [...currencies];
                            newCurrencies[index].symbol = e.target.value;
                            setCurrencies(newCurrencies);
                          }}
                        />
                      </div>
                    </div>
                    
                    {currency.code !== 'USD' && (
                      <div className="mt-4">
                        <Label>Taux de change (1 USD = ?)</Label>
                        <Input
                          type="number"
                          value={currency.exchangeRate}
                          onChange={(e) => {
                            const newCurrencies = [...currencies];
                            newCurrencies[index].exchangeRate = parseFloat(e.target.value) || 0;
                            setCurrencies(newCurrencies);
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Exemple: 1 USD = {currency.exchangeRate} {currency.code}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-start gap-3">
                  <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <p className="font-medium">Devise par défaut: {primaryCurrency}</p>
                    <p className="text-sm text-muted-foreground">
                      Tous les prix seront affichés dans cette devise par défaut.
                      Si vous activez la vente en USD, les prix seront convertis automatiquement selon le taux du jour.
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={updateCurrencies}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder les devises
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== TAXES & MARGES ==================== */}
        <TabsContent value="tax-margin">
          <Card>
            <CardHeader>
              <CardTitle>Taxes et Marges bénéficiaires</CardTitle>
              <CardDescription>
                Configurez la TVA et les marges pour le calcul automatique des prix
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Taux de TVA (%)</Label>
                <Input
                  type="number"
                  value={taxRate}
                  onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-32"
                />
              </div>
              
              <div className="border-t pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <Label>Calcul automatique des prix de vente</Label>
                    <p className="text-sm text-muted-foreground">
                      Si activé, les prix de vente sont calculés automatiquement depuis le prix d'achat
                    </p>
                  </div>
                  <Switch
                    checked={automaticPricing.enabled}
                    onCheckedChange={(checked) => setAutomaticPricing({ ...automaticPricing, enabled: checked })}
                  />
                </div>
                
                {automaticPricing.enabled && (
                  <>
                    <div>
                      <Label>Marge bénéficiaire par défaut (%)</Label>
                      <Input
                        type="number"
                        value={marginConfig.defaultMargin}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setMarginConfig({ ...marginConfig, defaultMargin: val });
                          setAutomaticPricing({ ...automaticPricing, value: val });
                        }}
                        className="mt-1 w-32"
                      />
                      <p className="text-sm text-muted-foreground mt-2">
                        <strong>Méthode de calcul:</strong> Prix vente = Prix achat × (1 + marge/100)
                        <br />
                        Exemple: Prix achat = 1000 FCFA, Marge 30% → Prix vente = 1300 FCFA
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Marge minimale (%)</Label>
                        <Input
                          type="number"
                          value={marginConfig.minMargin}
                          onChange={(e) => setMarginConfig({ ...marginConfig, minMargin: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                      <div>
                        <Label>Marge maximale (%)</Label>
                        <Input
                          type="number"
                          value={marginConfig.maxMargin}
                          onChange={(e) => setMarginConfig({ ...marginConfig, maxMargin: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              <div className="border-t pt-6">
                <Label>Devise pour les prix d'achat</Label>
                <Select value={purchaseCurrency} onValueChange={setPurchaseCurrency}>
                  <SelectTrigger className="w-48 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.filter(c => c.isActive).map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.symbol} {c.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground mt-2">
                  Les prix d'achat seront enregistrés dans cette devise
                </p>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={saveTaxMarginConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== VENTES ==================== */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>Configuration des ventes</CardTitle>
              <CardDescription>
                Paramétrez les types de vente, facturation et arrondissements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Type de vente</Label>
                <Select value={salesType} onValueChange={setSalesType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALES_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-t pt-6">
                <Label>Facturation</Label>
                <div className="space-y-3 mt-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span>Génération automatique des factures</span>
                      <p className="text-sm text-muted-foreground">
                        Les factures sont créées automatiquement après chaque vente
                      </p>
                    </div>
                    <Switch checked={autoInvoice} onCheckedChange={setAutoInvoice} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <span>Sauvegarde automatique des factures</span>
                      <p className="text-sm text-muted-foreground">
                        Les factures sont sauvegardées automatiquement dans l'historique
                      </p>
                    </div>
                    <Switch checked={autoSaveInvoice} onCheckedChange={setAutoSaveInvoice} />
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-6">
                <Label>Arrondissement des prix</Label>
                <div className="flex items-center justify-between mt-3">
                  <span>Activer l'arrondissement</span>
                  <Switch
                    checked={roundingConfig.enabled}
                    onCheckedChange={(checked) => setRoundingConfig({ ...roundingConfig, enabled: checked })}
                  />
                </div>
                
                {roundingConfig.enabled && (
                  <div className="mt-4">
                    <Label>Type d'arrondissement</Label>
                    <Select
                      value={roundingConfig.type}
                      onValueChange={(value) => setRoundingConfig({ ...roundingConfig, type: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROUNDING_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <Button onClick={saveSalesConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== STOCK ==================== */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>Gestion du stock</CardTitle>
              <CardDescription>
                Configurez les alertes, seuils et règles de gestion
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Seuil d'alerte stock bas</Label>
                <Input
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 0)}
                  className="mt-1 w-32"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Alerte quand le stock est inférieur ou égal à ce nombre
                </p>
              </div>
              
              <div>
                <Label>Jours d'avertissement avant expiration</Label>
                <Input
                  type="number"
                  value={expiryWarningDays}
                  onChange={(e) => setExpiryWarningDays(parseInt(e.target.value) || 0)}
                  className="mt-1 w-32"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <span>Autoriser stock négatif</span>
                  <p className="text-sm text-muted-foreground">
                    Permet de vendre même si le stock est insuffisant
                  </p>
                </div>
                <Switch checked={allowNegativeStock} onCheckedChange={setAllowNegativeStock} />
              </div>
              
              <div>
                <Label>Délai de retour produit (jours)</Label>
                <Input
                  type="number"
                  value={productReturnDays}
                  onChange={(e) => setProductReturnDays(parseInt(e.target.value) || 0)}
                  className="mt-1 w-32"
                />
              </div>
              
              <div className="flex justify-end">
                <Button onClick={saveInventoryConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== GÉNÉRAL ==================== */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>
                Modifiez les informations de votre pharmacie
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Nom de la pharmacie</Label>
                  <Input
                    value={pharmacyInfo.name}
                    onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, name: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={pharmacyInfo.email}
                      onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={pharmacyInfo.phone}
                      onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, phone: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Adresse</Label>
                  <Input
                    value={pharmacyInfo.address}
                    onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, address: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ville</Label>
                    <Input
                      value={pharmacyInfo.city}
                      onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, city: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Pays</Label>
                    <Input
                      value={pharmacyInfo.country}
                      onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, country: e.target.value })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Numéro de licence</Label>
                  <Input
                    value={pharmacyInfo.license_number}
                    onChange={(e) => setPharmacyInfo({ ...pharmacyInfo, license_number: e.target.value })}
                  />
                </div>
                
                <div>
                  <Label>Logo</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadLogo(file);
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={savePharmacyInfo}>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les modifications
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== UTILISATEURS ==================== */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Utilisateurs</CardTitle>
              <CardDescription>
                Assignez les utilisateurs aux branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Branche assignée</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((userItem) => (
                    <TableRow key={userItem.id}>
                      <TableCell className="font-medium">{userItem.nom_complet}</TableCell>
                      <TableCell>{userItem.email}</TableCell>
                      <TableCell>
                        <Badge variant={userItem.role === 'admin' ? 'default' : 'secondary'}>
                          {userItem.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userItem.branch_id ? (
                          <Badge variant="outline">
                            {branches.find(b => b.id === userItem.branch_id)?.name || 'Inconnue'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Non assigné</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={userItem.branch_id || ''}
                          onValueChange={(value) => assignUserToBranch(userItem.id, value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Assigner à une branche" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.filter(b => b.is_active).map((branch) => (
                              <SelectItem key={branch.id} value={branch.id}>
                                {branch.name} {branch.is_main_branch && '(Principale)'}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== JOURS FÉRIÉS ==================== */}
        <TabsContent value="holidays">
          <Card>
            <CardHeader>
              <CardTitle>Jours fériés</CardTitle>
              <CardDescription>
                Ajoutez des jours où l'application sera fermée (format JJ/MM/AAAA)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newHoliday.date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <Label>Nom / Description</Label>
                  <Input
                    value={newHoliday.name}
                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                    placeholder="Ex: Noël, Nouvel An..."
                  />
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    checked={newHoliday.is_recurring}
                    onCheckedChange={(checked) => setNewHoliday({ ...newHoliday, is_recurring: checked })}
                  />
                  <Label className="cursor-pointer">Récurrent (chaque année)</Label>
                </div>
                <Button onClick={addHoliday}>
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter
                </Button>
              </div>
              
              <div className="space-y-2">
                {holidays.map((holiday) => {
                  const dateObj = new Date(holiday.date);
                  const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
                  return (
                    <div
                      key={holiday.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                    >
                      <div>
                        <span className="font-medium">{formattedDate}</span>
                        <span className="mx-2 text-muted-foreground">-</span>
                        <span>{holiday.name}</span>
                        {holiday.is_recurring && (
                          <Badge variant="outline" className="ml-2">
                            Récurrent
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteHoliday(holiday.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  );
                })}
                
                {holidays.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Aucun jour férié configuré
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* ==================== AVANCÉ ==================== */}
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Configuration avancée</CardTitle>
              <CardDescription>
                Paramètres supplémentaires
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label>Capital initial</Label>
                <Input
                  type="number"
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                  className="mt-1 w-48"
                />
              </div>
              
              <div className="border-t pt-6">
                <Label>Critères d'éligibilité pour les dettes (crédit client)</Label>
                <div className="space-y-3 mt-3">
                  <div>
                    <Label>Jours minimum en tant que client</Label>
                    <Input
                      type="number"
                      value={debtEligibility.minDaysAsCustomer}
                      onChange={(e) => setDebtEligibility({ ...debtEligibility, minDaysAsCustomer: parseInt(e.target.value) || 0 })}
                      className="w-32"
                    />
                  </div>
                  <div>
                    <Label>Achats totaux minimum</Label>
                    <Input
                      type="number"
                      value={debtEligibility.minTotalPurchases}
                      onChange={(e) => setDebtEligibility({ ...debtEligibility, minTotalPurchases: parseFloat(e.target.value) || 0 })}
                      className="w-48"
                    />
                  </div>
                  <div>
                    <Label>Montant maximum de dette autorisé</Label>
                    <Input
                      type="number"
                      value={debtEligibility.maxDebtAmount}
                      onChange={(e) => setDebtEligibility({ ...debtEligibility, maxDebtAmount: parseFloat(e.target.value) || 0 })}
                      className="w-48"
                    />
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-6">
                <Label>Langue de l'application</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="w-48 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.nativeName}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="border-t pt-6">
                <Label>Thème</Label>
                <div className="flex gap-3 mt-3">
                  {THEMES.map((t) => (
                    <Button
                      key={t.value}
                      variant={theme === t.value ? 'default' : 'outline'}
                      onClick={() => setTheme(t.value)}
                      className="gap-2"
                    >
                      {t.icon}
                      {t.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="border-t pt-6">
                <Label>Dossier de téléchargement</Label>
                <Input
                  value={downloadPath}
                  onChange={(e) => setDownloadPath(e.target.value)}
                  className="mt-1"
                  placeholder="downloads/"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Tous les exports et téléchargements seront sauvegardés dans ce dossier
                </p>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={saveAdvancedConfig}>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ConfigView;