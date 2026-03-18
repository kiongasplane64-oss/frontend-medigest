// components/Sidebar.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAlerts } from '@/hooks/useAlerts';
import { useSubscription } from '@/hooks/useSubscription';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '@/api/client';
import { 
  ShoppingCart, Package, ArrowLeftRight, 
  RotateCcw, BadgeEuro, TrendingUp, Users, FileText, 
  Settings, Truck, UserCircle, Wallet, Bell, AlertTriangle,
  LayoutDashboard, Menu, X, LogOut, ChevronDown,
  DollarSign, HelpCircle, History, ShoppingBag,
  LineChart, CreditCard, UsersRound, TruckIcon,
  Clock, Calculator, Crown, Info
} from 'lucide-react'; // Retiré 'Shield' qui n'est pas utilisé
import NotificationDrawer from './NotificationDrawer';
import OutOfService from '@/modules/core/endehors';
import { useTimezone } from '@/hooks/useTimezone';

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

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  timezone?: string;
  daysOff: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

// Supprimé l'interface PharmacyConfig qui n'est pas utilisée

// Fonction utilitaire pour formater le rôle
const formatRole = (role: string): string => {
  return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Configuration des menus mise à jour
const menuGroups: MenuGroup[] = [
  {
    title: "Général",
    items: [
      { 
        icon: <LayoutDashboard size={20}/>, 
        label: 'Tableau de bord', 
        href: '/dashboard', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste", "preparateur"] 
      }
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
        label: 'Inventaire', 
        href: '/inventory', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "stockiste", "preparateur"],
        badge: (alerts) => alerts?.length || null
      },
      { 
        icon: <ShoppingBag size={20}/>, 
        label: 'Achats', 
        href: '/purchases', 
        roles: ["super_admin", "admin", "gestionnaire", "stockiste"] 
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
      { 
        icon: <TruckIcon size={20}/>, 
        label: 'Livraisons', 
        href: '/deliveries', 
        roles: ["super_admin", "admin", "gestionnaire", "pharmacien"] 
      }
    ]
  },
  {
    title: "Gestion",
    items: [
      { 
        icon: <History size={20}/>, 
        label: 'Historique', 
        href: '/history', 
        roles: ["super_admin", "admin", "gestionnaire", "comptable", "pharmacien"] 
      },
      { 
        icon: <CreditCard size={20}/>, 
        label: 'Dettes', 
        href: '/debts', 
        roles: ["super_admin", "admin", "comptable", "gestionnaire"] 
      },
      { 
        icon: <LineChart size={20}/>, 
        label: 'Monitoring', 
        href: '/monitoring', 
        roles: ["super_admin", "admin", "gestionnaire"] 
      },
      { 
        icon: <Calculator size={20}/>, 
        label: 'Capital', 
        href: '/capital', 
        roles: ["super_admin", "admin", "comptable"] 
      }
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
      }
    ]
  },
  {
    title: "Ressources humaines",
    items: [
      { 
        icon: <UsersRound size={20}/>, 
        label: 'Employés', 
        href: '/employees', 
        roles: ["super_admin", "admin", "gestionnaire"] 
      }
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
      }
    ]
  },
  {
    title: "Administration",
    items: [
      { 
        icon: <Crown size={20}/>, 
        label: 'Abonnement', 
        href: '/subscription', 
        roles: ["super_admin", "admin"] 
      },
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
        icon: <Settings size={20}/>, 
        label: 'Paramètres', 
        href: '/settings', 
        roles: ["super_admin", "admin"] 
      }
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
      }
    ]
  }
];

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { alerts } = useAlerts();
  const { isExpired, daysRemaining, plan_name, subscription } = useSubscription();
  
  const timezoneHook = useTimezone();
  const browserTimezone = timezoneHook.timezone;
  const browserOffset = timezoneHook.offset;
  
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(menuGroups.map(g => g.title));
  const [showServiceInfo, setShowServiceInfo] = useState<boolean>(false);
  
  // États pour la vérification des heures de service
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
  const [loadingService, setLoadingService] = useState<boolean>(true);
  const [showOutOfService, setShowOutOfService] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  // Détecter si on est sur mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Calculer le temps restant avant la fermeture
  const calculateTimeRemaining = useCallback((): string | null => {
    if (!serviceStatus?.in_service || !workingHours?.endTime) return null;

    const now = new Date();
    const [endHours, endMinutes] = workingHours.endTime.split(':').map(Number);
    
    const endTime = new Date();
    endTime.setHours(endHours, endMinutes, 0);
    
    if (now > endTime) {
      // Déjà après l'heure de fermeture
      return null;
    }
    
    const diffMs = endTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    
    if (diffHours > 0) {
      return `${diffHours}h ${remainingMinutes}min`;
    } else {
      return `${remainingMinutes}min`;
    }
  }, [serviceStatus, workingHours]);

  // Charger la configuration et le statut du service
  useEffect(() => {
    const loadServiceStatus = async () => {
      if (!user?.pharmacy_id) {
        setLoadingService(false);
        return;
      }

      try {
        // Charger la configuration pour les heures de service
        const configResponse = await api.get<{ config: { workingHours: WorkingHours } }>(
          `/pharmacies/${user.pharmacy_id}/config`
        );
        
        if (configResponse.data?.config?.workingHours) {
          setWorkingHours(configResponse.data.config.workingHours);
        }

        // Vérifier le statut du service
        const statusResponse = await api.get<ServiceStatus>(
          `/pharmacies/${user.pharmacy_id}/service-status`
        );
        
        setServiceStatus(statusResponse.data);
        setShowOutOfService(!statusResponse.data.in_service);
        
      } catch (err) {
        console.error('Erreur lors du chargement du service:', err);
      } finally {
        setLoadingService(false);
      }
    };

    loadServiceStatus();

    // Vérifier le statut toutes les minutes
    const interval = setInterval(async () => {
      if (user?.pharmacy_id) {
        try {
          const response = await api.get<ServiceStatus>(
            `/pharmacies/${user.pharmacy_id}/service-status`
          );
          setServiceStatus(response.data);
          setShowOutOfService(!response.data.in_service);
        } catch (err) {
          console.error('Erreur lors de la vérification du service:', err);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // Mettre à jour le temps restant toutes les minutes
  useEffect(() => {
    if (serviceStatus?.in_service) {
      setTimeRemaining(calculateTimeRemaining());
      
      const timer = setInterval(() => {
        setTimeRemaining(calculateTimeRemaining());
      }, 60000);
      
      return () => clearInterval(timer);
    }
  }, [serviceStatus, calculateTimeRemaining]);

  // Intercepter la navigation
  useEffect(() => {
    const checkNavigation = async () => {
      if (location.pathname === '/login' || location.pathname === '/logout' || 
          location.pathname === '/out-of-service' || showOutOfService) {
        return;
      }

      if (!user?.pharmacy_id) return;

      try {
        const response = await api.get<ServiceStatus>(
          `/pharmacies/${user.pharmacy_id}/service-status`
        );
        
        if (!response.data.in_service) {
          setShowOutOfService(true);
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du service:', err);
      }
    };

    checkNavigation();
  }, [location.pathname, user, showOutOfService]);

  // Fermer la sidebar quand on change de page sur mobile
  useEffect(() => {
    if (isMobile && !showOutOfService) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile, showOutOfService]);

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

  // Si en chargement
  if (loadingService) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">Vérification des heures de service...</p>
        </div>
      </div>
    );
  }

  // Afficher la page hors service
  if (showOutOfService) {
    const workingHoursForDisplay = workingHours ? {
      enabled: workingHours.enabled,
      startTime: workingHours.startTime,
      endTime: workingHours.endTime,
      overtimeEndTime: workingHours.overtimeEndTime,
      daysOff: workingHours.daysOff
    } : undefined;

    return (
      <OutOfService 
        workingHours={workingHoursForDisplay}
        message={serviceStatus?.message || "L'application n'est pas disponible en dehors des heures de service."}
        nextServiceTime={serviceStatus?.next_service_time}
      />
    );
  }

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
              MedigestPro
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                {formatRole(userRole)}
              </span>
              {serviceStatus?.in_service && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 rounded-full">
                  <span className="text-[6px] sm:text-[8px] text-green-700 font-bold">EN SERVICE</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Bouton d'information sur le service */}
            <div className="relative">
              <button
                onClick={() => setShowServiceInfo(!showServiceInfo)}
                onBlur={() => setTimeout(() => setShowServiceInfo(false), 200)}
                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all relative"
                aria-label="Informations service"
                title="Temps de service restant"
              >
                <Info size={18} className="sm:w-5 sm:h-5" />
                {timeRemaining && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </button>
              
              {/* Tooltip d'information */}
              {showServiceInfo && (
                <div className="absolute right-0 top-10 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-50 text-xs">
                  <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-1">
                    <Clock size={14} className="text-blue-500" />
                    Horaires de service
                  </h4>
                  
                  {workingHours && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Heures:</span>
                        <span className="font-medium">{workingHours.startTime} - {workingHours.endTime}</span>
                      </div>
                      
                      {timeRemaining && (
                        <div className="bg-green-50 p-2 rounded-lg">
                          <p className="text-green-700 font-medium text-center">
                            ⏳ Fermeture dans {timeRemaining}
                          </p>
                        </div>
                      )}
                      
                      {workingHours.overtimeEndTime && (
                        <div className="flex justify-between text-amber-600 text-[10px]">
                          <span>Supplément:</span>
                          <span>jusqu'à {workingHours.overtimeEndTime}</span>
                        </div>
                      )}
                      
                      <div className="border-t border-slate-100 pt-2 mt-1">
                        <p className="text-[10px] text-slate-400 mb-1">Fuseau: {workingHours.timezone || 'Africa/Kinshasa'}</p>
                        <p className="text-[10px] text-slate-400">Votre fuseau: {browserTimezone} (UTC{browserOffset >= 0 ? '+' : ''}{browserOffset})</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
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
                        className={`flex items-center justify-between gap-2 sm:gap-3 p-2 sm:p-2.5 rounded-lg transition-all group cursor-pointer ${
                          active 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                            : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                        title={item.label}
                        onClick={() => isMobile && setIsSidebarOpen(false)}
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