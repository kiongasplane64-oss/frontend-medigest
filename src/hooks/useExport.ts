// hooks/useExport.ts
import { useState, useCallback } from 'react';
import { inventoryService } from '@/services/inventoryService';
import type { ExportFormat } from '@/types/inventory.types';

interface ExportFilters {
  pharmacy_id?: string;
  category_id?: string;
  category?: string;
  search?: string;
  stock_status?: string;
  expiry_status?: string;
  include_sales_stats?: boolean;
}

interface UseExportOptions {
  defaultFormat?: ExportFormat;
  defaultFilename?: string;
  onSuccess?: (filename: string) => void;
  onError?: (error: Error) => void;
  onStart?: () => void;
  onComplete?: () => void;
}

interface UseExportReturn {
  // État
  isExporting: boolean;
  error: Error | null;
  format: ExportFormat;
  filters: ExportFilters;
  lastExportedFilename: string | null;
  
  // Actions
  exportStock: (format?: ExportFormat, customFilters?: ExportFilters) => Promise<void>;
  setFormat: (format: ExportFormat) => void;
  setFilters: (filters: ExportFilters) => void;
  updateFilter: <K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) => void;
  resetFilters: () => void;
  reset: () => void;
}

const DEFAULT_FILTERS: ExportFilters = {
  pharmacy_id: undefined,
  category_id: undefined,
  category: undefined,
  search: undefined,
  stock_status: undefined,
  expiry_status: undefined,
  include_sales_stats: false,
};

export const useExport = (options: UseExportOptions = {}): UseExportReturn => {
  const {
    defaultFormat = 'excel',
    defaultFilename = 'export_stock',
    onSuccess,
    onError,
    onStart,
    onComplete,
  } = options;

  // États
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [filters, setFilters] = useState<ExportFilters>(DEFAULT_FILTERS);
  const [lastExportedFilename, setLastExportedFilename] = useState<string | null>(null);

  // Générer le nom du fichier avec date
  const generateFilename = useCallback((baseName: string, format: ExportFormat): string => {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 19).replace(/:/g, '-');
    const extension = format === 'excel' ? 'xlsx' : format === 'csv' ? 'csv' : 'pdf';
    return `${baseName}_${dateStr}.${extension}`;
  }, []);

  // Exporter le stock
  const exportStock = useCallback(async (
    exportFormat?: ExportFormat,
    customFilters?: ExportFilters
  ): Promise<void> => {
    const finalFormat = exportFormat || format;
    const finalFilters = customFilters || filters;
    
    setIsExporting(true);
    setError(null);
    onStart?.();
    
    try {
      const blob = await inventoryService.exportStock(finalFormat, finalFilters);
      const filename = generateFilename(defaultFilename, finalFormat);
      
      inventoryService.downloadBlob(blob, filename);
      
      setLastExportedFilename(filename);
      onSuccess?.(filename);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors de l\'export');
      setError(error);
      onError?.(error);
    } finally {
      setIsExporting(false);
      onComplete?.();
    }
  }, [format, filters, defaultFilename, generateFilename, onSuccess, onError, onStart, onComplete]);

  // Mettre à jour un filtre spécifique
  const updateFilter = useCallback(<K extends keyof ExportFilters>(
    key: K,
    value: ExportFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Réinitialiser les filtres
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Réinitialiser tout l'état
  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setFormat(defaultFormat);
    setError(null);
    setLastExportedFilename(null);
  }, [defaultFormat]);

  return {
    // État
    isExporting,
    error,
    format,
    filters,
    lastExportedFilename,
    
    // Actions
    exportStock,
    setFormat,
    setFilters,
    updateFilter,
    resetFilters,
    reset,
  };
};

export default useExport;