// modules/inventory/views/ApproView.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle, XCircle, Clock, Package, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { inventoryService } from '@/services/inventoryService';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { Product, RestockRequest } from '@/types/inventory.types';

interface ApproViewProps {
  pharmacyId?: string;
  branchId?: string;
}

interface RestockRequestItem extends RestockRequest {
  id?: string;
  status?: 'pending' | 'approved' | 'completed' | 'cancelled';
  requested_by?: string;
  requested_at?: string;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
}

export default function ApproView({ pharmacyId }: ApproViewProps) {
  const queryClient = useQueryClient();
  const { formatPrice } = usePharmacyConfig(pharmacyId);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [requestQuantity, setRequestQuantity] = useState(0);
  const [requestNotes, setRequestNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'completed' | 'cancelled'>('pending');
  const [selectedRequests, setSelectedRequests] = useState<string[]>([]);

  // Récupérer les produits avec stock faible
  const { data: lowStockProducts, isLoading: productsLoading } = useQuery({
    queryKey: ['low-stock-products', pharmacyId],
    queryFn: async () => {
      const response = await inventoryService.getProducts({
        pharmacy_id: pharmacyId,
        stock_status: 'low_stock',
        limit: 100,
      });
      return response.products;
    },
  });

  // Récupérer les suggestions de réapprovisionnement
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ['reorder-suggestions', pharmacyId],
    queryFn: () => inventoryService.getReorderSuggestions(30, pharmacyId),
  });

  // Récupérer les demandes d'approvisionnement (simulé - à connecter à l'API)
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['restock-requests', pharmacyId, activeTab],
    queryFn: async () => {
      // Simulation - à remplacer par un vrai appel API
      return [] as RestockRequestItem[];
    },
  });

  // Mutation pour créer une demande
  const createRequestMutation = useMutation({
    mutationFn: async (data: RestockRequest) => {
      return inventoryService.restockProduct(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
      setShowRequestForm(false);
      setSelectedProduct(null);
      setRequestQuantity(0);
      setRequestNotes('');
    },
  });

  // Mutation pour approuver une demande
  const approveRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      // Appel API à implémenter
      console.log('Approuver demande:', requestId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
    },
  });

  // Mutation pour annuler une demande
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      console.log('Annuler demande:', requestId);
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restock-requests'] });
    },
  });

  const handleCreateRequest = () => {
    if (selectedProduct && requestQuantity > 0) {
      createRequestMutation.mutate({
        product_id: selectedProduct.id,
        quantity: requestQuantity,
        notes: requestNotes,
      });
    }
  };

  const handleApproveRequest = (requestId: string) => {
    approveRequestMutation.mutate(requestId);
  };

  const handleCancelRequest = (requestId: string) => {
    cancelRequestMutation.mutate(requestId);
  };

  const handleApproveSelected = () => {
    selectedRequests.forEach(id => handleApproveRequest(id));
    setSelectedRequests([]);
  };

  const isLoading = productsLoading || suggestionsLoading || requestsLoading;

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
          <h2 className="text-xl font-bold text-slate-800">Gestion des approvisionnements</h2>
          <p className="text-sm text-slate-500">
            Gérez les réapprovisionnements et suivez les demandes
          </p>
        </div>
        <button
          onClick={() => setShowRequestForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark"
        >
          <Plus size={18} />
          Nouvelle demande
        </button>
      </div>

      {/* Suggestions automatiques */}
      {suggestions && suggestions.suggestions && suggestions.suggestions.length > 0 && (
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 text-blue-700 mb-3">
            <Truck size={18} />
            <h3 className="font-semibold">Suggestions de réapprovisionnement</h3>
          </div>
          <div className="space-y-2">
            {suggestions.suggestions.slice(0, 5).map((suggestion) => (
              <div key={suggestion.product_id} className="flex justify-between items-center p-2 bg-white rounded-lg">
                <div>
                  <p className="font-medium text-sm">{suggestion.product_name}</p>
                  <p className="text-xs text-slate-500">
                    Stock: {suggestion.current_stock} | Min: {suggestion.minimum_stock}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-medical">
                    Commande suggérée: {suggestion.suggested_order}
                  </p>
                  <button
                    onClick={() => {
                      const product = lowStockProducts?.find(p => p.id === suggestion.product_id);
                      if (product) {
                        setSelectedProduct(product);
                        setRequestQuantity(suggestion.suggested_order);
                        setShowRequestForm(true);
                      }
                    }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Utiliser
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Onglets des demandes */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { id: 'pending', label: 'En attente', icon: Clock, count: 0 },
          { id: 'approved', label: 'Approuvées', icon: CheckCircle, count: 0 },
          { id: 'completed', label: 'Reçues', icon: Package, count: 0 },
          { id: 'cancelled', label: 'Annulées', icon: XCircle, count: 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-medical border-b-2 border-medical'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            {tab.count > 0 && (
              <span className="bg-slate-100 text-slate-600 text-xs px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Actions groupées */}
      {activeTab === 'pending' && requests && requests.length > 0 && (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedRequests(requests.map(r => r.id as string));
                } else {
                  setSelectedRequests([]);
                }
              }}
              className="rounded"
            />
            <span className="text-sm text-slate-500">{selectedRequests.length} sélectionnée(s)</span>
          </div>
          <button
            onClick={handleApproveSelected}
            disabled={selectedRequests.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            <CheckCircle size={14} />
            Approuver la sélection
          </button>
        </div>
      )}

      {/* Liste des demandes */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {requests && requests.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {requests.map((request) => (
              <div key={request.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {activeTab === 'pending' && (
                      <input
                        type="checkbox"
                        checked={selectedRequests.includes(request.id as string)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRequests([...selectedRequests, request.id as string]);
                          } else {
                            setSelectedRequests(selectedRequests.filter(id => id !== request.id));
                          }
                        }}
                        className="mt-1 rounded"
                      />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Package size={16} className="text-slate-400" />
                        <h3 className="font-medium text-slate-800">{request.product_id}</h3>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-slate-500">
                        <span>Quantité: {request.quantity}</span>
                        {request.purchase_price && (
                          <span>Prix unitaire: {formatPrice(request.purchase_price)}</span>
                        )}
                        {request.expiry_date && (
                          <span>Exp: {format(new Date(request.expiry_date), 'dd/MM/yyyy', { locale: fr })}</span>
                        )}
                      </div>
                      {request.notes && (
                        <p className="text-sm text-slate-400 mt-1">{request.notes}</p>
                      )}
                      {request.requested_at && (
                        <p className="text-xs text-slate-400 mt-2">
                          Demandé le {format(new Date(request.requested_at), 'dd/MM/yyyy HH:mm', { locale: fr })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {activeTab === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApproveRequest(request.id as string)}
                          className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"
                          title="Approuver"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          onClick={() => handleCancelRequest(request.id as string)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                          title="Annuler"
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    )}
                    {activeTab === 'approved' && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        En attente de livraison
                      </span>
                    )}
                    {activeTab === 'completed' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                        Reçu
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400">
            <Package size={48} className="mx-auto mb-3 opacity-30" />
            <p>Aucune demande {activeTab === 'pending' ? 'en attente' : activeTab === 'approved' ? 'approuvée' : activeTab === 'completed' ? 'reçue' : 'annulée'}</p>
          </div>
        )}
      </div>

      {/* Modal de création de demande */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="border-b border-slate-200 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Nouvelle demande d'approvisionnement</h3>
              <button onClick={() => setShowRequestForm(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <XCircle size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Sélection du produit */}
              <div>
                <label className="text-sm font-medium text-slate-700">Produit</label>
                <select
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const product = lowStockProducts?.find(p => p.id === e.target.value);
                    setSelectedProduct(product || null);
                  }}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">Sélectionner un produit</option>
                  {lowStockProducts?.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} (Stock: {product.quantity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantité */}
              <div>
                <label className="text-sm font-medium text-slate-700">Quantité</label>
                <input
                  type="number"
                  value={requestQuantity}
                  onChange={(e) => setRequestQuantity(parseInt(e.target.value) || 0)}
                  min={1}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-slate-700">Notes</label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  rows={3}
                  className="w-full mt-1 px-3 py-2 border border-slate-200 rounded-lg"
                  placeholder="Informations supplémentaires..."
                />
              </div>

              {selectedProduct && (
                <div className="bg-slate-50 p-3 rounded-lg">
                  <p className="text-sm text-slate-600">
                    Stock actuel: <span className="font-medium">{selectedProduct.quantity}</span>
                  </p>
                  <p className="text-sm text-slate-600">
                    Seuil d'alerte: <span className="font-medium">{selectedProduct.alert_threshold}</span>
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 px-6 py-4 flex justify-end gap-2">
              <button onClick={() => setShowRequestForm(false)} className="px-4 py-2 border rounded-lg">
                Annuler
              </button>
              <button
                onClick={handleCreateRequest}
                disabled={!selectedProduct || requestQuantity <= 0}
                className="px-4 py-2 bg-medical text-white rounded-lg disabled:opacity-50"
              >
                Créer la demande
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}