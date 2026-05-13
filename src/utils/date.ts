// src/utils/date.ts
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import relativeTime from 'dayjs/plugin/relativeTime';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';

// Importer les plugins sans les assigner à des variables pour éviter les conflits
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

// Réexporter les fonctions avec la même API que date-fns
export const format = (date: Date | string | number, formatStr: string, _options?: { locale?: any }) => {
  // Ignorer les options de locale puisque dayjs a déjà la locale 'fr' configurée
  return dayjs(date).format(formatStr);
};

export const parseISO = (dateString: string) => {
  return dayjs(dateString).toDate();
};

export const differenceInDays = (dateLeft: Date | string, dateRight: Date | string) => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'day');
};

export const differenceInMonths = (dateLeft: Date | string, dateRight: Date | string) => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'month');
};

export const differenceInHours = (dateLeft: Date | string, dateRight: Date | string) => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'hour');
};

export const differenceInMinutes = (dateLeft: Date | string, dateRight: Date | string) => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'minute');
};

export const differenceInSeconds = (dateLeft: Date | string, dateRight: Date | string) => {
  return dayjs(dateLeft).diff(dayjs(dateRight), 'second');
};

export const addDays = (date: Date | string | number, amount: number) => {
  return dayjs(date).add(amount, 'day').toDate();
};

export const addMonths = (date: Date | string | number, amount: number) => {
  return dayjs(date).add(amount, 'month').toDate();
};

export const addYears = (date: Date | string | number, amount: number) => {
  return dayjs(date).add(amount, 'year').toDate();
};

export const subDays = (date: Date | string | number, amount: number) => {
  return dayjs(date).subtract(amount, 'day').toDate();
};

export const subWeeks = (date: Date | string | number, amount: number) => {
  return dayjs(date).subtract(amount, 'week').toDate();
};

export const subMonths = (date: Date | string | number, amount: number) => {
  return dayjs(date).subtract(amount, 'month').toDate();
};

export const subYears = (date: Date | string | number, amount: number) => {
  return dayjs(date).subtract(amount, 'year').toDate();
};

export const startOfDay = (date: Date | string | number) => {
  return dayjs(date).startOf('day').toDate();
};

export const endOfDay = (date: Date | string | number) => {
  return dayjs(date).endOf('day').toDate();
};

export const startOfWeek = (date: Date | string | number, _options?: { locale?: any }) => {
  return dayjs(date).startOf('week').toDate();
};

export const endOfWeek = (date: Date | string | number, _options?: { locale?: any }) => {
  return dayjs(date).endOf('week').toDate();
};

export const startOfMonth = (date: Date | string | number) => {
  return dayjs(date).startOf('month').toDate();
};

export const endOfMonth = (date: Date | string | number) => {
  return dayjs(date).endOf('month').toDate();
};

export const startOfYear = (date: Date | string | number) => {
  return dayjs(date).startOf('year').toDate();
};

export const endOfYear = (date: Date | string | number) => {
  return dayjs(date).endOf('year').toDate();
};

export const startOfQuarter = (date: Date | string | number) => {
  return dayjs(date).startOf('quarter').toDate();
};

export const endOfQuarter = (date: Date | string | number) => {
  return dayjs(date).endOf('quarter').toDate();
};

// CORRIGÉ : formatDistanceToNow avec options complètes
export const formatDistanceToNow = (date: Date | string | number, options?: { addSuffix?: boolean; locale?: any }) => {
  if (options?.addSuffix) {
    return dayjs(date).fromNow();
  }
  return dayjs(date).fromNow(true);
};

// CORRIGÉ : formatDistance avec 3 arguments (date, baseDate, options)
export const formatDistance = (
  date: Date | string | number, 
  baseDate: Date | string | number, 
  options?: { addSuffix?: boolean; locale?: any }
) => {
  if (options?.addSuffix) {
    return dayjs(date).from(dayjs(baseDate));
  }
  return dayjs(date).from(dayjs(baseDate), true);
};

// CORRIGÉ : isToday sans conflit de nom
export const isToday = (date: Date | string | number) => {
  return dayjs(date).isToday();
};

// CORRIGÉ : isYesterday sans conflit de nom
export const isYesterday = (date: Date | string | number) => {
  return dayjs(date).isYesterday();
};

export const isPast = (date: Date | string | number) => {
  return dayjs(date).isBefore(dayjs());
};

export const isFuture = (date: Date | string | number) => {
  return dayjs(date).isAfter(dayjs());
};

export const isAfter = (date: Date | string | number, dateToCompare: Date | string | number) => {
  return dayjs(date).isAfter(dayjs(dateToCompare));
};

export const isBefore = (date: Date | string | number, dateToCompare: Date | string | number) => {
  return dayjs(date).isBefore(dayjs(dateToCompare));
};

export const compareAsc = (dateLeft: Date | string | number, dateRight: Date | string | number) => {
  if (dayjs(dateLeft).isBefore(dayjs(dateRight))) return -1;
  if (dayjs(dateLeft).isAfter(dayjs(dateRight))) return 1;
  return 0;
};

export const compareDesc = (dateLeft: Date | string | number, dateRight: Date | string | number) => {
  if (dayjs(dateLeft).isAfter(dayjs(dateRight))) return -1;
  if (dayjs(dateLeft).isBefore(dayjs(dateRight))) return 1;
  return 0;
};

export const isValid = (date: any) => {
  return dayjs(date).isValid();
};

export const toDate = (date: Date | string | number) => {
  return dayjs(date).toDate();
};

// Export par défaut
export default dayjs;