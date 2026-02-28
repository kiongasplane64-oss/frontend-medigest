import { useAuthStore } from '@/store/useAuthStore';

// On définit précisément ce qu'on attend d'un utilisateur avec abonnement
interface SubscriptionUser {
  id: string;
  name: string;
  role: string;
  plan_expires_at?: string | null;
  plan_name?: string | null;
}

export const useSubscription = () => {
  // On récupère le user et on force le type SubscriptionUser pour éviter les erreurs TS
  const user = useAuthStore((state) => state.user) as SubscriptionUser | null;

  const calculateDaysRemaining = () => {
    if (!user?.plan_expires_at) return 0;
    
    const expiry = new Date(user.plan_expires_at).getTime();
    const now = new Date().getTime();
    
    // Calcul de la différence en jours
    const diff = Math.ceil((expiry - now) / (1000 * 3600 * 24));
    return diff > 0 ? diff : 0;
  };

  const isExpired = () => {
    if (!user?.plan_expires_at) return true;
    return new Date(user.plan_expires_at) < new Date();
  };

  return {
    isExpired: isExpired(),
    daysRemaining: calculateDaysRemaining(),
    plan_name: user?.plan_name || 'Aucun plan',
    expiryDate: user?.plan_expires_at
  };
};