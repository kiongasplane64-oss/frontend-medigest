import { useState, useEffect, useRef, forwardRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface DateRange {
  startDate: Date | null;
  endDate: Date | null;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  maxDate?: Date;
  minDate?: Date;
}

interface PresetOption {
  label: string;
  getValue: () => DateRange;
}

// Fonctions utilitaires
const formatDate = (date: Date | null): string => {
  if (!date) return '';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

const getMonthDays = (year: number, month: number): Date[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  
  // Ajustement pour que la semaine commence lundi
  let firstDayOfWeek = firstDay.getDay();
  firstDayOfWeek = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1; // 0 = dimanche -> 6, lundi = 0
  
  // Jours du mois précédent pour compléter la première semaine
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, prevMonthLastDay - i));
  }
  
  // Jours du mois courant
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  // Jours du mois suivant
  const remainingDays = 42 - days.length; // 6 semaines * 7 jours = 42
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }
  
  return days;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return date1.getDate() === date2.getDate() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getFullYear() === date2.getFullYear();
};

const isWithinRange = (date: Date, start: Date | null, end: Date | null): boolean => {
  if (!start || !end) return false;
  // Normaliser les heures pour la comparaison
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const s = new Date(start);
  s.setHours(0, 0, 0, 0);
  const e = new Date(end);
  e.setHours(23, 59, 59, 999);
  return d >= s && d <= e;
};

// Composant Calendar
const CalendarMonth = ({ 
  year, 
  month, 
  selectedRange,
  onSelect,
  minDate,
  maxDate
}: { 
  year: number;
  month: number;
  selectedRange: DateRange;
  onSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}) => {
  const days = getMonthDays(year, month);
  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  
  const isDateDisabled = (date: Date): boolean => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    
    if (minDate) {
      const min = new Date(minDate);
      min.setHours(0, 0, 0, 0);
      if (d < min) return true;
    }
    
    if (maxDate) {
      const max = new Date(maxDate);
      max.setHours(23, 59, 59, 999);
      if (d > max) return true;
    }
    
    return false;
  };

  const isStartDate = (date: Date): boolean => {
    return selectedRange.startDate ? isSameDay(date, selectedRange.startDate) : false;
  };

  const isEndDate = (date: Date): boolean => {
    return selectedRange.endDate ? isSameDay(date, selectedRange.endDate) : false;
  };

  return (
    <div className="w-full">
      <div className="text-center font-medium mb-4">
        {monthNames[month]} {year}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="text-center text-xs text-slate-400 py-2">
            {day}
          </div>
        ))}
        {days.map((date, index) => {
          const isCurrentMonth = date.getMonth() === month;
          const isSelected = isStartDate(date);
          const isEnd = isEndDate(date);
          const inRange = isWithinRange(date, selectedRange.startDate, selectedRange.endDate);
          const disabled = isDateDisabled(date);
          const isToday = isSameDay(date, new Date());
          
          return (
            <button
              key={index}
              onClick={() => !disabled && onSelect(date)}
              disabled={disabled}
              className={`
                relative p-2 text-sm rounded-lg transition-all
                ${!isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'}
                ${isSelected || isEnd ? 'bg-blue-600 text-white hover:bg-blue-700 font-medium' : ''}
                ${inRange && !isSelected && !isEnd ? 'bg-blue-50' : ''}
                ${isToday && !isSelected && !isEnd ? 'ring-2 ring-blue-200' : ''}
              `}
              aria-label={`Sélectionner le ${date.toLocaleDateString('fr-FR')}`}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Presets
const PRESETS: PresetOption[] = [
  {
    label: "Aujourd'hui",
    getValue: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return { startDate: today, endDate: today };
    }
  },
  {
    label: 'Cette semaine',
    getValue: () => {
      const today = new Date();
      const start = new Date(today);
      // Aller au lundi de la semaine courante
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1; // Si dimanche (0), on recule de 6 jours pour aller à lundi
      start.setDate(today.getDate() - diff);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Ce mois',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Mois dernier',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      end.setHours(23, 59, 59, 999);
      
      return { startDate: start, endDate: end };
    }
  },
  {
    label: 'Cette année',
    getValue: () => {
      const today = new Date();
      const start = new Date(today.getFullYear(), 0, 1);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(today.getFullYear(), 11, 31);
      end.setHours(23, 59, 59, 999);
      
      return { startDate: start, endDate: end };
    }
  }
];

export const DateRangePicker = forwardRef<HTMLDivElement, DateRangePickerProps>(
  ({ 
    value, 
    onChange, 
    className = '', 
    placeholder = 'Sélectionner une période',
    disabled = false,
    maxDate,
    minDate
  }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [selectedRange, setSelectedRange] = useState<DateRange>(
      value || { startDate: null, endDate: null }
    );
    const [selecting, setSelecting] = useState<'start' | 'end'>('start');
    
    const pickerRef = useRef<HTMLDivElement>(null);

    // Fonction pour combiner les refs (ref externe + ref interne)
    const setRefs = (element: HTMLDivElement | null) => {
      // Mettre à jour la ref interne
      pickerRef.current = element;
      
      // Mettre à jour la ref externe si elle existe
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    };

    // Gestion du clic à l'extérieur
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Synchronisation avec la valeur externe
    useEffect(() => {
      if (value) {
        setSelectedRange(value);
      }
    }, [value]);

    const handleDateSelect = (date: Date) => {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      
      if (selecting === 'start') {
        const newRange = { startDate: normalizedDate, endDate: null };
        setSelectedRange(newRange);
        setSelecting('end');
        onChange?.(newRange);
      } else {
        if (selectedRange.startDate && normalizedDate >= selectedRange.startDate) {
          const endDate = new Date(normalizedDate);
          endDate.setHours(23, 59, 59, 999);
          
          const newRange = { 
            startDate: selectedRange.startDate, 
            endDate: endDate 
          };
          setSelectedRange(newRange);
          setSelecting('start');
          onChange?.(newRange);
          setIsOpen(false);
        } else {
          // Si la date est avant la date de début, on recommence
          const newRange = { startDate: normalizedDate, endDate: null };
          setSelectedRange(newRange);
          setSelecting('end');
          onChange?.(newRange);
        }
      }
    };

    const handlePresetSelect = (preset: PresetOption) => {
      const range = preset.getValue();
      setSelectedRange(range);
      setSelecting('start');
      onChange?.(range);
      setIsOpen(false);
    };

    const clearSelection = () => {
      setSelectedRange({ startDate: null, endDate: null });
      setSelecting('start');
      onChange?.({ startDate: null, endDate: null });
    };

    const previousMonth = () => {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    };

    const nextMonth = () => {
      const nextMonthDate = new Date(currentYear, currentMonth + 1, 1);
      if (!maxDate || nextMonthDate <= maxDate) {
        if (currentMonth === 11) {
          setCurrentMonth(0);
          setCurrentYear(currentYear + 1);
        } else {
          setCurrentMonth(currentMonth + 1);
        }
      }
    };

    const displayText = selectedRange.startDate && selectedRange.endDate
      ? `${formatDate(selectedRange.startDate)} - ${formatDate(selectedRange.endDate)}`
      : selectedRange.startDate
      ? `À partir du ${formatDate(selectedRange.startDate)}`
      : placeholder;

    return (
      <div ref={setRefs} className={`relative ${className}`}>
        {/* Input */}
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`
            w-full flex items-center justify-between gap-2 px-4 py-3 
            rounded-xl border border-slate-200 bg-white
            focus:ring-2 focus:ring-blue-500 outline-none
            transition-all hover:border-blue-300
            ${disabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'cursor-pointer'}
          `}
          disabled={disabled}
          aria-label={displayText}
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-slate-400" />
            <span className={`text-sm ${displayText === placeholder ? 'text-slate-400' : 'text-slate-700'}`}>
              {displayText}
            </span>
          </div>
          {selectedRange.startDate && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearSelection();
              }}
              className="p-1 hover:bg-slate-100 rounded-full"
              aria-label="Effacer la sélection"
            >
              <X size={14} className="text-slate-400" />
            </button>
          )}
        </button>

        {/* Calendrier */}
        {isOpen && !disabled && (
          <div
            className="absolute z-50 mt-2 w-175 bg-white rounded-2xl border border-slate-200 shadow-xl p-4"
            style={{ minWidth: '700px' }}
          >
            {/* Presets */}
            <div className="mb-4 pb-4 border-b border-slate-100">
              <div className="flex gap-2 flex-wrap">
                {PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => handlePresetSelect(preset)}
                    className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Navigation mois */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={previousMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Mois précédent"
              >
                <ChevronLeft size={20} className="text-slate-600" />
              </button>
              <span className="font-medium">
                {new Date(currentYear, currentMonth).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Mois suivant"
              >
                <ChevronRight size={20} className="text-slate-600" />
              </button>
            </div>

            {/* Calendrier */}
            <CalendarMonth
              year={currentYear}
              month={currentMonth}
              selectedRange={selectedRange}
              onSelect={handleDateSelect}
              minDate={minDate}
              maxDate={maxDate}
            />

            {/* Instructions */}
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400">
              {selecting === 'start' ? 'Sélectionnez la date de début' : 'Sélectionnez la date de fin'}
            </div>
          </div>
        )}
      </div>
    );
  }
);

DateRangePicker.displayName = 'DateRangePicker';

export default DateRangePicker;