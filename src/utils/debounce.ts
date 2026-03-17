import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Options pour la fonction debounce
 */
interface DebounceOptions {
  /** Exécuter la fonction immédiatement au premier appel */
  leading?: boolean;
  /** Exécuter la fonction à la fin du délai */
  trailing?: boolean;
  /** Délai maximum avant d'exécuter la fonction */
  maxWait?: number;
}

/**
 * Fonction de debounce avec options avancées
 * @param func - Fonction à exécuter
 * @param wait - Délai d'attente en ms
 * @param options - Options de configuration
 * @returns Fonction debounced
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  options: DebounceOptions = {}
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: any = null;
  let result: ReturnType<T>;
  let lastCallTime: number | null = null;
  let lastInvokeTime = 0;

  const { leading = false, trailing = true, maxWait } = options;

  const invokeFunc = (time: number) => {
    lastInvokeTime = time;
    if (lastArgs && lastThis) {
      result = func.apply(lastThis, lastArgs);
    }
    lastArgs = null;
    lastThis = null;
    return result;
  };

  const startTimer = (timerFunc: () => void, delay: number) => {
    timeoutId = setTimeout(timerFunc, delay);
  };

  const shouldInvoke = (time: number) => {
    if (!lastCallTime) return true;
    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;

    return (
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxWait && timeSinceLastInvoke >= maxWait)
    );
  };

  const trailingEdge = (time: number) => {
    timeoutId = null;

    if (trailing && lastArgs) {
      return invokeFunc(time);
    }
    lastArgs = null;
    lastThis = null;
    return result;
  };

  const remainingWait = (time: number) => {
    if (!lastCallTime) return 0;

    const timeSinceLastCall = time - lastCallTime;
    const timeSinceLastInvoke = time - lastInvokeTime;
    const timeWaiting = wait - timeSinceLastCall;

    return maxWait
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting;
  };

  const timerExpired = () => {
    const time = Date.now();
    if (shouldInvoke(time)) {
      return trailingEdge(time);
    }
    // Recréer le timer avec le temps restant
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(timerExpired, remainingWait(time));
    }
  };

  const debounced = function (this: any, ...args: Parameters<T>) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time);

    lastArgs = args;
    lastThis = this;
    lastCallTime = time;

    if (isInvoking) {
      if (!timeoutId && leading) {
        // Exécution immédiate
        lastInvokeTime = time;
        result = func.apply(this, args);
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return result;
      } else if (!timeoutId) {
        // Premier appel avec délai
        startTimer(timerExpired, wait);
      }
    } else if (!timeoutId) {
      // Appels suivants
      startTimer(timerExpired, wait);
    }

    return result;
  } as T & { cancel: () => void; flush: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    lastArgs = null;
    lastThis = null;
    lastCallTime = null;
    lastInvokeTime = 0;
    timeoutId = null;
  };

  debounced.flush = () => {
    if (timeoutId && lastArgs && lastThis) {
      const time = Date.now();
      clearTimeout(timeoutId);
      timeoutId = null;
      return trailingEdge(time);
    }
    return result;
  };

  return debounced;
}

/**
 * Version simplifiée du debounce avec seulement le délai
 * @param func - Fonction à exécuter
 * @param wait - Délai d'attente en ms
 * @returns Fonction debounced
 */
export function simpleDebounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (this: any, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
}

/**
 * Hook React pour utiliser debounce sur une valeur
 * @param value - Valeur à debouncer
 * @param delay - Délai en ms
 * @returns Valeur debouncée
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook React pour fonction debouncée
 * @param callback - Fonction à debouncer
 * @param delay - Délai en ms
 * @returns Fonction debouncée
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T & { cancel: () => void } {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T & { cancel: () => void };

  debouncedCallback.cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttle function
 * @param func - Fonction à throttler
 * @param limit - Limite en ms
 * @returns Fonction throttlée
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T & { cancel: () => void } {
  let inThrottle: boolean;
  let lastFunc: ReturnType<typeof setTimeout>;
  let lastRan: number;

  const throttled = function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      lastRan = Date.now();
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    } else {
      clearTimeout(lastFunc);
      lastFunc = setTimeout(() => {
        if (Date.now() - lastRan >= limit) {
          func.apply(this, args);
          lastRan = Date.now();
        }
      }, Math.max(limit - (Date.now() - lastRan), 0));
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    clearTimeout(lastFunc);
    inThrottle = false;
  };

  return throttled;
}

/**
 * Hook React pour throttle
 * @param callback - Fonction à throttler
 * @param limit - Limite en ms
 * @returns Fonction throttlée
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  limit: number
): T & { cancel: () => void } {
  const callbackRef = useRef(callback);
  const lastRanRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRanRef.current >= limit) {
        // Exécuter immédiatement
        callbackRef.current(...args);
        lastRanRef.current = now;
      } else if (!timeoutRef.current) {
        // Planifier pour la fin du délai
        const remaining = limit - (now - lastRanRef.current);
        timeoutRef.current = setTimeout(() => {
          callbackRef.current(...args);
          lastRanRef.current = Date.now();
          timeoutRef.current = null;
        }, remaining);
      }
    },
    [limit]
  ) as T & { cancel: () => void };

  throttledCallback.cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Nettoyage
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

export default debounce;