// sections/SystemSection.tsx
import { Database, Wifi, HardDrive, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/api/client';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: { status: string };
    services: { status: string };
    performance: { status: string };
  };
  recommendations?: string[];
}

export default function SystemSection() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['superadmin-health'],
    queryFn: async () => {
      const { data } = await api.get<SystemHealth>('/super-admin/system/health');
      return data;
    },
    refetchInterval: 300000
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-red-500" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-700">État du système</h3>
          <button onClick={() => refetch()} className="p-2 hover:bg-gray-100 rounded-lg">
            <RefreshCw size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-gray-400" />
              <span className="font-medium">Base de données</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                health?.checks?.database?.status === 'healthy' ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-sm">
                {health?.checks?.database?.status === 'healthy' ? 'Connectée' : 'Problème'}
              </span>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Wifi size={16} className="text-gray-400" />
              <span className="font-medium">Services</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                health?.checks?.services?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm">
                {health?.checks?.services?.status === 'healthy' ? 'OK' : 'Dégradé'}
              </span>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={16} className="text-gray-400" />
              <span className="font-medium">Performance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                health?.checks?.performance?.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span className="text-sm">
                {health?.checks?.performance?.status === 'healthy' ? 'Normale' : 'À surveiller'}
              </span>
            </div>
          </div>
        </div>

        {health?.recommendations && health.recommendations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recommandations</h4>
            <ul className="space-y-1">
              {health.recommendations.map((rec, idx) => (
                <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                  <AlertCircle size={14} className="text-yellow-500 mt-0.5 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}