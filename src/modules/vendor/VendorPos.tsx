// modules/vendor/VendorPos.tsx
import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Loader2,
  X,
  Package,
  Percent,
  Banknote,
  Phone,
  Users,
  WifiOff,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Clock,
  AlertTriangle,
  PackageX
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useOnline } from '@/hooks/useOnline';
import { posService, CartItem, Product, PaymentMethod, CurrencyConfig } from '@/services/posService';
import { useSaleStore } from '@/store/saleStore';
import { useToast } from '@/hooks/useToast';
import { Toaster } from '@/components/ui/Toaster';
import FacturePrinter from '../sales/views/FacturePrinter';
import { useAuthStore } from '@/store/useAuthStore';

// Types pour les statuts de produit
type ProductStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';

// Fonction pour déterminer le statut d'un produit
const getProductStatus = (
  product: Product, 
  lowStockThreshold: number = 10, 
  expiryWarningDays: number = 30
): ProductStatus => {
  const quantity = product.quantity || 0;
  const expiryDate = product.expiry_date;
  
  if (expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'expired';
    if (diffDays <= expiryWarningDays) return 'expiring_soon';
  }
  
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= lowStockThreshold) return 'low_stock';
  return 'in_stock';
};

// Composant pour afficher le statut du produit
const ProductStatusBadge = memo(({ status, stock }: { status: ProductStatus; stock: number }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'out_of_stock':
        return {
          icon: PackageX,
          text: 'Rupture',
          className: 'bg-red-100 text-red-700'
        };
      case 'low_stock':
        return {
          icon: AlertTriangle,
          text: `Stock bas (${stock})`,
          className: 'bg-amber-100 text-amber-700'
        };
      case 'expired':
        return {
          icon: PackageX,
          text: 'Expiré',
          className: 'bg-red-100 text-red-700'
        };
      case 'expiring_soon':
        return {
          icon: Clock,
          text: 'Expire bientôt',
          className: 'bg-orange-100 text-orange-700'
        };
      default:
        return {
          icon: CheckCircle,
          text: 'En stock',
          className: 'bg-green-100 text-green-700'
        };
    }
  };

  const configStatus = getStatusConfig();
  const Icon = configStatus.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${configStatus.className}`}>
      <Icon size={10} />
      {configStatus.text}
    </span>
  );
});

ProductStatusBadge.displayName = 'ProductStatusBadge';

// Composant d'auto-complétion pour la recherche
const SearchAutocomplete = memo(({ 
  searchValue, 
  products, 
  onSelectSuggestion,
  inputRef,
  currencyMode,
  currencies,
  exchangeRate,
  lowStockThreshold,
  expiryWarningDays
}: {
  searchValue: string;
  products: Product[];
  onSelectSuggestion: (product: Product) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  currencyMode: 'cdf_only' | 'usd_only' | 'both';
  currencies: CurrencyConfig[];
  exchangeRate: number;
  lowStockThreshold: number;
  expiryWarningDays: number;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);
  const searchAbortRef = useRef<number | null>(null);

  // Filtrer les suggestions par ordre alphabétique
  const filteredSuggestions = useMemo(() => {
    if (!searchValue.trim()) return [];
    
    const term = searchValue.toLowerCase().trim();
    
    // Filtrer les produits qui correspondent
    const matched = products.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.code?.toLowerCase().includes(term) ||
      p.barcode?.toLowerCase().includes(term)
    );
    
    // Trier par ordre alphabétique sur le nom
    const sorted = [...matched].sort((a, b) => {
      const aStartsWith = a.name.toLowerCase().startsWith(term);
      const bStartsWith = b.name.toLowerCase().startsWith(term);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return a.name.localeCompare(b.name, 'fr');
    });
    
    return sorted.slice(0, 15);
  }, [products, searchValue]);

  // Gérer l'affichage des suggestions avec debounce
  useEffect(() => {
    if (searchAbortRef.current) {
      clearTimeout(searchAbortRef.current);
    }
    
    searchAbortRef.current = window.setTimeout(() => {
      setShowSuggestions(filteredSuggestions.length > 0);
      setSelectedIndex(-1);
    }, 100);
    
    return () => {
      if (searchAbortRef.current) {
        clearTimeout(searchAbortRef.current);
      }
    };
  }, [filteredSuggestions]);

  // Gérer le clic en dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        if (!isSelectingRef.current) {
          setShowSuggestions(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Gérer les touches clavier
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredSuggestions.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredSuggestions.length) % filteredSuggestions.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
          isSelectingRef.current = true;
          onSelectSuggestion(filteredSuggestions[selectedIndex]);
          setShowSuggestions(false);
          setSelectedIndex(-1);
          setTimeout(() => {
            isSelectingRef.current = false;
          }, 200);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  }, [showSuggestions, filteredSuggestions, selectedIndex, onSelectSuggestion]);

  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;

    inputElement.addEventListener('keydown', handleKeyDown);
    return () => {
      inputElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef, handleKeyDown]);

  const getPriceDisplay = (price: number) => {
    const priceInUSD = price / exchangeRate;
    
    if (currencyMode === 'cdf_only') {
      const cdfCurrency = currencies.find(c => c.code === 'CDF');
      return `${cdfCurrency?.symbol || 'FC'} ${price.toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      const usdCurrency = currencies.find(c => c.code === 'USD');
      return `${usdCurrency?.symbol || '$'} ${priceInUSD.toFixed(2)}`;
    }
    const cdfCurrency = currencies.find(c => c.code === 'CDF');
    const usdCurrency = currencies.find(c => c.code === 'USD');
    return `${cdfCurrency?.symbol || 'FC'} ${price.toFixed(2)} / ${usdCurrency?.symbol || '$'} ${priceInUSD.toFixed(2)}`;
  };

  if (!showSuggestions) return null;

  return (
    <div ref={suggestionsRef} className="absolute left-0 right-0 top-full z-50 mt-1">
      <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
        {filteredSuggestions.map((product, index) => {
          const status = getProductStatus(product, lowStockThreshold, expiryWarningDays);
          const isAvailable = status !== 'out_of_stock' && status !== 'expired';
          return (
            <button
              key={product.id}
              onClick={() => {
                if (!isAvailable) return;
                isSelectingRef.current = true;
                onSelectSuggestion(product);
                setShowSuggestions(false);
                setSelectedIndex(-1);
                setTimeout(() => {
                  isSelectingRef.current = false;
                }, 200);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              disabled={!isAvailable}
              className={`w-full px-4 py-3 text-left transition-colors ${
                index === selectedIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/50' 
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700'
              } ${index !== filteredSuggestions.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''} ${
                !isAvailable ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {product.name}
                    </p>
                    <ProductStatusBadge status={status} stock={product.quantity} />
                  </div>
                  <p className="text-xs text-slate-400">
                    Code: {product.code} {product.barcode && `· Barre: ${product.barcode}`}
                  </p>
                  {status !== 'in_stock' && status !== 'expiring_soon' && (
                    <p className="text-xs text-red-500 mt-1">
                      {status === 'out_of_stock' && 'Rupture de stock'}
                      {status === 'expired' && 'Produit expiré'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-blue-600">
                    {getPriceDisplay(product.selling_price)}
                  </p>
                  <p className="text-xs text-slate-400">
                    Stock: {product.quantity}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

SearchAutocomplete.displayName = 'SearchAutocomplete';

// Composant pour le panier (modal)
const CartModal = memo(({ 
  isOpen, 
  onClose, 
  cart, 
  onUpdateQuantity, 
  onRemove, 
  onValidate,
  onUpdateDiscount,
  globalDiscount,
  setGlobalDiscount,
  paymentMethod,
  setPaymentMethod,
  isProcessing,
  currencyMode,
  currencies,
  exchangeRate,
  totalCDF,
  totalUSD,
  subtotalCDF,
  subtotalUSD,
  discountAmountCDF,
  discountAmountUSD,
  totalItems
}: {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onValidate: () => void;
  onUpdateDiscount: (index: number, discountPercent: number) => void;
  globalDiscount: number;
  setGlobalDiscount: (value: number) => void;
  paymentMethod: PaymentMethod;
  setPaymentMethod: (method: PaymentMethod) => void;
  isProcessing: boolean;
  currencyMode: 'cdf_only' | 'usd_only' | 'both';
  currencies: CurrencyConfig[];
  exchangeRate: number;
  totalCDF: number;
  totalUSD: number;
  subtotalCDF: number;
  subtotalUSD: number;
  discountAmountCDF: number;
  discountAmountUSD: number;
  totalItems: number;
}) => {
  const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
    cash: 'Espèces',
    mobile_money: 'Mobile Money',
    account: 'Compte',
  };

  const getCurrency = (code: string) => currencies.find(c => c.code === code);
  const cdfCurrency = getCurrency('CDF');
  const usdCurrency = getCurrency('USD');

  const formatPrice = (priceCDF: number, priceUSD: number) => {
    if (currencyMode === 'cdf_only') {
      return `${cdfCurrency?.symbol || 'FC'} ${priceCDF.toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      return `${usdCurrency?.symbol || '$'} ${priceUSD.toFixed(2)}`;
    }
    return `${cdfCurrency?.symbol || 'FC'} ${priceCDF.toFixed(2)} / ${usdCurrency?.symbol || '$'} ${priceUSD.toFixed(2)}`;
  };

  const formatTotal = formatPrice(totalCDF, totalUSD);
  const formatSubtotal = formatPrice(subtotalCDF, subtotalUSD);
  const formatDiscount = formatPrice(discountAmountCDF, discountAmountUSD);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
      <div className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl dark:bg-slate-800 sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-blue-600" />
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-200">
              Panier
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                {totalItems}
              </span>
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-4">
          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm italic text-slate-400">
              Panier vide
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => {
                const unitPriceInCDF = item.unitPrice || 0;
                const subtotalCDFItem = unitPriceInCDF * (item.quantity || 0);
                const discountPercent = item.discount_percent || 0;
                const discountAmountCDFItem = subtotalCDFItem * (discountPercent / 100);
                const totalCDFItem = subtotalCDFItem - discountAmountCDFItem;
                const totalUSDItem = totalCDFItem / exchangeRate;
                const unitPriceUSD = unitPriceInCDF / exchangeRate;

                return (
                  <div key={item.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-700/50">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {formatPrice(unitPriceInCDF, unitPriceUSD)}/u · Stock: {item.stock}
                        </p>
                        {discountPercent > 0 && (
                          <p className="text-xs text-green-600">
                            Remise: {discountPercent}% (-{formatPrice(discountAmountCDFItem, discountAmountCDFItem / exchangeRate)})
                          </p>
                        )}
                      </div>
                      <button onClick={() => onRemove(index)} className="text-red-400 transition-colors hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQuantity(index, -1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="min-w-5 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          onClick={() => onUpdateQuantity(index, 1)}
                          disabled={item.quantity >= (item.stock || 0)}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            const newDiscount = prompt('Remise en % (0-100):', String(discountPercent));
                            if (newDiscount !== null) {
                              const val = parseFloat(newDiscount);
                              if (!isNaN(val) && val >= 0 && val <= 100) {
                                onUpdateDiscount(index, val);
                              }
                            }
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800"
                        >
                          <Percent size={12} />
                        </button>
                        <p className="text-sm font-black text-blue-600">
                          {formatPrice(totalCDFItem, totalUSDItem)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-700/50">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
              <span>Sous-total</span>
              <span>{formatSubtotal}</span>
            </div>

            {cart.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Percent size={16} className="text-green-600" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Remise globale</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={globalDiscount}
                    onChange={(e) => setGlobalDiscount(parseFloat(e.target.value) || 0)}
                    className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm dark:border-slate-600 dark:bg-slate-700"
                  />
                  <span className="text-sm">%</span>
                </div>
              </div>
            )}

            {globalDiscount > 0 && (
              <div className="flex items-center justify-between text-sm text-green-600">
                <span>Remise</span>
                <span>-{formatDiscount}</span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-200 pt-2 text-lg font-black text-slate-800 dark:border-slate-600 dark:text-slate-200">
              <span>Total</span>
              <span className="text-xl text-blue-600">{formatTotal}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              {(['cash', 'mobile_money', 'account'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`rounded-xl p-2 transition-all ${
                    paymentMethod === method
                      ? 'bg-blue-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {method === 'cash' && <Banknote size={16} />}
                    {method === 'mobile_money' && <Phone size={16} />}
                    {method === 'account' && <Users size={16} />}
                    <span className="text-[10px] font-bold">{PAYMENT_METHOD_LABELS[method]}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={onValidate}
              disabled={cart.length === 0 || isProcessing}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600"
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <CheckCircle size={18} />
              )}
              {isProcessing ? 'Traitement...' : 'Valider la vente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

CartModal.displayName = 'CartModal';

// Composant principal VendorPos
const VendorPos = observer(() => {
  const isOnline = useOnline();
  const { toast } = useToast();
  const { user } = useAuthStore(); // Récupérer l'utilisateur connecté
  
  const { getPendingCount, syncPendingSales, resetFailedSales, localSales, syncInProgress: storeSyncInProgress } = useSaleStore();

  const [loading, setLoading] = useState(true);
  const [showCartModal, setShowCartModal] = useState(false);
  const [showProductsModal, setShowProductsModal] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);
  const [productsPage, setProductsPage] = useState(1);
  const [productsSearch, setProductsSearch] = useState('');
  const [currentSaleForInvoice, setCurrentSaleForInvoice] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const products = posService.products;
  const cart = posService.cart;
  const paymentMethod = posService.paymentMethod;
  const cashierInfo = posService.cashierInfo;
  const config = posService.config;
  const isProcessing = posService.isProcessing;

  const pendingCount = getPendingCount();
  
  const failedSales = useMemo(() => 
    localSales.filter(s => !s.synced && (s.retryCount || 0) >= 3),
    [localSales]
  );

  // Ajouter un effet pour logger les infos de l'utilisateur et de la branche
  useEffect(() => {
    console.log('=== VendorPos - Informations utilisateur ===');
    console.log('User from auth:', user);
    console.log('User pharmacy_id:', user?.pharmacy_id);
    console.log('User branche_id:', user?.branch_id);
    console.log('User current_pharmacy:', user?.current_pharmacy);
    console.log('CashierInfo:', cashierInfo);
    console.log('CashierInfo pharmacy_id:', cashierInfo.pharmacy_id);
    console.log('===========================================');
  }, [user, cashierInfo]);

  // Déterminer le mode de devise
  const currencyMode = useMemo(() => {
    const currencies = config.currencies;
    if (currencies.length === 0) return 'both';
    const activeCurrencies = currencies.filter(c => c.isActive);
    const hasCDF = activeCurrencies.some(c => c.code === 'CDF');
    const hasUSD = activeCurrencies.some(c => c.code === 'USD');
    if (hasCDF && !hasUSD) return 'cdf_only';
    if (hasUSD && !hasCDF) return 'usd_only';
    return 'both';
  }, [config.currencies]);

  const activeCurrency = useMemo(() => {
    const currencies = config.currencies || [];
    const currency = currencies.find(c => c.code === config.primaryCurrency);
    return currency || { code: 'CDF', symbol: 'FC', exchangeRate: 1, isActive: true };
  }, [config.currencies, config.primaryCurrency]);

  // Calculs du panier
  const subtotalCDF = useMemo(() => {
    return cart.reduce((acc, item) => {
      const itemPrice = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscount = itemPrice * ((item.discount_percent || 0) / 100);
      return acc + (itemPrice - itemDiscount);
    }, 0);
  }, [cart]);

  const totalCDF = useMemo(() => {
    return subtotalCDF * (1 - (globalDiscount / 100));
  }, [subtotalCDF, globalDiscount]);

  const totalUSD = useMemo(() => {
    return totalCDF / activeCurrency.exchangeRate;
  }, [totalCDF, activeCurrency.exchangeRate]);

  const subtotalUSD = useMemo(() => {
    return subtotalCDF / activeCurrency.exchangeRate;
  }, [subtotalCDF, activeCurrency.exchangeRate]);

  const discountAmountCDF = useMemo(() => {
    return subtotalCDF * (globalDiscount / 100);
  }, [subtotalCDF, globalDiscount]);

  const discountAmountUSD = useMemo(() => {
    return discountAmountCDF / activeCurrency.exchangeRate;
  }, [discountAmountCDF, activeCurrency.exchangeRate]);

  const totalItems = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.quantity || 0), 0);
  }, [cart]);

  // Produits filtrés pour la modal produits - TRI ALPHABÉTIQUE
  const filteredProductsForModal = useMemo(() => {
    let filtered = [...products];
    
    if (productsSearch.trim()) {
      const term = productsSearch.toLowerCase().trim();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      );
    }
    
    // Tri alphabétique sur le nom
    return filtered.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [products, productsSearch]);

  const ITEMS_PER_PAGE = 20;
  const totalPages = Math.ceil(filteredProductsForModal.length / ITEMS_PER_PAGE);
  const paginatedProducts = filteredProductsForModal.slice(
    (productsPage - 1) * ITEMS_PER_PAGE,
    productsPage * ITEMS_PER_PAGE
  );

  // Chargement des seuils
  useEffect(() => {
    const loadThresholds = async () => {
      try {
        const pharmacyId = cashierInfo.pharmacy_id;
        if (pharmacyId) {
          const pharmacyConfig = await import('@/services/inventoryService').then(m => m.inventoryService.getPharmacyConfig(pharmacyId));
          setLowStockThreshold(pharmacyConfig.lowStockThreshold || 10);
          setExpiryWarningDays(pharmacyConfig.expiryWarningDays || 30);
        }
      } catch (error) {
        console.warn('Erreur chargement seuils:', error);
      }
    };
    loadThresholds();
  }, [cashierInfo.pharmacy_id]);

  // Chargement initial - C'EST ICI QUE LES PRODUITS SONT RÉCUPÉRÉS
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        console.log('=== Chargement initial VendorPos ===');
        console.log('Pharmacy ID avant chargement:', cashierInfo.pharmacy_id);
        console.log('User pharmacy_id:', user?.pharmacy_id);
        
        // Si le pharmacy_id n'est pas défini dans cashierInfo, le définir à partir du user
        if (!cashierInfo.pharmacy_id && user?.pharmacy_id) {
          console.log('Définition du pharmacy_id dans cashierInfo:', user.pharmacy_id);
          posService.setCashierInfo({ pharmacy_id: user.pharmacy_id });
        }
        
        // posService.loadInitialData() appelle loadProducts() qui récupère les produits via inventoryService
        await posService.loadInitialData();
        console.log('Produits chargés:', posService.products.length);
        console.log('Premier produit:', posService.products[0]);
        
        if (isOnline) {
          await syncPendingSales();
        }
      } catch (error) {
        console.error('Erreur chargement:', error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les données",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [toast, isOnline, syncPendingSales, user]);

  // Synchronisation périodique
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !storeSyncInProgress) {
      syncPendingSales();
    }
  }, [isOnline, pendingCount, syncPendingSales, storeSyncInProgress]);

  useEffect(() => {
    if (!isOnline) return;
    const interval = setInterval(() => {
      if (pendingCount > 0 && !storeSyncInProgress) {
        syncPendingSales();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [isOnline, pendingCount, syncPendingSales, storeSyncInProgress]);

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape' && showCartModal) {
        setShowCartModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCartModal]);

  const handleSelectSuggestion = useCallback((product: Product) => {
    if (product.quantity <= 0) {
      toast({
        title: "Rupture de stock",
        description: `${product.name} n'est plus disponible`,
        variant: "destructive",
      });
      return;
    }
    posService.addToCart(product);
    posService.setSearch('');
    searchInputRef.current?.focus();
    toast({
      title: "Ajouté au panier",
      description: `${product.name} a été ajouté`,
      variant: "success",
    });
  }, [toast]);

  const handleUpdateQuantity = useCallback((index: number, delta: number) => {
    posService.updateQuantity(index, delta);
  }, []);

  const handleUpdateDiscount = useCallback((index: number, discountPercent: number) => {
    const newCart = [...cart];
    if (newCart[index]) {
      newCart[index] = { ...newCart[index], discount_percent: discountPercent };
      posService.setCart(newCart);
    }
  }, [cart]);

  const handleRemoveFromCart = useCallback((index: number) => {
    posService.removeFromCart(index);
  }, []);

  // Validation de la vente avec création de la facture
  const handleValidateSale = useCallback(async () => {
    if (cart.length === 0) {
      toast({
        title: "Panier vide",
        description: "Ajoutez des produits avant de valider",
        variant: "destructive",
      });
      return;
    }
    
    if (isProcessing || isProcessingSale) {
      toast({
        title: "Vente en cours",
        description: "Une vente est déjà en cours de validation",
        variant: "warning",
      });
      return;
    }

    setIsProcessingSale(true);
    setShowCartModal(false);
    
    // Créer un objet sale pour la facture
    const timestamp = Date.now();
    const tempId = `local_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    const saleForInvoice = {
      id: tempId,
      receiptNumber: `TEMP-${timestamp}`,
      items: cart.map(item => ({
        id: item.id,
        name: item.name,
        price: item.unitPrice,
        quantity: item.quantity,
        code: item.code,
        discount_percent: item.discount_percent || 0,
        discount_amount: ((item.unitPrice * item.quantity) * ((item.discount_percent || 0) / 100))
      })),
      subtotal: subtotalCDF,
      total: totalCDF,
      discount_percent: globalDiscount,
      discount_amount: discountAmountCDF,
      paymentMethod: paymentMethod,
      timestamp: timestamp,
      cashierName: cashierInfo.name,
      cashierId: cashierInfo.id,
      posName: cashierInfo.posName,
      branchId: cashierInfo.pharmacy_id,
      sessionNumber: cashierInfo.sessionNumber,
      customerName: posService.customerName,
    };
    
    setCurrentSaleForInvoice(saleForInvoice);
    
    try {
      // Appliquer la remise globale si nécessaire
      if (globalDiscount > 0) {
        const newCart = cart.map(item => ({
          ...item,
          discount_percent: Math.min(100, (item.discount_percent || 0) + globalDiscount)
        }));
        posService.setCart(newCart);
      }
      
      // Créer la vente via posService (qui utilise saleStore)
      await posService.validateSale();
      
      setGlobalDiscount(0);
      
      toast({
        title: "Succès",
        description: "Vente enregistrée avec succès",
        variant: "success",
      });
      
      // Afficher la facture
      setShowInvoice(true);
      
    } catch (error) {
      console.error('Erreur validation:', error);
      toast({
        title: "Erreur",
        description: "La validation de la vente a échoué",
        variant: "destructive",
      });
      setCurrentSaleForInvoice(null);
    } finally {
      setIsProcessingSale(false);
    }
  }, [cart, isProcessing, isProcessingSale, globalDiscount, toast, posService, subtotalCDF, totalCDF, paymentMethod, cashierInfo, discountAmountCDF]);

  const handleResetFailedSales = useCallback(() => {
    resetFailedSales();
    toast({
      title: "Réessai",
      description: "Tentative de synchronisation des ventes en échec",
      variant: "default",
    });
  }, [resetFailedSales, toast]);

  const handleAddProductFromModal = useCallback((product: Product) => {
    if (product.quantity <= 0) {
      toast({
        title: "Rupture de stock",
        description: `${product.name} n'est plus disponible`,
        variant: "destructive",
      });
      return;
    }
    posService.addToCart(product);
    toast({
      title: "Ajouté au panier",
      description: `${product.name} a été ajouté`,
      variant: "success",
    });
  }, [toast]);

  const handleCloseInvoice = useCallback(() => {
    setShowInvoice(false);
    setCurrentSaleForInvoice(null);
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
          <p className="text-slate-600 dark:text-slate-400">Chargement de la caisse vendeur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Toaster />

      {/* Bannières de synchronisation */}
      {pendingCount > 0 && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          {storeSyncInProgress ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} className="animate-spin" />
          )}
          {pendingCount} vente(s) en attente de synchronisation
        </div>
      )}

      {failedSales.length > 0 && !pendingCount && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-red-500 px-4 py-2 text-sm font-medium text-white">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {failedSales.length} vente(s) en échec
          </div>
          <button
            onClick={handleResetFailedSales}
            className="rounded-lg bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
          >
            <RefreshCw size={12} className="inline mr-1" />
            Réessayer
          </button>
        </div>
      )}

      {!isOnline && pendingCount === 0 && failedSales.length === 0 && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          <WifiOff size={16} />
          Mode hors-ligne - Les ventes seront synchronisées plus tard
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600 px-3 py-1.5 text-lg font-black text-white">
              {config.pharmacyInfo?.name?.charAt(0) || 'P'}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {config.pharmacyInfo?.name || 'Pharmacie'}
              </p>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 dark:bg-slate-700">
              <div className="h-6 w-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                <span className="text-xs font-bold">
                  {cashierInfo?.name?.charAt(0) || 'V'}
                </span>
              </div>
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {cashierInfo?.name || 'Vendeur'}
              </span>
            </div>
            {!isOnline && <WifiOff size={16} className="text-amber-500" />}
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="p-4">
        {/* Barre de recherche principale */}
        <div className="relative mb-4">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input
            ref={searchInputRef}
            type="text"
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 text-lg outline-none transition-shadow focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            placeholder="Rechercher un produit (nom, code, code-barres)..."
            value={posService.search}
            onChange={(e) => posService.setSearch(e.target.value)}
            autoFocus
          />
          <SearchAutocomplete
            searchValue={posService.search}
            products={products}
            onSelectSuggestion={handleSelectSuggestion}
            inputRef={searchInputRef}
            currencyMode={currencyMode}
            currencies={config.currencies}
            exchangeRate={activeCurrency.exchangeRate}
            lowStockThreshold={lowStockThreshold}
            expiryWarningDays={expiryWarningDays}
          />
        </div>

        {/* Indicateur de mode devise */}
        <div className="mb-4 flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs dark:bg-amber-900/20">
          <div className="flex items-center gap-2">
            <DollarSign size={14} className="text-amber-600" />
            <span className="text-amber-700 dark:text-amber-400">
              {currencyMode === 'cdf_only' && 'Vente en FC'}
              {currencyMode === 'usd_only' && 'Vente en USD'}
              {currencyMode === 'both' && 'Vente en FC / USD'}
            </span>
          </div>
          {cart.length > 0 && (
            <div className="text-amber-700 dark:text-amber-400">
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Raccourci clavier */}
        <div className="mb-4 rounded-xl bg-slate-100 px-3 py-2 text-center text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          ⌘/Ctrl + K pour rechercher
        </div>

        {/* Boutons d'action */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowProductsModal(true)}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-4 font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
          >
            <Package size={20} />
            Voir produits ({products.length})
          </button>
          
          <button
            onClick={() => setShowCartModal(true)}
            className="relative flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <ShoppingCart size={20} />
            Panier
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Résumé rapide du panier si non vide */}
        {cart.length > 0 && (
          <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Total</p>
                <p className="text-xl font-black text-blue-600">
                  {currencyMode === 'cdf_only' 
                    ? `${config.currencies.find(c => c.code === 'CDF')?.symbol || 'FC'} ${totalCDF.toFixed(2)}`
                    : currencyMode === 'usd_only'
                    ? `${config.currencies.find(c => c.code === 'USD')?.symbol || '$'} ${totalUSD.toFixed(2)}`
                    : `${config.currencies.find(c => c.code === 'CDF')?.symbol || 'FC'} ${totalCDF.toFixed(2)}`
                  }
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-400">Articles</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-200">{totalItems}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCartModal(true)}
              className="mt-3 w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white"
            >
              Voir le panier et valider
            </button>
          </div>
        )}
      </main>

      {/* Modal Panier */}
      <CartModal
        isOpen={showCartModal}
        onClose={() => setShowCartModal(false)}
        cart={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onRemove={handleRemoveFromCart}
        onValidate={handleValidateSale}
        onUpdateDiscount={handleUpdateDiscount}
        globalDiscount={globalDiscount}
        setGlobalDiscount={setGlobalDiscount}
        paymentMethod={paymentMethod}
        setPaymentMethod={(method) => posService.setPaymentMethod(method)}
        isProcessing={isProcessing || isProcessingSale}
        currencyMode={currencyMode}
        currencies={config.currencies}
        exchangeRate={activeCurrency.exchangeRate}
        totalCDF={totalCDF}
        totalUSD={totalUSD}
        subtotalCDF={subtotalCDF}
        subtotalUSD={subtotalUSD}
        discountAmountCDF={discountAmountCDF}
        discountAmountUSD={discountAmountUSD}
        totalItems={totalItems}
      />

      {/* Modal Produits */}
      {showProductsModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-2xl dark:bg-slate-800 sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
              <h3 className="flex items-center gap-2 text-lg font-black text-slate-800 dark:text-slate-200">
                <Package size={20} />
                Tous les produits ({filteredProductsForModal.length})
              </h3>
              <button
                onClick={() => {
                  setShowProductsModal(false);
                  setProductsSearch('');
                  setProductsPage(1);
                }}
                className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Filtrer les produits..."
                  className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700"
                  value={productsSearch}
                  onChange={(e) => {
                    setProductsSearch(e.target.value);
                    setProductsPage(1);
                  }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-0">
              <div className="grid gap-2">
                {paginatedProducts.map((product) => {
                  const isAvailable = (product.quantity || 0) > 0;
                  const status = getProductStatus(product, lowStockThreshold, expiryWarningDays);
                  return (
                    <div
                      key={product.id}
                      className={`flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-700 ${
                        !isAvailable ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-800 dark:text-slate-200">{product.name}</p>
                          <ProductStatusBadge status={status} stock={product.quantity} />
                        </div>
                        <p className="text-xs text-slate-400">Code: {product.code}</p>
                        <p className="text-xs text-slate-400">Stock: {product.quantity || 0}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-blue-600">
                          {currencyMode === 'cdf_only' 
                            ? `${config.currencies.find(c => c.code === 'CDF')?.symbol || 'FC'} ${(product.selling_price || 0).toFixed(2)}`
                            : currencyMode === 'usd_only'
                            ? `${config.currencies.find(c => c.code === 'USD')?.symbol || '$'} ${((product.selling_price || 0) / activeCurrency.exchangeRate).toFixed(2)}`
                            : `${config.currencies.find(c => c.code === 'CDF')?.symbol || 'FC'} ${(product.selling_price || 0).toFixed(2)}`
                          }
                        </p>
                        <button
                          onClick={() => {
                            handleAddProductFromModal(product);
                            if (isAvailable) {
                              setShowProductsModal(false);
                              setProductsSearch('');
                              setProductsPage(1);
                            }
                          }}
                          disabled={!isAvailable}
                          className={`mt-1 rounded-lg px-3 py-1 text-xs font-semibold ${
                            isAvailable
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'cursor-not-allowed bg-slate-200 text-slate-400'
                          }`}
                        >
                          Ajouter
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {paginatedProducts.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  Aucun produit trouvé
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setProductsPage(p => Math.max(1, p - 1))}
                    disabled={productsPage === 1}
                    className="rounded-lg border border-slate-200 p-1 disabled:opacity-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm">
                    Page {productsPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setProductsPage(p => Math.min(totalPages, p + 1))}
                    disabled={productsPage === totalPages}
                    className="rounded-lg border border-slate-200 p-1 disabled:opacity-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Facture avec FacturePrinter */}
      {showInvoice && currentSaleForInvoice && (
        <FacturePrinter
          sale={currentSaleForInvoice}
          pharmacyId={cashierInfo.pharmacy_id}
          onClose={handleCloseInvoice}
          onPrint={() => {
            // Optionnel: actions supplémentaires après impression
          }}
        />
      )}
    </div>
  );
});

export default VendorPos;