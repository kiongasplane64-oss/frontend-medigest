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
  Star, Zap, Crown, Building2, Check, Download, X
} from 'lucide-react';

// 1. Interfaces étendues avec typage précis
interface ExtendedSubscription extends Omit<Subscription, 'id'> {
  id?: string;
}

interface PlanFeature {
  id?: number;
  name: string;
  description?: string;
}

// Type pour les plans avec features qui peuvent être string[] ou PlanFeature[]
interface ExtendedPlan extends Omit<Plan, 'features'> {
  features?: string[] | PlanFeature[];
  is_popular?: boolean;
}

// Type pour les plans compatibles avec le service (conversion vers Plan)
interface ServicePlan extends Plan {
  features: string[];
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

// 2. Props interfaces pour les composants
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

// 3. Constantes et valeurs par défaut
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
  active: { text: 'Actif', className: 'bg-success/10 text-success' },
  cancelled: { text: 'Annulé', className: 'bg-danger/10 text-danger' },
  pending: { text: 'En attente', className: 'bg-warning/10 text-warning' }
};

// Fonction utilitaire pour convertir ExtendedPlan en Plan pour le service
const convertToServicePlan = (plan: ExtendedPlan): ServicePlan => {
  // Convertir les features en string[] si nécessaire
  let features: string[] = [];
  
  if (plan.features) {
    if (Array.isArray(plan.features)) {
      features = plan.features.map(feature => 
        typeof feature === 'string' ? feature : feature.name
      );
    }
  }
  
  return {
    ...plan,
    features // Assure que features est toujours un string[]
  } as ServicePlan;
};

export default function SubscriptionPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ExtendedPlan | null>(null);

  // 1. Data fetching avec typage approprié
  const { 
    data: subscriptionData, 
    isLoading: loadingSubscription 
  } = useQuery<ExtendedSubscription>({
    queryKey: ['subscription'],
    queryFn: getSubscription
  });
  
  const { 
    data: usageData, 
    isLoading: loadingUsage 
  } = useQuery<SubscriptionUsage>({
    queryKey: ['subscription-usage'],
    queryFn: getSubscriptionUsage
  });
  
  const { 
    data: plansData, 
    isLoading: loadingPlans 
  } = useQuery<ExtendedPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: getAvailablePlans
  });

  // 2. Mutation avec conversion du plan pour le service
  const mutation = useMutation({
    mutationFn: (plan: ExtendedPlan) => {
      const servicePlan = convertToServicePlan(plan);
      return updateSubscription(servicePlan);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-usage'] });
      setIsSuccessModalOpen(true);
      toast.success("Votre abonnement a été mis à jour avec succès !");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors du changement de plan. Veuillez réessayer.");
      console.error("Erreur de mutation:", error);
    }
  });

  // 3. Mémoïsation des valeurs calculées
  const currentPlanName = useMemo(() => 
    subscriptionData?.plan_name || 'Gratuit', 
    [subscriptionData]
  );

  const getPlanTypeFromName = useCallback((planName: string): string => {
    if (!planName) return 'free';
    const name = planName.toLowerCase();
    
    const planTypeMapping = [
      { keywords: ['gratuit', 'starter'], type: 'free' },
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

  // 4. Fonctions utilitaires memoïsées
  const getPlanIcon = useCallback((type: string): ReactElement => {
    return PLAN_TYPE_ICONS[type] || <ShieldCheck size={24} />;
  }, []);

  const getPlanColor = useCallback((type: string): string => {
    return PLAN_TYPE_COLORS[type] || 'text-medical';
  }, []);

  const getPlanBgColor = useCallback((type: string): string => {
    return PLAN_TYPE_BG_COLORS[type] || 'bg-medical-light text-medical';
  }, []);

  // 5. Gestion des valeurs "Illimité"
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

  // 6. Gestion du changement de plan
  const handlePlanChange = useCallback((plan: ExtendedPlan) => {
    setSelectedPlan(plan);
    
    if (subscriptionData?.plan_name === plan.name) {
      toast.error("Vous êtes déjà sur ce plan !");
      return;
    }

    const confirmMessage = plan.price === 0 
      ? `Confirmez-vous le passage au plan GRATUIT "${plan.name}" ?`
      : `Confirmez-vous le passage au plan "${plan.name}" pour ${plan.price} €/mois ?`;

    if (window.confirm(confirmMessage)) {
      if (plan.price > 0) {
        const currentPlanData: CurrentPlanData = {
          id: subscriptionData?.id,
          name: subscriptionData?.plan_name || 'Gratuit',
          price: subscriptionData?.price || 0,
          type: currentPlanType,
          max_users: usage.max_users || 1,
          max_products: usage.max_products || 100,
          billing_cycle: subscriptionData?.billing_cycle || 'monthly'
        };

        navigate('/payment', {
          state: {
            plan,
            currentPlan: currentPlanData
          }
        });
      } else {
        mutation.mutate(plan);
      }
    }
  }, [subscriptionData, currentPlanType, usage, navigate, mutation]);

  // 7. État de chargement
  if (loadingSubscription || loadingUsage || loadingPlans) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-medical" size={40} />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-500">
      {/* SECTION 1 : STATUTS ET USAGE */}
      <div className="space-y-6">
        <PageHeader 
          status={subscriptionData?.status}
        />
        
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
      <PlanComparisonSection 
        plans={plansData || []}
        currentPlanName={currentPlanName}
        getPlanIcon={getPlanIcon}
        getPlanColor={getPlanColor}
        onPlanSelect={handlePlanChange}
        isLoading={mutation.isPending}
      />

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

// Composant : En-tête de page
function PageHeader({ status }: { status?: string }) {
  const statusInfo = STATUS_CONFIG[status || 'pending'] || STATUS_CONFIG.pending;

  return (
    <div className="flex justify-between items-end">
      <div>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
          MON <span className="text-medical">ABONNEMENT</span>
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
            className="h-full bg-medical transition-all duration-1000"
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
          <Package size={20} className="text-medical" />
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
              usagePercentage > 90 ? 'bg-danger' : 'bg-medical'
            }`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">0%</span>
          <span className={`font-bold ${
            usagePercentage > 90 ? 'text-danger' : 'text-medical'
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
  const getButtonText = () => {
    if (isLoading) return 'Chargement...';
    if (isCurrentPlan) return 'Plan Actif';
    if (plan.price === 0) return 'Sélectionner Gratuit';
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
      return 'bg-slate-900 text-white hover:bg-medical hover:scale-105 shadow-lg shadow-slate-200 active:scale-95';
    }
    return 'bg-medical text-white hover:bg-medical-dark hover:scale-105 shadow-lg shadow-medical/20 active:scale-95';
  };

  return (
    <div 
      className={`relative bg-white border-2 rounded-4xl p-8 transition-all hover:shadow-2xl flex flex-col ${
        isCurrentPlan 
          ? 'border-medical shadow-xl shadow-medical/5 scale-105 z-10' 
          : 'border-slate-100 hover:border-medical/30 hover:shadow-lg'
      } ${isPopular ? 'ring-2 ring-amber-500/20' : ''}`}
    >
      {isCurrentPlan && (
        <CurrentPlanBadge />
      )}

      {isPopular && !isCurrentPlan && (
        <RecommendedBadge />
      )}

      <div className="mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
          isCurrentPlan 
            ? 'bg-medical text-white' 
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
            {plan.price}
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
    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-medical text-white px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
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
    return `${plan.max_users} utilisateurs`;
  };

  const getMaxProductsText = () => {
    if (plan.max_products === "Illimité" || plan.max_products === 0) {
      return "Produits illimités";
    }
    return `${plan.max_products} produits maximum`;
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
        <CheckCircle2 size={16} className="shrink-0 text-medical" />
        <span className="text-xs font-bold leading-tight text-slate-600">
          {getMaxUsersText()}
        </span>
      </li>
      <li className="flex items-start gap-3">
        <CheckCircle2 size={16} className="shrink-0 text-medical" />
        <span className="text-xs font-bold leading-tight text-slate-600">
          {getMaxProductsText()}
        </span>
      </li>
      {plan.features?.map((feature, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <CheckCircle2 size={16} className="shrink-0 text-medical" />
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
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-medical/10 rounded-full blur-3xl" />
        
        <CloseButton onClose={onClose} />

        <div className="text-center space-y-6 relative">
          <SuccessIcon />
          
          <ModalHeader />
          
          <PlanDetails 
            selectedPlan={selectedPlan} 
            getPlanColor={getPlanColor} 
          />

          <ModalActions 
            onConfirm={handleConfirm}
            onClose={onClose}
          />
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
    <div className="w-20 h-20 bg-success rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-success/30 rotate-12">
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
  const details = [
    {
      label: 'Nouveau Plan',
      value: selectedPlan?.name,
      className: `font-black uppercase italic ${getPlanColor(selectedPlan?.type || 'free')}`
    },
    {
      label: 'Limite Stock',
      value: selectedPlan?.max_products === "Illimité" || selectedPlan?.max_products === 0 
        ? "Illimité" 
        : `${selectedPlan?.max_products} Produits`
    },
    {
      label: 'Utilisateurs',
      value: selectedPlan?.max_users === "Illimité" || selectedPlan?.max_users === 0 
        ? "Illimité" 
        : `${selectedPlan?.max_users} Utilisateurs`
    },
    {
      label: 'Prix payé',
      value: `${selectedPlan?.price || 0} €`,
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