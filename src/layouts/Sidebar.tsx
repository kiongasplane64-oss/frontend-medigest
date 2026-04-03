// layouts/Sidebar.tsx
/**
 * Composant Sidebar principal de l'application
 * 
 * Fonctionnalités :
 * - Navigation principale avec groupes extensibles
 * - Gestion des alertes unifiées (stock, expiration, transferts, abonnement)
 * - Affichage des badges de notifications
 * - Gestion des horaires de service
 * - Mode lecture seule pour abonnement expiré
 * - Responsive mobile
 * 
 * @version 2.0.0
 * @since 2026
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscription } from '@/hooks/useSubscription';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import api from '@/api/client';
import { inventoryService } from '@/services/inventoryService';
import { getTransfers, StockTransfer } from '@/services/transferService';
import { 
  ShoppingCart, Package, ArrowLeftRight, 
  RotateCcw, BadgeEuro, TrendingUp, Users, FileText, 
  Settings, Truck, UserCircle, Wallet, Bell, AlertTriangle,
  LayoutDashboard, Menu, X, LogOut, ChevronDown,
  DollarSign, HelpCircle, History, ShoppingBag,
  LineChart, CreditCard, UsersRound, TruckIcon,
  Clock, Calculator, Crown, Info, ClipboardList,
  BarChart3, Receipt,
  ChartBar, ChartPie, ChartLine, FileBarChart
} from 'lucide-react';
import NotificationDrawer from './NotificationDrawer';
import OutOfService from '@/modules/core/endehors';
import { useTimezone } from '@/hooks/useTimezone';

// ============================================================================
// TYPES ET INTERFACES
// ============================================================================

/**
 * Rôles utilisateur autorisés dans l'application
 */
type Role = "admin" | "gestionnaire" | "pharmacien" | "caissier" | "vendeur" | "comptable" | "stockiste" | "preparateur";

/**
 * Type d'alerte pour le centre de notifications
 */
export type AlertType = 'EXPIRED' | 'STOCK_OUT' | 'NEAR_EXPIRY' | 'LOW_STOCK';

/**
 * Structure d'une alerte dans le centre de notifications
 */
export interface PharmacyAlert {
  id: string;
  type: AlertType;
  productName: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  date: Date | string;
}

/**
 * Structure d'un élément de menu
 */
interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  roles: Role[];
  badge?: (alerts?: any) => number | null;
}

/**
 * Structure d'un groupe de menu
 */
interface MenuGroup {
  title: string;
  items: MenuItem[];
}

/**
 * Statut du service (horaires d'ouverture)
 */
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

/**
 * Configuration des horaires de travail
 */
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

// ============================================================================
// CONSTANTES ET UTILITAIRES
// ============================================================================

/**
 * Formate un rôle pour l'affichage
 * @param role - Rôle à formater
 * @returns Rôle formaté (ex: "Admin", "Gestionnaire")
 */
const formatRole = (role: string): string => {
  return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

/**
 * Configuration des menus de navigation
 * Chaque élément est filtré selon le rôle de l'utilisateur
 */
const menuGroups: MenuGroup[] = [
  {
    title: "Général",
    items: [
      { 
        icon: <LayoutDashboard size={20}/>, 
        label: 'Tableau de bord', 
        href: '/dashboard', 
        roles: ["admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste", "preparateur"] 
      }
    ]
  },
  {
    title: "Opérations",
    items: [
      { icon: <ShoppingCart size={20}/>, label: 'Ventes (POS)', href: '/vendor-pos', roles: ["admin", "pharmacien", "caissier", "vendeur"] },
      { icon: <Receipt size={20}/>, label: 'Factures', href: '/factures', roles: ["admin", "pharmacien", "caissier", "vendeur", "comptable"] },
      { 
        icon: <Package size={20}/>, 
        label: 'Stock', 
        href: '/stock', 
        roles: ["admin", "gestionnaire", "pharmacien", "stockiste", "preparateur"],
        badge: (alerts: any) => {
          if (alerts?.stock?.out_of_stock?.length || alerts?.stock?.low_stock?.length) {
            return (alerts.stock.out_of_stock?.length || 0) + (alerts.stock.low_stock?.length || 0);
          }
          return null;
        }
      },
      { icon: <ClipboardList size={20}/>, label: 'Inventaire physique', href: '/inventaire', roles: ["admin", "gestionnaire", "pharmacien", "stockiste"] },
      { icon: <ShoppingBag size={20}/>, label: 'Achats', href: '/purchases', roles: ["admin", "gestionnaire", "stockiste"] },
      { icon: <ArrowLeftRight size={20}/>, label: 'Transferts', href: '/transfers', roles: ["admin", "gestionnaire", "stockiste"] },
      { icon: <RotateCcw size={20}/>, label: 'Retours', href: '/returns', roles: ["admin", "pharmacien", "gestionnaire"] },
      { icon: <TruckIcon size={20}/>, label: 'Livraisons', href: '/deliveries', roles: ["admin", "gestionnaire", "pharmacien"] }
    ]
  },
  {
    title: "Statistiques & Rapports",
    items: [
      { icon: <BarChart3 size={20}/>, label: 'Statistiques', href: '/rapports', roles: ["admin", "gestionnaire", "comptable"] },
      { icon: <ChartBar size={20}/>, label: 'Chiffre d\'affaires', href: '/finance', roles: ["admin", "comptable", "gestionnaire"] },
      { icon: <ChartPie size={20}/>, label: 'Bénéfices', href: '/profits', roles: ["admin", "comptable"] },
      { icon: <ChartLine size={20}/>, label: 'Historique ventes', href: '/historique', roles: ["admin", "gestionnaire", "comptable", "pharmacien"] },
      { icon: <FileBarChart size={20}/>, label: 'Rapports détaillés', href: '/rapports', roles: ["admin", "comptable", "gestionnaire"] },
      { icon: <LineChart size={20}/>, label: 'Monitoring', href: '/monitoring', roles: ["admin", "gestionnaire"] }
    ]
  },
  {
    title: "Gestion",
    items: [
      { icon: <History size={20}/>, label: 'Historique', href: '/historique', roles: ["admin", "gestionnaire", "comptable", "pharmacien"] },
      { icon: <CreditCard size={20}/>, label: 'Dettes', href: '/debts', roles: ["admin", "comptable", "gestionnaire"] },
      { icon: <Calculator size={20}/>, label: 'Capital', href: '/capital', roles: ["admin", "comptable"] }
    ]
  },
  {
    title: "Finance",
    items: [
      { icon: <BadgeEuro size={20}/>, label: "Chiffre d'Affaires", href: '/finance', roles: ["admin", "comptable", "gestionnaire"] },
      { icon: <DollarSign size={20}/>, label: 'Dépenses', href: '/expenses', roles: ["admin", "comptable", "gestionnaire"] },
      { icon: <TrendingUp size={20}/>, label: 'Bénéfices', href: '/profits', roles: ["admin", "comptable"] },
      { icon: <Wallet size={20}/>, label: 'Caisse', href: '/cash-register', roles: ["admin", "comptable", "caissier"] }
    ]
  },
  {
    title: "Ressources humaines",
    items: [
      { icon: <UsersRound size={20}/>, label: 'Employés', href: '/employees', roles: ["admin", "gestionnaire"] }
    ]
  },
  {
    title: "Partenaires",
    items: [
      { icon: <Truck size={20}/>, label: 'Fournisseurs', href: '/suppliers', roles: ["admin", "gestionnaire", "stockiste"] },
      { icon: <UserCircle size={20}/>, label: 'Clients', href: '/clients', roles: ["admin", "vendeur", "caissier", "pharmacien"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { 
        icon: <Crown size={20}/>, 
        label: 'Abonnement', 
        href: '/subscription', 
        roles: ["admin"],
        badge: (alerts: any) => {
          if (alerts?.subscription?.isExpiring) return alerts.subscription.daysRemaining;
          return null;
        }
      },
      { icon: <Users size={20}/>, label: 'Utilisateurs', href: '/users', roles: ["admin"] },
      { icon: <FileText size={20}/>, label: 'Rapports', href: '/reports', roles: ["admin", "comptable", "gestionnaire"] },
      { icon: <Settings size={20}/>, label: 'Paramètres', href: '/settings', roles: ["admin"] }
    ]
  },
  {
    title: "Support",
    items: [
      { icon: <HelpCircle size={20}/>, label: 'Aide', href: '/help', roles: ["admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste", "preparateur"] }
    ]
  }
];

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { 
    isExpired, 
    daysRemaining, 
    plan_name, 
    subscription,
    isTrial,
    trialDaysRemaining
  } = useSubscription();
  
  const timezoneHook = useTimezone();
  const browserTimezone = timezoneHook.timezone;
  const browserOffset = timezoneHook.offset;
  
  // États UI
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<string[]>(menuGroups.map(g => g.title));
  const [showServiceInfo, setShowServiceInfo] = useState<boolean>(false);
  
  // États des alertes
  const [pharmacyAlerts, setPharmacyAlerts] = useState<PharmacyAlert[]>([]);
  
  // États du service (horaires)
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null);
  const [loadingService, setLoadingService] = useState<boolean>(true);
  const [showOutOfService, setShowOutOfService] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const [serviceError, setServiceError] = useState<boolean>(false);

  // ==========================================================================
  // DÉTECTION MOBILE
  // ==========================================================================
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ==========================================================================
  // RÉCUPÉRATION DES ALERTES UNIFIÉES
  // ==========================================================================

  /**
   * Récupère toutes les alertes (stock, expiration, transferts, abonnement)
   * et les formate pour le centre de notifications
   */
  const fetchPharmacyAlerts = useCallback(async () => {
    if (!user?.tenant_id && !user?.pharmacy_id) return;

    const alerts: PharmacyAlert[] = [];

    try {
      // 1. ALERTES DE STOCK
      try {
        const stockAlertsResponse = await inventoryService.getStockAlerts();
        
        // Traitement des alertes STOCK_OUT (produits épuisés)
        const outOfStockAlerts = stockAlertsResponse.out_of_stock || [];
        if (Array.isArray(outOfStockAlerts) && outOfStockAlerts.length > 0) {
          outOfStockAlerts.forEach((alert: any) => {
            alerts.push({
              id: `stock-out-${alert.product_id || alert.id}`,
              type: 'STOCK_OUT',
              productName: alert.product_name || alert.name,
              message: `${alert.product_name || alert.name} est épuisé.`,
              severity: 'error',
              date: new Date().toISOString(),
            });
          });
        }
        
        // Traitement des alertes LOW_STOCK (stock bas)
        const lowStockAlerts = stockAlertsResponse.low_stock || [];
        if (Array.isArray(lowStockAlerts) && lowStockAlerts.length > 0) {
          lowStockAlerts.forEach((alert: any) => {
            alerts.push({
              id: `low-stock-${alert.product_id || alert.id}`,
              type: 'LOW_STOCK',
              productName: alert.product_name || alert.name,
              message: `Stock faible : ${alert.current_stock || 0} unité(s) restante(s). Seuil: ${alert.threshold || 0}`,
              severity: 'warning',
              date: new Date().toISOString(),
            });
          });
        }
      } catch (error) {
        console.error('Erreur récupération alertes stock:', error);
      }

      // 2. ALERTES D'EXPIRATION
      try {
        const expiryAlertsResponse = await inventoryService.getExpiryAlerts(30);
        
        // Traitement des produits expirés
        const expiredAlerts = expiryAlertsResponse.expired || [];
        if (Array.isArray(expiredAlerts) && expiredAlerts.length > 0) {
          expiredAlerts.forEach((alert: any) => {
            alerts.push({
              id: `expired-${alert.product_id || alert.id}`,
              type: 'EXPIRED',
              productName: alert.product_name || alert.name,
              message: `${alert.product_name || alert.name} est expiré depuis le ${new Date(alert.expiry_date).toLocaleDateString('fr-FR')}.`,
              severity: 'error',
              date: new Date().toISOString(),
            });
          });
        }
        
        // Traitement des produits bientôt expirés
        const expiringSoonAlerts = expiryAlertsResponse.expiring_soon || [];
        if (Array.isArray(expiringSoonAlerts) && expiringSoonAlerts.length > 0) {
          expiringSoonAlerts.forEach((alert: any) => {
            alerts.push({
              id: `near-expiry-${alert.product_id || alert.id}`,
              type: 'NEAR_EXPIRY',
              productName: alert.product_name || alert.name,
              message: `Expire dans ${alert.days_remaining || 0} jour${(alert.days_remaining || 0) > 1 ? 's' : ''} (le ${new Date(alert.expiry_date).toLocaleDateString('fr-FR')}).`,
              severity: 'warning',
              date: new Date().toISOString(),
            });
          });
        }
      } catch (error) {
        console.error('Erreur récupération alertes expiration:', error);
      }

      // 3. ALERTES DE TRANSFERTS ENTRANTS
      try {
        const transfers = await getTransfers();
        if (Array.isArray(transfers)) {
          const incomingTransfers = transfers.filter(
            (t: StockTransfer) => t.status === 'pending' && t.to_pharmacy === user?.pharmacy_id
          );
          
          incomingTransfers.forEach((transfer: StockTransfer) => {
            alerts.push({
              id: `transfer-${transfer.id}`,
              type: 'LOW_STOCK',
              productName: transfer.product_name,
              message: `Transfert entrant de ${transfer.quantity} ${transfer.product_name} depuis ${transfer.from_pharmacy}.`,
              severity: 'info',
              date: transfer.date,
            });
          });
        }
      } catch (error) {
        console.error('Erreur récupération transferts:', error);
      }

      // 4. ALERTES D'ABONNEMENT
      if (subscription) {
        if (isExpired) {
          alerts.push({
            id: 'sub-expired',
            type: 'STOCK_OUT',
            productName: 'Abonnement',
            message: `Votre abonnement ${plan_name || 'actuel'} a expiré. Renouvelez pour continuer.`,
            severity: 'error',
            date: new Date().toISOString(),
          });
        } else if (daysRemaining <= 7 && daysRemaining > 0) {
          alerts.push({
            id: 'sub-expiring',
            type: 'NEAR_EXPIRY',
            productName: 'Abonnement',
            message: `Votre abonnement expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Renouvelez dès maintenant.`,
            severity: daysRemaining <= 3 ? 'error' : 'warning',
            date: new Date().toISOString(),
          });
        }
        
        if (isTrial && trialDaysRemaining > 0 && trialDaysRemaining <= 7) {
          alerts.push({
            id: 'trial-ending',
            type: 'NEAR_EXPIRY',
            productName: 'Période d\'essai',
            message: `Votre période d'essai se termine dans ${trialDaysRemaining} jour${trialDaysRemaining > 1 ? 's' : ''}. Souscrivez un abonnement.`,
            severity: trialDaysRemaining <= 3 ? 'error' : 'warning',
            date: new Date().toISOString(),
          });
        }
      }

      // Trier par date (les plus récentes en premier)
      alerts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setPharmacyAlerts(alerts);
    } catch (error) {
      console.error('Erreur lors de la récupération des alertes:', error);
    }
  }, [user, subscription, isExpired, daysRemaining, plan_name, isTrial, trialDaysRemaining]);

  // Rafraîchir les alertes périodiquement
  useEffect(() => {
    fetchPharmacyAlerts();
    
    const interval = setInterval(() => {
      fetchPharmacyAlerts();
    }, 60000); // Toutes les minutes
    
    return () => clearInterval(interval);
  }, [fetchPharmacyAlerts]);

  // ==========================================================================
  // GESTION DES HORAIRES DE SERVICE
  // ==========================================================================

  /**
   * Calcule le temps restant avant la fermeture
   */
  const calculateTimeRemaining = useCallback((): string | null => {
    if (!serviceStatus?.in_service || !workingHours?.endTime) return null;

    const now = new Date();
    const [endHours, endMinutes] = workingHours.endTime.split(':').map(Number);
    
    const endTime = new Date();
    endTime.setHours(endHours, endMinutes, 0);
    
    if (now > endTime) return null;
    
    const diffMs = endTime.getTime() - now.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const remainingMinutes = diffMinutes % 60;
    
    return diffHours > 0 ? `${diffHours}h ${remainingMinutes}min` : `${remainingMinutes}min`;
  }, [serviceStatus, workingHours]);

  // Charger la configuration du service
  useEffect(() => {
    const loadServiceStatus = async () => {
      if (!user?.pharmacy_id) {
        setLoadingService(false);
        return;
      }

      try {
        const configPromise = api.get<{ config: { workingHours: WorkingHours } }>(
          `/pharmacies/${user.pharmacy_id}/config`,
          { timeout: 5000 }
        ).catch(() => null);
        
        const statusPromise = api.get<ServiceStatus>(
          `/pharmacies/${user.pharmacy_id}/service-status`,
          { timeout: 5000 }
        ).catch(() => null);

        const [configResponse, statusResponse] = await Promise.all([configPromise, statusPromise]);
        
        if (configResponse?.data?.config?.workingHours) {
          setWorkingHours(configResponse.data.config.workingHours);
        }

        if (statusResponse?.data) {
          setServiceStatus(statusResponse.data);
          setShowOutOfService(!statusResponse.data.in_service);
          setServiceError(false);
        } else {
          setServiceError(true);
          setShowOutOfService(false);
        }
        
      } catch (err) {
        console.error('Erreur lors du chargement du service:', err);
        setServiceError(true);
        setShowOutOfService(false);
      } finally {
        setLoadingService(false);
      }
    };

    loadServiceStatus();

    const interval = setInterval(async () => {
      if (user?.pharmacy_id) {
        try {
          const response = await api.get<ServiceStatus>(
            `/pharmacies/${user.pharmacy_id}/service-status`,
            { timeout: 5000 }
          );
          setServiceStatus(response.data);
          setShowOutOfService(!response.data.in_service);
          setServiceError(false);
        } catch (err) {
          console.error('Erreur lors de la vérification du service:', err);
          setServiceError(true);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // Mettre à jour le temps restant
  useEffect(() => {
    if (serviceStatus?.in_service) {
      setTimeRemaining(calculateTimeRemaining());
      const timer = setInterval(() => {
        setTimeRemaining(calculateTimeRemaining());
      }, 60000);
      return () => clearInterval(timer);
    }
  }, [serviceStatus, calculateTimeRemaining]);

  // Intercepter la navigation pour vérifier le service
  useEffect(() => {
    const checkNavigation = async () => {
      if (location.pathname === '/login' || location.pathname === '/logout' || 
          location.pathname === '/out-of-service' || showOutOfService || serviceError) {
        return;
      }

      if (!user?.pharmacy_id) return;

      try {
        const response = await api.get<ServiceStatus>(
          `/pharmacies/${user.pharmacy_id}/service-status`,
          { timeout: 5000 }
        );
        
        if (!response.data.in_service) {
          setShowOutOfService(true);
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du service:', err);
        setServiceError(true);
      }
    };

    checkNavigation();
  }, [location.pathname, user, showOutOfService, serviceError]);

  // Fermer la sidebar sur mobile lors du changement de page
  useEffect(() => {
    if (isMobile && !showOutOfService) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile, showOutOfService]);

  // ==========================================================================
  // LOGIQUE DE NAVIGATION
  // ==========================================================================

  /**
   * Rôle de l'utilisateur avec fallback
   */
  const userRole = useMemo((): Role => {
    const role = (user?.role as string) || "vendeur";
    if (role === 'super_admin') {
      return "admin";
    }
    return role as Role;
  }, [user]);

  /**
   * Filtre les groupes de menu visibles selon le rôle
   */
  const visibleGroups = useMemo(() => {
    return menuGroups.filter(group => 
      group.items.some(item => item.roles.includes(userRole))
    );
  }, [userRole]);

  /**
   * Vérifie si un lien est actif
   */
  const isActive = useCallback((href: string): boolean => {
    return location.pathname === href || location.pathname.startsWith(href + '/');
  }, [location.pathname]);

  /**
   * Ouvre/ferme un groupe de menu
   */
  const toggleGroup = useCallback((groupTitle: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupTitle)
        ? prev.filter(g => g !== groupTitle)
        : [...prev, groupTitle]
    );
  }, []);

  /**
   * Déconnexion de l'utilisateur
   */
  const handleLogout = useCallback(async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }, [logout, navigate]);

  /**
   * Gère le clic sur une notification
   */
  const handleNotificationClick = useCallback((notification: PharmacyAlert) => {
    if (notification.type === 'STOCK_OUT' || notification.type === 'LOW_STOCK') {
      navigate(`/stock?search=${encodeURIComponent(notification.productName)}`);
    } else if (notification.type === 'EXPIRED' || notification.type === 'NEAR_EXPIRY') {
      navigate(`/stock?search=${encodeURIComponent(notification.productName)}&expiry=true`);
    } else if (notification.message.includes('Abonnement')) {
      navigate('/subscription');
    } else {
      navigate('/transfers');
    }
  }, [navigate]);

  /**
   * Compte des alertes non lues pour le badge de notification
   */
  const unreadAlertsCount = useMemo(() => {
    return pharmacyAlerts.length;
  }, [pharmacyAlerts]);

  // ==========================================================================
  // RENDU CONDITIONNEL
  // ==========================================================================

  if (loadingService) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Clock className="w-12 h-12 text-blue-600 animate-pulse mx-auto mb-4" />
          <p className="text-slate-600">Chargement de l'application...</p>
        </div>
      </div>
    );
  }

  if (showOutOfService && serviceStatus && !serviceError) {
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

  // ==========================================================================
  // RENDU PRINCIPAL
  // ==========================================================================

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden relative">
      {/* Overlay mobile */}
      {isSidebarOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Barre latérale */}
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
        {/* En-tête */}
        <div className="p-4 sm:p-6 flex items-center justify-between border-b border-slate-100">
          <div>
            <div className="text-xl sm:text-2xl font-bold text-blue-600 tracking-tight">
              MedigestPro
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[8px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                {formatRole(userRole)}
              </span>
              {serviceStatus?.in_service && !serviceError && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-100 rounded-full">
                  <span className="text-[6px] sm:text-[8px] text-green-700 font-bold">EN SERVICE</span>
                </div>
              )}
              {serviceError && (
                <div className="flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 rounded-full">
                  <span className="text-[6px] sm:text-[8px] text-yellow-700 font-bold">MODE HORS LIGNE</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Info service */}
            {!serviceError && (
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
            )}
            
            {/* Bouton notifications */}
            <button 
              onClick={() => setIsNotifOpen(true)}
              className={`relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all ${
                unreadAlertsCount > 0 ? 'animate-pulse' : ''
              }`}
              aria-label="Notifications"
              title={`${unreadAlertsCount} notification${unreadAlertsCount > 1 ? 's' : ''}`}
            >
              <Bell size={18} className="sm:w-5 sm:h-5" />
              {unreadAlertsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-white">
                  {unreadAlertsCount > 99 ? '99+' : unreadAlertsCount}
                </span>
              )}
            </button>
            
            {/* Bouton fermer mobile */}
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

        {/* Alerte abonnement */}
        {(isExpired || (daysRemaining <= 7 && daysRemaining > 0) || (isTrial && trialDaysRemaining <= 7 && trialDaysRemaining > 0)) && (
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
                  {isExpired ? 'Abonnement Expiré' : isTrial ? 'Fin d\'essai' : 'Fin de période'}
                </p>
                <p className="text-[8px] sm:text-[10px] opacity-80 truncate">
                  {isExpired 
                    ? 'Renouvelez votre accès' 
                    : isTrial
                      ? `${trialDaysRemaining} jour${trialDaysRemaining > 1 ? 's' : ''} restant${trialDaysRemaining > 1 ? 's' : ''}`
                      : daysRemaining === 1 
                        ? 'Expire demain' 
                        : `Expire dans ${daysRemaining} jours`}
                </p>
              </div>
            </Link>
          </div>
        )}
        
        {/* Navigation */}
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
                    let itemBadge: number | null = null;
                    
                    // Calcul des badges selon le type d'élément
                    if (item.label === 'Stock') {
                      const stockAlertsCount = pharmacyAlerts.filter(
                        a => a.type === 'STOCK_OUT' || a.type === 'LOW_STOCK'
                      ).length;
                      itemBadge = stockAlertsCount > 0 ? stockAlertsCount : null;
                    } else if (item.label === 'Abonnement') {
                      if (isExpired) itemBadge = 1;
                      else if (daysRemaining <= 7 && daysRemaining > 0) itemBadge = daysRemaining;
                      else if (isTrial && trialDaysRemaining <= 7 && trialDaysRemaining > 0) itemBadge = trialDaysRemaining;
                    } else if (item.label === 'Transferts') {
                      const transferAlertsCount = pharmacyAlerts.filter(
                        a => a.message.includes('Transfert entrant')
                      ).length;
                      itemBadge = transferAlertsCount > 0 ? transferAlertsCount : null;
                    }
                    
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
                        
                        {itemBadge && itemBadge > 0 && (
                          <span className={`shrink-0 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full ${
                            active 
                              ? 'bg-white text-blue-600' 
                              : 'bg-red-500 text-white'
                          }`}>
                            {itemBadge > 99 ? '99+' : itemBadge}
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

        {/* Profil utilisateur */}
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
                  <span className={`text-[8px] sm:text-[10px] font-medium ${
                    subscription.status === 'active' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    • {subscription.status === 'active' ? 'Actif' : isExpired ? 'Expiré' : subscription.status}
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

      {/* Bouton menu mobile */}
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

      {/* Contenu principal */}
      <main className={`
        flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8
        transition-all duration-300
        ${isMobile ? 'w-full' : ''}
      `}>
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
          <Outlet />
        </div>
      </main>

      {/* Centre de notifications */}
      <NotificationDrawer 
        isOpen={isNotifOpen} 
        onClose={() => setIsNotifOpen(false)} 
        alerts={pharmacyAlerts}
        onNotificationClick={handleNotificationClick}
      />
    </div>
  );
};

export default Sidebar;