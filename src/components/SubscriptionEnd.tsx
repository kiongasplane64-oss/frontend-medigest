// components/SubscriptionEnd.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useSubscription } from '@/hooks/useSubscription';
import { CheckCircle, XCircle, AlertTriangle, Calendar, CreditCard, RefreshCw } from 'lucide-react';

interface SubscriptionEndProps {
  children: React.ReactNode;
}

export const SubscriptionEnd: React.FC<SubscriptionEndProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    isExpired,
    daysRemaining,
    canAccess,
    isLoading,
    accessMessage,
    formattedExpiryDate,
    plan_name,
    refetch,
  } = useSubscription();

  const [showBanner, setShowBanner] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Attendre que le chargement soit terminé
    if (isLoading) return;

    // ✅ TOUS les utilisateurs vérifient l'abonnement de leur branche
    // Plus d'exception pour les vendeurs ou super admins
    
    // Vérifier si l'abonnement est expiré
    const subscriptionExpired = isExpired || (!canAccess && daysRemaining === 0);
    
    console.log('🔍 Vérification abonnement:', {
      isExpired,
      canAccess,
      daysRemaining,
      subscriptionExpired,
      userRole: user?.role
    });
    
    setShowBanner(subscriptionExpired);
    setChecking(false);
  }, [isLoading, isExpired, canAccess, daysRemaining, user]);

  // Si en cours de chargement, ne rien afficher
  if (isLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Vérification de votre abonnement...</p>
        </div>
      </div>
    );
  }

  // Si l'abonnement n'est pas expiré, afficher les enfants normalement
  if (!showBanner) {
    return <>{children}</>;
  }

  // Affichage de la page d'expiration d'abonnement
  return (
    <div className="min-h-screen bg-linear-to-br from-red-50 to-gray-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Carte principale */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* En-tête rouge */}
          <div className="bg-red-600 px-6 py-8 text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500 rounded-full mb-4">
              <XCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Abonnement expiré
            </h1>
            <p className="text-red-100">
              L'abonnement de votre succursale n'est plus actif
            </p>
          </div>

          {/* Contenu */}
          <div className="p-6 md:p-8">
            {/* Message d'alerte */}
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-800 font-medium mb-1">
                    Accès en lecture seule
                  </p>
                  <p className="text-amber-700 text-sm">
                    {accessMessage || "L'abonnement de votre succursale a expiré. Vous pouvez consulter les données mais vous ne pouvez plus effectuer de modifications."}
                  </p>
                </div>
              </div>
            </div>

            {/* Détails de l'abonnement */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Détails de l'abonnement
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Plan</span>
                  <span className="font-medium text-gray-900">{plan_name || 'Aucun plan'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date d'expiration</span>
                  <span className="font-medium text-red-600">{formattedExpiryDate || 'Non définie'}</span>
                </div>
                {daysRemaining !== undefined && daysRemaining < 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expiré depuis</span>
                    <span className="font-medium text-red-600">{Math.abs(daysRemaining)} jours</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Mode</span>
                  <span className="font-medium text-amber-600 flex items-center gap-1">
                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                    Lecture seule
                  </span>
                </div>
              </div>
            </div>

            {/* Limitations */}
            <div className="bg-red-50 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                Fonctionnalités désactivées
              </h3>
              <ul className="space-y-2 text-sm text-red-700">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  Création et modification de produits
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  Ajout et gestion d'utilisateurs
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  Enregistrement de ventes
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  Modification des paramètres
                </li>
              </ul>
            </div>

            {/* Fonctionnalités conservées */}
            <div className="bg-green-50 rounded-lg p-4 mb-8">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Fonctionnalités conservées
              </h3>
              <ul className="space-y-2 text-sm text-green-700">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Consultation des produits
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Consultation des rapports
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Export des données
                </li>
              </ul>
            </div>

            {/* Boutons d'action */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => navigate('/subscription')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Renouveler l'abonnement
              </button>
              <button
                onClick={() => {
                  refetch();
                  setTimeout(() => {
                    setChecking(true);
                  }, 500);
                }}
                className="flex-1 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Vérifier à nouveau
              </button>
            </div>

            {/* Message de contact */}
            <p className="text-center text-xs text-gray-500 mt-6">
              Une question ? Contactez notre support à{' '}
              <a href="mailto:support@medigest.com" className="text-blue-600 hover:underline">
                support@medigest.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionEnd;