import { useState, useEffect } from 'react';

interface TimezoneInfo {
  timezone: string;
  offset: number; // en heures
  offsetString: string;
}

export const useTimezone = (): TimezoneInfo => {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo>({
    timezone: 'UTC',
    offset: 0,
    offsetString: 'UTC+0'
  });

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const offset = -new Date().getTimezoneOffset() / 60;
    const offsetString = `UTC${offset >= 0 ? '+' : ''}${offset}`;
    
    setTimezoneInfo({
      timezone: tz,
      offset,
      offsetString
    });
  }, []);

  return timezoneInfo;
};

export const useTimeConverter = () => {
  // Éviter la destructuration qui peut causer des erreurs TypeScript
  const timezoneHook = useTimezone();
  const offset = timezoneHook.offset;

  const convertUTCToLocal = (utcTime: string): string => {
    if (!utcTime) return '';
    
    const [hours, minutes] = utcTime.split(':').map(Number);
    
    // Validation des entrées
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Format d\'heure invalide:', utcTime);
      return utcTime;
    }
    
    const date = new Date();
    date.setUTCHours(hours, minutes, 0, 0);
    
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const convertLocalToUTC = (localTime: string): string => {
    if (!localTime) return '';
    
    const [hours, minutes] = localTime.split(':').map(Number);
    
    // Validation des entrées
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Format d\'heure locale invalide:', localTime);
      return localTime;
    }
    
    // Soustraire le décalage pour obtenir l'heure UTC
    let utcHours = hours - offset;
    
    // Gérer le passage de jour
    if (utcHours < 0) utcHours += 24;
    if (utcHours >= 24) utcHours -= 24;
    
    return `${utcHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  // Retour explicite des fonctions avec un objet typé
  return { 
    convertUTCToLocal, 
    convertLocalToUTC 
  };
};

// Export également d'un hook combiné si nécessaire
export const useTimezoneWithConverter = () => {
  const timezoneInfo = useTimezone();
  const { convertUTCToLocal, convertLocalToUTC } = useTimeConverter();
  
  return {
    ...timezoneInfo,
    convertUTCToLocal,
    convertLocalToUTC
  };
};