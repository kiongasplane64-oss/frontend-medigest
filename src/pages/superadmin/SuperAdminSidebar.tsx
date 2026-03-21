// SuperAdminSidebar.tsx
// Composant de barre latérale pour le tableau de bord super administrateur

import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Server, 
  FileText, 
  Settings,
  Key,
  ChevronLeft,
  ChevronRight,
  Shield,
  LogOut
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { ActiveMenu } from './superAdminLayout'

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

interface SidebarProps {
  activeMenu: ActiveMenu;
  onMenuChange: (menu: ActiveMenu) => void;
}

interface MenuItem {
  id: ActiveMenu;
  label: string;
  icon: React.ElementType;
  group?: string;
  badge?: number;
  disabled?: boolean;
}

interface GroupedMenuItems {
  [group: string]: MenuItem[];
}

// ============================================================================
// CONFIGURATION DES MENUS
// ============================================================================

const MENU_GROUPS = {
  PRINCIPAL: 'principal',
  OUTILS: 'outils',
  ADMINISTRATION: 'administration'
} as const;

const GROUP_LABELS: Record<string, string> = {
  [MENU_GROUPS.PRINCIPAL]: 'Principal',
  [MENU_GROUPS.OUTILS]: 'Outils',
  [MENU_GROUPS.ADMINISTRATION]: 'Administration'
};

const MENU_ITEMS: MenuItem[] = [
  // Groupe Principal
  { id: 'overview', label: 'Vue d\'ensemble', icon: LayoutDashboard, group: MENU_GROUPS.PRINCIPAL },
  { id: 'tenants', label: 'Tenants', icon: Building2, group: MENU_GROUPS.PRINCIPAL },
  { id: 'users', label: 'Utilisateurs', icon: Users, group: MENU_GROUPS.PRINCIPAL },
  { id: 'subscriptions', label: 'Abonnements', icon: CreditCard, group: MENU_GROUPS.PRINCIPAL },
  { id: 'analytics', label: 'Analytique', icon: TrendingUp, group: MENU_GROUPS.PRINCIPAL },
  
  // Groupe Outils
  { id: 'generate-codes', label: 'Générer codes', icon: Key, group: MENU_GROUPS.OUTILS },
  
  // Groupe Administration
  { id: 'system', label: 'Système', icon: Server, group: MENU_GROUPS.ADMINISTRATION },
  { id: 'logs', label: 'Journaux', icon: FileText, group: MENU_GROUPS.ADMINISTRATION },
  { id: 'settings', label: 'Configuration', icon: Settings, group: MENU_GROUPS.ADMINISTRATION }
];

// ============================================================================
// COMPOSANTS
// ============================================================================

interface MenuItemButtonProps {
  item: MenuItem;
  isActive: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const MenuItemButton = ({ item, isActive, collapsed, onClick }: MenuItemButtonProps) => {
  const Icon = item.icon;
  
  return (
    <button
      onClick={onClick}
      disabled={item.disabled}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl 
        transition-all duration-200 group relative
        ${isActive 
          ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
          : 'text-white/70 hover:bg-white/10 hover:text-white'
        }
        ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
      title={collapsed ? item.label : undefined}
    >
      <Icon size={20} className={`shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`} />
      
      {!collapsed && (
        <span className="font-medium text-sm truncate">{item.label}</span>
      )}
      
      {collapsed && (
        <div className="
          absolute left-full ml-2 px-2 py-1 
          bg-slate-800 text-white text-xs font-medium 
          rounded-lg opacity-0 group-hover:opacity-100 
          transition-opacity pointer-events-none 
          whitespace-nowrap z-50 shadow-lg
        ">
          {item.label}
        </div>
      )}
      
      {item.badge && !collapsed && (
        <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
          {item.badge}
        </span>
      )}
    </button>
  );
};

interface MenuGroupProps {
  groupName: string;
  items: MenuItem[];
  activeMenu: ActiveMenu;
  collapsed: boolean;
  onMenuChange: (menu: ActiveMenu) => void;
}

const MenuGroup = ({ groupName, items, activeMenu, collapsed, onMenuChange }: MenuGroupProps) => {
  if (items.length === 0) return null;
  
  return (
    <div className="space-y-1">
      {!collapsed && (
        <p className="text-[10px] font-bold text-white/40 uppercase tracking-wider mb-3 px-3">
          {GROUP_LABELS[groupName] || groupName}
        </p>
      )}
      {items.map((item) => (
        <MenuItemButton
          key={item.id}
          item={item}
          isActive={activeMenu === item.id}
          collapsed={collapsed}
          onClick={() => onMenuChange(item.id)}
        />
      ))}
    </div>
  );
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function SuperAdminSidebar({ activeMenu, onMenuChange }: SidebarProps) {
  const navigate = useNavigate();
  const { logout, user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  
  // Regrouper les éléments du menu par groupe
  const groupedItems = MENU_ITEMS.reduce<GroupedMenuItems>((acc, item) => {
    const group = item.group || 'autre';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
  
  // Gestion de la déconnexion
  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };
  
  return (
    <aside 
      className={`
        bg-linear-to-b from-slate-900 to-slate-800 
        text-white transition-all duration-300 ease-in-out 
        flex flex-col shadow-2xl
        ${collapsed ? 'w-20' : 'w-72'}
      `}
    >
      {/* ==================== LOGO ==================== */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20 shrink-0">
              <Shield size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg truncate">MEDIGEST</h1>
              <p className="text-[10px] text-white/50 truncate">
                {user?.nom_complet || 'Super Admin'}
              </p>
            </div>
          </div>
        )}
        
        {collapsed && (
          <div className="w-full flex justify-center">
            <div className="h-10 w-10 bg-linear-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <Shield size={20} className="text-white" />
            </div>
          </div>
        )}
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          aria-label={collapsed ? 'Développer le menu' : 'Réduire le menu'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>
      
      {/* ==================== MENU PRINCIPAL ==================== */}
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
        <div className="space-y-6">
          {Object.entries(groupedItems).map(([group, items]) => (
            <MenuGroup
              key={group}
              groupName={group}
              items={items}
              activeMenu={activeMenu}
              collapsed={collapsed}
              onMenuChange={onMenuChange}
            />
          ))}
        </div>
      </nav>
      
      {/* ==================== FOOTER ==================== */}
      <div className="p-4 border-t border-white/10 space-y-3">
        {/* Version */}
        {!collapsed && (
          <div className="text-[10px] text-white/30 text-center">
            <p>MEDIGEST v1.0.0</p>
            <p className="mt-0.5">© 2024 - Tous droits réservés</p>
          </div>
        )}
        
        {/* Bouton de déconnexion */}
        <button
          onClick={handleLogout}
          className={`
            w-full flex items-center gap-3 px-3 py-2.5 
            rounded-xl transition-all duration-200
            text-white/60 hover:bg-white/10 hover:text-white
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Déconnexion' : undefined}
        >
          <LogOut size={20} className="shrink-0" />
          {!collapsed && (
            <span className="font-medium text-sm">Déconnexion</span>
          )}
          {collapsed && (
            <div className="
              absolute left-full ml-2 px-2 py-1 
              bg-slate-800 text-white text-xs font-medium 
              rounded-lg opacity-0 group-hover:opacity-100 
              transition-opacity pointer-events-none 
              whitespace-nowrap z-50 shadow-lg
            ">
              Déconnexion
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}