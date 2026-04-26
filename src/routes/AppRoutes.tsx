// routes/AppRoutes.tsx
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { PrivateRoute, PublicRoute, RoleBasedRoute } from '@/components/auth/AuthGuards';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { useSubscription } from '@/hooks/useSubscription';

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
// CORRECTION: Utiliser le bon nom de fichier (casing)
import { NoSubscriptionGuard } from '@/components/NoSubscriptionGuard';
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
import ExpensesManager from '@/modules/finance/views/Expenses';
import ReturnPage from '@/modules/finance/views/returnPage';
import SubscriptionPage from '@/pages/SubscriptionPage';
import UsersPage from '@/pages/UsersPage';
import Suppliers from '@/modules/inventory/views/Suppliers';
import PaymentPage from '@/pages/PaymentPage';
import PaymentSuccessPage from '@/pages/PaymentSuccessPage';
import ConfigViewWrapper from '@/modules/core/ConfigViewWrapper';
import Facture from '@/modules/sales/views/Facture';
import Rapports from '@/modules/sales/views/Rapports';
import Historique from '@/modules/sales/views/Historique';
import OutOfService from '@/modules/core/endehors';
import Monitoring from '@/modules/inventory/views/monitoring';
import Inventory from '@/modules/inventory/views/inventory';
import { useAuthStore } from '@/store/useAuthStore';
import CapitalPage from '@/modules/finance/capital/capital';
import StockReport from '@/modules/vendor/stockReport';

// ========== COMPOSANTS WRAPPERS ==========

// Composant wrapper pour Inventory avec useAuthStore
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

// Composant wrapper pour Monitoring avec useAuthStore
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

// Composant pour les modules en cours de développement
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
    <h2 className="text-xl font-bold">{title}</h2>
    <p className="text-sm">Ce module est actuellement en cours de développement.</p>
  </div>
);

// Composant pour la page 404
const NotFoundPage = () => (
  <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-500">
    <div className="text-6xl font-black text-slate-200 mb-4">404</div>
    <h1 className="text-xl font-bold text-slate-800 mb-2">Page non trouvée</h1>
    <p className="text-slate-500 mb-6 text-center max-w-xs">
      Désolé, la page que vous recherchez n'existe pas ou a été déplacée.
    </p>
    <button
      onClick={() => window.location.href = '/dashboard'}
      className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
    >
      Retour au tableau de bord
    </button>
  </div>
);

// ========== COMPOSANT LAYOUT AVEC PROTECTION ABONNEMENT ==========

/**
 * Layout principal avec Sidebar et protection d'abonnement
 * Affiche la bannière d'alerte d'expiration
 * Protège l'accès aux routes avec NoSubscriptionGuard
 */
const ProtectedLayout = () => {
  const { isLoading } = useSubscription();
  
  // Ne pas afficher pendant le chargement
  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-slate-500">Chargement de votre abonnement...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6">
          {/* Bannière d'alerte d'expiration */}
          <ExpiryWarningBanner />
          
          {/* Protection d'abonnement - bloque l'accès si abonnement expiré */}
          <NoSubscriptionGuard>
            {/* Les routes enfants seront rendues ici */}
            <div className="space-y-6">
              <Outlet />
            </div>
          </NoSubscriptionGuard>
        </div>
      </div>
    </div>
  );
};

// ========== COMPOSANT LAYOUT SUPER ADMIN ==========

/**
 * Layout Super Admin sans Sidebar
 * Les super admins n'ont pas de restriction d'abonnement
 */
const SuperAdminLayout = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
    </div>
  );
};

// ========== COMPOSANT LAYOUT PUBLIC ==========

/**
 * Layout public pour les pages d'authentification
 */
const PublicLayout = () => {
  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      <Outlet />
    </div>
  );
};

// ========== ROUTES PRINCIPALES ==========

export default function AppRoutes() {
  // 🔥 HOOK DE REDIRECTION CENTRALISÉ AU NIVEAU RACINE
  useAuthRedirect();
  
  return (
    <Routes>
      {/* ========== ROUTES SUPER ADMIN PUBLIQUES ========== */}
      <Route path="/super-admin/register" element={<SuperAdminRegister />} />
      <Route path="/superadmin-welcome" element={<SuperAdminWelcome />} />
      
      {/* ========== ROUTES PUBLIQUES (AUTH) ========== */}
      <Route element={<PublicRoute />}>
        <Route element={<PublicLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>
      
      <Route element={<PublicLayout />}>
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/out-of-service" element={<OutOfService />} />
      </Route>
      
      {/* ========== ROUTES PRIVÉES AVEC PROTECTION ABONNEMENT ========== */}
      <Route element={<PrivateRoute />}>
        <Route element={<ProtectedLayout />}>
          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* Opérations commerciales */}
          <Route path="/vendor-pos" element={<VendorPos />} />
          <Route path="/factures" element={<Facture />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/stock-report" element={<StockReport />} />
          
          {/* Gestion des stocks */}
          <Route path="/stock" element={<InventoryListView />} />
          <Route path="/inventaire" element={<InventoryWrapper />} />
          <Route path="/transfers" element={<TransferList />} />
          <Route path="/returns" element={<ReturnPage />} />
          
          {/* Monitoring */}
          <Route path="/monitoring" element={<MonitoringWrapper />} />
          
          {/* Finance */}
          <Route path="/finance" element={<FinanceAnalysis />} />
          <Route path="/capital" element={<CapitalPage />} />
          <Route path="/pharmacie/:pharmacyId/capital" element={<CapitalPage />} />
          <Route path="/expenses" element={<ExpensesManager />} />
          <Route path="/profits" element={<ProfitAnalysis />} />
          
          {/* Partenaires */}
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/clients" element={<PlaceholderPage title="Répertoire Clients" />} />
          
          {/* Administration */}
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reports" element={<PlaceholderPage title="Rapports & Statistiques" />} />
          
          {/* Abonnement - Toujours accessible même en lecture seule */}
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
          <Route path="/activate-code" element={<ActivationCodePage />} />
          
          {/* Configuration */}
          <Route path="/settings" element={<ConfigViewWrapper />} />
          <Route path="/settings/:pharmacyId" element={<ConfigViewWrapper />} />
          
          {/* Super admin - Génération de codes (accessible aux admins aussi) */}
          <Route path="/generate-code" element={<AdminGenerateCodePage />} />
          
          {/* Redirection par défaut */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>
      
      {/* ========== ROUTES SUPER ADMIN PROTÉGÉES (SANS SIDEBAR) ========== */}
      <Route
        path="/super-admin"
        element={
          <RoleBasedRoute allowedRoles={['super_admin']}>
            <SuperAdminLayout />
          </RoleBasedRoute>
        }
      >
        <Route index element={<SuperAdminDashboard />} />
        <Route path="tenant/:tenantId" element={<SuperAdminDashboard />} />
        <Route path="tenant" element={<Navigate to="/super-admin" replace />} />
      </Route>
      
      {/* ========== REDIRECTIONS POUR COMPATIBILITÉ ========== */}
      <Route path="/inventory" element={<Navigate to="/stock" replace />} />
      
      {/* ========== 404 NOT FOUND ========== */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}