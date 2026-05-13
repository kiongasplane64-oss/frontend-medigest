// src/utils/date.ts
import * as dateFns from 'date-fns';

// Réexporter toutes les fonctions nécessaires
export const format = dateFns.format;
export const subDays = dateFns.subDays;
export const startOfMonth = dateFns.startOfMonth;
export const endOfMonth = dateFns.endOfMonth;
export const differenceInDays = dateFns.differenceInDays;
export const formatDistanceToNow = dateFns.formatDistanceToNow;
export const parseISO = dateFns.parseISO;
export const isAfter = dateFns.isAfter;
export const isBefore = dateFns.isBefore;
export const differenceInMonths = dateFns.differenceInMonths;
export const addDays = dateFns.addDays;
export const addMonths = dateFns.addMonths;
export const startOfDay = dateFns.startOfDay;
export const endOfDay = dateFns.endOfDay;

// Fonctions supplémentaires pour Expense.tsx
export const startOfWeek = dateFns.startOfWeek;
export const endOfWeek = dateFns.endOfWeek;
export const startOfYear = dateFns.startOfYear;
export const endOfYear = dateFns.endOfYear;
export const subWeeks = dateFns.subWeeks;
export const subMonths = dateFns.subMonths;

// Autres fonctions utiles qui pourraient être nécessaires
export const subYears = dateFns.subYears;
export const addYears = dateFns.addYears;
export const startOfQuarter = dateFns.startOfQuarter;
export const endOfQuarter = dateFns.endOfQuarter;
export const differenceInHours = dateFns.differenceInHours;
export const differenceInMinutes = dateFns.differenceInMinutes;
export const differenceInSeconds = dateFns.differenceInSeconds;
export const isToday = dateFns.isToday;
export const isYesterday = dateFns.isYesterday;
export const isTomorrow = dateFns.isTomorrow;
export const isPast = dateFns.isPast;
export const isFuture = dateFns.isFuture;
export const formatDistance = dateFns.formatDistance;
export const formatRelative = dateFns.formatRelative;
export const compareAsc = dateFns.compareAsc;
export const compareDesc = dateFns.compareDesc;
export const eachDayOfInterval = dateFns.eachDayOfInterval;
export const eachMonthOfInterval = dateFns.eachMonthOfInterval;
export const eachWeekOfInterval = dateFns.eachWeekOfInterval;
export const eachYearOfInterval = dateFns.eachYearOfInterval;
export const getDate = dateFns.getDate;
export const getDay = dateFns.getDay;
export const getDaysInMonth = dateFns.getDaysInMonth;
export const getHours = dateFns.getHours;
export const getMinutes = dateFns.getMinutes;
export const getMonth = dateFns.getMonth;
export const getYear = dateFns.getYear;
export const setDate = dateFns.setDate;
export const setMonth = dateFns.setMonth;
export const setYear = dateFns.setYear;
export const isValid = dateFns.isValid;
export const toDate = dateFns.toDate;

// Exporter par défaut pour plus de flexibilité
export default dateFns;