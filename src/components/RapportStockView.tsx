// components/RapportStockView.tsx
import { useState } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  BarChart3,
  Calendar,
  Clock,
  Package,
  DollarSign
} from 'lucide-react';
import { reportService } from '@/services/reportService';
import { useCurrencyConfig } from '@/hooks/useCurrencyConfig';

interface RapportStockViewProps {
  open: boolean;
  onClose: () => void;
  pharmacyId?: string;
}

export default function RapportStockView({ open, onClose, pharmacyId }: RapportStockViewProps) {
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'stock' | 'valuation' | 'movement' | 'expiry'>('stock');
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf');
  const [includeExpired, setIncludeExpired] = useState(true);
  const [includeLowStock, setIncludeLowStock] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('CDF');
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [showPricePreview, setShowPricePreview] = useState(false);
  
  const { getAvailableCurrencies, formatPrice, primaryCurrency } = useCurrencyConfig(pharmacyId);
  const currencies = getAvailableCurrencies();

  // Exemple de valeurs pour l'aperçu des prix (simulées)
  const previewValues = {
    stock: { total: 1250000, count: 345 },
    valuation: { purchase: 875000, selling: 1250000, margin: 375000 },
    movement: { total: 450000, count: 28 },
    expiry: { value: 125000, count: 12 }
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      let blob;
      
      if (reportType === 'stock') {
        blob = await reportService.generateStockReport({
          includeExpired,
          includeLowStock,
          format
        });
      } else if (reportType === 'valuation') {
        blob = await reportService.generateValuationReport({
          currency: selectedCurrency,
          includeMargin: true,
          format
        });
      } else if (reportType === 'movement') {
        const now = new Date();
        let startDate = new Date();
        
        if (dateRange === 'week') startDate.setDate(now.getDate() - 7);
        else if (dateRange === 'month') startDate.setMonth(now.getMonth() - 1);
        else if (dateRange === 'quarter') startDate.setMonth(now.getMonth() - 3);
        else if (dateRange === 'year') startDate.setFullYear(now.getFullYear() - 1);
        
        blob = await reportService.generateMovementReport({
          startDate: startDate.toISOString(),
          endDate: now.toISOString(),
          format
        });
      } else if (reportType === 'expiry') {
        blob = await reportService.generateExpiryReport({
          days: 90,
          includeExpired,
          format
        });
      }

      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-${reportType}-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur génération rapport:', error);
      alert('Erreur lors de la génération du rapport');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (!showPricePreview) return null;

    return (
      <div className="mt-4 p-4 bg-linear-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign size={16} className="text-blue-600" />
          <span className="text-sm font-bold text-blue-700">Aperçu des valeurs</span>
        </div>
        
        {reportType === 'stock' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valeur totale du stock:</span>
              <span className="font-black text-sky-600">{formatPrice(previewValues.stock.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Nombre de produits:</span>
              <span className="font-bold text-slate-700">{previewValues.stock.count}</span>
            </div>
          </div>
        )}

        {reportType === 'valuation' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valeur d'achat:</span>
              <span className="font-black text-slate-700">{formatPrice(previewValues.valuation.purchase, selectedCurrency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valeur de vente:</span>
              <span className="font-black text-sky-600">{formatPrice(previewValues.valuation.selling, selectedCurrency)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-blue-200">
              <span className="text-slate-600">Marge potentielle:</span>
              <span className="font-black text-emerald-600">{formatPrice(previewValues.valuation.margin, selectedCurrency)}</span>
            </div>
          </div>
        )}

        {reportType === 'movement' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valeur totale des mouvements:</span>
              <span className="font-black text-amber-600">{formatPrice(previewValues.movement.total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Nombre de mouvements:</span>
              <span className="font-bold text-slate-700">{previewValues.movement.count}</span>
            </div>
          </div>
        )}

        {reportType === 'expiry' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Valeur des produits concernés:</span>
              <span className="font-black text-red-600">{formatPrice(previewValues.expiry.value)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Nombre de produits:</span>
              <span className="font-bold text-slate-700">{previewValues.expiry.count}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-3">
          * Aperçu basé sur les données actuelles
        </p>
      </div>
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
              <FileText size={20} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Générer un rapport</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPricePreview(!showPricePreview)}
              className={`p-2 rounded-xl transition-colors ${
                showPricePreview ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-100 text-slate-600'
              }`}
              title={showPricePreview ? "Masquer l'aperçu" : "Afficher l'aperçu des valeurs"}
            >
              <DollarSign size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="text-sm font-bold text-slate-600 mb-2 block">
              Type de rapport
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setReportType('stock')}
                className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  reportType === 'stock' 
                    ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500' 
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Package size={20} />
                <span className="text-xs">Stock</span>
              </button>
              <button
                onClick={() => setReportType('valuation')}
                className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  reportType === 'valuation' 
                    ? 'bg-green-100 text-green-700 ring-2 ring-green-500' 
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <BarChart3 size={20} />
                <span className="text-xs">Valuation</span>
              </button>
              <button
                onClick={() => setReportType('movement')}
                className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  reportType === 'movement' 
                    ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500' 
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Calendar size={20} />
                <span className="text-xs">Mouvements</span>
              </button>
              <button
                onClick={() => setReportType('expiry')}
                className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                  reportType === 'expiry' 
                    ? 'bg-red-100 text-red-700 ring-2 ring-red-500' 
                    : 'bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <Clock size={20} />
                <span className="text-xs">Expirations</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-600 mb-2 block">
              Format d'export
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'pdf' | 'excel')}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
          </div>

          {reportType === 'stock' && (
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm">Inclure les produits expirés</span>
                <input
                  type="checkbox"
                  checked={includeExpired}
                  onChange={(e) => setIncludeExpired(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600"
                />
              </label>
              <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-sm">Inclure les stocks faibles</span>
                <input
                  type="checkbox"
                  checked={includeLowStock}
                  onChange={(e) => setIncludeLowStock(e.target.checked)}
                  className="w-5 h-5 rounded text-blue-600"
                />
              </label>
            </div>
          )}

          {reportType === 'valuation' && (
            <div>
              <label className="text-sm font-bold text-slate-600 mb-2 block">
                Devise
              </label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {currencies.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.symbol})
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400 mt-2">
                Le rapport sera généré en {selectedCurrency}
              </p>
            </div>
          )}

          {reportType === 'movement' && (
            <div>
              <label className="text-sm font-bold text-slate-600 mb-2 block">
                Période
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="week">7 derniers jours</option>
                <option value="month">30 derniers jours</option>
                <option value="quarter">3 derniers mois</option>
                <option value="year">12 derniers mois</option>
              </select>
            </div>
          )}

          {reportType === 'expiry' && (
            <label className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm">Inclure les produits déjà expirés</span>
              <input
                type="checkbox"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
                className="w-5 h-5 rounded text-blue-600"
              />
            </label>
          )}

          {/* Aperçu des prix */}
          {renderPreview()}

          {/* Informations sur la devise principale */}
          <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-500">
            <DollarSign size={14} className="text-sky-600" />
            <span>Devise principale: {primaryCurrency}</span>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Download className="w-4 h-4 animate-pulse" />
                Génération en cours...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Générer le rapport
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}