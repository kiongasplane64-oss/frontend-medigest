import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface WorkingHours {
  enabled: boolean;
  startTime: string;
  endTime: string;
  overtimeEndTime?: string;
  daysOff: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface OutOfServiceProps {
  workingHours?: WorkingHours;
  message?: string;
  nextServiceTime?: string;
}

const OutOfService = ({ workingHours, message, nextServiceTime }: OutOfServiceProps) => {
  const [timezone, setTimezone] = useState('UTC');
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  
  useEffect(() => {
    // Détecter le fuseau horaire du navigateur
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    
    // Calculer le décalage en heures
    const offset = -new Date().getTimezoneOffset() / 60;
    setTimezoneOffset(offset);
  }, []);

  // Convertir une heure UTC vers l'heure locale
  const convertUTCToLocal = (utcTime: string): string => {
    if (!utcTime) return '';
    
    const [hours, minutes] = utcTime.split(':').map(Number);
    const date = new Date();
    date.setUTCHours(hours, minutes, 0, 0);
    
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // Jours de la semaine en français
  const dayNames: Record<string, string> = {
    monday: 'Lundi',
    tuesday: 'Mardi',
    wednesday: 'Mercredi',
    thursday: 'Jeudi',
    friday: 'Vendredi',
    saturday: 'Samedi',
    sunday: 'Dimanche'
  };

  // Obtenir les jours ouverts
  const getWorkingDays = () => {
    if (!workingHours?.daysOff) return [];
    return Object.entries(workingHours.daysOff)
      .filter(([_, isOpen]) => isOpen)
      .map(([day]) => day);
  };

  const formatNextServiceTime = () => {
    if (!nextServiceTime) return '';
    
    const date = new Date(nextServiceTime);
    return date.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC'
    });
  };

  // Extraire l'heure de nextServiceTime pour la conversion
  const extractTimeFromNextService = (): string => {
    if (!nextServiceTime) return '';
    // Format attendu: "2024-01-15T08:00:00Z" ou similaire
    const match = nextServiceTime.match(/T(\d{2}:\d{2})/);
    return match ? match[1] : '';
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

        {workingHours && workingHours.enabled && (
          <div className="bg-slate-50 p-6 rounded-xl text-left space-y-3">
            <h2 className="font-semibold text-slate-700">Heures de service</h2>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Heure serveur (UTC):</span>
                <span className="font-medium text-slate-700">
                  {workingHours.startTime} - {workingHours.endTime}
                </span>
              </div>
              
              <div className="flex justify-between text-sm text-blue-600 bg-blue-50 p-2 rounded-lg">
                <span>Votre heure locale ({timezone}):</span>
                <span className="font-medium">
                  {convertUTCToLocal(workingHours.startTime)} - {convertUTCToLocal(workingHours.endTime)}
                </span>
              </div>
            </div>

            {workingHours.overtimeEndTime && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Heures supplémentaires (max):</span>
                <span className="font-medium">
                  {convertUTCToLocal(workingHours.overtimeEndTime)}
                </span>
              </div>
            )}

            {getWorkingDays().length > 0 && (
              <div>
                <span className="text-slate-500 text-sm">Jours ouverts:</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  {getWorkingDays().map((day) => (
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
                Prochain service (UTC) : {formatNextServiceTime()} UTC
                <br />
                <span className="text-xs">
                  (Soit {convertUTCToLocal(extractTimeFromNextService())} heure locale)
                </span>
              </p>
            )}

            <div className="text-xs text-slate-400 mt-4 pt-3 border-t border-slate-200 space-y-1">
              <p>Décalage horaire détecté: UTC{timezoneOffset >= 0 ? '+' : ''}{timezoneOffset}</p>
              <p>• Les heures sont automatiquement converties dans votre fuseau horaire</p>
              <p>• L'accès est restreint en dehors des heures de service</p>
            </div>
          </div>
        )}

        {(!workingHours || !workingHours.enabled) && (
          <p className="text-sm text-slate-500 mt-4">
            Contactez l'administrateur pour plus d'informations sur les heures de service.
          </p>
        )}
      </div>
    </div>
  );
};

export default OutOfService;