import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import {
  Search,
  Trash2,
  Banknote,
  Loader2,
  CheckCircle,
  Lock,
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
  Receipt,
  RefreshCw,
  WifiOff,
} from 'lucide-react'; // Supprimé Wifi qui n'est pas utilisé
import { Link, useLocation } from 'react-router-dom';
import { useHotkeys } from 'react-hotkeys-hook';
import { Scanner } from '@yudiel/react-qr-scanner';
import { toast } from 'react-hot-toast';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useOnline } from '@/hooks/useOnline';
import { useSubscription } from '@/hooks/useSubscription';
import { db, OfflineSale } from '@/db/offlineDb'; 
import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';
import { debounce } from '@/utils/debounce';

// Types
interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  category?: Category;
  stock: number;
  code: string;
  barcode?: string;
  qrCode?: string;
  description?: string;
}

interface CartItem extends Product {
  quantity: number;
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

type PaymentMethod = 'cash' | 'mobile' | 'account';
type ScanMode = 'auto' | 'manual';

// Constantes
const DEBOUNCE_DELAY = 300;
const SCAN_COOLDOWN = 1500;
const VIBRATION_DURATION = 80;

// Composants memoïsés
const ProductCard = memo(({ product, onAdd }: { product: Product; onAdd: (product: Product) => void }) => (
  <button
    type="button"
    onClick={() => onAdd(product)}
    disabled={product.stock <= 0}
    className={`
      rounded-2xl border p-4 text-left transition-all duration-200
      ${product.stock <= 0
        ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
        : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
      }
    `}
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
          ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
        `}
      >
        {product.stock}
      </span>
    </div>

    <div className="mt-4 flex items-center justify-between">
      <span className="text-lg font-black text-blue-600">
        {product.price.toFixed(2)} FCFA
      </span>
      <span className="text-xs text-slate-400">Cliquer pour ajouter</span>
    </div>
  </button>
));

ProductCard.displayName = 'ProductCard';

const CartItemComponent = memo(({ 
  item, 
  index, 
  onUpdateQuantity, 
  onRemove 
}: { 
  item: CartItem; 
  index: number; 
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemove: (index: number) => void;
}) => (
  <div className="rounded-2xl bg-slate-50 p-3 transition-all hover:bg-slate-100">
    <div className="mb-2 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-800">{item.name}</p>
        <p className="text-xs text-slate-400">
          {item.price.toFixed(2)} FCFA/u · Stock: {item.stock}
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
        {(item.price * item.quantity).toFixed(2)} FCFA
      </p>
    </div>
  </div>
));

CartItemComponent.displayName = 'CartItemComponent';

export default function POS() {
  const { isExpired } = useSubscription();
  const { user } = useAuthStore();
  const location = useLocation();
  const isOnline = useOnline();

  // États
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

  // Hotkeys
  useHotkeys('ctrl+k', () => {
    searchInputRef.current?.focus();
  });

  useHotkeys('ctrl+s', () => {
    setShowScanner((prev) => !prev);
  });

  useHotkeys('ctrl+enter', () => {
    if (cart.length > 0 && !isExpired && !isProcessing) {
      void handleValidateSale();
    }
  });

  useHotkeys('escape', () => {
    setShowScanner(false);
    setShowInvoice(false);
  });

  // Effets
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

  // Mémoïsation
  const total = useMemo(
    () => cart.reduce((acc, item) => acc + item.price * item.quantity, 0),
    [cart],
  );

  const totalItems = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart],
  );

  const todayText = useMemo(
    () => new Date().toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    [],
  );

  const navigation = useMemo(() => [
    { name: 'Vente', icon: <ShoppingCart size={18} />, path: '/pos' },
    { name: 'Clients', icon: <Users size={18} />, path: '/clients' },
    { name: 'Stock', icon: <Package size={18} />, path: '/stock' },
    { name: 'Rapports', icon: <BarChart3 size={18} />, path: '/rapports' },
    { name: 'Paramètres', icon: <Settings size={18} />, path: '/settings' },
  ], []);

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

  // Chargement des données
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
      setCashierInfo({
        id: user?.id || '',
        name: user?.nom_complet || user?.email || 'Caissier',
        posId: response.data?.posId || 'pos-main',
        posName: response.data?.posName || 'POS-01',
        sessionId: response.data?.sessionId || Date.now().toString(),
        sessionNumber: response.data?.sessionNumber || '001',
      });

      // Sauvegarder la session en offline
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
      
      // Récupérer la session depuis offline
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
  }, [user]);

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
      }));

      // Sauvegarder en offline
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
        categoryId: String(p.categoryId ?? p.category_id ?? p.category?.id ?? 'uncategorized'),
        category: p.category,
        stock: Number(p.stock ?? p.quantity ?? 0),
        code: p.code || '',
        barcode: p.barcode || undefined,
        qrCode: p.qrCode || p.qr_code || undefined,
        description: p.description || undefined,
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

      // Sauvegarder en offline
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

      // Sauvegarder en offline
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
    if (isExpired) {
      toast.error('Abonnement expiré - ventes désactivées');
      return;
    }

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
  }, [isExpired, lastScanned, productsMap, scanMode, playBeep, vibrate]);

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
    if (isExpired) return;

    if (product.stock <= 0) {
      toast.error(`${product.name} est en rupture de stock`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        if (existing.quantity + 1 > product.stock) {
          toast.error(`Stock insuffisant pour ${product.name}`);
          return prev;
        }

        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }

      return [...prev, { ...product, quantity: 1 }];
    });
  }, [isExpired]);

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
    if (cart.length === 0 || isExpired || isProcessing) return;

    setIsProcessing(true);

    const saleData = {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name,
        barcode: item.barcode,
        code: item.code,
      })),
      total,
      paymentMethod,
      timestamp: new Date().toISOString(),
      cashierId: cashierInfo.id,
      cashierName: cashierInfo.name,
      posId: cashierInfo.posId,
      posName: cashierInfo.posName,
      sessionId: cashierInfo.sessionId,
      clientType: stats.currentClient,
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
      setShowInvoice(true);
      setCart([]);

      await loadDailyStats();
      
      toast.success(isOnline ? 'Vente enregistrée avec succès' : 'Vente enregistrée en mode hors-ligne');
    } catch (error) {
      console.error('Erreur lors de la vente:', error);
      toast.error('Erreur lors de l\'enregistrement de la vente');
    } finally {
      setIsProcessing(false);
    }
  }, [cart, isExpired, isProcessing, isOnline, total, paymentMethod, cashierInfo, stats.currentClient, updateLocalStock, loadDailyStats]);

  const paymentLabel = useCallback((method: PaymentMethod) => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'mobile': return 'Mobile Money';
      case 'account': return 'Compte Client';
      default: return method;
    }
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
          <p className="text-slate-600">Chargement de la caisse...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bannière hors-ligne */}
      {!isOnline && (
        <div className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-amber-500 py-2 text-sm font-medium text-white">
          <WifiOff size={16} />
          Mode hors-ligne - Les ventes seront synchronisées plus tard
        </div>
      )}

      {/* Overlay abonnement expiré */}
      {isExpired && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50/50 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-3xl border border-orange-100 bg-white p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <Lock size={32} />
            </div>
            <h2 className="text-xl font-black text-slate-800">Abonnement expiré</h2>
            <p className="mt-2 text-sm text-slate-500">
              Votre accès est en lecture seule. Les ventes sont désactivées.
            </p>
            <button className="mt-6 w-full rounded-xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700">
              Renouveler l&apos;abonnement
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600 px-4 py-2 text-xl font-black text-white">
              GoApp
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Point de vente</p>
              <p className="text-xs text-slate-400">{todayText}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
              <User size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">
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
      <nav className="border-b border-slate-200 bg-white px-4 py-3 md:px-6">
        <div className="flex gap-2 overflow-x-auto">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`
                inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors
                ${location.pathname === item.path
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:bg-slate-50'
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
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-800">Scanner un produit</h3>
                  <p className="text-sm text-slate-400">
                    Scan code-barres ou QR code
                  </p>
                </div>
                <button
                  onClick={() => setShowScanner(false)}
                  className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
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
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
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
                      className="w-full rounded-2xl border border-slate-200 py-3 pl-12 pr-4 outline-none transition-shadow focus:ring-2 focus:ring-blue-500"
                      onKeyDown={handleBarcodeInput}
                    />
                  </div>
                  <p className="text-sm text-slate-400">
                    Compatible douchette code-barres
                  </p>
                </div>
              )}

              {scanError && (
                <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-600">
                  <AlertCircle size={16} />
                  {scanError}
                </div>
              )}

              {lastScanned && (
                <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">
                  Dernier scan : <strong>{lastScanned.code}</strong> ({lastScanned.type})
                </div>
              )}
            </div>

            <div className="bg-slate-50 p-5">
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
          <section className={isExpired ? 'pointer-events-none opacity-60' : ''}>
            {/* Search Bar */}
            <div className="mb-4 flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input
                  ref={searchInputRef}
                  id="search-input"
                  disabled={isExpired}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none transition-shadow focus:ring-2 focus:ring-blue-500"
                  placeholder="Rechercher un produit (nom, code, code-barres...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button
                onClick={() => setShowScanner(true)}
                disabled={isExpired}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
              >
                <Camera size={20} />
                Scanner
              </button>

              <button
                onClick={() => void loadInitialData()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <RefreshCw size={18} />
                Actualiser
              </button>
            </div>

            {/* Hotkeys Info */}
            <div className="mb-4 flex flex-wrap gap-2 rounded-2xl bg-blue-50 p-3 text-xs text-blue-700">
              <span className="rounded-lg bg-white px-2 py-1">Ctrl + K : recherche</span>
              <span className="rounded-lg bg-white px-2 py-1">Ctrl + S : scanner</span>
              <span className="rounded-lg bg-white px-2 py-1">Ctrl + Enter : valider</span>
              <span className="rounded-lg bg-white px-2 py-1">Esc : fermer</span>
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
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
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
                        className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm"
                      >
                        <h3 className="mb-4 text-lg font-black text-slate-800">{cat.name}</h3>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {catProducts.map((product) => (
                            <ProductCard key={product.id} product={product} onAdd={addToCart} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} onAdd={addToCart} />
                ))}

                {filteredProducts.length === 0 && (
                  <div className="col-span-full rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-400">
                    Aucun produit trouvé
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Cart Section */}
          <aside className={isExpired ? 'pointer-events-none opacity-50' : ''}>
            <div className="sticky top-4 space-y-4">
              {/* Cart */}
              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-100 p-4">
                  <h3 className="flex items-center gap-2 text-lg font-black text-slate-800">
                    <ShoppingCart size={20} />
                    Panier
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">
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
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 bg-slate-50 p-4">
                  <div className="flex items-center justify-between text-xl font-black text-slate-800">
                    <span>Total</span>
                    <span className="text-blue-600">{total.toFixed(2)} FCFA</span>
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
                            : 'border border-slate-200 bg-white text-slate-500 hover:border-blue-300'
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
                    disabled={isProcessing || cart.length === 0 || isExpired}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
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
              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2 text-slate-700">
                  <TrendingUp size={16} />
                  <span className="text-sm font-bold">Résumé du jour</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Total</p>
                    <p className="text-lg font-black text-blue-600">
                      {stats.total.toFixed(2)} FCFA
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Ventes</p>
                    <p className="text-lg font-black text-slate-800">{stats.salesCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Client</p>
                    <p className="truncate text-lg font-black text-slate-800">
                      {stats.currentClient}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/historique"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <History size={16} />
                  Historique
                </Link>

                <Link
                  to="/factures"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <FileText size={16} />
                  Factures
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Invoice Modal */}
      {showInvoice && currentSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                  <Receipt size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">
                    Facture #{currentSale.id}
                  </h3>
                  {currentSale.receiptNumber && (
                    <p className="text-sm text-slate-400">
                      Reçu #{currentSale.receiptNumber}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="border-b border-slate-100 pb-4 text-center">
                <h4 className="text-lg font-black">GoApp</h4>
                <p className="text-sm text-slate-400">
                  {cashierInfo.posName} · Session {cashierInfo.sessionNumber}
                </p>
                <p className="text-sm text-slate-400">
                  {new Date(currentSale.timestamp).toLocaleString()}
                </p>
                <p className="text-sm text-slate-400">Caissier: {cashierInfo.name}</p>
              </div>

              <div className="space-y-2">
                {currentSale.items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between gap-3 text-sm">
                    <span>
                      {item.quantity} × {item.name}
                    </span>
                    <span className="font-bold">
                      {(item.price * item.quantity).toFixed(2)} FCFA
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-4">
                <div className="flex justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-blue-600">
                    {Number(currentSale.total).toFixed(2)} FCFA
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Paiement: {paymentLabel(currentSale.paymentMethod as PaymentMethod)}
                </p>
                {currentSale.status === 'pending' && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                    <WifiOff size={12} />
                    En attente de synchronisation
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-6">
              <button
                onClick={() => window.print()}
                className="rounded-2xl bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700"
              >
                Imprimer
              </button>
              <button
                onClick={() => setShowInvoice(false)}
                className="rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}