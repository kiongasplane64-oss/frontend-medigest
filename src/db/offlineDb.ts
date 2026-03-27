// db/offlineDb.ts
import Dexie, { Table } from 'dexie';

/**
 * Interface OfflineProduct alignée avec le nouveau modèle Product du service POS
 */
export interface OfflineProduct {
  id?: string;
  name: string;
  // Prix venant directement du backend
  selling_price: number;
  purchase_price: number;
  quantity: number;
  // Identifiants
  code: string;
  barcode?: string;
  qr_code?: string;
  // Catégorie
  category_id?: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  // Métadonnées
  description?: string;
  pharmacy_id?: string;
  unit?: string;
  alert_threshold?: number;
  expiry_date?: string;
  // Champs pour compatibilité
  updatedAt?: number;
  active?: boolean;
}

export interface OfflineCategory {
  id?: string;
  name: string;
  icon?: string;
  updatedAt?: number;
  pharmacy_id?: string;
}

export interface OfflineSale {
  id?: number;
  items: any[];
  total: number;
  paymentMethod: string;
  timestamp: number;
  status: 'pending' | 'synced' | 'failed';
  cashierId?: string;
  cashierName?: string;
  posId?: string;
  posName?: string;
  sessionId?: string;
  clientType?: string;
  clientName?: string;
  receiptNumber?: string;
  synced?: boolean;
  synced_at?: number;
  currency?: string;
  exchangeRate?: number;
  pharmacy_id?: string;
}

export interface OfflineSession {
  id?: string;
  posId: string;
  posName: string;
  sessionId: string;
  sessionNumber: string;
  userId?: string;
  userName?: string;
  openedAt: number;
  closedAt?: number;
  status: 'open' | 'closed';
  pharmacy_id?: string;
}

export interface OfflineDailyStats {
  date: string; // Format YYYY-MM-DD - Utilisé comme clé primaire
  total: number;
  salesCount: number;
  currentClient: string;
  updatedAt: number;
}

export class OfflineDatabase extends Dexie {
  sales!: Table<OfflineSale, number>;
  products!: Table<OfflineProduct, string>;
  categories!: Table<OfflineCategory, string>;
  sessions!: Table<OfflineSession, string>;
  dailyStats!: Table<OfflineDailyStats, string>;

  constructor() {
    super('PharmaOfflineDB');
    
    // Version 5: Nouveau schéma aligné avec le backend
    this.version(5).stores({
      sales: '++id, status, timestamp, sessionId, cashierId, pharmacy_id, [status+timestamp], [pharmacy_id+status]',
      products: 'id, name, code, barcode, qr_code, category_id, quantity, active, pharmacy_id, [pharmacy_id+category_id]',
      categories: 'id, name, pharmacy_id',
      sessions: 'id, sessionId, posId, userId, status, openedAt, pharmacy_id, [userId+status]',
      dailyStats: 'date'
    }).upgrade(async (trans) => {
      console.log('Migration vers version 5 - alignement avec backend');
      
      try {
        // Mettre à jour les produits existants vers le nouveau schéma
        const oldProducts = await trans.table('products').toArray();
        for (const oldProduct of oldProducts) {
          const updatedProduct: any = {
            id: oldProduct.id,
            name: oldProduct.name,
            // Migration des prix
            selling_price: oldProduct.selling_price ?? oldProduct.price ?? oldProduct.retailPrice ?? 0,
            purchase_price: oldProduct.purchase_price ?? oldProduct.wholesalePrice ?? 0,
            quantity: oldProduct.quantity ?? oldProduct.stock ?? 0,
            // Identifiants
            code: oldProduct.code || '',
            barcode: oldProduct.barcode,
            qr_code: oldProduct.qr_code || oldProduct.qrCode,
            // Catégorie
            category_id: oldProduct.category_id ?? oldProduct.categoryId,
            category: oldProduct.category,
            // Métadonnées
            description: oldProduct.description,
            pharmacy_id: oldProduct.pharmacy_id,
            unit: oldProduct.unit,
            alert_threshold: oldProduct.alert_threshold,
            expiry_date: oldProduct.expiry_date,
            updatedAt: Date.now(),
            active: oldProduct.active !== false,
          };
          
          await trans.table('products').update(oldProduct.id, updatedProduct);
        }
        
        // Mettre à jour les ventes existantes
        const sales = await trans.table('sales').toArray();
        for (const sale of sales) {
          const updates: any = {};
          if (sale.clientName === undefined) updates.clientName = sale.clientType || 'Passager';
          if (sale.synced === undefined) updates.synced = sale.status === 'synced';
          if (sale.synced_at === undefined && sale.status === 'synced') updates.synced_at = Date.now();
          
          if (Object.keys(updates).length > 0 && sale.id) {
            await trans.table('sales').update(sale.id, updates);
          }
        }
        
        console.log('✅ Migration vers version 5 terminée');
      } catch (error) {
        console.error('Erreur migration version 5:', error);
      }
    });
  }

  // ============================================
  // MÉTHODES POUR LES PRODUITS
  // ============================================

  async getProductByCode(code: string, pharmacy_id?: string): Promise<OfflineProduct | undefined> {
    try {
      // Recherche par code
      let product = await this.products.where('code').equals(code).first();
      if (product && (!pharmacy_id || product.pharmacy_id === pharmacy_id)) return product;
      
      // Recherche par code-barres
      product = await this.products.where('barcode').equals(code).first();
      if (product && (!pharmacy_id || product.pharmacy_id === pharmacy_id)) return product;
      
      // Recherche par QR code
      product = await this.products.where('qr_code').equals(code).first();
      if (product && (!pharmacy_id || product.pharmacy_id === pharmacy_id)) return product;
      
      return undefined;
    } catch (error) {
      console.error('Erreur getProductByCode:', error);
      return undefined;
    }
  }

  async getProductsByCategory(categoryId: string, pharmacy_id?: string): Promise<OfflineProduct[]> {
    try {
      let products = await this.products.where('category_id').equals(categoryId).toArray();
      
      if (pharmacy_id) {
        products = products.filter(p => p.pharmacy_id === pharmacy_id);
      }
      
      return products;
    } catch (error) {
      console.error('Erreur getProductsByCategory:', error);
      return [];
    }
  }

  async getProductsByPharmacy(pharmacy_id: string): Promise<OfflineProduct[]> {
    try {
      return await this.products.where('pharmacy_id').equals(pharmacy_id).toArray();
    } catch (error) {
      console.error('Erreur getProductsByPharmacy:', error);
      return [];
    }
  }

  async updateProductQuantity(productId: string, newQuantity: number): Promise<void> {
    try {
      await this.products.update(productId, { 
        quantity: newQuantity,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Erreur updateProductQuantity:', error);
    }
  }

  async bulkUpdateProductsQuantity(updates: { id: string; quantity: number }[]): Promise<void> {
    if (updates.length === 0) return;
    
    try {
      await this.transaction('rw', this.products, async () => {
        for (const update of updates) {
          await this.products.update(update.id, { 
            quantity: update.quantity,
            updatedAt: Date.now()
          });
        }
      });
    } catch (error) {
      console.error('Erreur bulkUpdateProductsQuantity:', error);
    }
  }

  // ============================================
  // MÉTHODES POUR LES VENTES
  // ============================================

  async getPendingSales(pharmacy_id?: string): Promise<OfflineSale[]> {
    try {
      let sales = await this.sales.where('status').equals('pending').toArray();
      
      if (pharmacy_id) {
        sales = sales.filter(s => s.pharmacy_id === pharmacy_id);
      }
      
      return sales;
    } catch (error) {
      console.error('Erreur getPendingSales:', error);
      return [];
    }
  }

  async getFailedSales(pharmacy_id?: string): Promise<OfflineSale[]> {
    try {
      let sales = await this.sales.where('status').equals('failed').toArray();
      
      if (pharmacy_id) {
        sales = sales.filter(s => s.pharmacy_id === pharmacy_id);
      }
      
      return sales;
    } catch (error) {
      console.error('Erreur getFailedSales:', error);
      return [];
    }
  }

  async getSalesByDate(date: Date, pharmacy_id?: string): Promise<OfflineSale[]> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      let sales = await this.sales
        .where('timestamp')
        .between(startOfDay.getTime(), endOfDay.getTime())
        .toArray();
      
      if (pharmacy_id) {
        sales = sales.filter(s => s.pharmacy_id === pharmacy_id);
      }
      
      return sales;
    } catch (error) {
      console.error('Erreur getSalesByDate:', error);
      return [];
    }
  }

  async getSalesBySession(sessionId: string): Promise<OfflineSale[]> {
    try {
      return await this.sales.where('sessionId').equals(sessionId).toArray();
    } catch (error) {
      console.error('Erreur getSalesBySession:', error);
      return [];
    }
  }

  async markSaleAsSynced(saleId: number, receiptNumber?: string): Promise<void> {
    try {
      await this.sales.update(saleId, { 
        status: 'synced', 
        synced: true,
        synced_at: Date.now(),
        receiptNumber: receiptNumber
      });
    } catch (error) {
      console.error('Erreur markSaleAsSynced:', error);
    }
  }

  async markSaleAsFailed(saleId: number): Promise<void> {
    try {
      await this.sales.update(saleId, { 
        status: 'failed'
      });
    } catch (error) {
      console.error('Erreur markSaleAsFailed:', error);
    }
  }

  // ============================================
  // MÉTHODES POUR LES SESSIONS
  // ============================================

  async saveSession(session: Omit<OfflineSession, 'id'>): Promise<string> {
    try {
      const id = session.sessionId || Date.now().toString();
      await this.sessions.put({ ...session, id });
      return id;
    } catch (error) {
      console.error('Erreur saveSession:', error);
      throw error;
    }
  }

  async getCurrentSession(userId?: string, pharmacy_id?: string): Promise<OfflineSession | undefined> {
    try {
      let sessions = await this.sessions.where('status').equals('open').toArray();
      
      if (userId && pharmacy_id) {
        return sessions.find(s => s.userId === userId && s.pharmacy_id === pharmacy_id);
      }
      
      if (userId) {
        return sessions.find(s => s.userId === userId);
      }
      
      if (pharmacy_id) {
        return sessions.find(s => s.pharmacy_id === pharmacy_id);
      }
      
      return sessions[0];
    } catch (error) {
      console.error('Erreur getCurrentSession:', error);
      return undefined;
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    try {
      await this.sessions.update(sessionId, {
        status: 'closed',
        closedAt: Date.now()
      });
    } catch (error) {
      console.error('Erreur closeSession:', error);
    }
  }

  async closeAllSessions(): Promise<void> {
    try {
      await this.sessions.where('status').equals('open').modify({
        status: 'closed',
        closedAt: Date.now()
      });
    } catch (error) {
      console.error('Erreur closeAllSessions:', error);
    }
  }

  // ============================================
  // MÉTHODES POUR LES STATS QUOTIDIENNES
  // ============================================

  async updateDailyStats(date: string, stats: Partial<OfflineDailyStats>): Promise<void> {
    try {
      const existing = await this.dailyStats.get(date);
      
      if (existing) {
        await this.dailyStats.update(date, {
          ...stats,
          updatedAt: Date.now()
        });
      } else {
        await this.dailyStats.add({
          date,
          total: stats.total || 0,
          salesCount: stats.salesCount || 0,
          currentClient: stats.currentClient || 'Passager',
          updatedAt: Date.now()
        } as OfflineDailyStats);
      }
    } catch (error) {
      console.error('Erreur updateDailyStats:', error);
      try {
        await this.dailyStats.put({
          date,
          total: stats.total || 0,
          salesCount: stats.salesCount || 0,
          currentClient: stats.currentClient || 'Passager',
          updatedAt: Date.now()
        } as OfflineDailyStats);
      } catch (fallbackError) {
        console.error('Erreur fallback updateDailyStats:', fallbackError);
      }
    }
  }

  async getDailyStats(date: string): Promise<OfflineDailyStats | undefined> {
    try {
      return await this.dailyStats.get(date);
    } catch (error) {
      console.error('Erreur getDailyStats:', error);
      return undefined;
    }
  }

  async getDailyStatsByRange(startDate: string, endDate: string): Promise<OfflineDailyStats[]> {
    try {
      return await this.dailyStats
        .where('date')
        .between(startDate, endDate)
        .toArray();
    } catch (error) {
      console.error('Erreur getDailyStatsByRange:', error);
      return [];
    }
  }

  // ============================================
  // MÉTHODES DE NETTOYAGE
  // ============================================

  async cleanOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
      
      await this.sales
        .where('timestamp')
        .below(cutoffTime)
        .and(sale => sale.status === 'synced')
        .delete();
        
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
      
      await this.dailyStats
        .where('date')
        .below(cutoffDateStr)
        .delete();
        
      console.log(`Nettoyage des données antérieures à ${daysToKeep} jours effectué`);
    } catch (error) {
      console.error('Erreur cleanOldData:', error);
    }
  }

  async clearAllData(): Promise<void> {
    try {
      await this.transaction('rw', [this.products, this.categories, this.sales, this.sessions, this.dailyStats], async () => {
        await this.products.clear();
        await this.categories.clear();
        await this.sales.clear();
        await this.sessions.clear();
        await this.dailyStats.clear();
      });
      console.log('Toutes les données ont été effacées');
    } catch (error) {
      console.error('Erreur clearAllData:', error);
    }
  }

  // ============================================
  // MÉTHODES DE DIAGNOSTIC
  // ============================================

  async getDatabaseInfo(): Promise<{
    version: number;
    tables: { name: string; count: number }[];
  }> {
    try {
      const tables = [
        { name: 'products', count: await this.products.count() },
        { name: 'categories', count: await this.categories.count() },
        { name: 'sales', count: await this.sales.count() },
        { name: 'sessions', count: await this.sessions.count() },
        { name: 'dailyStats', count: await this.dailyStats.count() }
      ];
      
      return {
        version: this.verno,
        tables
      };
    } catch (error) {
      console.error('Erreur getDatabaseInfo:', error);
      return { version: this.verno, tables: [] };
    }
  }

  async getQuickStats(pharmacy_id?: string): Promise<{
    totalProducts: number;
    totalCategories: number;
    pendingSales: number;
    failedSales: number;
    todaySales: number;
    totalSales: number;
  }> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let products = await this.products.toArray();
      let categories = await this.categories.toArray();
      let pending = await this.sales.where('status').equals('pending').toArray();
      let failed = await this.sales.where('status').equals('failed').toArray();
      let todaySales = await this.sales.where('timestamp').aboveOrEqual(today.getTime()).toArray();
      let allSales = await this.sales.toArray();
      
      if (pharmacy_id) {
        products = products.filter(p => p.pharmacy_id === pharmacy_id);
        categories = categories.filter(c => c.pharmacy_id === pharmacy_id);
        pending = pending.filter(s => s.pharmacy_id === pharmacy_id);
        failed = failed.filter(s => s.pharmacy_id === pharmacy_id);
        todaySales = todaySales.filter(s => s.pharmacy_id === pharmacy_id);
        allSales = allSales.filter(s => s.pharmacy_id === pharmacy_id);
      }
      
      return {
        totalProducts: products.length,
        totalCategories: categories.length,
        pendingSales: pending.length,
        failedSales: failed.length,
        todaySales: todaySales.length,
        totalSales: allSales.length
      };
    } catch (error) {
      console.error('Erreur getQuickStats:', error);
      return {
        totalProducts: 0,
        totalCategories: 0,
        pendingSales: 0,
        failedSales: 0,
        todaySales: 0,
        totalSales: 0
      };
    }
  }
}

// Export de l'instance unique
export const db = new OfflineDatabase();

// Gestion des erreurs globales
db.on('ready', () => {
  console.log('✅ Base de données offline prête');
});

db.on('blocked', () => {
  console.warn('⚠️ Base de données bloquée - fermez les autres onglets');
});

db.on('versionchange', () => {
  db.close();
  console.log('🔄 Mise à jour de la base de données - rechargement...');
  window.location.reload();
});

// Export par défaut
export default db;