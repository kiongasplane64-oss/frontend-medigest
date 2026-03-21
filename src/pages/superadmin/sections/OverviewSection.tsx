// sections/OverviewSection.tsx
import { Activity, Building2, Users, TrendingUp, BarChart, Server, Database, Wifi, HardDrive, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DashboardOverview {
  platform: {
    total_tenants: number;
    active_tenants: number;
    trial_tenants: number;
    total_users: number;
    super_admins: number;
  };
  growth: {
    new_today: number;
    new_week: number;
    new_month: number;
    growth_rate: number;
  };
  distribution: {
    by_plan: Record<string, number>;
  };
  recent_activity: {
    audit_logs: Array<{
      id: string;
      action: string;
      description: string;
      created_at: string;
    }>;
  };
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string };
    services: { status: string };
    performance: { status: string };
  };
  recommendations?: string[];
}

interface OverviewSectionProps {
  overview?: DashboardOverview;
  health?: SystemHealth;
  isLoading: boolean;
  onRefresh: () => void;
}

const StatCard = ({ title, value, subtitle, icon, color, trend }: any) => {
  const colors: Record<string, { iconBg: string }> = {
    blue: { iconBg: 'bg-blue-100' },
    green: { iconBg: 'bg-green-100' },
    orange: { iconBg: 'bg-orange-100' },
    purple: { iconBg: 'bg-purple-100' },
    red: { iconBg: 'bg-red-100' }
  };

  const { iconBg } = colors[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-800">
              {value.toLocaleString()}
            </span>
            {subtitle && <span className="text-xs text-gray-400">{subtitle}</span>}
          </div>
        </div>
        <div className={`h-10 w-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-3 flex items-center gap-1 text-xs">
          <span className="text-green-600 font-medium">+{trend.value}%</span>
          <span className="text-gray-400 ml-1">{trend.label}</span>
        </div>
      )}
    </div>
  );
};

export default function OverviewSection({ overview, health, isLoading, onRefresh }: OverviewSectionProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4" />
          <p className="text-gray-400">Chargement des données...</p>
        </div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <Activity className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-400">Aucune donnée disponible</p>
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600"
          >
            Rafraîchir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tenants actifs"
          value={overview.platform.active_tenants}
          subtitle={`/${overview.platform.total_tenants} total`}
          icon={<Building2 size={20} />}
          color="blue"
          trend={{ value: overview.growth.growth_rate, label: 'vs mois dernier' }}
        />
        
        <StatCard
          title="En période d'essai"
          value={overview.platform.trial_tenants}
          icon={<Activity size={20} />}
          color="orange"
        />
        
        <StatCard
          title="Utilisateurs"
          value={overview.platform.total_users}
          subtitle={`dont ${overview.platform.super_admins} super-admin`}
          icon={<Users size={20} />}
          color="green"
        />
        
        <StatCard
          title="Nouveaux (30j)"
          value={overview.growth.new_month}
          subtitle={`+${overview.growth.new_today} aujourd'hui`}
          icon={<TrendingUp size={20} />}
          color="purple"
        />
      </div>

      {/* Grille secondaire */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Distribution par plan */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart size={16} className="text-red-500" />
            Distribution par plan
          </h3>
          
          <div className="space-y-3">
            {Object.entries(overview.distribution.by_plan).map(([plan, count]) => (
              <div key={plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="capitalize text-gray-600">{plan}</span>
                  <span className="font-bold text-gray-800">{count}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-red-500 rounded-full"
                    style={{ 
                      width: `${(count / overview.platform.total_tenants) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Santé système */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 flex items-center gap-2">
              <Server size={16} className="text-red-500" />
              État du système
            </h3>
            <span className={`text-xs px-2 py-1 rounded-full ${
              health?.status === 'healthy' 
                ? 'bg-green-100 text-green-700' 
                : health?.status === 'degraded'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-red-100 text-red-700'
            }`}>
              {health?.status === 'healthy' 
                ? 'Opérationnel' 
                : health?.status === 'degraded'
                  ? 'Dégradé'
                  : 'Non opérationnel'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Database size={12} /> Base de données
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  health?.checks?.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className="font-medium text-sm">
                  {health?.checks?.database?.status === 'healthy' ? 'Connectée' : 'Problème'}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <Wifi size={12} /> Services
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  health?.checks?.services?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="font-medium text-sm">
                  {health?.checks?.services?.status === 'healthy' ? 'OK' : 'Dégradé'}
                </span>
              </div>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-xl">
              <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                <HardDrive size={12} /> Performance
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  health?.checks?.performance?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                }`} />
                <span className="font-medium text-sm">
                  {health?.checks?.performance?.status === 'healthy' ? 'Normale' : 'À surveiller'}
                </span>
              </div>
            </div>
          </div>

          {/* Recommandations */}
          {health?.recommendations && health.recommendations.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">
                Recommandations
              </h4>
              <ul className="space-y-1">
                {health.recommendations.map((rec, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                    <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <Activity size={16} className="text-red-500" />
            Activité récente
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Description
                </th>
                <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {overview.recent_activity.audit_logs?.slice(0, 5).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-600">
                    {log.description || '-'}
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm') : '-'}
                  </td>
                </tr>
              ))}
              
              {(!overview.recent_activity.audit_logs?.length) && (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-gray-400">
                    Aucune activité récente
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}