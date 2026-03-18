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
  XCircle
} from 'lucide-react';
import api from '@/api/client';
import OutOfService from './endehors';
import { useTimezone } from '@/hooks/useTimezone';

// Types pour les réponses API
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
}

interface WorkingHours {
  enabled: boolean;
  startTime: string; // Stocké en heure locale (Africa/Kinshasa)
  endTime: string;   // Stocké en heure locale
  overtimeEndTime?: string; // Stocké en heure locale
  timezone?: string; // Fuseau horaire de la pharmacie (par défaut: Africa/Kinshasa)
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

// Valeurs par défaut complètes
const DEFAULT_WORKING_HOURS: WorkingHours = {
  enabled: true,
  startTime: '08:00', // Heure locale (Africa/Kinshasa)
  endTime: '20:00',   // Heure locale
  overtimeEndTime: '22:00', // Heure locale
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
};

const ConfigView = ({ pharmacyId }: ConfigViewProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [outOfService, setOutOfService] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [pharmacyData, setPharmacyData] = useState<PharmacyResponse | null>(null);
  const [showLocalTimes, setShowLocalTimes] = useState(false);
  
  const { timezone: browserTimezone, offset: browserOffset } = useTimezone();
  useEffect(() => {
    console.log('Fuseau navigateur:', browserTimezone, 'Offset:', browserOffset);
  }, [browserTimezone, browserOffset]);
  
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
  });

  const [newCurrency, setNewCurrency] = useState({
    code: '',
    symbol: '',
    exchangeRate: 1,
  });

  // Fonction utilitaire pour fusionner les configurations avec les valeurs par défaut
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
    };
  };

  // Afficher une heure locale à partir de l'heure stockée (locale pharmacie)
  const displayLocalTime = (timeStr: string): string => {
    if (!timeStr || !showLocalTimes) return timeStr;
    // Convertir l'heure stockée (locale pharmacie) vers l'heure du navigateur
    // Note: On suppose que l'heure stockée est en Africa/Kinshasa (UTC+1)
    // Pour une conversion précise, il faudrait connaître le fuseau exact de la pharmacie
    const [hours, minutes] = timeStr.split(':').map(Number);
    const pharmacyOffset = 1; // Africa/Kinshasa est UTC+1
    const browserHour = hours - pharmacyOffset + browserOffset;
    
    // Gérer les jours
    let adjustedHour = browserHour;
    if (adjustedHour < 0) adjustedHour += 24;
    if (adjustedHour >= 24) adjustedHour -= 24;
    
    return `${adjustedHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Charger les données de la pharmacie et la configuration
  useEffect(() => {
    const loadPharmacyData = async () => {
      if (!pharmacyId) {
        setError("ID de pharmacie non fourni");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      
      try {
        // Charger les informations de la pharmacie
        const pharmacyResponse = await api.get<PharmacyResponse>(`/pharmacies/${pharmacyId}`);
        setPharmacyData(pharmacyResponse.data);
        
        // Charger la configuration
        const configResponse = await api.get<{ config: PharmacyConfig }>(`/pharmacies/${pharmacyId}/config`);
        
        // Fusionner la config avec les infos de base et les valeurs par défaut
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
        
        // Vérifier le statut du service
        await checkServiceStatus();
        
      } catch (err: any) {
        console.error('Erreur lors du chargement:', err);
        setError(err.response?.data?.detail || "Erreur lors du chargement de la configuration");
      } finally {
        setLoading(false);
      }
    };

    loadPharmacyData();
  }, [pharmacyId]);

  // Vérifier le statut du service
  const checkServiceStatus = async () => {
    try {
      const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
      setServiceStatus(response.data);
      setOutOfService(!response.data.in_service);
    } catch (err) {
      console.error('Erreur lors de la vérification du service:', err);
    }
  };

  // Rafraîchir le statut toutes les minutes
  useEffect(() => {
    checkServiceStatus();
    const interval = setInterval(checkServiceStatus, 60000);
    return () => clearInterval(interval);
  }, [pharmacyId]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Préparer les données à sauvegarder
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
          timezone: config.workingHours.timezone || 'Africa/Kinshasa'
        },
        productReturnDays: config.productReturnDays,
        marginConfig: config.marginConfig,
        automaticPricing: config.automaticPricing,
        theme: config.theme,
        initialCapital: config.initialCapital,
        branchConfig: config.branchConfig,
      };

      // Envoyer la configuration
      const response = await api.patch(
        `/pharmacies/${pharmacyId}/config`,
        configToSave
      );
      
      setConfig(prev => ({
        ...prev,
        ...(response.data.config || {}),
        updatedAt: new Date().toISOString(),
      }));
      
      setSuccess("Configuration mise à jour avec succès !");
      
      // Re-vérifier le statut du service après mise à jour
      await checkServiceStatus();
      
      // Effacer le message après 3 secondes
      setTimeout(() => setSuccess(null), 3000);
      
    } catch (err: any) {
      console.error('Erreur lors de la sauvegarde:', err);
      setError(err.response?.data?.detail || "Erreur lors de la sauvegarde de la configuration");
    } finally {
      setSaving(false);
    }
  };

  const addCurrency = async () => {
    if (newCurrency.code && newCurrency.symbol) {
      const updatedCurrencies = [...config.currencies, { ...newCurrency, isActive: true }];
      setConfig({ ...config, currencies: updatedCurrencies });
      
      try {
        await api.patch(`/pharmacies/${pharmacyId}/config/currencies`, updatedCurrencies);
        setNewCurrency({ code: '', symbol: '', exchangeRate: 1 });
      } catch (err) {
        console.error('Erreur lors de l\'ajout de la devise:', err);
        // Revenir à l'état précédent en cas d'erreur
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

  // Affichage du chargement
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600">Chargement de la configuration...</p>
      </div>
    );
  }

  // Affichage des erreurs critiques
  if (error && !pharmacyData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-red-100">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-600 mb-2">Erreur de chargement</h2>
          <p className="text-slate-600 mb-4">{error}</p>
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

  // Vérification de l'intégrité des données
  if (!config.workingHours) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-yellow-100">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-yellow-600 mb-2">Configuration incomplète</h2>
          <p className="text-slate-600 mb-4">Les données de configuration sont incomplètes. Veuillez rafraîchir la page.</p>
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

  // Affichage du mode hors service avec le composant dédié
  if (outOfService) {
    return (
      <OutOfService 
        workingHours={config.workingHours}
        message={serviceStatus?.message || "L'application n'est pas disponible en dehors des heures de service."}
        nextServiceTime={serviceStatus?.next_service_time}
      />
    );
  }

  // Rendu principal de la configuration
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* En-tête avec indicateur de pharmacie */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Paramètres - {pharmacyData?.name || config.pharmacyInfo.name}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-sm text-slate-500">
              ID: {pharmacyId} • Dernière mise à jour: {new Date(config.updatedAt).toLocaleString()}
            </p>
            {serviceStatus && (
              <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                serviceStatus.in_service 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
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
            <span className="text-xs text-slate-400">Fuseau pharmacie: {config.workingHours.timezone || 'Africa/Kinshasa'}</span>
            <span className="text-xs text-slate-300">|</span>
            <span className="text-xs text-slate-400">Votre fuseau: {browserTimezone} (UTC{browserOffset >= 0 ? '+' : ''}{browserOffset})</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLocalTimes(!showLocalTimes)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              showLocalTimes 
                ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" />
            {showLocalTimes ? 'Heures locales' : 'Heures pharmacie'}
          </button>
          
          {success && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-2 rounded-xl animate-fadeIn">
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 animate-slideIn">
          <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-600 hover:text-red-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations de la pharmacie */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-700">Informations de la Pharmacie</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              value={config.pharmacyInfo.name}
              onChange={(e) => setConfig({
                ...config,
                pharmacyInfo: { ...config.pharmacyInfo, name: e.target.value }
              })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Nom de la pharmacie"
            />
            <input
              type="text"
              value={config.pharmacyInfo.phone}
              onChange={(e) => setConfig({
                ...config,
                pharmacyInfo: { ...config.pharmacyInfo, phone: e.target.value }
              })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Téléphone"
            />
            <input
              type="email"
              value={config.pharmacyInfo.email}
              onChange={(e) => setConfig({
                ...config,
                pharmacyInfo: { ...config.pharmacyInfo, email: e.target.value }
              })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Email"
            />
            <input
              type="text"
              value={config.pharmacyInfo.licenseNumber}
              onChange={(e) => setConfig({
                ...config,
                pharmacyInfo: { ...config.pharmacyInfo, licenseNumber: e.target.value }
              })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Numéro de licence"
            />
            <textarea
              value={config.pharmacyInfo.address}
              onChange={(e) => setConfig({
                ...config,
                pharmacyInfo: { ...config.pharmacyInfo, address: e.target.value }
              })}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl md:col-span-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Adresse"
              rows={2}
            />
          </div>
        </div>

        {/* Devises & Taux de change */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-slate-700">Devises & Taux de change</h2>
          </div>
          
          <div className="space-y-4">
            <select
              value={config.primaryCurrency}
              onChange={(e) => setConfig({...config, primaryCurrency: e.target.value})}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              {config.currencies.filter(c => c.isActive).map(c => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {config.currencies.map((currency, index) => (
                <div key={currency.code} className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl">
                  <button
                    onClick={() => toggleCurrencyActive(index)}
                    className="text-slate-500 hover:text-blue-600 transition-colors"
                  >
                    {currency.isActive ? <ToggleRight className="w-6 h-6 text-green-600" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                  <span className="font-medium w-16">{currency.code}</span>
                  <input
                    type="number"
                    value={currency.exchangeRate}
                    onChange={(e) => updateExchangeRate(index, Number(e.target.value))}
                    className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Code (ex: EUR)"
                maxLength={3}
              />
              <input
                type="text"
                value={newCurrency.symbol}
                onChange={(e) => setNewCurrency({...newCurrency, symbol: e.target.value})}
                className="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Symb."
              />
              <input
                type="number"
                value={newCurrency.exchangeRate}
                onChange={(e) => setNewCurrency({...newCurrency, exchangeRate: Number(e.target.value)})}
                className="w-24 p-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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

            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
              <CreditCard className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-700">
                Activer la vente selon le taux de change
              </span>
              <label className="relative inline-flex items-center cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={true}
                  onChange={() => {}}
                  disabled
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Fiscalité & Stock */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-700">Fiscalité & Stock</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600">Taux de TVA (%)</label>
              <input
                type="number"
                value={config.taxRate}
                onChange={(e) => setConfig({...config, taxRate: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                step="0.1"
                min="0"
                max="100"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-semibold">Vente stock négatif</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.allowNegativeStock}
                  onChange={(e) => setConfig({...config, allowNegativeStock: e.target.checked})}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="text-sm text-slate-600">Capital initial (USD)</label>
              <input
                type="number"
                value={config.initialCapital}
                onChange={(e) => setConfig({...config, initialCapital: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Configuration des prix */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-5 h-5 text-purple-600" />
            <h2 className="font-bold text-slate-700">Configuration des prix</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-semibold">Calcul automatique</span>
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
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                <label className="text-sm text-slate-600">Marge par défaut (%)</label>
                <input
                  type="number"
                  value={config.marginConfig.defaultMargin}
                  onChange={(e) => setConfig({
                    ...config,
                    marginConfig: { ...config.marginConfig, defaultMargin: Number(e.target.value) }
                  })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  step="0.1"
                  min="0"
                  max="100"
                />
              </div>
              <div>
                <label className="text-sm text-slate-600">Marge min/max (%)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={config.marginConfig.minMargin}
                    onChange={(e) => setConfig({
                      ...config,
                      marginConfig: { ...config.marginConfig, minMargin: Number(e.target.value) }
                    })}
                    className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
                    className="w-1/2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
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
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-slate-700">Seuils d'alertes</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-600">Stock bas (quantité)</label>
              <input
                type="number"
                value={config.lowStockThreshold}
                onChange={(e) => setConfig({...config, lowStockThreshold: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm text-slate-600">Expiration (jours)</label>
              <input
                type="number"
                value={config.expiryWarningDays}
                onChange={(e) => setConfig({...config, expiryWarningDays: Number(e.target.value)})}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-slate-600">Délai de retour produit (jours)</label>
            <input
              type="number"
              value={config.productReturnDays}
              onChange={(e) => setConfig({...config, productReturnDays: Number(e.target.value)})}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              min="0"
              max="365"
            />
          </div>
        </div>

        {/* Heures de service */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-emerald-600" />
            <h2 className="font-bold text-slate-700">Heures de service</h2>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm font-semibold">Activer les heures de service</span>
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
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {config.workingHours.enabled && (
            <>
              <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
                <span className="text-xs text-blue-700">
                  {showLocalTimes ? (
                    <>Heures affichées dans votre fuseau ({browserTimezone})</>
                  ) : (
                    <>Heures stockées en {config.workingHours.timezone || 'Africa/Kinshasa'}</>
                  )}
                </span>
                <button
                  onClick={() => setShowLocalTimes(!showLocalTimes)}
                  className="text-xs text-blue-600 underline ml-auto"
                >
                  {showLocalTimes ? 'Voir heures pharmacie' : 'Voir mes heures locales'}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-slate-600">
                    Heure début {showLocalTimes && <span className="text-xs text-blue-600">(locale)</span>}
                  </label>
                  <input
                    type="time"
                    value={showLocalTimes ? displayLocalTime(config.workingHours.startTime) : config.workingHours.startTime}
                    onChange={(e) => {
                      if (showLocalTimes) {
                        // Si on modifie en mode local, on veut convertir vers l'heure pharmacie
                        // Mais c'est complexe - on désactive la modification en mode local
                        return;
                      }
                      setConfig({
                        ...config,
                        workingHours: { ...config.workingHours, startTime: e.target.value }
                      });
                    }}
                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={showLocalTimes}
                  />
                  {showLocalTimes && (
                    <p className="text-xs text-amber-600 mt-1">
                      Déverrouiller pour modifier
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-sm text-slate-600">
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
                    className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                      showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    disabled={showLocalTimes}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm text-slate-600">
                  Heure supplémentaire (max) {showLocalTimes && <span className="text-xs text-blue-600">(locale)</span>}
                </label>
                <input
                  type="time"
                  value={showLocalTimes && config.workingHours.overtimeEndTime 
                    ? displayLocalTime(config.workingHours.overtimeEndTime) 
                    : config.workingHours.overtimeEndTime || ''}
                  onChange={(e) => {
                    if (showLocalTimes) return;
                    setConfig({
                      ...config,
                      workingHours: { ...config.workingHours, overtimeEndTime: e.target.value }
                    });
                  }}
                  className={`w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${
                    showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={showLocalTimes}
                />
              </div>

              <div>
                <label className="text-sm text-slate-600 mb-2 block">Jours de service</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(config.workingHours.daysOff).map(([day, value]) => (
                    <button
                      key={day}
                      onClick={() => {
                        if (showLocalTimes) return;
                        setConfig({
                          ...config,
                          workingHours: {
                            ...config.workingHours,
                            daysOff: { ...config.workingHours.daysOff, [day]: !value }
                          }
                        });
                      }}
                      disabled={showLocalTimes}
                      className={`p-2 rounded-lg text-xs font-medium transition-all ${
                        value 
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      } ${showLocalTimes ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg">
                <span className="text-xs text-slate-600">Fuseau horaire:</span>
                <select
                  value={config.workingHours.timezone || 'Africa/Kinshasa'}
                  onChange={(e) => setConfig({
                    ...config,
                    workingHours: { ...config.workingHours, timezone: e.target.value }
                  })}
                  className="flex-1 p-1 text-xs bg-white border border-slate-200 rounded-lg"
                  disabled={showLocalTimes}
                >
                  <option value="Africa/Kinshasa">Africa/Kinshasa (UTC+1)</option>
                  <option value="Africa/Lubumbashi">Africa/Lubumbashi (UTC+2)</option>
                  <option value="Europe/Paris">Europe/Paris (UTC+1/UTC+2)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </>
          )}
        </div>

        {/* Configuration des branches/succursales */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-orange-600" />
            <h2 className="font-bold text-slate-700">Succursales</h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <div>
                <p className="font-semibold">Succursales actives</p>
                <p className="text-sm text-slate-500">
                  {config.branchConfig.currentBranches} / {config.branchConfig.maxBranches}
                </p>
              </div>
              <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-600 rounded-full transition-all"
                  style={{ width: `${(config.branchConfig.currentBranches / config.branchConfig.maxBranches) * 100}%` }}
                />
              </div>
            </div>

            {config.branchConfig.branches && config.branchConfig.branches.length > 0 && (
              <div className="space-y-2">
                {config.branchConfig.branches.map((branch) => (
                  <div key={branch.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:shadow-md transition-all">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{branch.name}</p>
                        <p className="text-xs text-slate-500">{branch.address}</p>
                        <p className="text-xs text-slate-500">{branch.phone}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        branch.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
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
                className="w-full p-3 border-2 border-dashed border-orange-200 rounded-xl text-orange-600 hover:bg-orange-50 transition-all"
              >
                <Plus className="w-5 h-5 mx-auto" />
                <span className="text-sm">Ajouter une succursale</span>
              </button>
            )}
          </div>
        </div>

        {/* Thème */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-5 h-5 text-pink-600" />
            <h2 className="font-bold text-slate-700">Thème</h2>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setConfig({...config, theme: 'light'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.theme === 'light' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <Sun className="w-5 h-5" />
              <span className="text-xs">Clair</span>
            </button>
            <button
              onClick={() => setConfig({...config, theme: 'dark'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.theme === 'dark' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <Moon className="w-5 h-5" />
              <span className="text-xs">Sombre</span>
            </button>
            <button
              onClick={() => setConfig({...config, theme: 'system'})}
              className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                config.theme === 'system' ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' : 'bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <Monitor className="w-5 h-5" />
              <span className="text-xs">Système</span>
            </button>
          </div>
        </div>
      </div>

      {/* Résumé et validation */}
      <div className="bg-linear-to-r from-blue-50 to-indigo-50 p-6 rounded-2xl border border-blue-100">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-6 h-6 text-blue-600 shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-slate-800 mb-2">Configuration système - {pharmacyData?.name || config.pharmacyInfo.name}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Devise principale</p>
                <p className="font-medium">{config.primaryCurrency}</p>
              </div>
              <div>
                <p className="text-slate-500">TVA</p>
                <p className="font-medium">{config.taxRate}%</p>
              </div>
              <div>
                <p className="text-slate-500">Stock bas</p>
                <p className="font-medium">{config.lowStockThreshold} unités</p>
              </div>
              <div>
                <p className="text-slate-500">Retour produit</p>
                <p className="font-medium">{config.productReturnDays} jours</p>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Dernière synchronisation: {new Date().toLocaleString()} • 
              Fuseau pharmacie: {config.workingHours.timezone || 'Africa/Kinshasa'}
            </div>
          </div>
        </div>
      </div>

      {/* Mode hors service - indication */}
      <div className="text-xs text-slate-400 flex items-center justify-center gap-2 pt-4">
        <AlertTriangle className="w-3 h-3" />
        Configuration propre à la pharmacie {pharmacyData?.name || config.pharmacyInfo.name} • Sauvegardée en base de données
      </div>
    </div>
  );
};

export default ConfigView;