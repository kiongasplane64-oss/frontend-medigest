// components/NoSubscriptionGuard.tsx
import { useLocation } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuthStore } from "@/store/useAuthStore";
import { useEffect, useState } from "react";

interface NoSubscriptionGuardProps {
  children: React.ReactNode;
}

export function NoSubscriptionGuard({ children }: NoSubscriptionGuardProps) {
  const location = useLocation();

  // Récupérer l'état d'authentification depuis le store
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuthStore();

  const {
    canAccess,
    isExpired,
    daysRemaining,
    trialDaysRemaining,
    isTrial,
    subscription,
    isLoading: isSubLoading,
    hasActiveSubscription,
  } = useSubscription();

  const [isChecking, setIsChecking] = useState(true);
  const currentPath = location.pathname;

  // ROUTES JAMAIS BLOQUEES
  const publicAllowedPaths = [
    "/login",
    "/register",
    "/verify-otp",
    "/out-of-service",
  ];

  const subscriptionAllowedPaths = [
    "/subscription",
    "/payment",
    "/payment-success",
    "/activate-code",
  ];

  // ===============================
  // 🔒 ÉTAPE 1: VÉRIFIER SI CONNECTÉ
  // ===============================
  
  useEffect(() => {
    if (isAuthLoading || isSubLoading) return;
    
    const isSeller = user?.role === "seller" || user?.role === "vendeur";
    
    // Pour les vendeurs, on vérifie l'abonnement de leur branche via canAccess
    // canAccess dans useSubscription vérifie déjà l'abonnement via l'API /status
    if (isSeller) {
      const hasAccess = canAccess === true || hasActiveSubscription === true;
      
      if (!hasAccess && !subscriptionAllowedPaths.includes(currentPath) && !publicAllowedPaths.includes(currentPath)) {
        console.log("❌ [NoSubscriptionGuard] Vendeur sans abonnement de branche → redirection /subscription");
        // Note: On utilise window.location pour une redirection propre sans boucle
        window.location.href = "/subscription";
      }
    }
    
    // Petite optimisation : attendre un peu avant de finir la vérification
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [isAuthLoading, isSubLoading, canAccess, hasActiveSubscription, user, currentPath]);

  // Attendre le chargement de l'authentification
  if (isAuthLoading || isSubLoading || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  // 🔐 SI NON AUTHENTIFIÉ → Ne pas rediriger automatiquement
  // Laisser useProtectedRoute gérer la redirection vers login
  // Retourner null silencieusement pour éviter les boucles
  if (!isAuthenticated) {
    console.log("🔐 [NoSubscriptionGuard] Non authentifié, en attente de redirection par useProtectedRoute...");
    return null;
  }

  // DEBUG: Loguer les valeurs
  console.log("🔍 [NoSubscriptionGuard] State:", {
    currentPath,
    isAuthenticated,
    canAccess,
    isExpired,
    daysRemaining,
    userRole: user?.role,
    hasActiveSubscription,
  });

  // ===============================
  // ✅ ÉTAPE 2: VÉRIFIER L'ABONNEMENT
  // ===============================

  // 1. Routes publiques → toujours autorisées (même sans abonnement)
  if (publicAllowedPaths.includes(currentPath)) {
    console.log("✅ [NoSubscriptionGuard] Route publique → accès autorisé");
    return <>{children}</>;
  }

  // 2. Routes abonnement → autorisées même sans accès
  if (subscriptionAllowedPaths.includes(currentPath)) {
    console.log("✅ [NoSubscriptionGuard] Route d'abonnement → accès autorisé");
    return <>{children}</>;
  }

  // 3. Super admin → toujours autorisé
  if (user?.role === "super_admin") {
    console.log("✅ [NoSubscriptionGuard] Super Admin → accès autorisé");
    return <>{children}</>;
  }

  // 4. Vendeur → vérification via canAccess (qui prend en compte l'abonnement de la branche)
  const isSeller = user?.role === "seller" || user?.role === "vendeur";
  
  if (isSeller) {
    const hasBranchSubscription = canAccess === true || hasActiveSubscription === true;
    
    if (hasBranchSubscription) {
      console.log("✅ [NoSubscriptionGuard] Vendeur avec abonnement actif de branche → accès autorisé");
      return <>{children}</>;
    } else {
      console.log("❌ [NoSubscriptionGuard] Vendeur sans abonnement de branche actif");
      
      // Afficher la page de blocage
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-600">Accès restreint</h2>
            <p className="text-slate-600 text-sm">
              L'abonnement de votre pharmacie a expiré ou n'est pas actif.
              Veuillez contacter l'administrateur de votre pharmacie pour renouveler l'abonnement.
            </p>
            <button
              onClick={() => {
                // Déconnexion volontaire uniquement
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = "/login";
              }}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      );
    }
  }

  // 5. Admin: Abonnement actif → autorisation DIRECTE
  const isSubscriptionActive = hasActiveSubscription === true || 
                                (subscription?.status === "active" || subscription?.status === "trialing") ||
                                (!isExpired && daysRemaining > 0) ||
                                (isTrial && trialDaysRemaining > 0);

  if (isSubscriptionActive) {
    console.log("✅ [NoSubscriptionGuard] Abonnement actif → accès autorisé");
    return <>{children}</>;
  }

  // 6. Accès OK via canAccess
  if (canAccess === true) {
    console.log("✅ [NoSubscriptionGuard] canAccess=true → accès autorisé");
    return <>{children}</>;
  }

  // ===============================
  // ❌ ÉTAPE 3: BLOQUÉ → UI simple + CTA
  // ===============================
  console.log("❌ [NoSubscriptionGuard] ACCÈS BLOQUÉ - Aucune condition validée");
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-red-600">Accès restreint</h2>

        <p className="text-slate-600 text-sm">
          {isExpired
            ? "Votre abonnement a expiré."
            : isTrial && trialDaysRemaining <= 0
            ? "Votre période d'essai est terminée."
            : "Vous n'avez pas d'abonnement actif."}
        </p>

        {subscription?.end_date && (
          <p className="text-xs text-slate-400">
            Expire le {new Date(subscription.end_date).toLocaleDateString()}
          </p>
        )}

        {daysRemaining > 0 && daysRemaining <= 3 && (
          <p className="text-xs text-amber-600 font-semibold">
            {daysRemaining} jour(s) restant(s)
          </p>
        )}

        <button
          onClick={() =>
            window.location.href = "/subscription"
          }
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
        >
          Voir les offres
        </button>
        
        <button
          onClick={() => {
            // Déconnexion volontaire uniquement
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/login";
          }}
          className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 transition"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}