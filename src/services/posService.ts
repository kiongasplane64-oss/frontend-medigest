// services/posService.ts
import { 
  observable, 
  action, 
  computed, 
  makeObservable, 
  runInAction 
} from 'mobx';
import { toast } from 'react-hot-toast';
import api from '@/api/client';
import { useAuthStore} from '@/store/useAuthStore';
import { saleService } from './saleService';
import { inventoryService } from './inventoryService';

// ============================================
// TYPES - ALIGNÉS AVEC LE BACKEND
// ============================================

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

/**
 * Interface Product alignée avec ce que renvoie le backend.
 * Plus de champs redondants comme 'price', 'wholesalePrice', etc.
 * Le backend gère la logique de prix, le frontend l'affiche.
 */
export interface Product {
  id: string;
  name: string;
  // Prix venant directement du backend
  selling_price: number;
  purchase_price: number;
  quantity: number;
  // Identifiants
  code: string;
  barcode?: string;
  qr_code?: string;
  // Catégorie
  category_id?: string;
  category?: Category;
  // Métadonnées
  description?: string;
  pharmacy_id?: string;
  // Pour l'affichage
  unit?: string;
  alert_threshold?: number;
  expiry_date?: string;
}

export interface CartItem {
  id: string;
  name: string;
  code: string;
  quantity: number;
  unitPrice: number;      // Prix unitaire utilisé pour le calcul (selling_price)
  stock: number;          // Stock actuel pour validation
  selling_price: number;  // Prix de vente original
}

export interface CashierInfo {
  id: string;
  name: string;
  posId: string;
  posName: string;
  sessionId: string;
  sessionNumber: string;
  pharmacy_id?: string;
}

export interface DailyStats {
  total: number;
  salesCount: number;
  currentClient: string;
}

export interface ScannedProduct {
  code: string;
  type: 'barcode' | 'qrcode';
  timestamp: number;
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  isActive: boolean;
  exchangeRate: number;
}

export interface PharmacyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  logoUrl?: string;
}

export interface PharmacyConfig {
  pharmacyId: string;
  pharmacyInfo: PharmacyInfo;
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

export type PaymentMethod = 'cash' | 'mobile_money' | 'account';
export type ScanMode = 'auto' | 'manual';

export interface SaleData {
  items: CartItem[];
  total: number;
  paymentMethod: PaymentMethod;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  posId: string;
  posName: string;
  sessionId: string;
  clientType: string;
  clientName?: string;
  currency: string;
  exchangeRate: number;
  pharmacy_id?: string;
}

// ============================================
// CONSTANTES
// ============================================

const SCAN_COOLDOWN = 1500;
const VIBRATION_DURATION = 80;
const PENDING_SALES_KEY = 'pending_sales';

// ============================================
// SERVICE PRINCIPAL
// ============================================

export class PosService {
  // États
  loading = true;
  isProcessing = false;
  products: Product[] = [];
  productsMap = new Map<string, Product>();
  categories: Category[] = [];
  filteredProducts: Product[] = [];
  cart: CartItem[] = [];
  search = '';
  selectedCategory = 'all';
  paymentMethod: PaymentMethod = 'cash';
  showInvoice = false;
  currentSale: any = null;
  showScanner = false;
  scanMode: ScanMode = 'auto';
  lastScanned: ScannedProduct | null = null;
  scanError: string | null = null;
  cashierInfo: CashierInfo = {
    id: '',
    name: '',
    posId: '',
    posName: '',
    sessionId: '',
    sessionNumber: '',
    pharmacy_id: '',
  };
  stats: DailyStats = {
    total: 0,
    salesCount: 0,
    currentClient: 'Passager',
  };
  config: PharmacyConfig = {
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
  };
  isOnline = true;
  
  // Nom du client modifiable
  clientName = 'Passager';

  // Callbacks pour les notifications
  private onCartChange?: (cart: CartItem[]) => void;
  private onProcessingChange?: (isProcessing: boolean) => void;
  private onShowInvoiceChange?: (show: boolean) => void;
  private onCurrentSaleChange?: (sale: any | null) => void;
  private onProductsChange?: (products: Product[]) => void;
  private onCategoriesChange?: (categories: Category[]) => void;
  private onConfigChange?: (config: PharmacyConfig) => void;
  private onStatsChange?: (stats: DailyStats) => void;

  constructor() {
    makeObservable(this, {
      loading: observable,
      isProcessing: observable,
      products: observable,
      productsMap: observable,
      categories: observable,
      filteredProducts: observable,
      cart: observable,
      search: observable,
      selectedCategory: observable,
      paymentMethod: observable,
      showInvoice: observable,
      currentSale: observable,
      showScanner: observable,
      scanMode: observable,
      lastScanned: observable,
      scanError: observable,
      cashierInfo: observable,
      stats: observable,
      config: observable,
      isOnline: observable,
      clientName: observable,
      
      total: computed,
      totalItems: computed,
      activeCurrency: computed,
      
      setLoading: action,
      setProcessing: action,
      setCart: action,
      addToCart: action,
      updateQuantity: action,
      removeFromCart: action,
      clearCart: action,
      setSearch: action,
      setSelectedCategory: action,
      setPaymentMethod: action,
      setShowInvoice: action,
      setCurrentSale: action,
      setShowScanner: action,
      setScanMode: action,
      setScanError: action,
      setLastScanned: action,
      setCashierInfo: action,
      updateStats: action,
      updateConfig: action,
      setOnlineStatus: action,
      loadInitialData: action,
      filterProducts: action,
      setClientName: action,
    });
  }

  // ============================================
  // COMPUTED PROPERTIES
  // ============================================

  get total(): number {
    const rawTotal = this.cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    if (this.config.sellByExchangeRate) {
      return rawTotal / this.activeCurrency.exchangeRate;
    }
    return rawTotal;
  }

  get totalItems(): number {
    return this.cart.reduce((acc, item) => acc + item.quantity, 0);
  }

  get activeCurrency(): CurrencyConfig {
    const currency = this.config.currencies.find(c => c.code === this.config.primaryCurrency);
    return currency || { code: 'CDF', symbol: 'FC', exchangeRate: 1, isActive: true };
  }

  // ============================================
  // MÉTHODES PUBLIQUES
  // ============================================

  setCallbacks(callbacks: {
    onCartChange?: (cart: CartItem[]) => void;
    onProcessingChange?: (isProcessing: boolean) => void;
    onShowInvoiceChange?: (show: boolean) => void;
    onCurrentSaleChange?: (sale: any | null) => void;
    onProductsChange?: (products: Product[]) => void;
    onCategoriesChange?: (categories: Category[]) => void;
    onConfigChange?: (config: PharmacyConfig) => void;
    onStatsChange?: (stats: DailyStats) => void;
  }) {
    this.onCartChange = callbacks.onCartChange;
    this.onProcessingChange = callbacks.onProcessingChange;
    this.onShowInvoiceChange = callbacks.onShowInvoiceChange;
    this.onCurrentSaleChange = callbacks.onCurrentSaleChange;
    this.onProductsChange = callbacks.onProductsChange;
    this.onCategoriesChange = callbacks.onCategoriesChange;
    this.onConfigChange = callbacks.onConfigChange;
    this.onStatsChange = callbacks.onStatsChange;
  }

  setLoading(loading: boolean) {
    this.loading = loading;
  }

  setProcessing(processing: boolean) {
    this.isProcessing = processing;
    this.onProcessingChange?.(processing);
  }

  setCart(cart: CartItem[]) {
    this.cart = cart;
    this.onCartChange?.(cart);
  }

  setSearch(value: string) {
    this.search = value;
    this.filterProducts();
  }

  setSelectedCategory(categoryId: string) {
    this.selectedCategory = categoryId;
    this.filterProducts();
  }

  setPaymentMethod(method: PaymentMethod) {
    this.paymentMethod = method;
  }

  setShowInvoice(show: boolean) {
    this.showInvoice = show;
    this.onShowInvoiceChange?.(show);
  }

  setCurrentSale(sale: any | null) {
    this.currentSale = sale;
    this.onCurrentSaleChange?.(sale);
  }

  setShowScanner(show: boolean) {
    this.showScanner = show;
  }

  setScanMode(mode: ScanMode) {
    this.scanMode = mode;
  }

  setScanError(error: string | null) {
    this.scanError = error;
  }

  setLastScanned(scanned: ScannedProduct | null) {
    this.lastScanned = scanned;
  }

  setCashierInfo(info: Partial<CashierInfo>) {
    this.cashierInfo = { ...this.cashierInfo, ...info };
  }

  updateStats(stats: Partial<DailyStats>) {
    this.stats = { ...this.stats, ...stats };
    this.onStatsChange?.(this.stats);
  }

  updateConfig(config: Partial<PharmacyConfig>) {
    this.config = { ...this.config, ...config };
    this.onConfigChange?.(this.config);
  }

  setOnlineStatus(isOnline: boolean) {
    this.isOnline = isOnline;
    if (isOnline) {
      this.syncPendingSales();
    }
  }

  setClientName(name: string) {
    this.clientName = name || 'Passager';
    this.stats.currentClient = this.clientName;
    this.onStatsChange?.(this.stats);
  }

  // ============================================
  // LOGIQUE MÉTIER - CHARGEMENT DIRECT API
  // ============================================

  /**
   * Charge les données initiales directement depuis l'API
   */
  async loadInitialData() {
    this.setLoading(true);
    try {
      // Charger les infos utilisateur
      await this.loadUserInfo();
      
      // Charger les produits
      await this.loadProducts();
      
      // Charger les catégories
      try {
        await this.loadCategories();
      } catch (e) {
        console.warn('Erreur catégories (non bloquante):', e);
        runInAction(() => {
          this.categories = [{ id: 'all', name: 'Tous' }];
        });
      }
      
      // Charger les stats
      await this.loadDailyStats();
      
      // Sauvegarder la config dans le cache (uniquement pour persistance des préférences)
      localStorage.setItem('pharmacy_config', JSON.stringify(this.config));
      
      // Synchroniser les ventes en attente
      await this.syncPendingSales();
      
      console.log('✅ Données chargées depuis le serveur');
      
    } catch (error) {
      console.error('❌ Erreur chargement données POS:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Charge les informations de l'utilisateur et sa session
   */
  async loadUserInfo() {
    try {
      const response = await api.get('/user/current-session');
      const { user } = useAuthStore.getState();
      
      const pharmacy_id = 
        response.data?.pharmacyId ||
        response.data?.pharmacy_id ||
        response.data?.current_pharmacy?.id ||
        response.data?.pharmacy?.id ||
        user?.pharmacy_id;

      console.log('👤 loadUserInfo - pharmacy_id:', pharmacy_id);

      if (pharmacy_id) {
        console.log('🏪 Chargement config pour pharmacie:', pharmacy_id);
        await this.loadConfig(pharmacy_id);
      } else {
        console.warn('⚠️ Aucun pharmacy_id trouvé');
      }

      this.setCashierInfo({
        id: user?.id || '',
        name: user?.nom_complet || user?.email || 'Caissier',
        posId: response.data?.posId || 'pos-main',
        posName: response.data?.posName || 'POS-01',
        sessionId: response.data?.sessionId || Date.now().toString(),
        sessionNumber: response.data?.sessionNumber || '001',
        pharmacy_id: pharmacy_id,
      });
      
    } catch (error) {
      console.error('❌ Erreur loadUserInfo:', error);
      throw error;
    }
  }

  /**
   * Charge la configuration de la pharmacie
   */
  async loadConfig(pharmacyId: string) {
    try {
      const response = await api.get(`/pharmacies/${pharmacyId}/config`);
      const loadedConfig = response.data.config || response.data || {};

      this.updateConfig({
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
      
      console.log('⚙️ Configuration chargée pour:', pharmacyId);
    } catch (error) {
      console.warn('⚠️ Erreur chargement config:', error);
      throw error;
    }
  }

  /**
   * Charge les produits depuis l'API
   */
  async loadProducts() {
    try {
      const { user } = useAuthStore.getState();
      const pharmacy_id = this.cashierInfo.pharmacy_id || user?.pharmacy_id;

      if (!pharmacy_id) {
        console.warn('⚠️ Aucun ID de pharmacie disponible');
        runInAction(() => {
          this.products = [];
          this.filteredProducts = [];
          this.filterProducts();
        });
        return;
      }

      const response = await inventoryService.getProducts({
        pharmacy_id: pharmacy_id,
        limit: 1000,
        skip: 0,
        include_sales_stats: false,
      });

      const rawProducts: any[] = response?.products || [];
      const normalizedProducts = rawProducts.map(p => this.normalizeProduct(p));
      
      runInAction(() => {
        this.products = normalizedProducts;
        this.rebuildProductsMap(normalizedProducts);
        this.filterProducts();
      });
      
      this.onProductsChange?.(this.products);
      
    } catch (error) {
      console.error('❌ Erreur chargement produits:', error);
      toast.error('Erreur de chargement des produits');
      throw error;
    }
  }

  /**
   * Normalise un produit
   */
  normalizeProduct(p: any): Product {
    return {
      id: String(p.id),
      name: p.name || p.product_name || p.commercial_name || 'Sans nom',
      selling_price: Number(p.selling_price ?? p.price ?? 0),
      purchase_price: Number(p.purchase_price ?? p.cost_price ?? p.buying_price ?? 0),
      quantity: Number(p.quantity ?? p.stock ?? p.current_stock ?? p.available_quantity ?? 0),
      code: p.code || p.sku || '',
      barcode: p.barcode || p.bar_code || undefined,
      qr_code: p.qr_code || p.qrCode || undefined,
      category_id: p.category_id ? String(p.category_id) : undefined,
      category: p.category && typeof p.category === 'object' ? {
        id: String(p.category.id || p.category_id),
        name: p.category.name || p.category,
      } : undefined,
      description: p.description || undefined,
      pharmacy_id: p.pharmacy_id || p.pharmacyId,
      unit: p.unit || 'unité',
      alert_threshold: p.alert_threshold ? Number(p.alert_threshold) : 5,
      expiry_date: p.expiry_date,
    };
  }

  /**
   * Reconstruit la map de recherche par code-barres/code
   */
  rebuildProductsMap(productList: Product[]) {
    const map = new Map<string, Product>();
    productList.forEach(p => {
      if (p.barcode) map.set(p.barcode, p);
      if (p.qr_code) map.set(p.qr_code, p);
      if (p.code) map.set(p.code, p);
    });
    runInAction(() => {
      this.productsMap = map;
    });
  }

  /**
   * Charge les catégories
   */
  async loadCategories() {
    try {
      const { user } = useAuthStore.getState();
      const pharmacy_id = this.cashierInfo.pharmacy_id || user?.pharmacy_id;

      const response = await api.get('/stock/categories', {
        params: { pharmacy_id },
      });

      let rawCategories: any[] = [];
      
      if (response.data?.categories && Array.isArray(response.data.categories)) {
        rawCategories = response.data.categories;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        rawCategories = response.data.data;
      } else if (Array.isArray(response.data)) {
        rawCategories = response.data;
      }

      const cats: Category[] = rawCategories.map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        icon: cat.icon,
      }));
      
      runInAction(() => {
        this.categories = [{ id: 'all', name: 'Tous' }, ...cats];
      });
      
      this.onCategoriesChange?.(this.categories);
      
    } catch (error) {
      console.warn('⚠️ Erreur chargement catégories:', error);
      runInAction(() => {
        this.categories = [{ id: 'all', name: 'Tous' }];
      });
      throw error;
    }
  }

  /**
   * Charge les statistiques quotidiennes
   */
  async loadDailyStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const { user } = useAuthStore.getState();
      const pharmacy_id = this.cashierInfo.pharmacy_id || user?.pharmacy_id;

      const response = await saleService.getDailyStats({
        date: todayStr,
        pharmacy_id: pharmacy_id ?? undefined,
      });

      const newStats = {
        total: Number(response?.total_amount || 0),
        salesCount: Number(response?.sales_count || 0),
        currentClient: this.clientName,
      };

      this.updateStats(newStats);
    } catch (error) {
      console.warn('⚠️ Erreur chargement stats:', error);
      // Garder les stats par défaut
    }
  }

  /**
   * Filtre les produits selon la recherche et la catégorie
   */
  filterProducts() {
    let filtered = [...this.products];

    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    }

    if (this.search.trim()) {
      const term = this.search.trim().toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.code?.toLowerCase().includes(term) ||
        p.barcode?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    runInAction(() => {
      this.filteredProducts = filtered;
    });
  }

  // ============================================
  // GESTION DU PANIER
  // ============================================

  /**
   * Ajoute un produit au panier
   */
  addToCart = (product: Product) => {
    if (product.quantity <= 0) {
      toast.error(`${product.name} est en rupture de stock`);
      return;
    }

    const unitPrice = product.selling_price;

    const existingIndex = this.cart.findIndex(item => item.id === product.id);

    if (existingIndex !== -1) {
      const existing = this.cart[existingIndex];
      const newQuantity = existing.quantity + 1;
      
      if (newQuantity > product.quantity) {
        toast.error(`Stock insuffisant pour ${product.name}`);
        return;
      }
      
      const newCart = [...this.cart];
      newCart[existingIndex] = { 
        ...existing, 
        quantity: newQuantity,
        unitPrice 
      };
      this.setCart(newCart);
    } else {
      const newItem: CartItem = {
        id: product.id,
        name: product.name,
        code: product.code,
        quantity: 1,
        unitPrice: unitPrice,
        stock: product.quantity,
        selling_price: product.selling_price,
      };
      this.setCart([newItem, ...this.cart]);
    }
    
    toast.success(`${product.name} ajouté au panier`);
    this.vibrate();
  };

  updateQuantity = (index: number, delta: number) => {
    const newCart = [...this.cart];
    const item = newCart[index];
    if (!item) return;

    const newQuantity = item.quantity + delta;

    if (delta > 0 && newQuantity > item.stock) {
      toast.error(`Stock insuffisant pour ${item.name}`);
      return;
    }

    if (newQuantity <= 0) {
      newCart.splice(index, 1);
    } else {
      newCart[index] = { ...item, quantity: newQuantity };
    }

    this.setCart(newCart);
  };

  removeFromCart = (index: number) => {
    const newCart = [...this.cart];
    newCart.splice(index, 1);
    this.setCart(newCart);
  };

  clearCart = () => {
    if (this.cart.length > 0 && window.confirm('Vider le panier ?')) {
      this.setCart([]);
    }
  };

  // ============================================
  // GESTION DU SCAN
  // ============================================

  handleScan = (detectedCode: string, type: 'barcode' | 'qrcode') => {
    const code = detectedCode.trim();
    if (!code) return;

    this.setScanError(null);

    const now = Date.now();
    if (this.lastScanned && this.lastScanned.code === code && now - this.lastScanned.timestamp < SCAN_COOLDOWN) {
      return;
    }

    this.setLastScanned({ code, type, timestamp: now });

    const product = this.productsMap.get(code);

    if (!product) {
      this.setScanError(`Produit non trouvé : ${code}`);
      toast.error(`Produit non trouvé : ${code}`);
      this.playBeep('error');
      return;
    }

    this.addToCart(product);
    this.playBeep('success');
    this.vibrate();

    if (this.scanMode === 'auto') {
      this.setShowScanner(false);
    }
  };

  playBeep(type: 'success' | 'error') {
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
  }

  vibrate() {
    if (navigator.vibrate) {
      navigator.vibrate(VIBRATION_DURATION);
    }
  }

  // ============================================
  // VALIDATION DE LA VENTE - VERSION OPTIMISÉE
  // ============================================

  /**
   * Valide la vente avec affichage immédiat de la facture
   * L'appel API se fait en arrière-plan pour une expérience ultra-rapide (< 1s)
   */
  async validateSale() {
    // Vérifications rapides
    if (this.cart.length === 0) {
      toast.error('Panier vide');
      return;
    }
    
    if (this.isProcessing) {
      toast.error('Une vente est déjà en cours');
      return;
    }

    this.setProcessing(true);

    // Sauvegarde immédiate des données (copie profonde)
    const cartSnapshot = this.cart.map(item => ({ ...item }));
    const clientNameSnapshot = this.clientName;
    const paymentMethodSnapshot = this.paymentMethod;
    const timestamp = Date.now();

    // Calcul du total (synchronisé, immédiat)
    const rawTotal = cartSnapshot.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const totalAmount = this.config.sellByExchangeRate
      ? rawTotal / this.activeCurrency.exchangeRate
      : rawTotal;

    // CRÉER LA FACTURE INSTANTANÉMENT (sans attendre l'API)
    const saleForReceipt = {
      id: `temp-${timestamp}`,
      receiptNumber: `TEMP-${timestamp}`,
      items: cartSnapshot.map(item => ({
        id: item.id,
        name: item.name,
        price: item.unitPrice,
        quantity: item.quantity,
        code: item.code,
      })),
      total: totalAmount,
      paymentMethod: paymentMethodSnapshot,
      timestamp: timestamp,
      cashierName: this.cashierInfo.name,
      posName: this.cashierInfo.posName,
      sessionNumber: this.cashierInfo.sessionNumber,
      clientName: clientNameSnapshot,
    };

    // VIDER LE PANIER IMMÉDIATEMENT (feedback utilisateur instantané)
    this.setCart([]);
    
    // AFFICHER LA FACTURE IMMÉDIATEMENT (UX ultra-rapide)
    this.setCurrentSale(saleForReceipt);
    this.setShowInvoice(true);
    
    // Mettre à jour les stats localement (optimiste)
    this.updateStats({
      total: this.stats.total + totalAmount,
      salesCount: this.stats.salesCount + 1,
      currentClient: clientNameSnapshot,
    });

    // Déclencher l'impression automatique si configurée
    if (this.config.invoice.autoPrint) {
      setTimeout(() => window.print(), 100);
    }

    toast.success('Vente enregistrée !');

    // --- TRAITEMENT ASYNCHRONE EN ARRIÈRE-PLAN ---
    // L'API est appelée sans bloquer l'interface
    this.processSaleInBackground(cartSnapshot, {
      totalAmount,
      paymentMethod: paymentMethodSnapshot,
      clientName: clientNameSnapshot,
      timestamp,
      tempId: saleForReceipt.id,
    });
    
    this.setProcessing(false);
  }

  /**
   * Traitement asynchrone de la vente en arrière-plan
   * Ne bloque pas l'interface utilisateur
   */
  async processSaleInBackground(
    cartSnapshot: CartItem[],
    saleInfo: {
      totalAmount: number;
      paymentMethod: PaymentMethod;
      clientName: string;
      timestamp: number;
      tempId: string;
    }
  ) {
    try {
      const saleData = {
        items: cartSnapshot.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })),
        total_amount: saleInfo.totalAmount,
        payment_method: saleInfo.paymentMethod,
        client_name: saleInfo.clientName,
        pharmacy_id: this.cashierInfo.pharmacy_id,
        timestamp: saleInfo.timestamp,
      };

      // Appel API en arrière-plan
      const response = await saleService.createSale(saleData);

      // Récupérer le vrai numéro de reçu et l'ID
      let realReceiptNumber = '';
      let realSaleId = '';
      
      // Get the actual sale data from the nested structure
      const saleDataObj = response.data || response.sale;
      
      if (saleDataObj) {
        // Extraire le numéro de reçu
        if (saleDataObj.receipt_number) {
          realReceiptNumber = saleDataObj.receipt_number;
        } else if (response.receipt_number) {
          realReceiptNumber = response.receipt_number;
        }
        
        // Extraire l'ID de la vente
        if (saleDataObj.id) {
          realSaleId = saleDataObj.id;
        } else if (saleDataObj.reference) {
          realSaleId = saleDataObj.reference;
        }
      }

      // Mettre à jour la facture avec les vraies informations
      if ((realReceiptNumber || realSaleId) && this.currentSale && this.currentSale.id === saleInfo.tempId) {
        const updatedSale = {
          ...this.currentSale,
          id: realSaleId || this.currentSale.id,
          receiptNumber: realReceiptNumber || this.currentSale.receiptNumber,
        };
        this.setCurrentSale(updatedSale);
      }

      // Rafraîchir les stats depuis le serveur (en arrière-plan)
      await this.loadDailyStats();
      
      console.log('✅ Vente synchronisée avec le serveur:', realReceiptNumber);

    } catch (error) {
      console.error('❌ Erreur synchronisation vente:', error);
      
      // Notification discrète d'erreur (sans bloquer l'utilisateur)
      toast.error('Erreur de synchronisation. La vente sera réessayée.', {
        duration: 4000,
      });
      
      // Stocker la vente en attente pour réessai ultérieur
      this.queuePendingSale(cartSnapshot, saleInfo);
    }
  }

  /**
   * Stocke une vente en attente pour synchronisation ultérieure
   */
  private queuePendingSale(cartSnapshot: CartItem[], saleInfo: {
    totalAmount: number;
    paymentMethod: PaymentMethod;
    clientName: string;
    timestamp: number;
    tempId: string;
  }) {
    try {
      const existing = JSON.parse(localStorage.getItem(PENDING_SALES_KEY) || '[]');
      existing.push({
        cart: cartSnapshot,
        saleInfo: {
          totalAmount: saleInfo.totalAmount,
          paymentMethod: saleInfo.paymentMethod,
          clientName: saleInfo.clientName,
          timestamp: saleInfo.timestamp,
        },
        pharmacy_id: this.cashierInfo.pharmacy_id,
        createdAt: Date.now(),
      });
      localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(existing));
      
      console.log('📦 Vente mise en file d\'attente pour synchronisation');
    } catch (e) {
      console.error('Erreur sauvegarde vente en attente:', e);
    }
  }

  /**
   * Synchronise les ventes en attente (à appeler quand la connexion revient)
   */
  async syncPendingSales() {
    try {
      const pendingSales = JSON.parse(localStorage.getItem(PENDING_SALES_KEY) || '[]');
      
      if (pendingSales.length === 0) return;
      
      console.log(`🔄 Synchronisation de ${pendingSales.length} ventes en attente...`);
      
      const remainingSales = [];
      
      for (const pending of pendingSales) {
        try {
          const saleData = {
            items: pending.cart.map((item: CartItem) => ({
              product_id: item.id,
              quantity: item.quantity,
              unit_price: item.unitPrice,
            })),
            total_amount: pending.saleInfo.totalAmount,
            payment_method: pending.saleInfo.paymentMethod,
            client_name: pending.saleInfo.clientName,
            pharmacy_id: pending.pharmacy_id || this.cashierInfo.pharmacy_id,
            timestamp: pending.saleInfo.timestamp,
          };
          
          await saleService.createSale(saleData);
          console.log('✅ Vente en attente synchronisée');
        } catch (error) {
          console.error('❌ Erreur synchronisation vente en attente:', error);
          remainingSales.push(pending);
        }
      }
      
      // Mettre à jour le stock avec les ventes restantes
      if (remainingSales.length > 0) {
        localStorage.setItem(PENDING_SALES_KEY, JSON.stringify(remainingSales));
      } else {
        localStorage.removeItem(PENDING_SALES_KEY);
      }
      
    } catch (error) {
      console.error('Erreur synchronisation ventes en attente:', error);
    }
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  getCategoryProducts(categoryId: string): Product[] {
    if (categoryId === 'all') {
      return this.products;
    }
    return this.products.filter(p => p.category_id === categoryId);
  }

  applyTheme() {
    const root = document.documentElement;
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (this.config.theme === 'dark') {
      root.classList.add('dark');
    } else if (this.config.theme === 'light') {
      root.classList.remove('dark');
    } else if (this.config.theme === 'system') {
      if (systemDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }

  reset() {
    this.setLoading(true);
    this.setProcessing(false);
    this.setCart([]);
    this.setSearch('');
    this.setSelectedCategory('all');
    this.setPaymentMethod('cash');
    this.setShowInvoice(false);
    this.setCurrentSale(null);
    this.setShowScanner(false);
    this.setScanMode('auto');
    this.setLastScanned(null);
    this.setScanError(null);
    this.products = [];
    this.productsMap.clear();
    this.categories = [];
    this.filteredProducts = [];
    this.clientName = 'Passager';
  }
}

// Export d'une instance unique
export const posService = new PosService();

// Export également la classe
export default PosService;