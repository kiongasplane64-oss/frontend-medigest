import { db } from '@/db/offlineDb';
import api from '@/api/client';

export const startSyncManager = () => {
  // On écoute le passage de "offline" à "online"
  window.addEventListener('online', async () => {
    console.log("🌐 Connexion rétablie. Synchronisation des ventes...");
    
    const pendingSales = await db.sales.where('status').equals('pending').toArray();

    for (const sale of pendingSales) {
      try {
        await api.post('/sales', {
          items: sale.items,
          total: sale.total,
          timestamp: sale.timestamp
        });
        
        // Si succès, on supprime de la base locale
        await db.sales.delete(sale.id!);
        console.log(`✅ Vente #${sale.id} synchronisée.`);
      } catch (err) {
        console.error(`❌ Échec de synchro pour la vente #${sale.id}`, err);
      }
    }
  });
};