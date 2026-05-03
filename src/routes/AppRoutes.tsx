// routes/AppRoutes.tsx - Version corrigée
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';

// SuperAdmins
import SuperAdminDashboard from '@/pages/superadmin/SuperAdminDashboard';
import SuperAdminRegister from '@/pages/superadmin/SuperAdminRegister';
import AdminGenerateCodePage from '@/pages/superadmin/AdminGenerateCodePage';
import SuperAdminWelcome from '@/pages/superadmin/SuperAdminWelcome';

// Pages - Auth
import Login from '@/modules/auth/views/Login';
import Register from '@/pages/Register';
import VerifyOtp from '@/pages/VerifyOtp';
import ActivationCodePage from '@/pages/ActivationCodePage';
import { ExpiryWarningBanner } from '@/components/ExpiryWarningBanner';

// Layouts
import Sidebar from '@/layouts/Sidebar';

// Vues du Dashboard
import Dashboard from '@/modules/stats/views/Dashboard';
import InventoryListView from '@/modules/inventory/views/inventoryListView';
import VendorPos from '@/modules/vendor/VendorPos';
import TransferList from '@/modules/inventory/views/TransferList';
import ProfitAnalysis from '@/modules/benefice/views/benefice';
import FinanceAnalysis from '@/modules/finance/views/FinanceDashboard';
import Expense from '@/modules/finance/depense/Expense';
import DebtPage from '@/modules/finance/dette/DebtPage';
import ReturnPage from '@/modules/finance/views/returnPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import SupplierCreditPage from '@/modules/finance/capital/SupplierCreditPage';
import PaymentPage from '@/pages/PaymentPage';
import PaymentSuccessPage from '@/pages/PaymentSuccessPage';
import ConfigViewWrapper from '@/modules/core/ConfigViewWrapper';
import FactureManager from '@/modules/sales/views/FactureManager';
import Rapports from '@/modules/sales/views/Rapports';
import Historique from '@/modules/sales/views/Historique';
import OutOfService from '@/modules/core/endehors';
import Monitoring from '@/modules/inventory/views/monitoring';
import Inventory from '@/modules/inventory/views/inventory';
import { useAuthStore } from '@/store/useAuthStore';
import CapitalPage from '@/modules/finance/capital/capital';
import StockReport from '@/modules/vendor/stockReport';
import UserPageControl from '@/pages/users/UserPageControl';
import Alerts from '@/modules/inventory/alerts';
import CorbeillePage from '@/pages/CorbeillePage';

// ========== COMPOSANTS WRAPPERS ==========

const InventoryWrapper = () => {
  const { user } = useAuthStore();
  
  if (!user?.pharmacy_id) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500">Aucune pharmacie sélectionnée</p>
      </div>
    );
  }
  
  return <Inventory pharmacyId={user.pharmacy_id} />;
};

const MonitoringWrapper = () => {
  const { user } = useAuthStore();
  
  if (!user?.tenant_id) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-slate-500">Aucun tenant trouvé</p>
      </div>
    );
  }
  
  return <Monitoring tenantId={user.tenant_id} />;
};

const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
    <h2 className="text-xl font-bold">{title}</h2>
    <p className="text-sm">Ce module est actuellement en cours de développement.</p>
  </div>
);

const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500">
    <div className="text-6xl font-black text-slate-200 mb-4">404</div>
    <h1 className="text-xl font-bold text-slate-800 mb-2">Page non trouvée</h1>
    <p className="text-slate-500 mb-6 text-center max-w-xs">
      Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
    </p>
    <button
      onClick={() => (window.location.href = '/dashboard')}
      className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
    >
      Retour au tableau de bord
    </button>
  </div>
);

// routes/AppRoutes.tsx - Version optimisée avec normalisation

// ========== LAYOUT ADMIN ==========
const AdminLayout = () => {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }
  
  // Après normalisation, 'vendeur' devient 'seller'
  // Donc on vérifie uniquement 'seller' (pas besoin de 'vendeur')
  const isAuthorized = user && 
                       user.role !== 'super_admin' && 
                       user.role !== 'seller';
  
  if (!isAuthorized) {
    console.log('Accès refusé - AdminLayout:', { role: user?.role });
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          <ExpiryWarningBanner />
          <div className="space-y-6">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
};

// ========== LAYOUT VENDEUR ==========
const VendorLayout = () => {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }
  
  // La normalisation convertit 'vendeur' → 'seller'
  const isSeller = user?.role === 'seller';
  
  if (!isSeller) {
    console.log('Accès refusé - VendorLayout:', { role: user?.role });
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Outlet />
    </div>
  );
};

// ========== LAYOUT SUPER ADMIN ==========
const SuperAdminLayout = () => {
  const { user, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }
  
  const isSuperAdmin = user?.role === 'super_admin';
  
  if (!isSuperAdmin) {
    console.log('Accès refusé - SuperAdminLayout:', { role: user?.role });
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
};

// ========== LAYOUT PUBLIC ==========
const PublicLayout = () => {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-linear-to-br from-blue-50 to-indigo-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }
  
  if (isAuthenticated && user) {
    // Utiliser les rôles normalisés
    switch (user.role) {
      case 'super_admin':
        return <Navigate to="/super-admin" replace />;
      case 'seller':  // 'vendeur' est déjà normalisé en 'seller'
        return <Navigate to="/vendor-pos" replace />;
      default:
        // admin, user, pharmacien, caissier, comptable, etc.
        return <Navigate to="/dashboard" replace />;
    }
  }
  
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <Outlet />
    </div>
  );
};

// ========== COMPOSANT DE CHARGEMENT GLOBAL ==========

const GlobalLoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
      <p className="text-slate-500">Chargement de l'application...</p>
    </div>
  </div>
);

// ========== ROUTES PRINCIPALES ==========

export default function AppRoutes() {
  const { isLoading: isAuthLoading } = useAuthStore(); // Supprimer isInitialized
  const [showRoutes, setShowRoutes] = useState(false);
  
  // Attendre que l'auth soit complètement initialisée avant d'afficher les routes
  useEffect(() => {
    // isAuthLoading devient false après la rehydratation complète
    if (!isAuthLoading) {
      // Petit délai pour stabiliser
      const timer = setTimeout(() => {
        setShowRoutes(true);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isAuthLoading]);
  
  // Afficher le loader pendant l'initialisation
  if (!showRoutes) {
    return <GlobalLoadingSpinner />;
  }
  
  return (
    <Routes>
      {/* ROUTES PUBLIQUES */}
      <Route element={<PublicLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/out-of-service" element={<OutOfService />} />
        <Route path="/super-admin/register" element={<SuperAdminRegister />} />
        <Route path="/superadmin-welcome" element={<SuperAdminWelcome />} />
      </Route>
      
      {/* ROUTES SUPER ADMIN */}
      <Route path="/super-admin" element={<SuperAdminLayout />}>
        <Route index element={<SuperAdminDashboard />} />
        <Route path="tenant/:tenantId" element={<SuperAdminDashboard />} />
        <Route path="tenant" element={<Navigate to="/super-admin" replace />} />
      </Route>
      
      {/* ROUTES VENDEUR */}
      <Route path="/vendor-pos" element={<VendorLayout />}>
        <Route index element={<VendorPos />} />
        <Route path="stock-report" element={<StockReport />} />
      </Route>
      
      {/* ROUTES ADMIN */}
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
      </Route>
      
      <Route path="/dashboard" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
      </Route>
      
      <Route path="/factures" element={<AdminLayout />}>
        <Route index element={<FactureManager />} />
      </Route>
      
      <Route path="/historique" element={<AdminLayout />}>
        <Route index element={<Historique />} />
      </Route>
      
      <Route path="/rapports" element={<AdminLayout />}>
        <Route index element={<Rapports />} />
      </Route>
      
      <Route path="/stock" element={<AdminLayout />}>
        <Route index element={<InventoryListView />} />
      </Route>
      
      <Route path="/inventaire" element={<AdminLayout />}>
        <Route index element={<InventoryWrapper />} />
      </Route>
      
      <Route path="/transfers" element={<AdminLayout />}>
        <Route index element={<TransferList />} />
      </Route>
      
      <Route path="/returns" element={<AdminLayout />}>
        <Route index element={<ReturnPage />} />
      </Route>
      
      <Route path="/monitoring" element={<AdminLayout />}>
        <Route index element={<MonitoringWrapper />} />
      </Route>
      
      <Route path="/finance" element={<AdminLayout />}>
        <Route index element={<FinanceAnalysis />} />
      </Route>
      
      <Route path="/capital" element={<AdminLayout />}>
        <Route index element={<CapitalPage />} />
      </Route>
      
      <Route path="/pharmacie/:pharmacyId/capital" element={<AdminLayout />}>
        <Route index element={<CapitalPage />} />
      </Route>
      
      <Route path="/expenses" element={<AdminLayout />}>
        <Route index element={<Expense />} />
      </Route>

      <Route path="/debts" element={<AdminLayout />}>
        <Route index element={<DebtPage />} />
      </Route>
      
      <Route path="/profits" element={<AdminLayout />}>
        <Route index element={<ProfitAnalysis />} />
      </Route>
      
      <Route path="/suppliers" element={<AdminLayout />}>
        <Route index element={<SupplierCreditPage />} />
      </Route>

      <Route path="/corbeil" element={<AdminLayout />}>
        <Route index element={<CorbeillePage />} />
      </Route>
      
      <Route path="/clients" element={<AdminLayout />}>
        <Route index element={<PlaceholderPage title="Répertoire Clients" />} />
      </Route>
      
      <Route path="/users" element={<AdminLayout />}>
        <Route index element={<UserPageControl />} />
      </Route>
      
      <Route path="/reports" element={<AdminLayout />}>
        <Route index element={<PlaceholderPage title="Rapports & Statistiques" />} />
      </Route>
      
      <Route path="/subscription" element={<AdminLayout />}>
        <Route index element={<SubscriptionPage />} />
      </Route>
      
      <Route path="/payment" element={<AdminLayout />}>
        <Route index element={<PaymentPage />} />
      </Route>
      
      <Route path="/payment-success" element={<AdminLayout />}>
        <Route index element={<PaymentSuccessPage />} />
      </Route>
      
      <Route path="/activate-code" element={<AdminLayout />}>
        <Route index element={<ActivationCodePage />} />
      </Route>
      
      <Route path="/settings" element={<AdminLayout />}>
        <Route index element={<ConfigViewWrapper />} />
      </Route>
      
      <Route path="/settings/:pharmacyId" element={<AdminLayout />}>
        <Route index element={<ConfigViewWrapper />} />
      </Route>
      
      <Route path="/generate-code" element={<AdminLayout />}>
        <Route index element={<AdminGenerateCodePage />} />
      </Route>

      <Route path="/alerts/:pharmacyId" element={<Alerts />}>
        <Route index element={<ConfigViewWrapper />} />
      </Route>
      
      {/* REDIRECTIONS */}
      <Route path="/inventory" element={<Navigate to="/stock" replace />} />
      <Route path="/stock-report" element={<Navigate to="/vendor-pos/stock-report" replace />} />
      
      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}