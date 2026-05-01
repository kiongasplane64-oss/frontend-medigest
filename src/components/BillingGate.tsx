// components/BillingGate.tsx
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuthStore } from '@/store/useAuthStore';
import { CreditCard } from 'lucide-react';

// Composant de chargement simple
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
  </div>
);

// Bouton simple (ou importez votre composant Button existant)
const Button = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition"
  >
    {children}
  </button>
);

export const BillingGate = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { subscription, isLoading } = useSubscription();
  
  // Chargement
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  // SUPER ADMIN → bypass (comme Salesforce)
  if (user?.role === 'super_admin') {
    return <>{children}</>;
  }
  
  // Routes billing → bypass (comme Stripe)
  if (location.pathname.startsWith('/billing')) {
    return <>{children}</>;
  }
  
  // Subscription active ou trial → OK
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  if (isActive) {
    return <>{children}</>;
  }
  
  // Blocage élégant (comme Spotify free tier)
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md text-center p-8">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CreditCard className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Abonnement requis</h2>
        <p className="text-gray-600 mb-6">
          {subscription?.status === 'past_due' 
            ? 'Votre paiement est en retard. Mettez à jour vos informations.'
            : 'Activez un abonnement pour accéder à cette section.'}
        </p>
        <Button onClick={() => navigate('/billing')}>
          Voir les offres
        </Button>
      </div>
    </div>
  );
};