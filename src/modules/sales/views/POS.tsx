// POS.tsx
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
  Percent
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useVirtualizer } from '@tanstack/react-virtual';
import { observer } from 'mobx-react-lite';
import { useOnline } from '@/hooks/useOnline';
import { FacturePrinter } from '@/modules/sales/views/FacturePrinter';
import { posService, CartItem, Product, Category, CashierInfo, PaymentMethod, ScanMode, CurrencyConfig, PharmacyConfig } from '@/services/posService';
import { useSaleStore} from '@/store/saleStore';
import { useToast } from '@/hooks/useToast';
import { Toaster } from '@/components/ui/Toaster';

export type { CartItem, Product, Category, CashierInfo, PaymentMethod, ScanMode, CurrencyConfig, PharmacyConfig };

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Espèces',
  mobile_money: 'Mobile Money',
  account: 'Compte',
};

const ProductCard = memo(({ 
  product, 
  onAdd,
  currencySymbol,
  exchangeRate
}: { 
  product: Product; 
  onAdd: (product: Product) => void;
  currencySymbol: string;
  exchangeRate: number;
}) => {
  const sellingPrice = product.selling_price || 0;
  const displayPrice = sellingPrice / exchangeRate;
  const formattedPrice = displayPrice.toFixed(2);
  const isAvailable = (product.quantity || 0) > 0;
  const disabled = !isAvailable;

  return (
    <button
      type="button"
      onClick={() => onAdd(product)}
      disabled={disabled}
      className={`
        rounded-2xl border p-4 text-left transition-all duration-200
        ${disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
          : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
        }
      `}
      title={disabled ? 'Rupture de stock' : ''}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-800">{product.name}</p>
          <p className="mt-1 text-xs text-slate-400">Code: {product.code}</p>
          {product.barcode && (
            <p className="text-xs text-slate-400">Barre: {product.barcode}</p>
          )}
        </div>
        <span
          className={`
            shrink-0 rounded-full px-2 py-1 text-xs font-bold
            ${(product.quantity || 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          `}
        >
          {product.quantity || 0}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-black text-blue-600">
          {currencySymbol} {formattedPrice}
        </span>
        <span className="text-xs text-slate-400">
          {disabled ? 'Rupture de stock' : 'Cliquer pour ajouter'}
        </span>
      </div>
    </button>
  );
});

ProductCard.displayName = 'ProductCard';

const CartItemComponent = memo(({ 
  item, 
  index, 
  onUpdateQuantity, 
  onRemove,
  onUpdateDiscount,
  currencySymbol,
  exchangeRate
}: { 
  item: CartItem; 
  index: number; 
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  onUpdateDiscount: (index: number, discountPercent: number) => void;
  currencySymbol: string;
  exchangeRate: number;
}) => {
  const unitPriceDisplay = (item.unitPrice || 0) / exchangeRate;
  const subtotalDisplay = ((item.unitPrice || 0) * (item.quantity || 0)) / exchangeRate;
  const discountPercent = item.discount_percent || 0;
  const discountAmount = subtotalDisplay * (discountPercent / 100);
  const totalDisplay = subtotalDisplay - discountAmount;

  return (
    <div className="rounded-2xl bg-slate-50 p-3 transition-all hover:bg-slate-100">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
          <p className="text-xs text-slate-400">
            {currencySymbol} {unitPriceDisplay.toFixed(2)}/u · Stock: {item.stock || 0}
          </p>
          {discountPercent > 0 && (
            <p className="text-xs text-green-600">
              Remise: {discountPercent}% (-{currencySymbol} {discountAmount.toFixed(2)})
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
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 active:bg-slate-200"
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
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100"
            aria-label="Appliquer une remise"
            title="Appliquer une remise"
          >
            <Percent size={12} />
          </button>
          <p className="text-sm font-black text-blue-600">
            {currencySymbol} {totalDisplay.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  );
});

CartItemComponent.displayName = 'CartItemComponent';

// Composant d'auto-complétion pour la recherche - CORRIGÉ
const SearchAutocomplete = memo(({ 
  searchValue, 
  suggestions, 
  onSelectSuggestion,
  inputRef
}: {
  searchValue: string;
  suggestions: Product[];
  onSelectSuggestion: (product: Product) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  // Filtrer les suggestions basées sur la recherche
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

  // Afficher les suggestions quand la recherche a du contenu
  useEffect(() => {
    setShowSuggestions(filteredSuggestions.length > 0);
    setSelectedIndex(-1);
  }, [filteredSuggestions]);

  // Fermer les suggestions quand on clique dehors
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

  // Gestionnaire d'événements clavier pour le champ de recherche
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

  // Ajouter l'écouteur d'événements clavier sur le champ de recherche
  useEffect(() => {
    const inputElement = inputRef.current;
    if (!inputElement) return;

    inputElement.addEventListener('keydown', handleKeyDown);
    return () => {
      inputElement.removeEventListener('keydown', handleKeyDown);
    };
  }, [inputRef, handleKeyDown]);

  if (!showSuggestions) return null;

  return (
    <div ref={suggestionsRef} className="absolute left-0 right-0 top-full z-50 mt-1">
      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800">
        {filteredSuggestions.map((product, index) => (
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
            className={`
              w-full px-4 py-2 text-left transition-colors
              ${index === selectedIndex 
                ? 'bg-blue-50 dark:bg-blue-900/50' 
                : 'hover:bg-slate-50 dark:hover:bg-slate-700'
              }
              ${index !== filteredSuggestions.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {product.name}
                </p>
                <p className="text-xs text-slate-400">
                  Code: {product.code} {product.barcode && `· Barre: ${product.barcode}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-blue-600">
                  {posService.activeCurrency?.symbol || 'FC'} {(product.selling_price / (posService.activeCurrency?.exchangeRate || 1)).toFixed(2)}
                </p>
                <p className="text-xs text-slate-400">
                  Stock: {product.quantity}
                </p>
              </div>
            </div>
          </button>
        ))}
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
    const currency = config.currencies?.find(c => c.code === config.primaryCurrency);
    return currency || { code: 'CDF', symbol: 'FC', exchangeRate: 1, isActive: true };
  }, [config.currencies, config.primaryCurrency]);

  const subtotal = useMemo(() => {
    const rawSubtotal = cart.reduce((acc, item) => {
      const itemPrice = (item.unitPrice || 0) * (item.quantity || 0);
      const itemDiscount = itemPrice * ((item.discount_percent || 0) / 100);
      return acc + (itemPrice - itemDiscount);
    }, 0);
    
    if (config.sellByExchangeRate && activeCurrency.exchangeRate > 0) {
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

  // Handlers - CORRIGÉS
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

  const handleAddToCart = useCallback((product: Product) => {
    posService.addToCart(product);
  }, []);

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

  const getCategoryProducts = useCallback((categoryId: string) => {
    return posService.getCategoryProducts(categoryId);
  }, []);

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
              className={`
                inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors
                ${location.pathname === item.path
                  ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'
                  : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700'
                }
              `}
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
                  className={`
                    flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-colors
                    ${scanMode === 'auto'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                    }
                  `}
                >
                  <Camera size={18} />
                  Auto
                </button>
                <button
                  onClick={() => handleScanModeChange('manual')}
                  className={`
                    flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-bold transition-colors
                    ${scanMode === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'
                    }
                  `}
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
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <section>
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

            {displayCategories.length > 1 && (
              <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
                {displayCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`
                      shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-colors
                      ${selectedCategory === cat.id
                        ? 'bg-blue-600 text-white'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                      }
                    `}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {selectedCategory === 'all' ? (
              <div className="space-y-5">
                {displayCategories
                  .filter((c) => c.id !== 'all')
                  .map((cat) => {
                    const catProducts = getCategoryProducts(cat.id);
                    if (!catProducts || catProducts.length === 0) return null;

                    return (
                      <div
                        key={cat.id}
                        className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                      >
                        <h3 className="mb-4 text-lg font-black text-slate-800 dark:text-slate-200">{cat.name}</h3>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {catProducts.map((product) => (
                            <ProductCard 
                              key={product.id} 
                              product={product} 
                              onAdd={handleAddToCart}
                              currencySymbol={activeCurrency?.symbol || 'FC'}
                              exchangeRate={activeCurrency?.exchangeRate || 1}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                
                {displayCategories.filter(c => c.id !== 'all').length === 0 && products && products.length > 0 && (
                  <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {products.map((product) => (
                        <ProductCard 
                          key={product.id} 
                          product={product} 
                          onAdd={handleAddToCart}
                          currencySymbol={activeCurrency?.symbol || 'FC'}
                          exchangeRate={activeCurrency?.exchangeRate || 1}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts && filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAdd={handleAddToCart}
                    currencySymbol={activeCurrency?.symbol || 'FC'}
                    exchangeRate={activeCurrency?.exchangeRate || 1}
                  />
                ))}

                {(!filteredProducts || filteredProducts.length === 0) && (
                  <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                    Aucun produit trouvé
                  </div>
                )}
              </div>
            )}
          </section>

          <aside>
            <div className="sticky top-4 space-y-4">
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
                  className="max-h-95 space-y-3 overflow-y-auto p-4"
                  style={{ height: '380px' }}
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
                            currencySymbol={activeCurrency?.symbol || 'FC'}
                            exchangeRate={activeCurrency?.exchangeRate || 1}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 bg-slate-50 p-4 dark:bg-slate-700/50">
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>Sous-total</span>
                    <span>{activeCurrency?.symbol || 'FC'} {subtotal.toFixed(2)}</span>
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
                      <span>-{activeCurrency?.symbol || 'FC'} {(subtotal * (globalDiscount / 100)).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-xl font-black text-slate-800 dark:border-slate-600 dark:text-slate-200">
                    <span>Total</span>
                    <span className="text-blue-600">
                      {activeCurrency?.symbol || 'FC'} {total.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'mobile_money', 'account'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => handlePaymentMethodChange(method)}
                        className={`
                          rounded-2xl p-3 transition-all
                          ${paymentMethod === method
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-400'
                          }
                        `}
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

              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <TrendingUp size={16} />
                  <span className="text-sm font-bold">Résumé du jour</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="text-lg font-black text-blue-600">
                      {activeCurrency?.symbol || 'FC'} {(stats?.total || 0).toFixed(2)}
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

              <div className="grid grid-cols-2 gap-3">
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
            </div>
          </aside>
        </div>
      </main>

      {showInvoice && currentSale && (
        <FacturePrinter
          sale={{
            id: String(currentSale.id || Date.now()),
            receiptNumber: currentSale.receiptNumber,
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