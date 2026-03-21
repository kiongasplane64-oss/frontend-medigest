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
  Building2
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'react-hot-toast';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useOnline } from '@/hooks/useOnline';;
import { db, OfflineSale } from '@/db/offlineDb';
import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';
import { debounce } from '@/utils/debounce';
import { FacturePrinter } from '@/modules/sales/views/FacturePrinter';

// ============================================
// TYPES
// ============================================

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  sellingPrice?: number;
  purchasePrice?: number;
  categoryId: string;
  category?: Category;
  stock: number;
  code: string;
  barcode?: string;
  qrCode?: string;
  description?: string;
  salesType: 'wholesale' | 'retail' | 'both';
  wholesalePrice?: number;
  retailPrice?: number;
  minQuantity?: number;
}

interface CartItem extends Product {
  quantity: number;
  unitPrice: number;
}

interface CashierInfo {
  id: string;
  name: string;
  posId: string;
  posName: string;
  sessionId: string;
  sessionNumber: string;
}

interface DailyStats {
  total: number;
  salesCount: number;
  currentClient: string;
}

interface ScannedProduct {
  code: string;
  type: 'barcode' | 'qrcode';
  timestamp: number;
}

interface CurrencyConfig {
  code: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number;
}

interface PharmacyConfig {
  pharmacyId: string;
  pharmacyInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
    licenseNumber: string;
    logoUrl?: string;
  };
  currencies: CurrencyConfig[];
  primaryCurrency: string;
  taxRate: number;
  salesType: 'wholesale' | 'retail' | 'both';
  sellByExchangeRate: boolean;
  profitability: {
    enabled: boolean;
    rate: number;
  };
  invoice: {
    autoPrint: boolean;
    autoSave: boolean;
    fontSize: number;
  };
  theme: 'light' | 'dark' | 'system';
}

type PaymentMethod = 'cash' | 'mobile' | 'account';
type ScanMode = 'auto' | 'manual';

// ============================================
// CONSTANTES
// ============================================

const DEBOUNCE_DELAY = 300;
const SCAN_COOLDOWN = 1500;
const VIBRATION_DURATION = 80;

// ============================================
// COMPOSANTS MEMOÏSÉS
// ============================================

const ProductCard = memo(({ 
  product, 
  onAdd,
  currencySymbol,
  exchangeRate,
  salesType
}: { 
  product: Product; 
  onAdd: (product: Product) => void;
  currencySymbol: string;
  exchangeRate: number;
  salesType: string;
}) => {
  const displayPrice = product.salesType === 'wholesale' 
    ? (product.wholesalePrice || product.price)
    : (product.retailPrice || product.price);
  
  const formattedPrice = (displayPrice / exchangeRate).toFixed(2);
  const isAvailable = product.stock > 0;
  const isAllowed = salesType === 'both' || product.salesType === salesType || product.salesType === 'both';
  const disabled = !isAvailable || !isAllowed;

  let disabledReason = '';
  if (!isAvailable) disabledReason = 'Rupture de stock';
  else if (!isAllowed) disabledReason = `Non disponible en ${salesType === 'wholesale' ? 'gros' : 'détail'}`;

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
      title={disabledReason}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-slate-800">{product.name}</p>
          <p className="mt-1 text-xs text-slate-400">Code: {product.code}</p>
          {product.barcode && (
            <p className="text-xs text-slate-400">Barre: {product.barcode}</p>
          )}
          {product.salesType === 'wholesale' && (
            <p className="text-xs text-blue-600">Vente en gros</p>
          )}
          {product.salesType === 'retail' && (
            <p className="text-xs text-green-600">Vente au détail</p>
          )}
        </div>
        <span
          className={`
            shrink-0 rounded-full px-2 py-1 text-xs font-bold
            ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
          `}
        >
          {product.stock}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-lg font-black text-blue-600">
          {currencySymbol} {formattedPrice}
        </span>
        <span className="text-xs text-slate-400">
          {disabledReason || 'Cliquer pour ajouter'}
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
  currencySymbol,
  exchangeRate
}: { 
  item: CartItem; 
  index: number; 
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
  currencySymbol: string;
  exchangeRate: number;
}) => {
  const unitPrice = item.unitPrice / exchangeRate;
  const totalPrice = (item.unitPrice * item.quantity) / exchangeRate;

  return (
    <div className="rounded-2xl bg-slate-50 p-3 transition-all hover:bg-slate-100">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
          <p className="text-xs text-slate-400">
            {currencySymbol} {unitPrice.toFixed(2)}/u · Stock: {item.stock}
          </p>
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
            disabled={item.quantity >= item.stock}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-100 active:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Augmenter la quantité"
          >
            <Plus size={12} />
          </button>
        </div>
        <p className="text-sm font-black text-blue-600">
          {currencySymbol} {totalPrice.toFixed(2)}
        </p>
      </div>
    </div>
  );
});

CartItemComponent.displayName = 'CartItemComponent';

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function POS() {
  const { user } = useAuthStore();
  const location = useLocation();
  const isOnline = useOnline();

  // États généraux
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsMap, setProductsMap] = useState<Map<string, Product>>(new Map());
  const [categories, setCategories] = useState<Category[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [showInvoice, setShowInvoice] = useState(false);
  const [currentSale, setCurrentSale] = useState<OfflineSale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>('auto');
  const [lastScanned, setLastScanned] = useState<ScannedProduct | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [cashierInfo, setCashierInfo] = useState<CashierInfo>({
    id: '',
    name: '',
    posId: '',
    posName: '',
    sessionId: '',
    sessionNumber: '',
  });
  const [stats, setStats] = useState<DailyStats>({
    total: 0,
    salesCount: 0,
    currentClient: 'Passager',
  });

  // États de configuration
  const [config, setConfig] = useState<PharmacyConfig>({
    pharmacyId: '',
    pharmacyInfo: {
      name: '',
      address: '',
      phone: '',
      email: '',
      licenseNumber: '',
      logoUrl: undefined,
    },
    currencies: [],
    primaryCurrency: 'CDF',
    taxRate: 16,
    salesType: 'both',
    sellByExchangeRate: true,
    profitability: { enabled: false, rate: 30 },
    invoice: { autoPrint: false, autoSave: true, fontSize: 12 },
    theme: 'system',
  });

  // Refs
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cartContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Virtualisation pour les longs paniers
  const cartVirtualizer = useVirtualizer({
    count: cart.length,
    getScrollElement: () => cartContainerRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Devise active
  const activeCurrency = useMemo(() => {
    const currency = config.currencies.find(c => c.code === config.primaryCurrency);
    return currency || { code: 'CDF', symbol: 'FC', exchangeRate: 1, isActive: true };
  }, [config.currencies, config.primaryCurrency]);

  // Prix total avec conversion devise
  const total = useMemo(() => {
    const rawTotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    if (config.sellByExchangeRate) {
      return rawTotal / activeCurrency.exchangeRate;
    }
    return rawTotal;
  }, [cart, config.sellByExchangeRate, activeCurrency.exchangeRate]);

  const totalItems = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart],
  );

  // Application du thème
  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (config.theme === 'dark') {
      root.classList.add('dark');
    } else if (config.theme === 'light') {
      root.classList.remove('dark');
    } else if (config.theme === 'system') {
      if (systemDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, [config.theme]);

  // Hotkeys
  useHotkeys('ctrl+k', () => {
    searchInputRef.current?.focus();
  });

  useHotkeys('ctrl+s', () => {
    setShowScanner((prev) => !prev);
  });

  useHotkeys('ctrl+enter', () => {
    if (cart.length > 0 && !isProcessing) {
      void handleValidateSale();
    }
  });

  useHotkeys('escape', () => {
    setShowScanner(false);
    setShowInvoice(false);
  });

  // Chargement des données
  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    const debouncedFilter = debounce(() => {
      filterProducts();
    }, DEBOUNCE_DELAY);

    debouncedFilter();
    return () => debouncedFilter.cancel();
  }, [products, search, selectedCategory]);

  useEffect(() => {
    if (showScanner && scanMode === 'manual') {
      setTimeout(() => scanInputRef.current?.focus(), 100);
    }
  }, [showScanner, scanMode]);

  // Fonctions utilitaires
  const playBeep = useCallback((type: 'success' | 'error') => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = type === 'success' ? 880 : 320;
      gainNode.gain.value = 0.15;

      oscillator.start();
      oscillator.stop(audioContext.currentTime + (type === 'success' ? 0.08 : 0.15));
    } catch {
      // Ignorer les erreurs audio
    }
  }, []);

  const vibrate = useCallback(() => {
    if (navigator.vibrate) {
      navigator.vibrate(VIBRATION_DURATION);
    }
  }, []);

  // Chargement des configurations
  const loadConfig = useCallback(async (pharmacyId: string) => {
    try {
      const response = await api.get(`/pharmacies/${pharmacyId}/config`);
      const loadedConfig = response.data.config || {};
      
      setConfig({
        pharmacyId: loadedConfig.pharmacyId || pharmacyId,
        pharmacyInfo: {
          name: loadedConfig.pharmacyInfo?.name || '',
          address: loadedConfig.pharmacyInfo?.address || '',
          phone: loadedConfig.pharmacyInfo?.phone || '',
          email: loadedConfig.pharmacyInfo?.email || '',
          licenseNumber: loadedConfig.pharmacyInfo?.licenseNumber || '',
          logoUrl: loadedConfig.pharmacyInfo?.logoUrl,
        },
        currencies: loadedConfig.currencies || [],
        primaryCurrency: loadedConfig.primaryCurrency || 'CDF',
        taxRate: loadedConfig.taxRate ?? 16,
        salesType: loadedConfig.salesType?.type || loadedConfig.salesType || 'both',
        sellByExchangeRate: loadedConfig.sellByExchangeRate ?? true,
        profitability: loadedConfig.profitability || { enabled: false, rate: 30 },
        invoice: loadedConfig.invoice || { autoPrint: false, autoSave: true, fontSize: 12 },
        theme: loadedConfig.theme || 'system',
      });
    } catch (error) {
      console.warn('Erreur chargement config:', error);
    }
  }, []);

  // Chargement des données initiales
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadUserInfo(),
        loadProducts(),
        loadCategories(),
        loadDailyStats(),
      ]);
    } catch (error) {
      console.error('Erreur chargement données POS:', error);
      toast.error('Erreur lors du chargement de la caisse');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUserInfo = useCallback(async () => {
    try {
      const response = await api.get('/user/current-session');
      const pharmacyId = response.data?.pharmacyId;
      
      if (pharmacyId) {
        await loadConfig(pharmacyId);
      }
      
      setCashierInfo({
        id: user?.id || '',
        name: user?.nom_complet || user?.email || 'Caissier',
        posId: response.data?.posId || 'pos-main',
        posName: response.data?.posName || 'POS-01',
        sessionId: response.data?.sessionId || Date.now().toString(),
        sessionNumber: response.data?.sessionNumber || '001',
      });

      await db.saveSession({
        sessionId: response.data?.sessionId || Date.now().toString(),
        posId: response.data?.posId || 'pos-main',
        posName: response.data?.posName || 'POS-01',
        sessionNumber: response.data?.sessionNumber || '001',
        userId: user?.id,
        userName: user?.nom_complet || user?.email,
        openedAt: Date.now(),
        status: 'open',
      });
    } catch (error) {
      console.warn('Mode hors-ligne session:', error);
      
      const offlineSession = await db.getCurrentSession(user?.id);
      
      if (offlineSession) {
        setCashierInfo({
          id: user?.id || '',
          name: user?.nom_complet || user?.email || 'Caissier',
          posId: offlineSession.posId,
          posName: offlineSession.posName,
          sessionId: offlineSession.sessionId,
          sessionNumber: offlineSession.sessionNumber,
        });
      }
    }
  }, [user, loadConfig]);

  const loadProducts = useCallback(async () => {
    try {
      const response = await api.get('/products', {
        params: { active: true, limit: 1000 },
      });

      const rawProducts = response.data?.data || response.data?.products || response.data || [];

      const normalizedProducts: Product[] = rawProducts.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price ?? p.selling_price ?? 0),
        sellingPrice: Number(p.selling_price ?? p.price ?? 0),
        purchasePrice: Number(p.purchase_price ?? 0),
        categoryId: String(p.categoryId ?? p.category_id ?? p.category?.id ?? 'uncategorized'),
        category: p.category
          ? typeof p.category === 'object'
            ? p.category
            : { id: String(p.category), name: String(p.category) }
          : undefined,
        stock: Number(p.stock ?? p.quantity ?? 0),
        code: p.code || '',
        barcode: p.barcode || undefined,
        qrCode: p.qrCode || p.qr_code || undefined,
        description: p.description || undefined,
        salesType: p.salesType || p.sales_type || 'both',
        wholesalePrice: Number(p.wholesale_price ?? p.wholesalePrice ?? 0),
        retailPrice: Number(p.retail_price ?? p.retailPrice ?? 0),
        minQuantity: Number(p.min_quantity ?? p.minQuantity ?? 1),
      }));

      await db.products.bulkPut(normalizedProducts as any);
      setProducts(normalizedProducts);
      rebuildProductsMap(normalizedProducts);
    } catch (error) {
      console.warn('Mode hors-ligne produits:', error);

      const localProducts = await db.products.toArray();
      const normalizedProducts: Product[] = localProducts.map((p: any) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price ?? p.selling_price ?? 0),
        sellingPrice: Number(p.selling_price ?? p.price ?? 0),
        purchasePrice: Number(p.purchase_price ?? 0),
        categoryId: String(p.categoryId ?? p.category_id ?? p.category?.id ?? 'uncategorized'),
        category: p.category,
        stock: Number(p.stock ?? p.quantity ?? 0),
        code: p.code || '',
        barcode: p.barcode || undefined,
        qrCode: p.qrCode || p.qr_code || undefined,
        description: p.description || undefined,
        salesType: p.salesType || 'both',
        wholesalePrice: Number(p.wholesale_price ?? p.wholesalePrice ?? 0),
        retailPrice: Number(p.retail_price ?? p.retailPrice ?? 0),
        minQuantity: Number(p.min_quantity ?? p.minQuantity ?? 1),
      }));

      setProducts(normalizedProducts);
      rebuildProductsMap(normalizedProducts);
    }
  }, []);

  const rebuildProductsMap = useCallback((productList: Product[]) => {
    const map = new Map<string, Product>();
    productList.forEach((p) => {
      if (p.barcode) map.set(p.barcode, p);
      if (p.qrCode) map.set(p.qrCode, p);
      if (p.code) map.set(p.code, p);
    });
    setProductsMap(map);
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const response = await api.get('/categories');
      const rawCategories = response.data?.data || response.data?.categories || response.data || [];

      const cats: Category[] = rawCategories.map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        icon: cat.icon,
      }));

      await db.categories.bulkPut(cats as any);
      setCategories([{ id: 'all', name: 'Tous' }, ...cats]);
    } catch (error) {
      console.warn('Mode hors-ligne catégories:', error);
      const localCats = await db.categories.toArray();
      const normalized = localCats.map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        icon: cat.icon,
      }));
      setCategories([{ id: 'all', name: 'Tous' }, ...normalized]);
    }
  }, []);

  const loadDailyStats = useCallback(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const response = await api.get('/sales/stats/daily', {
        params: { date: today.toISOString() },
      });

      const newStats = {
        total: Number(response.data?.total || 0),
        salesCount: Number(response.data?.count || 0),
        currentClient: response.data?.currentClient || 'Passager',
      };

      setStats(newStats);
      await db.updateDailyStats(todayStr, newStats);
    } catch (error) {
      console.warn('Mode hors-ligne stats:', error);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const offlineStats = await db.getDailyStats(todayStr);
      
      if (offlineStats) {
        setStats({
          total: offlineStats.total,
          salesCount: offlineStats.salesCount,
          currentClient: offlineStats.currentClient,
        });
      } else {
        const localSales = await db.sales
          .where('timestamp')
          .aboveOrEqual(today.getTime())
          .toArray();
        
        const total = localSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
        
        setStats({
          total,
          salesCount: localSales.length,
          currentClient: 'Passager',
        });
      }
    }
  }, []);

  const filterProducts = useCallback(() => {
    let filtered = [...products];

    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.categoryId === selectedCategory);
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter((p) => 
        p.name.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    setFilteredProducts(filtered);
  }, [products, search, selectedCategory]);

  const getCategoryProducts = useCallback((categoryId: string) => {
    return products.filter((p) => p.categoryId === categoryId);
  }, [products]);

  // Gestion du scan
  const handleScan = useCallback((detectedCode: string, type: 'barcode' | 'qrcode') => {
    const code = detectedCode.trim();
    if (!code) return;

    setScanError(null);

    const now = Date.now();
    if (lastScanned && lastScanned.code === code && now - lastScanned.timestamp < SCAN_COOLDOWN) {
      return;
    }

    setLastScanned({ code, type, timestamp: now });

    const product = productsMap.get(code);

    if (!product) {
      setScanError(`Produit non trouvé : ${code}`);
      toast.error(`Produit non trouvé : ${code}`);
      playBeep('error');
      return;
    }

    addToCart(product);
    toast.success(`${product.name} ajouté au panier`);
    playBeep('success');
    vibrate();

    if (scanMode === 'auto') {
      setShowScanner(false);
    }
  }, [lastScanned, productsMap, scanMode, playBeep, vibrate]);

  const handleBarcodeInput = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = e.currentTarget.value.trim();
      if (value) {
        handleScan(value, 'barcode');
        e.currentTarget.value = '';
      }
    }
  }, [handleScan]);

  // Gestion du panier
  const addToCart = useCallback((product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} est en rupture de stock`);
      return;
    }

    // Vérifier le type de vente
    if (config.salesType !== 'both' && product.salesType !== config.salesType) {
      const typeLabel = config.salesType === 'wholesale' ? 'gros' : 'détail';
      toast.error(`${product.name} n'est pas disponible en vente ${typeLabel}`);
      return;
    }

    // Calculer le prix selon le type de vente
    let unitPrice = product.price;
    if (product.salesType === 'wholesale' && product.wholesalePrice) {
      unitPrice = product.wholesalePrice;
    } else if (product.salesType === 'retail' && product.retailPrice) {
      unitPrice = product.retailPrice;
    }

    // Vérifier la quantité minimale pour le gros
    if (config.salesType === 'wholesale' && product.minQuantity && product.minQuantity > 1) {
      const existing = cart.find(item => item.id === product.id);
      const currentQty = existing?.quantity || 0;
      if (currentQty === 0 && product.minQuantity > 1) {
        toast(`💡 ${product.name} se vend par lot de ${product.minQuantity}`, {
          icon: 'ℹ️',
          duration: 3000,
        });
      }
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        const newQuantity = existing.quantity + 1;
        if (newQuantity > product.stock) {
          toast.error(`Stock insuffisant pour ${product.name}`);
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: newQuantity } : item
        );
      }

      return [{ ...product, quantity: 1, unitPrice }, ...prev];
    });
  }, [config.salesType, cart]);

  const updateQuantity = useCallback((index: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const item = next[index];
      if (!item) return prev;

      const newQuantity = item.quantity + delta;

      if (delta > 0 && newQuantity > item.stock) {
        toast.error(`Stock insuffisant pour ${item.name}`);
        return prev;
      }

      if (newQuantity <= 0) {
        next.splice(index, 1);
        return next;
      }

      next[index] = { ...item, quantity: newQuantity };
      return next;
    });
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearCart = useCallback(() => {
    if (cart.length > 0 && window.confirm('Vider le panier ?')) {
      setCart([]);
    }
  }, [cart.length]);

  // Mise à jour du stock local
  const updateLocalStock = useCallback(async (items: CartItem[]) => {
    const updatedProducts = [...products];
    const stockUpdates = [];

    for (const item of items) {
      const product = updatedProducts.find((p) => p.id === item.id);
      if (!product) continue;

      const newStock = Math.max(0, product.stock - item.quantity);
      product.stock = newStock;
      stockUpdates.push({ id: item.id, stock: newStock });
    }

    if (stockUpdates.length > 0) {
      try {
        await db.bulkUpdateProductsStock(stockUpdates);
      } catch (error) {
        console.error('Erreur mise à jour stock offline:', error);
      }
    }

    setProducts(updatedProducts);
    rebuildProductsMap(updatedProducts);
  }, [products, rebuildProductsMap]);

  // Validation de la vente
  const handleValidateSale = useCallback(async () => {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);

    // Vérifier les quantités minimales pour le gros
    if (config.salesType === 'wholesale') {
      const invalidItems = cart.filter(item => 
        item.minQuantity && item.quantity < item.minQuantity
      );
      if (invalidItems.length > 0) {
        const message = invalidItems
          .map(item => `${item.name}: minimum ${item.minQuantity} unités`)
          .join('\n');
        toast.error(`Quantités minimales non respectées:\n${message}`);
        setIsProcessing(false);
        return;
      }
    }

    const rawTotal = cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const totalAmount = config.sellByExchangeRate 
      ? rawTotal / activeCurrency.exchangeRate 
      : rawTotal;

    const saleData = {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.unitPrice,
        name: item.name,
        barcode: item.barcode,
        code: item.code,
        salesType: item.salesType,
      })),
      total: totalAmount,
      paymentMethod,
      timestamp: new Date().toISOString(),
      cashierId: cashierInfo.id,
      cashierName: cashierInfo.name,
      posId: cashierInfo.posId,
      posName: cashierInfo.posName,
      sessionId: cashierInfo.sessionId,
      clientType: stats.currentClient,
      currency: config.primaryCurrency,
      exchangeRate: activeCurrency.exchangeRate,
    };

    try {
      let response;
      if (isOnline) {
        response = await api.post('/sales', saleData);
      }

      await updateLocalStock(cart);

      const offlineSale: OfflineSale = {
        ...saleData,
        id: response?.data?.id || `offline_${Date.now()}`,
        timestamp: Date.now(),
        status: isOnline ? 'synced' : 'pending',
        receiptNumber: response?.data?.receiptNumber,
        paymentMethod: saleData.paymentMethod as any,
      };

      await db.sales.add(offlineSale);
      setCurrentSale(offlineSale);

      // Impression automatique si configurée
      if (config.invoice.autoPrint) {
        setShowInvoice(true);
        setTimeout(() => {
          window.print();
        }, 100);
      } else {
        setShowInvoice(true);
      }

      setCart([]);
      await loadDailyStats();
      
      toast.success(isOnline ? 'Vente enregistrée avec succès' : 'Vente enregistrée en mode hors-ligne');
    } catch (error) {
      console.error('Erreur lors de la vente:', error);
      toast.error('Erreur lors de l\'enregistrement de la vente');
    } finally {
      setIsProcessing(false);
    }
  }, [cart, isProcessing, isOnline, paymentMethod, cashierInfo, stats.currentClient, 
      updateLocalStock, loadDailyStats, config.salesType, config.sellByExchangeRate, 
      config.invoice.autoPrint, activeCurrency.exchangeRate]);

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
      {/* Bannière hors-ligne */}
      {!isOnline && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          <WifiOff size={16} />
          Mode hors-ligne - Les ventes seront synchronisées plus tard
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600 px-4 py-2 text-xl font-black text-white">
              {config.pharmacyInfo.name?.charAt(0) || 'P'}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {config.pharmacyInfo.name || 'Pharmacie'}
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
                {cashierInfo.name || 'Caissier'}
              </p>
              <p className="text-xs text-slate-400">
                Caisse: {cashierInfo.posName} · Session: {cashierInfo.sessionNumber}
                {!isOnline && <WifiOff size={12} className="ml-1 inline text-amber-500" />}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
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

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="border-b border-slate-100 p-5 dark:border-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-200">Scanner un produit</h3>
                  <p className="text-sm text-slate-400">
                    Scan code-barres ou QR code
                  </p>
                </div>
                <button
                  onClick={() => setShowScanner(false)}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={() => setScanMode('auto')}
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
                  onClick={() => setScanMode('manual')}
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
                        setScanError('Erreur de caméra');
                      }}
                      styles={{ container: { width: '100%', height: 360 } }}
                    />
                  </div>
                  <p className="mt-3 text-center text-sm text-slate-400">
                    Placez le code dans le cadre
                  </p>
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
                  <p className="text-sm text-slate-400">
                    Compatible douchette code-barres
                  </p>
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
                onClick={() => setShowScanner(false)}
                className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="p-4 md:p-6">
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          {/* Products Section */}
          <section>
            {/* Search Bar */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input
                  ref={searchInputRef}
                  id="search-input"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition-shadow focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                  placeholder="Rechercher un produit (nom, code, code-barres...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowScanner(true)}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition-colors hover:bg-blue-700"
              >
                <Camera size={20} />
                Scanner
              </button>

              <button
                onClick={() => void loadInitialData()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              >
                <RefreshCw size={18} />
                Actualiser
              </button>
            </div>

            {/* Hotkeys Info */}
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-blue-50 p-3 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Ctrl + K : recherche</span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Ctrl + S : scanner</span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Ctrl + Enter : valider</span>
              <span className="rounded-lg bg-white px-2 py-1 dark:bg-slate-700">Esc : fermer</span>
            </div>

            {/* Type de vente info */}
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
              {config.sellByExchangeRate && (
                <span className="ml-auto text-xs">
                  <DollarSign size={12} className="inline" />
                  Taux: 1 {activeCurrency.code} = {activeCurrency.exchangeRate} FC
                </span>
              )}
            </div>

            {/* Categories */}
            <div className="mb-5 flex gap-2 overflow-x-auto pb-2">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
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

            {/* Products Grid */}
            {selectedCategory === 'all' ? (
              <div className="space-y-5">
                {categories
                  .filter((c) => c.id !== 'all')
                  .map((cat) => {
                    const catProducts = getCategoryProducts(cat.id);
                    if (!catProducts.length) return null;

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
                              onAdd={addToCart}
                              currencySymbol={activeCurrency.symbol}
                              exchangeRate={activeCurrency.exchangeRate}
                              salesType={config.salesType}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onAdd={addToCart}
                    currencySymbol={activeCurrency.symbol}
                    exchangeRate={activeCurrency.exchangeRate}
                    salesType={config.salesType}
                  />
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400 dark:border-slate-700 dark:bg-slate-800">
                    Aucun produit trouvé
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Cart Section */}
          <aside>
            <div className="sticky top-4 space-y-4">
              {/* Cart */}
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
                      onClick={clearCart}
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
                      <span className="text-xs not-italic">
                        Scannez un produit ou cliquez sur un article
                      </span>
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
                            onUpdateQuantity={updateQuantity}
                            onRemove={removeFromCart}
                            currencySymbol={activeCurrency.symbol}
                            exchangeRate={activeCurrency.exchangeRate}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 bg-slate-50 p-4 dark:bg-slate-700/50">
                  <div className="flex items-center justify-between text-xl font-black text-slate-800 dark:text-slate-200">
                    <span>Total</span>
                    <span className="text-blue-600">
                      {activeCurrency.symbol} {total.toFixed(2)}
                    </span>
                  </div>

                  {/* Payment Methods */}
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'mobile', 'account'] as PaymentMethod[]).map((method) => (
                      <button
                        key={method}
                        onClick={() => setPaymentMethod(method)}
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
                          {method === 'mobile' && <Phone size={20} />}
                          {method === 'account' && <Users size={20} />}
                          <span className="text-[10px] font-bold">
                            {method === 'cash' ? 'Espèces' : method === 'mobile' ? 'Mobile' : 'Compte'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Validate Button */}
                  <button
                    onClick={() => void handleValidateSale()}
                    disabled={isProcessing || cart.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600"
                  >
                    {isProcessing ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <CheckCircle size={20} />
                    )}
                    {isProcessing ? 'Validation...' : 'Valider la vente'}
                  </button>
                </div>
              </div>

              {/* Daily Stats */}
              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <div className="mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-300">
                  <TrendingUp size={16} />
                  <span className="text-sm font-bold">Résumé du jour</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="text-lg font-black text-blue-600">
                      {activeCurrency.symbol} {stats.total.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Ventes</p>
                    <p className="text-lg font-black text-slate-800 dark:text-slate-200">{stats.salesCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Client</p>
                    <p className="truncate text-lg font-black text-slate-800 dark:text-slate-200">
                      {stats.currentClient}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
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

      {/* Facture Printer Modal */}
      {showInvoice && currentSale && (
        <FacturePrinter
          sale={{
            id: String(currentSale.id),
            receiptNumber: currentSale.receiptNumber,
            items: currentSale.items.map(item => ({
              id: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              code: item.code,
            })),
            total: Number(currentSale.total),
            paymentMethod: currentSale.paymentMethod,
            timestamp: currentSale.timestamp,
            cashierName: currentSale.cashierName || cashierInfo.name,
            posName: currentSale.posName || cashierInfo.posName,
            sessionNumber: cashierInfo.sessionNumber,
            clientName: currentSale.clientType,
          }}
          pharmacyInfo={config.pharmacyInfo}
          invoiceConfig={config.invoice}
          primaryCurrency={config.primaryCurrency}
          currencies={config.currencies}
          onClose={() => setShowInvoice(false)}
          onPrint={() => {
            if (config.invoice.autoSave) {
              // Sauvegarde automatique déjà faite
            }
          }}
        />
      )}
    </div>
  );
}