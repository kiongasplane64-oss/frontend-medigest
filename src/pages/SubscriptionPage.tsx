// SubscriptionPage.tsx
import { useState, useMemo, useCallback, ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getSubscription, 
  getSubscriptionUsage, 
  getAvailablePlans, 
  updateSubscription, 
  type Subscription, 
  type SubscriptionUsage, 
  type Plan
} from '@/services/subscriptionService';
import { toast } from 'react-hot-toast';
import { 
  Calendar, CheckCircle2, Loader2, Package, ShieldCheck, Users, 
  Star, Zap, Crown, Building2, Check, Download, X, AlertCircle, RefreshCw,
  Wallet, CreditCard, Smartphone
} from 'lucide-react';

// ============================================================================
// INTERFACES
// ============================================================================

interface ExtendedSubscription extends Omit<Subscription, 'id'> {
  id?: string;
}

interface PlanFeature {
  id?: number;
  name: string;
  description?: string;
}

interface ExtendedPlan extends Omit<Plan, 'features'> {
  features?: string[] | PlanFeature[];
  is_popular?: boolean;
  price_monthly?: number;
  price_yearly?: number;
}

interface CurrentPlanData {
  id?: string;
  name: string;
  price: number;
  type: string;
  max_users: string | number;
  max_products: string | number;
  billing_cycle: string;
}

interface PlanComparisonCardProps {
  plan: ExtendedPlan;
  isCurrentPlan: boolean;
  isPopular: boolean;
  isLoading: boolean;
  onSelect: (plan: ExtendedPlan) => void;
  getPlanIcon: (type: string) => ReactElement;
  getPlanColor: (type: string) => string;
}

interface UsageStatsProps {
  usage: SubscriptionUsage;
  daysRemaining: number | null;
  subscriptionData?: ExtendedSubscription;
}

interface SuccessModalProps {
  isOpen: boolean;
  selectedPlan: ExtendedPlan | null;
  onClose: () => void;
  getPlanColor: (type: string) => string;
}

// ============================================================================
// CONSTANTES
// ============================================================================

const DEFAULT_USAGE: SubscriptionUsage = {
  current_products: 0,
  max_products: 100,
  usage_percentage: 0,
  remaining_products: 100,
  current_users: 1,
  max_users: 1,
  users_usage_percentage: 0,
  remaining_users: 0
};

const PLAN_TYPE_ICONS: Record<string, ReactElement> = {
  free: <Zap size={24} />,
  standard: <Star size={24} />,
  pro: <Crown size={24} />,
  enterprise: <Building2 size={24} />
};

const PLAN_TYPE_COLORS: Record<string, string> = {
  free: 'text-blue-500',
  standard: 'text-green-500',
  pro: 'text-purple-500',
  enterprise: 'text-amber-500'
};

const PLAN_TYPE_BG_COLORS: Record<string, string> = {
  free: 'bg-blue-100 text-blue-500',
  standard: 'bg-green-100 text-green-500',
  pro: 'bg-purple-100 text-purple-500',
  enterprise: 'bg-amber-100 text-amber-500'
};

const STATUS_CONFIG: Record<string, { text: string; className: string }> = {
  active: { text: 'Actif', className: 'bg-green-100 text-green-600' },
  cancelled: { text: 'Annulé', className: 'bg-red-100 text-red-600' },
  pending: { text: 'En attente', className: 'bg-amber-100 text-amber-600' }
};

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ExtendedPlan | null>(null);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<ExtendedPlan | null>(null);

  // HOOKS DE REQUÊTE
  const { 
    data: subscriptionData, 
    isLoading: loadingSubscription,
    error: subscriptionError,
    refetch: refetchSubscription
  } = useQuery<ExtendedSubscription>({
    queryKey: ['subscription'],
    queryFn: getSubscription,
    retry: 2
  });
  
  const { 
    data: usageData, 
    isLoading: loadingUsage,
    error: usageError,
    refetch: refetchUsage
  } = useQuery<SubscriptionUsage>({
    queryKey: ['subscription-usage'],
    queryFn: getSubscriptionUsage,
    retry: 2
  });
  
  const { 
    data: plansData, 
    isLoading: loadingPlans,
    error: plansError,
    refetch: refetchPlans
  } = useQuery<ExtendedPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: getAvailablePlans,
    retry: 2
  });

  // MUTATION - CORRIGÉE : envoie seulement les données nécessaires
  const mutation = useMutation({
    mutationFn: (plan: ExtendedPlan) => {
      // Extraire uniquement les données nécessaires pour l'API
      // Le backend attend { plan: string, billing_cycle: string }
      const payload = {
        plan: plan.type || plan.id || '',  // Le type du plan (ex: 'pro', 'starter')
        billing_cycle: plan.billing_cycle || 'monthly'
      };
      
      console.log('🔄 Envoi de la mise à jour:', payload);
      return updateSubscription(payload);
    },
    onSuccess: (data) => {
      console.log('✅ Mise à jour réussie:', data);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      setIsSuccessModalOpen(true);
      toast.success("Votre abonnement a été mis à jour avec succès !");
    },
    onError: (error: Error) => {
      console.error('❌ Erreur de mutation:', error);
      toast.error(error.message || "Erreur lors du changement de plan. Veuillez réessayer.");
    }
  });

  // MÉMOÏSATION
  const currentPlanName = useMemo(() => 
    subscriptionData?.plan_name || 'Gratuit', 
    [subscriptionData]
  );

  const getPlanTypeFromName = useCallback((planName: string): string => {
    if (!planName) return 'free';
    const name = planName.toLowerCase();
    
    const planTypeMapping = [
      { keywords: ['gratuit', 'starter', 'free'], type: 'free' },
      { keywords: ['standard'], type: 'standard' },
      { keywords: ['professional', 'pro'], type: 'pro' },
      { keywords: ['enterprise'], type: 'enterprise' }
    ];

    const matchedType = planTypeMapping.find(({ keywords }) => 
      keywords.some(keyword => name.includes(keyword))
    );

    return matchedType?.type || 'free';
  }, []);

  const currentPlanType = useMemo(() => 
    getPlanTypeFromName(currentPlanName), 
    [currentPlanName, getPlanTypeFromName]
  );

  const daysRemaining = useMemo(() => {
    if (!subscriptionData?.end_date) return null;
    const endDate = new Date(subscriptionData.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [subscriptionData?.end_date]);

  const usage = useMemo(() => 
    usageData || DEFAULT_USAGE, 
    [usageData]
  );

  // FONCTIONS UTILITAIRES
  const getPlanIcon = useCallback((type: string): ReactElement => {
    return PLAN_TYPE_ICONS[type] || <ShieldCheck size={24} />;
  }, []);

  const getPlanColor = useCallback((type: string): string => {
    return PLAN_TYPE_COLORS[type] || 'text-blue-500';
  }, []);

  const getPlanBgColor = useCallback((type: string): string => {
    return PLAN_TYPE_BG_COLORS[type] || 'bg-blue-100 text-blue-500';
  }, []);

  const getDisplayValue = useCallback((value: string | number): string | number => {
    if (value === "Illimité" || value === 0) {
      return "∞";
    }
    return value;
  }, []);

  const getRemainingText = useCallback((value: string | number, label: string): string => {
    if (value === "Illimité" || value === 0) {
      return "Illimité";
    }
    
    const numericValue = Number(value);
    const pluralSuffix = numericValue !== 1 ? 's' : '';
    
    if (label === 'users') {
      return `${numericValue} restant${pluralSuffix}`;
    }
    
    return `${numericValue} produit${pluralSuffix} restant${pluralSuffix}`;
  }, []);

  const getUsagePercentage = useCallback((percentage?: number): number => {
    if (percentage === undefined) return 0;
    const numericPercentage = typeof percentage === 'number' ? percentage : 0;
    return Math.min(100, Math.max(0, numericPercentage));
  }, []);

  // GESTIONNAIRES D'ÉVÉNEMENTS
  const handlePlanSelect = useCallback((plan: ExtendedPlan) => {
    setSelectedPlan(plan);
    
    if (subscriptionData?.plan_name === plan.name) {
      toast.error("Vous êtes déjà sur ce plan !");
      return;
    }

    const price = plan.price_monthly || plan.price || 0;
    const confirmMessage = price === 0 
      ? `Confirmez-vous le passage au plan GRATUIT "${plan.name}" ?`
      : `Confirmez-vous le passage au plan "${plan.name}" pour ${price} €/mois ?`;

    if (window.confirm(confirmMessage)) {
      if (price > 0) {
        setPendingPlan(plan);
        setShowPaymentOptions(true);
      } else {
        mutation.mutate(plan);
      }
    }
  }, [subscriptionData, mutation]);

  const handlePaymentMethodSelect = (method: 'cash' | 'mobile' | 'international') => {
    if (!pendingPlan) return;

    const currentPlanData: CurrentPlanData = {
      id: subscriptionData?.id,
      name: subscriptionData?.plan_name || 'Gratuit',
      price: subscriptionData?.price || 0,
      type: currentPlanType,
      max_users: usage.max_users || 1,
      max_products: usage.max_products || 100,
      billing_cycle: subscriptionData?.billing_cycle || 'monthly'
    };

    if (method === 'cash') {
      navigate('/activate-code', {
        state: {
          plan: pendingPlan,
          currentPlan: currentPlanData
        }
      });
    } else {
      navigate('/payment', {
        state: {
          plan: pendingPlan,
          currentPlan: currentPlanData,
          paymentType: method
        }
      });
    }

    setShowPaymentOptions(false);
    setPendingPlan(null);
  };

  // VÉRIFICATIONS
  const safePlansData = useMemo(() => {
    if (!plansData) return [];
    return Array.isArray(plansData) ? plansData : [];
  }, [plansData]);

  const isLoading = loadingSubscription || loadingUsage || loadingPlans;
  const hasError = subscriptionError || usageError || plansError;

  // RENDU CONDITIONNEL
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="animate-spin text-blue-500 mx-auto" size={48} />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Chargement de vos informations...
          </p>
        </div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <ErrorState 
          subscriptionError={subscriptionError}
          usageError={usageError}
          plansError={plansError}
          onRetry={() => {
            refetchSubscription();
            refetchUsage();
            refetchPlans();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500">
      {/* SECTION 1 : STATUTS ET USAGE */}
      <div className="space-y-6">
        <PageHeader status={subscriptionData?.status} />
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CurrentPlanSection 
            planType={currentPlanType}
            planName={currentPlanName}
            planPrice={subscriptionData?.price || 0}
            getPlanIcon={getPlanIcon}
            getPlanBgColor={getPlanBgColor}
          />
          
          <UsageStats 
            usage={usage}
            daysRemaining={daysRemaining}
            subscriptionData={subscriptionData}
            getDisplayValue={getDisplayValue}
            getRemainingText={getRemainingText}
            getUsagePercentage={getUsagePercentage}
          />

          <StorageCapacity 
            usage={usage}
            getDisplayValue={getDisplayValue}
            getRemainingText={getRemainingText}
            getUsagePercentage={getUsagePercentage}
          />
        </div>
      </div>

      {/* SECTION 2 : COMPARATIF DES PLANS */}
      {safePlansData.length === 0 ? (
        <EmptyPlansState onRetry={refetchPlans} />
      ) : (
        <PlanComparisonSection 
          plans={safePlansData}
          currentPlanName={currentPlanName}
          getPlanIcon={getPlanIcon}
          getPlanColor={getPlanColor}
          onPlanSelect={handlePlanSelect}
          isLoading={mutation.isPending}
        />
      )}

      {/* MODALE DE CHOIX DE PAIEMENT */}
      {showPaymentOptions && pendingPlan && (
        <PaymentOptionsModal
          plan={pendingPlan}
          onClose={() => {
            setShowPaymentOptions(false);
            setPendingPlan(null);
          }}
          onSelectMethod={handlePaymentMethodSelect}
        />
      )}

      {/* MODALE DE SUCCÈS */}
      <SuccessModal 
        isOpen={isSuccessModalOpen}
        selectedPlan={selectedPlan}
        onClose={() => setIsSuccessModalOpen(false)}
        getPlanColor={getPlanColor}
      />
    </div>
  );
}

// ============================================================================
// COMPOSANTS SECONDAIRES
// ============================================================================

// Composant : État d'erreur
function ErrorState({ subscriptionError, usageError, plansError, onRetry }: any) {
  const getErrorMessage = (error: any) => {
    if (!error) return null;
    return error.message || "Une erreur est survenue";
  };

  return (
    <div className="bg-white rounded-4xl border border-red-100 shadow-xl max-w-md w-full p-10 text-center">
      <div className="w-20 h-20 bg-red-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
        <AlertCircle size={40} className="text-red-500" />
      </div>
      
      <h2 className="text-2xl font-black text-slate-900 uppercase italic mb-4">
        Oups !
      </h2>
      
      <div className="space-y-2 mb-8">
        {subscriptionError && (
          <p className="text-sm text-red-600">Abonnement : {getErrorMessage(subscriptionError)}</p>
        )}
        {usageError && (
          <p className="text-sm text-red-600">Utilisation : {getErrorMessage(usageError)}</p>
        )}
        {plansError && (
          <p className="text-sm text-red-600">Plans : {getErrorMessage(plansError)}</p>
        )}
      </div>

      <button
        onClick={onRetry}
        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
      >
        <RefreshCw size={16} />
        Réessayer
      </button>
    </div>
  );
}

// Composant : État vide pour les plans
function EmptyPlansState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="bg-slate-50 rounded-4xl border border-slate-200 p-12 text-center">
      <Package size={48} className="text-slate-300 mx-auto mb-4" />
      <h3 className="text-xl font-black text-slate-900 uppercase italic mb-2">
        Aucun plan disponible
      </h3>
      <p className="text-sm text-slate-500 mb-6">
        Les plans d'abonnement ne sont pas disponibles pour le moment.
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all inline-flex items-center gap-3"
      >
        <RefreshCw size={14} />
        Rafraîchir
      </button>
    </div>
  );
}

// Composant : En-tête de page
function PageHeader({ status }: { status?: string }) {
  const statusInfo = STATUS_CONFIG[status || 'pending'] || STATUS_CONFIG.pending;

  return (
    <div className="flex justify-between items-end">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
          MON <span className="text-blue-500">ABONNEMENT</span>
        </h1>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
          Gestion de votre forfait et utilisation
        </p>
      </div>
      <div className={`px-4 py-2 rounded-full font-black text-[10px] uppercase tracking-widest ${statusInfo.className}`}>
        Statut : {statusInfo.text}
      </div>
    </div>
  );
}

// Composant : Section Plan Actuel
interface CurrentPlanSectionProps {
  planType: string;
  planName: string;
  planPrice: number;
  getPlanIcon: (type: string) => ReactElement;
  getPlanBgColor: (type: string) => string;
}

function CurrentPlanSection({
  planType,
  planName,
  planPrice,
  getPlanIcon,
  getPlanBgColor
}: CurrentPlanSectionProps) {
  return (
    <div className="lg:col-span-2 bg-white rounded-4xl p-8 border border-slate-100 shadow-sm space-y-8 hover:shadow-md transition-shadow">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${getPlanBgColor(planType)}`}>
            {getPlanIcon(planType)}
          </div>
          <div>
            <h3 className="font-black text-2xl text-slate-900 uppercase italic">
              {planName}
            </h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
              Abonnement en cours
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-slate-900">
            {planPrice} €
          </p>
          <p className="text-[10px] font-black text-slate-400 uppercase">
            Mensuel
          </p>
        </div>
      </div>
    </div>
  );
}

// Composant : Statistiques d'utilisation
interface UsageStatsEnhancedProps extends UsageStatsProps {
  getDisplayValue: (value: string | number) => string | number;
  getRemainingText: (value: string | number, label: string) => string;
  getUsagePercentage: (percentage?: number) => number;
}

function UsageStats({
  usage,
  daysRemaining,
  subscriptionData,
  getDisplayValue,
  getRemainingText,
  getUsagePercentage
}: UsageStatsEnhancedProps) {
  const usersUsagePercentage = getUsagePercentage(usage.users_usage_percentage);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white transition-colors">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Utilisateurs</p>
            <p className="text-2xl font-black text-slate-800">
              {usage.current_users} / {getDisplayValue(usage.max_users)}
            </p>
          </div>
          <Users className="text-slate-200" size={32} />
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div 
            className="h-full bg-blue-500 transition-all duration-1000"
            style={{ width: `${usersUsagePercentage}%` }}
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {getRemainingText(usage.remaining_users, 'users')}
        </p>
      </div>
      
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 hover:bg-white transition-colors">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
              {daysRemaining && daysRemaining > 0 ? 'Expire dans' : 'Expiré depuis'}
            </p>
            <p className="text-xl font-bold text-slate-700">
              {daysRemaining && daysRemaining > 0 
                ? `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`
                : subscriptionData?.end_date
                  ? new Date(subscriptionData.end_date).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'Illimité'
              }
            </p>
          </div>
          <Calendar className="text-slate-200" size={32} />
        </div>
        <p className="text-[10px] text-slate-400 font-bold mt-4">
          {subscriptionData?.start_date && (
            <>Débuté le {new Date(subscriptionData.start_date).toLocaleDateString('fr-FR')}</>
          )}
        </p>
      </div>
    </div>
  );
}

// Composant : Capacité de stockage
interface StorageCapacityProps {
  usage: SubscriptionUsage;
  getDisplayValue: (value: string | number) => string | number;
  getRemainingText: (value: string | number, label: string) => string;
  getUsagePercentage: (percentage?: number) => number;
}

function StorageCapacity({
  usage,
  getDisplayValue,
  getRemainingText,
  getUsagePercentage
}: StorageCapacityProps) {
  const usagePercentage = getUsagePercentage(usage.usage_percentage);

  return (
    <div className="bg-slate-900 rounded-4xl p-8 text-white flex flex-col justify-between shadow-2xl hover:shadow-3xl transition-shadow">
      <div>
        <div className="flex items-center gap-2 mb-8">
          <Package size={20} className="text-blue-400" />
          <h3 className="font-black text-xs uppercase tracking-widest">Capacité Stock</h3>
        </div>
        <p className="text-5xl font-black italic tracking-tighter mb-2">
          {usage.current_products}
          <span className="text-slate-500 text-2xl font-medium ml-2">
            / {getDisplayValue(usage.max_products)}
          </span>
        </p>
        <p className="text-[10px] font-bold text-slate-400 uppercase">
          Produits enregistrés
        </p>
      </div>
      <div className="mt-10 space-y-3">
        <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${
              usagePercentage > 90 ? 'bg-red-500' : 'bg-blue-500'
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">0%</span>
          <span className={`font-bold ${
            usagePercentage > 90 ? 'text-red-500' : 'text-blue-400'
          }`}>
            {usagePercentage.toFixed(1)}%
          </span>
          <span className="text-slate-400">100%</span>
        </div>
        <p className="text-xs text-slate-400 mt-4">
          {getRemainingText(usage.remaining_products, 'products')}
        </p>
      </div>
    </div>
  );
}

// Composant : Section de comparaison des plans
interface PlanComparisonSectionProps {
  plans: ExtendedPlan[];
  currentPlanName: string;
  getPlanIcon: (type: string) => ReactElement;
  getPlanColor: (type: string) => string;
  onPlanSelect: (plan: ExtendedPlan) => void;
  isLoading: boolean;
}

function PlanComparisonSection({
  plans,
  currentPlanName,
  getPlanIcon,
  getPlanColor,
  onPlanSelect,
  isLoading
}: PlanComparisonSectionProps) {
  if (!plans || !Array.isArray(plans)) {
    console.error('PlanComparisonSection: plans doit être un tableau', plans);
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-slate-900 uppercase italic">
          Changer de Forfait
        </h2>
        <p className="text-sm text-slate-500 font-medium">
          Sélectionnez la puissance adaptée à la taille de votre pharmacie
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => (
          <PlanComparisonCard
            key={plan.id}
            plan={plan}
            isCurrentPlan={currentPlanName === plan.name}
            isPopular={plan.is_popular || false}
            isLoading={isLoading}
            onSelect={onPlanSelect}
            getPlanIcon={getPlanIcon}
            getPlanColor={getPlanColor}
          />
        ))}
      </div>

      <div className="text-center">
        <p className="text-xs text-slate-500 font-medium">
          Tous les prix sont TTC. Facturation mensuelle ou annuelle. Pas d'engagement.
        </p>
      </div>
    </div>
  );
}

// Composant : Carte de comparaison de plan
function PlanComparisonCard({
  plan,
  isCurrentPlan,
  isPopular,
  isLoading,
  onSelect,
  getPlanIcon,
  getPlanColor
}: PlanComparisonCardProps) {
  const price = plan.price_monthly || plan.price || 0;
  
  const getButtonText = () => {
    if (isLoading) return 'Chargement...';
    if (isCurrentPlan) return 'Plan Actif';
    if (price === 0) return 'Sélectionner Gratuit';
    return 'Choisir ce plan';
  };

  const getButtonClasses = () => {
    if (isCurrentPlan) {
      return 'bg-slate-100 text-slate-400 cursor-not-allowed';
    }
    if (isLoading) {
      return 'bg-slate-400 animate-pulse text-white cursor-wait';
    }
    if (plan.type === 'pro' || plan.type === 'enterprise') {
      return 'bg-slate-900 text-white hover:bg-blue-600 hover:scale-105 shadow-lg shadow-slate-200 active:scale-95';
    }
    return 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 shadow-lg shadow-blue-200 active:scale-95';
  };

  return (
    <div 
      className={`relative bg-white border-2 rounded-4xl p-8 transition-all hover:shadow-2xl flex flex-col ${
        isCurrentPlan 
          ? 'border-blue-500 shadow-xl shadow-blue-100 scale-105 z-10' 
          : 'border-slate-100 hover:border-blue-200 hover:shadow-lg'
      } ${isPopular ? 'ring-2 ring-amber-500/20' : ''}`}
    >
      {isCurrentPlan && <CurrentPlanBadge />}
      {isPopular && !isCurrentPlan && <RecommendedBadge />}

      <div className="mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
          isCurrentPlan 
            ? 'bg-blue-500 text-white' 
            : plan.type === 'pro' || plan.type === 'enterprise'
            ? 'bg-slate-900 text-white'
            : 'bg-slate-100 text-slate-400'
        }`}>
          {getPlanIcon(plan.type)}
        </div>
        <h3 className={`font-black text-xl uppercase italic mb-1 ${getPlanColor(plan.type)}`}>
          {plan.name}
        </h3>
      </div>

      <div className="mb-8">
        <div className="flex items-baseline">
          <span className="text-3xl font-black text-slate-900 leading-none">
            {price}
          </span>
          <span className="text-sm font-bold text-slate-400 ml-1">
            €/{plan.billing_cycle === 'yearly' ? 'an' : 'mois'}
          </span>
        </div>
      </div>

      <PlanFeaturesList plan={plan} />

      <button 
        onClick={() => onSelect(plan)}
        disabled={isCurrentPlan || isLoading}
        className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${getButtonClasses()}`}
      >
        {getButtonText()}
      </button>
    </div>
  );
}

// Composant : Badge Plan Actuel
function CurrentPlanBadge() {
  return (
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
      Actuel
    </div>
  );
}

// Composant : Badge Recommandé
function RecommendedBadge() {
  return (
    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
      Recommandé
    </div>
  );
}

// Composant : Liste des fonctionnalités du plan
function PlanFeaturesList({ plan }: { plan: ExtendedPlan }) {
  const getMaxUsersText = () => {
    if (plan.max_users === "Illimité" || plan.max_users === 0) {
      return "Utilisateurs illimités";
    }
    return `${plan.max_users} utilisateur${plan.max_users > 1 ? 's' : ''}`;
  };

  const getMaxProductsText = () => {
    if (plan.max_products === "Illimité" || plan.max_products === 0) {
      return "Produits illimités";
    }
    return `${plan.max_products} produit${plan.max_products > 1 ? 's' : ''} maximum`;
  };

  const getFeatureText = (feature: string | PlanFeature): string => {
    if (typeof feature === 'string') {
      return feature.replace(/_/g, ' ');
    }
    return feature.name.replace(/_/g, ' ');
  };

  return (
    <ul className="space-y-4 mb-10 flex-1">
      <li className="flex items-start gap-3">
        <CheckCircle2 size={16} className="shrink-0 text-blue-500" />
        <span className="text-xs font-bold leading-tight text-slate-600">
          {getMaxUsersText()}
        </span>
      </li>
      <li className="flex items-start gap-3">
        <CheckCircle2 size={16} className="shrink-0 text-blue-500" />
        <span className="text-xs font-bold leading-tight text-slate-600">
          {getMaxProductsText()}
        </span>
      </li>
      {plan.features?.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <CheckCircle2 size={16} className="shrink-0 text-blue-500" />
          <span className="text-xs font-bold leading-tight text-slate-600">
            {getFeatureText(feature)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// Composant : Modale de succès
function SuccessModal({ isOpen, selectedPlan, onClose, getPlanColor }: SuccessModalProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[3rem] max-w-md w-full p-10 shadow-2xl relative overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-100 rounded-full blur-3xl" />
        
        <CloseButton onClose={onClose} />

        <div className="text-center space-y-6 relative">
          <SuccessIcon />
          <ModalHeader />
          <PlanDetails selectedPlan={selectedPlan} getPlanColor={getPlanColor} />
          <ModalActions onConfirm={handleConfirm} onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

// Composant : Bouton de fermeture
function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button 
      onClick={onClose}
      className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-lg hover:bg-slate-100"
    >
      <X size={24} />
    </button>
  );
}

// Composant : Icône de succès
function SuccessIcon() {
  return (
    <div className="w-20 h-20 bg-green-500 rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-green-200 rotate-12">
      <Check size={40} className="text-white -rotate-12" />
    </div>
  );
}

// Composant : En-tête de modale
function ModalHeader() {
  return (
    <div className="space-y-2">
      <h2 className="text-3xl font-black text-slate-900 italic uppercase">
        Félicitations !
      </h2>
      <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
        Votre forfait est désormais actif
      </p>
    </div>
  );
}

// Composant : Détails du plan dans la modale
function PlanDetails({ selectedPlan, getPlanColor }: { 
  selectedPlan: ExtendedPlan | null; 
  getPlanColor: (type: string) => string;
}) {
  const planName = selectedPlan?.name ?? 'Plan sélectionné';
  const planType = selectedPlan?.type ?? 'free';
  const maxProducts = selectedPlan?.max_products;
  const maxUsers = selectedPlan?.max_users;
  const planPrice = selectedPlan?.price_monthly || selectedPlan?.price || 0;

  const details = [
    {
      label: 'Nouveau Plan',
      value: planName,
      className: `font-black uppercase italic ${getPlanColor(planType)}`
    },
    {
      label: 'Limite Stock',
      value: maxProducts === "Illimité" || maxProducts === 0 
        ? "Illimité" 
        : maxProducts 
          ? `${maxProducts} Produit${maxProducts > 1 ? 's' : ''}`
          : "Non spécifié"
    },
    {
      label: 'Utilisateurs',
      value: maxUsers === "Illimité" || maxUsers === 0 
        ? "Illimité" 
        : maxUsers
          ? `${maxUsers} Utilisateur${maxUsers > 1 ? 's' : ''}`
          : "Non spécifié"
    },
    {
      label: 'Prix payé',
      value: `${planPrice} €`,
      className: 'font-black text-slate-900'
    }
  ];

  return (
    <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
      {details.map((detail, index) => (
        <div 
          key={index} 
          className={`flex justify-between items-center ${index < details.length - 1 ? 'border-b border-slate-200 pb-3' : ''}`}
        >
          <span className="text-[10px] font-black text-slate-400 uppercase">
            {detail.label}
          </span>
          <span className={`font-bold text-slate-700 ${detail.className || ''}`}>
            {detail.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Composant : Actions de la modale
function ModalActions({ onConfirm, onClose }: { 
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="pt-4 space-y-3">
      <button 
        onClick={onConfirm}
        className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-xl active:scale-95"
      >
        Accéder à mes nouvelles fonctionnalités
      </button>
      <button 
        onClick={onClose}
        className="w-full py-4 bg-white text-slate-400 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:text-slate-600 hover:border-slate-300 transition-all"
      >
        <Download size={14} /> Télécharger la facture (PDF)
      </button>
    </div>
  );
}

// Composant : Modale de choix du mode de paiement
function PaymentOptionsModal({ plan, onClose, onSelectMethod }: { 
  plan: ExtendedPlan; 
  onClose: () => void;
  onSelectMethod: (method: 'cash' | 'mobile' | 'international') => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-4xl max-w-md w-full p-8 shadow-2xl relative animate-in slide-in-from-bottom-10 duration-300">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2"
        >
          <X size={20} />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-black text-slate-900 uppercase italic mb-2">
            Mode de paiement
          </h2>
          <p className="text-sm text-slate-500">
            Choisissez comment vous souhaitez payer pour le plan {plan.name}
          </p>
        </div>

        <div className="space-y-4">
          {/* Paiement Cash */}
          <button
            onClick={() => onSelectMethod('cash')}
            className="w-full p-6 border-2 border-slate-100 rounded-3xl hover:border-blue-500 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center group-hover:bg-green-500 group-hover:text-white transition-colors">
                <Wallet size={24} className="text-green-600 group-hover:text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 mb-1">Paiement Cash</h3>
                <p className="text-xs text-slate-500">
                  Payez en espèces dans nos agences partenaires et recevez un code d'activation
                </p>
                <div className="mt-3 text-xs font-bold text-blue-600">
                  Vous recevrez un code à activer
                </div>
              </div>
            </div>
          </button>

          {/* Paiement Mobile Money */}
          <button
            onClick={() => onSelectMethod('mobile')}
            className="w-full p-6 border-2 border-slate-100 rounded-3xl hover:border-blue-500 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <Smartphone size={24} className="text-orange-600 group-hover:text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 mb-1">Mobile Money</h3>
                <p className="text-xs text-slate-500">
                  M-Pesa, Orange Money, Airtel Money, AfriMoney
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold">M-Pesa</span>
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold">Orange Money</span>
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold">Airtel</span>
                  <span className="px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-bold">AfriMoney</span>
                </div>
              </div>
            </div>
          </button>

          {/* Paiement International */}
          <button
            onClick={() => onSelectMethod('international')}
            className="w-full p-6 border-2 border-slate-100 rounded-3xl hover:border-blue-500 transition-all group text-left"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                <CreditCard size={24} className="text-blue-600 group-hover:text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-900 mb-1">Paiement International</h3>
                <p className="text-xs text-slate-500">
                  Carte bancaire (Visa, Mastercard) - Paiement sécurisé
                </p>
                <div className="flex gap-3 mt-3">
                  <span className="text-xs font-bold text-blue-600">VISA</span>
                  <span className="text-xs font-bold text-red-600">Mastercard</span>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-slate-600 font-bold uppercase"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}