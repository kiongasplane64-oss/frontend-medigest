import { useState, useEffect, useCallback } from 'react';

/**
 * Hook personnalisé pour détecter l'état de la connexion internet
 * @returns {boolean} true si en ligne, false si hors-ligne
 */
export function useOnline(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const handleOnline = useCallback(() => {
    setIsOnline(true);
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
  }, []);

  useEffect(() => {
    // Vérifier si nous sommes dans un environnement navigateur
    if (typeof window === 'undefined') return;

    // Ajouter les event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Nettoyage
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return isOnline;
}

/**
 * Hook pour surveiller la qualité de la connexion
 * @returns {Object} État détaillé de la connexion
 */
export function useConnectionQuality() {
  const [connection, setConnection] = useState<{
    type: string;
    downlink: number;
    rtt: number;
    effectiveType: string;
    saveData: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;

    // @ts-ignore - NetworkInformation API expérimentale
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const updateConnectionInfo = () => {
        setConnection({
          type: connection.type || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          effectiveType: connection.effectiveType || 'unknown',
          saveData: connection.saveData || false,
        });
      };

      updateConnectionInfo();
      connection.addEventListener('change', updateConnectionInfo);

      return () => {
        connection.removeEventListener('change', updateConnectionInfo);
      };
    }
  }, []);

  return connection;
}

/**
 * Hook pour vérifier si l'API est accessible
 * @param {string} url - URL à vérifier
 * @param {number} timeout - Timeout en ms
 * @returns {boolean} true si l'API est accessible
 */
export function useApiHealth(url: string = '/api/health', timeout: number = 5000): boolean {
  const [isHealthy, setIsHealthy] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const checkHealth = async () => {
      try {
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          signal: controller.signal,
          method: 'HEAD',
          cache: 'no-cache',
        });
        
        clearTimeout(timeoutId);

        if (mounted) {
          setIsHealthy(response.ok);
        }
      } catch {
        if (mounted) {
          setIsHealthy(false);
        }
      }
    };

    checkHealth();

    // Vérifier périodiquement
    const interval = setInterval(checkHealth, 30000);

    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [url, timeout]);

  return isHealthy;
}

/**
 * Hook pour surveiller la synchronisation des données offline
 * @returns {Object} État de la synchronisation
 */
export function useOfflineSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const isOnline = useOnline();

  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      // Importer dynamiquement db pour éviter les dépendances circulaires
      const { db } = await import('@/db/offlineDb');
      
      // Récupérer les ventes en attente
      const pendingSales = await db.getPendingSales();
      setPendingCount(pendingSales.length);

      if (pendingSales.length > 0) {
        // Tentative de synchronisation avec le serveur
        const response = await fetch('/api/sales/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sales: pendingSales }),
        });

        if (response.ok) {
          // Marquer les ventes comme synchronisées
          for (const sale of pendingSales) {
            if (sale.id) {
              await db.markSaleAsSynced(sale.id);
            }
          }
          setPendingCount(0);
          setLastSyncTime(new Date());
        }
      } else {
        setLastSyncTime(new Date());
      }
    } catch (error) {
      console.error('Erreur de synchronisation:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  // Synchronisation automatique quand on revient en ligne
  useEffect(() => {
    if (isOnline) {
      sync();
    }
  }, [isOnline, sync]);

  return {
    isSyncing,
    lastSyncTime,
    pendingCount,
    sync,
  };
}

export default useOnline;