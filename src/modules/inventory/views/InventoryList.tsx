// InventoryList.tsx - Version finale avec ID pharmacie obligatoire
import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  RefreshCw,
  Download,
  Upload,
  Printer,
  Eye,
  AlertCircle,
  ShoppingCart,
  TrendingUp,
  Package,
  Edit2,
  Trash2,
  X,
  Clock,
  Grid,
  List,
  Filter,
  AlertTriangle,
  ScanLine,
  Warehouse,
  CircleDollarSign,
  DollarSign,
  Loader2,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import Barcode from 'react-barcode';
import { Html5QrcodeScanner } from 'html5-qrcode';

import { inventoryService } from '@/services/inventoryService';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { 
  Product, 
  StockStats, 
  Category, 
  ImportPreviewResponse,
  ImportPreviewProduct
} from '@/types/inventory.types';
import { SearchInput } from '@/components/SearchInput';
import { StatCardDetail } from '@/components/StatCardDetail';
import ProductListView from '@/components/ProductListView';
import ExportInventory from '@/components/ExportInventory';
import AchatView from '@/components/AchatView';
import ApprovisionnerView from '@/components/ApprovisionnerView';
import CreateProductView from '@/components/CreateProductView';
import InitialStockView from '@/components/InitialStockView';
import MouvementsView from '@/components/MouvementsView';
import RapportStockView from '@/components/RapportStockView';
import { useMediaQuery } from '@/hooks/useMediaQuery';

type SortDirection = 'asc' | 'desc';
type ImportMode = 'add' | 'replace' | 'update';
type DuplicateAction = 'update' | 'keep_both' | 'skip' | 'merge_quantity';

interface SortConfig {
  field: keyof Product;
  direction: SortDirection;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'amber' | 'red' | 'violet';
  subtitle?: string;
  onClick?: () => void;
  loading?: boolean;
}

interface QuickActionButtonProps {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning';
  loading?: boolean;
}

// Type pour la prévisualisation d'import (compatible avec ImportPreviewProduct de inventory.types)
interface ImportPreviewItem {
  name: string;
  code?: string;
  barcode?: string;
  current_stock: number;
  purchase_price: number;
  selling_price: number;
  expiry_date?: string;
  category_name?: string;
  location?: string;
  supplier?: string;
  existingProduct?: Product | null;
  action?: DuplicateAction;
}

interface ImportPreviewData {
  products: ImportPreviewItem[];
  duplicates: ImportPreviewItem[];
  newProducts: ImportPreviewItem[];
}

interface InventoryListProps {
  pharmacyId: string; // RENDU OBLIGATOIRE - plus de ? optionnel
  tenantId?: string;
}

// Constantes de configuration
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const ITEMS_PER_PAGE = 20;

// Fonctions utilitaires
const getCategoryName = (product: Product): string => {
  if (typeof product.category === 'string') return product.category || 'Sans catégorie';
  if (product.category && typeof product.category === 'object' && 'name' in product.category) {
    return String((product.category as { name?: string }).name ?? 'Sans catégorie');
  }
  return 'Sans catégorie';
};

const getProductCode = (product: Product): string => {
  return product.code || product.barcode || 'N/A';
};

const getBarcodeValue = (product: Product): string => {
  return product.barcode || product.code || String(product.id);
};

const isProductExpired = (product: Product): boolean => {
  if (!product.expiry_date) return false;
  const expiryDate = new Date(product.expiry_date);
  if (isNaN(expiryDate.getTime())) return false;
  return expiryDate < new Date();
};

const isProductLowStock = (product: Product, threshold: number = DEFAULT_LOW_STOCK_THRESHOLD): boolean => {
  const quantity = Number(product.quantity ?? 0);
  return quantity > 0 && quantity <= threshold;
};

const isProductOutOfStock = (product: Product): boolean => {
  return Number(product.quantity ?? 0) <= 0;
};

const getStockBadge = (product: Product, threshold: number = DEFAULT_LOW_STOCK_THRESHOLD): {
  label: string;
  className: string;
} => {
  if (isProductExpired(product)) {
    return {
      label: 'Périmé',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (isProductOutOfStock(product)) {
    return {
      label: 'Rupture',
      className: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (isProductLowStock(product, threshold)) {
    return {
      label: 'Faible',
      className: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }

  return {
    label: 'En stock',
    className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  };
};

const StatCard = ({ title, value, icon, tone, subtitle, onClick, loading = false }: StatCardProps) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100',
    red: 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100',
    violet: 'bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg md:p-5 ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            {title}
          </p>
          {loading ? (
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-200 md:h-10" />
          ) : (
            <p className="truncate text-xl font-black text-slate-900 md:text-3xl">{value}</p>
          )}
          {subtitle && !loading && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>

        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${tones[tone]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

const QuickActionButton = ({ label, icon, onClick, variant = 'default', loading = false }: QuickActionButtonProps) => {
  const variants = {
    default: 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50',
    primary: 'bg-sky-600 text-white hover:bg-sky-700 shadow-lg shadow-sky-100',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100',
    warning: 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-100',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98] ${
        variants[variant]
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

// Composant d'import amélioré
const ImportInventoryModal = ({ 
  open, 
  onClose, 
  onSuccess,
  pharmacyId 
}: { 
  open: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  pharmacyId: string; // RENDU OBLIGATOIRE
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('add');
  const [previewData, setPreviewData] = useState<ImportPreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'preview' | 'processing'>('select');
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('merge_quantity');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setIsLoading(true);
    
    try {
      const response: ImportPreviewResponse = await inventoryService.previewImport(selectedFile);
      
      // Convertir la réponse au format attendu par le composant
      const convertItem = (item: ImportPreviewProduct): ImportPreviewItem => ({
        name: item.name,
        code: item.code,
        barcode: item.barcode,
        current_stock: item.current_stock ?? 0,
        purchase_price: item.purchase_price,
        selling_price: item.selling_price,
        expiry_date: item.expiry_date,
        category_name: item.category_name,
        location: item.location,
        supplier: item.supplier,
        existingProduct: item.existingProduct,
        action: item.action as DuplicateAction | undefined
      });

      const convertedData: ImportPreviewData = {
        products: response.products.map(convertItem),
        duplicates: response.duplicates.map(convertItem),
        newProducts: response.newProducts.map(convertItem)
      };
      
      setPreviewData(convertedData);
      setStep('preview');
    } catch (err) {
      setError('Erreur lors de la lecture du fichier');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUpdateDuplicateAction = useCallback((productIndex: number, action: DuplicateAction) => {
    if (!previewData) return;
    
    const updatedProducts = [...previewData.products];
    updatedProducts[productIndex].action = action;
    
    setPreviewData({
      ...previewData,
      products: updatedProducts
    });
  }, [previewData]);

  const handleApplyToAll = useCallback((action: DuplicateAction) => {
    if (!previewData) return;
    
    const updatedProducts = previewData.products.map(product => ({
      ...product,
      action: product.existingProduct ? action : undefined
    }));
    
    setPreviewData({
      ...previewData,
      products: updatedProducts
    });
    
    setDuplicateAction(action);
  }, [previewData]);

  const handleConfirmImport = useCallback(async () => {
    if (!file) return;
    
    setIsLoading(true);
    setStep('processing');
    setError(null);
    
    // Construire les actions pour les doublons
    const duplicateActions: Record<string, string> = {};
    if (previewData) {
      previewData.products.forEach((product, idx) => {
        if (product.existingProduct && product.action) {
          duplicateActions[String(idx)] = product.action;
        }
      });
    }
    
    try {
      const result = await inventoryService.importProducts(file, importMode, duplicateActions);
      
      if (result.success) {
        alert(`Importation réussie !\n${result.created || 0} produits créés\n${result.updated || 0} produits mis à jour\n${result.skipped || 0} produits ignorés`);
        onSuccess();
        onClose();
      } else {
        setError(result.message || 'Erreur lors de l\'importation');
      }
    } catch (err) {
      setError('Erreur lors de l\'importation');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [file, importMode, previewData, onSuccess, onClose]);

  const handleDownloadTemplate = useCallback(async (format: 'excel' | 'csv') => {
    try {
      const blob = await inventoryService.getImportTemplate(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `import_template.${format === 'excel' ? 'xlsx' : 'csv'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement template:', err);
      alert('Erreur lors du téléchargement du template');
    }
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-[28px] bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <Upload size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Importation de produits</h3>
              <p className="text-sm text-slate-500">
                Importez vos produits depuis Excel ou CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {step === 'select' && (
            <>
              {/* Options d'import */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-3 font-bold text-slate-800">Mode d'importation</h4>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <button
                    onClick={() => setImportMode('add')}
                    className={`rounded-2xl p-4 text-left transition-all ${
                      importMode === 'add'
                        ? 'border-2 border-sky-600 bg-sky-50'
                        : 'border border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <Plus size={20} className="mb-2 text-sky-600" />
                    <p className="font-bold text-slate-800">Ajouter</p>
                    <p className="text-xs text-slate-500">Ignore les doublons</p>
                  </button>
                  
                  <button
                    onClick={() => setImportMode('update')}
                    className={`rounded-2xl p-4 text-left transition-all ${
                      importMode === 'update'
                        ? 'border-2 border-sky-600 bg-sky-50'
                        : 'border border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <Edit2 size={20} className="mb-2 text-amber-600" />
                    <p className="font-bold text-slate-800">Mettre à jour</p>
                    <p className="text-xs text-slate-500">Met à jour les existants</p>
                  </button>
                  
                  <button
                    onClick={() => setImportMode('replace')}
                    className={`rounded-2xl p-4 text-left transition-all ${
                      importMode === 'replace'
                        ? 'border-2 border-sky-600 bg-sky-50'
                        : 'border border-slate-200 hover:border-sky-300'
                    }`}
                  >
                    <RefreshCw size={20} className="mb-2 text-red-600" />
                    <p className="font-bold text-slate-800">Remplacer</p>
                    <p className="text-xs text-slate-500">Remplace les existants</p>
                  </button>
                </div>
              </div>

              {/* Téléchargement template */}
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-3 font-bold text-slate-800">Télécharger le modèle</h4>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleDownloadTemplate('excel')}
                    className="flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    <FileSpreadsheet size={18} />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => handleDownloadTemplate('csv')}
                    className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    <FileText size={18} />
                    CSV (.csv)
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Le modèle contient les colonnes : nom, code, code-barres, quantité, prix_achat, prix_vente, date_expiration, catégorie, emplacement, fournisseur
                </p>
              </div>

              {/* Sélection du fichier */}
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
                <Upload size={48} className="mx-auto mb-4 text-slate-400" />
                <p className="mb-2 font-bold text-slate-700">Cliquez pour sélectionner un fichier</p>
                <p className="text-sm text-slate-500">Formats acceptés : .xlsx, .xls, .csv</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 rounded-2xl bg-sky-600 px-6 py-2 font-bold text-white hover:bg-sky-700"
                >
                  Choisir un fichier
                </button>
              </div>
            </>
          )}

          {step === 'preview' && previewData && (
            <div className="space-y-4">
              {/* Résumé */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                  <p className="text-2xl font-black text-emerald-700">{previewData.newProducts.length}</p>
                  <p className="text-sm text-emerald-600">Nouveaux produits</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4 text-center">
                  <p className="text-2xl font-black text-amber-700">{previewData.duplicates.length}</p>
                  <p className="text-sm text-amber-600">Doublons détectés</p>
                </div>
                <div className="rounded-2xl bg-slate-100 p-4 text-center">
                  <p className="text-2xl font-black text-slate-700">{previewData.products.length}</p>
                  <p className="text-sm text-slate-600">Total lignes</p>
                </div>
              </div>

              {/* Actions pour les doublons */}
              {previewData.duplicates.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <h4 className="mb-3 font-bold text-amber-800">Gestion des doublons</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleApplyToAll('update')}
                      className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        duplicateAction === 'update' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700'
                      }`}
                    >
                      Tout mettre à jour
                    </button>
                    <button
                      onClick={() => handleApplyToAll('merge_quantity')}
                      className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        duplicateAction === 'merge_quantity' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700'
                      }`}
                    >
                      Fusionner quantités
                    </button>
                    <button
                      onClick={() => handleApplyToAll('keep_both')}
                      className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        duplicateAction === 'keep_both' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700'
                      }`}
                    >
                      Garder les deux
                    </button>
                    <button
                      onClick={() => handleApplyToAll('skip')}
                      className={`rounded-xl px-3 py-1.5 text-sm font-bold transition-all ${
                        duplicateAction === 'skip' ? 'bg-amber-600 text-white' : 'bg-white text-amber-700'
                      }`}
                    >
                      Ignorer
                    </button>
                  </div>
                </div>
              )}

              {/* Aperçu des données */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">Code</th>
                      <th className="px-3 py-2 text-right">Qté</th>
                      <th className="px-3 py-2 text-right">Prix achat</th>
                      <th className="px-3 py-2 text-right">Prix vente</th>
                      <th className="px-3 py-2 text-left">Expiration</th>
                      <th className="px-3 py-2 text-left">Statut</th>
                      <th className="px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.products.slice(0, 10).map((product, idx) => (
                      <tr key={idx} className={product.existingProduct ? 'bg-amber-50/50' : ''}>
                        <td className="px-3 py-2 font-medium">{product.name}</td>
                        <td className="px-3 py-2 text-slate-500">{product.code || '-'}</td>
                        <td className="px-3 py-2 text-right font-bold">{product.current_stock}</td>
                        <td className="px-3 py-2 text-right">{product.purchase_price} FC</td>
                        <td className="px-3 py-2 text-right">{product.selling_price} FC</td>
                        <td className="px-3 py-2">{product.expiry_date || '-'}</td>
                        <td className="px-3 py-2">
                          {product.existingProduct ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
                              Existant
                            </span>
                          ) : (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                              Nouveau
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {product.existingProduct && (
                            <select
                              value={product.action || duplicateAction}
                              onChange={(e) => handleUpdateDuplicateAction(idx, e.target.value as DuplicateAction)}
                              className="rounded-xl border border-slate-200 px-2 py-1 text-xs"
                            >
                              <option value="update">Mettre à jour</option>
                              <option value="merge_quantity">Fusionner qté</option>
                              <option value="keep_both">Garder les deux</option>
                              <option value="skip">Ignorer</option>
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewData.products.length > 10 && (
                  <p className="mt-2 text-center text-sm text-slate-500">
                    et {previewData.products.length - 10} autres produits...
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-2xl bg-red-50 p-4 text-red-700">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep('select')}
                  className="rounded-2xl border border-slate-200 px-6 py-2 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Retour
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={isLoading}
                  className="rounded-2xl bg-sky-600 px-6 py-2 font-bold text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {isLoading ? 'Importation...' : "Confirmer l'import"}
                </button>
              </div>
            </div>
          )}

          {step === 'processing' && (
            <div className="py-12 text-center">
              <Loader2 size={48} className="mx-auto mb-4 animate-spin text-sky-600" />
              <p className="font-bold text-slate-800">Importation en cours...</p>
              <p className="text-sm text-slate-500">Veuillez patienter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function InventoryList({ pharmacyId }: InventoryListProps) {
  const queryClient = useQueryClient();
  const isMobile = useMediaQuery('(max-width: 768px)');
  
  // Récupération de la configuration de la pharmacie
  const { 
    isLoading: configLoading,
    formatPrice, 
    primaryCurrency,
    lowStockThreshold,
    expiryWarningDays,
    taxRate
  } = usePharmacyConfig(pharmacyId);

  // États
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobile ? 'grid' : 'list');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // États des modaux
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProductList, setShowProductList] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAchatModal, setShowAchatModal] = useState(false);
  const [showApproModal, setShowApproModal] = useState(false);
  const [showInitialStockModal, setShowInitialStockModal] = useState(false);
  const [showMouvementsModal, setShowMouvementsModal] = useState(false);
  const [showRapportModal, setShowRapportModal] = useState(false);
  const [showStatDetail, setShowStatDetail] = useState<{
    type: 'value' | 'margin' | 'lowstock' | 'expired' | 'purchase';
    title: string;
    data: any;
  } | null>(null);

  // États pour le scanner
  const [barcodeToCreate, setBarcodeToCreate] = useState<string>('');
  const [showBarcodeCreateChoice, setShowBarcodeCreateChoice] = useState(false);

  // Ajuster le mode d'affichage pour mobile
  useEffect(() => {
    setViewMode(isMobile ? 'grid' : 'list');
  }, [isMobile]);

  // Query: Récupération des produits avec pagination
  const {
    data: productsData,
    isLoading: productsLoading,
    refetch,
    error: productsError,
    isFetching,
  } = useQuery({
    queryKey: ['inventory-products', pharmacyId, searchTerm, selectedCategory, selectedLocation, stockStatusFilter, currentPage],
    queryFn: () =>
      inventoryService.getProducts({
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        location: selectedLocation !== 'all' ? selectedLocation : undefined,
        stock_status: stockStatusFilter !== 'all' ? stockStatusFilter : undefined,
        skip: (currentPage - 1) * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
        include_sales_stats: true,
        pharmacy_id: pharmacyId,
      }),
    staleTime: 5 * 60 * 1000,
    enabled: !!pharmacyId,
  });

  // Query: Récupération des statistiques
  const { data: stats, isLoading: statsLoading } = useQuery<StockStats>({
    queryKey: ['inventory-stats', pharmacyId],
    queryFn: () => inventoryService.getStats(),
    staleTime: 5 * 60 * 1000,
    enabled: !!pharmacyId,
  });

  // Query: Récupération des catégories existantes
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['inventory-categories', pharmacyId],
    queryFn: async () => {
      const response = await inventoryService.getCategories({ skip: 0, limit: 100 });
      return response.categories;
    },
    staleTime: 10 * 60 * 1000,
    enabled: true,
  });

  // Query: Récupération des emplacements uniques
  const { data: locations = [] } = useQuery<string[]>({
    queryKey: ['inventory-locations', pharmacyId],
    queryFn: async () => {
      const products = await inventoryService.getProducts({ limit: 1000, pharmacy_id: pharmacyId });
      const uniqueLocations = new Set<string>();
      products.products.forEach(p => {
        if (p.location) uniqueLocations.add(p.location);
      });
      return Array.from(uniqueLocations);
    },
    staleTime: 10 * 60 * 1000,
    enabled: true,
  });

  // Mutation: Suppression de produit
  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryService.deleteProduct(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-categories'] });
      setSelectedProducts(new Set());
    },
    onError: (error) => {
      console.error('Erreur suppression produit:', error);
      alert('Erreur lors de la suppression du produit.');
    },
  });

  // Mutation: Suppression multiple
  const deleteMultipleMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.allSettled(ids.map(id => inventoryService.deleteProduct(id)));
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['inventory-products'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      setSelectedProducts(new Set());
      alert('Produits supprimés avec succès');
    },
    onError: (error) => {
      console.error('Erreur suppression multiple:', error);
      alert('Erreur lors de la suppression des produits');
    },
  });

  // Scanner QR code / code-barres
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    let mounted = true;

    if (!isScanning) return;

    scanner = new Html5QrcodeScanner(
      'reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        showTorchButtonIfSupported: true,
      },
      false,
    );

    scanner.render(
      async (decodedText: string) => {
        if (!mounted) return;

        const found = await inventoryService.findProductByCodeOrBarcode(decodedText);

        if (found) {
          setSelectedProduct(found);
          setShowApproModal(true);
        } else {
          setBarcodeToCreate(decodedText);
          setShowBarcodeCreateChoice(true);
          setSearchTerm(decodedText);
        }

        setIsScanning(false);
      },
      (scanError: string) => {
        if (scanError) {
          console.warn('Scan info:', scanError);
        }
      },
    );

    return () => {
      mounted = false;
      if (scanner) {
        scanner.clear().catch((err: Error) => {
          console.warn('Erreur fermeture scanner:', err);
        });
      }
    };
  }, [isScanning]);

  // Traitement des données
  const products = useMemo(() => productsData?.products ?? [], [productsData]);
  const totalProducts = productsData?.total || 0;
  const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

  // Tri des produits
  const sortedProducts = useMemo(() => {
    const cloned = [...products];

    if (!sortConfig) return cloned;

    cloned.sort((a, b) => {
      const aValue = a[sortConfig.field];
      const bValue = b[sortConfig.field];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aText = sortConfig.field === 'category'
        ? getCategoryName(a)
        : String(aValue ?? '').toLowerCase();

      const bText = sortConfig.field === 'category'
        ? getCategoryName(b)
        : String(bValue ?? '').toLowerCase();

      return sortConfig.direction === 'asc'
        ? aText.localeCompare(bText)
        : bText.localeCompare(aText);
    });

    return cloned;
  }, [products, sortConfig]);

  // Calcul des statistiques locales
  const inventoryHighlights = useMemo(() => {
    const threshold = lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD;
    return {
      total: products.length,
      low: products.filter(p => isProductLowStock(p, threshold)).length,
      expired: products.filter(isProductExpired).length,
      rupture: products.filter(isProductOutOfStock).length,
    };
  }, [products, lowStockThreshold]);

  // Calcul des valeurs financières
  const totalSelling = Number((stats as any)?.total_value_selling ?? stats?.total_selling_value ?? 0);
  const totalPurchase = Number((stats as any)?.total_value_purchase ?? stats?.total_purchase_value ?? 0);
  const potentialMargin = totalSelling - totalPurchase;

  // Handlers
  const handleSort = useCallback((field: keyof Product) => {
    setSortConfig((prev) => {
      if (prev?.field === field) {
        return { field, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { field, direction: 'asc' };
    });
  }, []);

  const handleSelectProduct = useCallback((productId: string, checked: boolean) => {
    setSelectedProducts(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(productId);
      } else {
        newSet.delete(productId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(sortedProducts.map(p => String(p.id))));
    } else {
      setSelectedProducts(new Set());
    }
  }, [sortedProducts]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedProducts.size === 0) {
      alert('Aucun produit sélectionné');
      return;
    }
    const confirmed = window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedProducts.size} produit(s) ?`);
    if (!confirmed) return;
    deleteMultipleMutation.mutate(Array.from(selectedProducts));
  }, [selectedProducts, deleteMultipleMutation]);

  const handleDelete = useCallback((id: string) => {
    const confirmed = window.confirm('Êtes-vous sûr de vouloir supprimer ce produit ?');
    if (!confirmed) return;
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const handleEditProduct = useCallback((product: Product) => {
    // Préparer les données pour l'édition
    const editInitialValues = {
      ...product,
      category: typeof product.category === 'object' && product.category !== null
        ? product.category.name || ''
        : product.category || '',
      category_id: typeof product.category === 'object' && product.category !== null
        ? (product.category as any).id
        : product.category_id
    };
    setSelectedProduct(editInitialValues as Product);
    setShowEditModal(true);
  }, []);

  const handlePrintLabel = useCallback((product: Product) => {
    const printWindow = window.open('', '_blank', 'width=500,height=400');
    if (!printWindow) return;

    const code = getProductCode(product);
    const barcodeValue = getBarcodeValue(product);
    const formattedPrice = formatPrice(product.selling_price);

    printWindow.document.write(`
      <html>
        <head>
          <title>Étiquette - ${product.name}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <style>
            @page { size: 50mm 30mm; margin: 2mm; }
            body {
              margin: 0;
              padding: 2mm;
              width: 50mm;
              min-height: 30mm;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              font-family: Arial, sans-serif;
            }
            .name {
              font-size: 10pt;
              font-weight: 700;
              margin-bottom: 2px;
              text-transform: uppercase;
              word-break: break-word;
            }
            .price {
              font-size: 9pt;
              font-weight: 700;
              color: #0284c7;
              margin-bottom: 2px;
            }
            .code {
              font-size: 7pt;
              color: #64748b;
              margin-top: 2px;
            }
            svg {
              width: 100%;
              max-width: 42mm;
              height: 10mm;
            }
          </style>
        </head>
        <body>
          <div class="name">${product.name.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
          <div class="price">${formattedPrice}</div>
          <svg id="barcode"></svg>
          <div class="code">${code}</div>
          <script>
            JsBarcode("#barcode", "${barcodeValue}", {
              format: "CODE128",
              displayValue: false,
              margin: 0,
              height: 35,
              width: 1.2
            });
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  }, [formatPrice]);

  const handleCreateFromBarcode = useCallback(() => {
    setShowBarcodeCreateChoice(false);
    setShowAddModal(true);
  }, []);

  const handleStatCardClick = useCallback((type: 'value' | 'margin' | 'lowstock' | 'expired' | 'purchase', title: string) => {
    let data: any = {};

    switch (type) {
      case 'value':
        data = {
          purchaseValue: totalPurchase,
          sellingValue: totalSelling,
          profit: potentialMargin,
          averageMargin: (stats as any)?.average_margin,
          currency: primaryCurrency
        };
        break;
      case 'margin':
        data = {
          totalMargin: potentialMargin,
          byCategory: categories.map((cat: Category) => ({
            category: cat.name,
            profit: (potentialMargin * (cat.product_count || 1)) / (products.length || 1),
            margin: (stats as any)?.average_margin || 0
          }))
        };
        break;
      case 'lowstock':
        data = {
          products: products.filter(p => isProductLowStock(p, lowStockThreshold)).slice(0, 10),
          threshold: lowStockThreshold
        };
        break;
      case 'expired':
        data = {
          products: products.filter(isProductExpired).slice(0, 10)
        };
        break;
      case 'purchase':
        data = {
          totalPurchase,
          productCount: products.length,
          averagePurchasePrice: products.length > 0 ? totalPurchase / products.length : 0
        };
        break;
    }

    setShowStatDetail({ type, title, data });
  }, [totalPurchase, totalSelling, potentialMargin, stats, primaryCurrency, categories, products, lowStockThreshold]);

  // États de chargement
  const isLoading = productsLoading || statsLoading || configLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 p-4 md:p-6">
        <div className="mb-6 h-28 animate-pulse rounded-[28px] bg-slate-200" />
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-200" />
          ))}
        </div>
        <div className="h-105 animate-pulse rounded-[28px] bg-slate-200" />
      </div>
    );
  }

  if (productsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        <div className="max-w-md rounded-3xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
          <h2 className="mb-2 text-xl font-black text-slate-900">Erreur de chargement</h2>
          <p className="mb-5 text-sm text-slate-500">Impossible de charger les produits du stock.</p>
          <button
            onClick={() => refetch()}
            className="rounded-2xl bg-sky-600 px-5 py-3 font-bold text-white hover:bg-sky-700"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-sky-50 p-3 md:p-6">
      <div className="mx-auto max-w-400 space-y-5">
        {/* Header */}
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white p-5 shadow-md md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-blue-600 text-white shadow-lg">
                <Warehouse size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-800 md:text-3xl">
                  Inventaire
                </h1>
                <p className="text-sm text-slate-500">
                  {totalProducts} produits • {inventoryHighlights.rupture} ruptures
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-4 py-2 rounded-2xl">
              <DollarSign size={16} className="text-sky-600" />
              <span>Devise: {primaryCurrency || 'CDF'}</span>
              {taxRate !== undefined && (
                <span className="ml-2 text-slate-400">| TVA: {taxRate}%</span>
              )}
            </div>
          </div>
        </div>

        {/* Cartes de statistiques */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatCard
            title="Valeur du stock"
            value={formatPrice(totalSelling)}
            icon={<Package size={20} />}
            tone="blue"
            subtitle={`${stats?.total_products ?? 0} produits`}
            onClick={() => handleStatCardClick('value', 'Valeur du stock')}
            loading={statsLoading}
          />
          <StatCard
            title="Marge potentielle"
            value={formatPrice(potentialMargin)}
            icon={<TrendingUp size={20} />}
            tone="green"
            subtitle={`${(stats as any)?.average_margin?.toFixed(1) || 0}% de marge`}
            onClick={() => handleStatCardClick('margin', 'Marge potentielle')}
            loading={statsLoading}
          />
          <StatCard
            title="Stock faible"
            value={inventoryHighlights.low}
            icon={<AlertCircle size={20} />}
            tone="amber"
            subtitle={`${inventoryHighlights.rupture} en rupture`}
            onClick={() => handleStatCardClick('lowstock', 'Produits en stock faible')}
          />
          <StatCard
            title="Produits expirés"
            value={inventoryHighlights.expired}
            icon={<Clock size={20} />}
            tone="red"
            subtitle={`Seuil: ${expiryWarningDays || 30} jours`}
            onClick={() => handleStatCardClick('expired', 'Produits expirés')}
          />
          <StatCard
            title="Valeur achat"
            value={formatPrice(totalPurchase)}
            icon={<CircleDollarSign size={20} />}
            tone="violet"
            subtitle="Coût d'acquisition"
            onClick={() => handleStatCardClick('purchase', "Valeur d'achat")}
            loading={statsLoading}
          />
        </div>

        {/* Barre d'actions */}
        <div className="rounded-[30px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex-1 min-w-50">
              <SearchInput
                value={searchTerm}
                onChange={setSearchTerm}
                onSelect={(product) => {
                  setSelectedProduct(product);
                  setShowApproModal(true);
                }}
                products={products}
                placeholder="Rechercher par nom, code, fournisseur..."
                pharmacyId={pharmacyId}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <QuickActionButton
                label="Achat"
                icon={<ShoppingCart size={16} />}
                onClick={() => setShowAchatModal(true)}
                variant="primary"
              />
              <QuickActionButton
                label="Appro"
                icon={<RefreshCw size={16} />}
                onClick={() => {
                  if (selectedProduct) {
                    setShowApproModal(true);
                  } else {
                    alert('Sélectionnez d’abord un produit');
                  }
                }}
                variant="success"
              />
              <QuickActionButton
                label="Ajouter"
                icon={<Plus size={16} />}
                onClick={() => setShowAddModal(true)}
                variant="warning"
              />
              <QuickActionButton
                label="Importer"
                icon={<Upload size={16} />}
                onClick={() => setShowImportModal(true)}
              />
              <QuickActionButton
                label="Exporter"
                icon={<Download size={16} />}
                onClick={() => setShowExportModal(true)}
              />
              <QuickActionButton
                label="Scanner"
                icon={<ScanLine size={16} />}
                onClick={() => setIsScanning(true)}
              />
            </div>
          </div>

          {/* Sélection multiple */}
          {selectedProducts.size > 0 && (
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-sky-50 p-3">
              <span className="text-sm font-bold text-sky-700">
                {selectedProducts.size} produit(s) sélectionné(s)
              </span>
              <button
                onClick={handleDeleteSelected}
                className="rounded-xl bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700"
              >
                Supprimer
              </button>
              <button
                onClick={() => setSelectedProducts(new Set())}
                className="rounded-xl bg-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-300"
              >
                Annuler
              </button>
            </div>
          )}

          {/* Filtres */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                showFilters || selectedCategory !== 'all' || selectedLocation !== 'all' || stockStatusFilter !== 'all'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <Filter size={16} />
                Filtres
              </span>
            </button>

            <button
              onClick={() => setViewMode(prev => prev === 'list' ? 'grid' : 'list')}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                {viewMode === 'list' ? <Grid size={16} /> : <List size={16} />}
                {viewMode === 'list' ? 'Grille' : 'Liste'}
              </span>
            </button>

            <button
              onClick={() => setShowProductList(true)}
              className="rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200"
            >
              <span className="inline-flex items-center gap-2">
                <Eye size={16} />
                Tout voir ({totalProducts})
              </span>
            </button>

            <button
              onClick={() => refetch()}
              className={`rounded-2xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-200 ${
                isFetching ? 'animate-pulse' : ''
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
                Rafraîchir
              </span>
            </button>
          </div>

          {/* Panneau de filtres */}
          {showFilters && (
            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">Toutes les catégories</option>
                {categories.map((cat: Category) => (
                  <option key={String(cat.id)} value={cat.name}>
                    {cat.name} {cat.product_count ? `(${cat.product_count})` : ''}
                  </option>
                ))}
              </select>

              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">Tous les emplacements</option>
                {locations.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-4 focus:ring-sky-100"
              >
                <option value="all">État du stock : tous</option>
                <option value="in_stock">En stock</option>
                <option value="low_stock">Stock faible</option>
                <option value="out_of_stock">Rupture</option>
                <option value="expired">Périmé</option>
              </select>
            </div>
          )}

          {/* Scanner */}
          {isScanning && (
            <div className="relative mt-4 overflow-hidden rounded-3xl border-4 border-sky-500 bg-black">
              <div id="reader" className="w-full" />
              <button
                onClick={() => setIsScanning(false)}
                className="absolute right-3 top-3 rounded-xl bg-black/60 p-2 text-white hover:bg-black/80"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Liste/Grille des produits */}
        <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                <Package size={14} />
                {totalProducts} produits
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-700">
                <AlertCircle size={14} />
                {inventoryHighlights.low} faibles
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-red-700">
                <Clock size={14} />
                {inventoryHighlights.rupture} ruptures
              </span>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-200">
                <thead className="border-b border-slate-100 bg-white">
                  <tr>
                    <th className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === sortedProducts.length && sortedProducts.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">#</th>
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('name')}>
                      Produit {sortConfig?.field === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Catégorie</th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('quantity')}>
                      Stock {sortConfig?.field === 'quantity' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('selling_price')}>
                      Prix vente {sortConfig?.field === 'selling_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 cursor-pointer hover:text-sky-600" onClick={() => handleSort('purchase_price')}>
                      Prix achat {sortConfig?.field === 'purchase_price' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Profit
                    </th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      État
                    </th>
                    <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sortedProducts.map((product, index) => {
                    const lowStock = isProductLowStock(product, lowStockThreshold);
                    const expired = isProductExpired(product);
                    const outOfStock = isProductOutOfStock(product);
                    const badge = getStockBadge(product, lowStockThreshold);
                    const profit = (product.selling_price - product.purchase_price) * product.quantity;
                    const isSelected = selectedProducts.has(String(product.id));

                    return (
                      <tr
                        key={String(product.id)}
                        className={`transition-colors hover:bg-sky-50/40 ${
                          isSelected ? 'bg-sky-50' : ''
                        } ${
                          expired ? 'bg-red-50/50' : outOfStock ? 'bg-red-50/30' : lowStock ? 'bg-amber-50/40' : 'bg-white'
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectProduct(String(product.id), e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-slate-500">{index + 1 + (currentPage - 1) * ITEMS_PER_PAGE}</td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                              <Package size={18} />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-slate-900">
                                {product.name}
                              </p>
                              <p className="truncate text-xs font-semibold text-slate-400">
                                {getProductCode(product)}
                                {product.location && ` • ${product.location}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-sm font-semibold text-slate-600">
                          {getCategoryName(product)}
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex min-w-16 items-center justify-center rounded-full px-3 py-1 text-xs font-black ${
                              outOfStock
                                ? 'bg-red-100 text-red-700'
                                : lowStock
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {product.quantity}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-right text-sm font-black text-slate-800">
                          {formatPrice(product.selling_price)}
                        </td>

                        <td className="px-3 py-3 text-right text-sm font-black text-slate-500">
                          {formatPrice(product.purchase_price)}
                        </td>

                        <td className="px-3 py-3 text-right">
                          <span className="text-sm font-black text-emerald-600">
                            {formatPrice(profit)}
                          </span>
                        </td>

                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${badge.className}`}>
                            {badge.label}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex flex-wrap justify-center gap-1">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowApproModal(true);
                              }}
                              className="rounded-xl bg-emerald-600 p-2 text-white hover:bg-emerald-700"
                              title="Approvisionner"
                            >
                              <RefreshCw size={14} />
                            </button>

                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setShowMouvementsModal(true);
                              }}
                              className="rounded-xl bg-blue-600 p-2 text-white hover:bg-blue-700"
                              title="Mouvements"
                            >
                              <Package size={14} />
                            </button>

                            <button
                              onClick={() => handlePrintLabel(product)}
                              className="rounded-xl bg-amber-500 p-2 text-white hover:bg-amber-600"
                              title="Imprimer étiquette"
                            >
                              <Printer size={14} />
                            </button>

                            <button
                              onClick={() => handleEditProduct(product)}
                              className="rounded-xl bg-slate-700 p-2 text-white hover:bg-slate-800"
                              title="Modifier"
                            >
                              <Edit2 size={14} />
                            </button>

                            <button
                              onClick={() => handleDelete(String(product.id))}
                              className="rounded-xl bg-red-600 p-2 text-white hover:bg-red-700"
                              title="Supprimer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 md:grid-cols-3 xl:grid-cols-5">
              {sortedProducts.map((product) => {
                const lowStock = isProductLowStock(product, lowStockThreshold);
                const expired = isProductExpired(product);
                const outOfStock = isProductOutOfStock(product);
                const badge = getStockBadge(product, lowStockThreshold);
                const isSelected = selectedProducts.has(String(product.id));

                return (
                  <div
                    key={String(product.id)}
                    className={`relative rounded-3xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                      isSelected ? 'border-sky-400 ring-2 ring-sky-400' : ''
                    } ${
                      expired
                        ? 'border-red-200 bg-red-50/40'
                        : outOfStock
                        ? 'border-red-200 bg-red-50/30'
                        : lowStock
                          ? 'border-amber-200 bg-amber-50/30'
                          : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="absolute top-2 left-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectProduct(String(product.id), e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </div>
                    <div className="mb-3 flex items-start justify-between gap-3 pt-4">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black uppercase tracking-[0.15em] text-slate-400">
                          {getProductCode(product)}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm font-black text-slate-900">
                          {product.name}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mb-3 flex justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 py-3">
                      <Barcode
                        value={getBarcodeValue(product)}
                        format="CODE128"
                        width={1}
                        height={30}
                        displayValue={false}
                        margin={0}
                      />
                    </div>

                    <div className="mb-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Catégorie</span>
                        <span className="max-w-[50%] truncate font-bold text-slate-700">
                          {getCategoryName(product)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Stock</span>
                        <span className={`font-black ${outOfStock ? 'text-red-600' : lowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {product.quantity}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Prix</span>
                        <span className="font-black text-sky-600">
                          {formatPrice(product.selling_price)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Emplacement</span>
                        <span className="font-bold text-slate-600">
                          {product.location || 'Principal'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setShowApproModal(true);
                        }}
                        className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                      >
                        Appro
                      </button>
                      <button
                        onClick={() => handlePrintLabel(product)}
                        className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600"
                      >
                        Étiquette
                      </button>
                      <button
                        onClick={() => handleEditProduct(product)}
                        className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        Modifier
                      </button>
                      <button
                        onClick={() => handleDelete(String(product.id))}
                        className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-700"
                      >
                        Suppr.
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sortedProducts.length === 0 && (
            <div className="px-4 py-16 text-center">
              <Package className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-base font-black text-slate-500">Aucun produit trouvé</p>
              <p className="mt-2 text-sm text-slate-400">
                {searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all'
                  ? 'Essayez de modifier les filtres'
                  : 'Ajoutez votre premier produit'}
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                <ChevronLeft size={16} />
                Précédent
              </button>
              <span className="text-sm text-slate-600">
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                Suivant
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* FAB mobile */}
        {isMobile && (
          <div className="fixed bottom-4 left-4 right-4 z-40 grid grid-cols-3 gap-3">
            <button
              onClick={() => setShowAchatModal(true)}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              Achat
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              Produit
            </button>
            <button
              onClick={() => setIsScanning(true)}
              className="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black text-white shadow-lg"
            >
              Scan
            </button>
          </div>
        )}

        {/* Modals */}
        {showBarcodeCreateChoice && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
                  <ScanLine size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Code-barres détecté</h3>
                  <p className="text-sm text-slate-500">
                    Aucun produit n'est lié à ce code.
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Code détecté
                </p>
                <p className="mt-2 break-all font-mono text-sm font-bold text-slate-800">
                  {barcodeToCreate}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setShowBarcodeCreateChoice(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  Fermer
                </button>
                <button
                  onClick={handleCreateFromBarcode}
                  className="rounded-2xl bg-sky-600 px-4 py-3 font-bold text-white hover:bg-sky-700"
                >
                  Créer ce produit
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddModal && (
          <CreateProductView
            open={showAddModal}
            onClose={() => {
              setShowAddModal(false);
              setBarcodeToCreate('');
            }}
            onSuccess={() => {
              refetch();
              setShowAddModal(false);
              setBarcodeToCreate('');
            }}
            initialValues={
              barcodeToCreate
                ? {
                    barcode: barcodeToCreate,
                    code: barcodeToCreate,
                  }
                : undefined
            }
            pharmacyId={pharmacyId}
          />
        )}

        {showEditModal && selectedProduct && (
          <CreateProductView
            open={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setSelectedProduct(null);
            }}
            onSuccess={() => {
              refetch();
              setShowEditModal(false);
              setSelectedProduct(null);
            }}
            initialValues={{
              ...selectedProduct,
              category: typeof selectedProduct.category === 'object' && selectedProduct.category !== null
                ? selectedProduct.category.name || ''
                : selectedProduct.category || ''
            }}
            pharmacyId={pharmacyId}
          />
        )}

        {showProductList && (
          <ProductListView
            open={showProductList}
            onClose={() => setShowProductList(false)}
            products={sortedProducts}
            onSelectProduct={(product: Product) => {
              setSelectedProduct(product);
              setShowProductList(false);
            }}
            onPrintLabel={handlePrintLabel}
          />
        )}

        {showExportModal && (
          <ExportInventory
            open={showExportModal}
            onClose={() => setShowExportModal(false)}
            filters={{
              search: searchTerm,
              category: selectedCategory !== 'all' ? selectedCategory : undefined,
            }}
          />
        )}

        {showImportModal && (
          <ImportInventoryModal
            open={showImportModal}
            onClose={() => setShowImportModal(false)}
            onSuccess={() => {
              refetch();
              setShowImportModal(false);
            }}
            pharmacyId={pharmacyId}
          />
        )}

        {showAchatModal && (
          <AchatView
            open={showAchatModal}
            onClose={() => setShowAchatModal(false)}
            onSuccess={() => {
              refetch();
              setShowAchatModal(false);
            }}
          />
        )}

        {showApproModal && selectedProduct && (
          <ApprovisionnerView
            open={showApproModal}
            onClose={() => {
              setShowApproModal(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            onSuccess={() => {
              refetch();
              setShowApproModal(false);
              setSelectedProduct(null);
            }}
          />
        )}

        {showInitialStockModal && (
          <InitialStockView
            open={showInitialStockModal}
            onClose={() => setShowInitialStockModal(false)}
            onSuccess={() => {
              refetch();
              setShowInitialStockModal(false);
            }}
            pharmacyId={pharmacyId}
          />
        )}

        {showMouvementsModal && (
          <MouvementsView
            open={showMouvementsModal}
            onClose={() => {
              setShowMouvementsModal(false);
              setSelectedProduct(null);
            }}
            productId={selectedProduct ? String(selectedProduct.id) : undefined}
            productName={selectedProduct?.name}
            pharmacyId={pharmacyId}
          />
        )}

        {showRapportModal && (
          <RapportStockView
            open={showRapportModal}
            onClose={() => setShowRapportModal(false)}
            pharmacyId={pharmacyId}
          />
        )}

        {showStatDetail && (
          <StatCardDetail
            title={showStatDetail.title}
            type={showStatDetail.type}
            data={showStatDetail.data}
            onClose={() => setShowStatDetail(null)}
            pharmacyId={pharmacyId}
          />
        )}
      </div>
    </div>
  );
}