import React, { useState } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useAlerts } from '@/hooks/useAlerts';
import { useSubscription } from '@/hooks/useSubscription';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  ShoppingCart, Package, ArrowLeftRight, 
  RotateCcw, BadgeEuro, TrendingUp, Users, FileText, 
  Settings, Truck, UserCircle, Wallet, Bell, AlertTriangle, LayoutDashboard
} from 'lucide-react';
import NotificationDrawer from './NotificationDrawer';

type Role = "super_admin" | "admin" | "gestionnaire" | "pharmacien" | "caissier" | "vendeur" | "comptable" | "stockiste" | "preparateur";

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  roles: Role[];
}

const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "Général",
    items: [
      { icon: <LayoutDashboard size={18}/>, label: 'Tableau de bord', href: '/dashboard', roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "caissier", "vendeur", "comptable", "stockiste"] },
    ]
  },
  {
    title: "Opérations",
    items: [
      { icon: <ShoppingCart size={18}/>, label: 'Ventes', href: '/sales', roles: ["super_admin", "admin", "pharmacien", "caissier", "vendeur"] },
      { icon: <Package size={18}/>, label: 'Stocks', href: '/inventory', roles: ["super_admin", "admin", "gestionnaire", "pharmacien", "stockiste"] },
      { icon: <ArrowLeftRight size={18}/>, label: 'Transferts', href: '/transfers', roles: ["super_admin", "admin", "gestionnaire", "stockiste"] },
      { icon: <RotateCcw size={18}/>, label: 'Retours', href: '/returns', roles: ["super_admin", "admin", "pharmacien", "gestionnaire"] },
    ]
  },
  {
    title: "Finance",
    items: [
      { icon: <BadgeEuro size={18}/>, label: 'Chiffre d\'Affaires', href: '/finance', roles: ["super_admin", "admin", "comptable", "gestionnaire"] },
      { icon: <Wallet size={18}/>, label: 'Dépenses', href: '/expenses', roles: ["super_admin", "admin", "comptable", "gestionnaire"] },
      { icon: <TrendingUp size={18}/>, label: 'Bénéfices', href: '/profits', roles: ["super_admin", "admin", "comptable"] },
    ]
  },
  {
    title: "Partenaires",
    items: [
      { icon: <Truck size={18}/>, label: 'Fournisseurs', href: '/suppliers', roles: ["super_admin", "admin", "gestionnaire", "stockiste"] },
      { icon: <UserCircle size={18}/>, label: 'Clients', href: '/clients', roles: ["super_admin", "admin", "vendeur", "caissier", "pharmacien"] },
    ]
  },
  {
    title: "Admin & RH",
    items: [
      { icon: <Users size={18}/>, label: 'Utilisateurs', href: '/users', roles: ["super_admin", "admin"] },
      { icon: <FileText size={18}/>, label: 'Rapports', href: '/reports', roles: ["super_admin", "admin", "comptable", "gestionnaire"] },
      { icon: <Settings size={18}/>, label: 'Abonnement', href: '/subscription', roles: ["super_admin"] },
    ]
  }
];

export default function Sidebar() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  
  const userRole = (user?.role as Role) || "vendeur";
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const { alerts } = useAlerts();
  
  // Correction ici : utilisation de plan_name pour matcher votre backend/hook
  const { isExpired, daysRemaining, plan_name } = useSubscription();

  return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* BARRE LATÉRALE */}
      <aside className="w-64 h-full bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-6 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-blue-600 tracking-tight">PharmaSaaS</div>
            <div className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-widest">
              {userRole.replace('_', ' ')}
            </div>
          </div>
          
          <button 
            onClick={() => setIsNotifOpen(true)}
            className={`relative p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all ${alerts.length > 0 ? 'animate-pulse' : ''}`}
          >
            <Bell size={20} />
            {alerts.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center border-2 border-white">
                {alerts.length}
              </span>
            )}
          </button>
        </div>

        {(daysRemaining <= 7 || isExpired) && (
          <div className="px-4 mb-4">
            <Link 
              to="/subscription"
              className={`flex items-center gap-3 p-3 rounded-2xl border ${
                isExpired ? 'bg-red-50 border-red-100 text-red-700' : 'bg-orange-50 border-orange-100 text-orange-700'
              } transition-transform hover:scale-[1.02]`}
            >
              <AlertTriangle size={18} className={isExpired ? 'animate-bounce' : ''} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-tight">{isExpired ? 'Abonnement Expiré' : 'Fin de période'}</p>
                <p className="text-[10px] opacity-80 truncate">{isExpired ? 'Renouvelez votre accès' : `Expire dans ${daysRemaining} jours`}</p>
              </div>
            </Link>
          </div>
        )}
        
        <nav className="flex-1 px-4 pb-4 space-y-6 overflow-y-auto custom-scrollbar">
          {menuGroups.map((group) => {
            const visibleItems = group.items.filter(item => item.roles.includes(userRole));
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.title}>
                <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-2">{group.title}</h3>
                <div className="space-y-1">
                  {visibleItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.label}
                        to={item.href}
                        className={`flex items-center gap-3 p-2.5 rounded-lg transition-all group ${
                          isActive 
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                            : 'text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                        }`}
                      >
                        <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-600'}`}>
                          {item.icon}
                        </span>
                        <span className="text-sm font-semibold">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-100 uppercase">
              {user?.nom_complet?.charAt(0) || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-700 truncate">{user?.nom_complet || 'Utilisateur'}</p>
              <p className="text-[10px] text-slate-400 font-medium truncate">Plan: {plan_name || 'Chargement...'}</p>
              <button onClick={() => logout()} className="text-[11px] text-red-500 font-bold hover:text-red-700">Déconnexion</button>
            </div>
          </div>
        </div>
      </aside>

      {/* ZONE DE CONTENU PRINCIPAL - RENDU DES ROUTES ENFANTS */}
      <main className="flex-1 h-full overflow-y-auto p-8 relative">
        <div className="max-w-7xl mx-auto animate-in fade-in duration-500">
          <Outlet /> 
        </div>
      </main>

      <NotificationDrawer isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} alerts={alerts} />
    </div>
  );
}