import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';

export const PrivateRoute = () => {
  const { isAuthenticated, user, token } = useAuthStore();
  const location = useLocation();

  // 1. Si pas de token du tout -> Login
  if (!isAuthenticated && !token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 2. Si l'utilisateur est là mais pas activé
  // On vérifie qu'on n'est pas déjà sur la page OTP pour éviter les boucles
  if (user && user.activated === false && location.pathname !== '/verify-otp') {
    return <Navigate to={`/verify-otp?email=${encodeURIComponent(user.email)}`} replace />;
  }

  return <Outlet />;
};

export const PublicRoute = () => {
  const { isAuthenticated, token, user } = useAuthStore();
  
  // Si l'utilisateur est connecté mais pas activé, on le laisse aller à l'OTP
  // Sinon, s'il est pleinement connecté et activé, on l'envoie au dashboard
  if (isAuthenticated || token) {
    if (user && !user.activated) {
      return <Navigate to={`/verify-otp?email=${encodeURIComponent(user.email)}`} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};