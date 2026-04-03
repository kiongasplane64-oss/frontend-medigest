// components/inventory/InventoryListView.tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Plus,
  Search,
  Download,
  Eye,
  TrendingUp,
  ShoppingCart,
  AlertTriangle,
  Camera,
  Barcode,
  Printer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  List,
  ArrowUpDown,
  X,
  Save,
  Trash2,
  AlertCircle,
  Settings2,
  Building2,
  Loader2,
} from 'lucide-react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import { useActivePharmacy } from '@/hooks/useActivePharmacy';
import { inventoryService } from '@/services/inventoryService';
import { useAlerts } from '@/hooks/useAlerts';
import type { Product, ProductCreate, ProductUpdate } from '@/types/inventory.types';

// Sous-composants
import BarcodeScannerModal from './BarcodeScannerModal';
import ProductSearchModal from './ProductSearchModal';
import ProductDetailModal from './ProductDetailModal';
import StockMovementView from './StockMovementView';
import ImportExportView from './ImportExportView';
import InitialStockView from './InitialStockView';
import ReportStockView from './ReportStockView';
import ApproView from './ApproView';
import AchatView from './AchatView';
import BarcodeLabelView from './BarcodeLabelView';
import ProductCard from './Productcard';
import ProductTableRow from './ProductTableRow';
import ViewToggle from './ViewToggle';
import StockFilters from './StockFilters';

type ViewMode = 'grid' | 'list';
type ActiveTab = 'products' | 'movements' | 'import_export' | 'initial_stock' | 'reports' | 'appro' | 'achat' | 'barcodes';
type FormMode = 'create' | 'edit';

// Unités disponibles
const UNIT_OPTIONS = [
  { value: 'unité', label: 'Unité' },
  { value: 'boîte', label: 'Boîte' },
  { value: 'flacon', label: 'Flacon' },
  { value: 'comprimé', label: 'Comprimé' },
  { value: 'gélule', label: 'Gélule' },
  { value: 'ampoule', label: 'Ampoule' },
  { value: 'sachet', label: 'Sachet' },
  { value: 'tube', label: 'Tube' },
  { value: 'pot', label: 'Pot' },
  { value: 'bouteille', label: 'Bouteille' },
];

// Types pour le formulaire interne
interface ProductFormData {
  id?: string;
  name: string;
  code: string;
  barcode: string;
  category: string;
  commercial_name: string;
  description: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  selling_price_wholesale: number;
  selling_price_retail: number;
  expiry_date: string;
  alert_threshold: number;
  minimum_stock: number;
  location: string;
  supplier: string;
  batch_number: string;
  unit: string;
  has_tva: boolean;
  tva_rate: number;
  is_active: boolean;
}

// Fonctions utilitaires
function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayInputDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().split('T')[0];
}

function extractErrorMessage(err: unknown): string {
  const e = err as {
    response?: {
      data?: {
        detail?: unknown;
        message?: string;
      };
      status?: number;
    };
    message?: string;
  };

  const detail = e.response?.data?.detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>;
          return String(obj.msg ?? obj.message ?? JSON.stringify(obj));
        }
        return String(item);
      })
      .join(', ');
  }

  if (detail && typeof detail === 'object') {
    return JSON.stringify(detail);
  }

  if (typeof e.response?.data?.message === 'string') {
    return e.response.data.message;
  }

  if (typeof e.message === 'string' && e.message.trim()) {
    return e.message;
  }

  return 'Une erreur est survenue lors de la sauvegarde.';
}

interface InventoryListViewProps {
  initialPharmacyId?: string;
  initialBranchId?: string;
}

export default function InventoryListView({
  initialPharmacyId,
  initialBranchId,
}: InventoryListViewProps) {
  // Hooks
  const isMobile = useMediaQuery('(max-width: 768px)');
  const queryClient = useQueryClient();
  
  // Récupérer la pharmacie active du contexte si aucun ID n'est fourni
  const { 
    id: activePharmacyId, 
    defaultBranchId: activeDefaultBranchId,
    isLoading: isLoadingPharmacy 
  } = useActivePharmacy();
  
  // Déterminer l'ID de pharmacie effectif (priorité à initialPharmacyId, sinon activePharmacy)
  const effectivePharmacyId = useMemo(() => {
    if (initialPharmacyId?.trim()) return initialPharmacyId.trim();
    if (activePharmacyId) return activePharmacyId;
    return '';
  }, [initialPharmacyId, activePharmacyId]);
  
  const effectiveBranchId = useMemo(() => {
    if (initialBranchId?.trim()) return initialBranchId.trim();
    if (activeDefaultBranchId) return activeDefaultBranchId;
    return '';
  }, [initialBranchId, activeDefaultBranchId]);

  // Configuration de la pharmacie
  const { config, salesType, formatPrice, defaultMargin, isAutomaticPricing, automaticPricingMethod, automaticPricingValue, taxRate, lowStockThreshold } = usePharmacyConfig(effectivePharmacyId);
  
  // Utilisation de useAlerts avec les bonnes options
  const { alerts: stockAlerts, totalCount: alertsCount } = useAlerts({
    autoRefresh: true,
    refreshInterval: 300000,
  });

  // États du formulaire
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isGeneratingBarcode, setIsGeneratingBarcode] = useState(false);
  const [categories, setCategories] = useState<Array<{ id: string; name: string; parent_id?: string | null }>>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  
  // Nouveaux états pour le contrôle du prix
  const [calculAutoPrix, setCalculAutoPrix] = useState(true);

  // États principaux
  const [activeTab, setActiveTab] = useState<ActiveTab>('products');
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'list' : 'grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    category_id: '',
    stock_status: '',
    expiry_status: '',
    product_type: '',
    min_price: null as number | null,
    max_price: null as number | null,
    pharmacy_id: effectivePharmacyId || '',
    branch_id: effectiveBranchId || '',
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(isMobile ? 12 : 24);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetail, setShowProductDetail] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'selling_price' | 'expiry_date'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Mettre à jour les filtres quand l'ID pharmacie change
  useEffect(() => {
    setFilters(prev => ({
      ...prev,
      pharmacy_id: effectivePharmacyId || '',
      branch_id: effectiveBranchId || '',
    }));
  }, [effectivePharmacyId, effectiveBranchId]);

  // Formulaire
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    code: '',
    barcode: '',
    category: '',
    commercial_name: '',
    description: '',
    quantity: 0,
    purchase_price: 0,
    selling_price: 0,
    selling_price_wholesale: 0,
    selling_price_retail: 0,
    expiry_date: '',
    alert_threshold: lowStockThreshold,
    minimum_stock: lowStockThreshold,
    location: '',
    supplier: '',
    batch_number: '',
    unit: 'unité',
    has_tva: true,
    tva_rate: taxRate,
    is_active: true,
  });

  // Query pour récupérer les produits (désactivée si pas de pharmacie)
  const {
    data: productsData,
    isLoading: isLoadingProducts,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['products', page, limit, searchQuery, filters, sortBy, sortOrder, effectivePharmacyId, effectiveBranchId],
    queryFn: async () => {
      if (!effectivePharmacyId) return { products: [], total: 0 };
      
      const response = await inventoryService.getProducts({
        skip: (page - 1) * limit,
        limit,
        search: searchQuery || undefined,
        category_id: filters.category_id || undefined,
        stock_status: filters.stock_status || undefined,
        expiry_status: filters.expiry_status || undefined,
        product_type: filters.product_type || undefined,
        min_price: filters.min_price || undefined,
        max_price: filters.max_price || undefined,
        pharmacy_id: filters.pharmacy_id || undefined,
        branch_id: filters.branch_id || undefined,
        include_sales_stats: true,
      });
      return response;
    },
    staleTime: 30000,
    enabled: !!effectivePharmacyId,
  });

  // Charger les catégories
  useEffect(() => {
    if (!effectivePharmacyId) return;

    let cancelled = false;

    const loadCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const data = await inventoryService.getSimpleCategories();
        if (!cancelled) {
          setCategories(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Erreur chargement catégories:', err);
        if (!cancelled) {
          setCategories([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCategories(false);
        }
      }
    };

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, [effectivePharmacyId]);

  // Récupérer le produit pour édition
  const { data: productToEdit } = useQuery({
    queryKey: ['product', selectedProductId],
    queryFn: async () => {
      if (!selectedProductId) return null;
      return await inventoryService.getProduct(selectedProductId);
    },
    enabled: !!selectedProductId && formMode === 'edit',
  });

  // Mettre à jour le formulaire quand le produit à éditer change
  useEffect(() => {
    if (productToEdit && formMode === 'edit') {
      setFormData({
        id: productToEdit.id,
        name: productToEdit.name ?? '',
        code: productToEdit.code ?? '',
        barcode: productToEdit.barcode ?? '',
        category: typeof productToEdit.category === 'string'
          ? productToEdit.category
          : productToEdit.category?.name ?? '',
        commercial_name: (productToEdit as Product & { commercial_name?: string }).commercial_name ?? '',
        description: (productToEdit as Product & { description?: string }).description ?? '',
        quantity: toNumber(productToEdit.quantity, 0),
        purchase_price: toNumber(productToEdit.purchase_price, 0),
        selling_price: toNumber(productToEdit.selling_price, 0),
        selling_price_wholesale: toNumber(
          (productToEdit as Product & { selling_price_wholesale?: number }).selling_price_wholesale,
          toNumber(productToEdit.selling_price, 0),
        ),
        selling_price_retail: toNumber(
          (productToEdit as Product & { selling_price_retail?: number }).selling_price_retail,
          toNumber(productToEdit.selling_price, 0),
        ),
        expiry_date: todayInputDate(productToEdit.expiry_date),
        alert_threshold: toNumber(productToEdit.alert_threshold, lowStockThreshold),
        minimum_stock: toNumber(
          productToEdit.minimum_stock,
          toNumber(productToEdit.alert_threshold, lowStockThreshold),
        ),
        location: productToEdit.location ?? '',
        supplier: productToEdit.supplier ?? '',
        batch_number: (productToEdit as Product & { batch_number?: string }).batch_number ?? '',
        unit: productToEdit.unit ?? 'unité',
        has_tva: productToEdit.has_tva ?? true,
        tva_rate: toNumber(productToEdit.tva_rate, taxRate),
        is_active: productToEdit.is_active ?? true,
      });
    }
  }, [productToEdit, formMode, lowStockThreshold, taxRate]);

  // Fonction de calcul du prix de vente
  const calculateSellingPrice = useCallback(
    (purchasePrice: number, hasTva: boolean, tvaRate: number): number => {
      if (!isAutomaticPricing || purchasePrice <= 0) {
        return 0;
      }

      let computed = 0;

      switch (automaticPricingMethod) {
        case 'coefficient':
          computed = purchasePrice * automaticPricingValue;
          break;
        case 'margin':
          computed = automaticPricingValue >= 100
            ? purchasePrice
            : purchasePrice / (1 - automaticPricingValue / 100);
          break;
        case 'percentage':
        default:
          computed = purchasePrice * (1 + automaticPricingValue / 100);
          break;
      }

      if (hasTva && tvaRate > 0) {
        computed *= 1 + tvaRate / 100;
      }

      return Math.round(computed * 100) / 100;
    },
    [isAutomaticPricing, automaticPricingMethod, automaticPricingValue],
  );

  // Prix suggérés
  const suggestedPrices = useMemo(() => {
    const purchasePrice = toNumber(formData.purchase_price, 0);
    const retail = calculateSellingPrice(purchasePrice, formData.has_tva, formData.tva_rate);

    let wholesaleDiscount = 0.15;
    if (config?.marginConfig?.maxMargin && config?.marginConfig?.minMargin) {
      wholesaleDiscount = 0.1 + (config.marginConfig.maxMargin - config.marginConfig.minMargin) / 200;
      wholesaleDiscount = Math.min(0.3, Math.max(0.05, wholesaleDiscount));
    }

    const wholesale = Math.round(retail * (1 - wholesaleDiscount) * 100) / 100;

    return { retail, wholesale };
  }, [calculateSellingPrice, config, formData.purchase_price, formData.has_tva, formData.tva_rate]);

  // Mettre à jour les prix automatiquement
  useEffect(() => {
    if (!calculAutoPrix || !isAutomaticPricing || toNumber(formData.purchase_price, 0) <= 0) {
      return;
    }

    setFormData((prev) => {
      const next = { ...prev };

      if (salesType === 'wholesale') {
        next.selling_price_wholesale = suggestedPrices.wholesale;
        next.selling_price = suggestedPrices.wholesale;
      } else if (salesType === 'retail') {
        next.selling_price_retail = suggestedPrices.retail;
        next.selling_price = suggestedPrices.retail;
      } else {
        next.selling_price_wholesale = suggestedPrices.wholesale;
        next.selling_price_retail = suggestedPrices.retail;
        next.selling_price = suggestedPrices.retail;
      }

      return next;
    });
  }, [formData.purchase_price, calculAutoPrix, isAutomaticPricing, salesType, suggestedPrices.retail, suggestedPrices.wholesale]);

  // Vérifier l'existence d'un code-barres
  const checkBarcodeExists = useCallback(
    async (barcode: string): Promise<boolean> => {
      if (!effectivePharmacyId || !barcode.trim()) {
        return false;
      }

      try {
        const response = await inventoryService.getProducts({
          skip: 0,
          limit: 5,
          pharmacy_id: effectivePharmacyId,
          search: barcode.trim(),
        });

        return response.products.some((item) => {
          const sameBarcode = item.barcode?.trim() === barcode.trim();
          const differentId = item.id !== formData.id;
          return sameBarcode && differentId;
        });
      } catch (err) {
        console.error('Erreur vérification code-barres:', err);
        return false;
      }
    },
    [effectivePharmacyId, formData.id],
  );

  // Générer un code-barres
  const generateBarcode = useCallback(async () => {
    setIsGeneratingBarcode(true);
    try {
      let candidate = '';
      let exists = true;
      let tries = 0;

      while (exists && tries < 5) {
        candidate = `${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, '0')}`;
        exists = await checkBarcodeExists(candidate);
        tries += 1;
      }

      setFormData((prev) => ({
        ...prev,
        barcode: candidate || `GEN${Date.now().toString().slice(-12)}`,
      }));
    } catch (err) {
      console.error('Erreur génération code-barres:', err);
      setFormData((prev) => ({
        ...prev,
        barcode: `ERR${Date.now().toString().slice(-12)}`,
      }));
    } finally {
      setIsGeneratingBarcode(false);
    }
  }, [checkBarcodeExists]);

  // Soumettre le formulaire
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!effectivePharmacyId) {
      setFormError("Impossible d'enregistrer: aucune pharmacie n'a été trouvée.");
      return;
    }

    if (!formData.name.trim()) {
      setFormError('Le nom du produit est requis.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Déterminer le prix de vente selon le mode
      let sellingPriceValue = 0;
      let sellingPriceWholesaleValue: number | undefined = undefined;
      let sellingPriceRetailValue: number | undefined = undefined;
      
      if (calculAutoPrix && isAutomaticPricing) {
        // Calcul automatique
        const calculatedPrice = calculateSellingPrice(
          formData.purchase_price, 
          formData.has_tva, 
          formData.tva_rate
        );
        
        if (salesType === 'wholesale') {
          sellingPriceWholesaleValue = calculatedPrice;
          sellingPriceValue = calculatedPrice;
        } else if (salesType === 'retail') {
          sellingPriceRetailValue = calculatedPrice;
          sellingPriceValue = calculatedPrice;
        } else {
          sellingPriceRetailValue = calculatedPrice;
          sellingPriceWholesaleValue = calculatedPrice * 0.85; // 15% de remise pour le gros
          sellingPriceValue = calculatedPrice;
        }
      } else {
        // Prix manuel
        if (salesType === 'wholesale') {
          sellingPriceWholesaleValue = formData.selling_price_wholesale;
          sellingPriceValue = formData.selling_price_wholesale;
        } else if (salesType === 'retail') {
          sellingPriceRetailValue = formData.selling_price_retail;
          sellingPriceValue = formData.selling_price_retail;
        } else {
          sellingPriceRetailValue = formData.selling_price_retail;
          sellingPriceWholesaleValue = formData.selling_price_wholesale;
          sellingPriceValue = formData.selling_price_retail;
        }
      }

      const payload: ProductCreate = {
        name: formData.name.trim(),
        code: formData.code.trim() || `PROD-${Date.now()}`,
        barcode: formData.barcode.trim() || undefined,
        category: formData.category.trim() || undefined,
        commercial_name: formData.commercial_name.trim() || undefined,
        description: formData.description.trim() || undefined,
        quantity: toNumber(formData.quantity, 0),
        purchase_price: toNumber(formData.purchase_price, 0),
        selling_price: sellingPriceValue,
        selling_price_wholesale: sellingPriceWholesaleValue,
        selling_price_retail: sellingPriceRetailValue,
        expiry_date: formData.expiry_date || undefined,
        alert_threshold: toNumber(formData.alert_threshold, lowStockThreshold),
        minimum_stock: toNumber(formData.minimum_stock, lowStockThreshold),
        location: formData.location.trim() || undefined,
        supplier: formData.supplier.trim() || undefined,
        batch_number: formData.batch_number.trim() || undefined,
        unit: formData.unit || 'unité',
        has_tva: formData.has_tva,
        tva_rate: formData.has_tva ? toNumber(formData.tva_rate, taxRate) : 0,
        is_active: formData.is_active,
        pharmacy_id: effectivePharmacyId,
        branch_id: effectiveBranchId || undefined,
        calcul_auto_prix: calculAutoPrix && isAutomaticPricing,
        marge_par_defaut: defaultMargin,
        sales_type: salesType,
      };

      const timeoutPromise = new Promise<never>((_, reject) => {
        window.setTimeout(() => {
          reject(new Error("Le serveur ne répond pas. Vérifiez votre connexion."));
        }, 10000);
      });

      if (formMode === 'edit' && formData.id) {
        const updatePayload: ProductUpdate = {
          ...payload,
          pharmacy_id: effectivePharmacyId,
          branch_id: effectiveBranchId || undefined,
        };

        await Promise.race([
          inventoryService.updateProduct(formData.id, updatePayload),
          timeoutPromise,
        ]);
      } else {
        await Promise.race([
          inventoryService.createProduct(payload),
          timeoutPromise,
        ]);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-alerts'] }),
      ]);

      handleCloseForm();
      refetch();
    } catch (err) {
      console.error('Erreur sauvegarde produit:', err);
      setFormError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supprimer un produit
  const handleDeleteProduct = async () => {
    if (!formData.id) return;

    const confirmed = window.confirm(
      'Êtes-vous sûr de vouloir supprimer ce produit ? Cette action est irréversible.',
    );

    if (!confirmed) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      await inventoryService.deleteProduct(formData.id);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-alerts'] }),
      ]);

      handleCloseForm();
      refetch();
    } catch (err) {
      console.error('Erreur suppression produit:', err);
      setFormError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ouvrir le formulaire pour créer
  const handleOpenCreateForm = () => {
    setFormMode('create');
    setSelectedProductId(null);
    setCalculAutoPrix(isAutomaticPricing);
    setFormData({
      name: '',
      code: '',
      barcode: '',
      category: '',
      commercial_name: '',
      description: '',
      quantity: 0,
      purchase_price: 0,
      selling_price: 0,
      selling_price_wholesale: 0,
      selling_price_retail: 0,
      expiry_date: '',
      alert_threshold: lowStockThreshold,
      minimum_stock: lowStockThreshold,
      location: '',
      supplier: '',
      batch_number: '',
      unit: 'unité',
      has_tva: true,
      tva_rate: taxRate,
      is_active: true,
    });
    setFormError(null);
    setShowForm(true);
  };

  // Ouvrir le formulaire pour éditer
  const handleOpenEditForm = (product: Product) => {
    setFormMode('edit');
    setSelectedProductId(product.id);
    setCalculAutoPrix(isAutomaticPricing);
    setFormError(null);
    setShowForm(true);
  };

  // Fermer le formulaire
  const handleCloseForm = () => {
    setShowForm(false);
    setFormMode('create');
    setSelectedProductId(null);
    setFormError(null);
  };

  // Handlers produits
  const handleViewProduct = (product: Product) => {
    setSelectedProduct(product);
    setShowProductDetail(true);
  };

  const handleBarcodeScan = async (code: string) => {
    try {
      const product = await inventoryService.searchByBarcode(code);
      if (product) {
        setSelectedProduct(product);
        setShowProductDetail(true);
      } else {
        // Produit non trouvé, ouvrir le formulaire avec le code-barres pré-rempli
        setFormMode('create');
        setSelectedProductId(null);
        setCalculAutoPrix(isAutomaticPricing);
        setFormData(prev => ({ ...prev, barcode: code }));
        setFormError(null);
        setShowForm(true);
      }
    } catch (error) {
      console.error('Erreur lors de la recherche par code-barres:', error);
    } finally {
      setShowBarcodeScanner(false);
    }
  };

  const handleSearchByBarcode = () => {
    setShowProductSearch(true);
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  // Trier les produits
  const sortedProducts = useMemo(() => {
    if (!productsData?.products) return [];

    return [...productsData.products].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];

      if (sortBy === 'expiry_date') {
        aVal = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
        bVal = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      }

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }, [productsData?.products, sortBy, sortOrder]);

  // Statistiques
  const stats = useMemo(() => {
    if (!productsData?.products) return { total: 0, outOfStock: 0, lowStock: 0, totalValue: 0 };

    const total = productsData.products.length;
    const outOfStock = productsData.products.filter(p => p.stock_status === 'out_of_stock').length;
    const lowStock = productsData.products.filter(p => p.stock_status === 'low_stock').length;
    const totalValue = productsData.products.reduce((sum, p) => sum + (p.selling_value || 0), 0);

    return { total, outOfStock, lowStock, totalValue };
  }, [productsData?.products]);

  // Type de vente label
  const salesTypeLabel = useMemo(() => {
    if (salesType === 'wholesale') return 'Vente en gros';
    if (salesType === 'retail') return 'Vente au détail';
    return 'Gros & détail';
  }, [salesType]);

  const isLoading = isLoadingPharmacy || isLoadingProducts;

  // Extraire les alertes de stock pour l'affichage
  const outOfStockAlerts = stockAlerts?.filter(alert => alert.type === 'out_of_stock') || [];
  const lowStockAlerts = stockAlerts?.filter(alert => alert.type === 'low_stock') || [];

  // Rendu du formulaire modal
  const renderFormModal = () => {
    if (!showForm) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {formMode === 'edit' ? 'Modifier le produit' : 'Ajouter un produit'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{salesTypeLabel}</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span>TVA: {taxRate}%</span>
                <span className="h-1 w-1 rounded-full bg-slate-300" />
                <span className="inline-flex items-center gap-1">
                  <Building2 size={12} />
                  Pharmacie: {effectivePharmacyId}
                </span>
                {effectiveBranchId && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span>Branche: {effectiveBranchId}</span>
                  </>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseForm}
              disabled={isSubmitting}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {formError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div className="flex-1 whitespace-pre-wrap text-sm">{formError}</div>
                <button
                  type="button"
                  onClick={() => setFormError(null)}
                  className="shrink-0 text-red-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {config && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-medical/20 bg-medical/5 p-3 text-xs text-slate-600">
                <Settings2 size={14} className="text-medical" />
                <span>
                  Marge défaut: {defaultMargin}% •
                  {isAutomaticPricing
                    ? ` Prix auto (${automaticPricingMethod} : ${automaticPricingValue})`
                    : ' Prix manuel'} •
                  Seuil stock: {lowStockThreshold}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nom du produit <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-medical"
                  placeholder="Ex: Paracétamol 500mg"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Code produit
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                  placeholder="Auto-généré si vide"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Code-barres
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData(prev => ({ ...prev, barcode: e.target.value }))}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                    placeholder="Scanner ou générer"
                  />
                  <button
                    type="button"
                    onClick={generateBarcode}
                    disabled={isGeneratingBarcode || isSubmitting}
                    className="rounded-lg bg-slate-100 px-3 py-2 hover:bg-slate-200 disabled:opacity-50"
                    title="Générer un code-barres"
                  >
                    {isGeneratingBarcode ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Barcode size={18} />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeScanner(true)}
                    disabled={isSubmitting}
                    className="rounded-lg bg-slate-100 px-3 py-2 hover:bg-slate-200 disabled:opacity-50"
                    title="Scanner un code-barres"
                  >
                    <Camera size={18} />
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Catégorie
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  list="product-categories-list"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                  placeholder="Ex: Médicaments"
                />
                <datalist id="product-categories-list">
                  {!isLoadingCategories &&
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.name} />
                    ))}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Nom commercial
                </label>
                <input
                  type="text"
                  value={formData.commercial_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, commercial_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                  placeholder="Ex: Doliprane"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                  placeholder="Description du produit"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Quantité
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: toNumber(e.target.value, 0) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Unité
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                >
                  {UNIT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Date d'expiration
                </label>
                <input
                  type="date"
                  value={formData.expiry_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Prix d'achat
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchase_price: toNumber(e.target.value, 0) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              {/* Bloc de contrôle du calcul automatique */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <div>
                    <span className="font-medium text-slate-700">Calcul automatique du prix</span>
                    <p className="text-xs text-slate-500 mt-1">
                      {calculAutoPrix && isAutomaticPricing 
                        ? "Le prix sera calculé automatiquement selon la configuration" 
                        : !isAutomaticPricing 
                          ? "Le calcul automatique est désactivé dans la configuration"
                          : "Le prix sera saisi manuellement"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCalculAutoPrix(!calculAutoPrix)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      calculAutoPrix && isAutomaticPricing ? 'bg-medical' : 'bg-slate-300'
                    }`}
                    disabled={!isAutomaticPricing}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        calculAutoPrix && isAutomaticPricing ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Prix vente détail */}
              {(salesType === 'retail' || salesType === 'both') && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Prix vente détail
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price_retail}
                    onChange={(e) => setFormData(prev => ({ ...prev, selling_price_retail: toNumber(e.target.value, 0) }))}
                    disabled={calculAutoPrix && isAutomaticPricing}
                    className={`w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical ${
                      calculAutoPrix && isAutomaticPricing ? 'bg-slate-100' : ''
                    }`}
                  />
                  {calculAutoPrix && isAutomaticPricing && (
                    <p className="mt-1 text-xs text-slate-500">
                      Suggéré: {suggestedPrices.retail}
                    </p>
                  )}
                </div>
              )}

              {/* Prix vente gros */}
              {(salesType === 'wholesale' || salesType === 'both') && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Prix vente gros
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.selling_price_wholesale}
                    onChange={(e) => setFormData(prev => ({ ...prev, selling_price_wholesale: toNumber(e.target.value, 0) }))}
                    disabled={calculAutoPrix && isAutomaticPricing}
                    className={`w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical ${
                      calculAutoPrix && isAutomaticPricing ? 'bg-slate-100' : ''
                    }`}
                  />
                  {calculAutoPrix && isAutomaticPricing && (
                    <p className="mt-1 text-xs text-slate-500">
                      Suggéré: {suggestedPrices.wholesale}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Seuil d'alerte
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData(prev => ({ ...prev, alert_threshold: toNumber(e.target.value, 0) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Stock minimum
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData(prev => ({ ...prev, minimum_stock: toNumber(e.target.value, 0) }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Fournisseur
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Emplacement
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  N° lot
                </label>
                <input
                  type="text"
                  value={formData.batch_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, batch_number: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={formData.has_tva}
                  onChange={(e) => setFormData(prev => ({ ...prev, has_tva: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">Appliquer la TVA</span>
              </label>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Taux TVA (%)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.tva_rate}
                  onChange={(e) => setFormData(prev => ({ ...prev, tva_rate: toNumber(e.target.value, 0) }))}
                  disabled={!formData.has_tva}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-medical disabled:bg-slate-100"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4"
                />
                <span className="text-sm text-slate-700">Produit actif</span>
              </label>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                <p>
                  <span className="font-medium">Pharmacie liée :</span> {effectivePharmacyId || 'Non définie'}
                </p>
                <p>
                  <span className="font-medium">Branche liée :</span>{' '}
                  {effectiveBranchId || 'Aucune'}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Ces identifiants sont automatiquement liés à la pharmacie active.
                </p>
              </div>
            </div>

            <div className="flex flex-col-reverse justify-between gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center">
              <div>
                {formMode === 'edit' && (
                  <button
                    type="button"
                    onClick={handleDeleteProduct}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={16} />
                    Supprimer
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  disabled={isSubmitting}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || !effectivePharmacyId}
                  className="inline-flex items-center gap-2 rounded-lg bg-medical px-4 py-2 text-white hover:bg-medical-dark disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {formMode === 'edit' ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Rendu des produits
  const renderProductsTab = () => (
    <div className="space-y-4">
      {/* Barre d'outils */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par nom, code ou code-barres..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical"
            />
          </div>
          <button
            onClick={handleSearchByBarcode}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Rechercher par code-barres"
          >
            <Barcode size={20} />
          </button>
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Scanner un code-barres"
          >
            <Camera size={20} />
          </button>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            title="Actualiser"
          >
            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleOpenCreateForm}
            className="flex items-center gap-2 px-4 py-2 bg-medical text-white rounded-xl hover:bg-medical-dark transition-colors"
          >
            <Plus size={18} />
            <span className={isMobile ? 'sr-only' : ''}>Ajouter</span>
          </button>
          {!isMobile && (
            <ViewToggle viewMode={viewMode} onViewModeChange={setViewMode} />
          )}
        </div>
      </div>

      {/* Filtres */}
      <StockFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        config={config}
        salesType={salesType}
      />

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-xs text-slate-500">Total produits</p>
          <p className="text-xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl p-3 border border-slate-200">
          <p className="text-xs text-slate-500">Valeur du stock</p>
          <p className="text-xl font-bold">{formatPrice(stats.totalValue)}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-3 border border-red-200">
          <p className="text-xs text-red-600">Rupture de stock</p>
          <p className="text-xl font-bold text-red-600">{stats.outOfStock}</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <p className="text-xs text-amber-600">Stock faible</p>
          <p className="text-xl font-bold text-amber-600">{stats.lowStock}</p>
        </div>
      </div>

      {/* Alertes */}
      {(outOfStockAlerts.length > 0 || lowStockAlerts.length > 0) && (
        <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
          <div className="flex items-center gap-2 text-amber-700 mb-2">
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">Alertes stock</span>
          </div>
          <div className="text-xs text-amber-600">
            {outOfStockAlerts.length > 0 && (
              <span>{outOfStockAlerts.length} produit(s) en rupture de stock. </span>
            )}
            {lowStockAlerts.length > 0 && (
              <span>{lowStockAlerts.length} produit(s) avec stock faible.</span>
            )}
          </div>
        </div>
      )}

      {/* Chargement / Erreur */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical"></div>
        </div>
      )}

      {isError && (
        <div className="bg-red-50 rounded-xl p-4 text-red-600 text-center">
          Erreur lors du chargement des produits: {error?.message}
          <button onClick={handleRefresh} className="ml-2 underline">Réessayer</button>
        </div>
      )}

      {/* Liste des produits */}
      {!isLoading && !isError && productsData && (
        <>
          {viewMode === 'grid' && !isMobile ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onEdit={() => handleOpenEditForm(product)}
                  onView={() => handleViewProduct(product)}
                  formatPrice={formatPrice}
                  salesType={salesType}
                />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Produit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      <button
                        onClick={() => handleSort('quantity')}
                        className="flex items-center gap-1 hover:text-slate-700 ml-auto"
                      >
                        Stock
                        <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Prix d'achat</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">
                      <button
                        onClick={() => handleSort('selling_price')}
                        className="flex items-center gap-1 hover:text-slate-700 ml-auto"
                      >
                        Prix de vente
                        <ArrowUpDown size={12} />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Statut</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((product) => (
                    <ProductTableRow
                      key={product.id}
                      product={product}
                      onEdit={() => handleOpenEditForm(product)}
                      onView={() => handleViewProduct(product)}
                      formatPrice={formatPrice}
                      salesType={salesType}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {productsData.total > limit && (
            <div className="flex justify-between items-center pt-4">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
              >
                <ChevronLeft size={16} />
                Précédent
              </button>
              <span className="text-sm text-slate-600">
                Page {page} sur {Math.ceil(productsData.total / limit)}
              </span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * limit >= productsData.total}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200"
              >
                Suivant
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  // Rendu des différents onglets
  const renderActiveTab = () => {
    switch (activeTab) {
      case 'products':
        return renderProductsTab();
      case 'movements':
        return <StockMovementView pharmacyId={effectivePharmacyId} branchId={effectiveBranchId} />;
      case 'import_export':
        return <ImportExportView pharmacyId={effectivePharmacyId} branchId={effectiveBranchId} />;
      case 'initial_stock':
        return <InitialStockView pharmacyId={effectivePharmacyId} branchId={effectiveBranchId} />;
      case 'reports':
        return <ReportStockView pharmacyId={effectivePharmacyId} branchId={effectiveBranchId} />;
      case 'appro':
        return <ApproView pharmacyId={effectivePharmacyId} branchId={effectiveBranchId} />;
      case 'achat':
        return <AchatView pharmacyId={effectivePharmacyId} branchId={effectiveBranchId} />;
      case 'barcodes':
        return <BarcodeLabelView products={sortedProducts} formatPrice={formatPrice} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* En-tête avec onglets */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-4 gap-3">
            <div className="flex items-center gap-3">
              <Package className="text-medical" size={24} />
              <h1 className="text-xl font-bold text-slate-900">Gestion de stock</h1>
              {alertsCount > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded-full">
                  {alertsCount} alertes
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('products')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'products'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <List size={16} className="inline mr-1" />
                Produits
              </button>
              <button
                onClick={() => setActiveTab('movements')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'movements'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <TrendingUp size={16} className="inline mr-1" />
                Mouvements
              </button>
              <button
                onClick={() => setActiveTab('achat')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'achat'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <ShoppingCart size={16} className="inline mr-1" />
                Achats
              </button>
              <button
                onClick={() => setActiveTab('appro')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'appro'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Package size={16} className="inline mr-1" />
                Approvisionnement
              </button>
              <button
                onClick={() => setActiveTab('barcodes')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'barcodes'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Printer size={16} className="inline mr-1" />
                Étiquettes
              </button>
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'reports'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Eye size={16} className="inline mr-1" />
                Rapports
              </button>
              <button
                onClick={() => setActiveTab('import_export')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'import_export'
                    ? 'bg-medical text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Download size={16} className="inline mr-1" />
                Import/Export
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderActiveTab()}
      </div>

      {/* Modals */}
      {renderFormModal()}

      {showProductDetail && selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setShowProductDetail(false)}
          onEdit={() => {
            setShowProductDetail(false);
            handleOpenEditForm(selectedProduct);
          }}
          formatPrice={formatPrice}
          salesType={salesType}
        />
      )}

      {showBarcodeScanner && (
        <BarcodeScannerModal
          onScan={handleBarcodeScan}
          onClose={() => setShowBarcodeScanner(false)}
        />
      )}

      {showProductSearch && (
        <ProductSearchModal
          onSelect={(product) => {
            setSelectedProduct(product);
            setShowProductDetail(true);
            setShowProductSearch(false);
          }}
          onClose={() => setShowProductSearch(false)}
          formatPrice={formatPrice}
        />
      )}
    </div>
  );
}