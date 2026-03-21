import { useState, useEffect } from 'react';
import { 
  Settings, 
  DollarSign, 
  Percent, 
  Bell, 
  Save, 
  RefreshCcw,
  ShieldCheck,
  Clock,
  Building2,
  Palette,
  Plus,
  X,
  ToggleLeft,
  ToggleRight,
  CreditCard,
  AlertTriangle,
  MapPin,
  Sun,
  Moon,
  Monitor,
  CheckCircle,
  XCircle,
  Upload,
  Printer,
  FileText,
  Package,
  PackageOpen,
  Clock as ClockIcon,
  TrendingUp,
  Settings2,
  Calendar
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

interface BranchConfig {
  maxBranches: number;
  currentBranches: number;
  branches?: Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    manager?: string;
    created_at: string;
    is_active: boolean;
  }>;
}

type SalesType = 'wholesale' | 'retail' | 'both';

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

interface PharmacyConfig {
  pharmacyId: string;
  pharmacyInfo: PharmacyInfo;
  currencies: CurrencyConfig[];
  primaryCurrency: string;
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
}

interface ConfigViewProps {
  pharmacyId: string;
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
  { code: 'CDF', symbol: 'FC', isActive: true, exchangeRate: 2500 },
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
const DEFAULT_EXPIRED_PRODUCTS: ExpiredProductsConfig = { allowSale: false };
const DEFAULT_OVERTIME: OvertimeConfig = { enabled: false, endTime: '22:00' };
const DEFAULT_SELL_BY_EXCHANGE_RATE = true;
const DEFAULT_PROFITABILITY: ProfitabilityConfig = { enabled: false, rate: 30 };
const DEFAULT_INVOICE: InvoiceConfig = { autoPrint: false, autoSave: true, fontSize: 12 };
const DEFAULT_REPORT: ReportConfig = { defaultFontSize: 12 };

// Fuseaux horaires supportés (alignés avec le backend)
const SUPPORTED_TIMEZONES = [
  { value: 'Africa/Kinshasa', label: 'Africa/Kinshasa (UTC+1)' },
  { value: 'Africa/Lubumbashi', label: 'Africa/Lubumbashi (UTC+2)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (UTC+2)' },
  { value: 'Africa/Lagos', label: 'Africa/Lagos (UTC+1)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1/UTC+2)' },
  { value: 'UTC', label: 'UTC' },
];

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

const ConfigView = ({ pharmacyId }: ConfigViewProps) => {
  // États
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outOfService, setOutOfService] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [pharmacyData, setPharmacyData] = useState<PharmacyResponse | null>(null);
  const [showLocalTimes, setShowLocalTimes] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  
  const { timezone: browserTimezone, offset: browserOffset } = useTimezone();
  
  const [config, setConfig] = useState<PharmacyConfig>({
    pharmacyId: pharmacyId,
    pharmacyInfo: DEFAULT_PHARMACY_INFO,
    currencies: DEFAULT_CURRENCIES,
    primaryCurrency: 'CDF',
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
  });

  const [newCurrency, setNewCurrency] = useState({
    code: '',
    symbol: '',
    exchangeRate: 1,
  });

  // ============================================
  // EFFETS (Thème, chargement des données)
  // ============================================

  // Application du thème
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

  // Écouter les changements de thème système
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

  // Vérification périodique du statut de service
  useEffect(() => {
    checkServiceStatus();
    const interval = setInterval(checkServiceStatus, 60000);
    return () => clearInterval(interval);
  }, [pharmacyId]);

  // ============================================
  // FONCTIONS UTILITAIRES
  // ============================================

  const displayLocalTime = (timeStr: string): string => {
    if (!timeStr || !showLocalTimes) return timeStr;
    const [hours, minutes] = timeStr.split(':').map(Number);
    // Calcul simplifié - dans une vraie implémentation, utilisez une bibliothèque comme date-fns-tz
    const pharmacyOffset = 1; // À adapter selon le fuseau
    const browserHour = hours - pharmacyOffset + browserOffset;
    let adjustedHour = browserHour;
    if (adjustedHour < 0) adjustedHour += 24;
    if (adjustedHour >= 24) adjustedHour -= 24;
    return `${adjustedHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const mergeConfigWithDefaults = (loadedConfig: any): PharmacyConfig => {
    return {
      pharmacyId: pharmacyId,
      pharmacyInfo: {
        ...DEFAULT_PHARMACY_INFO,
        ...(loadedConfig?.pharmacyInfo || {})
      },
      currencies: Array.isArray(loadedConfig?.currencies) && loadedConfig.currencies.length > 0 
        ? loadedConfig.currencies 
        : DEFAULT_CURRENCIES,
      primaryCurrency: loadedConfig?.primaryCurrency || 'CDF',
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
    };
  };

  // ============================================
  // REQUÊTES API
  // ============================================

  const loadPharmacyData = async () => {
    if (!pharmacyId) {
      setError("ID de pharmacie non fourni");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const pharmacyResponse = await api.get<PharmacyResponse>(`/pharmacies/${pharmacyId}`);
      setPharmacyData(pharmacyResponse.data);
      
      const configResponse = await api.get<{ config: PharmacyConfig }>(`/pharmacies/${pharmacyId}/config`);
      
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
      
      if (mergedConfig.pharmacyInfo.logoUrl) {
        setLogoPreview(mergedConfig.pharmacyInfo.logoUrl);
      }
      
      await checkServiceStatus();
      
    } catch (err: any) {
      console.error('Erreur lors du chargement:', err);
      setError(err.response?.data?.detail || "Erreur lors du chargement de la configuration");
    } finally {
      setLoading(false);
    }
  };

  const checkServiceStatus = async () => {
    try {
      const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
      setServiceStatus(response.data);
      setOutOfService(!response.data.in_service);
    } catch (err) {
      console.error('Erreur lors de la vérification du service:', err);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return;
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const response = await api.post(`/pharmacies/${pharmacyId}/logo`, formData);
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
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const configToSave = {
        pharmacyInfo: config.pharmacyInfo,
        currencies: config.currencies,
        primaryCurrency: config.primaryCurrency,
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
        salesType: { type: config.salesType },
        expiredProducts: config.expiredProducts,
        overtime: config.overtime,
        sellByExchangeRate: config.sellByExchangeRate,
        profitability: config.profitability,
        invoice: config.invoice,
        report: config.report,
      };

      const response = await api.patch(
        `/pharmacies/${pharmacyId}/config`,
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
  // GESTION DES DEVISES
  // ============================================

  const addCurrency = async () => {
    if (newCurrency.code && newCurrency.symbol) {
      const updatedCurrencies = [...config.currencies, { ...newCurrency, isActive: true }];
      setConfig({ ...config, currencies: updatedCurrencies });
      
      try {
        await api.patch(`/pharmacies/${pharmacyId}/config/currencies`, updatedCurrencies);
        setNewCurrency({ code: '', symbol: '', exchangeRate: 1 });
      } catch (err) {
        console.error('Erreur lors de l\'ajout de la devise:', err);
        setConfig(prev => ({ ...prev, currencies: prev.currencies }));
      }
    }
  };

  const removeCurrency = async (index: number) => {
    const updatedCurrencies = config.currencies.filter((_, i) => i !== index);
    const previousCurrencies = config.currencies;
    setConfig({ ...config, currencies: updatedCurrencies });
    
    try {
      await api.patch(`/pharmacies/${pharmacyId}/config/currencies`, updatedCurrencies);
    } catch (err) {
      console.error('Erreur lors de la suppression de la devise:', err);
      setConfig({ ...config, currencies: previousCurrencies });
    }
  };

  const toggleCurrencyActive = async (index: number) => {
    const updatedCurrencies = [...config.currencies];
    updatedCurrencies[index].isActive = !updatedCurrencies[index].isActive;
    const previousCurrencies = config.currencies;
    setConfig({ ...config, currencies: updatedCurrencies });
    
    try {
      await api.patch(`/pharmacies/${pharmacyId}/config/currencies`, updatedCurrencies);
    } catch (err) {
      console.error('Erreur lors de la mise à jour de la devise:', err);
      setConfig({ ...config, currencies: previousCurrencies });
    }
  };

  const updateExchangeRate = async (index: number, rate: number) => {
    const updatedCurrencies = [...config.currencies];
    updatedCurrencies[index].exchangeRate = rate;
    const previousCurrencies = config.currencies;
    setConfig({ ...config, currencies: updatedCurrencies });
    
    try {
      await api.patch(`/pharmacies/${pharmacyId}/config/currencies`, updatedCurrencies);
    } catch (err) {
      console.error('Erreur lors de la mise à jour du taux:', err);
      setConfig({ ...config, currencies: previousCurrencies });
    }
  };

  // ============================================
  // GESTION DES SUCCURSALES
  // ============================================

  const handleAddBranch = async () => {
    try {
      const response = await api.post(`/pharmacies/${pharmacyId}/branches`, {
        name: `Succursale ${config.branchConfig.currentBranches + 1}`,
        address: "",
        phone: "",
        email: "",
      });
      
      setConfig({
        ...config,
        branchConfig: {
          ...config.branchConfig,
          currentBranches: response.data.current_branches,
          branches: [...(config.branchConfig.branches || []), response.data.branch],
        },
      });
      
    } catch (err: any) {
      setError(err.response?.data?.detail || "Erreur lors de la création de la succursale");
    }
  };

  // ============================================
  // GESTION DES JOURS OUVRABLES
  // ============================================

  const toggleWorkingDay = (day: keyof typeof config.workingHours.daysOff) => {
    setConfig({
      ...config,
      workingHours: {
        ...config.workingHours,
        daysOff: {
          ...config.workingHours.daysOff,
          [day]: !config.workingHours.daysOff[day]
        }
      }
    });
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
        setLogoPreview(result);
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
  }, [pharmacyId]);

  useEffect(() => {
    console.log('Fuseau navigateur:', browserTimezone, 'Offset:', browserOffset);
  }, [browserTimezone, browserOffset]);

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
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Paramètres - {pharmacyData?.name || config.pharmacyInfo.name}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              ID: {pharmacyId} • Dernière mise à jour: {new Date(config.updatedAt).toLocaleString()}
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
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">Fuseau pharmacie: {config.workingHours.timezone || 'Africa/Kinshasa'}</span>
            <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">Votre fuseau: {browserTimezone} (UTC{browserOffset >= 0 ? '+' : ''}{browserOffset})</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLocalTimes(!showLocalTimes)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              showLocalTimes 
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            {showLocalTimes ? 'Heures locales' : 'Heures pharmacie'}
          </button>
          
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

      {/* Grille des paramètres */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations de la pharmacie avec logo */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Informations de la Pharmacie</h2>
          </div>
          
          <div className="flex gap-6 flex-wrap">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-slate-200 dark:border-slate-600">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                )}
              </div>
              <label className="mt-2 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                />
                <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800">
                  <Upload className="w-3 h-3" />
                  <span>Changer le logo</span>
                </div>
              </label>
            </div>
            
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                value={config.pharmacyInfo.name}
                onChange={(e) => setConfig({
                  ...config,
                  pharmacyInfo: { ...config.pharmacyInfo, name: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Nom de la pharmacie"
              />
              <input
                type="text"
                value={config.pharmacyInfo.phone}
                onChange={(e) => setConfig({
                  ...config,
                  pharmacyInfo: { ...config.pharmacyInfo, phone: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Téléphone"
              />
              <input
                type="email"
                value={config.pharmacyInfo.email}
                onChange={(e) => setConfig({
                  ...config,
                  pharmacyInfo: { ...config.pharmacyInfo, email: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Email"
              />
              <input
                type="text"
                value={config.pharmacyInfo.licenseNumber}
                onChange={(e) => setConfig({
                  ...config,
                  pharmacyInfo: { ...config.pharmacyInfo, licenseNumber: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Numéro de licence"
              />
              <textarea
                value={config.pharmacyInfo.address}
                onChange={(e) => setConfig({
                  ...config,
                  pharmacyInfo: { ...config.pharmacyInfo, address: e.target.value }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl md:col-span-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Adresse"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Jours ouvrables */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Jours ouvrables</h2>
          </div>
          
          <div className="grid grid-cols-7 gap-2">
            {Object.entries(config.workingHours.daysOff).map(([day, isWorking]) => {
              const dayShort: Record<string, string> = {
                monday: 'Lun',
                tuesday: 'Mar',
                wednesday: 'Mer',
                thursday: 'Jeu',
                friday: 'Ven',
                saturday: 'Sam',
                sunday: 'Dim'
              };
              
              return (
                <button
                  key={day}
                  onClick={() => toggleWorkingDay(day as keyof typeof config.workingHours.daysOff)}
                  className={`p-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                    isWorking
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-500 dark:ring-emerald-600'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  <span className="text-sm font-medium">{dayShort[day]}</span>
                  <span className="text-xs">{isWorking ? 'Ouvert' : 'Fermé'}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            Cliquez sur un jour pour activer/désactiver l'ouverture
          </p>
        </div>

        {/* Type de vente */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Type de vente</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setConfig({...config, salesType: 'wholesale'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.salesType === 'wholesale' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 ring-2 ring-purple-500' 
                  : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              <PackageOpen className="w-6 h-6" />
              <span className="text-sm font-medium">Gros uniquement</span>
            </button>
            <button
              onClick={() => setConfig({...config, salesType: 'retail'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.salesType === 'retail' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 ring-2 ring-purple-500' 
                  : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Package className="w-6 h-6" />
              <span className="text-sm font-medium">Détail uniquement</span>
            </button>
            <button
              onClick={() => setConfig({...config, salesType: 'both'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.salesType === 'both' 
                  ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 ring-2 ring-purple-500' 
                  : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Package className="w-6 h-6" />
              <PackageOpen className="w-6 h-6 -mt-3" />
              <span className="text-sm font-medium">Gros et Détail</span>
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {config.salesType === 'wholesale' && "Seule la vente en gros est autorisée"}
            {config.salesType === 'retail' && "Seule la vente au détail est autorisée"}
            {config.salesType === 'both' && "Les ventes en gros et au détail sont autorisées"}
          </p>
        </div>

        {/* Produits périmés */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Produits périmés</h2>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Autoriser la vente de produits périmés</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {config.expiredProducts.allowSale 
                  ? "⚠️ Attention: Les produits périmés peuvent être vendus" 
                  : "✓ Les produits périmés ne peuvent pas être vendus"}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.expiredProducts.allowSale}
                onChange={(e) => setConfig({
                  ...config,
                  expiredProducts: { ...config.expiredProducts, allowSale: e.target.checked }
                })}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>
        </div>

        {/* Heures supplémentaires */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <ClockIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Heures supplémentaires</h2>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Activer les heures supplémentaires</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.overtime.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  overtime: { ...config.overtime, enabled: e.target.checked }
                })}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
            </label>
          </div>
          
          {config.overtime.enabled && (
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Heure de fin des heures supplémentaires
                {showLocalTimes && <span className="text-xs text-blue-600 ml-1">(locale)</span>}
              </label>
              <input
                type="time"
                value={showLocalTimes ? displayLocalTime(config.overtime.endTime) : config.overtime.endTime}
                onChange={(e) => {
                  if (showLocalTimes) return;
                  setConfig({
                    ...config,
                    overtime: { ...config.overtime, endTime: e.target.value }
                  });
                }}
                className={`w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200 ${
                  showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={showLocalTimes}
              />
            </div>
          )}
        </div>

        {/* Vente selon taux */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Vente selon taux de change</h2>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Activer la vente selon le taux de change</span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {config.sellByExchangeRate 
                  ? "Les prix seront convertis selon les taux définis" 
                  : "Seule la devise principale sera utilisée"}
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.sellByExchangeRate}
                onChange={(e) => setConfig({...config, sellByExchangeRate: e.target.checked})}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
            </label>
          </div>
        </div>

        {/* Rentabilité / Calcul automatique */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Settings2 className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Calcul automatique du prix de vente</h2>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Activer le calcul automatique</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.profitability.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  profitability: { ...config.profitability, enabled: e.target.checked }
                })}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
            </label>
          </div>
          
          {config.profitability.enabled && (
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">
                Taux de rentabilité (%)
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
                  (ex: 30% = prix achat × 1.3)
                </span>
              </label>
              <input
                type="number"
                value={config.profitability.rate}
                onChange={(e) => setConfig({
                  ...config,
                  profitability: { ...config.profitability, rate: Number(e.target.value) }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                step="0.5"
                min="0"
                max="500"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Prix de vente = Prix d'achat × (1 + {config.profitability.rate / 100})
              </p>
            </div>
          )}
        </div>

        {/* Facturation */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Printer className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Configuration de la facturation</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Impression automatique après vente</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.invoice.autoPrint}
                  onChange={(e) => setConfig({
                    ...config,
                    invoice: { ...config.invoice, autoPrint: e.target.checked }
                  })}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Sauvegarde automatique des factures</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.invoice.autoSave}
                  onChange={(e) => setConfig({
                    ...config,
                    invoice: { ...config.invoice, autoSave: e.target.checked }
                  })}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Taille de police pour la facture (px)</label>
              <input
                type="number"
                value={config.invoice.fontSize}
                onChange={(e) => setConfig({
                  ...config,
                  invoice: { ...config.invoice, fontSize: Number(e.target.value) }
                })}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                min="8"
                max="24"
              />
            </div>
          </div>
        </div>

        {/* Rapports */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Configuration des rapports</h2>
          </div>
          
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">Taille de police par défaut pour les documents (px)</label>
            <input
              type="number"
              value={config.report.defaultFontSize}
              onChange={(e) => setConfig({
                ...config,
                report: { ...config.report, defaultFontSize: Number(e.target.value) }
              })}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
              min="8"
              max="24"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Cette taille s'appliquera à tous les rapports et documents
            </p>
          </div>
        </div>

        {/* Devises & Taux de change */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Devises & Taux de change</h2>
          </div>
          
          <div className="space-y-4">
            <select
              value={config.primaryCurrency}
              onChange={(e) => setConfig({...config, primaryCurrency: e.target.value})}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
            >
              {config.currencies.filter(c => c.isActive).map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {config.currencies.map((currency, index) => (
                <div key={currency.code} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700 rounded-xl">
                  <button
                    onClick={() => toggleCurrencyActive(index)}
                    className="text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
                  >
                    {currency.isActive ? <ToggleRight className="w-6 h-6 text-green-600" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <span className="font-medium w-16 text-slate-700 dark:text-slate-300">{currency.code}</span>
                  <input
                    type="number"
                    value={currency.exchangeRate}
                    onChange={(e) => updateExchangeRate(index, Number(e.target.value))}
                    className="flex-1 p-1.5 bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                    placeholder="Taux"
                    disabled={currency.code === 'USD'}
                    step="0.01"
                  />
                  {config.currencies.length > 2 && (
                    <button
                      onClick={() => removeCurrency(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newCurrency.code}
                onChange={(e) => setNewCurrency({...newCurrency, code: e.target.value.toUpperCase()})}
                className="flex-1 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Code (ex: EUR)"
                maxLength={3}
              />
              <input
                type="text"
                value={newCurrency.symbol}
                onChange={(e) => setNewCurrency({...newCurrency, symbol: e.target.value})}
                className="w-20 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Symb."
              />
              <input
                type="number"
                value={newCurrency.exchangeRate}
                onChange={(e) => setNewCurrency({...newCurrency, exchangeRate: Number(e.target.value)})}
                className="w-24 p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="Taux"
                step="0.01"
              />
              <button
                onClick={addCurrency}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all"
                disabled={!newCurrency.code || !newCurrency.symbol}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Fiscalité & Stock */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Fiscalité & Stock</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Taux de TVA (%)</label>
              <input
                type="number"
                value={config.taxRate}
                onChange={(e) => setConfig({...config, taxRate: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                step="0.1"
                min="0"
                max="100"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Vente stock négatif</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.allowNegativeStock}
                  onChange={(e) => setConfig({...config, allowNegativeStock: e.target.checked})}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Capital initial (USD)</label>
              <input
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig({...config, initialCapital: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Configuration des prix */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Configuration des prix</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Calcul automatique</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.automaticPricing.enabled}
                  onChange={(e) => setConfig({
                    ...config,
                    automaticPricing: { ...config.automaticPricing, enabled: e.target.checked }
                  })}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {config.automaticPricing.enabled && (
              <>
                <select
                  value={config.automaticPricing.method}
                  onChange={(e) => setConfig({
                    ...config,
                    automaticPricing: { ...config.automaticPricing, method: e.target.value as any }
                  })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                >
                  <option value="percentage">Pourcentage (%)</option>
                  <option value="coefficient">Coefficient multiplicateur</option>
                  <option value="margin">Marge bénéficiaire</option>
                </select>

                <input
                  type="number"
                  value={config.automaticPricing.value}
                  onChange={(e) => setConfig({
                    ...config,
                    automaticPricing: { ...config.automaticPricing, value: Number(e.target.value) }
                  })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                  placeholder={
                    config.automaticPricing.method === 'percentage' ? 'Pourcentage (%)' :
                    config.automaticPricing.method === 'coefficient' ? 'Coefficient (ex: 1.3)' : 'Marge (%)'
                  }
                  step="0.01"
                  min="0"
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400">Marge par défaut (%)</label>
                <input
                  type="number"
                  value={config.marginConfig.defaultMargin}
                  onChange={(e) => setConfig({
                    ...config,
                    marginConfig: { ...config.marginConfig, defaultMargin: Number(e.target.value) }
                  })}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                  step="0.1"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600 dark:text-slate-400">Marge min/max (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config.marginConfig.minMargin}
                    onChange={(e) => setConfig({
                      ...config,
                      marginConfig: { ...config.marginConfig, minMargin: Number(e.target.value) }
                    })}
                    className="w-1/2 p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                    placeholder="Min"
                    step="0.1"
                    min="0"
                  />
                  <input
                    type="number"
                    value={config.marginConfig.maxMargin}
                    onChange={(e) => setConfig({
                      ...config,
                      marginConfig: { ...config.marginConfig, maxMargin: Number(e.target.value) }
                    })}
                    className="w-1/2 p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                    placeholder="Max"
                    step="0.1"
                    max="100"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Seuils d'alertes */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Seuils d'alertes</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Stock bas (quantité)</label>
              <input
                type="number"
                value={config.lowStockThreshold}
                onChange={(e) => setConfig({...config, lowStockThreshold: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-400">Expiration (jours)</label>
              <input
                type="number"
                value={config.expiryWarningDays}
                onChange={(e) => setConfig({...config, expiryWarningDays: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-400">Délai de retour produit (jours)</label>
            <input
              type="number"
              value={config.productReturnDays}
              onChange={(e) => setConfig({...config, productReturnDays: Number(e.target.value)})}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200"
              min="0"
              max="365"
            />
          </div>
        </div>

        {/* Heures de service */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Heures de service</h2>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Activer les heures de service</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={config.workingHours.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  workingHours: { ...config.workingHours, enabled: e.target.checked }
                })}
              />
              <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {config.workingHours.enabled && (
            <>
              <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                <span className="text-xs text-blue-700 dark:text-blue-400">
                  {showLocalTimes ? (
                    <>Heures affichées dans votre fuseau ({browserTimezone})</>
                  ) : (
                    <>Heures stockées en {config.workingHours.timezone || 'Africa/Kinshasa'}</>
                  )}
                </span>
                <button
                  onClick={() => setShowLocalTimes(!showLocalTimes)}
                  className="text-xs text-blue-600 dark:text-blue-400 underline ml-auto"
                >
                  {showLocalTimes ? 'Voir heures pharmacie' : 'Voir mes heures locales'}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Heure début {showLocalTimes && <span className="text-xs text-blue-600">(locale)</span>}
                  </label>
                  <input
                    type="time"
                    value={showLocalTimes ? displayLocalTime(config.workingHours.startTime) : config.workingHours.startTime}
                    onChange={(e) => {
                      if (showLocalTimes) return;
                      setConfig({
                        ...config,
                        workingHours: { ...config.workingHours, startTime: e.target.value }
                      });
                    }}
                    className={`w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200 ${
                      showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={showLocalTimes}
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400">
                    Heure fin {showLocalTimes && <span className="text-xs text-blue-600">(locale)</span>}
                  </label>
                  <input
                    type="time"
                    value={showLocalTimes ? displayLocalTime(config.workingHours.endTime) : config.workingHours.endTime}
                    onChange={(e) => {
                      if (showLocalTimes) return;
                      setConfig({
                        ...config,
                        workingHours: { ...config.workingHours, endTime: e.target.value }
                      });
                    }}
                    className={`w-full p-2.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-800 dark:text-slate-200 ${
                      showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={showLocalTimes}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <span className="text-xs text-slate-600 dark:text-slate-400">Fuseau horaire:</span>
                <select
                  value={config.workingHours.timezone || 'Africa/Kinshasa'}
                  onChange={(e) => setConfig({
                    ...config,
                    workingHours: { ...config.workingHours, timezone: e.target.value }
                  })}
                  className="flex-1 p-1 text-xs bg-white dark:bg-slate-600 border border-slate-200 dark:border-slate-500 rounded-lg text-slate-800 dark:text-slate-200"
                  disabled={showLocalTimes}
                >
                  {SUPPORTED_TIMEZONES.map(tz => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Configuration des branches/succursales */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Succursales</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">Succursales actives</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {config.branchConfig.currentBranches} / {config.branchConfig.maxBranches}
                </p>
              </div>
              <div className="w-20 h-2 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-600 rounded-full transition-all"
                  style={{ width: `${(config.branchConfig.currentBranches / config.branchConfig.maxBranches) * 100}%` }}
                />
              </div>
            </div>

            {config.branchConfig.branches && config.branchConfig.branches.length > 0 && (
              <div className="space-y-2">
                {config.branchConfig.branches.map((branch) => (
                  <div key={branch.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{branch.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{branch.address}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{branch.phone}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        branch.is_active ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                      }`}>
                        {branch.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {config.branchConfig.currentBranches < config.branchConfig.maxBranches && (
              <button
                onClick={handleAddBranch}
                className="w-full p-3 border-2 border-dashed border-orange-200 dark:border-orange-800 rounded-xl text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
              >
                <Plus className="w-5 h-5 mx-auto" />
                <span className="text-sm">Ajouter une succursale</span>
              </button>
            )}
          </div>
        </div>

        {/* Thème */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            <h2 className="font-bold text-slate-700 dark:text-slate-300">Thème</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setConfig({...config, theme: 'light'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.theme === 'light' 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ring-2 ring-blue-500' 
                  : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Sun className="w-5 h-5" />
              <span className="text-xs">Clair</span>
            </button>
            <button
              onClick={() => setConfig({...config, theme: 'dark'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.theme === 'dark' 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ring-2 ring-blue-500' 
                  : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-xs">Sombre</span>
            </button>
            <button
              onClick={() => setConfig({...config, theme: 'system'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.theme === 'system' 
                  ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 ring-2 ring-blue-500' 
                  : 'bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span className="text-xs">Système</span>
            </button>
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
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.primaryCurrency}</p>
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
                <p className="text-slate-500 dark:text-slate-400">Vente périmés</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.expiredProducts.allowSale ? 'Autorisée' : 'Interdite'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Rentabilité auto</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.profitability.enabled ? `${config.profitability.rate}%` : 'Désactivée'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Impression auto</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.invoice.autoPrint ? 'Active' : 'Inactive'}</p>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400">Police facture</p>
                <p className="font-medium text-slate-700 dark:text-slate-300">{config.invoice.fontSize}px</p>
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