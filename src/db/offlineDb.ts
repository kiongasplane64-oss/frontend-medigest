import Dexie, { Table } from 'dexie';

export interface OfflineSale {
  id?: number;
  items: any[];
  total: number;
  timestamp: number;
  status: 'pending' | 'synced';
}

export class OfflineDatabase extends Dexie {
  sales!: Table<OfflineSale>;

  constructor() {
    super('PharmaOfflineDB');
    this.version(1).stores({
      sales: '++id, status, timestamp' // Indexation pour des recherches rapides
    });
  }
}

export const db = new OfflineDatabase();