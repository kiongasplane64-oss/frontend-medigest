// components/ExportInventory.tsx
import { useState } from 'react';
import { inventoryService } from '@/services/inventoryService';
import { ExportFormat } from '@/types/inventory.types';
import { saveAs } from 'file-saver';
import {
  X, Download, FileText, Table, FileSpreadsheet, Loader2,
  AlertCircle, Filter, Calendar
} from 'lucide-react';

interface ExportInventoryProps {
  open: boolean;
  onClose: () => void;
  filters?: {
    search?: string;
    category?: string;
  };
}

type ExportType = 'all' | 'filtered' | 'lowstock' | 'expiring';

export default function ExportInventory({ open, onClose, filters }: ExportInventoryProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(ExportFormat.EXCEL);
  const [exportType, setExportType] = useState<ExportType>('filtered');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [includeOptions, setIncludeOptions] = useState({
    prices: true,
    stock: true,
    expiry: true,
    supplier: true
  });

  if (!open) return null;

  const handleExport = async () => {
    setIsExporting(true);
    setProgress(0);
    setError(null);

    try {
      // Simuler la progression
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 20, 90));
      }, 200);

      let blob: Blob;
      const timestamp = new Date().toISOString().split('T')[0];
      const fileName = `inventaire_${exportType}_${timestamp}`;

      // Construire les paramètres de recherche
      const searchParams: any = {};
      
      if (exportType === 'filtered' && filters?.search) {
        searchParams.query = filters.search;
      }
      if (exportType === 'filtered' && filters?.category && filters.category !== 'all') {
        searchParams.category = filters.category;
      }
      if (exportType === 'lowstock') {
        searchParams.stock_status = 'low_stock';
      }
      if (exportType === 'expiring') {
        searchParams.expiry_status = 'warning';
      }

      // Appel au service
      blob = await inventoryService.exportStock(selectedFormat, searchParams);

      clearInterval(progressInterval);
      setProgress(100);

      // Sauvegarder le fichier
      const extension = selectedFormat === ExportFormat.EXCEL ? 'xlsx' : 
                       selectedFormat === ExportFormat.CSV ? 'csv' : 'pdf';
      saveAs(blob, `${fileName}.${extension}`);

      // Fermer après un court délai
      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);

    } catch (err) {
      setError("Erreur lors de l'export");
      console.error(err);
      setIsExporting(false);
      setProgress(0);
    }
  };

  const getIconForFormat = (format: ExportFormat) => {
    switch (format) {
      case ExportFormat.CSV:
        return <FileText size={20} />;
      case ExportFormat.EXCEL:
        return <FileSpreadsheet size={20} />;
      case ExportFormat.PDF:
        return <FileText size={20} />;
      default:
        return <Table size={20} />;
    }
  };

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case ExportFormat.CSV:
        return 'CSV';
      case ExportFormat.EXCEL:
        return 'Excel';
      case ExportFormat.PDF:
        return 'PDF';
      default:
        return format;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-medical/10 flex items-center justify-center">
                <Download className="text-medical" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic text-slate-900">
                  Export
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  INVENTAIRE
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Type d'export */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Type d'export
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'all', label: 'Tous', icon: <Table size={16} /> },
                { value: 'filtered', label: 'Filtrés', icon: <Filter size={16} /> },
                { value: 'lowstock', label: 'Stock bas', icon: <AlertCircle size={16} /> },
                { value: 'expiring', label: 'Péremption', icon: <Calendar size={16} /> }
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setExportType(type.value as ExportType)}
                  disabled={isExporting}
                  className={`
                    p-3 rounded-xl border-2 transition-all flex items-center gap-2
                    ${exportType === type.value 
                      ? 'border-medical bg-medical/5' 
                      : 'border-slate-100 hover:border-medical/30'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className={`p-2 rounded-lg ${
                    exportType === type.value ? 'bg-medical text-white' : 'bg-slate-100'
                  }`}>
                    {type.icon}
                  </div>
                  <span className="font-bold text-sm">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Format d'export */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Format
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[ExportFormat.EXCEL, ExportFormat.CSV, ExportFormat.PDF].map((format) => (
                <button
                  key={format}
                  onClick={() => setSelectedFormat(format)}
                  disabled={isExporting}
                  className={`
                    p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                    ${selectedFormat === format 
                      ? 'border-medical bg-medical/5' 
                      : 'border-slate-100 hover:border-medical/30'
                    }
                    disabled:opacity-50 disabled:cursor-not-allowed
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-lg flex items-center justify-center
                    ${selectedFormat === format ? 'bg-medical text-white' : 'bg-slate-100 text-slate-600'}
                  `}>
                    {getIconForFormat(format)}
                  </div>
                  <span className="font-black text-xs uppercase">
                    {getFormatLabel(format)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Inclure
            </label>
            <div className="space-y-2">
              {[
                { key: 'prices', label: 'Prix d\'achat et vente' },
                { key: 'stock', label: 'Quantités en stock' },
                { key: 'expiry', label: 'Dates de péremption' },
                { key: 'supplier', label: 'Informations fournisseur' }
              ].map(option => (
                <label key={option.key} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeOptions[option.key as keyof typeof includeOptions]}
                    onChange={(e) => setIncludeOptions(prev => ({
                      ...prev,
                      [option.key]: e.target.checked
                    }))}
                    disabled={isExporting}
                    className="w-5 h-5 rounded border-slate-300 text-medical focus:ring-medical/20"
                  />
                  <span className="text-sm font-bold text-slate-700">{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Résumé */}
          <div className="bg-slate-50 p-4 rounded-xl space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Format:</span>
              <span className="font-black uppercase">{getFormatLabel(selectedFormat)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Type:</span>
              <span className="font-black">
                {exportType === 'all' && 'Tous les produits'}
                {exportType === 'filtered' && 'Résultats filtrés'}
                {exportType === 'lowstock' && 'Produits en stock bas'}
                {exportType === 'expiring' && 'Produits proches expiration'}
              </span>
            </div>
            {filters?.search && exportType === 'filtered' && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Recherche:</span>
                <span className="font-black">"{filters.search}"</span>
              </div>
            )}
          </div>

          {/* Progression */}
          {isExporting && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Export en cours...</span>
                <span className="font-black text-medical">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-medical rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 py-4 rounded-xl border-2 border-slate-200 font-black text-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              ANNULER
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 bg-medical text-white py-4 rounded-xl font-black text-sm hover:bg-medical-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isExporting ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  EXPORT...
                </>
              ) : (
                <>
                  <Download size={18} />
                  EXPORTER
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}