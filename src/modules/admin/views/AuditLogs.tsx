import { useQuery } from '@tanstack/react-query';
import { getAuditLogs, AuditLog } from '@/services/auditService';
import { ShieldAlert, Activity, User, Globe, Loader2 } from 'lucide-react';

export default function AuditLogs() {
  const { data: logs, isLoading } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs'],
    queryFn: getAuditLogs
  });

  const getActionColor = (action: string) => {
    if (action.includes('DELETE')) return 'text-red-600 bg-red-50';
    if (action.includes('UPDATE')) return 'text-orange-600 bg-orange-50';
    if (action.includes('CREATE')) return 'text-green-600 bg-green-50';
    return 'text-blue-600 bg-blue-50';
  };

  if (isLoading) return (
    <div className="flex h-64 items-center justify-center text-slate-500 gap-2">
      <Loader2 className="animate-spin" size={20} /> Chargement des journaux de sécurité...
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="text-red-500" /> Journaux d'Audit
          </h1>
          <p className="text-sm text-slate-500">Traçabilité complète des actions effectuées sur le système</p>
        </div>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Utilisateur</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Détails</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Horodatage</th>
                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs?.map((log: AuditLog) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                      <User size={16} />
                    </div>
                    <span className="font-semibold text-slate-700 text-sm">{log.user_name}</span>
                  </td>
                  <td className="p-4 text-sm">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${getActionColor(log.action)}`}>
                      {log.action.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-slate-600 max-w-xs truncate">
                    {log.details}
                  </td>
                  <td className="p-4 text-xs text-slate-400 flex items-center gap-1.5">
                    <Activity size={14} /> {log.timestamp}
                  </td>
                  <td className="p-4 text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Globe size={12} /> {log.ip_address}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {logs?.length === 0 && (
            <div className="p-20 text-center text-slate-400">Aucun log enregistré pour le moment.</div>
          )}
        </div>
      </div>
    </div>
  );
}