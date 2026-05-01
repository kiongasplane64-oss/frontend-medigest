// hooks/useAuthRedirect.ts
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/api/client';

export const useAuthRedirect = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isLoading, isSuperAdmin } = useAuthStore();
  
  const isRedirecting = useRef(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [subscriptionValid, setSubscriptionValid] = useState(true);

  // Vérification de l'abonnement
  useEffect(() => {
    if (!isAuthenticated || !user || isSuperAdmin()) {
      setSubscriptionChecked(true);
      setSubscriptionValid(true);
      return;
    }

    const checkSubscription = async () => {
      try {
        const response = await api.get('/subscriptions/status');
        const isValid = response.data?.is_active === true;
        setSubscriptionValid(isValid);
      } catch (error) {
        console.error('Erreur abonnement:', error);
        setSubscriptionValid(false);
      } finally {
        setSubscriptionChecked(true);
      }
    };

    checkSubscription();
  }, [isAuthenticated, user, isSuperAdmin]);

  // Redirections basées sur l'authentification et l'abonnement
  useEffect(() => {
    if (isLoading || !subscriptionChecked) return;
    if (isRedirecting.current) return;
    
    const currentPath = location.pathname;
    
    // Routes publiques
    const publicRoutes = ['/login', '/register', '/superadmin-welcome', '/out-of-service', '/subscription'];
    if (publicRoutes.includes(currentPath)) return;
    
    // Non authentifié → login
    if (!isAuthenticated) {
      if (currentPath !== '/login') {
        isRedirecting.current = true;
        navigate('/login', { replace: true });
        setTimeout(() => { isRedirecting.current = false; }, 500);
      }
      return;
    }
    
    // Super Admin
    if (isSuperAdmin()) {
      if (!currentPath.startsWith('/super-admin')) {
        isRedirecting.current = true;
        navigate('/super-admin', { replace: true });
        setTimeout(() => { isRedirecting.current = false; }, 500);
      }
      return;
    }
    
    const isSeller = user?.role === 'seller' || user?.role === 'vendeur';
    
    // Vendeur → POS
    if (isSeller) {
      if (!subscriptionValid && currentPath !== '/subscription') {
        isRedirecting.current = true;
        navigate('/subscription', { replace: true });
        setTimeout(() => { isRedirecting.current = false; }, 500);
      } else if (subscriptionValid && !currentPath.startsWith('/vendor-pos')) {
        isRedirecting.current = true;
        navigate('/vendor-pos', { replace: true });
        setTimeout(() => { isRedirecting.current = false; }, 500);
      }
      return;
    }
    
    // Admin → dashboard (le service est géré par ServiceGuard)
    if (!subscriptionValid && currentPath !== '/subscription') {
      isRedirecting.current = true;
      navigate('/subscription', { replace: true });
      setTimeout(() => { isRedirecting.current = false; }, 500);
      return;
    }
    
    if (subscriptionValid && (currentPath === '/' || currentPath === '/login')) {
      isRedirecting.current = true;
      navigate('/dashboard', { replace: true });
      setTimeout(() => { isRedirecting.current = false; }, 500);
    }
    
  }, [isAuthenticated, user, isLoading, location.pathname, navigate, subscriptionChecked, subscriptionValid, isSuperAdmin]);
  
  return { subscriptionChecked, subscriptionValid };
};