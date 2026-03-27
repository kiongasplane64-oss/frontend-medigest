// pages/OutOfService.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, RefreshCw, Calendar, MapPin, AlertTriangle, LogOut } from 'lucide-react';
import api from '@/api/client';
import { useAuthStore } from '@/store/useAuthStore';

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

interface ServiceStatus {
  in_service: boolean;
  restrictions_enabled: boolean;
  current_time_utc: string;
  current_time_local: string;
  timezone: string;
  current_day: string;
  is_working_day: boolean;
  is_within_hours: boolean;
  working_hours: {
    start: string;
    end: string;
    overtime?: string;
  };
  message: string;
  next_service_time?: string;
}

interface OutOfServiceProps {
  workingHours?: WorkingHours;
  message?: string;
  nextServiceTime?: string;
}

const OutOfService = ({ workingHours: propWorkingHours, message: propMessage, nextServiceTime: propNextServiceTime }: OutOfServiceProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, setAuth } = useAuthStore();
  
  // État pour le service status depuis l'API
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus | null>(
    location.state?.serviceStatus || null
  );
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [timezone, setTimezone] = useState('UTC');
  const [timezoneOffset, setTimezoneOffset] = useState(0);
  
  // Déterminer les heures de service à afficher (priorité au serviceStatus, puis aux props)
  const workingHours = serviceStatus?.working_hours ? {
    enabled: true,
    startTime: serviceStatus.working_hours.start,
    endTime: serviceStatus.working_hours.end,
    overtimeEndTime: serviceStatus.working_hours.overtime,
    daysOff: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: true,
      sunday: serviceStatus.is_working_day ?? true
    }
  } : propWorkingHours;
  
  const message = serviceStatus?.message || propMessage || "L'application n'est pas disponible pour le moment";
  const nextServiceTime = serviceStatus?.next_service_time || propNextServiceTime;
  
  // Détecter le fuseau horaire du navigateur
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(tz);
    const offset = -new Date().getTimezoneOffset() / 60;
    setTimezoneOffset(offset);
  }, []);
  
  // Restaurer l'utilisateur si nécessaire
  useEffect(() => {
    if (!isAuthenticated && !user) {
      const pendingUser = sessionStorage.getItem('pending_user');
      const pendingToken = sessionStorage.getItem('pending_token');
      
      if (pendingUser && pendingToken) {
        setAuth(JSON.parse(pendingUser), pendingToken);
      }
    }
  }, [isAuthenticated, user, setAuth]);
  
  // Calculer le temps restant jusqu'au prochain service
  useEffect(() => {
    if (nextServiceTime) {
      const calculateCountdown = () => {
        const nextService = new Date(nextServiceTime);
        const now = new Date();
        const diff = nextService.getTime() - now.getTime();
        
        if (diff > 0) {
          setCountdown(Math.floor(diff / 1000));
        } else {
          setCountdown(null);
        }
      };
      
      calculateCountdown();
      const interval = setInterval(calculateCountdown, 1000);
      return () => clearInterval(interval);
    }
  }, [nextServiceTime]);
  
  // Vérifier périodiquement si le service est revenu (uniquement si on a un user)
  useEffect(() => {
    const pharmacyId = user?.pharmacy_id || user?.tenant_id;
    if (!pharmacyId) return;
    
    const checkServiceStatus = async () => {
      try {
        const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
        setServiceStatus(response.data);
        
        if (response.data.in_service) {
          // Service revenu, rediriger vers la page appropriée
          if (user?.has_subscription) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/subscription', { replace: true });
          }
        }
      } catch (err) {
        console.error('Erreur lors de la vérification du service:', err);
      }
    };
    
    // Vérifier toutes les 30 secondes
    const interval = setInterval(checkServiceStatus, 30000);
    return () => clearInterval(interval);
  }, [user, navigate]);
  
  // Convertir une heure UTC en heure locale
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
  
  // Formater le countdown
  const formatCountdown = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}min ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}min ${secs}s`;
    }
    return `${secs}s`;
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
  
  const handleRefresh = async () => {
    setLoading(true);
    const pharmacyId = user?.pharmacy_id || user?.tenant_id;
    
    if (pharmacyId) {
      try {
        const response = await api.get<ServiceStatus>(`/pharmacies/${pharmacyId}/service-status`);
        setServiceStatus(response.data);
        
        if (response.data.in_service) {
          if (user?.has_subscription) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/subscription', { replace: true });
          }
        }
      } catch (err) {
        console.error('Erreur lors de la vérification:', err);
      }
    }
    
    setLoading(false);
  };
  
  const handleLogout = () => {
    sessionStorage.removeItem('pending_user');
    sessionStorage.removeItem('pending_token');
    sessionStorage.removeItem('service_status');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };
  
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Header avec icône */}
        <div className="bg-linear-to-r from-amber-500 to-orange-600 p-8 text-center">
          <div className="bg-white/20 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
            <Clock className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Hors Service</h1>
          <p className="text-white/80">
            {message}
          </p>
        </div>
        
        {/* Contenu */}
        <div className="p-8">
          {/* Countdown si disponible */}
          {countdown !== null && countdown > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-2xl text-center border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">Prochain service dans :</p>
              <p className="text-3xl font-mono font-bold text-amber-700 dark:text-amber-300">
                {formatCountdown(countdown)}
              </p>
            </div>
          )}
          
          {/* Informations de service */}
          {workingHours && workingHours.enabled ? (
            <div className="space-y-4 mb-6">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm font-medium">Heures de service</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Heure début</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {workingHours.startTime}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      ({convertUTCToLocal(workingHours.startTime)} heure locale)
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Heure fin</p>
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {workingHours.endTime}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      ({convertUTCToLocal(workingHours.endTime)} heure locale)
                    </p>
                  </div>
                </div>
                
                {workingHours.overtimeEndTime && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-600">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Heures supplémentaires (max)</p>
                    <p className="font-medium text-amber-600 dark:text-amber-400">
                      {workingHours.overtimeEndTime}
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      ({convertUTCToLocal(workingHours.overtimeEndTime)} heure locale)
                    </p>
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-medium">Fuseau horaire</span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Pharmacie: {serviceStatus?.timezone || 'UTC'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Votre fuseau: {timezone} (UTC{timezoneOffset >= 0 ? '+' : ''}{timezoneOffset})
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                  Heure actuelle (locale): {new Date().toLocaleTimeString('fr-FR')}
                </p>
              </div>
              
              {getWorkingDays().length > 0 && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-3">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium">Jours ouverts</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getWorkingDays().map((day) => (
                      <span 
                        key={day}
                        className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium"
                      >
                        {dayNames[day] || day}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {serviceStatus && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-sm font-medium">Statut actuel</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Jour actuel</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        serviceStatus.is_working_day
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {serviceStatus.is_working_day ? 'Jour ouvré' : 'Jour fermé'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Heures de service</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        serviceStatus.is_within_hours
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {serviceStatus.is_within_hours ? 'Dans les heures' : 'Hors heures'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              {nextServiceTime && (
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Prochain service prévu le:
                  </p>
                  <p className="font-medium text-blue-800 dark:text-blue-300 mt-1">
                    {new Date(nextServiceTime).toLocaleString('fr-FR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              )}
              
              <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <p>Décalage horaire détecté: UTC{timezoneOffset >= 0 ? '+' : ''}{timezoneOffset}</p>
                <p>• Les heures sont automatiquement converties dans votre fuseau horaire</p>
                <p>• L'accès sera automatiquement rétabli pendant les heures de service</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-6 text-center">
              <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                {message || "Contactez l'administrateur pour plus d'informations sur les heures de service."}
              </p>
            </div>
          )}
          
          {/* Boutons d'action */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Vérifier à nouveau
            </button>
            
            <button
              onClick={handleLogout}
              className="flex-1 py-3 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Se déconnecter
            </button>
          </div>
          
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            L'accès sera automatiquement rétabli pendant les heures de service
          </p>
        </div>
      </div>
    </div>
  );
};

export default OutOfService;