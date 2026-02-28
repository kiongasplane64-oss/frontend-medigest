import api from '@/api/client';

export interface ProductStock {
  id: string;
  name: string;
  code: string;
  category: string;
  quantity: number;
  purchase_price: number;
  alert_threshold: number;
  selling_price: number;
  expiry_date: string;
  has_tva?: boolean;
  tva_rate?: number;
}

// Récupérer l'inventaire
export const getInventory = async (): Promise<ProductStock[]> => {
  const { data } = await api.get('/stock/');
  return data?.products || [];
};

// Ajouter un nouveau produit
export const createProduct = async (data: Omit<ProductStock, 'id'>) => {
  // On s'assure d'envoyer les valeurs par défaut si elles ne sont pas saisies
  const payload = {
    ...data,
    has_tva: data.has_tva ?? true,
    tva_rate: data.tva_rate ?? 16 // Ou 0 si has_tva est false
  };
  const response = await api.post('/stock/', payload);
  return response.data;
};

// Modifier un produit existant (Patch)
export const updateProduct = async (id: string, data: Partial<ProductStock>) => {
  const response = await api.patch(`/stock/${id}`, data);
  return response.data;
};

// Supprimer un produit
export const deleteProduct = async (id: string) => {
  const response = await api.delete(`/stock/${id}`);
  return response.data;
};

// Réapprovisionnement (Logique métier : ajoute à la quantité existante)
export const restockProduct = async (id: string, additionalQuantity: number) => {
  const response = await api.post(`/stock/${id}/restock`, { quantity: additionalQuantity });
  return response.data;
};

export interface StockMovement {
  id: string;
  product_id: string;
  type: 'in' | 'out';
  quantity: number;
  created_at: string;
  user_id?: string;
  reference?: string;
  notes?: string;
  
}

// Récupérer l'historique d'un produit
export const getProductHistory = async (productId: string): Promise<StockMovement[]> => {
  const { data } = await api.get(`/stock/${productId}/history`);
  return data?.movements || [];
};