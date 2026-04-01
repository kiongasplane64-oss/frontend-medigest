// stores/saleStore.ts - Version corrigée
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
  posName?: string;
  sessionNumber?: string;
  clientName?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  synced: boolean;
  syncing?: boolean;
  retryCount?: number;
  lastSyncError?: string;
}

interface SaleStore {
  sales: SaleResponse[];
  localSales: LocalSale[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
  maxRetries: number;
  syncInProgress: boolean; // Nouveau flag pour éviter les synchronisations concurrentes
  
  fetchSales: () => Promise<void>;
  addLocalSale: (sale: LocalSale) => void;
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

      fetchSales: async () => {
        set({ loading: true, error: null });
        try {
          // Correction: enlever le slash final
          const response = await saleService.getSales({
            limit: 1000,
            sort_by: 'created_at',
            sort_order: 'desc',
          });
          set({ sales: response.items || [] });
        } catch (error) {
          console.error('Erreur chargement ventes:', error);
          set({ error: 'Impossible de charger les ventes' });
        } finally {
          set({ loading: false });
        }
      },

      addLocalSale: (sale) => {
        const newSale = {
          ...sale,
          synced: false,
          syncing: false,
          retryCount: 0,
          lastSyncError: undefined,
        };
        
        set((state) => ({
          localSales: [newSale, ...state.localSales],
        }));
        
        // Déclencher la synchronisation après un court délai
        setTimeout(() => {
          get().syncPendingSales();
        }, 100);
      },

      // Version corrigée avec vérification des doublons
      addSaleFromApi: (sale, localId) => {
        set((state) => {
          // Vérifier si la vente existe déjà dans sales
          const saleExists = state.sales.some(s => s.id === sale.id);
          if (saleExists) {
            console.warn(`⚠️ Vente ${sale.id} déjà présente, ignorée`);
            return state;
          }
          
          return {
            sales: [sale, ...state.sales],
            localSales: state.localSales.filter(
              (local) => {
                // Ne pas supprimer si c'est une autre vente
                if (localId) {
                  return local.id !== localId;
                }
                // Sinon, supprimer si correspond par ID ou numéro
                return local.id !== sale.id && 
                       local.receiptNumber !== sale.receipt_number && 
                       local.tempId !== sale.id;
              }
            ),
          };
        });
        
        console.log('✅ Vente ajoutée au store API:', sale.reference || sale.id);
      },

      updateLocalSaleStatus: (id, status) => {
        set((state) => ({
          localSales: state.localSales.map((sale) =>
            sale.id === id ? { ...sale, status } : sale
          ),
        }));
      },

      // Version corrigée avec flag d'exclusion mutuelle
      syncPendingSales: async () => {
        const { syncInProgress, localSales, maxRetries } = get();
        
        if (syncInProgress) {
          console.log('🔄 Synchronisation déjà en cours, ignorée');
          return;
        }
        
        const pendingSales = localSales.filter(
          (sale) => !sale.synced && !sale.syncing && (sale.retryCount || 0) < maxRetries
        );
        
        if (pendingSales.length === 0) {
          return;
        }
        
        set({ syncInProgress: true, syncing: true });
        
        // Traiter chaque vente séquentiellement
        for (const pendingSale of pendingSales) {
          // Marquer comme en cours
          set((state) => ({
            localSales: state.localSales.map((sale) =>
              sale.id === pendingSale.id 
                ? { ...sale, syncing: true, lastSyncError: undefined } 
                : sale
            ),
          }));
          
          try {
            console.log(`📤 Synchronisation vente ${pendingSale.id}...`);
            
            const saleData: SaleCreate = {
              items: pendingSale.items.map(item => ({
                product_id: item.id,
                quantity: item.quantity,
                discount_percent: 0,
              })),
              payment_method: pendingSale.paymentMethod,
              client_name: pendingSale.clientName || 'Passager',
            };
            
            const response = await saleService.createSale(saleData);
            
            // Extraire la vente créée
            let createdSale: SaleResponse | null = null;
            
            if (response && typeof response === 'object') {
              if ('sale' in response && response.sale) {
                createdSale = response.sale;
              } else if ('data' in response && response.data) {
                const dataObj = response.data as any;
                if (dataObj && typeof dataObj === 'object') {
                  if ('sale' in dataObj && dataObj.sale) {
                    createdSale = dataObj.sale;
                  } else if ('id' in dataObj || 'reference' in dataObj) {
                    createdSale = dataObj as SaleResponse;
                  }
                }
              } else if ('id' in response || 'reference' in response) {
                createdSale = response as unknown as SaleResponse;
              }
            }
            
            if (createdSale && (createdSale.id || createdSale.reference)) {
              console.log(`✅ Vente synchronisée: ${createdSale.reference || createdSale.id}`);
              // Passer l'ID local pour suppression ciblée
              get().addSaleFromApi(createdSale, pendingSale.id);
            } else {
              // Marquer comme synchronisée même sans réponse structurée
              set((state) => ({
                localSales: state.localSales.map((sale) =>
                  sale.id === pendingSale.id 
                    ? { ...sale, synced: true, status: 'completed', syncing: false } 
                    : sale
                ),
              }));
            }
            
          } catch (error: any) {
            console.error(`❌ Erreur synchronisation vente ${pendingSale.id}:`, error.message);
            
            set((state) => ({
              localSales: state.localSales.map((sale) =>
                sale.id === pendingSale.id 
                  ? { 
                      ...sale, 
                      syncing: false,
                      retryCount: (sale.retryCount || 0) + 1,
                      lastSyncError: error.message || 'Erreur inconnue'
                    } 
                  : sale
              ),
            }));
          }
        }
        
        set({ syncInProgress: false, syncing: false });
        
        // Vérifier s'il reste des ventes à synchroniser
        const remainingPending = get().localSales.filter(
          s => !s.synced && (s.retryCount || 0) < get().maxRetries
        );
        
        if (remainingPending.length > 0) {
          console.log(`🔄 ${remainingPending.length} vente(s) restantes, nouvelle tentative dans 5 secondes`);
          setTimeout(() => {
            get().syncPendingSales();
          }, 5000);
        }
      },

      clearError: () => set({ error: null }),
      
      resetFailedSales: () => {
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