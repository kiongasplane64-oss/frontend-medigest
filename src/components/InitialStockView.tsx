// components/InitialStockView.tsx
import { useState } from 'react';
import { inventoryService } from '@/services/inventoryService';
import type { ProductCreate } from '@/types/inventory.types';
import {
  X, Save, Loader2, Upload, Plus, Trash2,
  AlertCircle, Package
} from 'lucide-react';

interface InitialProduct {
  code?: string;
  name: string;
  quantity: number;
  purchase_price: number;
  selling_price?: number;
  expiry_date?: string;
  category?: string;
  supplier?: string;
}

interface InitialStockViewProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function InitialStockView({
  open,
  onClose,
  onSuccess
}: InitialStockViewProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<InitialProduct[]>([]);
  const [importMode, setImportMode] = useState<'manual' | 'file'>('manual');

  if (!open) return null;

  const generateCode = (): string => `PROD-${Math.floor(1000 + Math.random() * 9000)}`;

  const addProduct = (): void => {
    setProducts([
      ...products,
      {
        code: generateCode(),
        name: '',
        quantity: 0,
        purchase_price: 0,
        selling_price: 0,
        expiry_date: '',
        category: '',
        supplier: ''
      }
    ]);
  };

  const removeProduct = (index: number): void => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index: number, field: keyof InitialProduct, value: string | number): void => {
    const updated = [...products];
    updated[index] = { ...updated[index], [field]: value };
    setProducts(updated);
  };

  const handleSubmit = async (): Promise<void> => {
    if (products.length === 0) {
      setError("Ajoutez au moins un produit");
      return;
    }

    const invalidProducts = products.filter(p => !p.name || p.quantity <= 0 || p.purchase_price <= 0);
    if (invalidProducts.length > 0) {
      setError("Veuillez remplir tous les champs obligatoires (nom, quantité, prix achat)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      for (const product of products) {
        // Préparation des données au format ProductCreate
        const productData: ProductCreate = {
          code: product.code || generateCode(), // Code obligatoire, on génère si absent
          name: product.name,
          quantity: product.quantity,
          purchase_price: product.purchase_price,
          selling_price: product.selling_price || Math.round(product.purchase_price * 1.3 * 100) / 100,
          alert_threshold: 10,
          description: 'Stock initial',
          expiry_date: product.expiry_date || undefined,
          category: product.category || undefined,
          supplier: product.supplier || undefined
        };

        await inventoryService.createProduct(productData);
      }
      
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError("Erreur lors de l'enregistrement du stock initial");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const result = await inventoryService.importProducts(file, 'add');
      alert(result.message);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError("Erreur lors de l'import");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = async (): Promise<void> => {
    try {
      const blob = await inventoryService.getImportTemplate();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modele_import_produits.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError("Erreur lors du téléchargement du modèle");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <Package className="text-blue-500" size={20} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase italic text-slate-900">
                  Stock Initial
                </h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  PREMIER INVENTAIRE
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-100">
          <div className="flex p-2 gap-2">
            <button
              onClick={() => setImportMode('manual')}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-colors
                ${importMode === 'manual' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Saisie manuelle
            </button>
            <button
              onClick={() => setImportMode('file')}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm transition-colors
                ${importMode === 'file' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              Import fichier
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={18} />
              {error}
            </div>
          )}

          {importMode === 'file' ? (
            <div className="space-y-6">
              <div className="bg-slate-50 p-6 rounded-xl text-center">
                <Upload className="mx-auto text-blue-500 mb-3" size={32} />
                <h3 className="font-bold text-lg mb-2">Importer un fichier Excel</h3>
                <p className="text-sm text-slate-500 mb-4">
                  Format accepté: .xlsx, .xls (max 5Mo)
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={downloadTemplate}
                    className="px-6 py-3 bg-slate-200 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                  >
                    Télécharger le modèle
                  </button>
                  <label className="px-6 py-3 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors cursor-pointer">
                    Choisir un fichier
                    <input
                      type="file"
                      hidden
                      accept=".xlsx,.xls"
                      onChange={handleFileImport}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700">
                <p className="font-bold mb-1">📋 Instructions :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Téléchargez le modèle Excel</li>
                  <li>Remplissez vos produits (lignes 2 à 1000)</li>
                  <li>Les champs obligatoires : nom, quantité, prix achat</li>
                  <li>Importez le fichier complété</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add button */}
              <button
                onClick={addProduct}
                className="w-full sm:w-auto bg-blue-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                Ajouter un produit
              </button>

              {/* Products list */}
              {products.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl">
                  <Package className="mx-auto text-slate-300 mb-3" size={32} />
                  <p className="text-slate-400 font-bold">
                    Aucun produit ajouté
                  </p>
                  <p className="text-sm text-slate-300 mt-1">
                    Cliquez sur "Ajouter un produit" pour commencer
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {products.map((product, index) => (
                    <div key={index} className="bg-slate-50 p-4 rounded-xl">
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-bold text-slate-700">
                          Produit #{index + 1}
                        </h3>
                        <button
                          onClick={() => removeProduct(index)}
                          className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <input
                          type="text"
                          placeholder="Code"
                          value={product.code || ''}
                          onChange={(e) => updateProduct(index, 'code', e.target.value)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Désignation *"
                          required
                          value={product.name}
                          onChange={(e) => updateProduct(index, 'name', e.target.value)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Catégorie"
                          value={product.category || ''}
                          onChange={(e) => updateProduct(index, 'category', e.target.value)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Quantité *"
                          min="0"
                          value={product.quantity}
                          onChange={(e) => updateProduct(index, 'quantity', parseInt(e.target.value) || 0)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Prix achat *"
                          min="0"
                          step="0.01"
                          value={product.purchase_price}
                          onChange={(e) => updateProduct(index, 'purchase_price', parseFloat(e.target.value) || 0)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="number"
                          placeholder="Prix vente"
                          min="0"
                          step="0.01"
                          value={product.selling_price || ''}
                          onChange={(e) => updateProduct(index, 'selling_price', parseFloat(e.target.value) || 0)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          placeholder="Fournisseur"
                          value={product.supplier || ''}
                          onChange={(e) => updateProduct(index, 'supplier', e.target.value)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="date"
                          placeholder="Péremption"
                          value={product.expiry_date || ''}
                          onChange={(e) => updateProduct(index, 'expiry_date', e.target.value)}
                          className="w-full p-3 bg-white rounded-lg font-bold text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  ))}

                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="w-full bg-green-500 text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-green-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Enregistrement...
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        Valider le stock initial
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}