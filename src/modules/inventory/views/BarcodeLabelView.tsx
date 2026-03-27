// components/inventory/BarcodeLabelView.tsx
import { useState, useRef } from 'react';
import { Printer, Settings, Grid3x3, List, Plus, Minus } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import type { Product } from '@/types/inventory.types';
import Barcode from 'react-barcode';

interface BarcodeLabelViewProps {
  products: Product[];
  formatPrice: (price: number | undefined | null) => string;
}

type LabelSize = 'small' | 'medium' | 'large';
type LabelLayout = 'grid' | 'list';

export default function BarcodeLabelView({ products, formatPrice }: BarcodeLabelViewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [labelLayout, setLabelLayout] = useState<LabelLayout>('grid');
  const [copiesPerProduct, setCopiesPerProduct] = useState(1);
  const [showBarcodeValue, setShowBarcodeValue] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [showProductName, setShowProductName] = useState(true);

  const handlePrint = useReactToPrint({
    documentTitle: 'etiquettes_code_barres',
    onPrintError: (error) => console.error('Erreur d\'impression:', error),
  });

  const toggleSelectAll = () => {
    if (selectedProducts.length === products.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products.map(p => p.id));
    }
  };

  const getLabelSizeClass = () => {
    switch (labelSize) {
      case 'small':
        return 'w-48 p-2';
      case 'large':
        return 'w-72 p-4';
      default:
        return 'w-60 p-3';
    }
  };

  const getBarcodeWidth = () => {
    switch (labelSize) {
      case 'small':
        return 1.5;
      case 'large':
        return 2.5;
      default:
        return 2;
    }
  };

  const getBarcodeHeight = () => {
    switch (labelSize) {
      case 'small':
        return 40;
      case 'large':
        return 80;
      default:
        return 60;
    }
  };

  const getTextSize = () => {
    switch (labelSize) {
      case 'small':
        return 'text-xs';
      case 'large':
        return 'text-base';
      default:
        return 'text-sm';
    }
  };

  const selectedProductsList = products.filter(p => selectedProducts.includes(p.id));

  return (
    <div className="space-y-6">
      {/* Barre d'outils */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={toggleSelectAll}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              {selectedProducts.length === products.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
            <span className="text-sm text-slate-500">
              {selectedProducts.length} produit(s) sélectionné(s)
            </span>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-slate-400" />
              <select
                value={labelSize}
                onChange={(e) => setLabelSize(e.target.value as LabelSize)}
                className="px-2 py-1 border border-slate-200 rounded-lg text-sm"
              >
                <option value="small">Petite</option>
                <option value="medium">Moyenne</option>
                <option value="large">Grande</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setLabelLayout('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  labelLayout === 'grid' ? 'bg-medical text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Grid3x3 size={18} />
              </button>
              <button
                onClick={() => setLabelLayout('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  labelLayout === 'list' ? 'bg-medical text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <List size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCopiesPerProduct(Math.max(1, copiesPerProduct - 1))}
                className="p-1 border border-slate-200 rounded-lg"
              >
                <Minus size={14} />
              </button>
              <span className="text-sm w-8 text-center">{copiesPerProduct}</span>
              <button
                onClick={() => setCopiesPerProduct(copiesPerProduct + 1)}
                className="p-1 border border-slate-200 rounded-lg"
              >
                <Plus size={14} />
              </button>
              <span className="text-xs text-slate-400">copies</span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showProductName}
                  onChange={(e) => setShowProductName(e.target.checked)}
                />
                Nom
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showBarcodeValue}
                  onChange={(e) => setShowBarcodeValue(e.target.checked)}
                />
                Code-barres
              </label>
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                />
                Prix
              </label>
            </div>

            <button
              onClick={handlePrint}
              disabled={selectedProducts.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark disabled:opacity-50"
            >
              <Printer size={18} />
              Imprimer ({selectedProducts.length * copiesPerProduct} étiquettes)
            </button>
          </div>
        </div>
      </div>

      {/* Aperçu des étiquettes */}
      <div className="bg-slate-50 rounded-xl p-4 min-h-100">
        <div
          ref={printRef}
          className={`${labelLayout === 'grid' ? 'flex flex-wrap gap-4' : 'flex flex-col gap-3'}`}
        >
          {selectedProductsList.map((product) => {
            const labels = Array(copiesPerProduct).fill(null);
            return labels.map((_, idx) => (
              <div
                key={`${product.id}-${idx}`}
                className={`bg-white rounded-lg border border-slate-200 shadow-sm ${getLabelSizeClass()}`}
              >
                <div className="text-center space-y-2">
                  {showProductName && (
                    <h4 className={`font-semibold text-slate-800 ${getTextSize()}`}>
                      {product.name}
                    </h4>
                  )}
                  
                  {product.barcode && (
                    <div className="flex justify-center">
                      <Barcode
                        value={product.barcode}
                        width={getBarcodeWidth()}
                        height={getBarcodeHeight()}
                        fontSize={labelSize === 'small' ? 10 : 12}
                        displayValue={showBarcodeValue}
                      />
                    </div>
                  )}
                  
                  {!product.barcode && (
                    <div className="flex justify-center items-center h-20 bg-slate-100 rounded">
                      <p className="text-xs text-slate-400">Aucun code-barres</p>
                    </div>
                  )}
                  
                  {showPrice && (
                    <div className="space-y-1">
                      <p className={`font-bold text-medical ${getTextSize()}`}>
                        {formatPrice(product.selling_price)}
                      </p>
                      <p className="text-[10px] text-slate-400">TTC</p>
                    </div>
                  )}
                  
                  <div className="text-[10px] text-slate-300 border-t border-slate-100 pt-1 mt-1">
                    {product.code && <span>Ref: {product.code}</span>}
                  </div>
                </div>
              </div>
            ));
          })}
        </div>

        {selectedProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Printer size={48} className="mb-4 opacity-30" />
            <p>Sélectionnez des produits pour générer les étiquettes</p>
          </div>
        )}
      </div>
    </div>
  );
}