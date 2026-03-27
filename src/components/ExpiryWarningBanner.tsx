// components/ExpiryWarningBanner.tsx (version optimisée)
import { useSubscription } from '@/hooks/useSubscription';
import { AlertTriangle, X, Clock, Calendar } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export function ExpiryWarningBanner() {
  const navigate = useNavigate();
  const { 
    showExpiryWarning, 
    daysUntilExpiry, 
    expiryWarningMessage,
    isTrial,
    trialDaysRemaining,
    formattedExpiryDate,
    subscription
  } = useSubscription();
  
  const [isVisible, setIsVisible] = useState(true);
  
  // Mémoriser la date de début formatée
  const formattedStartDate = useMemo(() => 
    subscription?.start_date 
      ? new Date(subscription.start_date).toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : null,
    [subscription?.start_date]
  );
  
  // Mémoriser la sévérité
  const severity = useMemo(() => {
    if (isTrial) return 'warning';
    if (daysUntilExpiry === 1) return 'critical';
    if (daysUntilExpiry && daysUntilExpiry <= 3) return 'high';
    return 'medium';
  }, [isTrial, daysUntilExpiry]);
  
  // Mémoriser le message
  const message = useMemo(() => {
    if (expiryWarningMessage) return expiryWarningMessage;
    
    if (isTrial) {
      if (trialDaysRemaining === 1) {
        return `🚨 DERNIER JOUR ! Votre période d'essai se termine aujourd'hui. Souscrivez un abonnement pour ne pas perdre l'accès.`;
      }
      return `⚠️ Votre période d'essai se termine dans ${trialDaysRemaining} jour${trialDaysRemaining > 1 ? 's' : ''}. Souscrivez un abonnement pour continuer.`;
    }
    
    if (daysUntilExpiry === 1) {
      return `🚨 DERNIER JOUR ! Votre abonnement expire aujourd'hui. Renouvelez immédiatement pour ne pas perdre l'accès.`;
    }
    
    return `⏰ Votre abonnement expire dans ${daysUntilExpiry} jour${daysUntilExpiry && daysUntilExpiry > 1 ? 's' : ''}. Renouvelez dès maintenant pour éviter toute interruption.`;
  }, [expiryWarningMessage, isTrial, trialDaysRemaining, daysUntilExpiry]);
  
  // Ne pas afficher si pas d'alerte ou si l'utilisateur a fermé
  if (!showExpiryWarning || !isVisible) return null;
  
  const severityStyles = {
    critical: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      button: 'bg-red-100 text-red-700 hover:bg-red-200',
      icon: 'text-red-500'
    },
    high: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      button: 'bg-orange-100 text-orange-700 hover:bg-orange-200',
      icon: 'text-orange-500'
    },
    medium: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-800',
      button: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
      icon: 'text-amber-500'
    },
    warning: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      button: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
      icon: 'text-blue-500'
    }
  };
  
  const styles = severityStyles[severity];
  
  return (
    <div className={`${styles.bg} border ${styles.border} rounded-2xl p-4 mb-6 animate-in slide-in-from-top duration-300`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`${styles.icon} shrink-0 mt-0.5`}>
            {severity === 'critical' ? (
              <AlertTriangle size={20} />
            ) : (
              <Clock size={20} />
            )}
          </div>
          
          <div className="space-y-2 flex-1">
            <p className={`text-sm font-bold ${styles.text}`}>
              {message}
            </p>
            
            {/* Détails de l'abonnement */}
            {subscription?.end_date && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar size={12} />
                  <span>Expiration: {formattedExpiryDate}</span>
                </div>
                {formattedStartDate && (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar size={12} />
                    <span>Début: {formattedStartDate}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Bouton d'action */}
            <button
              onClick={() => navigate('/subscription')}
              className={`mt-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider ${styles.button} transition-colors hover:scale-105 active:scale-95`}
            >
              {isTrial ? 'Souscrire un abonnement' : 'Renouveler maintenant'}
            </button>
          </div>
        </div>
        
        <button
          onClick={() => setIsVisible(false)}
          className="p-1 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
          aria-label="Fermer"
        >
          <X size={16} className="text-slate-400" />
        </button>
      </div>
    </div>
  );
}