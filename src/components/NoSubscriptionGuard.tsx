// components/NoSubscriptionGuard.tsx
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { AlertTriangle, Calendar, Clock, CreditCard } from 'lucide-react';

interface NoSubscriptionGuardProps {
  children: React.ReactNode;
}

export function NoSubscriptionGuard({ children }: NoSubscriptionGuardProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { 
    canAccess, 
    isExpired, 
    daysRemaining, 
    trialDaysRemaining,
    isTrial,
    subscription,
    user
  } = useSubscription();
  
  // Vérifier si l'accès est bloqué
  const isBlocked = !canAccess && user?.role !== 'super_admin';
  
  // Redirection automatique si nécessaire (optionnel)
  useEffect(() => {
    // Si l'utilisateur est bloqué et n'est pas déjà sur la page d'abonnement
    if (isBlocked && location.pathname !== '/subscription') {
      // Optionnel: rediriger automatiquement vers la page d'abonnement
      // Désactivé pour permettre à l'utilisateur de voir le message
      // navigate('/subscription', { state: { from: location.pathname } });
    }
  }, [isBlocked, location.pathname, navigate]);
  
  // Si l'utilisateur a accès, afficher les enfants normalement
  if (canAccess || user?.role === 'super_admin') {
    return <>{children}</>;
  }
  
  // Sinon, afficher l'interface de blocage
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <ExpiredSubscriptionCard
          isExpired={isExpired}
          daysRemaining={daysRemaining}
          isTrial={isTrial}
          trialDaysRemaining={trialDaysRemaining}
          subscription={subscription}
          onRenew={() => navigate('/subscription', { state: { from: location.pathname } })}
        />
      </div>
    </div>
  );
}

interface ExpiredSubscriptionCardProps {
  isExpired: boolean;
  daysRemaining: number;
  isTrial: boolean;
  trialDaysRemaining: number;
  subscription: any;
  onRenew: () => void;
}

function ExpiredSubscriptionCard({
  isExpired,
  daysRemaining,
  isTrial,
  trialDaysRemaining,
  subscription,
  onRenew
}: ExpiredSubscriptionCardProps) {
  const getTitle = () => {
    if (isTrial && trialDaysRemaining <= 0) return "Période d'essai terminée";
    if (isTrial) return "Fin d'essai imminente";
    if (isExpired) return "Abonnement expiré";
    if (daysRemaining <= 7 && daysRemaining > 0) return "Renouvellement imminent";
    return "Accès restreint";
  };
  
  const getDescription = () => {
    if (isTrial && trialDaysRemaining <= 0) {
      return "Votre période d'essai est terminée. Pour continuer à utiliser toutes les fonctionnalités, veuillez souscrire à un abonnement.";
    }
    if (isTrial && trialDaysRemaining > 0) {
      return `Votre période d'essai se termine dans ${trialDaysRemaining} jour${trialDaysRemaining > 1 ? 's' : ''}. Après cette date, vous perdrez l'accès à certaines fonctionnalités.`;
    }
    if (isExpired) {
      return "Votre abonnement a expiré. Vous êtes actuellement en mode lecture seule. Pour retrouver l'accès complet, veuillez renouveler votre abonnement.";
    }
    if (daysRemaining <= 7 && daysRemaining > 0) {
      return `Votre abonnement expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}. Renouvelez dès maintenant pour éviter toute interruption.`;
    }
    return "Vous n'avez pas d'abonnement actif. Souscrivez à un forfait pour accéder à toutes les fonctionnalités.";
  };
  
  const getActionButtonText = () => {
    if (isTrial && trialDaysRemaining <= 0) return "Souscrire un abonnement";
    if (isExpired) return "Renouveler l'abonnement";
    return "Voir les offres";
  };
  
  const getExpiryDate = () => {
    if (subscription?.end_date) {
      return new Date(subscription.end_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return null;
  };
  
  const getStartDate = () => {
    if (subscription?.start_date) {
      return new Date(subscription.start_date).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
    return null;
  };
  
  return (
    <div className="bg-white rounded-4xl shadow-2xl overflow-hidden">
      {/* Header avec dégradé */}
      <div className={`p-8 text-white ${
        isExpired || (isTrial && trialDaysRemaining <= 0)
          ? 'bg-linear-to-r from-red-600 to-red-500'
          : 'bg-linear-to-r from-amber-500 to-orange-500'
      }`}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center">
            <AlertTriangle size={32} className="text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase italic tracking-tighter">
              {getTitle()}
            </h1>
            <p className="text-sm font-medium opacity-90 mt-1">
              {subscription?.plan_name || 'Aucun plan actif'}
            </p>
          </div>
        </div>
      </div>
      
      {/* Contenu */}
      <div className="p-8 space-y-6">
        <p className="text-slate-600 font-medium leading-relaxed">
          {getDescription()}
        </p>
        
        {/* Informations sur l'abonnement */}
        {(getStartDate() || getExpiryDate()) && (
          <div className="bg-slate-50 rounded-3xl p-6 space-y-3">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">
              Détails de l'abonnement
            </h3>
            
            {getStartDate() && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Calendar size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-600">Début</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{getStartDate()}</span>
              </div>
            )}
            
            {getExpiryDate() && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-slate-400" />
                  <span className="text-sm text-slate-600">Fin</span>
                </div>
                <span className="text-sm font-bold text-slate-800">{getExpiryDate()}</span>
              </div>
            )}
            
            {!isExpired && daysRemaining > 0 && !isTrial && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-amber-500" />
                  <span className="text-sm text-slate-600">Temps restant</span>
                </div>
                <span className="text-sm font-black text-amber-600">
                  {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}
                </span>
              </div>
            )}
            
            {isTrial && trialDaysRemaining > 0 && (
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <Clock size={18} className="text-blue-500" />
                  <span className="text-sm text-slate-600">Essai restant</span>
                </div>
                <span className="text-sm font-black text-blue-600">
                  {trialDaysRemaining} jour{trialDaysRemaining > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
        
        {/* Mode lecture seule - Avertissement */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-800 mb-1">
                Mode lecture seule actif
              </p>
              <p className="text-xs text-amber-700">
                Vous pouvez consulter vos données, mais vous ne pouvez pas créer, modifier ou supprimer des éléments.
              </p>
            </div>
          </div>
        </div>
        
        {/* Restrictions */}
        <div className="space-y-2">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
            Restrictions actuelles
          </h4>
          <ul className="space-y-2">
            <li className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
              Consultation des données uniquement
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
              Création/Modification/Supression désactivées
            </li>
            <li className="flex items-center gap-3 text-sm text-slate-500">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
              Export des données limité
            </li>
          </ul>
        </div>
        
        {/* Bouton d'action */}
        <button
          onClick={onRenew}
          className="w-full py-5 bg-linear-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:from-blue-700 hover:to-blue-600 transition-all shadow-lg hover:shadow-xl active:scale-98 flex items-center justify-center gap-3"
        >
          <CreditCard size={20} />
          {getActionButtonText()}
        </button>
        
        {/* Message de support */}
        <p className="text-center text-xs text-slate-400">
          Besoin d'aide ? Contactez notre support à{' '}
          <a href="mailto:support@pharmastock.com" className="text-blue-500 hover:underline">
            support@pharmastock.com
          </a>
        </p>
      </div>
    </div>
  );
}