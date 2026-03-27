// Layout/NotificationDrawer.tsx (mise à jour)
import { X, AlertTriangle, Database, CalendarOff, BellOff } from 'lucide-react';

// ==========================================================
// Définition des types
// ==========================================================
export type AlertType = 'EXPIRED' | 'STOCK_OUT' | 'NEAR_EXPIRY' | 'LOW_STOCK';

export interface PharmacyAlert {
  id: string;
  type: AlertType;
  productName: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  date: Date | string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  alerts: PharmacyAlert[];
  onNotificationClick?: (alert: PharmacyAlert) => void;
}

// ==========================================================
// Composant Principal
// ==========================================================
export default function NotificationDrawer({ isOpen, onClose, alerts = [], onNotificationClick }: Props) {
  
  // Sécurité contre le crash .map
  const safeAlerts = Array.isArray(alerts) ? alerts : [];

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return "Hier";
    if (diffDays < 7) return `Il y a ${diffDays} jours`;
    
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const handleNotificationClick = (alert: PharmacyAlert) => {
    if (onNotificationClick) {
      onNotificationClick(alert);
    }
    onClose();
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-100 transition-opacity" 
          onClick={onClose} 
        />
      )}

      {/* Panel latéral */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-101 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          
          {/* Header */}
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Centre d'alertes</h2>
              <p className="text-xs text-slate-400 font-medium">
                {safeAlerts.length} notification{safeAlerts.length > 1 ? 's' : ''}
              </p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          {/* Liste des notifications */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {safeAlerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <BellOff size={48} strokeWidth={1} />
                <p className="text-sm italic">Aucune alerte pour le moment</p>
              </div>
            ) : (
              safeAlerts.map((alert) => (
                <button
                  key={alert.id}
                  onClick={() => handleNotificationClick(alert)}
                  className={`w-full text-left p-4 rounded-2xl border-l-4 flex gap-4 transition-all hover:shadow-md hover:scale-[1.01] ${getAlertStyle(alert.type)}`}
                >
                  <div className="mt-1 shrink-0">{getAlertIcon(alert.type)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-sm text-slate-800 line-clamp-1">
                        {alert.productName}
                      </h4>
                      <span className="text-[10px] font-medium opacity-60 uppercase tracking-tighter shrink-0 ml-2">
                        {formatDate(alert.date)}
                      </span>
                    </div>
                    <p className="text-xs mt-1 leading-relaxed opacity-80">
                      {alert.message}
                    </p>
                    <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider text-blue-600 hover:underline">
                      Voir détails →
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {safeAlerts.length > 0 && (
            <div className="p-4 border-t border-slate-50">
              <button 
                className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                onClick={() => {
                  // Fonction pour tout marquer comme lu
                  console.log('Marquer tout comme lu');
                }}
              >
                Tout marquer comme lu
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Helpers
const getAlertStyle = (type: AlertType) => {
  switch (type) {
    case 'EXPIRED': return 'bg-red-50 border-red-500 text-red-700';
    case 'STOCK_OUT': return 'bg-slate-50 border-slate-800 text-slate-800';
    case 'NEAR_EXPIRY': return 'bg-orange-50 border-orange-500 text-orange-700';
    case 'LOW_STOCK': return 'bg-blue-50 border-blue-500 text-blue-700';
    default: return 'bg-slate-50 border-slate-200 text-slate-600';
  }
};

const getAlertIcon = (type: AlertType) => {
  switch (type) {
    case 'EXPIRED': return <CalendarOff size={18} className="text-red-500" />;
    case 'STOCK_OUT': return <AlertTriangle size={18} className="text-slate-800" />;
    case 'NEAR_EXPIRY': return <AlertTriangle size={18} className="text-orange-500" />;
    case 'LOW_STOCK': return <Database size={18} className="text-blue-500" />;
    default: return <Database size={18} />;
  }
};