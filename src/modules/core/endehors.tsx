import { Clock } from 'lucide-react';

interface OutOfServiceProps {
  workingHours?: {
    startTime: string;
    endTime: string;
    daysOff: string[];
  };
  message?: string;
  nextServiceTime?: string;
}

const OutOfService = ({ workingHours, message, nextServiceTime }: OutOfServiceProps) => {
  // Jours de la semaine en français pour l'affichage
  const dayNames: Record<string, string> = {
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche'
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 to-slate-800 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-12 max-w-lg text-center border border-slate-200">
        <div className="bg-red-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-12 h-12 text-red-600" />
        </div>
        
        <h1 className="text-3xl font-bold text-red-600 mb-4">Hors Service</h1>
        
        <p className="text-slate-600 mb-6">
          {message || "L'application n'est pas disponible pour le moment. Veuillez respecter les heures de service établies."}
        </p>

        {workingHours && (
          <div className="bg-slate-50 p-6 rounded-xl text-left space-y-3">
            <h2 className="font-semibold text-slate-700">Heures de service</h2>
            
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Heures d'ouverture:</span>
              <span className="font-medium text-slate-700">
                {workingHours.startTime} - {workingHours.endTime} UTC
              </span>
            </div>

            {workingHours.daysOff.length > 0 && (
              <div>
                <span className="text-slate-500 text-sm">Jours ouverts:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {workingHours.daysOff.map((day) => (
                    <span 
                      key={day}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"
                    >
                      {dayNames[day] || day}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {nextServiceTime && (
              <p className="text-sm text-blue-600 mt-3">
                Prochain service : {new Date(nextServiceTime).toLocaleString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'UTC'
                })} UTC
              </p>
            )}

            <p className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-200">
              Heure basée sur le serveur UTC • Accès restreint en dehors des heures de service
            </p>
          </div>
        )}

        {!workingHours && (
          <p className="text-sm text-slate-500 mt-4">
            Contactez l'administrateur pour plus d'informations sur les heures de service.
          </p>
        )}
      </div>
    </div>
  );
};

export default OutOfService;