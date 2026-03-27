// modules/inventory/views/InitialStockView.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit2, Save, X, Package, Upload, Download } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { inventoryService } from '@/services/inventoryService';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { Product, ProductCreate, Category } from '@/types/inventory.types';

interface InitialStockViewProps {
  pharmacyId?: string;
  branchId?: string;
}

interface InitialStockItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  expiry_date?: string;
  batch_number?: string;
  location?: string;
}

// Helper function pour afficher la catégorie
const getCategoryName = (category: string | Category | undefined): string => {
  if (!category) return '-';
  if (typeof category === 'string') return category;
  return category.name || '-';
};

export default function InitialStockView({ pharmacyId, branchId }: InitialStockViewProps) {
  const queryClient = useQueryClient();
  const { formatPrice } = usePharmacyConfig(pharmacyId);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InitialStockItem>>({});
  const [newItem, setNewItem] = useState<Partial<InitialStockItem>>({
    quantity: 0,
    purchase_price: 0,
    selling_price: 0,
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<InitialStockItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Récupérer les produits sans stock initial ou avec stock nul
  const { data: products, isLoading } = useQuery({
    queryKey: ['initial-stock-products', pharmacyId, branchId],
    queryFn: async () => {
      const response = await inventoryService.getProducts({
        pharmacy_id: pharmacyId,
        branch_id: branchId,
        limit: 1000,
      });
      // Filtrer les produits sans stock ou avec stock initial
      return response.products.filter(p => p.quantity === 0 || p.quantity === null);
    },
  });

  // Mutation pour ajouter du stock initial
  const addInitialStockMutation = useMutation({
    mutationFn: async (item: InitialStockItem) => {
      const productData: ProductCreate = {
        name: item.product_name,
        code: item.product_code,
        quantity: item.quantity,
        purchase_price: item.purchase_price,
        selling_price: item.selling_price,
        expiry_date: item.expiry_date,
        batch_number: item.batch_number,
        location: item.location,
        pharmacy_id: pharmacyId,
        branch_id: branchId,
        is_active: true,
      };
      return inventoryService.createProduct(productData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initial-stock-products'] });
      setShowAddForm(false);
      setNewItem({
        quantity: 0,
        purchase_price: 0,
        selling_price: 0,
      });
    },
  });

  // Mutation pour mettre à jour le stock initial
  const updateInitialStockMutation = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      return inventoryService.updateProduct(id, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initial-stock-products'] });
      setEditingItem(null);
    },
  });

  // Mutation pour importer le stock initial
  const importStockMutation = useMutation({
    mutationFn: async (items: InitialStockItem[]) => {
      const promises = items.map(item => {
        const productData: ProductCreate = {
          name: item.product_name,
          code: item.product_code,
          quantity: item.quantity,
          purchase_price: item.purchase_price,
          selling_price: item.selling_price,
          expiry_date: item.expiry_date,
          batch_number: item.batch_number,
          location: item.location,
          pharmacy_id: pharmacyId,
          branch_id: branchId,
          is_active: true,
        };
        return inventoryService.createProduct(productData);
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['initial-stock-products'] });
      setShowImportModal(false);
      setImportPreview([]);
      setIsImporting(false);
    },
  });

  const handleAddItem = () => {
    if (newItem.product_name && newItem.quantity && newItem.purchase_price && newItem.selling_price) {
      addInitialStockMutation.mutate(newItem as InitialStockItem);
    }
  };

  const handleEditItem = (product: Product) => {
    setEditingItem(product.id);
    setEditForm({
      quantity: product.quantity,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      expiry_date: product.expiry_date?.split('T')[0],
      batch_number: product.batch_number,
      location: product.location,
    });
  };

  const handleSaveEdit = (productId: string) => {
    if (editForm.quantity !== undefined) {
      updateInitialStockMutation.mutate({ id: productId, quantity: editForm.quantity });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Simuler la lecture du fichier et l'aperçu
      // Dans un vrai projet, utilisez xlsx ou csv-parse
      const previewItems: InitialStockItem[] = [
        {
          product_id: '1',
          product_name: 'Paracétamol 500mg',
          product_code: 'PARA001',
          quantity: 100,
          purchase_price: 2.5,
          selling_price: 5.0,
          expiry_date: '2025-12-31',
          batch_number: 'LOT001',
          location: 'A1',
        },
      ];
      setImportPreview(previewItems);
    }
  };

  const handleConfirmImport = () => {
    if (importPreview.length > 0) {
      setIsImporting(true);
      importStockMutation.mutate(importPreview);
    }
  };

  const handleExportTemplate = () => {
    const template = [
      ['Nom du produit', 'Code', 'Quantité', "Prix d'achat", 'Prix de vente', 'Date expiration', 'Lot', 'Emplacement'],
      ['Paracétamol 500mg', 'PARA001', 100, 2.5, 5.0, '2025-12-31', 'LOT001', 'A1'],
    ];
    const csvContent = template.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_stock_initial.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Stock Initial</h2>
          <p className="text-sm text-slate-500">
            Saisissez le stock initial des produits avant la première vente
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark"
          >
            <Plus size={18} />
            Ajouter manuellement
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Upload size={18} />
            Importer
          </button>
          <button
            onClick={handleExportTemplate}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download size={18} />
            Template
          </button>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Rechercher un produit..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-medical"
        />
      </div>

      {/* Tableau des produits */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Produit</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Code</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Quantité initiale</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Prix d'achat</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Prix de vente</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Lot / Expiration</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts?.map((product) => (
              <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{product.name}</div>
                  <div className="text-xs text-slate-400">{getCategoryName(product.category)}</div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{product.code || '-'}</td>
                <td className="px-4 py-3 text-right">
                  {editingItem === product.id ? (
                    <input
                      type="number"
                      value={editForm.quantity || 0}
                      onChange={(e) => setEditForm({ ...editForm, quantity: parseInt(e.target.value) || 0 })}
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-right"
                    />
                  ) : (
                    <span className={product.quantity === 0 ? 'text-amber-500 font-medium' : ''}>
                      {product.quantity}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingItem === product.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.purchase_price || 0}
                      onChange={(e) => setEditForm({ ...editForm, purchase_price: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-right"
                    />
                  ) : (
                    formatPrice(product.purchase_price)
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingItem === product.id ? (
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.selling_price || 0}
                      onChange={(e) => setEditForm({ ...editForm, selling_price: parseFloat(e.target.value) || 0 })}
                      className="w-24 px-2 py-1 border border-slate-200 rounded text-right"
                    />
                  ) : (
                    formatPrice(product.selling_price)
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingItem === product.id ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="Lot"
                        value={editForm.batch_number || ''}
                        onChange={(e) => setEditForm({ ...editForm, batch_number: e.target.value })}
                        className="w-24 px-2 py-1 border border-slate-200 rounded text-sm"
                      />
                      <input
                        type="date"
                        value={editForm.expiry_date || ''}
                        onChange={(e) => setEditForm({ ...editForm, expiry_date: e.target.value })}
                        className="w-24 px-2 py-1 border border-slate-200 rounded text-sm"
                      />
                    </div>
                  ) : (
                    <div className="text-sm">
                      {product.batch_number && (
                        <div className="text-slate-600">Lot: {product.batch_number}</div>
                      )}
                      {product.expiry_date && (
                        <div className="text-xs text-slate-400">
                          Exp: {format(new Date(product.expiry_date), 'dd/MM/yyyy', { locale: fr })}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {editingItem === product.id ? (
                    <button
                      onClick={() => handleSaveEdit(product.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <Save size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditItem(product)}
                      className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"
                    >
                      <Edit2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredProducts?.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p>Aucun produit trouvé</p>
            <p className="text-sm">Tous les produits ont déjà un stock initial</p>
          </div>
        )}
      </div>

      {/* Modal d'ajout manuel */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Ajouter un produit</h3>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Nom du produit *</label>
                <input
                  type="text"
                  value={newItem.product_name || ''}
                  onChange={(e) => setNewItem({ ...newItem, product_name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Code</label>
                <input
                  type="text"
                  value={newItem.product_code || ''}
                  onChange={(e) => setNewItem({ ...newItem, product_code: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Quantité *</label>
                  <input
                    type="number"
                    value={newItem.quantity || 0}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Prix d'achat *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.purchase_price || 0}
                    onChange={(e) => setNewItem({ ...newItem, purchase_price: parseFloat(e.target.value) || 0 })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Prix de vente *</label>
                <input
                  type="number"
                  step="0.01"
                  value={newItem.selling_price || 0}
                  onChange={(e) => setNewItem({ ...newItem, selling_price: parseFloat(e.target.value) || 0 })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Numéro de lot</label>
                  <input
                    type="text"
                    value={newItem.batch_number || ''}
                    onChange={(e) => setNewItem({ ...newItem, batch_number: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Date expiration</label>
                  <input
                    type="date"
                    value={newItem.expiry_date || ''}
                    onChange={(e) => setNewItem({ ...newItem, expiry_date: e.target.value })}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Emplacement</label>
                <input
                  type="text"
                  value={newItem.location || ''}
                  onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
              <button onClick={handleAddItem} className="px-4 py-2 bg-medical text-white rounded-lg">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'import */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Importer le stock initial</h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-700">
                  📁 Format attendu: CSV ou Excel avec les colonnes:
                  Nom du produit, Code, Quantité, Prix d'achat, Prix de vente, Date expiration, Lot, Emplacement
                </p>
                <button onClick={handleExportTemplate} className="mt-2 text-sm text-blue-600 underline">
                  Télécharger le template
                </button>
              </div>

              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="w-full"
              />

              {importPreview.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Aperçu ({importPreview.length} produits)</h4>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Nom</th>
                          <th className="px-3 py-2 text-left">Code</th>
                          <th className="px-3 py-2 text-right">Qté</th>
                          <th className="px-3 py-2 text-right">Prix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{item.product_name}</td>
                            <td className="px-3 py-2">{item.product_code}</td>
                            <td className="px-3 py-2 text-right">{item.quantity}</td>
                            <td className="px-3 py-2 text-right">{formatPrice(item.selling_price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowImportModal(false)} className="px-4 py-2 border rounded-lg">Annuler</button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importPreview.length === 0 || isImporting}
                  className="px-4 py-2 bg-medical text-white rounded-lg disabled:opacity-50"
                >
                  {isImporting ? 'Import...' : "Confirmer l'import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}