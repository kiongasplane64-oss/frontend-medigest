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
import { db, OfflineSale, OfflineSession } from '@/db/offlineDb';
import { useAuthStore} from '@/store/useAuthStore';
import { saleService } from './saleService';
import { inventoryService } from './inventoryService';

// ============================================
// TYPES
// ============================================

export interface Category {
  id: string;
  name: string;
  icon?: string;
}

export interface Product {
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
  pharmacy_id?: string;
}

export interface CartItem extends Product {
  quantity: number;
  unitPrice: number;
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
export type SaleStatus = 'synced' | 'pending' | 'failed';

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
  currency: string;
  exchangeRate: number;
  pharmacy_id?: string;
}

// ============================================
// CONSTANTES
// ============================================

const SCAN_COOLDOWN = 1500;
const VIBRATION_DURATION = 80;

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
  currentSale: OfflineSale | null = null;
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

  // Callbacks pour les notifications
  private onCartChange?: (cart: CartItem[]) => void;
  private onProcessingChange?: (isProcessing: boolean) => void;
  private onShowInvoiceChange?: (show: boolean) => void;
  private onCurrentSaleChange?: (sale: OfflineSale | null) => void;
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
    onCurrentSaleChange?: (sale: OfflineSale | null) => void;
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

  setCurrentSale(sale: OfflineSale | null) {
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
  }

  // ============================================
  // LOGIQUE MÉTIER
  // ============================================

  /**
   * Charge toutes les données initiales
   */
  async loadInitialData() {
    this.setLoading(true);
    try {
      // Étape 1: Charger les infos utilisateur et la config (obtient le pharmacy_id)
      await this.loadUserInfo();
      
      console.log('📌 loadUserInfo terminé, pharmacy_id:', this.cashierInfo.pharmacy_id);
      
      // Étape 2: Charger les données qui dépendent du pharmacy_id
      // On charge d'abord les produits, puis les catégories (qui peuvent être vides)
      await this.loadProducts();
      
      // Les catégories sont optionnelles - on les charge même si l'API échoue
      try {
        await this.loadCategories();
      } catch (categoriesError) {
        console.warn('⚠️ Erreur chargement catégories (non critique):', categoriesError);
        // On continue même sans catégories - les produits s'afficheront quand même
        runInAction(() => {
          this.categories = [{ id: 'all', name: 'Tous' }];
        });
      }
      
      await this.loadDailyStats();
      
      console.log('✅ Toutes les données chargées avec succès - produits:', this.products.length);
    } catch (error) {
      console.error('❌ Erreur chargement données POS:', error);
      toast.error('Erreur lors du chargement de la caisse');
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
      
      // Récupérer le pharmacy_id depuis le store (propriété correcte: pharmacy_id, pas pharmacyId)
      const pharmacy_id = 
        response.data?.pharmacyId ||           // Format camelCase de l'API
        response.data?.pharmacy_id ||          // Format snake_case de l'API
        response.data?.current_pharmacy?.id || // Dans l'objet current_pharmacy
        response.data?.pharmacy?.id ||         // Dans l'objet pharmacy
        user?.pharmacy_id;                     // Depuis le store user (propriété correcte)

      // Log détaillé pour déboguer
      console.log('👤 loadUserInfo - détails:', {
        responseData: response.data,
        userFromStore: user,
        pharmacy_id_trouve: pharmacy_id,
        toutes_cles_response: Object.keys(response.data || {})
      });

      // Charger la configuration si on a un pharmacy_id
      if (pharmacy_id) {
        console.log('🏪 Chargement config pour pharmacie:', pharmacy_id);
        await this.loadConfig(pharmacy_id);
      } else {
        console.warn('⚠️ Aucun pharmacy_id trouvé, tentative de récupération depuis les pharmacies disponibles');
        
        // Tentative de récupération depuis la liste des pharmacies
        try {
          const pharmaciesResponse = await api.get('/pharmacies', { 
            params: { active_only: true, limit: 1 } 
          });
          
          const pharmacies = pharmaciesResponse.data;
          if (pharmacies && pharmacies.length > 0) {
            const fallbackPharmacyId = pharmacies[0].id;
            console.log('🏪 Pharmacy_id récupéré depuis /pharmacies:', fallbackPharmacyId);
            
            // Mettre à jour le store si possible (utilisation de setPharmacy si disponible)
            const store = useAuthStore.getState();
            if (store.setPharmacy) {
              store.setPharmacy(fallbackPharmacyId);
            }
            
            // Continuer avec ce pharmacy_id
            await this.loadConfig(fallbackPharmacyId);
            this.setCashierInfo({
              id: user?.id || '',
              name: user?.nom_complet || user?.email || 'Caissier',
              posId: response.data?.posId || 'pos-main',
              posName: response.data?.posName || 'POS-01',
              sessionId: response.data?.sessionId || Date.now().toString(),
              sessionNumber: response.data?.sessionNumber || '001',
              pharmacy_id: fallbackPharmacyId,
            });
            
            const sessionData: Omit<OfflineSession, 'id'> = {
              sessionId: response.data?.sessionId || Date.now().toString(),
              posId: response.data?.posId || 'pos-main',
              posName: response.data?.posName || 'POS-01',
              sessionNumber: response.data?.sessionNumber || '001',
              userId: user?.id,
              userName: user?.nom_complet || user?.email,
              openedAt: Date.now(),
              status: 'open',
              pharmacy_id: fallbackPharmacyId,
            };
            
            await db.saveSession(sessionData);
            return; // Sortie anticipée car tout est configuré
          }
        } catch (pharmacyError) {
          console.error('❌ Erreur récupération pharmacies de secours:', pharmacyError);
        }
      }

      // Configuration standard avec pharmacy_id (peut être undefined)
      this.setCashierInfo({
        id: user?.id || '',
        name: user?.nom_complet || user?.email || 'Caissier',
        posId: response.data?.posId || 'pos-main',
        posName: response.data?.posName || 'POS-01',
        sessionId: response.data?.sessionId || Date.now().toString(),
        sessionNumber: response.data?.sessionNumber || '001',
        pharmacy_id: pharmacy_id,
      });

      // Sauvegarder la session
      const sessionData: Omit<OfflineSession, 'id'> = {
        sessionId: response.data?.sessionId || Date.now().toString(),
        posId: response.data?.posId || 'pos-main',
        posName: response.data?.posName || 'POS-01',
        sessionNumber: response.data?.sessionNumber || '001',
        userId: user?.id,
        userName: user?.nom_complet || user?.email,
        openedAt: Date.now(),
        status: 'open',
        pharmacy_id: pharmacy_id,
      };

      await db.saveSession(sessionData);
      
      console.log('✅ loadUserInfo terminé avec succès, pharmacy_id:', pharmacy_id);
      
    } catch (error) {
      console.error('❌ Erreur loadUserInfo:', error);
      console.warn('⚠️ Mode hors-ligne session, utilisation du cache');
      
      const { user } = useAuthStore.getState();
      const offlineSession = await db.getCurrentSession(user?.id);

      if (offlineSession) {
        const offlinePharmacyId = (offlineSession as any).pharmacy_id;
        console.log('📱 Mode hors-ligne - pharmacy_id depuis cache:', offlinePharmacyId);
        
        if (offlinePharmacyId) {
          try {
            await this.loadConfig(offlinePharmacyId);
          } catch (configError) {
            console.warn('⚠️ Impossible de charger la config hors-ligne:', configError);
          }
        }
        
        this.setCashierInfo({
          id: user?.id || '',
          name: user?.nom_complet || user?.email || 'Caissier',
          posId: offlineSession.posId,
          posName: offlineSession.posName,
          sessionId: offlineSession.sessionId,
          sessionNumber: offlineSession.sessionNumber,
          pharmacy_id: offlinePharmacyId,
        });
      } else {
        console.warn('⚠️ Aucune session offline trouvée');
        this.setCashierInfo({
          id: user?.id || '',
          name: user?.nom_complet || user?.email || 'Caissier',
          posId: 'pos-main',
          posName: 'POS-01',
          sessionId: Date.now().toString(),
          sessionNumber: '001',
          pharmacy_id: undefined,
        });
      }
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
      // Continuer avec la configuration par défaut
    }
  }

  /**
   * Charge les produits depuis l'API
   */
  async loadProducts() {
    try {
      const { user } = useAuthStore.getState();
      const pharmacy_id = this.cashierInfo.pharmacy_id || user?.pharmacy_id;

      console.log('🔍 loadProducts - pharmacy_id:', pharmacy_id);

      if (!pharmacy_id) {
        console.warn('⚠️ Aucun ID de pharmacie disponible, tentative de chargement sans filtre');
        // Tentative de chargement sans pharmacy_id
        try {
          const response = await inventoryService.getProducts({
            is_active: true,
            limit: 1000,
            skip: 0,
            include_sales_stats: false,
          });
          
          if (response?.products?.length > 0) {
            const normalizedProducts = response.products.map(p => this.normalizeProduct(p));
            console.log('✅ Produits chargés sans pharmacy_id:', normalizedProducts.length);
            
            runInAction(() => {
              this.products = normalizedProducts;
              this.rebuildProductsMap(normalizedProducts);
              this.filterProducts();
            });
            
            this.onProductsChange?.(this.products);
            return;
          }
        } catch (noIdError) {
          console.warn('Chargement sans pharmacy_id échoué:', noIdError);
        }
        
        runInAction(() => {
          this.products = [];
          this.filteredProducts = [];
          this.filterProducts();
        });
        return;
      }

      console.log('🔍 Chargement produits pour pharmacie:', pharmacy_id);

      const response = await inventoryService.getProducts({
        pharmacy_id: pharmacy_id,
        is_active: true,
        limit: 1000,
        skip: 0,
        include_sales_stats: false,
      });

      console.log('📦 Réponse produits reçue:', response?.products?.length || 0, 'produits');

      const rawProducts: any[] = response?.products || [];
      const normalizedProducts = rawProducts.map(p => this.normalizeProduct(p));

      // Ne pas filtrer par pharmacy_id si la réponse est déjà filtrée
      const finalProducts = normalizedProducts;

      console.log('✅ Produits après normalisation:', finalProducts.length);
      
      if (finalProducts.length > 0) {
        console.log('📝 Premier produit (exemple):', finalProducts[0]?.name);
      }

      // Sauvegarde en base de données locale
      if (finalProducts.length > 0) {
        await db.products.bulkPut(finalProducts as any);
      }
      
      runInAction(() => {
        this.products = finalProducts;
        this.rebuildProductsMap(finalProducts);
        this.filterProducts();
      });
      
      console.log('🎯 État final - products.length:', this.products.length);
      console.log('🎯 État final - filteredProducts.length:', this.filteredProducts.length);
      
      this.onProductsChange?.(this.products);

      if (finalProducts.length === 0) {
        toast('Aucun produit trouvé pour cette pharmacie', { icon: 'ℹ️' });
      } else {
        console.log(`✅ ${finalProducts.length} produits chargés avec succès`);
      }
    } catch (error) {
      console.error('❌ Erreur chargement produits:', error);
      toast.error('Erreur lors du chargement des produits');

      // Chargement hors-ligne
      const { user } = useAuthStore.getState();
      const pharmacy_id = this.cashierInfo.pharmacy_id || user?.pharmacy_id;
      try {
        let localProducts: any[] = [];
        
        if (pharmacy_id) {
          localProducts = await db.products
            .filter(p => (p as any).pharmacy_id === pharmacy_id)
            .toArray();
        } else {
          localProducts = await db.products.toArray();
        }

        const normalizedProducts = localProducts.map(p => this.normalizeProduct(p));

        runInAction(() => {
          this.products = normalizedProducts;
          this.rebuildProductsMap(normalizedProducts);
          this.filterProducts();
        });
        
        this.onProductsChange?.(this.products);

        if (normalizedProducts.length > 0) {
          toast('Mode hors-ligne: produits chargés depuis le cache');
          console.log(`📱 ${normalizedProducts.length} produits chargés depuis le cache local`);
        } else {
          console.warn('⚠️ Aucun produit trouvé en cache local');
          toast('Aucun produit disponible en mode hors-ligne');
        }
      } catch (dbError) {
        console.error('❌ Erreur chargement produits hors-ligne:', dbError);
        runInAction(() => {
          this.products = [];
          this.filteredProducts = [];
        });
      }
    }
  }

  /**
   * Normalise un produit venant de l'API
   */
  normalizeProduct(p: any): Product {
    // Gestion robuste de la catégorie
    let categoryId = 'uncategorized';
    let category: Category | undefined = undefined;
    
    if (p.category_id) {
      categoryId = String(p.category_id);
    } else if (p.category?.id) {
      categoryId = String(p.category.id);
    } else if (p.category && typeof p.category === 'string') {
      categoryId = p.category;
    }
    
    if (p.category && typeof p.category === 'object') {
      category = {
        id: String(p.category.id || categoryId),
        name: p.category.name || p.category,
      };
    }

    return {
      id: String(p.id),
      name: p.name || p.product_name || p.commercial_name || 'Sans nom',
      price: Number(p.selling_price ?? p.price ?? p.unit_price ?? 0),
      sellingPrice: Number(p.selling_price ?? p.price ?? p.unit_price ?? 0),
      purchasePrice: Number(p.purchase_price ?? p.cost_price ?? p.buying_price ?? 0),
      categoryId: categoryId,
      category: category,
      stock: Number(p.quantity ?? p.stock ?? p.current_stock ?? p.available_quantity ?? 0),
      code: p.code || p.sku || '',
      barcode: p.barcode || p.bar_code || undefined,
      qrCode: p.qr_code || p.qrCode || undefined,
      description: p.description || undefined,
      salesType: p.sales_type || p.salesType || 'both',
      wholesalePrice: Number(p.wholesale_price ?? p.wholesalePrice ?? 0),
      retailPrice: Number(p.retail_price ?? p.retailPrice ?? 0),
      minQuantity: Number(p.min_quantity ?? p.minQuantity ?? 1),
      pharmacy_id: p.pharmacy_id || p.pharmacyId,
    };
  }

  /**
   * Reconstruit la map de recherche par code-barres/code
   */
  rebuildProductsMap(productList: Product[]) {
    const map = new Map<string, Product>();
    productList.forEach(p => {
      if (p.barcode) map.set(p.barcode, p);
      if (p.qrCode) map.set(p.qrCode, p);
      if (p.code) map.set(p.code, p);
    });
    runInAction(() => {
      this.productsMap = map;
    });
  }

  /**
   * Charge les catégories (optionnel - ne bloque pas l'affichage des produits)
   */
  async loadCategories() {
    try {
      const { user } = useAuthStore.getState();
      const pharmacy_id = this.cashierInfo.pharmacy_id || user?.pharmacy_id;

      const response = await api.get('/stock/categories', {
        params: { pharmacy_id },
      });

      let rawCategories: any[] = [];
      
      // Gestion des différents formats de réponse
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

      // Sauvegarde en cache
      if (cats.length > 0) {
        await db.categories.bulkPut(cats as any);
      }
      
      runInAction(() => {
        // Toujours ajouter l'option "Tous"
        this.categories = [{ id: 'all', name: 'Tous' }, ...cats];
      });
      
      console.log('📁 Catégories chargées:', this.categories.length);
      this.onCategoriesChange?.(this.categories);
      
    } catch (error) {
      console.warn('⚠️ Erreur chargement catégories (non critique):', error);
      
      // Chargement hors-ligne des catégories
      try {
        const localCats = await db.categories.toArray();
        const normalized = localCats.map((cat: any) => ({
          id: String(cat.id),
          name: cat.name,
          icon: cat.icon,
        }));
        
        runInAction(() => {
          this.categories = [{ id: 'all', name: 'Tous' }, ...normalized];
        });
        
        this.onCategoriesChange?.(this.categories);
      } catch (dbError) {
        console.error('❌ Erreur chargement catégories hors-ligne:', dbError);
        runInAction(() => {
          this.categories = [{ id: 'all', name: 'Tous' }];
        });
      }
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
        currentClient: 'Passager',
      };

      this.updateStats(newStats);
      await db.updateDailyStats(todayStr, newStats);
    } catch (error) {
      console.warn('⚠️ Mode hors-ligne stats:', error);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      try {
        const offlineStats = await db.getDailyStats(todayStr);

        if (offlineStats) {
          this.updateStats({
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

          this.updateStats({
            total,
            salesCount: localSales.length,
            currentClient: 'Passager',
          });
        }
      } catch (dbError) {
        console.error('❌ Erreur chargement stats hors-ligne:', dbError);
      }
    }
  }

  /**
   * Filtre les produits selon la recherche et la catégorie
   */
  filterProducts() {
    let filtered = [...this.products];

    // Filtrer par catégorie (si ce n'est pas "all" et si la catégorie existe)
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.categoryId === this.selectedCategory);
    }

    // Filtrer par recherche
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

  /**
   * Ajoute un produit au panier
   */
  addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error(`${product.name} est en rupture de stock`);
      return;
    }

    // Vérifier le type de vente
    if (this.config.salesType !== 'both' && product.salesType !== this.config.salesType) {
      const typeLabel = this.config.salesType === 'wholesale' ? 'gros' : 'détail';
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
    if (this.config.salesType === 'wholesale' && product.minQuantity && product.minQuantity > 1) {
      const existing = this.cart.find(item => item.id === product.id);
      const currentQty = existing?.quantity || 0;
      if (currentQty === 0 && product.minQuantity > 1) {
        toast(`💡 ${product.name} se vend par lot de ${product.minQuantity}`, {
          icon: 'ℹ️',
          duration: 3000,
        });
      }
    }

    const existingIndex = this.cart.findIndex(item => item.id === product.id);

    if (existingIndex !== -1) {
      const existing = this.cart[existingIndex];
      const newQuantity = existing.quantity + 1;
      if (newQuantity > product.stock) {
        toast.error(`Stock insuffisant pour ${product.name}`);
        return;
      }
      const newCart = [...this.cart];
      newCart[existingIndex] = { ...existing, quantity: newQuantity };
      this.setCart(newCart);
    } else {
      this.setCart([{ ...product, quantity: 1, unitPrice }, ...this.cart]);
    }
  };

  /**
   * Met à jour la quantité d'un article dans le panier
   */
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

  /**
   * Retire un article du panier
   */
  removeFromCart = (index: number) => {
    const newCart = [...this.cart];
    newCart.splice(index, 1);
    this.setCart(newCart);
  };

  /**
   * Vide le panier
   */
  clearCart = () => {
    if (this.cart.length > 0 && window.confirm('Vider le panier ?')) {
      this.setCart([]);
    }
  };

  /**
   * Gère le scan d'un code-barres ou QR code
   */
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
    toast.success(`${product.name} ajouté au panier`);
    this.playBeep('success');
    this.vibrate();

    if (this.scanMode === 'auto') {
      this.setShowScanner(false);
    }
  };

  /**
   * Joue un son de feedback
   */
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

  /**
   * Vibration du périphérique
   */
  vibrate() {
    if (navigator.vibrate) {
      navigator.vibrate(VIBRATION_DURATION);
    }
  }

  /**
   * Met à jour le stock local après une vente
   */
  async updateLocalStock(items: CartItem[]) {
    const updatedProducts = [...this.products];
    const stockUpdates: { id: string; stock: number }[] = [];

    for (const item of items) {
      const productIndex = updatedProducts.findIndex(p => p.id === item.id);
      if (productIndex === -1) continue;

      const newStock = Math.max(0, updatedProducts[productIndex].stock - item.quantity);
      updatedProducts[productIndex] = { ...updatedProducts[productIndex], stock: newStock };
      stockUpdates.push({ id: item.id, stock: newStock });
    }

    if (stockUpdates.length > 0) {
      try {
        await db.bulkUpdateProductsStock(stockUpdates);
      } catch (error) {
        console.error('Erreur mise à jour stock offline:', error);
      }
    }

    runInAction(() => {
      this.products = updatedProducts;
      this.rebuildProductsMap(updatedProducts);
      this.filterProducts();
    });
    
    this.onProductsChange?.(this.products);
  }

  /**
   * Valide la vente
   */
  async validateSale() {
    if (this.cart.length === 0 || this.isProcessing) return;

    this.setProcessing(true);

    // Vérifier les quantités minimales pour le gros
    if (this.config.salesType === 'wholesale') {
      const invalidItems = this.cart.filter(item =>
        item.minQuantity && item.quantity < item.minQuantity
      );
      if (invalidItems.length > 0) {
        const message = invalidItems
          .map(item => `${item.name}: minimum ${item.minQuantity} unités`)
          .join('\n');
        toast.error(`Quantités minimales non respectées:\n${message}`);
        this.setProcessing(false);
        return;
      }
    }

    const rawTotal = this.cart.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
    const totalAmount = this.config.sellByExchangeRate
      ? rawTotal / this.activeCurrency.exchangeRate
      : rawTotal;

    const saleData: SaleData = {
      items: this.cart.map(item => ({
        ...item,
        unitPrice: item.unitPrice,
      })),
      total: totalAmount,
      paymentMethod: this.paymentMethod,
      timestamp: new Date().toISOString(),
      cashierId: this.cashierInfo.id,
      cashierName: this.cashierInfo.name,
      posId: this.cashierInfo.posId,
      posName: this.cashierInfo.posName,
      sessionId: this.cashierInfo.sessionId,
      clientType: this.stats.currentClient,
      currency: this.config.primaryCurrency,
      exchangeRate: this.activeCurrency.exchangeRate,
      pharmacy_id: this.cashierInfo.pharmacy_id,
    };

    try {
      let saleResponse: any = null;
      
      if (this.isOnline) {
        const response = await saleService.createSale({
          items: this.cart.map(item => ({
            product_id: item.id,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          })),
          total_amount: totalAmount,
          payment_method: this.paymentMethod,
          pharmacy_id: this.cashierInfo.pharmacy_id,
        });
        saleResponse = response?.data || response?.sale || response;
      }

      await this.updateLocalStock(this.cart);

      const offlineSale: OfflineSale = {
        ...saleData,
        id: undefined,
        timestamp: Date.now(),
        status: this.isOnline ? 'synced' : 'pending',
        receiptNumber: saleResponse?.receipt_number || saleResponse?.receiptNumber,
        paymentMethod: saleData.paymentMethod,
        total: totalAmount,
        items: saleData.items,
      };

      const saleId = await db.sales.add(offlineSale);
      
      const savedSale = await db.sales.get(saleId);
      this.setCurrentSale(savedSale || null);

      if (this.config.invoice.autoPrint) {
        this.setShowInvoice(true);
        setTimeout(() => {
          window.print();
        }, 100);
      } else {
        this.setShowInvoice(true);
      }

      this.setCart([]);
      await this.loadDailyStats();

      toast.success(this.isOnline ? 'Vente enregistrée avec succès' : 'Vente enregistrée en mode hors-ligne');
    } catch (error) {
      console.error('Erreur lors de la vente:', error);
      toast.error('Erreur lors de l\'enregistrement de la vente');
    } finally {
      this.setProcessing(false);
    }
  }

  /**
   * Récupère les produits d'une catégorie
   */
  getCategoryProducts(categoryId: string): Product[] {
    if (categoryId === 'all') {
      return this.products;
    }
    return this.products.filter(p => p.categoryId === categoryId);
  }

  /**
   * Applique le thème
   */
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

  /**
   * Réinitialise le service (pour déconnexion)
   */
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
  }
}

// Export d'une instance unique
export const posService = new PosService();

// Export également la classe
export default PosService;