import { useQuery } from '@tanstack/react-query';
import { getPharmacyUsers } from '@/services/userService';
import { UserPlus, ShieldCheck, UserMinus, Loader2 } from 'lucide-react';

export default function UserManagement() {
  const { data: users, isLoading } = useQuery({
    queryKey: ['pharmacy-users'],
    queryFn: getPharmacyUsers
  });

  const planLimit = 5; 
  const currentCount = users?.length || 0;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-slate-500 gap-3">
        <Loader2 className="animate-spin" /> Chargement de l'équipe...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Équipe & Permissions</h1>
          <p className="text-sm text-slate-500">Gérez les accès de votre pharmacie ({currentCount}/{planLimit} utilisateurs)</p>
        </div>
        <button 
          disabled={currentCount >= planLimit}
          className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${
            currentCount >= planLimit 
            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100'
          }`}
        >
          <UserPlus size={18} /> Ajouter un membre
        </button>
      </div>

      {currentCount >= planLimit && (
        <div className="p-4 bg-orange-50 border border-orange-100 rounded-2xl text-orange-700 text-sm">
          💡 Vous avez atteint la limite de votre plan. <strong>Passez au plan Entreprise</strong> pour ajouter plus de collaborateurs.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {users?.map((user) => (
          <div key={user.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold uppercase">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-slate-700">{user.name}</p>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{user.role}</span>
                </div>
              </div>
            </div>
            <button className="text-slate-300 hover:text-red-500 transition-colors">
              <UserMinus size={20} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}