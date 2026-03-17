import { useState } from 'react'; // Retrait de l'import 'React' inutilisé
import { 
  Settings, 
  DollarSign, 
  Percent, 
  Bell, 
  Save, 
  RefreshCcw,
  ShieldCheck
} from 'lucide-react';
import { Currency } from '@/utils/formatters';

interface PharmacyConfig {
  primaryCurrency: Currency;
  secondaryCurrency: Currency;
  exchangeRate: number;
  taxRate: number;
  lowStockThreshold: number;
  expiryWarningDays: number;
  allowNegativeStock: boolean;
}

const ConfigView = () => {
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<PharmacyConfig>({
    primaryCurrency: 'CDF',
    secondaryCurrency: 'USD',
    exchangeRate: 2500,
    taxRate: 16,
    lowStockThreshold: 10,
    expiryWarningDays: 90,
    allowNegativeStock: false,
  });

  const handleSave = async () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      alert("Configuration mise à jour !");
    }, 1000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-600" />
            Paramètres
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-semibold shadow-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section Devises */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-slate-700">Devises & Taux</h2>
          </div>
          
          <div className="space-y-4">
            <select 
              value={config.primaryCurrency}
              onChange={(e) => setConfig({...config, primaryCurrency: e.target.value as Currency})}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
            >
              <option value="CDF">CDF</option>
              <option value="USD">USD</option>
            </select>
            <input 
              type="number"
              value={config.exchangeRate}
              onChange={(e) => setConfig({...config, exchangeRate: Number(e.target.value)})}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        {/* Section Fiscalité avec corrections Tailwind */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-700">Fiscalité</h2>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <span className="text-sm font-semibold">Vente stock négatif</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={config.allowNegativeStock}
                onChange={(e) => setConfig({...config, allowNegativeStock: e.target.checked})}
              />
              {/* Correction des classes top-[2px] -> top-0.5 et left-[2px] -> left-0.5 */}
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Section Alertes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-slate-700">Seuils d'Alertes</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input 
              type="number"
              value={config.lowStockThreshold}
              onChange={(e) => setConfig({...config, lowStockThreshold: Number(e.target.value)})}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              placeholder="Stock bas"
            />
            <input 
              type="number"
              value={config.expiryWarningDays}
              onChange={(e) => setConfig({...config, expiryWarningDays: Number(e.target.value)})}
              className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
              placeholder="Jours expiration"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400 justify-center pt-4">
        <ShieldCheck className="w-4 h-4" />
        Configuration système sécurisée.
      </div>
    </div>
  );
};

export default ConfigView;