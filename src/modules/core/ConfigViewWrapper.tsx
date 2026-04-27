// ConfigViewWrapper.tsx - Composant wrapper avec gestion améliorée
import { useAuthStore } from '@/store/useAuthStore';
import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import ConfigView from '@/modules/core/ConfigView';

const ConfigViewWrapper = () => {
  const { user, isLoading: authLoading } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  // Effet pour gérer les erreurs d'authentification
  useEffect(() => {
    if (!authLoading && !user) {
      setError("Vous devez être connecté pour accéder à cette page");
    } else {
      setError(null);
    }
  }, [authLoading, user]);

  // Affichage pendant le chargement de l'auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600">Chargement de la session...</p>
      </div>
    );
  }

  // Affichage si non authentifié
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center border border-red-100">
          <div className="bg-red-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-red-600 mb-2">Non authentifié</h2>
          <p className="text-slate-600 mb-4">
            {error || "Veuillez vous connecter pour accéder à cette page"}
          </p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  // Rendu simple de ConfigView sans props
  return <ConfigView />;
};

export default ConfigViewWrapper;