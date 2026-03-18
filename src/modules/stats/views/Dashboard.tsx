// pages/Dashboard.tsx
/**
 * ===================================================================
 * DASHBOARD - Tableau de bord principal de l'application pharmaceutique
 * ===================================================================
 * 
 * Ce composant affiche la page d'accueil après connexion avec :
 * - Des statistiques clés (ventes, stocks, bénéfices)
 * - Des alertes (stocks critiques, produits expirés)
 * - Un aperçu rapide des performances
 * - Des modales de détails pour chaque métrique
 * - Export PDF des rapports
 * - Vérification des heures de service selon configuration
 * - Application du thème selon configuration
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';

// Icônes Lucide React pour l'UI
import { 
  ShoppingBag, AlertTriangle, TrendingUp, 
  RefreshCw, ArrowRight, Package, Clock, 
  Calendar, Download, X, ChevronDown, ChevronUp,
  LayoutDashboard, ShieldAlert, FileText,
  Printer, DollarSign, BarChart3, AlertCircle
} from 'lucide-react';

// Composants et hooks personnalisés
import { StatCard } from '../components/StatCard';
import { useDashboard, DashboardStats, DashboardAlert } from '@/hooks/useDashboard';
import { formatCurrency } from '@/utils/formatters';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import OutOfService from '@/modules/core/endehors';
import api from '@/api/client';

// ===================================================================
// TYPES
// ===================================================================

interface DetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: DashboardStats | { alerts: DashboardAlert[] } | { expiring_soon: number; expired: number } | null;
  type: 'sales' | 'profits' | 'expenses' | 'purchases' | 'alerts' | 'expiry';
  onExportPDF: () => void;
  userName?: string;
  pharmacyName?: string;
}

interface StatsCard {
  id: string;
  title: string;
  value: string | number;
  icon: React.ReactElement;
  color: string;
  description: string;
  onClick: () => void;
}

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
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

interface PharmacyConfig {
  theme: 'light' | 'dark' | 'system';
  workingHours: WorkingHours;
  pharmacyInfo: {
    name: string;
  };
}

// ===================================================================
// COMPOSANTS UTILITAIRES
// ===================================================================

const CheckCircle = ({ size, className }: { size: number; className?: string }): React.ReactElement => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// ===================================================================
// FONCTIONS UTILITAIRES
// ===================================================================

const generatePDF = (
  type: string, 
  data: DashboardStats | null, 
  userName: string = 'Non spécifié',
  pharmacyName: string = 'Non spécifiée'
): void => {
  if (!data) return;
  
  try {
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // En-tête
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MédiGest', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rapport - ${type}`, 105, 30, { align: 'center' });

    // Informations
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Généré le : ${date}`, 20, 50);
    doc.text(`Pharmacie : ${pharmacyName}`, 20, 57);
    doc.text(`Utilisateur : ${userName}`, 20, 64);

    // Contenu selon type
    if (type.includes('Ventes') || type.includes('sales')) {
      autoTable(doc, {
        head: [['Période', 'Montant', 'Tendance']],
        body: [
          ['Aujourd\'hui', formatCurrency(data.daily_sales || 0), `${data.sales_trend || 0}%`],
          ['Ce mois', formatCurrency(data.monthly_sales || 0), '-'],
          ['Stock total', formatCurrency(data.total_stock_value || 0), '-']
        ],
        startY: 80,
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 10 }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Résumé du mois', 20, finalY);
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total produits: ${data.total_products || 0}`, 20, finalY + 10);
      doc.text(`Clients: ${data.total_customers || 0}`, 20, finalY + 17);
      doc.text(`Bénéfice net: ${formatCurrency(data.net_profit || 0)}`, 20, finalY + 24);
    }

    // Pied de page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Document généré par MédiGest - Page ${i} sur ${pageCount}`,
        105,
        287,
        { align: 'center' }
      );
    }

    doc.save(`rapport-${type.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
  } catch (err) {
    console.error('Erreur génération PDF:', err);
  }
};

// ===================================================================
// COMPOSANT MODAL DE DÉTAILS
// ===================================================================

const DetailModal: React.FC<DetailModalProps> = ({ 
  isOpen, 
  onClose, 
  title, 
  data, 
  type, 
  onExportPDF,
  userName,
  pharmacyName 
}) => {
  if (!isOpen) return null;

  const renderContent = (): React.ReactNode => {
    switch (type) {
      case 'sales':
        if (!data || !('daily_sales' in data)) return null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-xs text-blue-600 font-bold">AUJOURD'HUI</p>
                <p className="text-2xl font-black text-slate-800">
                  {formatCurrency(data.daily_sales || 0)}
                </p>
              </div>
              <div className="bg-indigo-50 p-4 rounded-xl">
                <p className="text-xs text-indigo-600 font-bold">CE MOIS</p>
                <p className="text-2xl font-black text-slate-800">
                  {formatCurrency(data.monthly_sales || 0)}
                </p>
              </div>
            </div>
            
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-medium">Tendance</span>
              <span className={`font-bold ${(data.sales_trend || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.sales_trend || 0}%
              </span>
            </div>
            
            <div className="border-t border-slate-100 pt-4 mt-2">
              <h4 className="font-bold text-sm mb-3">Détails supplémentaires</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Total produits</p>
                  <p className="font-bold">{data.total_products || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Clients</p>
                  <p className="font-bold">{data.total_customers || 0}</p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
              <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
              <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            </div>
          </div>
        );

      case 'profits':
        if (!data || !('daily_sales' in data)) return null;
        const dailyProfit = (data.daily_sales || 0) * 0.3;
        const monthlyProfit = (data.monthly_sales || 0) * 0.3;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 p-4 rounded-xl">
                <p className="text-xs text-emerald-600 font-bold">AUJOURD'HUI</p>
                <p className="text-2xl font-black text-slate-800">
                  {formatCurrency(dailyProfit)}
                </p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl">
                <p className="text-xs text-emerald-600 font-bold">CE MOIS</p>
                <p className="text-2xl font-black text-slate-800">
                  {formatCurrency(monthlyProfit)}
                </p>
              </div>
            </div>
            <div className="border-t border-slate-100 pt-4 mt-2">
              <p className="text-xs text-slate-500 mb-2">* Bénéfice estimé (marge de 30%)</p>
              <div className="bg-emerald-50 p-3 rounded-xl">
                <p className="text-xs font-bold text-emerald-700">Bénéfice net réel</p>
                <p className="text-xl font-black text-emerald-600">
                  {formatCurrency(data.net_profit || 0)}
                </p>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
              <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
              <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            </div>
          </div>
        );

      case 'alerts':
        const alertData = data as { alerts: DashboardAlert[] } | null;
        if (!alertData?.alerts?.length) {
          return (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <p className="text-slate-500 font-medium">Aucune alerte en cours</p>
              <p className="text-sm text-slate-400 mt-1">Tout est sous contrôle</p>
              <div className="mt-6 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
                <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
                <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-3">
            {alertData.alerts.map((alert, i) => (
              <div 
                key={alert.id || i} 
                className={`p-4 rounded-xl border-l-4 ${
                  alert.severity === 'high' 
                    ? 'bg-red-50 border-l-red-500' 
                    : alert.severity === 'medium'
                    ? 'bg-amber-50 border-l-amber-500'
                    : 'bg-yellow-50 border-l-yellow-500'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-bold text-sm">{alert.product_name}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-slate-600">
                        Stock: <span className="font-bold">{alert.current_stock}</span>
                      </span>
                      <span className="text-slate-600">
                        Seuil: <span className="font-bold">{alert.threshold}</span>
                      </span>
                    </div>
                    {alert.message && (
                      <p className="text-xs text-slate-500 mt-2">{alert.message}</p>
                    )}
                  </div>
                  <AlertTriangle 
                    size={20} 
                    className={
                      alert.severity === 'high' 
                        ? 'text-red-500' 
                        : alert.severity === 'medium'
                        ? 'text-amber-500'
                        : 'text-yellow-500'
                    } 
                  />
                </div>
              </div>
            ))}
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
              <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
              <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            </div>
          </div>
        );

      case 'expiry':
        const expiryData = data as { expiring_soon: number; expired: number } | null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 p-4 rounded-xl">
                <p className="text-xs text-orange-600 font-bold">À EXPIRER</p>
                <p className="text-2xl font-black text-slate-800">
                  {expiryData?.expiring_soon || 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">dans les 30 jours</p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl">
                <p className="text-xs text-red-600 font-bold">EXPIRÉS</p>
                <p className="text-2xl font-black text-slate-800">
                  {expiryData?.expired || 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">à retirer du stock</p>
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-xs text-blue-600 font-bold">RECOMMANDATION</p>
              <p className="text-sm text-slate-700">
                {expiryData?.expiring_soon && expiryData.expiring_soon > 0
                  ? `${expiryData.expiring_soon} produit(s) vont bientôt expirer. Pensez à les mettre en avant.`
                  : "Aucun produit à risque d'expiration prochaine."}
              </p>
            </div>
            <div className="mt-2 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
              <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
              <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center py-8 text-slate-500">
            <FileText size={48} className="mx-auto mb-4 opacity-50" />
            <p>Aucune donnée disponible</p>
            <div className="mt-6 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
              <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
              <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white w-full sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            {type === 'sales' && <ShoppingBag size={20} className="text-blue-500" />}
            {type === 'profits' && <DollarSign size={20} className="text-emerald-500" />}
            {type === 'alerts' && <AlertCircle size={20} className="text-amber-500" />}
            {type === 'expiry' && <Clock size={20} className="text-orange-500" />}
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onExportPDF}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Exporter en PDF"
            >
              <Printer size={20} className="text-slate-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Fermer"
            >
              <X size={20} className="text-slate-600" />
            </button>
          </div>
        </div>
        <div className="p-4 sm:p-6">{renderContent()}</div>
      </div>
    </div>
  );
};

// ===================================================================
// COMPOSANT PRINCIPAL DASHBOARD
// ===================================================================

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isSuperAdmin } = useAuthStore();
  
  const [pharmacyConfig, setPharmacyConfig] = useState<PharmacyConfig | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  
  const { 
    stats,           
    alerts,          
    isLoading: loadingStats,        
    error,           
    refetch,         
    isAdmin,         
    hasCriticalAlerts, 
    pendingTransfersCount, 
    formattedStats   
  } = useDashboard();

  const [selectedModal, setSelectedModal] = useState<{
    type: 'sales' | 'profits' | 'expenses' | 'purchases' | 'alerts' | 'expiry';
    title: string;
    data: DashboardStats | { alerts: DashboardAlert[] } | { expiring_soon: number; expired: number } | null;
  } | null>(null);

  const [showAllStats, setShowAllStats] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Charger la configuration de la pharmacie
  useEffect(() => {
    const loadPharmacyConfig = async () => {
      if (!user?.pharmacy_id) {
        setLoadingConfig(false);
        return;
      }

      try {
        // Charger la configuration
        const configResponse = await api.get<{ config: PharmacyConfig }>(`/pharmacies/${user.pharmacy_id}/config`);
        
        if (configResponse.data?.config) {
          setPharmacyConfig(configResponse.data.config);
          
          // Appliquer le thème
          applyTheme(configResponse.data.config.theme);
        }

        // Vérifier le statut du service
        const statusResponse = await api.get<ServiceStatus>(`/pharmacies/${user.pharmacy_id}/service-status`);
        setServiceStatus(statusResponse.data);
        
      } catch (err) {
        console.error('Erreur lors du chargement de la configuration:', err);
      } finally {
        setLoadingConfig(false);
      }
    };

    loadPharmacyConfig();

    // Vérifier le statut toutes les minutes
    const interval = setInterval(async () => {
      if (user?.pharmacy_id) {
        try {
          const response = await api.get<ServiceStatus>(`/pharmacies/${user.pharmacy_id}/service-status`);
          setServiceStatus(response.data);
        } catch (err) {
          console.error('Erreur lors de la vérification du service:', err);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [user]);

  // Fonction pour appliquer le thème
  const applyTheme = (theme: 'light' | 'dark' | 'system') => {
    const root = document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }

    // Écouter les changements de thème système si nécessaire
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  };

  // Redirection basée sur le rôle
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (isSuperAdmin()) {
      navigate('/super-admin', { replace: true });
    }
  }, [isAuthenticated, isSuperAdmin, navigate]);

  // Log des erreurs
  useEffect(() => {
    if (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  }, [error]);

  // Rafraîchir les données
  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  // Export PDF
  const handleExportPDF = useCallback((type: string, data: DashboardStats | null): void => {
    generatePDF(
      type, 
      data, 
      user?.nom_complet || 'Non spécifié',
      pharmacyConfig?.pharmacyInfo?.name || (user as any)?.pharmacy?.name || (user as any)?.pharmacy_name || 'Non spécifiée'
    );
  }, [user, pharmacyConfig]);

  // Configuration des cartes de statistiques
  const statsCards: StatsCard[] = useMemo((): StatsCard[] => {
    if (!stats) return [];
    
    return [
      {
        id: 'sales',
        title: 'Ventes du jour',
        value: formatCurrency(stats.daily_sales || 0),
        icon: <ShoppingBag size={22} />,
        color: 'bg-blue-500',
        description: `${stats.sales_trend || 0}% vs hier`,
        onClick: () => setSelectedModal({
          type: 'sales',
          title: 'Détail des ventes',
          data: stats
        })
      },
      {
        id: 'monthly-sales',
        title: 'Ventes du mois',
        value: formatCurrency(stats.monthly_sales || 0),
        icon: <Calendar size={22} />,
        color: 'bg-indigo-500',
        description: `${stats.total_customers || 0} clients`,
        onClick: () => setSelectedModal({
          type: 'sales',
          title: 'Ventes mensuelles',
          data: stats
        })
      },
      {
        id: 'stock-value',
        title: 'Valeur du stock',
        value: formatCurrency(stats.total_stock_value || 0),
        icon: <Package size={22} />,
        color: 'bg-purple-500',
        description: `${stats.total_products || 0} produits`,
        onClick: () => setSelectedModal({
          type: 'purchases',
          title: 'Valeur du stock',
          data: stats
        })
      },
      {
        id: 'daily-profit',
        title: 'Bénéfice (est.)',
        value: formatCurrency((stats.daily_sales || 0) * 0.3),
        icon: <TrendingUp size={22} />,
        color: 'bg-emerald-500',
        description: `Net: ${formatCurrency(stats.net_profit || 0)}`,
        onClick: () => setSelectedModal({
          type: 'profits',
          title: 'Bénéfices',
          data: stats
        })
      },
      {
        id: 'low-stock',
        title: 'Stock critique',
        value: stats.low_stock_count || 0,
        icon: <AlertTriangle size={22} />,
        color: 'bg-amber-500',
        description: `${stats.out_of_stock_count || 0} en rupture`,
        onClick: () => setSelectedModal({
          type: 'alerts',
          title: 'Alertes de stock',
          data: { alerts }
        })
      },
      {
        id: 'expiry',
        title: 'Péremptions',
        value: stats.expiring_soon_count || 0,
        icon: <Clock size={22} />,
        color: 'bg-orange-500',
        description: `${stats.expired_count || 0} expirés`,
        onClick: () => setSelectedModal({
          type: 'expiry',
          title: 'Produits à péremption',
          data: {
            expiring_soon: stats.expiring_soon_count,
            expired: stats.expired_count
          }
        })
      }
    ];
  }, [stats, alerts]);

  const visibleStats = showAllStats ? statsCards : statsCards.slice(0, 4);

  // État de chargement
  if (loadingConfig || loadingStats) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="animate-spin mb-4" size={40} />
        <p className="font-bold tracking-widest uppercase text-xs">
          Chargement du tableau de bord...
        </p>
      </div>
    );
  }

  // Vérification du service
  if (serviceStatus && !serviceStatus.in_service) {
    return (
    <OutOfService 
        workingHours={pharmacyConfig?.workingHours ? {
          startTime: pharmacyConfig.workingHours.startTime,
          endTime: pharmacyConfig.workingHours.endTime,
          daysOff: Object.entries(pharmacyConfig.workingHours.daysOff)
            .filter(([, isOpen]) => isOpen)
            .map(([day]) => day)
        } : undefined} 
      />
    );
  }

  // État d'erreur
  if (error) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-red-500">
        <ShieldAlert size={48} className="mb-4" />
        <p className="font-bold text-lg mb-2">Erreur de chargement</p>
        <p className="text-sm text-slate-600 mb-4 text-center max-w-md">
          {error.message}
        </p>
        <button
          onClick={handleRefresh}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          Réessayer
        </button>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="space-y-6 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="text-blue-600 dark:text-blue-400" size={28} />
            Tableau de Bord
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">
            Ravi de vous revoir, <span className="text-blue-600 dark:text-blue-400 font-bold">{user?.nom_complet}</span>
            {isAdmin && (
              <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                Admin
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {pharmacyConfig?.pharmacyInfo?.name || (user as any)?.pharmacy?.name || (user as any)?.pharmacy_name || 'Pharmacie non spécifiée'}
          </p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {pendingTransfersCount > 0 && (
            <Link
              to="/transfers"
              className="px-4 py-2 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-bold hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center gap-2"
            >
              <ArrowRight size={16} className="rotate-90" />
              {pendingTransfersCount} transfert(s)
            </Link>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Bannière alertes critiques */}
      {hasCriticalAlerts && alerts.length > 0 && (
        <div className="bg-linear-to-r from-amber-500 to-orange-600 p-1 rounded-2xl shadow-xl shadow-amber-100 dark:shadow-amber-900/20">
          <div className="bg-white/10 backdrop-blur-md p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-xl flex items-center justify-center text-white">
                <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
              </div>
              <div className="text-white">
                <p className="text-xs font-black uppercase tracking-wider opacity-90">
                  Alertes Stock
                </p>
                <p className="font-bold text-sm sm:text-base">
                  {alerts.length} alerte(s) nécessitent votre attention
                </p>
              </div>
            </div>
            <Link 
              to="/inventory/alerts" 
              className="w-full sm:w-auto bg-white text-amber-700 px-6 py-3 rounded-xl font-black text-xs hover:bg-amber-50 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              VOIR LES ALERTES <ArrowRight size={16}/>
            </Link>
          </div>
        </div>
      )}

      {/* Grille des statistiques */}
      <div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {visibleStats.map((stat) => (
            <div
              key={stat.id}
              onClick={stat.onClick}
              className="cursor-pointer transform transition-all hover:scale-105 active:scale-95"
              role="button"
              tabIndex={0}
              onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && stat.onClick()}
            >
              <StatCard
                title={stat.title}
                value={stat.value}
                icon={stat.icon}
                color={stat.color}
                description={stat.description}
              />
            </div>
          ))}
        </div>

        {statsCards.length > 4 && (
          <button
            onClick={() => setShowAllStats(!showAllStats)}
            className="w-full mt-4 py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 flex items-center justify-center gap-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {showAllStats ? (
              <>Voir moins <ChevronUp size={16} /></>
            ) : (
              <>Voir plus de statistiques <ChevronDown size={16} /></>
            )}
          </button>
        )}
      </div>

      {/* Résumé rapide */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">Produits</p>
          <p className="text-xl font-black text-slate-800 dark:text-slate-200">{stats?.total_products || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">En rupture</p>
          <p className="text-xl font-black text-red-600 dark:text-red-400">{stats?.out_of_stock_count || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">Expirés</p>
          <p className="text-xl font-black text-orange-600 dark:text-orange-400">{stats?.expired_count || 0}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">Clients</p>
          <p className="text-xl font-black text-slate-800 dark:text-slate-200">{stats?.total_customers || 0}</p>
        </div>
      </div>

      {/* Aperçu avec export */}
      <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-slate-800 dark:text-slate-200 uppercase text-xs tracking-widest flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500 dark:text-blue-400" />
            Aperçu rapide
          </h3>
          <button
            onClick={() => handleExportPDF('Ventes', stats || null)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-2 text-sm"
            title="Exporter en PDF"
          >
            <Download size={18} className="text-slate-500 dark:text-slate-400" />
            <span className="hidden sm:inline dark:text-slate-300">Exporter</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <span className="font-medium dark:text-slate-300">Ventes aujourd'hui</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(stats?.daily_sales || 0)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <span className="font-medium dark:text-slate-300">Ventes ce mois</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(stats?.monthly_sales || 0)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <span className="font-medium dark:text-slate-300">Valeur du stock</span>
            <span className="font-bold text-purple-600 dark:text-purple-400">{formatCurrency(stats?.total_stock_value || 0)}</span>
          </div>
          {formattedStats && (
            <>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <span className="font-medium dark:text-slate-300">Marge bénéficiaire</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formattedStats.profitMargin}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <span className="font-medium dark:text-slate-300">Rotation du stock</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{formattedStats.stockTurnover}x</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de détails */}
      {selectedModal && (
        <DetailModal
          isOpen={!!selectedModal}
          onClose={() => setSelectedModal(null)}
          title={selectedModal.title}
          data={selectedModal.data}
          type={selectedModal.type}
          onExportPDF={() => handleExportPDF(selectedModal.title, selectedModal.data as DashboardStats | null)}
          userName={user?.nom_complet}
          pharmacyName={pharmacyConfig?.pharmacyInfo?.name || (user as any)?.pharmacy?.name || (user as any)?.pharmacy_name}
        />
      )}
    </div>
  );
};

export default Dashboard;