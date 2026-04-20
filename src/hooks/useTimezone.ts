// hooks/useTimezone.ts - VERSION CORRIGÉE
import { useState, useEffect, useCallback} from 'react';

interface TimezoneInfo {
  timezone: string;
  offset: number; // en heures
  offsetString: string;
}

export const useTimezone = (): TimezoneInfo => {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo>({
    timezone: 'Africa/Kinshasa', // Défaut RDC
    offset: 1, // UTC+1 pour Kinshasa
    offsetString: 'UTC+1'
  });

  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // Obtenir le décalage en minutes, convertir en heures
      const offsetMinutes = -new Date().getTimezoneOffset();
      const offset = offsetMinutes / 60;
      const offsetString = `UTC${offset >= 0 ? '+' : ''}${offset}`;
      
      setTimezoneInfo({
        timezone: tz,
        offset,
        offsetString
      });
    } catch (error) {
      console.error('Erreur lors de la récupération du fuseau horaire:', error);
      // Garder les valeurs par défaut
    }
  }, []);

  return timezoneInfo;
};

export const useTimeConverter = () => {
  const { offset } = useTimezone();

  const convertUTCToLocal = useCallback((utcTime: string): string => {
    if (!utcTime) return '';

    const [hours, minutes] = utcTime.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Format d\'heure invalide:', utcTime);
      return utcTime;
    }

    let localHours = hours + offset;
    
    // Gérer le passage de jour
    if (localHours < 0) localHours += 24;
    if (localHours >= 24) localHours -= 24;

    return `${Math.floor(localHours).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }, [offset]);

  const convertLocalToUTC = useCallback((localTime: string): string => {
    if (!localTime) return '';

    const [hours, minutes] = localTime.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
      console.warn('Format d\'heure locale invalide:', localTime);
      return localTime;
    }

    let utcHours = hours - offset;

    if (utcHours < 0) utcHours += 24;
    if (utcHours >= 24) utcHours -= 24;

    return `${Math.floor(utcHours).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }, [offset]);

  const isTimeWithinRange = useCallback((time: string, start: string, end: string): boolean => {
    const timeMinutes = timeToMinutes(time);
    const startMinutes = timeToMinutes(start);
    let endMinutes = timeToMinutes(end);

    // Gérer le cas où la plage traverse minuit
    if (endMinutes < startMinutes) {
      return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
    }
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }, []);

  const timeToMinutes = useCallback((time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  }, []);

  return { 
    convertUTCToLocal, 
    convertLocalToUTC,
    isTimeWithinRange,
    timeToMinutes
  };
};

export const useTimezoneWithConverter = () => {
  const timezoneInfo = useTimezone();
  const converter = useTimeConverter();
  
  return {
    ...timezoneInfo,
    ...converter
  };
};