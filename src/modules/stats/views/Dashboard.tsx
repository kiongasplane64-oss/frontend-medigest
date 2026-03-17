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
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/store/useAuthStore'; // Gestion de l'authentification
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
import { StatCard } from '../components/StatCard'; // Carte de statistique réutilisable
import { useDashboard, DashboardStats, DashboardAlert } from '@/hooks/useDashboard'; // Hook personnalisé pour les données
import { formatCurrency } from '@/utils/formatters'; // Formateur de monnaie
import jsPDF from 'jspdf'; // Génération PDF
import autoTable from 'jspdf-autotable'; // Tableaux dans PDF

// ===================================================================
// TYPES - Définition des structures de données
// ===================================================================

/**
 * Props pour le composant Modal de détails
 */
interface DetailModalProps {
  isOpen: boolean;          // État d'ouverture du modal
  onClose: () => void;      // Fonction pour fermer
  title: string;            // Titre du modal
  data: DashboardStats | { alerts: DashboardAlert[] } | { expiring_soon: number; expired: number } | null; // Données à afficher
  type: 'sales' | 'profits' | 'expenses' | 'purchases' | 'alerts' | 'expiry'; // Type de données
  onExportPDF: () => void;  // Fonction d'export PDF
  userName?: string;        // Nom de l'utilisateur pour le PDF
  pharmacyName?: string;    // Nom de la pharmacie pour le PDF
}

/**
 * Structure d'une carte de statistique
 */
interface StatsCard {
  id: string;               // Identifiant unique
  title: string;            // Titre affiché
  value: string | number;   // Valeur à afficher
  icon: React.ReactElement; // Icône
  color: string;            // Couleur de fond
  description: string;      // Description/secondary text
  onClick: () => void;      // Action au clic
}

// ===================================================================
// COMPOSANTS UTILITAIRES
// ===================================================================

/**
 * Icône CheckCircle personnalisée (alternative à Lucide)
 * Utilisée dans les modales pour les états de succès
 */
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

/**
 * Génère un rapport PDF avec les données du dashboard
 * @param type - Type de rapport (Ventes, Bénéfices, etc.)
 * @param data - Données à inclure
 * @param userName - Nom de l'utilisateur
 * @param pharmacyName - Nom de la pharmacie
 */
const generatePDF = (
  type: string, 
  data: DashboardStats | null, 
  userName: string = 'Non spécifié',
  pharmacyName: string = 'Non spécifiée'
): void => {
  if (!data) return;
  
  try {
    // Initialisation du document PDF
    const doc = new jsPDF();
    const date = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // ===== EN-TÊTE =====
    // Bandeau bleu en haut
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 210, 40, 'F');
    
    // Titre MédiGest
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('MédiGest', 105, 20, { align: 'center' });
    
    // Sous-titre du rapport
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Rapport - ${type}`, 105, 30, { align: 'center' });

    // ===== INFORMATIONS =====
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Généré le : ${date}`, 20, 50);
    doc.text(`Pharmacie : ${pharmacyName}`, 20, 57);
    doc.text(`Utilisateur : ${userName}`, 20, 64);

    // ===== CONTENU SPÉCIFIQUE AU TYPE =====
    if (type.includes('Ventes') || type.includes('sales')) {
      // Tableau des ventes
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

      // Résumé supplémentaire
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

    // ===== PIED DE PAGE =====
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

    // Sauvegarde du fichier
    doc.save(`rapport-${type.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
  } catch (err) {
    console.error('Erreur génération PDF:', err);
  }
};

// ===================================================================
// COMPOSANT MODAL DE DÉTAILS
// ===================================================================

/**
 * Modal affichant les détails d'une métrique spécifique
 * Supporte différents types d'affichage (ventes, alertes, péremptions, etc.)
 */
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

  /**
   * Rendu du contenu selon le type de modal
   */
  const renderContent = (): React.ReactNode => {
    switch (type) {
      // ===== MODAL VENTES =====
      case 'sales':
        if (!data || !('daily_sales' in data)) return null;
        return (
          <div className="space-y-4">
            {/* Cartes jour/mois */}
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
            
            {/* Tendance */}
            <div className="flex justify-between p-3 bg-slate-50 rounded-xl">
              <span className="text-sm font-medium">Tendance</span>
              <span className={`font-bold ${(data.sales_trend || 0) > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {data.sales_trend || 0}%
              </span>
            </div>
            
            {/* Détails supplémentaires */}
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
            
            {/* Informations utilisateur */}
            <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-slate-500">
              <p>Généré par : {userName || 'Utilisateur non spécifié'}</p>
              <p>Pharmacie : {pharmacyName || 'Pharmacie non spécifiée'}</p>
            </div>
          </div>
        );

      // ===== MODAL BÉNÉFICES =====
      case 'profits':
        if (!data || !('daily_sales' in data)) return null;
        // Calcul des bénéfices estimés (marge de 30%)
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

      // ===== MODAL ALERTES STOCK =====
      case 'alerts':
        const alertData = data as { alerts: DashboardAlert[] } | null;
        if (!alertData?.alerts?.length) {
          // État "pas d'alertes"
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

        // Liste des alertes
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

      // ===== MODAL PÉREMPTIONS =====
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

      // ===== MODAL PAR DÉFAUT =====
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
      {/* Overlay semi-transparent */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      {/* Contenu du modal */}
      <div className="relative bg-white w-full sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        {/* En-tête du modal */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex justify-between items-center">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            {/* Icône selon le type */}
            {type === 'sales' && <ShoppingBag size={20} className="text-blue-500" />}
            {type === 'profits' && <DollarSign size={20} className="text-emerald-500" />}
            {type === 'alerts' && <AlertCircle size={20} className="text-amber-500" />}
            {type === 'expiry' && <Clock size={20} className="text-orange-500" />}
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {/* Bouton export PDF */}
            <button
              onClick={onExportPDF}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Exporter en PDF"
            >
              <Printer size={20} className="text-slate-600" />
            </button>
            {/* Bouton fermeture */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              title="Fermer"
            >
              <X size={20} className="text-slate-600" />
            </button>
          </div>
        </div>
        {/* Corps du modal */}
        <div className="p-4 sm:p-6">{renderContent()}</div>
      </div>
    </div>
  );
};

// ===================================================================
// COMPOSANT PRINCIPAL DASHBOARD
// ===================================================================

/**
 * Page principale du tableau de bord
 * Affiche les statistiques, alertes et aperçus pour l'utilisateur connecté
 */
const Dashboard: React.FC = () => {
  // ===== HOOKS =====
  const navigate = useNavigate();
  const { user, isAuthenticated, isSuperAdmin } = useAuthStore(); // État d'authentification
  
  // Hook personnalisé pour les données du dashboard
  const { 
    stats,           // Statistiques principales
    alerts,          // Alertes de stock
    isLoading,       // État de chargement
    error,           // Erreur éventuelle
    refetch,         // Fonction de rechargement
    isAdmin,         // Vérification rôle admin
    hasCriticalAlerts, // Présence d'alertes critiques
    pendingTransfersCount, // Nombre de transferts en attente
    formattedStats   // Statistiques formatées (marge, rotation)
  } = useDashboard();
  
  // ===== STATE LOCAL =====
  const [selectedModal, setSelectedModal] = useState<{
    type: 'sales' | 'profits' | 'expenses' | 'purchases' | 'alerts' | 'expiry';
    title: string;
    data: DashboardStats | { alerts: DashboardAlert[] } | { expiring_soon: number; expired: number } | null;
  } | null>(null);

  const [showAllStats, setShowAllStats] = useState<boolean>(false); // Afficher toutes les stats
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false); // Animation de rafraîchissement

  // ===== EFFETS =====
  
  /**
   * Effet 1: Redirection basée sur le rôle
   * - Non authentifié → Login
   * - Super Admin → Interface super admin
   */
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    if (isSuperAdmin()) {
      navigate('/super-admin', { replace: true });
    }
  }, [isAuthenticated, isSuperAdmin, navigate]);

  /**
   * Effet 2: Log des erreurs de chargement
   */
  useEffect(() => {
    if (error) {
      console.error('Erreur chargement dashboard:', error);
    }
  }, [error]);

  // ===== FONCTIONS =====
  
  /**
   * Rafraîchit les données avec animation
   */
  const handleRefresh = useCallback(async (): Promise<void> => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  }, [refetch]);

  /**
   * Export PDF avec les informations utilisateur
   */
  const handleExportPDF = useCallback((type: string, data: DashboardStats | null): void => {
    generatePDF(
      type, 
      data, 
      user?.nom_complet || 'Non spécifié',
      (user as any)?.pharmacy?.name || (user as any)?.pharmacy_name || 'Non spécifiée'
    );
  }, [user]);

  // ===== MÉMOIZATION =====
  
  /**
   * Configuration des cartes de statistiques
   * useMemo pour éviter de recalculer à chaque rendu
   */
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

  // Cartes visibles (4 ou toutes selon showAllStats)
  const visibleStats = showAllStats ? statsCards : statsCards.slice(0, 4);

  // ===== RENDU CONDITIONNEL =====
  
  // État de chargement
  if (isLoading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="animate-spin mb-4" size={40} />
        <p className="font-bold tracking-widest uppercase text-xs">
          Chargement du tableau de bord...
        </p>
      </div>
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

  // ===== RENDU PRINCIPAL =====
  return (
    <div className="space-y-6 pb-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        {/* Titre et informations utilisateur */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="text-blue-600" size={28} />
            Tableau de Bord
          </h1>
          <p className="text-sm sm:text-base text-slate-500 font-medium">
            Ravi de vous revoir, <span className="text-blue-600 font-bold">{user?.nom_complet}</span>
            {isAdmin && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                Admin
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {(user as any)?.pharmacy?.name || (user as any)?.pharmacy_name || 'Pharmacie non spécifiée'}
          </p>
        </div>
        
        {/* Boutons d'action */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Lien vers les transferts si en attente */}
          {pendingTransfersCount > 0 && (
            <Link
              to="/transfers"
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-200 transition-colors flex items-center gap-2"
            >
              <ArrowRight size={16} className="rotate-90" />
              {pendingTransfersCount} transfert(s)
            </Link>
          )}
          {/* Bouton actualiser */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            Actualiser
          </button>
        </div>
      </div>

      {/* ===== BANNIÈRE ALERTES CRITIQUES ===== */}
      {hasCriticalAlerts && alerts.length > 0 && (
        <div className="bg-linear-to-r from-amber-500 to-orange-600 p-1 rounded-2xl shadow-xl shadow-amber-100">
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

      {/* ===== GRILLE DES STATISTIQUES ===== */}
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

        {/* Bouton "Voir plus/moins" si plus de 4 stats */}
        {statsCards.length > 4 && (
          <button
            onClick={() => setShowAllStats(!showAllStats)}
            className="w-full mt-4 py-3 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors"
          >
            {showAllStats ? (
              <>Voir moins <ChevronUp size={16} /></>
            ) : (
              <>Voir plus de statistiques <ChevronDown size={16} /></>
            )}
          </button>
        )}
      </div>

      {/* ===== RÉSUMÉ RAPIDE ===== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 font-bold mb-1">Produits</p>
          <p className="text-xl font-black text-slate-800">{stats?.total_products || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 font-bold mb-1">En rupture</p>
          <p className="text-xl font-black text-red-600">{stats?.out_of_stock_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 font-bold mb-1">Expirés</p>
          <p className="text-xl font-black text-orange-600">{stats?.expired_count || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
          <p className="text-xs text-slate-500 font-bold mb-1">Clients</p>
          <p className="text-xl font-black text-slate-800">{stats?.total_customers || 0}</p>
        </div>
      </div>

      {/* ===== APERÇU AVEC EXPORT ===== */}
      <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
            <BarChart3 size={16} className="text-blue-500" />
            Aperçu rapide
          </h3>
          <button
            onClick={() => handleExportPDF('Ventes', stats || null)}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-2 text-sm"
            title="Exporter en PDF"
          >
            <Download size={18} className="text-slate-500" />
            <span className="hidden sm:inline">Exporter</span>
          </button>
        </div>

        {/* Lignes d'aperçu */}
        <div className="space-y-3">
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
            <span className="font-medium">Ventes aujourd'hui</span>
            <span className="font-bold text-blue-600">{formatCurrency(stats?.daily_sales || 0)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
            <span className="font-medium">Ventes ce mois</span>
            <span className="font-bold text-indigo-600">{formatCurrency(stats?.monthly_sales || 0)}</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
            <span className="font-medium">Valeur du stock</span>
            <span className="font-bold text-purple-600">{formatCurrency(stats?.total_stock_value || 0)}</span>
          </div>
          {/* Statistiques formatées si disponibles */}
          {formattedStats && (
            <>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="font-medium">Marge bénéficiaire</span>
                <span className="font-bold text-emerald-600">{formattedStats.profitMargin}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-xl">
                <span className="font-medium">Rotation du stock</span>
                <span className="font-bold text-amber-600">{formattedStats.stockTurnover}x</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ===== MODAL DE DÉTAILS ===== */}
      {selectedModal && (
        <DetailModal
          isOpen={!!selectedModal}
          onClose={() => setSelectedModal(null)}
          title={selectedModal.title}
          data={selectedModal.data}
          type={selectedModal.type}
          onExportPDF={() => handleExportPDF(selectedModal.title, selectedModal.data as DashboardStats | null)}
          userName={user?.nom_complet}
          pharmacyName={(user as any)?.pharmacy?.name || (user as any)?.pharmacy_name}
        />
      )}
    </div>
  );
};

export default Dashboard;