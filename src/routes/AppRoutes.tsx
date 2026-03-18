import { Routes, Route, Navigate } from 'react-router-dom';
import { PrivateRoute, PublicRoute, RoleBasedRoute } from '@/components/auth/AuthGuards';

// SuperAdmins
import SuperAdminDashboard from '@/pages/superadmin/SuperAdminDashboard';
import SuperAdminRegister from '@/pages/superadmin/SuperAdminRegister';

// Pages - Auth
import Login from '@/modules/auth/views/Login';
import Register from '@/pages/Register';
import VerifyOtp from '@/pages/VerifyOtp';

// Layouts
import Sidebar from '@/layouts/Sidebar';

// Vues du Dashboard
import Dashboard from '@/modules/stats/views/Dashboard';
import InventoryList from '@/modules/inventory/views/InventoryList';
import POS from '@/modules/sales/views/POS';
import TransferList from '@/modules/inventory/views/TransferList';
import ProfitAnalysis from '@/modules/benefice/views/benefice';
import FinanceAnalysis from '@/modules/finance/views/FinanceDashboard';
import ExpensesManager from '@/modules/finance/views/Expenses';
import ReturnsManager from '@/modules/finance/views/ReturnManager';
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

/**
 * Composant pour les modules en cours de développement
 */
const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400">
    <h2 className="text-xl font-bold">{title}</h2>
    <p className="text-sm">Ce module est actuellement en cours de développement.</p>
  </div>
);

/**
 * Composant pour la page 404
 */
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

export default function AppRoutes() {
  return (
    <Routes>
      {/* ========== ROUTES SUPER ADMIN PUBLIQUES (SANS GUARDS) ========== */}
      {/* Ces routes sont en dehors de tout guard pour permettre l'installation initiale */}
      <Route path="/super-admin/register" element={<SuperAdminRegister />} />
      
      {/* ========== ROUTES PUBLIQUES AVEC GUARDS ========== */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Route OTP accessible sans authentification complète */}
      <Route path="/verify-otp" element={<VerifyOtp />} />

      {/* ========== ROUTE HORS SERVICE (PUBLIQUE) ========== */}
      {/* Cette route doit être accessible même sans authentification */}
      <Route path="/out-of-service" element={<OutOfService />} />

      {/* ========== ROUTES PRIVÉES (Utilisateurs connectés) ========== */}
      <Route element={<PrivateRoute />}>
        <Route element={<Sidebar />}>
          {/* === Dashboard général === */}
          <Route path="/dashboard" element={<Dashboard />} />
          
          {/* === Opérations commerciales === */}
          <Route path="/sales" element={<POS />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/factures" element={<Facture />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/inventory" element={<InventoryList />} />
          <Route path="/transfers" element={<TransferList />} />
          <Route path="/returns" element={<ReturnsManager />} />
          
          {/* === Finance & Comptabilité === */}
          <Route path="/finance" element={<FinanceAnalysis />} />
          <Route path="/expenses" element={<ExpensesManager />} />
          <Route path="/profits" element={<ProfitAnalysis />} />
          
          {/* === Partenaires & Relations === */}
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/clients" element={<PlaceholderPage title="Répertoire Clients" />} />
          
          {/* === Administration & Gestion === */}
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reports" element={<PlaceholderPage title="Rapports & Statistiques" />} />
          <Route path="/subscription" element={<SubscriptionPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment-success" element={<PaymentSuccessPage />} />
          <Route path="/settings" element={<ConfigViewWrapper />} />
          <Route path="/settings/:pharmacyId" element={<ConfigViewWrapper />} />
          
          {/* === Redirection par défaut === */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Route>

      {/* ========== ROUTES SUPER ADMIN PROTÉGÉES ========== */}
      <Route
        path="/super-admin"
        element={
          <RoleBasedRoute allowedRoles={['super-admin']}>
            <SuperAdminDashboard />
          </RoleBasedRoute>
        }
      />

      {/* Sous-route pour les détails de tenant */}
      <Route
        path="/super-admin/tenant/:tenantId"
        element={
          <RoleBasedRoute allowedRoles={['super-admin']}>
            <SuperAdminDashboard />
          </RoleBasedRoute>
        }
      />

      {/* Redirection pour /super-admin/tenant sans ID */}
      <Route
        path="/super-admin/tenant"
        element={
          <RoleBasedRoute allowedRoles={['super-admin']}>
            <Navigate to="/super-admin" replace />
          </RoleBasedRoute>
        }
      />

      {/* ========== GESTION DES ERREURS 404 ========== */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}