import { useState, useEffect } from 'react';
import api from '@/api/client';
import { PharmacyAlert } from '@/types/notifications';

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<PharmacyAlert[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      // Appel à l'endpoint FastAPI que nous avons prévu
      const { data } = await api.get('/inventory/alerts');
      setAlerts(data);
    } catch (error) {
      console.error("Erreur lors de la récupération des alertes:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Premier chargement
    fetchAlerts();

    // Rafraîchir toutes les 5 minutes (300 000 ms)
    const interval = setInterval(fetchAlerts, 300000);

    return () => clearInterval(interval);
  }, []);

  return { alerts, loading, refresh: fetchAlerts };
};