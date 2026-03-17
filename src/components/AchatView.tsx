// components/AchatView.tsx
import { useState, useEffect, useMemo } from 'react';
import { Product } from '@/types/inventory.types';
import { inventoryService } from '@/services/inventoryService';
import { formatPrice } from '@/utils/formatters';
import BarcodeScanner from './BarcodeScanner';
import {
  X, ShoppingCart, Plus, Minus, Trash2, Printer, Search, Loader2,
  Package, User, FileText, ChevronDown, Check, AlertCircle
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
  unit_price: number;
  total: number;
}

interface AchatViewProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AchatView({ open, onClose, onSuccess }: AchatViewProps) {
  // États
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [step, setStep] = useState<'selection' | 'validation'>('selection');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Chargement des produits
  useEffect(() => {
    if (open) loadProducts();
  }, [open]);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const data = await inventoryService.getProducts({ limit: 1000 });
      setProducts(data.products);
    } catch (err) {
      setError("Erreur lors du chargement des produits");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filtrage des produits
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p =>
      p.name.toLowerCase().includes(term) ||
      p.code.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term)
    );
  }, [products, searchTerm]);

  // Gestion du panier
  const handleAddToCart = () => {
    if (!selectedProduct) {
      setError("Veuillez sélectionner un produit");
      return;
    }

    if (quantity <= 0) {
      setError("La quantité doit être supérieure à 0");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.product.id === selectedProduct.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === selectedProduct.id
            ? {
                ...item,
                quantity: item.quantity + quantity,
                total: (item.quantity + quantity) * item.unit_price
              }
            : item
        );
      }
      return [
        ...prev,
        {
          product: selectedProduct,
          quantity,
          unit_price: selectedProduct.purchase_price,
          total: quantity * selectedProduct.purchase_price
        }
      ];
    });

    setSelectedProduct(null);
    setQuantity(1);
    setSearchTerm('');
  };

  const handleUpdateQuantity = (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(prev => prev.filter(item => item.product.id !== productId));
    } else {
      setCart(prev =>
        prev.map(item =>
          item.product.id === productId
            ? { ...item, quantity: newQuantity, total: newQuantity * item.unit_price }
            : item
        )
      );
    }
  };

  const handleScan = (code: string) => {
    const product = products.find(p => p.barcode === code || p.code === code);
    if (product) {
      setSelectedProduct(product);
      setShowScanner(false);
    } else {
      setError(`Produit avec code ${code} non trouvé`);
    }
  };

  const calculateTotal = () => cart.reduce((sum, item) => sum + item.total, 0);

  const handleValidate = async () => {
    if (cart.length === 0) {
      setError("Le panier est vide");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      for (const item of cart) {
        await inventoryService.adjustStock({
          product_id: item.product.id,
          new_quantity: item.product.quantity + item.quantity,
          reason: 'Achat fournisseur',
          notes: `Fournisseur: ${supplier || 'Non spécifié'} - Réf: ${reference || 'N/A'} - ${notes}`
        });
      }

      await printTicket();

      if (onSuccess) onSuccess();
      resetForm();
      onClose();
    } catch (err) {
      setError("Erreur lors de la validation de l'achat");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const printTicket = async () => {
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const total = calculateTotal();
    const date = new Date().toLocaleDateString('fr-FR');
    const time = new Date().toLocaleTimeString('fr-FR');

    printWindow.document.write(`
      <html>
        <head>
          <title>Ticket d'achat</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: white;
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              padding: 16px;
            }
            .ticket {
              max-width: 400px;
              width: 100%;
              background: white;
              border-radius: 24px;
              padding: 24px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            h1 { font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 4px; }
            h2 { font-size: 18px; font-weight: 600; text-align: center; color: #64748b; margin-bottom: 16px; }
            .header { text-align: center; margin-bottom: 20px; }
            .info-grid {
              background: #f8fafc;
              border-radius: 16px;
              padding: 16px;
              margin-bottom: 20px;
              font-size: 14px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }
            .info-row:last-child { margin-bottom: 0; }
            table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            th { 
              text-align: left; 
              font-size: 12px; 
              font-weight: 700;
              color: #64748b;
              padding: 8px 0;
              border-bottom: 2px solid #e2e8f0;
            }
            td { 
              padding: 8px 0;
              font-size: 14px;
              border-bottom: 1px solid #e2e8f0;
            }
            .qty { text-align: center; }
            .price { text-align: right; }
            .total-row {
              background: #f0f9ff;
              border-radius: 16px;
              padding: 16px;
              margin: 16px 0;
              display: flex;
              justify-content: space-between;
              font-weight: 800;
              font-size: 18px;
            }
            .footer {
              text-align: center;
              margin-top: 24px;
              padding-top: 24px;
              border-top: 2px dashed #e2e8f0;
              font-size: 12px;
              color: #94a3b8;
            }
            @media print {
              body { padding: 0; }
              .ticket { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h1>PHARMASTOCK</h1>
            <h2>BON D'ACHAT</h2>
            
            <div class="info-grid">
              <div class="info-row">
                <span>Date:</span>
                <strong>${date} ${time}</strong>
              </div>
              <div class="info-row">
                <span>Référence:</span>
                <strong>${reference || 'N/A'}</strong>
              </div>
              <div class="info-row">
                <span>Fournisseur:</span>
                <strong>${supplier || 'N/A'}</strong>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th class="qty">Qté</th>
                  <th class="price">PU</th>
                  <th class="price">Total</th>
                </tr>
              </thead>
              <tbody>
                ${cart.map(item => `
                  <tr>
                    <td>${item.product.name.substring(0, 25)}</td>
                    <td class="qty">${item.quantity}</td>
                    <td class="price">${formatPrice(item.unit_price)}</td>
                    <td class="price">${formatPrice(item.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-row">
              <span>TOTAL</span>
              <span>${formatPrice(total)}</span>
            </div>

            ${notes ? `
              <div style="background: #f8fafc; border-radius: 12px; padding: 12px; margin: 16px 0; font-size: 13px;">
                <strong style="display: block; margin-bottom: 4px; color: #475569;">Notes:</strong>
                ${notes}
              </div>
            ` : ''}

            <div class="footer">
              <p>Merci de votre confiance !</p>
              <p style="margin-top: 8px;">Stock mis à jour le ${date}</p>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const resetForm = () => {
    setCart([]);
    setSelectedProduct(null);
    setQuantity(1);
    setSupplier('');
    setReference('');
    setNotes('');
    setError(null);
    setSearchTerm('');
    setStep('selection');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-7xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 z-10">
          <div className="p-4 md:p-6 flex justify-between items-center">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-medical/10 flex items-center justify-center">
                <ShoppingCart className="text-medical" size={20} />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-black uppercase italic text-slate-900">
                  Nouvel Achat
                </h2>
                <p className="text-xs text-slate-400 font-bold hidden sm:block">
                  {cart.length} produit(s) • Total: {formatPrice(calculateTotal())}
                </p>
              </div>
            </div>
            
            {/* Menu mobile */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <ChevronDown size={20} className={isMobileMenuOpen ? 'rotate-180' : ''} />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation mobile */}
          {isMobileMenuOpen && (
            <div className="md:hidden p-4 bg-slate-50 border-t border-slate-100">
              <div className="space-y-2">
                <button
                  onClick={() => { setStep('selection'); setIsMobileMenuOpen(false); }}
                  className={`w-full p-3 rounded-xl text-left font-bold transition-colors
                    ${step === 'selection' ? 'bg-medical text-white' : 'bg-white'}`}
                >
                  Sélection produits
                </button>
                <button
                  onClick={() => { setStep('validation'); setIsMobileMenuOpen(false); }}
                  className={`w-full p-3 rounded-xl text-left font-bold transition-colors
                    ${step === 'validation' ? 'bg-medical text-white' : 'bg-white'}`}
                >
                  Panier ({cart.length})
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {error && (
            <div className="mb-4 md:mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Left panel - Mobile/Desktop selection */}
            <div className={step === 'selection' || window.innerWidth >= 768 ? 'block' : 'hidden md:block'}>
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Package size={18} />
                Ajouter des produits
              </h3>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <button
                  onClick={() => setShowScanner(true)}
                  className="flex-1 bg-slate-100 text-slate-700 p-3 md:py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
                >
                  Scanner code-barres
                </button>
              </div>

              {/* Scanner */}
              {showScanner && (
                <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />
              )}

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none focus:ring-4 focus:ring-medical/5"
                />
              </div>

              {/* Product list */}
              <div className="bg-slate-50 rounded-xl p-2 max-h-[50vh] md:max-h-96 overflow-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="animate-spin text-medical" size={24} />
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Aucun produit trouvé</p>
                ) : (
                  filteredProducts.map(product => (
                    <div
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      className={`p-3 rounded-lg cursor-pointer transition-colors mb-1
                        ${selectedProduct?.id === product.id
                          ? 'bg-medical text-white'
                          : 'hover:bg-white'
                        }`}
                    >
                      <p className="font-bold text-sm">{product.name}</p>
                      <p className={`text-xs ${selectedProduct?.id === product.id ? 'text-white/80' : 'text-slate-400'}`}>
                        Code: {product.code} | Stock: {product.quantity}
                      </p>
                      <p className={`text-xs font-bold mt-1 ${selectedProduct?.id === product.id ? 'text-white' : 'text-medical'}`}>
                        {formatPrice(product.purchase_price)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Selected product actions */}
              {selectedProduct && (
                <div className="mt-4 p-4 bg-medical-light/20 rounded-xl">
                  <h4 className="font-bold text-medical-dark mb-2">{selectedProduct.name}</h4>
                  <p className="text-xs text-slate-600 mb-3">
                    Stock actuel: {selectedProduct.quantity}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex items-center bg-white rounded-lg">
                      <button
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="p-3 hover:bg-slate-100 rounded-l-lg transition-colors"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-16 text-center font-bold">{quantity}</span>
                      <button
                        onClick={() => setQuantity(quantity + 1)}
                        className="p-3 hover:bg-slate-100 rounded-r-lg transition-colors"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <button
                      onClick={handleAddToCart}
                      className="flex-1 bg-medical text-white py-3 rounded-lg font-bold hover:bg-medical-dark transition-colors text-sm"
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right panel - Cart */}
            <div className={step === 'validation' || window.innerWidth >= 768 ? 'block' : 'hidden md:block'}>
              <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                <ShoppingCart size={18} />
                Panier d'achat ({cart.length})
              </h3>

              {/* Cart items */}
              <div className="bg-slate-50 rounded-xl p-4 max-h-[40vh] md:max-h-80 overflow-auto mb-4">
                {cart.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">Panier vide</p>
                ) : (
                  cart.map(item => (
                    <div key={item.product.id} className="bg-white p-3 rounded-lg mb-2">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm truncate">{item.product.name}</p>
                          <p className="text-xs text-slate-400">{item.product.code}</p>
                        </div>
                        <button
                          onClick={() => handleUpdateQuantity(item.product.id, 0)}
                          className="text-red-500 hover:text-red-700 p-1 flex-shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center bg-slate-50 rounded-lg">
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity - 1)}
                            className="p-2 hover:bg-slate-100 rounded-l-lg"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQuantity(item.product.id, item.quantity + 1)}
                            className="p-2 hover:bg-slate-100 rounded-r-lg"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <p className="font-bold text-sm">{formatPrice(item.total)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Form fields */}
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Fournisseur"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none focus:ring-4 focus:ring-medical/5"
                  />
                </div>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Référence"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-xl font-bold outline-none focus:ring-4 focus:ring-medical/5"
                  />
                </div>
                <textarea
                  placeholder="Notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border-none rounded-xl p-3 bg-slate-50 font-bold outline-none focus:ring-4 focus:ring-medical/5 resize-none"
                />
              </div>

              {/* Total and actions */}
              <div className="mt-4 p-4 bg-medical-light/20 rounded-xl">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-slate-600">Total:</span>
                  <span className="text-xl md:text-2xl font-black text-medical-dark">
                    {formatPrice(calculateTotal())}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={printTicket}
                    className="flex-1 bg-slate-200 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-300 transition-colors flex items-center justify-center gap-2 text-sm"
                  >
                    <Printer size={18} />
                    Ticket
                  </button>
                  <button
                    onClick={handleValidate}
                    disabled={loading || cart.length === 0}
                    className="flex-1 bg-success text-white py-3 rounded-lg font-bold hover:bg-success-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={18} />
                        ...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        Valider
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="md:hidden bg-white border-t border-slate-100 p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-slate-500">Total:</span>
            <span className="text-xl font-black text-medical-dark">
              {formatPrice(calculateTotal())}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStep('selection')}
              className={`p-3 rounded-xl font-bold transition-colors text-sm
                ${step === 'selection' ? 'bg-medical text-white' : 'bg-slate-100'}`}
            >
              Produits
            </button>
            <button
              onClick={() => setStep('validation')}
              className={`p-3 rounded-xl font-bold transition-colors text-sm relative
                ${step === 'validation' ? 'bg-medical text-white' : 'bg-slate-100'}`}
            >
              Panier
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}