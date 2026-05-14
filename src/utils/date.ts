// src/utils/date.ts
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isTodayPlugin from 'dayjs/plugin/isToday';
import isYesterdayPlugin from 'dayjs/plugin/isYesterday';

// Configurer les plugins
dayjs.extend(relativeTime);
dayjs.extend(customParseFormat);
dayjs.extend(duration);
dayjs.extend(isTodayPlugin);
dayjs.extend(isYesterdayPlugin);
dayjs.extend(weekOfYear);
dayjs.extend(quarterOfYear);

// Définir la locale française
dayjs.locale('fr');

// Formatage
export const format = (date: Date | string | number, formatStr: string, _options?: { locale?: any }) => {
  return dayjs(date).format(formatStr);
};

export const formatDate = (date: Date | string | number, formatStr: string = 'DD/MM/YYYY'): string => {
  return dayjs(date).format(formatStr);
};

export const formatDateTime = (date: Date | string | number): string => {
  return dayjs(date).format('DD/MM/YYYY HH:mm:ss');
};

export const formatTime = (date: Date | string | number): string => {
  return dayjs(date).format('HH:mm:ss');
};

// Parsing
export const parseISO = (dateString: string): Date => {
  return dayjs(dateString).toDate();
};

export const parseDate = (dateString: string, formatStr: string = 'YYYY-MM-DD'): Date | null => {
  const parsed = dayjs(dateString, formatStr);
  return parsed.isValid() ? parsed.toDate() : null;
};

// Différences
export const differenceInDays = (dateLeft: Date | string, dateRight: Date | string): number => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'day');
};

export const differenceInMonths = (dateLeft: Date | string, dateRight: Date | string): number => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'month');
};

export const differenceInYears = (dateLeft: Date | string, dateRight: Date | string): number => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'year');
};

export const differenceInHours = (dateLeft: Date | string, dateRight: Date | string): number => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'hour');
};

export const differenceInMinutes = (dateLeft: Date | string, dateRight: Date | string): number => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'minute');
};

export const differenceInSeconds = (dateLeft: Date | string, dateRight: Date | string): number => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'second');
};

// Ajout de temps
export const addDays = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).add(amount, 'day').toDate();
};

export const addMonths = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).add(amount, 'month').toDate();
};

export const addYears = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).add(amount, 'year').toDate();
};

export const addWeeks = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).add(amount, 'week').toDate();
};

export const addHours = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).add(amount, 'hour').toDate();
};

// Soustraction de temps
export const subDays = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).subtract(amount, 'day').toDate();
};

export const subWeeks = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).subtract(amount, 'week').toDate();
};

export const subMonths = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).subtract(amount, 'month').toDate();
};

export const subYears = (date: Date | string | number, amount: number): Date => {
  return dayjs(date).subtract(amount, 'year').toDate();
};

// Début/Fin de période
export const startOfDay = (date: Date | string | number): Date => {
  return dayjs(date).startOf('day').toDate();
};

export const endOfDay = (date: Date | string | number): Date => {
  return dayjs(date).endOf('day').toDate();
};

export const startOfWeek = (date: Date | string | number, _options?: { locale?: any }): Date => {
  return dayjs(date).startOf('week').toDate();
};

export const endOfWeek = (date: Date | string | number, _options?: { locale?: any }): Date => {
  return dayjs(date).endOf('week').toDate();
};

export const startOfMonth = (date: Date | string | number): Date => {
  return dayjs(date).startOf('month').toDate();
};

export const endOfMonth = (date: Date | string | number): Date => {
  return dayjs(date).endOf('month').toDate();
};

export const startOfYear = (date: Date | string | number): Date => {
  return dayjs(date).startOf('year').toDate();
};

export const endOfYear = (date: Date | string | number): Date => {
  return dayjs(date).endOf('year').toDate();
};

export const startOfQuarter = (date: Date | string | number): Date => {
  return dayjs(date).startOf('quarter').toDate();
};

export const endOfQuarter = (date: Date | string | number): Date => {
  return dayjs(date).endOf('quarter').toDate();
};

// Comparaisons
export const isToday = (date: Date | string | number): boolean => {
  return dayjs(date).isToday();
};

export const isYesterday = (date: Date | string | number): boolean => {
  return dayjs(date).isYesterday();
};

export const isTomorrow = (date: Date | string | number): boolean => {
  return dayjs(date).add(1, 'day').isToday();
};

export const isPast = (date: Date | string | number): boolean => {
  return dayjs(date).isBefore(dayjs());
};

export const isFuture = (date: Date | string | number): boolean => {
  return dayjs(date).isAfter(dayjs());
};

export const isAfter = (date: Date | string | number, dateToCompare: Date | string | number): boolean => {
  return dayjs(date).isAfter(dayjs(dateToCompare));
};

export const isBefore = (date: Date | string | number, dateToCompare: Date | string | number): boolean => {
  return dayjs(date).isBefore(dayjs(dateToCompare));
};

export const isSameDay = (dateLeft: Date | string | number, dateRight: Date | string | number): boolean => {
  return dayjs(dateLeft).isSame(dayjs(dateRight), 'day');
};

export const isSameMonth = (dateLeft: Date | string | number, dateRight: Date | string | number): boolean => {
  return dayjs(dateLeft).isSame(dayjs(dateRight), 'month');
};

export const isSameYear = (dateLeft: Date | string | number, dateRight: Date | string | number): boolean => {
  return dayjs(dateLeft).isSame(dayjs(dateRight), 'year');
};

export const compareAsc = (dateLeft: Date | string | number, dateRight: Date | string | number): number => {
  if (dayjs(dateLeft).isBefore(dayjs(dateRight))) return -1;
  if (dayjs(dateLeft).isAfter(dayjs(dateRight))) return 1;
  return 0;
};

export const compareDesc = (dateLeft: Date | string | number, dateRight: Date | string | number): number => {
  if (dayjs(dateLeft).isAfter(dayjs(dateRight))) return -1;
  if (dayjs(dateLeft).isBefore(dayjs(dateRight))) return 1;
  return 0;
};

// Formatage relatif
export const formatDistanceToNow = (date: Date | string | number, options?: { addSuffix?: boolean; locale?: any }): string => {
  if (options?.addSuffix) {
    return dayjs(date).fromNow();
  }
  return dayjs(date).fromNow(true);
};

export const formatDistance = (
  date: Date | string | number, 
  baseDate: Date | string | number, 
  options?: { addSuffix?: boolean; locale?: any }
): string => {
  if (options?.addSuffix) {
    return dayjs(date).from(dayjs(baseDate));
  }
  return dayjs(date).from(dayjs(baseDate), true);
};

// Validation
export const isValid = (date: any): boolean => {
  return dayjs(date).isValid();
};

export const toDate = (date: Date | string | number): Date => {
  return dayjs(date).toDate();
};

// Utilitaires
export const getYear = (date: Date | string | number): number => {
  return dayjs(date).year();
};

export const getMonth = (date: Date | string | number): number => {
  return dayjs(date).month();
};

export const getDate = (date: Date | string | number): number => {
  return dayjs(date).date();
};

export const getDay = (date: Date | string | number): number => {
  return dayjs(date).day();
};

export const getHours = (date: Date | string | number): number => {
  return dayjs(date).hour();
};

export const getMinutes = (date: Date | string | number): number => {
  return dayjs(date).minute();
};

export const getSeconds = (date: Date | string | number): number => {
  return dayjs(date).second();
};

export const getWeekOfYear = (date: Date | string | number): number => {
  return dayjs(date).week();
};

export const getQuarter = (date: Date | string | number): number => {
  return dayjs(date).quarter();
};

// Création de dates
export const newDate = (year?: number, month?: number, day?: number): Date => {
  if (year !== undefined && month !== undefined && day !== undefined) {
    return dayjs().year(year).month(month - 1).date(day).toDate();
  }
  return new Date();
};

export const today = (): Date => {
  return dayjs().startOf('day').toDate();
};

export const now = (): Date => {
  return new Date();
};

// Ranges de dates
export const getDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  let current = startOfDay(startDate);
  const end = startOfDay(endDate);
  
  while (current <= end) {
    dates.push(current);
    current = addDays(current, 1);
  }
  
  return dates;
};

// Formatage monétaire avec date
export const formatPeriod = (startDate: Date | null, endDate: Date | null): string => {
  if (!startDate || !endDate) return 'Période non définie';
  if (isSameDay(startDate, endDate)) {
    return formatDate(startDate);
  }
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

// Export par défaut
export default dayjs;