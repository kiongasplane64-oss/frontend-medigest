import { useEffect, useMemo, useState } from 'react';
import type { Product, ProductCreate } from '@/types/inventory.types';
import { inventoryService } from '@/services/inventoryService';
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
} from 'lucide-react';

interface CreateProductViewInitialValues {
  code?: string;
  barcode?: string;
  name?: string;
  category?: string;
  supplier?: string;
  location?: string;
}

interface CreateProductViewProps {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
  onSuccess?: () => void;
  initialValues?: CreateProductViewInitialValues;
}

type FormTab = 'general' | 'pricing' | 'advanced';

interface FormState {
  code: string;
  barcode: string;
  name: string;
  description: string;
  category: string;
  supplier: string;
  purchase_price: string;
  selling_price: string;
  quantity: string;
  alert_threshold: string;
  minimum_stock: string;
  maximum_stock: string;
  expiry_date: string;
  location: string;
  laboratory: string;
}

const DEFAULT_MARGIN_PERCENT = 20;

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

function buildInitialFormState(
  product?: Product | null,
  initialValues?: CreateProductViewInitialValues,
): FormState {
  return {
    code: toInputString(initialValues?.code ?? product?.code ?? ''),
    barcode: toInputString(initialValues?.barcode ?? product?.barcode ?? ''),
    name: toInputString(initialValues?.name ?? product?.name ?? ''),
    description: toInputString(product?.description ?? ''),
    category: toInputString(initialValues?.category ?? product?.category ?? ''),
    supplier: toInputString(initialValues?.supplier ?? product?.supplier ?? ''),
    purchase_price: toInputString(product?.purchase_price ?? ''),
    selling_price: toInputString(product?.selling_price ?? ''),
    quantity: toInputString(product?.quantity ?? 0),
    alert_threshold: toInputString(product?.alert_threshold ?? 10),
    minimum_stock: toInputString(product?.minimum_stock ?? ''),
    maximum_stock: toInputString(product?.maximum_stock ?? ''),
    expiry_date: normalizeDateForInput(product?.expiry_date ?? ''),
    location: toInputString(initialValues?.location ?? product?.location ?? ''),
    laboratory: toInputString(product?.laboratory ?? ''),
  };
}

export default function CreateProductView({
  open,
  onClose,
  product,
  onSuccess,
  initialValues,
}: CreateProductViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FormTab>('general');
  const [hasTva, setHasTva] = useState<boolean>(product?.has_tva ?? false);
  const [tvaRate, setTvaRate] = useState<number>(product?.tva_rate ?? 0);
  const [marginPercent, setMarginPercent] = useState<number>(DEFAULT_MARGIN_PERCENT);

  const [form, setForm] = useState<FormState>(() =>
    buildInitialFormState(product, initialValues),
  );

  useEffect(() => {
    if (!open) return;

    setForm(buildInitialFormState(product, initialValues));
    setHasTva(product?.has_tva ?? false);
    setTvaRate(product?.tva_rate ?? 0);
    setMarginPercent(DEFAULT_MARGIN_PERCENT);
    setActiveTab('general');
    setError(null);
  }, [open, product, initialValues]);

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

  const purchasePrice = Number(form.purchase_price || 0);
  const sellingPrice = Number(form.selling_price || 0);
  const quantity = Number(form.quantity || 0);

  const tvaAmount = useMemo(() => {
    if (!hasTva || !sellingPrice || !tvaRate) return 0;
    return (sellingPrice * tvaRate) / 100;
  }, [hasTva, sellingPrice, tvaRate]);

  const sellingPriceWithTva = useMemo(() => {
    return sellingPrice + tvaAmount;
  }, [sellingPrice, tvaAmount]);

  const grossMargin = useMemo(() => {
    if (!purchasePrice || !sellingPrice) return 0;
    return sellingPrice - purchasePrice;
  }, [purchasePrice, sellingPrice]);

  const grossMarginPercent = useMemo(() => {
    if (!purchasePrice || !sellingPrice) return 0;
    return ((sellingPrice - purchasePrice) / purchasePrice) * 100;
  }, [purchasePrice, sellingPrice]);

  const estimatedStockValue = useMemo(() => {
    return sellingPrice * quantity;
  }, [sellingPrice, quantity]);

  if (!open) return null;

  const setField = (field: keyof FormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (!form.code.trim()) {
      return 'Le code produit est obligatoire.';
    }

    if (!form.name.trim()) {
      return 'La désignation du produit est obligatoire.';
    }

    if (!form.purchase_price || Number(form.purchase_price) <= 0) {
      return "Le prix d'achat doit être supérieur à 0.";
    }

    if (!form.selling_price || Number(form.selling_price) <= 0) {
      return 'Le prix de vente doit être supérieur à 0.';
    }

    if (Number(form.quantity) < 0) {
      return 'La quantité ne peut pas être négative.';
    }

    if (Number(form.alert_threshold) < 0) {
      return "Le seuil d'alerte ne peut pas être négatif.";
    }

    if (form.minimum_stock && Number(form.minimum_stock) < 0) {
      return 'Le stock minimum ne peut pas être négatif.';
    }

    if (form.maximum_stock && Number(form.maximum_stock) < 0) {
      return 'Le stock maximum ne peut pas être négatif.';
    }

    if (
      form.minimum_stock &&
      form.maximum_stock &&
      Number(form.minimum_stock) > Number(form.maximum_stock)
    ) {
      return 'Le stock minimum ne peut pas être supérieur au stock maximum.';
    }

    if (hasTva && tvaRate < 0) {
      return 'Le taux TVA ne peut pas être négatif.';
    }

    return null;
  };

  const buildPayload = (): ProductCreate => {
    const payload: ProductCreate = {
      code: form.code.trim(),
      barcode: form.barcode.trim() || undefined,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      category: form.category.trim() || undefined,
      supplier: form.supplier.trim() || undefined,
      purchase_price: Number(form.purchase_price),
      selling_price: Number(form.selling_price),
      quantity: Number(form.quantity || 0),
      alert_threshold: Number(form.alert_threshold || 10),
      minimum_stock: form.minimum_stock ? Number(form.minimum_stock) : undefined,
      maximum_stock: form.maximum_stock ? Number(form.maximum_stock) : undefined,
      expiry_date: form.expiry_date || undefined,
      location: form.location.trim() || undefined,
      laboratory: form.laboratory.trim() || undefined,
      has_tva: hasTva,
      tva_rate: hasTva ? Number(tvaRate || 0) : 0,
    };

    return payload;
  };

  const applySuggestedSellingPrice = () => {
    if (!purchasePrice || purchasePrice <= 0) return;
    const suggested = purchasePrice + (purchasePrice * marginPercent) / 100;
    setField('selling_price', String(Number(suggested.toFixed(2))));
  };

  const handleGenerateCode = () => {
    setField('code', generateProductCode());
  };

  const handleCopyBarcodeToCode = () => {
    if (!form.barcode.trim()) return;
    setField('code', form.barcode.trim());
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const payload = buildPayload();

      if (product?.id) {
        await inventoryService.updateProduct(product.id, payload);
      } else {
        await inventoryService.createProduct(payload);
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      setError('Erreur lors de la sauvegarde du produit.');
    } finally {
      setLoading(false);
    }
  };

  const tabs: Array<{ id: FormTab; label: string; icon: React.ReactNode }> = [
    { id: 'general', label: 'Général', icon: <Package size={16} /> },
    { id: 'pricing', label: 'Prix & stock', icon: <DollarSign size={16} /> },
    { id: 'advanced', label: 'Avancé', icon: <FileText size={16} /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:h-auto md:max-h-[94vh] md:rounded-4xl">
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

        <div className="flex-1 overflow-y-auto bg-slate-50">
          <form onSubmit={handleSubmit} className="space-y-5 p-4 md:p-6">
            {error ? (
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-black">Validation</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            ) : null}

            {!product && initialValues?.barcode ? (
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
            ) : null}

            {activeTab === 'general' ? (
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

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleGenerateCode}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
                        >
                          <Sparkles size={14} />
                          Générer
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
                    </div>

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

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Catégorie
                      </label>
                      <input
                        value={form.category}
                        onChange={(e) => setField('category', e.target.value)}
                        placeholder="Médicaments"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                      />
                    </div>

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
                  </div>
                </div>

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
            ) : null}

            {activeTab === 'pricing' ? (
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
                        Seuil d&apos;alerte
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

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Prix d&apos;achat *
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

                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Prix de vente *
                      </label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.selling_price}
                          onChange={(e) => setField('selling_price', e.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                          Assistant marge
                        </p>
                        <h4 className="text-sm font-black text-slate-900">Calcul rapide du prix de vente</h4>
                      </div>
                      <button
                        type="button"
                        onClick={applySuggestedSellingPrice}
                        className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700"
                      >
                        Appliquer
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Marge souhaitée (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={marginPercent}
                          onChange={(e) => setMarginPercent(Number(e.target.value || 0))}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition-all focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={applySuggestedSellingPrice}
                        className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800"
                      >
                        Générer le prix
                      </button>
                    </div>
                  </div>

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

                    {hasTva ? (
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

                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            Montant TVA
                          </p>
                          <p className="mt-2 text-xl font-black text-slate-900">
                            {tvaAmount.toLocaleString()} FG
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Synthèse financière
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">Indicateurs</h3>

                    <div className="mt-4 space-y-3">
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Marge brute
                        </p>
                        <p className="mt-2 text-lg font-black text-emerald-600">
                          {grossMargin.toLocaleString()} FG
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Marge %
                        </p>
                        <p className="mt-2 text-lg font-black text-sky-600">
                          {grossMarginPercent.toFixed(2)}%
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Prix TTC
                        </p>
                        <p className="mt-2 text-lg font-black text-violet-600">
                          {sellingPriceWithTva.toLocaleString()} FG
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                          Valeur estimée du stock
                        </p>
                        <p className="mt-2 text-lg font-black text-slate-900">
                          {estimatedStockValue.toLocaleString()} FG
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {activeTab === 'advanced' ? (
              <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                  <div className="mb-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Informations avancées
                    </p>
                    <h3 className="mt-1 text-lg font-black text-slate-900">
                      Localisation, laboratoire et dates
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

                    <div className="space-y-2 md:col-span-2">
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
                      <div className="rounded-2xl bg-slate-50 p-4">
                        <p className="font-bold text-slate-700">
                          {sellingPrice > 0 ? '✓ Prix de vente valide' : '• Prix de vente invalide'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
                      Notes
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      Les champs principaux obligatoires pour éviter les erreurs backend sont :
                      code, désignation, prix d’achat et prix de vente.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

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