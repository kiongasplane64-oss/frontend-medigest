import { useState, useEffect } from 'react';
import { 
  RefreshCcw,
  XCircle,
  AlertTriangle,
  X,
  CreditCard,
  CheckCircle,
  Upload,
  Settings,
  Save,
  ShieldCheck,
  Settings2,
  Database,
  Edit3
} from 'lucide-react';
import api from '@/api/client';
import OutOfService from './endehors';
import { useTimezone } from '@/hooks/useTimezone';

// ============================================
// TYPES
// ============================================

interface PharmacyResponse {
  id: string;
  name: string;
  license_number: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  is_active: boolean;
  tenant_id: string;
  config: PharmacyConfig;
  created_at: string;
  updated_at: string;
}

interface CurrencyConfig {
  code: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number;
}

interface PharmacyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  logo?: string;
  logoUrl?: string;
}

interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  timezone?: string;
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

interface MarginConfig {
  defaultMargin: number;
  minMargin: number;
  maxMargin: number;
}

interface AutomaticPricingConfig {
  enabled: boolean;
  method: 'percentage' | 'coefficient' | 'margin';
  value: number;
}

interface SubscriptionConfig {
  plan: string;
  max_users: number;
  max_products: number;
  max_transactions_per_month: number;
  features: {
    inventory_management: boolean;
    sales: boolean;
    reports: boolean;
    multi_currency: boolean;
    pos_integration: boolean;
    api_access: boolean;
  };
  start_date?: string;
  end_date?: string;
  is_trial: boolean;
  trial_ends_at?: string;
}

interface OperationalConfig {
  workingHours?: WorkingHours | null;
  lowStockThreshold?: number | null;
  expiryWarningDays?: number | null;
  allowNegativeStock?: boolean | null;
  currencies?: CurrencyConfig[] | null;
  taxRate?: number | null;
  salesType?: string | null;
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
  manager_id?: string;
  manager_name?: string;
  latitude?: number;
  longitude?: number;
  is_active: boolean;
  is_main_branch: boolean;
  created_at: string;
  updated_at?: string;
  config?: BranchConfigData;
  subscription_config?: SubscriptionConfig;
  operational_config?: OperationalConfig;
  subscription_status: 'trial' | 'active' | 'expired' | 'suspended';
}

interface BranchConfigData {
  workingHours?: WorkingHours;
  workingHoursOverridden?: boolean;
  [key: string]: any;
}

interface BranchConfig {
  maxBranches: number;
  currentBranches: number;
  branches: Branch[];
  main_branch_id?: string;
  main_branch_name?: string;
}

interface ResolvedConfig {
  working_hours: WorkingHours;
  currencies: CurrencyConfig[];
  low_stock_threshold: number;
  expiry_warning_days: number;
  allow_negative_stock: boolean;
  tax_rate: number;
  sales_type: string;
  subscription_features: {
    plan: string;
    max_users: number;
    max_products: number;
    max_transactions_per_month: number;
    features: {
      inventory_management: boolean;
      sales: boolean;
      reports: boolean;
      multi_currency: boolean;
      pos_integration: boolean;
      api_access: boolean;
    };
  };
}

interface BranchFeaturesResponse {
  branch_id: string;
  branch_name: string;
  subscription_status: string;
  features: {
    plan: string;
    max_users: number;
    max_products: number;
    max_transactions_per_month: number;
    features: Record<string, boolean>;
  };
  usage: {
    current_users: number;
    max_users: number;
    current_products: number;
    max_products: number;
    current_transactions_this_month: number;
    max_transactions_per_month: number;
  };
  can_add_user: boolean;
  can_add_product: boolean;
}

type SalesType = 'wholesale' | 'retail' | 'both';
type CurrencyMode = 'cdf_only' | 'usd_only' | 'both';

interface ExpiredProductsConfig {
  allowSale: boolean;
}

interface OvertimeConfig {
  enabled: boolean;
  endTime: string;
}

interface ProfitabilityConfig {
  enabled: boolean;
  rate: number;
}

interface InvoiceConfig {
  autoPrint: boolean;
  autoSave: boolean;
  fontSize: number;
}

interface ReportConfig {
  defaultFontSize: number;
}

interface RoundingConfig {
  enabled: boolean;
  precision: number;
  method: 'nearest' | 'up' | 'down';
}

interface PharmacyConfig {
  pharmacyId: string;
  pharmacyInfo: PharmacyInfo;
  currencies: CurrencyConfig[];
  primaryCurrency: string;
  currencyMode: CurrencyMode;
  taxRate: number;
  lowStockThreshold: number;
  expiryWarningDays: number;
  allowNegativeStock: boolean;
  workingHours: WorkingHours;
  productReturnDays: number;
  marginConfig: MarginConfig;
  automaticPricing: AutomaticPricingConfig;
  theme: 'light' | 'dark' | 'system';
  initialCapital: number;
  branchConfig: BranchConfig;
  updatedAt: string;
  createdAt: string;
  salesType: SalesType;
  expiredProducts: ExpiredProductsConfig;
  overtime: OvertimeConfig;
  sellByExchangeRate: boolean;
  profitability: ProfitabilityConfig;
  invoice: InvoiceConfig;
  report: ReportConfig;
  rounding: RoundingConfig;
}

interface ConfigViewProps {
  pharmacyId?: string;
}

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

interface User {
  id: string;
  nom_complet: string;
  email: string;
  role: string;
}

// ============================================
// VALEURS PAR DÉFAUT
// ============================================

const DEFAULT_WORKING_HOURS: WorkingHours = {
  enabled: true,
  startTime: '08:00',
  endTime: '20:00',
  overtimeEndTime: '22:00',
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
};

const DEFAULT_MARGIN_CONFIG: MarginConfig = {
  defaultMargin: 25,
  minMargin: 10,
  maxMargin: 50,
};

const DEFAULT_AUTOMATIC_PRICING: AutomaticPricingConfig = {
  enabled: false,
  method: 'percentage',
  value: 25,
};

const DEFAULT_BRANCH_CONFIG: BranchConfig = {
  maxBranches: 1,
  currentBranches: 0,
  branches: [],
};

const DEFAULT_CURRENCIES: CurrencyConfig[] = [
  { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 1 },
  { code: 'USD', symbol: '$', isActive: true, exchangeRate: 1 },
];

const DEFAULT_PHARMACY_INFO: PharmacyInfo = {
  name: '',
  address: '',
  phone: '',
  email: '',
  licenseNumber: '',
  logo: undefined,
  logoUrl: undefined,
};

const DEFAULT_SALES_TYPE: SalesType = 'both';
const DEFAULT_CURRENCY_MODE: CurrencyMode = 'both';
const DEFAULT_EXPIRED_PRODUCTS: ExpiredProductsConfig = { allowSale: false };
const DEFAULT_OVERTIME: OvertimeConfig = { enabled: false, endTime: '22:00' };
const DEFAULT_SELL_BY_EXCHANGE_RATE = true;
const DEFAULT_PROFITABILITY: ProfitabilityConfig = { enabled: false, rate: 30 };
const DEFAULT_INVOICE: InvoiceConfig = { autoPrint: false, autoSave: true, fontSize: 12 };
const DEFAULT_REPORT: ReportConfig = { defaultFontSize: 12 };
const DEFAULT_ROUNDING: RoundingConfig = { enabled: false, precision: 0, method: 'nearest' };

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

const ConfigView = ({ pharmacyId: propPharmacyId }: ConfigViewProps) => {
  // États
  const [currentPharmacyId, setCurrentPharmacyId] = useState<string>(propPharmacyId || '');
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState(!propPharmacyId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outOfService, setOutOfService] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [pharmacyData, setPharmacyData] = useState<PharmacyResponse | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  // États pour les branches
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showBranchConfigPanel, setShowBranchConfigPanel] = useState(false);
  const [branchResolvedConfig, setBranchResolvedConfig] = useState<ResolvedConfig | null>(null);
  const [branchFeatures, setBranchFeatures] = useState<BranchFeaturesResponse | null>(null);
  const [loadingBranchConfig, setLoadingBranchConfig] = useState(false);
  
  const [branchFormData, setBranchFormData] = useState<Partial<Branch>>({
    name: '',
    code: '',
    address: '',
    city: '',
    country: 'CD',
    phone: '',
    email: '',
    manager_id: '',
  });
  
  // État pour la configuration opérationnelle d'une branche
  const [branchOperationalConfig, setBranchOperationalConfig] = useState<OperationalConfig>({});
  const [editingOperationalConfig, setEditingOperationalConfig] = useState(false);
  
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  
  const { timezone: browserTimezone, offset: browserOffset } = useTimezone();
  
  const [config, setConfig] = useState<PharmacyConfig>({
    pharmacyId: '',
    pharmacyInfo: DEFAULT_PHARMACY_INFO,
    currencies: DEFAULT_CURRENCIES,
    primaryCurrency: 'CDF',
    currencyMode: DEFAULT_CURRENCY_MODE,
    taxRate: 16,
    lowStockThreshold: 10,
    expiryWarningDays: 90,
    allowNegativeStock: false,
    workingHours: DEFAULT_WORKING_HOURS,
    productReturnDays: 30,
    marginConfig: DEFAULT_MARGIN_CONFIG,
    automaticPricing: DEFAULT_AUTOMATIC_PRICING,
    theme: 'system',
    initialCapital: 0,
    branchConfig: DEFAULT_BRANCH_CONFIG,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    salesType: DEFAULT_SALES_TYPE,
    expiredProducts: DEFAULT_EXPIRED_PRODUCTS,
    overtime: DEFAULT_OVERTIME,
    sellByExchangeRate: DEFAULT_SELL_BY_EXCHANGE_RATE,
    profitability: DEFAULT_PROFITABILITY,
    invoice: DEFAULT_INVOICE,
    report: DEFAULT_REPORT,
    rounding: DEFAULT_ROUNDING,
  });

  // ============================================
  // FONCTION POUR RÉCUPÉRER LA PHARMACIE ACTIVE
  // ============================================
  
  const fetchActivePharmacy = async (): Promise<string | null> => {
    try {
      const response = await api.get('/pharmacies/me/active-pharmacy');
      return response.data.pharmacy_id;
    } catch (err) {
      console.error('Erreur lors de la récupération de la pharmacie active:', err);
      return null;
    }
  };

  // ============================================
  // EFFETS
  // ============================================

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (config.theme === 'dark') {
      root.classList.add('dark');
    } else if (config.theme === 'light') {
      root.classList.remove('dark');
    } else if (config.theme === 'system') {
      if (systemDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [config.theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (config.theme === 'system') {
        if (mediaQuery.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [config.theme]);

  useEffect(() => {
    if (currentPharmacyId) {
      checkServiceStatus();
      const interval = setInterval(checkServiceStatus, 60000);
      return () => clearInterval(interval);
    }
  }, [currentPharmacyId]);

  // ============================================
  // FONCTIONS UTILITAIRES
  // ============================================

  const mergeConfigWithDefaults = (loadedConfig: any): PharmacyConfig => {
    return {
      pharmacyId: currentPharmacyId,
      pharmacyInfo: {
        ...DEFAULT_PHARMACY_INFO,
        ...(loadedConfig?.pharmacyInfo || {})
      },
      currencies: Array.isArray(loadedConfig?.currencies) && loadedConfig.currencies.length > 0 
        ? loadedConfig.currencies 
        : DEFAULT_CURRENCIES,
      primaryCurrency: loadedConfig?.primaryCurrency || 'CDF',
      currencyMode: loadedConfig?.currencyMode || DEFAULT_CURRENCY_MODE,
      taxRate: loadedConfig?.taxRate ?? 16,
      lowStockThreshold: loadedConfig?.lowStockThreshold ?? 10,
      expiryWarningDays: loadedConfig?.expiryWarningDays ?? 90,
      allowNegativeStock: loadedConfig?.allowNegativeStock ?? false,
      workingHours: {
        ...DEFAULT_WORKING_HOURS,
        ...(loadedConfig?.workingHours || {}),
        daysOff: {
          ...DEFAULT_WORKING_HOURS.daysOff,
          ...(loadedConfig?.workingHours?.daysOff || {})
        }
      },
      productReturnDays: loadedConfig?.productReturnDays ?? 30,
      marginConfig: {
        ...DEFAULT_MARGIN_CONFIG,
        ...(loadedConfig?.marginConfig || {})
      },
      automaticPricing: {
        ...DEFAULT_AUTOMATIC_PRICING,
        ...(loadedConfig?.automaticPricing || {})
      },
      theme: loadedConfig?.theme || 'system',
      initialCapital: loadedConfig?.initialCapital ?? 0,
      branchConfig: {
        ...DEFAULT_BRANCH_CONFIG,
        ...(loadedConfig?.branchConfig || {}),
        branches: loadedConfig?.branchConfig?.branches || []
      },
      updatedAt: loadedConfig?.updatedAt || new Date().toISOString(),
      createdAt: loadedConfig?.createdAt || new Date().toISOString(),
      salesType: loadedConfig?.salesType?.type || loadedConfig?.salesType || DEFAULT_SALES_TYPE,
      expiredProducts: {
        ...DEFAULT_EXPIRED_PRODUCTS,
        ...(loadedConfig?.expiredProducts || {})
      },
      overtime: {
        ...DEFAULT_OVERTIME,
        ...(loadedConfig?.overtime || {})
      },
      sellByExchangeRate: loadedConfig?.sellByExchangeRate ?? DEFAULT_SELL_BY_EXCHANGE_RATE,
      profitability: {
        ...DEFAULT_PROFITABILITY,
        ...(loadedConfig?.profitability || {})
      },
      invoice: {
        ...DEFAULT_INVOICE,
        ...(loadedConfig?.invoice || {})
      },
      report: {
        ...DEFAULT_REPORT,
        ...(loadedConfig?.report || {})
      },
      rounding: {
        ...DEFAULT_ROUNDING,
        ...(loadedConfig?.rounding || {})
      },
    };
  };

  // ============================================
  // REQUÊTES API
  // ============================================

  const loadPharmacyData = async () => {
    // Si pas d'ID, essayer de le récupérer
    let id = currentPharmacyId;
    if (!id && resolvingId) {
      const fetchedId = await fetchActivePharmacy();
      if (fetchedId) {
        id = fetchedId;
        setCurrentPharmacyId(fetchedId);
        setResolvingId(false);
      } else {
        setError("Aucune pharmacie active trouvée");
        setLoading(false);
        setResolvingId(false);
        return;
      }
    }

    if (!id) {
      setError("ID de pharmacie non fourni");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const pharmacyResponse = await api.get<PharmacyResponse>(`/pharmacies/${id}`);
      setPharmacyData(pharmacyResponse.data);
      
      const configResponse = await api.get<{ config: PharmacyConfig }>(`/pharmacies/${id}/config`);
      
      const loadedConfig = configResponse.data.config || {};
      const mergedConfig = mergeConfigWithDefaults(loadedConfig);
      
      setConfig({
        ...mergedConfig,
        pharmacyInfo: {
          ...mergedConfig.pharmacyInfo,
          name: pharmacyResponse.data.name || '',
          address: pharmacyResponse.data.address || '',
          phone: pharmacyResponse.data.phone || '',
          email: pharmacyResponse.data.email || '',
          licenseNumber: pharmacyResponse.data.license_number || '',
        },
      });
      
      await checkServiceStatus();
      await loadAvailableUsers();
      
    } catch (err: any) {
      console.error('Erreur lors du chargement:', err);
      setError(err.response?.data?.detail || "Erreur lors du chargement de la configuration");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const response = await api.get('/users', {
        params: { tenant_id: pharmacyData?.tenant_id, limit: 100 }
      });
      if (response.data && Array.isArray(response.data)) {
        setAvailableUsers(response.data);
      } else if (response.data && response.data.items) {
        setAvailableUsers(response.data.items);
      } else {
        setAvailableUsers([]);
      }
    } catch (err) {
      console.error('Erreur lors du chargement des utilisateurs:', err);
      setAvailableUsers([]);
    }
  };

  const checkServiceStatus = async () => {
    if (!currentPharmacyId) return;
    try {
      const response = await api.get<ServiceStatus>(`/pharmacies/${currentPharmacyId}/service-status`);
      setServiceStatus(response.data);
      setOutOfService(!response.data.in_service);
    } catch (err) {
      console.error('Erreur lors de la vérification du service:', err);
    }
  };

  // ============================================
  // GESTION DES BRANCHES - CONFIGURATION RÉSOLUE
  // ============================================

  const loadBranchResolvedConfig = async (branch: Branch) => {
    setLoadingBranchConfig(true);
    try {
      const response = await api.get<ResolvedConfig>(`/branches/${branch.id}/resolved-config`);
      setBranchResolvedConfig(response.data);
      
      const featuresResponse = await api.get<BranchFeaturesResponse>(`/branches/${branch.id}/subscription/features`);
      setBranchFeatures(featuresResponse.data);
      
      // Initialiser la configuration opérationnelle
      setBranchOperationalConfig({
        workingHours: branch.operational_config?.workingHours || null,
        lowStockThreshold: branch.operational_config?.lowStockThreshold ?? null,
        expiryWarningDays: branch.operational_config?.expiryWarningDays ?? null,
        allowNegativeStock: branch.operational_config?.allowNegativeStock ?? null,
        currencies: branch.operational_config?.currencies || null,
        taxRate: branch.operational_config?.taxRate ?? null,
        salesType: branch.operational_config?.salesType || null,
      });
      
    } catch (err) {
      console.error('Erreur lors du chargement de la config résolue:', err);
      setError("Erreur lors du chargement de la configuration de la succursale");
    } finally {
      setLoadingBranchConfig(false);
    }
  };

  const updateBranchOperationalConfig = async (branchId: string, updates: OperationalConfig) => {
    try {
      const response = await api.patch(`/branches/${branchId}/operational-config`, updates);
      // Mettre à jour la branche dans la liste
      setConfig(prev => ({
        ...prev,
        branchConfig: {
          ...prev.branchConfig,
          branches: prev.branchConfig.branches.map(b => 
            b.id === branchId 
              ? { ...b, operational_config: { ...b.operational_config, ...updates }, updated_at: new Date().toISOString() }
              : b
          )
        }
      }));
      setSuccess("Configuration de la succursale mise à jour");
      setTimeout(() => setSuccess(null), 3000);
      return response.data;
    } catch (err) {
      console.error('Erreur lors de la mise à jour:', err);
      setError("Erreur lors de la mise à jour de la configuration");
      throw err;
    }
  };

  const resetBranchOperationalConfig = async (branchId: string, key: string) => {
    try {
      await api.delete(`/branches/${branchId}/operational-config/${key}`);
      // Recharger la configuration résolue
      const branch = config.branchConfig.branches.find(b => b.id === branchId);
      if (branch) {
        await loadBranchResolvedConfig(branch);
      }
      setSuccess(`Configuration '${key}' réinitialisée`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors de la réinitialisation:', err);
      setError("Erreur lors de la réinitialisation");
    }
  };

  const uploadLogo = async () => {
    if (!logoFile || !currentPharmacyId) return;
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const response = await api.post(`/pharmacies/${currentPharmacyId}/logo`, formData);
      setConfig({
        ...config,
        pharmacyInfo: { ...config.pharmacyInfo, logoUrl: response.data.logo_url }
      });
      setSuccess("Logo téléchargé avec succès !");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Erreur lors du téléchargement du logo:', err);
      setError("Erreur lors du téléchargement du logo");
    }
  };

  const handleSave = async () => {
    if (!currentPharmacyId) {
      setError("ID de pharmacie non disponible");
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      let currenciesToSave = [...config.currencies];
      
      if (config.currencyMode === 'cdf_only') {
        currenciesToSave = currenciesToSave.map(c => ({
          ...c,
          isActive: c.code === 'CDF' || c.code === 'FC'
        }));
        config.primaryCurrency = 'CDF';
      } else if (config.currencyMode === 'usd_only') {
        currenciesToSave = currenciesToSave.map(c => ({
          ...c,
          isActive: c.code === 'USD' || c.code === '$'
        }));
        config.primaryCurrency = 'USD';
      } else {
        currenciesToSave = currenciesToSave.map(c => ({
          ...c,
          isActive: true
        }));
      }
      
      const configToSave = {
        pharmacyInfo: config.pharmacyInfo,
        currencies: currenciesToSave,
        primaryCurrency: config.primaryCurrency,
        currencyMode: config.currencyMode,
        taxRate: config.taxRate,
        lowStockThreshold: config.lowStockThreshold,
        expiryWarningDays: config.expiryWarningDays,
        allowNegativeStock: config.allowNegativeStock,
        workingHours: {
          ...config.workingHours,
          timezone: config.workingHours.timezone || 'Africa/Kinshasa',
        },
        productReturnDays: config.productReturnDays,
        marginConfig: config.marginConfig,
        automaticPricing: config.automaticPricing,
        theme: config.theme,
        initialCapital: config.initialCapital,
        branchConfig: config.branchConfig,
        salesType: config.salesType,
        calcul_auto_prix: config.automaticPricing.enabled,
        marge_par_defaut: config.marginConfig.defaultMargin,
        taux_tva: config.taxRate,
        lock_stock_modification: false,
        
        expiredProducts: config.expiredProducts,
        overtime: config.overtime,
        sellByExchangeRate: config.sellByExchangeRate,
        profitability: config.profitability,
        invoice: config.invoice,
        report: config.report,
        rounding: config.rounding,
      };

      const response = await api.patch(
        `/pharmacies/${currentPharmacyId}/config`,
        configToSave
      );
      
      setConfig(prev => ({
        ...prev,
        ...(response.data.config || {}),
        updatedAt: new Date().toISOString(),
      }));
      
      if (logoFile) {
        await uploadLogo();
      }
      
      setSuccess("Configuration mise à jour avec succès !");
      await checkServiceStatus();
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(err.response?.data?.detail || "Erreur lors de la sauvegarde de la configuration");
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // GESTION DES SUCCURSALES
  // ============================================

  const openBranchConfigPanelHandler = async (branch: Branch) => {
    setSelectedBranch(branch);
    setShowBranchConfigPanel(true);
    await loadBranchResolvedConfig(branch);
  };

  const handleCreateBranch = async () => {
    if (!currentPharmacyId) return;
    if (!branchFormData.name) {
      setError("Le nom de la succursale est requis");
      return;
    }

    try {
      const selectedManager = availableUsers.find(u => u.id === branchFormData.manager_id);
      
      const branchData = {
        name: branchFormData.name.trim(),
        code: branchFormData.code || `${pharmacyData?.name?.substring(0, 3).toUpperCase() || 'BR'}_${Date.now()}`,
        address: branchFormData.address || '',
        city: branchFormData.city || '',
        country: branchFormData.country || 'CD',
        phone: branchFormData.phone || '',
        email: branchFormData.email || '',
        manager_id: branchFormData.manager_id || null,
        manager_name: selectedManager?.nom_complet || null,
        latitude: null,
        longitude: null,
        opening_hours: null,
        config: {
          workingHours: config.workingHours,
          marginConfig: config.marginConfig,
          automaticPricing: config.automaticPricing,
          rounding: config.rounding,
          invoice: config.invoice,
          report: config.report,
          inheritedFromParent: true
        },
        subscription_config: {
          plan: 'essential',
          max_users: 5,
          max_products: 500,
          max_transactions_per_month: 1000,
          features: {
            inventory_management: true,
            sales: true,
            reports: true,
            multi_currency: false,
            pos_integration: false,
            api_access: false
          },
          is_trial: true,
          trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        },
        is_active: true
      };

      const response = await api.post(`/pharmacies/${currentPharmacyId}/branches`, branchData);
      
      setConfig({
        ...config,
        branchConfig: {
          ...config.branchConfig,
          currentBranches: (config.branchConfig.currentBranches || 0) + 1,
          branches: [...(config.branchConfig.branches || []), response.data],
        },
      });
      
      setShowBranchModal(false);
      setBranchFormData({
        name: '',
        code: '',
        address: '',
        city: '',
        country: 'CD',
        phone: '',
        email: '',
        manager_id: '',
      });
      setSuccess("Succursale créée avec succès !");
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Erreur lors de la création de la succursale:', err);
      if (err.response?.data) {
        if (err.response.data.detail) {
          setError(`Erreur: ${JSON.stringify(err.response.data.detail)}`);
        } else {
          setError(`Erreur: ${err.response.data.message || 'Données invalides'}`);
        }
      } else {
        setError(err.message || "Erreur lors de la création de la succursale");
      }
    }
  };

  const handleUpdateBranch = async () => {
    if (!currentPharmacyId || !editingBranch || !branchFormData.name) return;

    try {
      const response = await api.put(`/pharmacies/${currentPharmacyId}/branches/${editingBranch.id}`, {
        name: branchFormData.name,
        address: branchFormData.address,
        city: branchFormData.city,
        country: branchFormData.country,
        phone: branchFormData.phone,
        email: branchFormData.email,
        manager_id: branchFormData.manager_id,
      });
      
      setConfig({
        ...config,
        branchConfig: {
          ...config.branchConfig,
          branches: config.branchConfig.branches.map(b => 
            b.id === editingBranch.id ? response.data : b
          ),
        },
      });
      
      setShowBranchModal(false);
      setEditingBranch(null);
      setSuccess("Succursale mise à jour avec succès !");
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Erreur lors de la mise à jour de la succursale:', err);
      setError(err.response?.data?.detail || "Erreur lors de la mise à jour de la succursale");
    }
  };

  // ============================================
  // GESTION DU LOGO
  // ============================================

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setConfig({
          ...config,
          pharmacyInfo: { ...config.pharmacyInfo, logoUrl: result }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // ============================================
  // RENDU CONDITIONNEL
  // ============================================

  useEffect(() => {
    loadPharmacyData();
  }, [propPharmacyId]);

  // Affichage du loader pendant la résolution de l'ID
  if (resolvingId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-900">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600 dark:text-slate-400">Récupération de votre pharmacie...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-900">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600 dark:text-slate-400">Chargement de la configuration...</p>
      </div>
    );
  }

  if (error && !pharmacyData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md text-center border border-red-100 dark:border-red-900">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Erreur de chargement</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!config.workingHours) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-white dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 max-w-md text-center border border-yellow-100 dark:border-yellow-900">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">Configuration incomplète</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-4">Les données de configuration sont incomplètes. Veuillez rafraîchir la page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
          >
            Rafraîchir
          </button>
        </div>
      </div>
    );
  }

  if (outOfService) {
    return (
      <OutOfService 
        workingHours={config.workingHours}
        message={serviceStatus?.message || "L'application n'est pas disponible en dehors des heures de service."}
        nextServiceTime={serviceStatus?.next_service_time}
      />
    );
  }

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-white dark:bg-slate-900 min-h-screen">
      {/* Modal de création/édition de succursale */}
      {showBranchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                {editingBranch ? 'Modifier la succursale' : 'Nouvelle succursale'}
              </h3>
              <button onClick={() => setShowBranchModal(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nom de la succursale *
                </label>
                <input
                  type="text"
                  value={branchFormData.name}
                  onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: Pharmacie du Centre"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Code
                </label>
                <input
                  type="text"
                  value={branchFormData.code}
                  onChange={(e) => setBranchFormData({ ...branchFormData, code: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Code unique de la succursale"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Adresse
                </label>
                <textarea
                  value={branchFormData.address}
                  onChange={(e) => setBranchFormData({ ...branchFormData, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Adresse complète"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ville
                  </label>
                  <input
                    type="text"
                    value={branchFormData.city}
                    onChange={(e) => setBranchFormData({ ...branchFormData, city: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                    placeholder="Kinshasa"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Pays
                  </label>
                  <select
                    value={branchFormData.country}
                    onChange={(e) => setBranchFormData({ ...branchFormData, country: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                  >
                    <option value="CD">République Démocratique du Congo</option>
                    <option value="CG">Congo-Brazzaville</option>
                    <option value="GA">Gabon</option>
                    <option value="CM">Cameroun</option>
                    <option value="CI">Côte d'Ivoire</option>
                    <option value="SN">Sénégal</option>
                    <option value="FR">France</option>
                    <option value="BE">Belgique</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={branchFormData.phone}
                    onChange={(e) => setBranchFormData({ ...branchFormData, phone: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                    placeholder="+243 XXX XXX XXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={branchFormData.email}
                    onChange={(e) => setBranchFormData({ ...branchFormData, email: e.target.value })}
                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                    placeholder="contact@pharmacie.com"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Responsable
                </label>
                <select
                  value={branchFormData.manager_id || ''}
                  onChange={(e) => setBranchFormData({ ...branchFormData, manager_id: e.target.value || undefined })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                >
                  <option value="">Aucun responsable</option>
                  {availableUsers.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.nom_complet} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBranchModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={editingBranch ? handleUpdateBranch : handleCreateBranch}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                {editingBranch ? 'Mettre à jour' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de configuration avancée de la succursale */}
      {showBranchConfigPanel && selectedBranch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white dark:bg-slate-800 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">
                  Configuration avancée - {selectedBranch.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedBranch.subscription_status === 'active' ? 'bg-green-100 text-green-700' :
                    selectedBranch.subscription_status === 'trial' ? 'bg-yellow-100 text-yellow-700' :
                    selectedBranch.subscription_status === 'expired' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {selectedBranch.subscription_status === 'active' ? 'Abonnement actif' :
                     selectedBranch.subscription_status === 'trial' ? 'Période d\'essai' :
                     selectedBranch.subscription_status === 'expired' ? 'Abonnement expiré' : 'Suspendu'}
                  </span>
                </div>
              </div>
              <button onClick={() => setShowBranchConfigPanel(false)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {loadingBranchConfig ? (
              <div className="flex justify-center py-12">
                <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Configuration résolue (en lecture seule) */}
                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-blue-600" />
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Configuration résolue</h4>
                    <span className="text-xs text-slate-500">(Pharmacie + Surcharges)</span>
                  </div>
                  {branchResolvedConfig && (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-slate-500">Horaires</p>
                        <p className="font-medium">{branchResolvedConfig.working_hours.startTime} - {branchResolvedConfig.working_hours.endTime}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Stock bas</p>
                        <p className="font-medium">{branchResolvedConfig.low_stock_threshold} unités</p>
                      </div>
                      <div>
                        <p className="text-slate-500">TVA</p>
                        <p className="font-medium">{branchResolvedConfig.tax_rate}%</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Type de vente</p>
                        <p className="font-medium">{branchResolvedConfig.sales_type}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Configuration opérationnelle (modifiable) */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-orange-600" />
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300">Surcharges de configuration</h4>
                    </div>
                    <button
                      onClick={() => setEditingOperationalConfig(!editingOperationalConfig)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      {editingOperationalConfig ? 'Annuler' : 'Modifier'}
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {/* Heures de travail */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <label className="font-medium text-slate-700 dark:text-slate-300">Horaires de travail</label>
                        {branchOperationalConfig.workingHours && (
                          <button
                            onClick={() => resetBranchOperationalConfig(selectedBranch.id, 'workingHours')}
                            className="text-xs text-red-500 hover:text-red-700"
                            disabled={!editingOperationalConfig}
                          >
                            Réinitialiser
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="time"
                          value={branchOperationalConfig.workingHours?.startTime || ''}
                          onChange={(e) => setBranchOperationalConfig({
                            ...branchOperationalConfig,
                            workingHours: {
                              ...branchOperationalConfig.workingHours,
                              startTime: e.target.value,
                              endTime: branchOperationalConfig.workingHours?.endTime || '20:00',
                              enabled: true,
                              daysOff: branchOperationalConfig.workingHours?.daysOff || {
                                monday: true, tuesday: true, wednesday: true,
                                thursday: true, friday: true, saturday: true, sunday: false
                              }
                            }
                          })}
                          disabled={!editingOperationalConfig}
                          className="p-2 bg-white dark:bg-slate-600 border rounded-lg disabled:opacity-50"
                          placeholder="Début"
                        />
                        <input
                          type="time"
                          value={branchOperationalConfig.workingHours?.endTime || ''}
                          onChange={(e) => setBranchOperationalConfig({
                            ...branchOperationalConfig,
                            workingHours: {
                              ...branchOperationalConfig.workingHours,
                              endTime: e.target.value,
                              startTime: branchOperationalConfig.workingHours?.startTime || '08:00',
                              enabled: true,
                              daysOff: branchOperationalConfig.workingHours?.daysOff || {
                                monday: true, tuesday: true, wednesday: true,
                                thursday: true, friday: true, saturday: true, sunday: false
                              }
                            }
                          })}
                          disabled={!editingOperationalConfig}
                          className="p-2 bg-white dark:bg-slate-600 border rounded-lg disabled:opacity-50"
                          placeholder="Fin"
                        />
                      </div>
                    </div>

                    {/* Seuils */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-medium text-slate-700 dark:text-slate-300">Stock bas</label>
                          {branchOperationalConfig.lowStockThreshold !== null && (
                            <button
                              onClick={() => resetBranchOperationalConfig(selectedBranch.id, 'lowStockThreshold')}
                              className="text-xs text-red-500 hover:text-red-700"
                              disabled={!editingOperationalConfig}
                            >
                              Réinitialiser
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          value={branchOperationalConfig.lowStockThreshold ?? ''}
                          onChange={(e) => setBranchOperationalConfig({
                            ...branchOperationalConfig,
                            lowStockThreshold: e.target.value ? Number(e.target.value) : null
                          })}
                          disabled={!editingOperationalConfig}
                          className="w-full p-2 bg-white dark:bg-slate-600 border rounded-lg disabled:opacity-50"
                          placeholder="Utiliser pharmacie"
                        />
                      </div>
                      
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-medium text-slate-700 dark:text-slate-300">Alerte expiration (jours)</label>
                          {branchOperationalConfig.expiryWarningDays !== null && (
                            <button
                              onClick={() => resetBranchOperationalConfig(selectedBranch.id, 'expiryWarningDays')}
                              className="text-xs text-red-500 hover:text-red-700"
                              disabled={!editingOperationalConfig}
                            >
                              Réinitialiser
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          value={branchOperationalConfig.expiryWarningDays ?? ''}
                          onChange={(e) => setBranchOperationalConfig({
                            ...branchOperationalConfig,
                            expiryWarningDays: e.target.value ? Number(e.target.value) : null
                          })}
                          disabled={!editingOperationalConfig}
                          className="w-full p-2 bg-white dark:bg-slate-600 border rounded-lg disabled:opacity-50"
                          placeholder="Utiliser pharmacie"
                        />
                      </div>
                    </div>

                    {/* TVA et Type de vente */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-medium text-slate-700 dark:text-slate-300">TVA (%)</label>
                          {branchOperationalConfig.taxRate !== null && (
                            <button
                              onClick={() => resetBranchOperationalConfig(selectedBranch.id, 'taxRate')}
                              className="text-xs text-red-500 hover:text-red-700"
                              disabled={!editingOperationalConfig}
                            >
                              Réinitialiser
                            </button>
                          )}
                        </div>
                        <input
                          type="number"
                          value={branchOperationalConfig.taxRate ?? ''}
                          onChange={(e) => setBranchOperationalConfig({
                            ...branchOperationalConfig,
                            taxRate: e.target.value ? Number(e.target.value) : null
                          })}
                          disabled={!editingOperationalConfig}
                          className="w-full p-2 bg-white dark:bg-slate-600 border rounded-lg disabled:opacity-50"
                          step="0.1"
                          placeholder="Utiliser pharmacie"
                        />
                      </div>
                      
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <label className="font-medium text-slate-700 dark:text-slate-300">Type de vente</label>
                          {branchOperationalConfig.salesType && (
                            <button
                              onClick={() => resetBranchOperationalConfig(selectedBranch.id, 'salesType')}
                              className="text-xs text-red-500 hover:text-red-700"
                              disabled={!editingOperationalConfig}
                            >
                              Réinitialiser
                            </button>
                          )}
                        </div>
                        <select
                          value={branchOperationalConfig.salesType || ''}
                          onChange={(e) => setBranchOperationalConfig({
                            ...branchOperationalConfig,
                            salesType: e.target.value || null
                          })}
                          disabled={!editingOperationalConfig}
                          className="w-full p-2 bg-white dark:bg-slate-600 border rounded-lg disabled:opacity-50"
                        >
                          <option value="">Utiliser pharmacie</option>
                          <option value="wholesale">Gros uniquement</option>
                          <option value="retail">Détail uniquement</option>
                          <option value="both">Gros et détail</option>
                        </select>
                      </div>
                    </div>

                    {/* Stock négatif */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                      <div className="flex justify-between items-center">
                        <div>
                          <label className="font-medium text-slate-700 dark:text-slate-300">Vente stock négatif</label>
                          <p className="text-xs text-slate-500">Autoriser la vente lorsque le stock est insuffisant</p>
                        </div>
                        {branchOperationalConfig.allowNegativeStock !== null && editingOperationalConfig && (
                          <button
                            onClick={() => resetBranchOperationalConfig(selectedBranch.id, 'allowNegativeStock')}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Réinitialiser
                          </button>
                        )}
                      </div>
                      <div className="mt-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={branchOperationalConfig.allowNegativeStock ?? false}
                            onChange={(e) => setBranchOperationalConfig({
                              ...branchOperationalConfig,
                              allowNegativeStock: e.target.checked
                            })}
                            disabled={!editingOperationalConfig}
                          />
                          <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                          <span className="ml-3 text-sm text-slate-600 dark:text-slate-400">
                            {branchOperationalConfig.allowNegativeStock ? 'Autorisé' : 'Non autorisé'}
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Informations d'abonnement */}
                {branchFeatures && (
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-4 h-4 text-green-600" />
                      <h4 className="font-semibold text-slate-700 dark:text-slate-300">Abonnement et limites</h4>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <p className="text-slate-500 text-sm">Plan</p>
                        <p className="font-semibold capitalize">{branchFeatures.features.plan}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <p className="text-slate-500 text-sm">Utilisateurs</p>
                        <p className="font-semibold">
                          {branchFeatures.usage.current_users} / {branchFeatures.usage.max_users === Infinity ? '∞' : branchFeatures.usage.max_users}
                        </p>
                        {!branchFeatures.can_add_user && (
                          <p className="text-xs text-red-500">Limite atteinte</p>
                        )}
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <p className="text-slate-500 text-sm">Produits</p>
                        <p className="font-semibold">
                          {branchFeatures.usage.current_products} / {branchFeatures.usage.max_products === Infinity ? '∞' : branchFeatures.usage.max_products}
                        </p>
                        {!branchFeatures.can_add_product && (
                          <p className="text-xs text-red-500">Limite atteinte</p>
                        )}
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg">
                        <p className="text-slate-500 text-sm">Transactions (mois)</p>
                        <p className="font-semibold">
                          {branchFeatures.usage.current_transactions_this_month} / {branchFeatures.usage.max_transactions_per_month === Infinity ? '∞' : branchFeatures.usage.max_transactions_per_month}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Boutons d'action */}
                {editingOperationalConfig && (
                  <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        updateBranchOperationalConfig(selectedBranch.id, branchOperationalConfig);
                        setEditingOperationalConfig(false);
                      }}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
                    >
                      <Save className="w-4 h-4 inline mr-2" />
                      Sauvegarder les surcharges
                    </button>
                    <button
                      onClick={() => setEditingOperationalConfig(false)}
                      className="px-4 py-2 border border-slate-300 rounded-xl hover:bg-slate-50"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Paramètres - {pharmacyData?.name || config.pharmacyInfo.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 mt-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ID: {currentPharmacyId} • Dernière mise à jour: {new Date(config.updatedAt).toLocaleString()}
            </p>
            {serviceStatus && (
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                serviceStatus.in_service 
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
              }`}>
                {serviceStatus.in_service ? (
                  <CheckCircle className="w-3 h-3" />
                ) : (
                  <XCircle className="w-3 h-3" />
                )}
                <span>{serviceStatus.in_service ? 'En service' : 'Hors service'}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400 dark:text-slate-500">
            <span>Fuseau pharmacie: {config.workingHours.timezone || 'Africa/Kinshasa'}</span>
            <span>•</span>
            <span>Votre fuseau: {browserTimezone} (UTC{browserOffset >= 0 ? '+' : ''}{browserOffset})</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {success && (
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-xl animate-fadeIn">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">{success}</span>
            </div>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {saving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {/* Messages d'erreur */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3 animate-slideIn">
          <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Section Logo */}
      <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center gap-4 flex-wrap">
          {config.pharmacyInfo.logoUrl && (
            <div className="relative">
              <img 
                src={config.pharmacyInfo.logoUrl} 
                alt="Logo" 
                className="w-20 h-20 object-contain rounded-lg border border-slate-200 dark:border-slate-700"
              />
              <button
                onClick={() => {
                  setConfig({
                    ...config,
                    pharmacyInfo: { ...config.pharmacyInfo, logoUrl: undefined }
                  });
                  setLogoFile(null);
                }}
                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
              >
                <X className="w-3 h-3" />
              </button>
              <Edit3 className="w-4 h-4 text-slate-400 absolute bottom-0 right-0" />
            </div>
          )}
          <div className="flex-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                <Upload className="w-4 h-4 inline mr-2" />
                {config.pharmacyInfo.logoUrl ? 'Changer le logo' : 'Télécharger un logo'}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="hidden"
              />
            </label>
            <p className="text-xs text-slate-500 mt-2">Format recommandé: PNG, JPEG (max 2MB)</p>
          </div>
        </div>
      </div>

      {/* Section des paramètres simplifiée - à compléter selon vos besoins */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section informations pharmacie */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-600" />
            Informations de la pharmacie
          </h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm text-slate-500">Nom</label>
              <p className="font-medium">{pharmacyData?.name || config.pharmacyInfo.name}</p>
            </div>
            <div>
              <label className="text-sm text-slate-500">Adresse</label>
              <p className="font-medium">{pharmacyData?.address || config.pharmacyInfo.address}</p>
            </div>
            <div>
              <label className="text-sm text-slate-500">Téléphone</label>
              <p className="font-medium">{pharmacyData?.phone || config.pharmacyInfo.phone}</p>
            </div>
            <div>
              <label className="text-sm text-slate-500">Email</label>
              <p className="font-medium">{pharmacyData?.email || config.pharmacyInfo.email}</p>
            </div>
            <div>
              <label className="text-sm text-slate-500">N° Licence</label>
              <p className="font-medium">{pharmacyData?.license_number || config.pharmacyInfo.licenseNumber}</p>
            </div>
          </div>
        </div>

        {/* Section TVA et taxes */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">TVA et taxes</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Taux de TVA (%)
            </label>
            <input
              type="number"
              value={config.taxRate}
              onChange={(e) => setConfig({ ...config, taxRate: parseFloat(e.target.value) || 0 })}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
              step="0.1"
              min="0"
              max="100"
            />
          </div>
        </div>

        {/* Section stock et alertes */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4">Stock et alertes</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Seuil de stock bas
              </label>
              <input
                type="number"
                value={config.lowStockThreshold}
                onChange={(e) => setConfig({ ...config, lowStockThreshold: parseInt(e.target.value) || 0 })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Jours d'alerte avant expiration
              </label>
              <input
                type="number"
                value={config.expiryWarningDays}
                onChange={(e) => setConfig({ ...config, expiryWarningDays: parseInt(e.target.value) || 0 })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl"
                min="0"
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Autoriser stock négatif
              </label>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.allowNegativeStock}
                  onChange={(e) => setConfig({ ...config, allowNegativeStock: e.target.checked })}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Section succursales */}
        <div className="bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-4 flex items-center justify-between">
            <span>Succursales</span>
            <button
              onClick={() => {
                setEditingBranch(null);
                setBranchFormData({
                  name: '',
                  code: '',
                  address: '',
                  city: '',
                  country: 'CD',
                  phone: '',
                  email: '',
                  manager_id: '',
                });
                setShowBranchModal(true);
              }}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700"
            >
              + Ajouter
            </button>
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {config.branchConfig.branches.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">Aucune succursale</p>
            ) : (
              config.branchConfig.branches.map(branch => (
                <div key={branch.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <div>
                    <p className="font-medium">{branch.name}</p>
                    <p className="text-xs text-slate-500">{branch.address}</p>
                    {branch.is_main_branch && (
                      <span className="text-xs text-blue-600">Principale</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openBranchConfigPanelHandler(branch)}
                      className="text-blue-600 hover:text-blue-800"
                      title="Configuration avancée"
                    >
                      <Settings2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Résumé et validation */}
      <div className="bg-linear-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-6 rounded-2xl border border-blue-100 dark:border-blue-900">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-blue-600 dark:text-blue-400 shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Configuration système - {pharmacyData?.name || config.pharmacyInfo.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Devise principale</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {config.currencyMode === 'cdf_only' ? 'FC (CDF)' : config.currencyMode === 'usd_only' ? '$ (USD)' : `${config.primaryCurrency} (multi-devises)`}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">TVA</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.taxRate}%</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Stock bas</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.lowStockThreshold} unités</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Type de vente</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {config.salesType === 'wholesale' && 'Gros'}
                  {config.salesType === 'retail' && 'Détail'}
                  {config.salesType === 'both' && 'Gros & Détail'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2">
              <div>
                <p className="text-slate-500 dark:text-slate-400">Arrondissement</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">
                  {config.rounding.enabled ? `${config.rounding.precision} (${config.rounding.method === 'nearest' ? 'au plus proche' : config.rounding.method === 'up' ? 'supérieur' : 'inférieur'})` : 'Désactivé'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Vente périmés</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.expiredProducts.allowSale ? 'Autorisée' : 'Interdite'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Rentabilité auto</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.profitability.enabled ? `${config.profitability.rate}%` : 'Désactivée'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Succursales</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.branchConfig.currentBranches} / {config.branchConfig.maxBranches}</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Dernière synchronisation: {new Date().toLocaleString()} • 
              Fuseau pharmacie: {config.workingHours.timezone || 'Africa/Kinshasa'}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center justify-center gap-2 pt-4">
        <AlertTriangle className="w-3 h-3" />
        Configuration propre à la pharmacie {pharmacyData?.name || config.pharmacyInfo.name} • Sauvegardée en base de données
      </div>
    </div>
  );
};

export default ConfigView;