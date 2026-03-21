// sections/SubscriptionsSection.tsx
import { CreditCard, DollarSign, TrendingUp, Activity, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

type PlanType = 'starter' | 'professional' | 'enterprise';

interface SubscriptionStats {
  summary: {
    total_tenants: number;
    trial_tenants: number;
    active_paid_tenants: number;
    conversion_rate: string;
  };
  distribution: Record<PlanType, number>;
  revenue: {
    monthly: number;
    yearly: number;
    average_per_tenant: number;
  };
  plans_config: Record<PlanType, { price_monthly: number; currency: string }>;
}

// Données par défaut pour éviter les erreurs
const DEFAULT_STATS: SubscriptionStats = {
  summary: {
    total_tenants: 0,
    trial_tenants: 0,
    active_paid_tenants: 0,
    conversion_rate: '0%'
  },
  distribution: {
    starter: 0,
    professional: 0,
    enterprise: 0
  },
  revenue: {
    monthly: 0,
    yearly: 0,
    average_per_tenant: 0
  },
  plans_config: {
    starter: { price_monthly: 0, currency: 'USD' },
    professional: { price_monthly: 0, currency: 'USD' },
    enterprise: { price_monthly: 0, currency: 'USD' }
  }
};

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'purple' | 'red';
}

const StatCard = ({ title, value, subtitle, icon, color }: StatCardProps) => {
  const colors: Record<string, { iconBg: string }> = {
    green: { iconBg: 'bg-green-100' },
    blue: { iconBg: 'bg-blue-100' },
    purple: { iconBg: 'bg-purple-100' },
    red: { iconBg: 'bg-red-100' }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
          </div>
        </div>
        <div className={`h-10 w-10 rounded-xl ${colors[color]?.iconBg || 'bg-gray-100'} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default function SubscriptionsSection() {
  const { data: rawData, isLoading, error } = useQuery({
    queryKey: ['superadmin-subscription-stats'],
    queryFn: async () => {
      try {
        const { data } = await api.get<SubscriptionStats>('/super-admin/subscriptions/statistics');
        console.log('📊 Subscription stats received:', data);
        return data;
      } catch (err) {
        console.error('❌ Error fetching subscription stats:', err);
        throw err;
      }
    },
    // Retry une fois en cas d'erreur
    retry: 1,
    // Ne pas refetch automatiquement si erreur
    retryOnMount: false
  });

  // Fusionner les données reçues avec les valeurs par défaut
  const stats = rawData ? {
    summary: {
      total_tenants: rawData.summary?.total_tenants ?? DEFAULT_STATS.summary.total_tenants,
      trial_tenants: rawData.summary?.trial_tenants ?? DEFAULT_STATS.summary.trial_tenants,
      active_paid_tenants: rawData.summary?.active_paid_tenants ?? DEFAULT_STATS.summary.active_paid_tenants,
      conversion_rate: rawData.summary?.conversion_rate ?? DEFAULT_STATS.summary.conversion_rate,
    },
    distribution: {
      starter: rawData.distribution?.starter ?? DEFAULT_STATS.distribution.starter,
      professional: rawData.distribution?.professional ?? DEFAULT_STATS.distribution.professional,
      enterprise: rawData.distribution?.enterprise ?? DEFAULT_STATS.distribution.enterprise,
    },
    revenue: {
      monthly: rawData.revenue?.monthly ?? DEFAULT_STATS.revenue.monthly,
      yearly: rawData.revenue?.yearly ?? DEFAULT_STATS.revenue.yearly,
      average_per_tenant: rawData.revenue?.average_per_tenant ?? DEFAULT_STATS.revenue.average_per_tenant,
    },
    plans_config: {
      starter: {
        price_monthly: rawData.plans_config?.starter?.price_monthly ?? DEFAULT_STATS.plans_config.starter.price_monthly,
        currency: rawData.plans_config?.starter?.currency ?? DEFAULT_STATS.plans_config.starter.currency,
      },
      professional: {
        price_monthly: rawData.plans_config?.professional?.price_monthly ?? DEFAULT_STATS.plans_config.professional.price_monthly,
        currency: rawData.plans_config?.professional?.currency ?? DEFAULT_STATS.plans_config.professional.currency,
      },
      enterprise: {
        price_monthly: rawData.plans_config?.enterprise?.price_monthly ?? DEFAULT_STATS.plans_config.enterprise.price_monthly,
        currency: rawData.plans_config?.enterprise?.currency ?? DEFAULT_STATS.plans_config.enterprise.currency,
      },
    }
  } : DEFAULT_STATS;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  if (error) {
    console.error('Subscription stats error:', error);
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
        <p className="text-gray-500 mb-2">Erreur lors du chargement des statistiques</p>
        <p className="text-sm text-gray-400">
          {error instanceof Error ? error.message : 'Veuillez réessayer plus tard'}
        </p>
      </div>
    );
  }

  // Calcul du pourcentage de conversion si non fourni
  const conversionRate = stats.summary.conversion_rate !== '0%' 
    ? stats.summary.conversion_rate 
    : stats.summary.total_tenants > 0 
      ? `${Math.round((stats.summary.active_paid_tenants / stats.summary.total_tenants) * 100)}%`
      : '0%';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="Abonnements actifs"
          value={stats.summary.active_paid_tenants}
          subtitle={`/${stats.summary.total_tenants} total`}
          icon={<CreditCard size={20} className="text-green-600" />}
          color="green"
        />
        <StatCard
          title="En période d'essai"
          value={stats.summary.trial_tenants}
          subtitle={`${conversionRate} conversion`}
          icon={<Activity size={20} className="text-blue-600" />}
          color="blue"
        />
        <StatCard
          title="Revenu mensuel"
          value={`${stats.revenue.monthly.toLocaleString()} ${stats.plans_config.starter.currency}`}
          subtitle={`${stats.revenue.average_per_tenant.toLocaleString()} ${stats.plans_config.starter.currency}/tenant`}
          icon={<DollarSign size={20} className="text-purple-600" />}
          color="purple"
        />
        <StatCard
          title="Revenu annuel"
          value={`${stats.revenue.yearly.toLocaleString()} ${stats.plans_config.starter.currency}`}
          subtitle="projection"
          icon={<TrendingUp size={20} className="text-red-600" />}
          color="red"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h3 className="font-bold text-gray-700 mb-4">Distribution par plan</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(stats.distribution).map(([plan, count]) => {
            const planKey = plan as PlanType;
            const planConfig = stats.plans_config[planKey];
            const priceText = planConfig?.price_monthly 
              ? `${planConfig.price_monthly} ${planConfig.currency}/mois`
              : 'Tarif sur devis';
            
            return (
              <div key={plan} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                <div className="text-sm text-gray-500 mb-1 capitalize">{plan}</div>
                <div className="text-2xl font-bold text-gray-800">{count}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {priceText}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}