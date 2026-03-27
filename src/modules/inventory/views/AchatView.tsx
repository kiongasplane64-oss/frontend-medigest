// modules/inventory/views/AchatView.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, XCircle, Package, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { inventoryService } from '@/services/inventoryService';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { Product } from '@/types/inventory.types';

interface AchatViewProps {
  pharmacyId?: string;
  branchId?: string;
}

interface PurchaseItem {
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  expiry_date?: string;
  batch_number?: string;
}

interface Purchase {
  id: string;
  supplier: string;
  invoice_number: string;
  purchase_date: string;
  total_amount: number;
  items: PurchaseItem[];
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  created_at: string;
  created_by: string;
}

export default function AchatView({ pharmacyId }: AchatViewProps) {
  const queryClient = useQueryClient();
  const { formatPrice } = usePharmacyConfig(pharmacyId);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<PurchaseItem[]>([]);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productQuantity, setProductQuantity] = useState(1);
  const [productUnitPrice, setProductUnitPrice] = useState(0);
  const [selectedProductForAdd, setSelectedProductForAdd] = useState<Product | null>(null);

  // Récupérer les achats (simulé)
  const { data: purchases, isLoading: purchasesLoading } = useQuery({
    queryKey: ['purchases', pharmacyId],
    queryFn: async () => {
      // Simulation - à remplacer par un vrai appel API
      return [] as Purchase[];
    },
  });

  // Récupérer les produits pour la recherche
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products-for-purchase', productSearch, pharmacyId],
    queryFn: async () => {
      if (productSearch.length < 2) return [];
      const response = await inventoryService.getProducts({
        search: productSearch,
        pharmacy_id: pharmacyId,
        limit: 20,
      });
      return response.products;
    },
    enabled: productSearch.length >= 2,
  });

  // Mutation pour créer un achat
  const createPurchaseMutation = useMutation({
    mutationFn: async (data: Omit<Purchase, 'id' | 'created_at' | 'created_by'>) => {
      // Appel API à implémenter
      console.log('Créer achat:', data);
      return { success: true, id: 'new-id' };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setShowPurchaseForm(false);
      setSelectedProducts([]);
      setSupplier('');
      setInvoiceNumber('');
      setNotes('');
    },
  });

  const handleAddProductToPurchase = () => {
    if (selectedProductForAdd && productQuantity > 0 && productUnitPrice > 0) {
      const newItem: PurchaseItem = {
        product_id: selectedProductForAdd.id,
        product_name: selectedProductForAdd.name,
        product_code: selectedProductForAdd.code || '',
        quantity: productQuantity,
        unit_price: productUnitPrice,
        total_price: productQuantity * productUnitPrice,
        expiry_date: '',
        batch_number: '',
      };
      setSelectedProducts([...selectedProducts, newItem]);
      setSelectedProductForAdd(null);
      setProductSearch('');
      setProductQuantity(1);
      setProductUnitPrice(0);
    }
  };

  const handleRemoveProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleUpdateProductQuantity = (index: number, quantity: number) => {
    const updated = [...selectedProducts];
    updated[index].quantity = quantity;
    updated[index].total_price = quantity * updated[index].unit_price;
    setSelectedProducts(updated);
  };

  const handleUpdateProductPrice = (index: number, price: number) => {
    const updated = [...selectedProducts];
    updated[index].unit_price = price;
    updated[index].total_price = updated[index].quantity * price;
    setSelectedProducts(updated);
  };

  const handleSubmitPurchase = () => {
    if (selectedProducts.length === 0) {
      alert('Ajoutez au moins un produit');
      return;
    }

    const totalAmount = selectedProducts.reduce((sum, item) => sum + item.total_price, 0);

    createPurchaseMutation.mutate({
      supplier,
      invoice_number: invoiceNumber,
      purchase_date: purchaseDate,
      total_amount: totalAmount,
      items: selectedProducts,
      status: 'completed',
      notes,
    });
  };

  const totalAmount = selectedProducts.reduce((sum, item) => sum + item.total_price, 0);

  const filteredProducts = products?.filter(p =>
    !selectedProducts.some(sp => sp.product_id === p.id)
  );

  if (purchasesLoading || productsLoading) {
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
          <h2 className="text-xl font-bold text-slate-800">Gestion des achats</h2>
          <p className="text-sm text-slate-500">
            Enregistrez vos achats de produits et suivez les factures
          </p>
        </div>
        <button
          onClick={() => setShowPurchaseForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark"
        >
          <Plus size={18} />
          Nouvel achat
        </button>
      </div>

      {/* Liste des achats récents */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="font-semibold text-slate-700">Achats récents</h3>
        </div>
        {purchases && purchases.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {purchases.map((purchase) => (
              <div key={purchase.id} className="p-4 hover:bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <Receipt size={16} className="text-slate-400" />
                      <span className="font-medium">Facture #{purchase.invoice_number}</span>
                      <span className="text-sm text-slate-500">- {purchase.supplier}</span>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                      <span>Date: {format(new Date(purchase.purchase_date), 'dd/MM/yyyy', { locale: fr })}</span>
                      <span>Total: {formatPrice(purchase.total_amount)}</span>
                      <span>{purchase.items.length} produit(s)</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {purchase.status === 'completed' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">Complété</span>
                    )}
                    {purchase.status === 'pending' && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">En attente</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p>Aucun achat enregistré</p>
            <button
              onClick={() => setShowPurchaseForm(true)}
              className="mt-2 text-medical hover:underline"
            >
              Créer un premier achat
            </button>
          </div>
        )}
      </div>

      {/* Modal de création d'achat */}
      {showPurchaseForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Nouvel achat</h3>
              <button onClick={() => setShowPurchaseForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <XCircle size={18} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informations générales */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">Fournisseur *</label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                    placeholder="Nom du fournisseur"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Numéro de facture *</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                    placeholder="FACT-2024-001"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Date d'achat</label>
                  <input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Ajout de produits */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="font-medium text-slate-700 mb-3">Ajouter des produits</h4>
                <div className="flex flex-wrap gap-2 mb-4 relative">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      placeholder="Rechercher un produit..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                    />
                    {productSearch.length >= 2 && filteredProducts && filteredProducts.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => setSelectedProductForAdd(product)}
                            className="w-full text-left px-3 py-2 hover:bg-slate-50"
                          >
                            <div className="font-medium">{product.name}</div>
                            <div className="text-xs text-slate-500">{product.code}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="number"
                    placeholder="Qté"
                    value={productQuantity}
                    onChange={(e) => setProductQuantity(parseInt(e.target.value) || 0)}
                    className="w-24 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Prix unitaire"
                    value={productUnitPrice}
                    onChange={(e) => setProductUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-32 px-3 py-2 border border-slate-200 rounded-lg"
                  />
                  <button
                    onClick={handleAddProductToPurchase}
                    disabled={!selectedProductForAdd || productQuantity <= 0 || productUnitPrice <= 0}
                    className="px-4 py-2 bg-medical text-white rounded-lg disabled:opacity-50"
                  >
                    Ajouter
                  </button>
                </div>

                {/* Liste des produits ajoutés */}
                {selectedProducts.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500">Produit</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Qté</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Prix unitaire</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500">Total</th>
                          <th className="px-3 py-2 text-center text-xs font-medium text-slate-500"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProducts.map((item, idx) => (
                          <tr key={idx} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <div className="font-medium text-sm">{item.product_name}</div>
                              <div className="text-xs text-slate-400">{item.product_code}</div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateProductQuantity(idx, parseInt(e.target.value) || 0)}
                                className="w-20 px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => handleUpdateProductPrice(idx, parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {formatPrice(item.total_price)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => handleRemoveProduct(idx)}
                                className="p-1 text-red-400 hover:text-red-600"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t">
                        <tr>
                          <td colSpan={3} className="px-3 py-2 text-right font-medium">Total</td>
                          <td className="px-3 py-2 text-right font-bold text-medical">
                            {formatPrice(totalAmount)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Informations supplémentaires..."
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setShowPurchaseForm(false)}
                  className="px-4 py-2 border rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmitPurchase}
                  disabled={selectedProducts.length === 0 || !supplier || !invoiceNumber}
                  className="px-4 py-2 bg-medical text-white rounded-lg disabled:opacity-50"
                >
                  Enregistrer l'achat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}