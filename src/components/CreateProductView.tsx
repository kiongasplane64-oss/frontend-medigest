// components/CreateProductView.tsx
import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import type { Product, ProductCreate, Category, SalesType } from '@/types/inventory.types';
import { inventoryService } from '@/services/inventoryService';
import usePharmacyConfig from '@/hooks/usePharmacyConfig';
import {
  X,
  Save,
  Loader2,
  Package,
  DollarSign,
  AlertCircle,
  Calendar,
  Hash,
  Tag,
  User,
  FileText,
  Boxes,
  MapPin,
  Building2,
  BadgePercent,
  Sparkles,
  ScanLine,
  ShieldCheck,
  Settings2,
  Type,
  Store,
  ChevronDown,
  Check,
  Camera,
} from 'lucide-react';

// ============================================================
// TYPES
// ============================================================

interface ExtendedProduct extends Partial<Product> {
  pharmacy_id?: string;
  batch_number?: string;
  category_id?: string;
  selling_price_wholesale?: number;
  selling_price_retail?: number;
}

interface CreateProductViewInitialValues {
  code?: string;
  barcode?: string;
  name?: string;
  category?: string;
  supplier?: string;
  location?: string;
  pharmacy_id?: string;
  purchase_price?: number;
  selling_price?: number;
  selling_price_wholesale?: number;
  selling_price_retail?: number;
  quantity?: number;
}

interface CreateProductViewProps {
  open: boolean;
  onClose: () => void;
  product?: ExtendedProduct | null;
  onSuccess?: () => void;
  initialValues?: CreateProductViewInitialValues;
  pharmacyId?: string;
  pharmacyName?: string;
  onBarcodeCapture?: (callback: (code: string) => void) => void;
}

type FormTab = 'general' | 'pricing' | 'advanced';

interface FormState {
  code: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  category_id: string;
  supplier: string;
  purchase_price: string;
  selling_price_wholesale: string;
  selling_price_retail: string;
  quantity: string;
  alert_threshold: string;
  minimum_stock: string;
  maximum_stock: string;
  expiry_date: string;
  location: string;
  laboratory: string;
  batch_number: string;
}

// ============================================================
// CONSTANTES
// ============================================================

const DEFAULT_TAX_RATE = 16;
const DEFAULT_SALES_TYPE: SalesType = 'both';

// ============================================================
// FONCTIONS UTILITAIRES
// ============================================================

function toInputString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeDateForInput(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function generateProductCode(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PRD-${yy}${mm}${dd}-${random}`;
}

function generateBarcode(): string {
  const timestamp = Date.now().toString().slice(-12);
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${timestamp}${random}`.slice(0, 13);
}

function buildInitialFormState(
  product?: ExtendedProduct | null,
  initialValues?: CreateProductViewInitialValues,
): FormState {
  return {
    code: toInputString(initialValues?.code ?? product?.code ?? ''),
    barcode: toInputString(initialValues?.barcode ?? product?.barcode ?? ''),
    name: toInputString(initialValues?.name ?? product?.name ?? ''),
    description: toInputString(product?.description ?? ''),
    category: toInputString(initialValues?.category ?? product?.category ?? ''),
    category_id: toInputString(product?.category_id ?? ''),
    supplier: toInputString(initialValues?.supplier ?? product?.supplier ?? ''),
    purchase_price: toInputString(initialValues?.purchase_price ?? product?.purchase_price ?? ''),
    selling_price_wholesale: toInputString(
      initialValues?.selling_price_wholesale ?? 
      initialValues?.selling_price ?? 
      product?.selling_price_wholesale ?? 
      product?.selling_price ?? 
      ''
    ),
    selling_price_retail: toInputString(
      initialValues?.selling_price_retail ?? 
      product?.selling_price_retail ?? 
      ''
    ),
    quantity: toInputString(initialValues?.quantity ?? product?.quantity ?? 0),
    alert_threshold: toInputString(product?.alert_threshold ?? 10),
    minimum_stock: toInputString(product?.minimum_stock ?? ''),
    maximum_stock: toInputString(product?.maximum_stock ?? ''),
    expiry_date: normalizeDateForInput(product?.expiry_date ?? ''),
    location: toInputString(initialValues?.location ?? product?.location ?? ''),
    laboratory: toInputString(product?.laboratory ?? ''),
    batch_number: toInputString(product?.batch_number ?? ''),
  };
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function CreateProductView({
  open,
  onClose,
  product,
  onSuccess,
  initialValues,
  pharmacyId: propsPharmacyId,
  pharmacyName: propsPharmacyName,
  onBarcodeCapture,
}: CreateProductViewProps) {
  // États
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FormTab>('general');
  const [hasTva, setHasTva] = useState<boolean>(product?.has_tva ?? true);
  const [tvaRate, setTvaRate] = useState<number>(product?.tva_rate ?? DEFAULT_TAX_RATE);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [manualCategoryMode, setManualCategoryMode] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  
  // État local pour le type de vente
  const [salesType, setSalesType] = useState<SalesType>(DEFAULT_SALES_TYPE);
  
  // Détermination de l'ID de la pharmacie
  const effectivePharmacyId = useMemo(() => {
    return propsPharmacyId || initialValues?.pharmacy_id || null;
  }, [propsPharmacyId, initialValues?.pharmacy_id]);
  
  // Récupération de la configuration de la pharmacie
  const {
    config: pharmacyConfig,
    isLoading: configLoading,
    primaryCurrency,
    taxRate: configTaxRate,
    defaultMargin: configDefaultMargin,
    isAutomaticPricing: configAutoPricingEnabled,
    lowStockThreshold: configLowStockThreshold,
    salesType: configSalesType,
    automaticPricingMethod: configAutoMethod,
    automaticPricingValue: configAutoValue,
    calculAutoPrix,
  } = usePharmacyConfig(effectivePharmacyId || undefined);
  
  // États pour la configuration locale
  const [autoPricingEnabled, setAutoPricingEnabled] = useState<boolean>(false);
  const [autoPricingMethod, setAutoPricingMethod] = useState<string>('percentage');
  const [autoPricingValue, setAutoPricingValue] = useState<number>(25);
  const [marginPercent, setMarginPercent] = useState<number>(25);
  
  // Formulaire
  const [form, setForm] = useState<FormState>(() =>
    buildInitialFormState(product, initialValues),
  );

  // ============================================================
  // FERMETURE DU DROPDOWN AU CLIC EXTÉRIEUR
  // ============================================================

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================
  // CHARGEMENT DES CATÉGORIES
  // ============================================================

  useEffect(() => {
    if (!open) return;
    
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const response = await inventoryService.getCategories({ limit: 100 });
        setCategories(response.categories || []);
      } catch (err) {
        console.error('CreateProductView: Erreur chargement catégories:', err);
      } finally {
        setCategoriesLoading(false);
      }
    };
    
    loadCategories();
  }, [open]);

  // ============================================================
  // CHARGEMENT DE LA CONFIGURATION
  // ============================================================

  useEffect(() => {
    if (pharmacyConfig) {
      // Type de vente depuis la configuration
      if (configSalesType) {
        setSalesType(configSalesType);
      } else if (pharmacyConfig.salesType) {
        setSalesType(pharmacyConfig.salesType as SalesType);
      }
      
      // Configuration des prix automatiques
      if (pharmacyConfig.automaticPricing?.enabled) {
        setAutoPricingEnabled(true);
        setAutoPricingMethod(pharmacyConfig.automaticPricing.method || 'percentage');
        setAutoPricingValue(pharmacyConfig.automaticPricing.value || 25);
      } else if (configAutoPricingEnabled) {
        setAutoPricingEnabled(true);
        setAutoPricingMethod(configAutoMethod || 'percentage');
        setAutoPricingValue(configAutoValue || 25);
      } else if (calculAutoPrix) {
        setAutoPricingEnabled(true);
      }
      
      // Marge par défaut
      const defaultMargin = pharmacyConfig.marginConfig?.defaultMargin ?? configDefaultMargin ?? 25;
      setMarginPercent(defaultMargin);
      
      // Taux TVA
      const taxRate = pharmacyConfig.taxRate ?? configTaxRate ?? DEFAULT_TAX_RATE;
      setTvaRate(taxRate);
    }
  }, [pharmacyConfig, configSalesType, configAutoPricingEnabled, configDefaultMargin, configTaxRate, configAutoMethod, configAutoValue, calculAutoPrix]);

  // ============================================================
  // RÉINITIALISATION DU FORMULAIRE
  // ============================================================

  useEffect(() => {
    if (!open) return;

    setForm(buildInitialFormState(product, initialValues));
    setHasTva(product?.has_tva ?? true);
    setTvaRate(product?.tva_rate ?? (pharmacyConfig?.taxRate || configTaxRate || DEFAULT_TAX_RATE));
    setMarginPercent(pharmacyConfig?.marginConfig?.defaultMargin || configDefaultMargin || 25);
    setActiveTab('general');
    setError(null);
    setSuccess(null);
    setCategorySearch('');
    setManualCategoryMode(false);
    
    const existingCategory = product?.category || initialValues?.category;
    if (existingCategory && categories.length > 0) {
      const found = categories.find(c => c.name === existingCategory);
      if (found) {
        setForm(prev => ({ ...prev, category_id: String(found.id), category: found.name }));
        setManualCategoryMode(false);
      } else {
        setManualCategoryMode(true);
      }
    }
  }, [open, product, initialValues, pharmacyConfig, configTaxRate, configDefaultMargin, categories]);

  // ============================================================
  // GESTION DE LA TOUCHE ÉCHAP
  // ============================================================

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, loading, onClose]);

  // ============================================================
  // GESTION DU SCAN DE CODE-BARRES
  // ============================================================

  useEffect(() => {
    if (onBarcodeCapture && open) {
      onBarcodeCapture((scannedCode: string) => {
        if (scannedCode) {
          setField('barcode', scannedCode);
          if (!form.code) {
            setField('code', scannedCode);
          }
        }
      });
    }
  }, [onBarcodeCapture, open, form.code]);

  // ============================================================
  // CALCULS DÉRIVÉS
  // ============================================================

  const purchasePrice = Number(form.purchase_price || 0);
  const sellingPriceWholesale = Number(form.selling_price_wholesale || 0);
  const sellingPriceRetail = Number(form.selling_price_retail || 0);
  const quantity = Number(form.quantity || 0);

  const tvaAmount = useMemo(() => {
    if (!hasTva || !sellingPriceWholesale || !tvaRate) return 0;
    return (sellingPriceWholesale * tvaRate) / 100;
  }, [hasTva, sellingPriceWholesale, tvaRate]);

  const sellingPriceWholesaleWithTva = useMemo(() => {
    return sellingPriceWholesale + tvaAmount;
  }, [sellingPriceWholesale, tvaAmount]);

  const sellingPriceRetailWithTva = useMemo(() => {
    if (!hasTva || !sellingPriceRetail || !tvaRate) return sellingPriceRetail;
    return sellingPriceRetail + (sellingPriceRetail * tvaRate) / 100;
  }, [hasTva, sellingPriceRetail, tvaRate]);

  const grossMarginWholesale = useMemo(() => {
    if (!purchasePrice || !sellingPriceWholesale) return 0;
    return sellingPriceWholesale - purchasePrice;
  }, [purchasePrice, sellingPriceWholesale]);

  const grossMarginPercentWholesale = useMemo(() => {
    if (!purchasePrice || !sellingPriceWholesale) return 0;
    return ((sellingPriceWholesale - purchasePrice) / purchasePrice) * 100;
  }, [purchasePrice, sellingPriceWholesale]);

  const grossMarginRetail = useMemo(() => {
    if (!purchasePrice || !sellingPriceRetail) return 0;
    return sellingPriceRetail - purchasePrice;
  }, [purchasePrice, sellingPriceRetail]);

  const grossMarginPercentRetail = useMemo(() => {
    if (!purchasePrice || !sellingPriceRetail) return 0;
    return ((sellingPriceRetail - purchasePrice) / purchasePrice) * 100;
  }, [purchasePrice, sellingPriceRetail]);

  const estimatedStockValue = useMemo(() => {
    const price = salesType === 'wholesale' ? sellingPriceWholesale : sellingPriceRetail;
    return price * quantity;
  }, [sellingPriceWholesale, sellingPriceRetail, quantity, salesType]);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    return categories.filter(cat => 
      cat.name.toLowerCase().includes(categorySearch.toLowerCase())
    );
  }, [categories, categorySearch]);

  // ============================================================
  // GESTIONNAIRES
  // ============================================================

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCategorySelect = (category: Category) => {
    setField('category', category.name);
    setField('category_id', String(category.id));
    setCategorySearch('');
    setShowCategoryDropdown(false);
    setManualCategoryMode(false);
  };

  const handleManualCategoryToggle = () => {
    setManualCategoryMode(true);
    setShowCategoryDropdown(false);
    setField('category_id', '');
  };

  const validateForm = (): string | null => {
    if (!effectivePharmacyId) {
      return 'ID de pharmacie manquant. Veuillez sélectionner une pharmacie.';
    }

    if (!form.code.trim()) {
      return 'Le code produit est obligatoire.';
    }

    if (!form.name.trim()) {
      return 'La désignation du produit est obligatoire.';
    }

    if (!form.purchase_price || Number(form.purchase_price) <= 0) {
      return "Le prix d'achat doit être supérieur à 0.";
    }

    if (salesType === 'wholesale' || salesType === 'both') {
      if (!form.selling_price_wholesale || Number(form.selling_price_wholesale) <= 0) {
        return 'Le prix de vente en gros est obligatoire et doit être supérieur à 0.';
      }
    }

    if (salesType === 'retail' || salesType === 'both') {
      if (!form.selling_price_retail || Number(form.selling_price_retail) <= 0) {
        return 'Le prix de vente au détail est obligatoire et doit être supérieur à 0.';
      }
    }

    if (Number(form.quantity) < 0) {
      return 'La quantité ne peut pas être négative.';
    }

    if (Number(form.alert_threshold) < 0) {
      return "Le seuil d'alerte ne peut pas être négatif.";
    }

    if (hasTva && tvaRate < 0) {
      return 'Le taux TVA ne peut pas être négatif.';
    }

    return null;
  };

  const buildPayload = (): ProductCreate => {
    let sellingPrice: number;
    if (salesType === 'wholesale') {
      sellingPrice = Number(form.selling_price_wholesale);
    } else if (salesType === 'retail') {
      sellingPrice = Number(form.selling_price_retail);
    } else {
      sellingPrice = Number(form.selling_price_wholesale);
    }

    const payload: ProductCreate = {
      code: form.code.trim(),
      barcode: form.barcode.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      category_id: form.category_id || undefined,
      supplier: form.supplier.trim() || undefined,
      purchase_price: Number(form.purchase_price),
      selling_price: sellingPrice,
      selling_price_wholesale: form.selling_price_wholesale ? Number(form.selling_price_wholesale) : undefined,
      selling_price_retail: form.selling_price_retail ? Number(form.selling_price_retail) : undefined,
      quantity: Number(form.quantity || 0),
      alert_threshold: Number(form.alert_threshold || configLowStockThreshold || 10),
      minimum_stock: form.minimum_stock ? Number(form.minimum_stock) : undefined,
      maximum_stock: form.maximum_stock ? Number(form.maximum_stock) : undefined,
      expiry_date: form.expiry_date || undefined,
      location: form.location.trim() || undefined,
      laboratory: form.laboratory.trim() || undefined,
      batch_number: form.batch_number.trim() || undefined,
      has_tva: hasTva,
      tva_rate: hasTva ? Number(tvaRate || 0) : 0,
      pharmacy_id: effectivePharmacyId || undefined,
    };

    return payload;
  };

  const calculateSuggestedPrice = useCallback((purchasePriceValue: number): number => {
    if (!purchasePriceValue || purchasePriceValue <= 0) return 0;

    let suggested = purchasePriceValue;

    if (autoPricingEnabled) {
      switch (autoPricingMethod) {
        case 'percentage':
          suggested = purchasePriceValue * (1 + autoPricingValue / 100);
          break;
        case 'coefficient':
          suggested = purchasePriceValue * autoPricingValue;
          break;
        case 'margin':
          suggested = purchasePriceValue / (1 - autoPricingValue / 100);
          break;
        default:
          suggested = purchasePriceValue * (1 + marginPercent / 100);
      }
    } else {
      suggested = purchasePriceValue * (1 + marginPercent / 100);
    }

    return Number(suggested.toFixed(2));
  }, [autoPricingEnabled, autoPricingMethod, autoPricingValue, marginPercent]);

  const applySuggestedSellingPrice = useCallback((type: 'wholesale' | 'retail') => {
    if (!purchasePrice || purchasePrice <= 0) {
      setError("Veuillez d'abord saisir un prix d'achat.");
      return;
    }

    const suggested = calculateSuggestedPrice(purchasePrice);
    
    if (type === 'wholesale') {
      setField('selling_price_wholesale', String(suggested));
    } else {
      setField('selling_price_retail', String(suggested));
    }
  }, [purchasePrice, calculateSuggestedPrice]);

  const applyRetailPriceFromWholesale = useCallback(() => {
    if (!sellingPriceWholesale) return;
    const retailPrice = sellingPriceWholesale * 1.2;
    setField('selling_price_retail', String(Number(retailPrice.toFixed(2))));
  }, [sellingPriceWholesale]);

  const handleGenerateCode = useCallback(() => {
    const newCode = generateProductCode();
    setField('code', newCode);
  }, []);

  const handleGenerateBarcode = useCallback(() => {
    const newBarcode = generateBarcode();
    setField('barcode', newBarcode);
  }, []);

  const handleCopyBarcodeToCode = useCallback(() => {
    if (!form.barcode.trim()) return;
    setField('code', form.barcode.trim());
  }, [form.barcode]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = buildPayload();

      if (product?.id) {
        const productId = String(product.id);
        await inventoryService.updateProduct(productId, payload);
        setSuccess('Produit modifié avec succès !');
      } else {
        await inventoryService.createProduct(payload);
        setSuccess('Produit créé avec succès !');
      }

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error('CreateProductView: Erreur lors de la sauvegarde:', err);

      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          const errorMessages = detail.map((d: any) => {
            const field = d.loc?.join('.') || 'unknown';
            return `${field}: ${d.msg}`;
          });
          setError(errorMessages.join(', '));
        } else if (typeof detail === 'string') {
          setError(detail);
        } else {
          setError(JSON.stringify(detail));
        }
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Erreur lors de la sauvegarde du produit.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // RENDU
  // ============================================================

  if (!open) return null;

  const tabs: Array<{ id: FormTab; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'Général', icon: <Package size={16} /> },
    { id: 'pricing', label: 'Prix & stock', icon: <DollarSign size={16} /> },
    { id: 'advanced', label: 'Avancé', icon: <FileText size={16} /> },
  ];

  const pharmacyDisplay = propsPharmacyName 
    ? `${propsPharmacyName}${effectivePharmacyId ? ` (ID: ${effectivePharmacyId.slice(0, 8)}...)` : ''}`
    : effectivePharmacyId 
      ? `Pharmacie ID: ${effectivePharmacyId.slice(0, 8)}...` 
      : 'Pharmacie non spécifiée';

  if (configLoading && !pharmacyConfig && effectivePharmacyId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-8 shadow-2xl">
          <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          <p className="font-bold text-slate-600">Chargement de la configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:h-auto md:max-h-[94vh] md:rounded-4xl">
        {/* Header */}
        <div className="border-b border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-sky-900 px-4 py-4 text-white md:px-6 md:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
                <Package size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-sky-200">
                  Produit & inventaire
                </p>
                <h2 className="truncate text-lg font-black md:text-2xl">
                  {product ? 'Modifier le produit' : 'Ajouter un nouveau produit'}
                </h2>
                <p className="mt-1 text-xs text-slate-200 md:text-sm">
                  {product
                    ? 'Mettez à jour les informations du produit, du stock et de la tarification.'
                    : 'Créez un produit complet avec code, stock, prix, TVA et informations avancées.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-2xl bg-white/10 p-2 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white px-3 py-3 md:px-4">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-5 p-4 md:p-6">
            {error && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Erreur de validation</p>
                  <p className="text-sm wrap-break-word whitespace-pre-wrap">{error}</p>
                </div>
              </div>
            )}

            {success && (
              <div className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700">
                <Check size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Succès</p>
                  <p className="text-sm">{success}</p>
                </div>
              </div>
            )}

            {/* Info pharmacie */}
            {effectivePharmacyId && (
              <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-800">
                <Store size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Pharmacie concernée</p>
                  <p className="text-sm">
                    Le produit sera créé pour : <span className="font-semibold">{pharmacyDisplay}</span>
                  </p>
                  {pharmacyConfig && (
                    <p className="mt-1 text-xs text-blue-600">
                      Configuration chargée depuis la base de données
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Info code-barres détecté */}
            {initialValues?.barcode && !product && (
              <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-800">
                <ScanLine size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Code-barres détecté</p>
                  <p className="text-sm">
                    Le formulaire a été prérempli avec le code détecté :
                    <span className="ml-1 font-mono font-bold">{initialValues.barcode}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Info type de vente */}
            <div className="flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-4 text-purple-800">
              <Settings2 size={18} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-black">Type de vente configuré</p>
                <p className="text-sm">
                  {salesType === 'wholesale' && 'Vente en gros uniquement'}
                  {salesType === 'retail' && 'Vente au détail uniquement'}
                  {salesType === 'both' && 'Vente en gros et au détail'}
                </p>
                {pharmacyConfig && effectivePharmacyId && (
                  <p className="mt-1 text-xs text-purple-600">
                    Configuration chargée depuis la pharmacie
                  </p>
                )}
              </div>
            </div>

            {/* Tab Général */}
            {activeTab === 'general' && (
              <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
                <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Informations générales
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Identification du produit
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Code produit */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Code produit *
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={form.code}
                          onChange={(e) => setField('code', e.target.value)}
                          placeholder="PRD-240316-1001"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateCode}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                        >
                          <Sparkles size={14} />
                          Générer code
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyBarcodeToCode}
                          disabled={!form.barcode.trim()}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <ScanLine size={14} />
                          Depuis code-barres
                        </button>
                      </div>
                    </div>

                    {/* Code-barres */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Code-barres
                      </label>
                      <div className="relative">
                        <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={form.barcode}
                          onChange={(e) => setField('barcode', e.target.value)}
                          placeholder="1234567890123"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateBarcode}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                        >
                          <Sparkles size={14} />
                          Générer code-barres
                        </button>
                        {onBarcodeCapture && (
                          <button
                            type="button"
                            onClick={() => onBarcodeCapture((code: string) => setField('barcode', code))}
                            className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                          >
                            <Camera size={14} />
                            Scanner
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Désignation */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Désignation *
                      </label>
                      <input
                        value={form.name}
                        onChange={(e) => setField('name', e.target.value)}
                        placeholder="Paracétamol 500mg"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

                    {/* Catégorie */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Catégorie
                      </label>
                      
                      {!manualCategoryMode ? (
                        <div className="relative" ref={categoryDropdownRef}>
                          <div className="relative">
                            <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              value={categorySearch || form.category}
                              onChange={(e) => {
                                setCategorySearch(e.target.value);
                                setShowCategoryDropdown(true);
                                if (!e.target.value) {
                                  setField('category', '');
                                  setField('category_id', '');
                                }
                              }}
                              onFocus={() => setShowCategoryDropdown(true)}
                              placeholder="Rechercher ou sélectionner une catégorie..."
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-10 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                            />
                            <button
                              type="button"
                              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                              className="absolute right-4 top-1/2 -translate-y-1/2"
                            >
                              <ChevronDown size={16} className="text-slate-400" />
                            </button>
                          </div>
                          
                          {showCategoryDropdown && (
                            <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                              {categoriesLoading ? (
                                <div className="p-3 text-center text-sm text-slate-500">
                                  <Loader2 size={16} className="mx-auto animate-spin" />
                                  Chargement...
                                </div>
                              ) : filteredCategories.length === 0 ? (
                                <div className="p-3 text-center text-sm text-slate-500">
                                  Aucune catégorie trouvée
                                  <button
                                    type="button"
                                    onClick={handleManualCategoryToggle}
                                    className="ml-2 text-sky-600 hover:underline"
                                  >
                                    Créer "{categorySearch || 'nouvelle catégorie'}"
                                  </button>
                                </div>
                              ) : (
                                filteredCategories.map((cat) => (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => handleCategorySelect(cat)}
                                    className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-slate-50"
                                  >
                                    <span>{cat.name}</span>
                                    {form.category_id === String(cat.id) && (
                                      <Check size={14} className="text-sky-600" />
                                    )}
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                          
                          <button
                            type="button"
                            onClick={handleManualCategoryToggle}
                            className="mt-2 text-xs text-sky-600 hover:underline"
                          >
                            Ou saisir une catégorie personnalisée
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="relative">
                            <Type className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              value={form.category}
                              onChange={(e) => setField('category', e.target.value)}
                              placeholder="Saisissez une catégorie personnalisée..."
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setManualCategoryMode(false);
                              setField('category', '');
                              setField('category_id', '');
                            }}
                            className="mt-2 text-xs text-sky-600 hover:underline"
                          >
                            Sélectionner une catégorie existante
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setField('description', e.target.value)}
                        rows={3}
                        placeholder="Description libre du produit, dosage, forme, remarque..."
                        className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

                    {/* Fournisseur */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Fournisseur
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={form.supplier}
                          onChange={(e) => setField('supplier', e.target.value)}
                          placeholder="Nom du fournisseur"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>

                    {/* Laboratoire */}
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Laboratoire
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={form.laboratory}
                          onChange={(e) => setField('laboratory', e.target.value)}
                          placeholder="Nom du laboratoire"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raccourcis et résumé */}
                <div className="space-y-5">
                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Raccourcis
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Assistants rapides</h3>
                    <div className="mt-4 space-y-3">
                      <button
                        type="button"
                        onClick={handleGenerateCode}
                        className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-200"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Sparkles size={16} />
                          Générer un code produit
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateBarcode}
                        className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-200"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Sparkles size={16} />
                          Générer un code-barres
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyBarcodeToCode}
                        disabled={!form.barcode.trim()}
                        className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="inline-flex items-center gap-2">
                          <ScanLine size={16} />
                          Utiliser le code-barres comme code
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Résumé
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Fiche produit</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Code</span>
                        <span className="max-w-[65%] truncate font-bold text-slate-800">
                          {form.code || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Code-barres</span>
                        <span className="max-w-[65%] truncate font-bold text-slate-800">
                          {form.barcode || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Nom</span>
                        <span className="max-w-[65%] truncate font-bold text-slate-800">
                          {form.name || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-slate-500">Catégorie</span>
                        <span className="max-w-[65%] truncate font-bold text-slate-800">
                          {form.category || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Prix & Stock */}
            {activeTab === 'pricing' && (
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Stock & tarification
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Prix, quantités et TVA
                    </h3>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Stock initial
                      </label>
                      <div className="relative">
                        <Boxes className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          min="0"
                          value={form.quantity}
                          onChange={(e) => setField('quantity', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Numéro de lot
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={form.batch_number}
                          onChange={(e) => setField('batch_number', e.target.value)}
                          placeholder="LOT-2024-001"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Prix d'achat *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.purchase_price}
                          onChange={(e) => setField('purchase_price', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>

                    {(salesType === 'wholesale' || salesType === 'both') && (
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Prix de vente en gros *
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.selling_price_wholesale}
                            onChange={(e) => setField('selling_price_wholesale', e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          />
                        </div>
                      </div>
                    )}

                    {(salesType === 'retail' || salesType === 'both') && (
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Prix de vente au détail *
                        </label>
                        <div className="relative">
                          <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.selling_price_retail}
                            onChange={(e) => setField('selling_price_retail', e.target.value)}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Seuil d'alerte
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.alert_threshold}
                        onChange={(e) => setField('alert_threshold', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Stock minimum
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.minimum_stock}
                        onChange={(e) => setField('minimum_stock', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Stock maximum
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={form.maximum_stock}
                        onChange={(e) => setField('maximum_stock', e.target.value)}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>
                  </div>

                  {/* Assistant de prix */}
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Assistant prix
                        </p>
                        <h4 className="text-sm font-black text-slate-900">
                          Calcul automatique selon configuration
                        </h4>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      {(salesType === 'wholesale' || salesType === 'both') && (
                        <button
                          type="button"
                          onClick={() => applySuggestedSellingPrice('wholesale')}
                          disabled={!purchasePrice}
                          className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Appliquer prix gros
                        </button>
                      )}
                      {(salesType === 'retail' || salesType === 'both') && (
                        <button
                          type="button"
                          onClick={() => applySuggestedSellingPrice('retail')}
                          disabled={!purchasePrice}
                          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Appliquer prix détail
                        </button>
                      )}
                      {salesType === 'both' && sellingPriceWholesale > 0 && (
                        <button
                          type="button"
                          onClick={applyRetailPriceFromWholesale}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          Détail = Gros × 1.2
                        </button>
                      )}
                    </div>
                    {(autoPricingEnabled || marginPercent) && (
                      <div className="mt-3 rounded-xl bg-slate-100 p-3">
                        <p className="text-xs text-slate-600">
                          {autoPricingEnabled ? (
                            <>
                              Configuration automatique active : 
                              {autoPricingMethod === 'percentage' && `${autoPricingValue}% de marge`}
                              {autoPricingMethod === 'coefficient' && `Coefficient ×${autoPricingValue}`}
                              {autoPricingMethod === 'margin' && `Marge de ${autoPricingValue}%`}
                            </>
                          ) : (
                            <>Marge par défaut : {marginPercent}%</>
                          )}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* TVA */}
                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="has_tva"
                        checked={hasTva}
                        onChange={(e) => setHasTva(e.target.checked)}
                        className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-200"
                      />
                      <label htmlFor="has_tva" className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
                        <ShieldCheck size={16} />
                        Produit soumis à TVA
                      </label>
                    </div>
                    {hasTva && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            Taux TVA (%)
                          </label>
                          <div className="relative">
                            <BadgePercent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={tvaRate}
                              onChange={(e) => setTvaRate(Number(e.target.value || 0))}
                              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Synthèse financière */}
                <div className="space-y-5">
                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Synthèse financière
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Indicateurs</h3>
                    <div className="mt-4 space-y-3">
                      {(salesType === 'wholesale' || salesType === 'both') && (
                        <>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Marge brute (gros)
                            </p>
                            <p className="mt-2 text-lg font-black text-emerald-600">
                              {grossMarginWholesale.toLocaleString()} {primaryCurrency}
                            </p>
                            <p className="text-sm text-slate-500">
                              {grossMarginPercentWholesale.toFixed(2)}%
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Prix TTC (gros)
                            </p>
                            <p className="mt-2 text-lg font-black text-violet-600">
                              {sellingPriceWholesaleWithTva.toLocaleString()} {primaryCurrency}
                            </p>
                          </div>
                        </>
                      )}
                      {(salesType === 'retail' || salesType === 'both') && (
                        <>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Marge brute (détail)
                            </p>
                            <p className="mt-2 text-lg font-black text-emerald-600">
                              {grossMarginRetail.toLocaleString()} {primaryCurrency}
                            </p>
                            <p className="text-sm text-slate-500">
                              {grossMarginPercentRetail.toFixed(2)}%
                            </p>
                          </div>
                          <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                              Prix TTC (détail)
                            </p>
                            <p className="mt-2 text-lg font-black text-violet-600">
                              {sellingPriceRetailWithTva.toLocaleString()} {primaryCurrency}
                            </p>
                          </div>
                        </>
                      )}
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Valeur estimée du stock
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-900">
                          {estimatedStockValue.toLocaleString()} {primaryCurrency}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab Avancé */}
            {activeTab === 'advanced' && (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Informations avancées
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Localisation, dates et traçabilité
                    </h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Emplacement
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          value={form.location}
                          onChange={(e) => setField('location', e.target.value)}
                          placeholder="Rayon A / Étagère 2"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Date de péremption
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="date"
                          value={form.expiry_date}
                          onChange={(e) => setField('expiry_date', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Contrôle qualité
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Vérifications</h3>
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="font-bold text-slate-700">
                          {effectivePharmacyId ? '✓ Pharmacie ID renseigné' : '• Pharmacie ID manquant'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="font-bold text-slate-700">
                          {form.code.trim() ? '✓ Code produit renseigné' : '• Code produit manquant'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="font-bold text-slate-700">
                          {form.name.trim() ? '✓ Désignation renseignée' : '• Désignation manquante'}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="font-bold text-slate-700">
                          {purchasePrice > 0 ? '✓ Prix d’achat valide' : '• Prix d’achat invalide'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Notes
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Les champs obligatoires sont : pharmacie, code, désignation, prix d'achat.
                      {salesType === 'wholesale' && ' Le prix de vente en gros est obligatoire.'}
                      {salesType === 'retail' && ' Le prix de vente au détail est obligatoire.'}
                      {salesType === 'both' && ' Les prix de vente en gros et au détail sont obligatoires.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Boutons d'action */}
            <div className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-0 pt-2 backdrop-blur">
              <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Annuler
                </button>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    disabled={loading}
                    className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
                  >
                    Générer un code
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-600 px-6 py-3 text-sm font-black text-white shadow-lg shadow-sky-100 transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sauvegarde...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        {product ? 'Mettre à jour le produit' : 'Créer le produit'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}