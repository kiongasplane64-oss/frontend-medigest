// SuperAdminDashboard.tsx
import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout';

/**
 * Composant principal du tableau de bord Super Admin
 * Ce composant sert de point d'entrée et délègue le rendu à SuperAdminLayout
 * qui gère toute la logique d'affichage, la sidebar et les différentes sections
 */
export default function SuperAdminDashboard() {
  return <SuperAdminLayout />;
}