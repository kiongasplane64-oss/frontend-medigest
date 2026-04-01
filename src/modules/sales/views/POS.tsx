// modules/sales/views/POS.tsx
import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  Search,
  Trash2,
  Banknote,
  Loader2,
  CheckCircle,
  Phone,
  Users,
  Package,
  BarChart3,
  Settings,
  ShoppingCart,
  History,
  FileText,
  TrendingUp,
  Plus,
  Minus,
  User,
  Camera,
  Barcode,
  AlertCircle,
  X,
  ScanLine,
  RefreshCw,
  WifiOff,
  DollarSign,
  Building2,
  Percent,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
  Clock,
  PackageX
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { observer } from 'mobx-react-lite';
import { useOnline } from '@/hooks/useOnline';
import { FacturePrinter } from '@/modules/sales/views/FacturePrinter';
import { posService, CartItem, Product, Category, CashierInfo, PaymentMethod, ScanMode } from '@/services/posService';
import type { CurrencyConfig, PharmacyConfig } from '@/services/posService';
import { useSaleStore} from '@/store/saleStore';
import { useToast } from '@/hooks/useToast';
import { Toaster } from '@/components/ui/Toaster';

export type { CartItem, Product, Category, CashierInfo, PaymentMethod, ScanMode, CurrencyConfig, PharmacyConfig };

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  account: 'Compte',
};

const ITEMS_PER_PAGE = 50;

// Types pour les statuts de produit
type ProductStatus = 'in_stock' | 'low_stock' | 'out_of_stock' | 'expiring_soon' | 'expired';

interface ProductWithStatus extends Product {
  status: ProductStatus;
  statusMessage: string;
  daysUntilExpiry?: number;
}

// Composant pour la pagination
const Pagination = memo(({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) => {
  const getPageNumbers = (): (number | string)[] => {
    const delta = 2;
    const range: number[] = [];
    const rangeWithDots: (number | string)[] = [];
    let l: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l !== undefined) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
      >
        <ChevronsLeft size={16} />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
      >
        <ChevronLeft size={16} />
      </button>
      
      <div className="flex gap-1">
        {getPageNumbers().map((page, idx) => (
          page === '...' ? (
            <span key={`dots-${idx}`} className="flex h-8 w-8 items-center justify-center text-slate-400">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page as number)}
              className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors ${
                currentPage === page
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400'
              }`}
            >
              {page}
            </button>
          )
        ))}
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
      >
        <ChevronRight size={16} />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400"
      >
        <ChevronsRight size={16} />
      </button>
    </div>
  );
});

Pagination.displayName = 'Pagination';

// Composant pour afficher le statut du produit
const ProductStatusBadge = memo(({ status, stock, expiryDate }: { status: ProductStatus; stock: number; expiryDate?: string }) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'out_of_stock':
        return {
          icon: PackageX,
          text: 'Rupture',
          className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          tooltip: 'Produit en rupture de stock'
        };
      case 'low_stock':
        return {
          icon: AlertTriangle,
          text: `Stock bas (${stock})`,
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
          tooltip: `Stock restant: ${stock} unité(s)`
        };
      case 'expired':
        return {
          icon: PackageX,
          text: 'Expiré',
          className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
          tooltip: 'Produit expiré'
        };
      case 'expiring_soon':
        return {
          icon: Clock,
          text: 'Expire bientôt',
          className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
          tooltip: expiryDate ? `Expire le ${new Date(expiryDate).toLocaleDateString('fr-FR')}` : 'Expire bientôt'
        };
      default:
        return {
          icon: CheckCircle,
          text: 'En stock',
          className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
          tooltip: 'Disponible'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.className}`} title={config.tooltip}>
      <Icon size={10} />
      {config.text}
    </span>
  );
});

ProductStatusBadge.displayName = 'ProductStatusBadge';

// Composant pour afficher le prix selon le mode de devise
const PriceDisplay = memo(({ 
  price, 
  currencyMode, 
  currencies,
  exchangeRate 
}: { 
  price: number; 
  currencyMode: 'cdf_only' | 'usd_only' | 'both';
  primaryCurrency: string;
  currencies: CurrencyConfig[];
  exchangeRate: number;
}) => {
  const getCurrency = (code: string) => currencies.find(c => c.code === code);
  const cdfCurrency = getCurrency('CDF');
  const usdCurrency = getCurrency('USD');
  
  const cdfPrice = currencyMode === 'usd_only' ? price * exchangeRate : price;
  const usdPrice = currencyMode === 'cdf_only' ? price / exchangeRate : price;

  if (currencyMode === 'cdf_only') {
    return (
      <span className="text-sm font-bold text-blue-600">
        {cdfCurrency?.symbol || 'FC'} {cdfPrice.toFixed(2)}
      </span>
    );
  }
  
  if (currencyMode === 'usd_only') {
    return (
      <span className="text-sm font-bold text-blue-600">
        {usdCurrency?.symbol || '$'} {usdPrice.toFixed(2)}
      </span>
    );
  }
  
  // Mode both - afficher les deux prix
  return (
    <div className="flex flex-col">
      <span className="text-sm font-bold text-blue-600">
        {cdfCurrency?.symbol || 'FC'} {cdfPrice.toFixed(2)}
      </span>
      <span className="text-xs text-slate-400">
        {usdCurrency?.symbol || '$'} {usdPrice.toFixed(2)}
      </span>
    </div>
  );
});

PriceDisplay.displayName = 'PriceDisplay';

// Composant produit sous forme de ligne de tableau avec statut
const ProductRow = memo(({ 
  product, 
  onAdd,
  currencyMode,
  primaryCurrency,
  currencies,
  exchangeRate,
  index
}: { 
  product: ProductWithStatus; 
  onAdd: (product: ProductWithStatus) => void;
  currencyMode: 'cdf_only' | 'usd_only' | 'both';
  primaryCurrency: string;
  currencies: CurrencyConfig[];
  exchangeRate: number;
  index: number;
}) => {
  const isAvailable = product.status !== 'out_of_stock' && product.status !== 'expired';
  const sellingPrice = product.selling_price || 0;
  

  return (
    <tr 
      className={`border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50 ${
        !isAvailable ? 'opacity-60' : ''
      }`}
    >
      <td className="px-4 py-3">
        <span className="text-xs text-slate-400">{index + 1}</span>
      </td>
      <td className="px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium text-slate-800 dark:text-slate-200">{product.name}</p>
            <ProductStatusBadge 
              status={product.status} 
              stock={product.quantity} 
              expiryDate={product.expiry_date}
            />
          </div>
          <p className="text-xs text-slate-400">Code: {product.code}</p>
          {product.barcode && (
            <p className="text-xs text-slate-400">Barre: {product.barcode}</p>
          )}
          {product.statusMessage && product.status !== 'in_stock' && (
            <p className="text-xs text-red-500 mt-1">{product.statusMessage}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <PriceDisplay
          price={sellingPrice}
          currencyMode={currencyMode}
          primaryCurrency={primaryCurrency}
          currencies={currencies}
          exchangeRate={exchangeRate}
        />
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
          product.quantity > 10 ? 'bg-green-100 text-green-700' :
          product.quantity > 0 ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          {product.quantity || 0}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={() => onAdd(product)}
          disabled={!isAvailable}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            isAvailable
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-slate-600'
          }`}
          title={!isAvailable ? (product.status === 'expired' ? 'Produit expiré' : 'Rupture de stock') : 'Ajouter au panier'}
        >
          Ajouter
        </button>
      </td>
    </tr>
  );
});

ProductRow.displayName = 'ProductRow';

// Fonction pour déterminer le statut d'un produit
const getProductStatus = (product: Product, lowStockThreshold: number = 10, expiryWarningDays: number = 30): ProductWithStatus => {
  const quantity = product.quantity || 0;
  const expiryDate = product.expiry_date;
  
  let status: ProductStatus = 'in_stock';
  let statusMessage = '';
  let daysUntilExpiry: number | undefined;
  
  // Vérifier l'expiration
  if (expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysUntilExpiry = diffDays;
    
    if (diffDays < 0) {
      status = 'expired';
      statusMessage = `Expiré depuis le ${new Date(expiryDate).toLocaleDateString('fr-FR')}`;
    } else if (diffDays <= expiryWarningDays) {
      status = 'expiring_soon';
      statusMessage = `Expire dans ${diffDays} jour(s)`;
    }
  }
  
  // Vérifier le stock (ne pas écraser expired)
  if (status !== 'expired') {
    if (quantity <= 0) {
      status = 'out_of_stock';
      statusMessage = 'En rupture de stock';
    } else if (quantity <= lowStockThreshold) {
      status = 'low_stock';
      statusMessage = `Stock bas: ${quantity} unité(s) restante(s)`;
    }
  }
  
  return {
    ...product,
    status,
    statusMessage,
    daysUntilExpiry,
  };
};

const CartItemComponent = memo(({ 
  item, 
  index, 
  onUpdateQuantity, 
  onRemove,
  onUpdateDiscount,
  currencyMode,
  currencies,
  exchangeRate
}: { 
  item: CartItem; 
  index: number; 
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onUpdateDiscount: (index: number, discountPercent: number) => void;
  currencyMode: 'cdf_only' | 'usd_only' | 'both';
  primaryCurrency: string;
  currencies: CurrencyConfig[];
  exchangeRate: number;
}) => {
  const unitPriceDisplay = (item.unitPrice || 0) / exchangeRate;
  const subtotalDisplay = ((item.unitPrice || 0) * (item.quantity || 0)) / exchangeRate;
  const discountPercent = item.discount_percent || 0;
  const discountAmount = subtotalDisplay * (discountPercent / 100);
  const totalDisplay = subtotalDisplay - discountAmount;
  
  const getCurrency = (code: string) => currencies.find(c => c.code === code);
  const cdfCurrency = getCurrency('CDF');
  const usdCurrency = getCurrency('USD');
  
  const formatPrice = (price: number) => {
    if (currencyMode === 'cdf_only') {
      return `${cdfCurrency?.symbol || 'FC'} ${(price * exchangeRate).toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      return `${usdCurrency?.symbol || '$'} ${price.toFixed(2)}`;
    }
    // Mode both
    return `${cdfCurrency?.symbol || 'FC'} ${(price * exchangeRate).toFixed(2)} / ${usdCurrency?.symbol || '$'} ${price.toFixed(2)}`;
  };

  return (
    <div className="rounded-2xl bg-slate-50 p-3 transition-all hover:bg-slate-100 dark:bg-slate-700/50">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-200">{item.name}</p>
          <p className="text-xs text-slate-400">
            {formatPrice(unitPriceDisplay)}/u · Stock: {item.stock || 0}
          </p>
          {discountPercent > 0 && (
            <p className="text-xs text-green-600">
              Remise: {discountPercent}% (-{formatPrice(discountAmount)})
            </p>
          )}
        </div>
        <button
          onClick={() => onRemove(index)}
          className="text-red-400 transition-colors hover:text-red-600"
          aria-label="Retirer du panier"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateQuantity(index, -1)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 active:bg-slate-200 dark:border-slate-600 dark:bg-slate-800"
            aria-label="Diminuer la quantité"
          >
            <Minus size={12} />
          </button>
          <span className="min-w-5 text-center text-sm font-bold">
            {item.quantity}
          </span>
          <button
            onClick={() => onUpdateQuantity(index, 1)}
            disabled={item.quantity >= (item.stock || 0)}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
            aria-label="Augmenter la quantité"
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
            aria-label="Appliquer une remise"
            title="Appliquer une remise"
          >
            <Percent size={12} />
          </button>
          <p className="text-sm font-black text-blue-600">
            {formatPrice(totalDisplay)}
          </p>
        </div>
      </div>
    </div>
  );
});

CartItemComponent.displayName = 'CartItemComponent';

// Composant d'auto-complétion pour la recherche
const SearchAutocomplete = memo(({ 
  searchValue, 
  suggestions, 
  onSelectSuggestion,
  inputRef,
  currencyMode,
  currencies,
  exchangeRate
}: {
  searchValue: string;
  suggestions: Product[];
  onSelectSuggestion: (product: Product) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  currencyMode: 'cdf_only' | 'usd_only' | 'both';
  primaryCurrency: string;
  currencies: CurrencyConfig[];
  exchangeRate: number;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  const filteredSuggestions = useMemo(() => {
    if (!searchValue.trim()) return [];
    const term = searchValue.toLowerCase().trim();
    return suggestions
      .filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term)
      )
      .slice(0, 8);
  }, [suggestions, searchValue]);

  useEffect(() => {
    setShowSuggestions(filteredSuggestions.length > 0);
    setSelectedIndex(-1);
  }, [filteredSuggestions]);

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
    if (currencyMode === 'cdf_only') {
      const cdfCurrency = currencies.find(c => c.code === 'CDF');
      return `${cdfCurrency?.symbol || 'FC'} ${(price / exchangeRate).toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      const usdCurrency = currencies.find(c => c.code === 'USD');
      return `${usdCurrency?.symbol || '$'} ${(price / exchangeRate).toFixed(2)}`;
    }
    const cdfCurrency = currencies.find(c => c.code === 'CDF');
    const usdCurrency = currencies.find(c => c.code === 'USD');
    return `${cdfCurrency?.symbol || 'FC'} ${(price / exchangeRate).toFixed(2)} / ${usdCurrency?.symbol || '$'} ${(price / exchangeRate).toFixed(2)}`;
  };

  if (!showSuggestions) return null;

  return (
    <div ref={suggestionsRef} className="absolute left-0 right-0 top-full z-50 mt-1">
      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
        {filteredSuggestions.map((product, index) => {
          const productWithStatus = getProductStatus(product, 10, 30);
          return (
            <button
              key={product.id}
              onClick={() => {
                isSelectingRef.current = true;
                onSelectSuggestion(product);
                setShowSuggestions(false);
                setSelectedIndex(-1);
                setTimeout(() => {
                  isSelectingRef.current = false;
                }, 200);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-4 py-2 text-left transition-colors ${
                index === selectedIndex 
                  ? 'bg-blue-50 dark:bg-blue-900/50' 
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700'
              } ${index !== filteredSuggestions.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {product.name}
                    </p>
                    <ProductStatusBadge 
                      status={productWithStatus.status} 
                      stock={product.quantity}
                      expiryDate={product.expiry_date}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    Code: {product.code} {product.barcode && `· Barre: ${product.barcode}`}
                  </p>
                  {productWithStatus.statusMessage && productWithStatus.status !== 'in_stock' && (
                    <p className="text-xs text-red-500">{productWithStatus.statusMessage}</p>
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

const POS = observer(() => {
  const location = useLocation();
  const isOnline = useOnline();
  const { toast } = useToast();
  
  const { 
    getPendingCount, 
    syncPendingSales,
    resetFailedSales,
    localSales,
    syncInProgress: storeSyncInProgress
  } = useSaleStore();

  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [expiryWarningDays, setExpiryWarningDays] = useState(30);

  const scanInputRef = useRef<HTMLInputElement>(null);
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const products = posService.products;
  const filteredProducts = posService.filteredProducts;
  const categories = posService.categories;
  const cart = posService.cart;
  const search = posService.search;
  const selectedCategory = posService.selectedCategory;
  const paymentMethod = posService.paymentMethod;
  const currentSale = posService.currentSale;
  const scanMode = posService.scanMode;
  const lastScanned = posService.lastScanned;
  const scanError = posService.scanError;
  const cashierInfo = posService.cashierInfo;
  const stats = posService.stats;
  const config = posService.config;
  const isProcessing = posService.isProcessing;

  const pendingCount = getPendingCount();
  
  const failedSales = useMemo(() => 
    localSales.filter(s => !s.synced && (s.retryCount || 0) >= 3),
    [localSales]
  );

  // Récupérer les seuils depuis la configuration
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

  // Déterminer le mode de devise depuis la configuration
  const currencyMode = useMemo(() => {
    const currencies = config.currencies;
    
    if (currencies.length === 0) return 'both';
    
    const activeCurrencies = currencies.filter(c => c.isActive);
    const hasCDF = activeCurrencies.some(c => c.code === 'CDF');
    const hasUSD = activeCurrencies.some(c => c.code === 'USD');
    
    if (hasCDF && !hasUSD) return 'cdf_only';
    if (hasUSD && !hasCDF) return 'usd_only';
    return 'both';
  }, [config.currencies, config.primaryCurrency]);

  // Déterminer les produits à afficher avec leur statut
  const displayProducts = useMemo(() => {
    let productsToFilter = selectedCategory === 'all' ? products : filteredProducts;
    return productsToFilter.map(p => getProductStatus(p, lowStockThreshold, expiryWarningDays));
  }, [selectedCategory, products, filteredProducts, lowStockThreshold, expiryWarningDays]);

  // Pagination
  const totalPages = useMemo(() => {
    return Math.ceil(displayProducts.length / ITEMS_PER_PAGE);
  }, [displayProducts.length]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return displayProducts.slice(startIndex, endIndex);
  }, [displayProducts, currentPage]);

  // Reset page when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCategory]);

  useEffect(() => {
    setSyncInProgress(storeSyncInProgress);
  }, [storeSyncInProgress]);

  useEffect(() => {
    posService.setCallbacks({
      onSyncStatusChange: (isSyncing) => {
        setSyncInProgress(isSyncing);
      }
    });
  }, []);

  const cartVirtualizer = useVirtualizer({
    count: cart.length,
    getScrollElement: () => cartContainerRef.current,
    estimateSize: () => 115,
    overscan: 5,
  });

  const activeCurrency = useMemo(() => {
  const currencies = config.currencies || [];
  const currency = currencies.find(c => c.code === config.primaryCurrency);
  return currency || { code: 'CDF', symbol: 'FC', exchangeRate: 1, isActive: true };
}, [config.currencies, config.primaryCurrency]);

  const subtotal = useMemo(() => {
    const rawSubtotal = cart.reduce((acc, item) => {
      const itemPrice = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscount = itemPrice * ((item.discount_percent || 0) / 100);
      return acc + (itemPrice - itemDiscount);
    }, 0);
    
    if (config.sellByExchangeRate && activeCurrency.exchangeRate && activeCurrency.exchangeRate > 0) {
    return rawSubtotal / activeCurrency.exchangeRate;
  }
  return rawSubtotal;
}, [cart, config.sellByExchangeRate, activeCurrency.exchangeRate]);

  const total = useMemo(() => {
    const totalAfterGlobal = subtotal * (1 - (globalDiscount / 100));
    return totalAfterGlobal;
  }, [subtotal, globalDiscount]);

  const totalItems = useMemo(
    () => cart.reduce((acc, item) => acc + (item.quantity || 0), 0),
    [cart],
  );

  // Formater le total selon le mode de devise
  const formatTotal = useMemo(() => {
    const cdfCurrency = config.currencies.find(c => c.code === 'CDF');
    const usdCurrency = config.currencies.find(c => c.code === 'USD');
    
    if (currencyMode === 'cdf_only') {
      return `${cdfCurrency?.symbol || 'FC'} ${(total * activeCurrency.exchangeRate).toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      return `${usdCurrency?.symbol || '$'} ${total.toFixed(2)}`;
    }
    // Mode both
    return `${cdfCurrency?.symbol || 'FC'} ${(total * activeCurrency.exchangeRate).toFixed(2)} / ${usdCurrency?.symbol || '$'} ${total.toFixed(2)}`;
  }, [total, currencyMode, config.currencies, activeCurrency.exchangeRate]);

  const formatSubtotal = useMemo(() => {
    const cdfCurrency = config.currencies.find(c => c.code === 'CDF');
    const usdCurrency = config.currencies.find(c => c.code === 'USD');
    
    if (currencyMode === 'cdf_only') {
      return `${cdfCurrency?.symbol || 'FC'} ${(subtotal * activeCurrency.exchangeRate).toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      return `${usdCurrency?.symbol || '$'} ${subtotal.toFixed(2)}`;
    }
    return `${cdfCurrency?.symbol || 'FC'} ${(subtotal * activeCurrency.exchangeRate).toFixed(2)} / ${usdCurrency?.symbol || '$'} ${subtotal.toFixed(2)}`;
  }, [subtotal, currencyMode, config.currencies, activeCurrency.exchangeRate]);

  const formatDiscount = useMemo(() => {
    const discountAmount = subtotal * (globalDiscount / 100);
    const cdfCurrency = config.currencies.find(c => c.code === 'CDF');
    const usdCurrency = config.currencies.find(c => c.code === 'USD');
    
    if (currencyMode === 'cdf_only') {
      return `${cdfCurrency?.symbol || 'FC'} ${(discountAmount * activeCurrency.exchangeRate).toFixed(2)}`;
    }
    if (currencyMode === 'usd_only') {
      return `${usdCurrency?.symbol || '$'} ${discountAmount.toFixed(2)}`;
    }
    return `${cdfCurrency?.symbol || 'FC'} ${(discountAmount * activeCurrency.exchangeRate).toFixed(2)} / ${usdCurrency?.symbol || '$'} ${discountAmount.toFixed(2)}`;
  }, [subtotal, globalDiscount, currencyMode, config.currencies, activeCurrency.exchangeRate]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await posService.loadInitialData();
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
  }, [toast, isOnline, syncPendingSales]);

  useEffect(() => {
    posService.applyTheme();
  }, [config.theme]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncInProgress) {
      syncPendingSales();
    }
  }, [isOnline, pendingCount, syncPendingSales, syncInProgress]);

  useEffect(() => {
    if (!isOnline) return;
    
    const interval = setInterval(() => {
      if (pendingCount > 0 && !syncInProgress) {
        console.log('🔄 Synchronisation périodique déclenchée');
        syncPendingSales();
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [isOnline, pendingCount, syncPendingSales, syncInProgress]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncInProgress) {
      console.log('🔄 Synchronisation au retour en ligne');
      syncPendingSales();
    }
  }, [isOnline, pendingCount, syncPendingSales, syncInProgress]);

  useHotkeys('ctrl+k', () => {
    searchInputRef.current?.focus();
  });

  useHotkeys('ctrl+s', () => {
    setShowScanner((prev) => !prev);
  });

  useHotkeys('ctrl+enter', () => {
    if (cart.length > 0 && !isProcessing && !isProcessingSale) {
      handleValidateSale();
    }
  });

  useHotkeys('escape', () => {
    setShowScanner(false);
    setShowInvoice(false);
    setShowSearchSuggestions(false);
    posService.setShowScanner(false);
  });

  const handleSearch = useCallback((value: string) => {
    posService.setSearch(value);
    setShowSearchSuggestions(true);
  }, []);

  const handleSelectSuggestion = useCallback((product: Product) => {
    console.log('🛒 Sélection produit:', product.name);
    posService.addToCart(product);
    posService.setSearch('');
    setShowSearchSuggestions(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
    toast({
      title: "Ajouté au panier",
      description: `${product.name} a été ajouté`,
      variant: "success",
    });
  }, [toast]);

  const handleCategoryChange = useCallback((categoryId: string) => {
    posService.setSelectedCategory(categoryId);
  }, []);

  const handleAddToCart = useCallback((product: ProductWithStatus) => {
    // Vérifier si le produit peut être ajouté
    if (product.status === 'out_of_stock') {
      toast({
        title: "Rupture de stock",
        description: `${product.name} n'est plus disponible`,
        variant: "destructive",
      });
      return;
    }
    if (product.status === 'expired') {
      toast({
        title: "Produit expiré",
        description: `${product.name} est expiré et ne peut pas être vendu`,
        variant: "destructive",
      });
      return;
    }
    posService.addToCart(product);
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

  const handleClearCart = useCallback(() => {
    posService.clearCart();
    setGlobalDiscount(0);
  }, []);

  const handlePaymentMethodChange = useCallback((method: PaymentMethod) => {
    posService.setPaymentMethod(method);
  }, []);

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

    if (globalDiscount > 0) {
      const newCart = cart.map(item => ({
        ...item,
        discount_percent: Math.min(100, (item.discount_percent || 0) + globalDiscount)
      }));
      posService.setCart(newCart);
    }

    setIsProcessingSale(true);
    
    try {
      await posService.validateSale();
      
      if (posService.currentSale) {
        setShowInvoice(true);
        setGlobalDiscount(0);
        
        toast({
          title: "Succès",
          description: "Vente enregistrée avec succès",
          variant: "success",
        });
      }
    } catch (error) {
      console.error('Erreur validation:', error);
      toast({
        title: "Erreur",
        description: "La validation de la vente a échoué",
        variant: "destructive",
      });
    } finally {
      setIsProcessingSale(false);
    }
  }, [cart.length, isProcessing, isProcessingSale, globalDiscount, cart, toast]);

  const handleRefresh = useCallback(() => {
    posService.loadInitialData();
  }, []);

  const handleScan = useCallback((detectedCode: string, type: 'barcode' | 'qrcode') => {
    posService.handleScan(detectedCode, type);
    if (posService.scanMode === 'auto') {
      setShowScanner(false);
    }
  }, []);

  const handleBarcodeInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (value) {
        handleScan(value, 'barcode');
        e.currentTarget.value = '';
      }
    }
  }, [handleScan]);

  const handleScanModeChange = useCallback((mode: ScanMode) => {
    posService.setScanMode(mode);
  }, []);

  const handleCloseScanner = useCallback(() => {
    setShowScanner(false);
    posService.setShowScanner(false);
  }, []);

  const handleCloseInvoice = useCallback(() => {
    setShowInvoice(false);
    posService.setShowInvoice(false);
  }, []);

  const handleResetFailedSales = useCallback(() => {
    resetFailedSales();
    toast({
      title: "Réessai",
      description: "Tentative de synchronisation des ventes en échec",
      variant: "default",
    });
  }, [resetFailedSales, toast]);

  const displayCategories = useMemo(() => {
    if (!categories || categories.length === 0) {
      return [{ id: 'all', name: 'Tous' }];
    }
    return categories;
  }, [categories]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
          <p className="text-slate-600 dark:text-slate-400">Chargement de la caisse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Toaster />

      {pendingCount > 0 && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          {syncInProgress ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} className="animate-spin" />
          )}
          {pendingCount} vente(s) en attente de synchronisation
          {syncInProgress && " (en cours...)"}
        </div>
      )}

      {failedSales.length > 0 && !pendingCount && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-red-500 px-4 py-2 text-sm font-medium text-white">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} />
            {failedSales.length} vente(s) en échec après plusieurs tentatives
          </div>
          <button
            onClick={handleResetFailedSales}
            className="flex items-center gap-1 rounded-lg bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
          >
            <RefreshCw size={12} />
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

      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600 px-4 py-2 text-xl font-black text-white">
              {config.pharmacyInfo?.name?.charAt(0) || 'P'}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {config.pharmacyInfo?.name || 'Pharmacie'}
              </p>
              <p className="text-xs text-slate-400">
                {new Date().toLocaleString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-700">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400">
              <User size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {cashierInfo?.name || 'Caissier'}
              </p>
              <p className="text-xs text-slate-400">
                Caisse: {cashierInfo?.posName} · Session: {cashierInfo?.sessionNumber}
                {!isOnline && <WifiOff size={12} className="ml-1 inline text-amber-500" />}
              </p>
            </div>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white px-4 py-3 md:px-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { name: 'Vente', icon: <ShoppingCart size={18} />, path: '/pos' },
            { name: 'Clients', icon: <Users size={18} />, path: '/clients' },
            { name: 'Stock', icon: <Package size={18} />, path: '/stock' },
            { name: 'Rapports', icon: <BarChart3 size={18} />, path: '/rapports' },
            { name: 'Paramètres', icon: <Settings size={18} />, path: '/settings' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                location.pathname === item.path
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
              }`}
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </div>
      </nav>

      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="border-b border-slate-100 p-5 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-200">Scanner un produit</h3>
                  <p className="text-sm text-slate-400">Scan code-barres ou QR code</p>
                </div>
                <button
                  onClick={handleCloseScanner}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleScanModeChange('auto')}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-colors ${
                    scanMode === 'auto'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Camera size={18} />
                  Auto
                </button>
                <button
                  onClick={() => handleScanModeChange('manual')}
                  className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-colors ${
                    scanMode === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Barcode size={18} />
                  Manuel
                </button>
              </div>
            </div>

            <div className="p-5">
              {scanMode === 'auto' ? (
                <div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
                    <Scanner
                      onScan={(result) => {
                        if (result && result[0]?.rawValue) {
                          handleScan(result[0].rawValue, 'qrcode');
                        }
                      }}
                      onError={(error) => {
                        console.error('Scanner error:', error);
                        posService.setScanError('Erreur de caméra');
                      }}
                      styles={{ container: { width: '100%', height: 360 } }}
                    />
                  </div>
                  <p className="mt-3 text-center text-sm text-slate-400">Placez le code dans le cadre</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <ScanLine className="absolute left-4 top-3.5 text-slate-400" size={20} />
                    <input
                      ref={scanInputRef}
                      type="text"
                      placeholder="Scannez ou saisissez le code puis Entrée"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition-shadow focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                      onKeyDown={handleBarcodeInput}
                    />
                  </div>
                  <p className="text-sm text-slate-400">Compatible douchette code-barres</p>
                </div>
              )}

              {scanError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle size={16} />
                  {scanError}
                </div>
              )}

              {lastScanned && (
                <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
                  Dernier scan : <strong>{lastScanned.code}</strong> ({lastScanned.type})
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-5 dark:bg-slate-700">
              <button
                onClick={handleCloseScanner}
                className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Section produits - à gauche sur desktop */}
          <section className="order-2 lg:order-1">
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input
                  ref={searchInputRef}
                  id="search-input"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition-shadow focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder="Rechercher un produit (nom, code, code-barres...)"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  onFocus={() => setShowSearchSuggestions(true)}
                />
                {showSearchSuggestions && (
                  <SearchAutocomplete
                    searchValue={search}
                    suggestions={products}
                    onSelectSuggestion={handleSelectSuggestion}
                    inputRef={searchInputRef}
                    currencyMode={currencyMode}
                    primaryCurrency={config.primaryCurrency}
                    currencies={config.currencies}
                    exchangeRate={activeCurrency.exchangeRate}
                  />
                )}
              </div>

              <button
                onClick={() => setShowScanner(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition-colors hover:bg-blue-700"
              >
                <Camera size={20} />
                Scanner
              </button>

              <button
                onClick={handleRefresh}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <RefreshCw size={18} />
                Actualiser
              </button>
            </div>

            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Ctrl + K : recherche</span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Ctrl + S : scanner</span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Ctrl + Enter : valider</span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Esc : fermer</span>
            </div>

            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-slate-100 p-3 text-sm dark:bg-slate-800">
              <Building2 size={16} className="text-blue-600" />
              <span className="text-slate-600 dark:text-slate-400">
                Mode de vente: 
                <strong className="ml-1 text-slate-800 dark:text-slate-200">
                  {config.salesType === 'wholesale' && 'Gros uniquement'}
                  {config.salesType === 'retail' && 'Détail uniquement'}
                  {config.salesType === 'both' && 'Gros et Détail'}
                </strong>
              </span>
              {config.sellByExchangeRate && activeCurrency && (
                <span className="ml-auto text-xs">
                  <DollarSign size={12} className="inline" />
                  Taux: 1 {activeCurrency.code} = {activeCurrency.exchangeRate} FC
                </span>
              )}
            </div>

            {/* Affichage du mode de devise */}
            <div className="mb-4 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm dark:bg-amber-900/20">
              <DollarSign size={16} className="text-amber-600" />
              <span className="text-amber-700 dark:text-amber-400">
                Mode devise: 
                <strong className="ml-1">
                  {currencyMode === 'cdf_only' && 'Vente uniquement en Francs Congolais (FC)'}
                  {currencyMode === 'usd_only' && 'Vente uniquement en Dollars Américains ($)'}
                  {currencyMode === 'both' && 'Vente en FC et USD (prix affichés dans les deux devises)'}
                </strong>
              </span>
            </div>

            {/* Catégories */}
            {displayCategories.length > 1 && (
              <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {displayCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                      selectedCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Tableau des produits */}
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Produit</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Prix</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400">Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product, idx) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        onAdd={handleAddToCart}
                        currencyMode={currencyMode}
                        primaryCurrency={config.primaryCurrency}
                        currencies={config.currencies}
                        exchangeRate={activeCurrency.exchangeRate}
                        index={(currentPage - 1) * ITEMS_PER_PAGE + idx}
                      />
                    ))}
                    {paginatedProducts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                          Aucun produit trouvé
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </section>

          {/* Section panier - à droite sur desktop, fixe */}
          <aside className="order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
            <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700">
                <h3 className="flex items-center gap-2 text-lg font-black text-slate-800 dark:text-slate-200">
                  <ShoppingCart size={20} />
                  Panier
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600 dark:bg-blue-900 dark:text-blue-400">
                    {totalItems}
                  </span>
                </h3>

                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-sm font-medium text-red-500 transition-colors hover:text-red-700"
                  >
                    Vider
                  </button>
                )}
              </div>

              <div
                ref={cartContainerRef}
                className="max-h-[calc(100vh-400px)] min-h-75 overflow-y-auto p-4"
              >
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-sm italic text-slate-400">
                    Panier vide
                    <br />
                    <span className="text-xs not-italic">Scannez un produit ou cliquez sur un article</span>
                  </div>
                ) : (
                  <div
                    style={{
                      height: `${cartVirtualizer.getTotalSize()}px`,
                      position: 'relative',
                    }}
                  >
                    {cartVirtualizer.getVirtualItems().map((virtualRow) => (
                      <div
                        key={virtualRow.key}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <CartItemComponent
                          item={cart[virtualRow.index]}
                          index={virtualRow.index}
                          onUpdateQuantity={handleUpdateQuantity}
                          onRemove={handleRemoveFromCart}
                          onUpdateDiscount={handleUpdateDiscount}
                          currencyMode={currencyMode}
                          primaryCurrency={config.primaryCurrency}
                          currencies={config.currencies}
                          exchangeRate={activeCurrency.exchangeRate}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 bg-slate-50 p-4 dark:bg-slate-700/50">
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

                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xl font-black text-slate-800 dark:border-slate-600 dark:text-slate-200">
                  <span>Total</span>
                  <span className="text-blue-600">
                    {formatTotal}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'mobile_money', 'account'] as PaymentMethod[]).map((method) => (
                    <button
                      key={method}
                      onClick={() => handlePaymentMethodChange(method)}
                      className={`rounded-2xl p-3 transition-all ${
                        paymentMethod === method
                          ? 'bg-blue-600 text-white'
                          : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {method === 'cash' && <Banknote size={20} />}
                        {method === 'mobile_money' && <Phone size={20} />}
                        {method === 'account' && <Users size={20} />}
                        <span className="text-[10px] font-bold">{PAYMENT_METHOD_LABELS[method]}</span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleValidateSale}
                  disabled={cart.length === 0 || isProcessing || isProcessingSale}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600"
                >
                  {(isProcessing || isProcessingSale) ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <CheckCircle size={20} />
                  )}
                  {(isProcessing || isProcessingSale) ? 'Traitement...' : 'Valider la vente'}
                </button>
              </div>
            </div>

            <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <TrendingUp size={16} />
                <span className="text-sm font-bold">Résumé du jour</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="text-lg font-black text-blue-600">
                    {currencyMode === 'cdf_only' 
                      ? `${config.currencies.find(c => c.code === 'CDF')?.symbol || 'FC'} ${(stats?.total || 0).toFixed(2)}`
                      : currencyMode === 'usd_only'
                      ? `${config.currencies.find(c => c.code === 'USD')?.symbol || '$'} ${(stats?.total || 0).toFixed(2)}`
                      : `${config.currencies.find(c => c.code === 'CDF')?.symbol || 'FC'} ${(stats?.total || 0).toFixed(2)} / ${config.currencies.find(c => c.code === 'USD')?.symbol || '$'} ${(stats?.total || 0).toFixed(2)}`
                    }
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Ventes</p>
                  <p className="text-lg font-black text-slate-800 dark:text-slate-200">{stats?.salesCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Client</p>
                  <p className="truncate text-lg font-black text-slate-800 dark:text-slate-200">
                    {stats?.currentClient || 'Passager'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Link
                to="/historique"
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <History size={16} />
                Historique
              </Link>

              <Link
                to="/factures"
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <FileText size={16} />
                Factures
              </Link>
            </div>
          </aside>
        </div>
      </main>

      // Dans le rendu de FacturePrinter, assurez-vous que les props correspondent

  {showInvoice && currentSale && (
    <FacturePrinter
      sale={{
        id: String(currentSale.id || Date.now()),
        receiptNumber: currentSale.receiptNumber || `FACT-${Date.now()}`,
        items: (currentSale.items || []).map((item: any) => ({
          id: item.id || item.productId,
          name: item.name,
          price: item.price || item.unitPrice || 0,
          quantity: item.quantity || 1,
          code: item.code,
        })),
        total: Number(currentSale.total || 0),
        paymentMethod: currentSale.paymentMethod as PaymentMethod || paymentMethod,
        timestamp: currentSale.timestamp || Date.now(),
        cashierName: currentSale.cashierName || cashierInfo?.name || 'Caissier',
        posName: currentSale.posName || cashierInfo?.posName || 'POS-01',
        sessionNumber: cashierInfo?.sessionNumber || '001',
        clientName: currentSale.clientName || currentSale.clientType || 'Passager',
      }}
      pharmacyInfo={config.pharmacyInfo || { name: '', address: '', phone: '', email: '', licenseNumber: '' }}
      invoiceConfig={config.invoice || { autoPrint: false, autoSave: true, fontSize: 12 }}
      primaryCurrency={config.primaryCurrency || 'CDF'}
      currencies={config.currencies || []}
      onClose={handleCloseInvoice}
      onPrint={() => {}}
    />
  )}
    </div>
  );
});

export default POS;