// components/StatCardDetail.tsx
import { useState } from 'react';
import { 
  X, 
  Download, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  DollarSign,
  Printer
} from 'lucide-react';
import { reportService } from '@/services/reportService';
import { useCurrencyConfig } from '@/hooks/useCurrencyConfig';

interface StatCardDetailProps {
  title: string;
  type: 'value' | 'margin' | 'lowstock' | 'expired' | 'purchase';
  data: any;
  onClose: () => void;
  pharmacyId?: string;
}

export function StatCardDetail({ title, type, data, onClose, pharmacyId }: StatCardDetailProps) {
  const { formatPrice, primaryCurrency } = useCurrencyConfig(pharmacyId);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'excel'>('pdf');

  const handleExport = async () => {
    setExporting(true);
    try {
      let blob;
      
      if (type === 'value' || type === 'purchase' || type === 'margin') {
        blob = await reportService.generateValuationReport({ 
          currency: primaryCurrency,
          format: exportFormat
        });
      } else if (type === 'lowstock') {
        blob = await reportService.generateStockReport({ 
          includeLowStock: true,
          format: exportFormat
        });
      } else if (type === 'expired') {
        blob = await reportService.generateExpiryReport({ 
          includeExpired: true,
          format: exportFormat
        });
      }
      
      if (blob) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rapport-${type}-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Erreur export:', error);
      alert('Erreur lors de l\'export du rapport');
    } finally {
      setExporting(false);
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'value':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-sm text-blue-600 mb-1">Valeur d'achat</p>
                <p className="text-2xl font-black text-slate-900">
                  {formatPrice(data.purchaseValue || 0)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl">
                <p className="text-sm text-green-600 mb-1">Valeur de vente</p>
                <p className="text-2xl font-black text-slate-900">
                  {formatPrice(data.sellingValue || 0)}
                </p>
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-xl">
              <p className="text-sm text-purple-600 mb-1">Profit potentiel</p>
              <p className="text-2xl font-black text-slate-900">
                {formatPrice(data.profit || 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Marge moyenne: {data.averageMargin?.toFixed(1)}%
              </p>
            </div>
          </div>
        );

      case 'margin':
        return (
          <div className="space-y-4">
            <div className="bg-indigo-50 p-4 rounded-xl">
              <p className="text-sm text-indigo-600 mb-1">Marge totale</p>
              <p className="text-2xl font-black text-slate-900">
                {formatPrice(data.totalMargin || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700 mb-2">Par catégorie</p>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.byCategory?.map((cat: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                    <span className="text-sm">{cat.category}</span>
                    <span className="font-bold text-emerald-600">
                      {formatPrice(cat.profit)} ({cat.margin.toFixed(1)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'lowstock':
        return (
          <div className="space-y-3">
            {data.products?.length > 0 ? (
              data.products.map((product: any) => (
                <div key={product.id} className="flex justify-between items-center p-3 bg-amber-50 rounded-xl">
                  <div>
                    <p className="font-bold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">Stock: {product.quantity}</p>
                  </div>
                  <span className="text-amber-600 font-bold">
                    {formatPrice(product.selling_price)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-4">Aucun produit en stock faible</p>
            )}
          </div>
        );

      case 'expired':
        return (
          <div className="space-y-3">
            {data.products?.length > 0 ? (
              data.products.map((product: any) => (
                <div key={product.id} className="flex justify-between items-center p-3 bg-red-50 rounded-xl">
                  <div>
                    <p className="font-bold text-slate-800">{product.name}</p>
                    <p className="text-xs text-slate-500">
                      Expire: {new Date(product.expiry_date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-red-600 font-bold">
                    {formatPrice(product.purchase_price)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-500 py-4">Aucun produit expiré</p>
            )}
          </div>
        );

      case 'purchase':
        return (
          <div className="space-y-4">
            <div className="bg-violet-50 p-4 rounded-xl">
              <p className="text-sm text-violet-600 mb-1">Coût d'achat total</p>
              <p className="text-2xl font-black text-slate-900">
                {formatPrice(data.totalPurchase || 0)}
              </p>
            </div>
            <p className="text-sm text-slate-600">
              Basé sur {data.productCount || 0} produits
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] bg-white shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${
              type === 'value' ? 'bg-blue-100 text-blue-600' :
              type === 'margin' ? 'bg-green-100 text-green-600' :
              type === 'lowstock' ? 'bg-amber-100 text-amber-600' :
              type === 'expired' ? 'bg-red-100 text-red-600' :
              'bg-violet-100 text-violet-600'
            }`}>
              {type === 'value' && <Package size={20} />}
              {type === 'margin' && <TrendingUp size={20} />}
              {type === 'lowstock' && <AlertCircle size={20} />}
              {type === 'expired' && <Clock size={20} />}
              {type === 'purchase' && <DollarSign size={20} />}
            </div>
            <h3 className="text-xl font-black text-slate-900">{title}</h3>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'pdf' | 'excel')}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white"
            >
              <option value="pdf">PDF</option>
              <option value="excel">Excel</option>
            </select>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              title="Exporter"
            >
              <Download size={18} className={exporting ? 'animate-pulse' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {renderContent()}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-[28px] flex gap-3">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 bg-sky-600 text-white py-3 rounded-xl font-bold hover:bg-sky-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Download size={16} />
            {exporting ? 'Génération...' : `Télécharger en ${exportFormat.toUpperCase()}`}
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-3 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}