// stores/saleStore.ts - Version entièrement corrigée
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
  cashierId?: string;
  posName?: string;
  branchId?: string;
  branchName?: string; 
  sessionNumber?: string;
  clientName?: string;
  status?: 'pending' | 'completed' | 'cancelled';
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

const SYNC_DELAY_MS = 5000;
const MIN_SYNC_INTERVAL_MS = 10000;

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

      fetchSales: async () => {
        set({ loading: true, error: null });
        try {
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
        
        // Ne pas déclencher immédiatement pour éviter les appels multiples
        setTimeout(() => {
          get().syncPendingSales();
        }, 100);
      },

      addSaleFromApi: (sale, localId) => {
        set((state) => {
          const saleExists = state.sales.some(s => s.id === sale.id);
          if (saleExists) {
            console.warn(`⚠️ Vente ${sale.id} déjà présente, ignorée`);
            return state;
          }
          
          // Supprimer la vente locale correspondante
          let newLocalSales = state.localSales;
          if (localId) {
            newLocalSales = state.localSales.filter(local => local.id !== localId);
          } else {
            newLocalSales = state.localSales.filter(local => 
              local.id !== sale.id && 
              local.receiptNumber !== sale.receipt_number && 
              local.tempId !== sale.id
            );
          }
          
          console.log(`✅ Vente synchronisée: ${sale.reference || sale.id}`);
          
          return {
            sales: [sale, ...state.sales],
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

      syncPendingSales: async () => {
        const { syncInProgress, lastSyncAttempt, localSales, maxRetries } = get();
        
        // Éviter les synchronisations concurrentes
        if (syncInProgress) {
          console.log('🔄 Synchronisation déjà en cours, ignorée');
          return;
        }
        
        // Éviter les synchronisations trop fréquentes
        const now = Date.now();
        if (lastSyncAttempt && (now - lastSyncAttempt) < MIN_SYNC_INTERVAL_MS) {
          console.log('⏳ Dernière synchronisation trop récente, ignorée');
          return;
        }
        
        const pendingSales = localSales.filter(
          (sale) => !sale.synced && !sale.syncing && (sale.retryCount || 0) < maxRetries
        );
        
        if (pendingSales.length === 0) {
          return;
        }
        
        console.log(`🔄 Début synchronisation de ${pendingSales.length} vente(s)`);
        set({ syncInProgress: true, syncing: true, lastSyncAttempt: now });
        
        for (const pendingSale of pendingSales) {
          // Marquer comme en cours de synchronisation
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
                product_code: item.code,
              })),
              payment_method: pendingSale.paymentMethod,
              client_name: pendingSale.clientName || 'Passager',
            };
            
            // Appel API réel
            const response = await saleService.createSale(saleData);
            
            // Extraire la vente créée
            let createdSale: SaleResponse | null = null;
            
            if (response) {
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
            
            const newRetryCount = (pendingSale.retryCount || 0) + 1;
            const isFailed = newRetryCount >= maxRetries;
            
            set((state) => ({
              localSales: state.localSales.map((sale) =>
                sale.id === pendingSale.id 
                  ? { 
                      ...sale, 
                      syncing: false,
                      retryCount: newRetryCount,
                      lastSyncError: error.message || 'Erreur de connexion',
                      status: isFailed ? 'cancelled' : sale.status
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
          console.log(`🔄 ${remainingPending.length} vente(s) restantes, nouvelle tentative dans ${SYNC_DELAY_MS/1000}s`);
          setTimeout(() => {
            get().syncPendingSales();
          }, SYNC_DELAY_MS);
        }
      },

      clearError: () => set({ error: null }),
      
      resetFailedSales: () => {
        set((state) => ({
          localSales: state.localSales.map((sale) =>
            !sale.synced && (sale.retryCount || 0) >= state.maxRetries
              ? { ...sale, retryCount: 0, syncing: false, lastSyncError: undefined, status: 'pending' }
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