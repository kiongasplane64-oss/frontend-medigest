// hoc/withWritePermission.tsx
import { useWritePermission } from '@/hooks/useSubscription';
import { AlertTriangle } from 'lucide-react';
import { ComponentType } from 'react';

interface WithWritePermissionProps {
  onWriteAttempt?: () => void;
}

export function withWritePermission<P extends object>(
  WrappedComponent: ComponentType<P>,
  options?: {
    showReadOnlyMessage?: boolean;
    redirectToSubscription?: boolean;
  }
) {
  return function WithWritePermissionComponent(props: P & WithWritePermissionProps) {
    const { canWrite, checkWritePermission } = useWritePermission();
    
    // Créer un proxy pour les actions d'écriture
    const wrappedProps = {
      ...props,
      // Surcharger les méthodes d'écriture
      onWrite: (action: string, callback: () => void) => {
        if (checkWritePermission(action)) {
          callback();
        } else if (options?.redirectToSubscription) {
          // Rediriger vers la page d'abonnement
          window.location.href = '/subscription';
        }
      },
      // Indiquer si l'écriture est autorisée
      canWrite: canWrite(),
    };
    
    // Si l'écriture n'est pas autorisée et qu'on veut afficher un message
    if (!canWrite() && options?.showReadOnlyMessage) {
      return (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">
                  Mode lecture seule
                </p>
                <p className="text-xs text-amber-700">
                  Votre abonnement a expiré ou est inactif. Vous ne pouvez pas modifier les données.
                  <button
                    onClick={() => window.location.href = '/subscription'}
                    className="ml-2 text-amber-800 font-bold underline"
                  >
                    Renouveler mon abonnement
                  </button>
                </p>
              </div>
            </div>
          </div>
          <WrappedComponent {...(wrappedProps as P)} />
        </div>
      );
    }
    
    return <WrappedComponent {...(wrappedProps as P)} />;
  };
}