// services/posService.ts - Version sans synchronisation, vente directe au serveur
import { 
  observable, 
  action, 
  computed, 
  makeObservable, 
  runInAction 
} from 'mobx';
import { toast } from 'react-hot-toast';
import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';
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

export interface Product {
  id: string;
  name: string;
  selling_price: number;
  purchase_price: number;
  quantity: number;
  code: string;
  barcode?: string;
  qr_code?: string;
  category_id?: string;
  category?: Category;
  description?: string;
  pharmacy_id?: string;
  unit?: string;
  alert_threshold?: number;
  expiry_date?: string;
}

export interface CartItem {
  id: string;
  name: string;
  code: string;
  quantity: number;
  unitPrice: number;
  stock: number;
  selling_price: number;
  discount_percent?: number;
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

export type SalesType = 'wholesale' | 'retail' | 'both';
export type CurrencyMode = 'cdf_only' | 'usd_only' | 'both';

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
  items: Array<{
    product_id: string;
    quantity: number;
    discount_percent?: number;
  }>;
  total: number;
  paymentMethod: PaymentMethod;
  timestamp: string;
  cashierId: string;
  cashierName: string;
  posId: string;
  posName: string;
  sessionId: string;
  clientType: string;
  customerName?: string;
  currency: string;
  exchangeRate: number;
  pharmacy_id?: string;
}

export interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  timezone?: string;
  daysOff: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

export interface MarginConfig {
  defaultMargin: number;
  minMargin: number;
  maxMargin: number;
}

export interface AutomaticPricingConfig {
  enabled: boolean;
  method: 'percentage' | 'coefficient' | 'margin';
  value: number;
}

// ============================================
// CONSTANTES
// ============================================

const SCAN_COOLDOWN = 1500;
const VIBRATION_DURATION = 80;

// ============================================
// SERVICE PRINCIPAL - SANS SYNCHRONISATION
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
  
  customerName = 'Passager';

  // Callbacks
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
      customerName: observable,
      
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
      setCustomerName: action,
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
    // Plus de synchronisation automatique
    console.log(`📡 Statut de connexion: ${isOnline ? 'En ligne' : 'Hors ligne'}`);
  }

  setCustomerName(name: string) {
    this.customerName = name || 'Passager';
    this.stats.currentClient = this.customerName;
    this.onStatsChange?.(this.stats);
  }

  // ============================================
  // LOGIQUE MÉTIER - CHARGEMENT DIRECT API
  // ============================================

  async loadInitialData() {
    this.setLoading(true);
    try {
      await this.loadUserInfo();
      await this.loadProducts();
      
      try {
        await this.loadCategories();
      } catch (e) {
        console.warn('Erreur catégories (non bloquante):', e);
        runInAction(() => {
          this.categories = [{ id: 'all', name: 'Tous' }];
        });
      }
      
      await this.loadDailyStats();
      
      localStorage.setItem('pharmacy_config', JSON.stringify(this.config));
      
      console.log('✅ Données chargées depuis le serveur');
      
    } catch (error) {
      console.error('❌ Erreur chargement données POS:', error);
      toast.error('Erreur de connexion au serveur');
    } finally {
      this.setLoading(false);
    }
  }

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

      console.log(`📦 Chargement de tous les produits pour la pharmacie: ${pharmacy_id}`);

      const allProducts = await inventoryService.getAllProducts(pharmacy_id);
      const normalizedProducts = allProducts.map(p => this.normalizeProduct(p));
      
      runInAction(() => {
        this.products = normalizedProducts;
        this.rebuildProductsMap(normalizedProducts);
        this.filterProducts();
      });
      
      this.onProductsChange?.(this.products);
      
      console.log(`✅ ${normalizedProducts.length} produits chargés (tous les produits de la branche)`);
      
    } catch (error) {
      console.error('❌ Erreur chargement produits:', error);
      toast.error('Erreur de chargement des produits');
      throw error;
    }
  }

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
        currentClient: this.customerName,
      };

      this.updateStats(newStats);
    } catch (error) {
      console.warn('⚠️ Erreur chargement stats:', error);
    }
  }

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

  addToCart = (product: Product, discountPercent: number = 0) => {
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
        unitPrice,
        discount_percent: discountPercent
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
        discount_percent: discountPercent,
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
  // VALIDATION DE LA VENTE - DIRECTE AU SERVEUR
  // ============================================

  async validateSale(): Promise<{ success: boolean; data?: any; error?: string }> {
    if (this.cart.length === 0) {
      toast.error('Panier vide');
      return { success: false, error: 'Panier vide' };
    }
    
    if (this.isProcessing) {
      toast.error('Une vente est déjà en cours');
      return { success: false, error: 'Vente déjà en cours' };
    }

    if (!this.isOnline) {
      toast.error('Connexion internet requise pour effectuer une vente');
      return { success: false, error: 'Hors ligne' };
    }

    this.setProcessing(true);

    try {
      const cartSnapshot = this.cart.map(item => ({ ...item }));
      const customerNameSnapshot = this.customerName;
      const paymentMethodSnapshot = this.paymentMethod;
      const globalDiscount = 0; // À passer en paramètre si besoin

      // Calcul des totaux
      const subtotal = cartSnapshot.reduce((acc, item) => {
        const itemTotal = item.unitPrice * item.quantity;
        const itemDiscount = itemTotal * ((item.discount_percent || 0) / 100);
        return acc + (itemTotal - itemDiscount);
      }, 0);
      
      const total = subtotal * (1 - (globalDiscount / 100));

      // Préparer les données pour l'API
      const saleData = {
        items: cartSnapshot.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          discount_percent: item.discount_percent || 0,
        })),
        payment_method: paymentMethodSnapshot,
        customer_name: customerNameSnapshot,
        pharmacy_id: this.cashierInfo.pharmacy_id,
        global_discount_percent: globalDiscount > 0 ? globalDiscount : undefined,
      };

      console.log('📤 Envoi de la vente au serveur:', saleData);
      
      const response = await api.post('/sales', saleData);
      const saleResponse = response.data.sale || response.data;
      
      console.log('✅ Vente enregistrée sur le serveur:', saleResponse);

      // Créer l'objet facture
      const invoiceData = {
        id: saleResponse?.id || `sale_${Date.now()}`,
        receiptNumber: saleResponse?.receipt_number || `VENTE-${Date.now()}`,
        items: cartSnapshot.map(item => ({
          id: item.id,
          name: item.name,
          price: item.unitPrice,
          quantity: item.quantity,
          code: item.code,
          discount_percent: item.discount_percent || 0,
          discount_amount: ((item.unitPrice * item.quantity) * ((item.discount_percent || 0) / 100))
        })),
        subtotal: subtotal,
        total: total,
        discount_percent: globalDiscount,
        discount_amount: subtotal * (globalDiscount / 100),
        paymentMethod: paymentMethodSnapshot,
        timestamp: Date.now(),
        cashierName: this.cashierInfo.name,
        cashierId: this.cashierInfo.id,
        posName: this.cashierInfo.posName,
        branchId: this.cashierInfo.pharmacy_id,
        sessionNumber: this.cashierInfo.sessionNumber,
        customerName: customerNameSnapshot,
      };

      // Vider le panier
      this.setCart([]);
      
      // Afficher la facture
      this.setCurrentSale(invoiceData);
      this.setShowInvoice(true);
      
      // Mettre à jour les stats
      this.updateStats({
        total: this.stats.total + total,
        salesCount: this.stats.salesCount + 1,
        currentClient: customerNameSnapshot,
      });

      if (this.config.invoice.autoPrint) {
        setTimeout(() => window.print(), 100);
      }

      toast.success(`Vente enregistrée ! Réf: ${invoiceData.receiptNumber}`);
      
      // Recharger les produits pour mettre à jour les stocks
      await this.loadProducts();
      
      this.setProcessing(false);
      
      return { success: true, data: invoiceData };
      
    } catch (error: any) {
      console.error('❌ Erreur validation:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la validation';
      toast.error(errorMessage);
      
      this.setProcessing(false);
      
      return { success: false, error: errorMessage };
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
    this.customerName = 'Passager';
  }
}

export const posService = new PosService();
export default PosService;