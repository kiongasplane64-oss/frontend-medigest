// store/saleStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { saleService, type SaleResponse, type SaleCreate } from '@/services/saleService';
import { type PaymentMethod } from '@/services/posService';

export interface LocalSaleItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  code?: string;
  product_code?: string;
  product_name?: string;
  productId?: string;
  discount?: number;
  discount_percent?: number;
  batch_number?: string;
  expiry_date?: string;
  /** Catégorie du produit (nom) - utilisé pour le filtrage */
  category?: string;
  /** ID de la catégorie du produit */
  categoryId?: string;
}
export interface LocalSale {
  id: string;
  tempId?: string;
  receiptNumber?: string;
  items: LocalSaleItem[];
  total: number;
  paymentMethod: PaymentMethod;
  timestamp: number;
  cashierName?: string;
  cashierId?: string;
  posName?: string;
  branchId?: string;
  branchName?: string;
  sessionNumber?: string;
  customerName?: string;
  status: 'pending' | 'completed' | 'cancelled';
  synced: boolean;
  syncing?: boolean;
  retryCount?: number;
  lastSyncError?: string;
  pharmacy_id?: string;
}

interface SaleStore {
  sales: SaleResponse[];
  localSales: LocalSale[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  maxRetries: number;
  syncInProgress: boolean;
  lastSyncAttempt: number | null;
  
  fetchSales: () => Promise<void>;
  addLocalSale: (sale: Omit<LocalSale, 'synced' | 'retryCount' | 'lastSyncError'>) => string;
  addSaleFromApi: (sale: SaleResponse, localId?: string) => void;
  updateLocalSaleStatus: (id: string, status: 'pending' | 'completed' | 'cancelled') => void;
  syncPendingSales: () => Promise<void>;
  clearError: () => void;
  getSaleById: (id: string) => SaleResponse | LocalSale | undefined;
  getSalesWithLocal: () => Array<SaleResponse | LocalSale>;
  getPendingCount: () => number;
  resetFailedSales: () => void;
}

export const useSaleStore = create<SaleStore>()(
  persist(
    (set, get) => ({
      sales: [],
      localSales: [],
      loading: false,
      syncing: false,
      error: null,
      maxRetries: 3,
      syncInProgress: false,
      lastSyncAttempt: null,

      // ============================================
      // RÉCUPÉRATION DES VENTES AVEC ITEMS
      // ============================================
      fetchSales: async () => {
        set({ loading: true, error: null });
        try {
          const response = await saleService.getSales({
            limit: 500,
          });
          
          // Log pour déboguer
          console.log('📦 Ventes récupérées:', response.items?.length || 0);
          if (response.items && response.items.length > 0) {
            const firstSale = response.items[0];
            console.log('📋 Première vente:', {
              id: firstSale.id,
              itemsCount: firstSale.items?.length || 0,
              hasItems: !!firstSale.items,
              items: firstSale.items
            });
            
            // Vérifier que chaque vente a ses items
            const salesWithItems = response.items.map(sale => ({
              ...sale,
              items: sale.items || []
            }));
            
            set({ sales: salesWithItems });
          } else {
            set({ sales: [] });
          }
        } catch (error) {
          console.error('Erreur chargement ventes:', error);
          set({ error: 'Impossible de charger les ventes' });
        } finally {
          set({ loading: false });
        }
      },

      // ============================================
      // AJOUT D'UNE VENTE LOCALE
      // ============================================
      addLocalSale: (sale) => {
        const id = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Ajouter les propriétés de compatibilité à chaque item
        const itemsWithCompat = sale.items.map(item => ({
          ...item,
          product_code: item.product_code || item.code,
          product_name: item.product_name || item.name,
          productId: item.productId || item.id,
        }));
        
        const newSale: LocalSale = {
          ...sale,
          items: itemsWithCompat,
          id,
          synced: false,
          retryCount: 0,
          status: sale.status || 'completed',
        };
        
        set((state) => ({
          localSales: [newSale, ...state.localSales],
        }));
        
        // Déclencher synchronisation après un délai
        setTimeout(() => {
          get().syncPendingSales();
        }, 500);
        
        return id;
      },

      // ============================================
      // AJOUT D'UNE VENTE DEPUIS L'API AVEC SES ITEMS
      // ============================================
      addSaleFromApi: (sale, localId) => {
        console.log('➕ Ajout vente au store:', {
          id: sale.id,
          itemsCount: sale.items?.length || 0,
          items: sale.items
        });
        
        set((state) => {
          // Vérifier si la vente existe déjà
          const saleExists = state.sales.some(s => s.id === sale.id);
          
          // S'assurer que les items sont présents
          const saleWithItems = {
            ...sale,
            items: sale.items || []
          };
          
          let newLocalSales = state.localSales;
          if (localId) {
            newLocalSales = state.localSales.filter(local => local.id !== localId);
          }
          
          if (saleExists) {
            // Mettre à jour la vente existante avec les items
            return {
              sales: state.sales.map(s => 
                s.id === sale.id ? { ...s, items: saleWithItems.items } : s
              ),
              localSales: newLocalSales,
            };
          }
          
          // Ajouter la nouvelle vente au début du tableau
          return {
            sales: [saleWithItems, ...state.sales],
            localSales: newLocalSales,
          };
        });
      },

      updateLocalSaleStatus: (id, status) => {
        set((state) => ({
          localSales: state.localSales.map((sale) =>
            sale.id === id ? { ...sale, status } : sale
          ),
        }));
      },

      // ============================================
      // SYNCHRONISATION DES VENTES PENDING
      // ============================================
      syncPendingSales: async () => {
        const { syncInProgress, localSales, maxRetries } = get();
        
        if (syncInProgress) {
          console.log('🔄 Synchronisation déjà en cours');
          return;
        }
        
        const pendingSales = localSales.filter(
          (sale) => !sale.synced && !sale.syncing && (sale.retryCount || 0) < maxRetries
        );
        
        if (pendingSales.length === 0) {
          console.log('✅ Aucune vente en attente de synchronisation');
          return;
        }
        
        console.log(`🔄 Synchronisation de ${pendingSales.length} vente(s)...`);
        set({ syncInProgress: true, syncing: true });
        
        for (const pendingSale of pendingSales) {
          set((state) => ({
            localSales: state.localSales.map((sale) =>
              sale.id === pendingSale.id ? { ...sale, syncing: true } : sale
            ),
          }));
          
          try {
            const saleData: SaleCreate = {
              items: pendingSale.items.map(item => ({
                product_id: item.productId || item.id,
                quantity: item.quantity,
                discount_percent: item.discount_percent || 0,
                product_code: item.product_code || item.code,
              })),
              payment_method: pendingSale.paymentMethod,
              customer_name: pendingSale.customerName || 'Passager',
              pharmacy_id: pendingSale.pharmacy_id || pendingSale.branchId,
            };
            
            const response = await saleService.createSale(saleData);
            
            let createdSale: SaleResponse | null = null;
            if (response?.sale) {
              createdSale = response.sale;
            } else if (response?.data && 'id' in response.data) {
              createdSale = response.data as SaleResponse;
            }
            
            if (createdSale) {
              console.log(`✅ Vente ${pendingSale.id} synchronisée avec succès`);
              get().addSaleFromApi(createdSale, pendingSale.id);
            } else {
              set((state) => ({
                localSales: state.localSales.map((sale) =>
                  sale.id === pendingSale.id ? { ...sale, synced: true, syncing: false } : sale
                ),
              }));
            }
          } catch (error: any) {
            const newRetryCount = (pendingSale.retryCount || 0) + 1;
            console.error(`❌ Erreur synchronisation vente ${pendingSale.id}:`, error.message);
            set((state) => ({
              localSales: state.localSales.map((sale) =>
                sale.id === pendingSale.id
                  ? {
                      ...sale,
                      syncing: false,
                      retryCount: newRetryCount,
                      lastSyncError: error.message,
                    }
                  : sale
              ),
            }));
          }
        }
        
        set({ syncInProgress: false, syncing: false });
        console.log('🔄 Synchronisation terminée');
      },

      clearError: () => set({ error: null }),
      
      resetFailedSales: () => {
        console.log('🔄 Réinitialisation des ventes échouées');
        set((state) => ({
          localSales: state.localSales.map((sale) =>
            !sale.synced && (sale.retryCount || 0) >= state.maxRetries
              ? { ...sale, retryCount: 0, syncing: false, lastSyncError: undefined }
              : sale
          ),
        }));
        
        setTimeout(() => {
          get().syncPendingSales();
        }, 100);
      },

      getSaleById: (id) => {
        const { sales, localSales } = get();
        const apiSale = sales.find((s) => s.id === id);
        if (apiSale) return apiSale;
        return localSales.find((s) => s.id === id);
      },

      getSalesWithLocal: () => {
        const { sales, localSales } = get();
        const unsyncedLocal = localSales.filter((local) => !local.synced);
        return [...unsyncedLocal, ...sales];
      },

      getPendingCount: () => {
        const { localSales, maxRetries } = get();
        return localSales.filter(
          (sale) => !sale.synced && (sale.retryCount || 0) < maxRetries
        ).length;
      },
    }),
    {
      name: 'sale-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        localSales: state.localSales.map(sale => ({
          ...sale,
          syncing: false,
        })),
      }),
    }
  )
);