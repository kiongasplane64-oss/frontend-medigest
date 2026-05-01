// hooks/useProtectedRoute.ts
import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";

export const useProtectedRoute = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user, isSuperAdmin, isLoading } = useAuthStore();

  const isRedirecting = useRef(false);
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    if (isLoading) return;
    if (isRedirecting.current) return;

    const currentPath = location.pathname;

    // Éviter les redirections en boucle
    if (lastPathRef.current === currentPath && isAuthenticated) {
      console.log("🔄 Évitement de boucle détecté, même chemin:", currentPath);
      return;
    }
    lastPathRef.current = currentPath;

    // ROUTES PUBLIQUES
    const publicRoutes = [
      "/login",
      "/register",
      "/forgot-password",
      "/verify-otp",
      "/out-of-service",
    ];

    // ===============================
    // 🔒 NON AUTHENTIFIÉ
    // ===============================
    if (!isAuthenticated) {
      if (!publicRoutes.includes(currentPath)) {
        console.log("🔐 Non authentifié → /login");
        isRedirecting.current = true;
        navigate("/login", { replace: true });
        setTimeout(() => {
          isRedirecting.current = false;
        }, 100);
      }
      return;
    }

    // ===============================
    // ⏳ Attendre que user soit chargé
    // ===============================
    if (!user) {
      console.log("⏳ Utilisateur en cours de chargement...");
      return;
    }

    const userRole = user?.role;
    const isSuperAdminUser = userRole === "super_admin" || isSuperAdmin();
    const isSellerUser = userRole === "seller" || userRole === "vendeur";

    // ===============================
    // 👑 SUPER ADMIN - Redirection uniquement si pas sur super-admin
    // ===============================
    if (isSuperAdminUser) {
      if (
        !currentPath.startsWith("/super-admin") &&
        currentPath !== "/superadmin-welcome"
      ) {
        console.log("👑 SuperAdmin → /super-admin");
        isRedirecting.current = true;
        navigate("/super-admin", { replace: true });
        setTimeout(() => {
          isRedirecting.current = false;
        }, 100);
      }
      return;
    }

    // ===============================
    // 🚫 SUPPRIMÉ : Logique de redirection pour vendeurs
    // Les vendeurs sont gérés par VendorLayout + NoSubscriptionGuard
    // ===============================
    // if (isSellerUser) {
    //   if (currentPath !== "/vendor-pos" && !publicRoutes.includes(currentPath)) {
    //     console.log("👨‍💼 Vendeur → /vendor-pos");
    //     isRedirecting.current = true;
    //     navigate("/vendor-pos", { replace: true });
    //     setTimeout(() => {
    //       isRedirecting.current = false;
    //     }, 100);
    //     return;
    //   }
    // }

    // ===============================
    // ✅ VÉRIFICATION ABONNEMENT (POUR LES ADMINS UNIQUEMENT)
    // ===============================
    if (!isSellerUser) {
      // Routes autorisées sans abonnement
      const subscriptionSafeRoutes = [
        "/subscription",
        "/payment",
        "/payment-success",
        "/activate-code",
      ];

      // has_subscription peut être undefined pendant le chargement
      const hasActiveSubscription = user?.has_subscription === true;

      if (!hasActiveSubscription) {
        // Pas d'abonnement actif → rediriger vers subscription
        if (!subscriptionSafeRoutes.includes(currentPath) && !publicRoutes.includes(currentPath)) {
          console.log("💳 Pas d'abonnement → /subscription");
          isRedirecting.current = true;
          navigate("/subscription", { replace: true });
          setTimeout(() => {
            isRedirecting.current = false;
          }, 100);
        }
        return;
      }
    }

    // ===============================
    // ✅ AVEC ABONNEMENT ACTIF (ADMIN) 
    // ===============================
    
    // Pour les admins seulement - redirection depuis /subscription
    if (!isSellerUser && currentPath === "/subscription") {
      console.log("👨‍💻 Admin abonné → /dashboard");
      isRedirecting.current = true;
      navigate("/dashboard", { replace: true });
      setTimeout(() => {
        isRedirecting.current = false;
      }, 100);
      return;
    }

    // 🚫 Accès super-admin interdit pour les admins
    if (!isSellerUser && (currentPath.startsWith("/super-admin") || currentPath === "/superadmin-welcome")) {
      console.log("👨‍💻 Admin → accès super-admin interdit → /dashboard");
      isRedirecting.current = true;
      navigate("/dashboard", { replace: true });
      setTimeout(() => {
        isRedirecting.current = false;
      }, 100);
      return;
    }

    // 🔄 VENDEUR: Ne pas rediriger depuis vendor-pos vers autre chose
    // Les vendeurs restent sur vendor-pos, c'est leur seul point d'entrée

    // ✅ Accès autorisé
    console.log(`✅ Accès autorisé: ${currentPath} (rôle: ${userRole})`);

  }, [
    isAuthenticated,
    user,
    location.pathname,
    isLoading,
    navigate,
    isSuperAdmin,
  ]);
};