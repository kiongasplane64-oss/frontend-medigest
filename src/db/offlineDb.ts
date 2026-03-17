import Dexie, { Table } from 'dexie';

export interface OfflineProduct {
  id?: string;
  name: string;
  price: number;
  categoryId: string;
  category?: {
    id: string;
    name: string;
    icon?: string;
  };
  stock: number;
  code: string;
  barcode?: string;
  qrCode?: string;
  description?: string;
  active?: boolean;
  selling_price?: number;
  quantity?: number;
  category_id?: string;
  qr_code?: string;
  updatedAt?: number;
}

export interface OfflineCategory {
  id?: string;
  name: string;
  icon?: string;
  updatedAt?: number;
}

export interface OfflineSale {
  id?: number;
  items: any[];
  total: number;
  paymentMethod: string;
  timestamp: number;
  status: 'pending' | 'synced';
  cashierId?: string;
  cashierName?: string;
  posId?: string;
  posName?: string;
  sessionId?: string;
  clientType?: string;
  receiptNumber?: string;
  synced?: boolean;
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
}

export interface OfflineDailyStats {
  id?: string;
  date: string;
  total: number;
  salesCount: number;
  currentClient: string;
  updatedAt: number;
}

export class OfflineDatabase extends Dexie {
  sales!: Table<OfflineSale>;
  products!: Table<OfflineProduct>;
  categories!: Table<OfflineCategory>;
  sessions!: Table<OfflineSession>;
  dailyStats!: Table<OfflineDailyStats>;

  constructor() {
    super('PharmaOfflineDB');
    
    this.version(2).stores({
      sales: '++id, status, timestamp, sessionId, cashierId, [status+timestamp]',
      products: 'id, name, code, barcode, qrCode, categoryId, stock, active, [code+barcode+qrCode]',
      categories: 'id, name',
      sessions: 'id, sessionId, posId, userId, status, openedAt',
      dailyStats: 'id, date'
    }).upgrade(() => {
      // Migration des anciennes données si nécessaire
      console.log('Mise à jour de la base de données vers version 2');
    });
  }

  // Méthodes utilitaires pour les produits
  async getProductByCode(code: string): Promise<OfflineProduct | undefined> {
    return await this.products
      .where('code')
      .equals(code)
      .or('barcode')
      .equals(code)
      .or('qrCode')
      .equals(code)
      .first();
  }

  async getProductsByCategory(categoryId: string): Promise<OfflineProduct[]> {
    return await this.products.where('categoryId').equals(categoryId).toArray();
  }

  async updateProductStock(productId: string, newStock: number): Promise<void> {
    await this.products.update(productId, { 
      stock: newStock,
      updatedAt: Date.now()
    });
  }

  async bulkUpdateProductsStock(updates: { id: string; stock: number }[]): Promise<void> {
    await this.transaction('rw', this.products, async () => {
      for (const update of updates) {
        await this.products.update(update.id, { 
          stock: update.stock,
          updatedAt: Date.now()
        });
      }
    });
  }

  // Méthodes utilitaires pour les ventes
  async getPendingSales(): Promise<OfflineSale[]> {
    return await this.sales.where('status').equals('pending').toArray();
  }

  async getSalesByDate(date: Date): Promise<OfflineSale[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await this.sales
      .where('timestamp')
      .between(startOfDay.getTime(), endOfDay.getTime())
      .toArray();
  }

  async markSaleAsSynced(saleId: number): Promise<void> {
    await this.sales.update(saleId, { status: 'synced' });
  }

  // Méthodes pour les sessions
  async saveSession(session: Omit<OfflineSession, 'id'>): Promise<string> {
    const id = session.sessionId || Date.now().toString();
    await this.sessions.put({ ...session, id });
    return id;
  }

  async getCurrentSession(userId?: string): Promise<OfflineSession | undefined> {
    const query = this.sessions.where('status').equals('open');
    
    if (userId) {
      return await query.and(s => s.userId === userId).first();
    }
    
    return await query.first();
  }

  async closeSession(sessionId: string): Promise<void> {
    await this.sessions.update(sessionId, {
      status: 'closed',
      closedAt: Date.now()
    });
  }

  // Méthodes pour les stats quotidiennes
  async updateDailyStats(date: string, stats: Partial<OfflineDailyStats>): Promise<void> {
    const existing = await this.dailyStats.where('date').equals(date).first();
    
    if (existing && existing.id) {
      await this.dailyStats.update(existing.id, {
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
  }

  async getDailyStats(date: string): Promise<OfflineDailyStats | undefined> {
    return await this.dailyStats.where('date').equals(date).first();
  }

  // Méthode de synchronisation
  async syncWithServer(serverData: {
    products?: OfflineProduct[];
    categories?: OfflineCategory[];
    sales?: OfflineSale[];
  }): Promise<void> {
    await this.transaction('rw', this.products, this.categories, this.sales, async () => {
      if (serverData.products) {
        await this.products.bulkPut(serverData.products);
      }
      
      if (serverData.categories) {
        await this.categories.bulkPut(serverData.categories);
      }
      
      if (serverData.sales) {
        const pendingSales = await this.getPendingSales();
        const syncedSales = serverData.sales.filter(s => s.status === 'synced');
        
        for (const syncedSale of syncedSales) {
          const pending = pendingSales.find(p => 
            p.timestamp === syncedSale.timestamp && 
            p.total === syncedSale.total
          );
          
          if (pending && pending.id) {
            await this.markSaleAsSynced(pending.id);
          }
        }
      }
    });
  }

  // Nettoyage des anciennes données
  async cleanOldData(daysToKeep: number = 30): Promise<void> {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    
    await this.sales
      .where('timestamp')
      .below(cutoffTime)
      .and(sale => sale.status === 'synced')
      .delete();
      
    await this.dailyStats
      .where('updatedAt')
      .below(cutoffTime)
      .delete();
  }

  // Méthode pour obtenir des statistiques rapides
  async getQuickStats(): Promise<{
    totalProducts: number;
    totalCategories: number;
    pendingSales: number;
    todaySales: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalProducts, totalCategories, pendingSales, todaySales] = await Promise.all([
      this.products.count(),
      this.categories.count(),
      this.sales.where('status').equals('pending').count(),
      this.sales.where('timestamp').aboveOrEqual(today.getTime()).count()
    ]);

    return {
      totalProducts,
      totalCategories,
      pendingSales,
      todaySales
    };
  }
}

export const db = new OfflineDatabase();

// Initialisation de la base de données
db.on('ready', () => {
  console.log('Base de données offline prête');
});

// Gestion des erreurs
db.on('blocked', () => {
  console.warn('Base de données bloquée - fermez les autres onglets');
});

db.on('versionchange', () => {
  db.close();
  console.log('Mise à jour de la base de données - rechargement...');
  window.location.reload();
});

// Export par défaut pour faciliter l'import
export default db;