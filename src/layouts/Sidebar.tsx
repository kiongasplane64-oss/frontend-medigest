import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAlerts } from '@/hooks/useAlerts';
import { useSubscription } from '@/hooks/useSubscription';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, Package, ArrowLeftRight, 
  RotateCcw, BadgeEuro, TrendingUp, Users, FileText, 
  Settings, Truck, UserCircle, Wallet, Bell, AlertTriangle,
  LayoutDashboard, Menu, X, LogOut, Home, ChevronDown,
  DollarSign, Shield, HelpCircle
} from 'lucide-react';
import NotificationDrawer from './NotificationDrawer';

// Types
type Role = "super_admin" | "admin" | "gestionnaire" | "pharmacien" | "caissier" | "vendeur" | "comptable" | "stockiste" | "preparateur";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  roles: Role[];
  badge?: (alerts?: any) => number | null;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

// Fonction utilitaire pour formater le rôle
const formatRole = (role: string): string => {
  return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Configuration des menus
const menuGroups: MenuGroup[] = [
  {
    title: "Général",
    items: [
      { 
        icon: <LayoutDashboard size={20}/>, 
        label: 'Tableau de bord', 
        href: '/dashboard', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste", "preparateur"] 
      },
      { 
        icon: <Home size={20}/>, 
        label: 'Accueil', 
        href: '/', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste", "preparateur"] 
      },
    ]
  },
  {
    title: "Opérations",
    items: [
      { 
        icon: <ShoppingCart size={20}/>, 
        label: 'Ventes', 
        href: '/sales', 
        roles: ["super_admin", "admin", "pharmacien", "caissier", "vendeur"] 
      },
      { 
        icon: <Package size={20}/>, 
        label: 'Stocks', 
        href: '/inventory', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "stockiste", "preparateur"],
        badge: (alerts) => alerts?.length || null
      },
      { 
        icon: <ArrowLeftRight size={20}/>, 
        label: 'Transferts', 
        href: '/transfers', 
        roles: ["super_admin", "admin", "gestionnaire", "stockiste"] 
      },
      { 
        icon: <RotateCcw size={20}/>, 
        label: 'Retours', 
        href: '/returns', 
        roles: ["super_admin", "admin", "pharmacien", "gestionnaire"] 
      },
    ]
  },
  {
    title: "Finance",
    items: [
      { 
        icon: <BadgeEuro size={20}/>, 
        label: "Chiffre d'Affaires", 
        href: '/finance', 
        roles: ["super_admin", "admin", "comptable", "gestionnaire"] 
      },
      { 
        icon: <DollarSign size={20}/>, 
        label: 'Dépenses', 
        href: '/expenses', 
        roles: ["super_admin", "admin", "comptable", "gestionnaire"] 
      },
      { 
        icon: <TrendingUp size={20}/>, 
        label: 'Bénéfices', 
        href: '/profits', 
        roles: ["super_admin", "admin", "comptable"] 
      },
      { 
        icon: <Wallet size={20}/>, 
        label: 'Caisse', 
        href: '/cash-register', 
        roles: ["super_admin", "admin", "comptable", "caissier"] 
      },
    ]
  },
  {
    title: "Partenaires",
    items: [
      { 
        icon: <Truck size={20}/>, 
        label: 'Fournisseurs', 
        href: '/suppliers', 
        roles: ["super_admin", "admin", "gestionnaire", "stockiste"] 
      },
      { 
        icon: <UserCircle size={20}/>, 
        label: 'Clients', 
        href: '/clients', 
        roles: ["super_admin", "admin", "vendeur", "caissier", "pharmacien"] 
      },
    ]
  },
  {
    title: "Administration",
    items: [
      { 
        icon: <Users size={20}/>, 
        label: 'Utilisateurs', 
        href: '/users', 
        roles: ["super_admin", "admin"] 
      },
      { 
        icon: <FileText size={20}/>, 
        label: 'Rapports', 
        href: '/reports', 
        roles: ["super_admin", "admin", "comptable", "gestionnaire"] 
      },
      { 
        icon: <Shield size={20}/>, 
        label: 'Abonnement', 
        href: '/subscription', 
        roles: ["super_admin"] 
      },
      { 
        icon: <Settings size={20}/>, 
        label: 'Paramètres', 
        href: '/settings', 
        roles: ["super_admin", "admin"] 
      },
    ]
  },
  {
    title: "Support",
    items: [
      { 
        icon: <HelpCircle size={20}/>, 
        label: 'Aide', 
        href: '/help', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste", "preparateur"] 
      },
    ]
  }
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { alerts } = useAlerts();
  const { isExpired, daysRemaining, plan_name, subscription } = useSubscription();
  
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(menuGroups.map(g => g.title));

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fermer la sidebar quand on change de page sur mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Rôle de l'utilisateur avec fallback
  const userRole = useMemo((): Role => {
    return (user?.role as Role) || "vendeur";
  }, [user]);

  // Filtrer les groupes visibles
  const visibleGroups = useMemo(() => {
    return menuGroups.filter(group => 
      group.items.some(item => item.roles.includes(userRole))
    );
  }, [userRole]);

  // Vérifier si un élément est actif
  const isActive = useCallback((href: string): boolean => {
    if (href === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(href);
  }, [location.pathname]);

  // Gérer l'expansion des groupes
  const toggleGroup = useCallback((groupTitle: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(g => g !== groupTitle)
        : [...prev, groupTitle]
    );
  }, []);

  // Gérer la déconnexion
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }, [logout, navigate]);

  // Nombre total d'alertes non lues
  const unreadAlertsCount = useMemo(() => {
    return alerts?.length || 0;
  }, [alerts]);

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      {/* OVERLAY MOBILE */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* BARRE LATÉRALE */}
      <aside 
        className={`
          fixed md:relative z-50 h-full bg-white border-r border-slate-200 flex flex-col
          transition-all duration-300 ease-in-out shadow-xl md:shadow-none
          ${isMobile 
            ? isSidebarOpen 
              ? 'left-0 w-64' 
              : '-left-64 w-64'
            : 'w-64'
          }
        `}
        aria-label="Navigation principale"
      >
        {/* EN-TÊTE */}
        <div className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-100">
          <div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 tracking-tight">
              PharmaSaaS
            </div>
            <div className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-widest">
              {formatRole(userRole)}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsNotifOpen(true)}
              className={`relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all ${
                unreadAlertsCount > 0 ? 'animate-pulse' : ''
              }`}
              aria-label="Notifications"
              title="Voir les notifications"
            >
              <Bell size={18} className="sm:w-5 sm:h-5" />
              {unreadAlertsCount > 0 && (
                <span className="absolute top-1 right-1 w-3 h-3 sm:w-4 sm:h-4 bg-red-500 text-white text-[8px] sm:text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                  {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
                </span>
              )}
            </button>
            
            {/* Bouton fermer sur mobile */}
            {isMobile && isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                aria-label="Fermer le menu"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* ALERTE ABONNEMENT */}
        {(daysRemaining <= 7 || isExpired) && (
          <div className="px-3 sm:px-4 mt-4">
            <Link 
              to="/subscription"
              className={`flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl border transition-all hover:scale-[1.02] ${
                isExpired 
                  ? 'bg-red-50 border-red-100 text-red-700 hover:bg-red-100' 
                  : 'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100'
              }`}
            >
              <AlertTriangle size={16} className="sm:w-4.5 sm:h-4.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-tight">
                  {isExpired ? 'Abonnement Expiré' : 'Fin de période'}
                </p>
                <p className="text-[8px] sm:text-[10px] opacity-80 truncate">
                  {isExpired 
                    ? 'Renouvelez votre accès' 
                    : daysRemaining === 1 
                      ? 'Expire demain' 
                      : `Expire dans ${daysRemaining} jours`}
                </p>
              </div>
            </Link>
          </div>
        )}
        
        {/* NAVIGATION */}
        <nav className="flex-1 px-3 sm:px-4 py-4 space-y-4 sm:space-y-6 overflow-y-auto custom-scrollbar">
          {visibleGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;

            const isExpanded = expandedGroups.includes(group.title);

            return (
              <div key={group.title} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="flex items-center justify-between w-full px-2 py-1 text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider hover:text-slate-600 transition-colors"
                >
                  <span>{group.title}</span>
                  <ChevronDown 
                    size={14} 
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                
                <div className={`space-y-0.5 sm:space-y-1 overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                }`}>
                  {visibleItems.map((item) => {
                    const active = isActive(item.href);
                    const itemBadge = item.badge?.(alerts);
                    
                    return (
                      <Link
                        key={item.label}
                        to={item.href}
                        className={`flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg transition-all group ${
                          active 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                            : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                        title={item.label}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <span className={`shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}>
                            {item.icon}
                          </span>
                          <span className="text-xs sm:text-sm font-semibold truncate">{item.label}</span>
                        </div>
                        
                        {itemBadge && (
                          <span className={`shrink-0 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full ${
                            active 
                              ? 'bg-white text-blue-600' 
                              : 'bg-red-500 text-white'
                          }`}>
                            {itemBadge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* PIED DE PAGE - PROFIL */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-linear-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100 uppercase text-sm sm:text-base">
              {user?.nom_complet?.charAt(0) || user?.email?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-bold text-slate-700 truncate">
                {user?.nom_complet || user?.email || 'Utilisateur'}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[8px] sm:text-[10px] text-slate-400 font-medium truncate">
                  {plan_name || 'Gratuit'}
                </span>
                {subscription && (
                  <span className="text-[8px] sm:text-[10px] text-blue-600 font-medium">
                    • {subscription.status}
                  </span>
                )}
              </div>
              <button 
                onClick={handleLogout}
                className="text-[9px] sm:text-[11px] text-red-500 font-bold hover:text-red-700 transition-colors flex items-center gap-1 mt-1"
              >
                <LogOut size={12} />
                Déconnexion
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* BOUTON MENU MOBILE */}
      {isMobile && (
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="fixed bottom-4 right-4 z-30 bg-blue-600 text-white p-4 rounded-full shadow-lg shadow-blue-200 hover:bg-blue-700 hover:scale-110 transition-all md:hidden"
          aria-label="Ouvrir le menu"
          title="Menu"
        >
          <Menu size={24} />
        </button>
      )}

      {/* ZONE DE CONTENU PRINCIPAL */}
      <main className={`
        flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8
        transition-all duration-300
        ${isMobile ? 'w-full' : ''}
      `}>
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
          <Outlet />
        </div>
      </main>

      {/* NOTIFICATION DRAWER */}
      <NotificationDrawer 
        isOpen={isNotifOpen} 
        onClose={() => setIsNotifOpen(false)} 
        alerts={alerts} 
      />
    </div>
  );
};

export default Sidebar;