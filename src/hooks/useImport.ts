// hooks/useImport.ts
import { useState, useCallback } from 'react';
import { inventoryService } from '@/services/inventoryService';
import type { ImportPreviewResponse, BulkImportResult, ImportPreviewProduct } from '@/types/inventory.types';

interface UseImportOptions {
  onSuccess?: (result: BulkImportResult) => void;
  onError?: (error: Error) => void;
  onPreviewSuccess?: (preview: ImportPreviewResponse) => void;
  onPreviewError?: (error: Error) => void;
}

interface ImportOptions {
  preserve_prices?: boolean;
  preserve_quantities?: boolean;
}

interface UseImportReturn {
  // État
  isPreviewing: boolean;
  isImporting: boolean;
  isDownloadingTemplate: boolean;
  preview: ImportPreviewResponse | null;
  result: BulkImportResult | null;
  error: Error | null;
  previewError: Error | null;
  importError: Error | null;
  
  // Actions
  previewImport: (file: File) => Promise<ImportPreviewResponse | null>;
  importProducts: (
    file: File, 
    mode?: 'add' | 'replace' | 'update',
    duplicateActions?: Record<string, string>,
    options?: ImportOptions
  ) => Promise<BulkImportResult | null>;
  downloadTemplate: (format?: 'excel' | 'csv') => Promise<void>;
  reset: () => void;
  setDuplicateActions: (actions: Record<string, string>) => void;
  
  // Utilitaires
  duplicateActions: Record<string, string>;
  getProductKey: (product: ImportPreviewProduct) => string;
}

// Fonction utilitaire pour normaliser les nombres
const normalizeNumber = (value: unknown): number => {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  return isNaN(num) ? 0 : num;
};

// Type pour les données brutes de l'API avec propriétés optionnelles
type RawImportPreviewProduct = {
  name: string;
  code?: string;
  barcode?: string;
  quantity?: number;
  purchase_price?: number;
  selling_price?: number;
  selling_price_wholesale?: number;
  selling_price_retail?: number;
  expiry_date?: string;
  category?: string;
  location?: string;
  supplier?: string;
  batch_number?: string;
  existingProduct?: unknown;
  action?: string;
};

export const useImport = (options: UseImportOptions = {}): UseImportReturn => {
  const {
    onSuccess,
    onError,
    onPreviewSuccess,
    onPreviewError
  } = options;

  // États
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [previewError, setPreviewError] = useState<Error | null>(null);
  const [importError, setImportError] = useState<Error | null>(null);
  const [duplicateActions, setDuplicateActions] = useState<Record<string, string>>({});

  // Fonction pour générer une clé unique pour un produit (pour les doublons)
  const getProductKey = useCallback((product: ImportPreviewProduct): string => {
    if (product.code) return product.code;
    if (product.barcode) return product.barcode;
    return product.name.toLowerCase().trim();
  }, []);

  // Prévisualiser l'import
  const previewImport = useCallback(async (file: File): Promise<ImportPreviewResponse | null> => {
    setIsPreviewing(true);
    setPreviewError(null);
    setError(null);
    
    try {
      const previewData = await inventoryService.previewImport(file);
      
      // Traitement des données de prévisualisation pour garantir des valeurs numériques correctes
      const processedData: ImportPreviewResponse = {
        ...previewData,
        products: previewData.products.map((product) => {
          const rawProduct = product as unknown as RawImportPreviewProduct;
          return {
            ...product,
            purchase_price: normalizeNumber(rawProduct.purchase_price),
            selling_price: normalizeNumber(rawProduct.selling_price),
            selling_price_wholesale: rawProduct.selling_price_wholesale ? normalizeNumber(rawProduct.selling_price_wholesale) : undefined,
            selling_price_retail: rawProduct.selling_price_retail ? normalizeNumber(rawProduct.selling_price_retail) : undefined,
          };
        }),
        duplicates: previewData.duplicates.map((dup) => {
          const rawDup = dup as unknown as RawImportPreviewProduct;
          return {
            ...dup,
            purchase_price: normalizeNumber(rawDup.purchase_price),
            selling_price: normalizeNumber(rawDup.selling_price),
            selling_price_wholesale: rawDup.selling_price_wholesale ? normalizeNumber(rawDup.selling_price_wholesale) : undefined,
            selling_price_retail: rawDup.selling_price_retail ? normalizeNumber(rawDup.selling_price_retail) : undefined,
          };
        }),
      };
      
      setPreview(processedData);
      
      // Initialiser les actions par défaut pour les doublons
      const defaultActions: Record<string, string> = {};
      processedData.duplicates.forEach(dup => {
        const key = getProductKey(dup);
        defaultActions[key] = 'update';
      });
      setDuplicateActions(defaultActions);
      
      onPreviewSuccess?.(processedData);
      return processedData;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors de la prévisualisation');
      setPreviewError(error);
      setError(error);
      onPreviewError?.(error);
      return null;
    } finally {
      setIsPreviewing(false);
    }
  }, [getProductKey, onPreviewSuccess, onPreviewError]);

  // Importer les produits avec support des options de préservation
  const importProducts = useCallback(async (
    file: File,
    mode: 'add' | 'replace' | 'update' = 'add',
    actions?: Record<string, string>,
    options?: ImportOptions
  ): Promise<BulkImportResult | null> => {
    setIsImporting(true);
    setImportError(null);
    setError(null);
    
    try {
      const actionsToUse = actions || duplicateActions;
      
      // Créer un FormData pour envoyer le fichier et les paramètres
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('duplicate_actions', JSON.stringify(actionsToUse));
      
      // Ajouter les options de préservation si spécifiées
      if (options?.preserve_prices) {
        formData.append('preserve_prices', 'true');
      }
      if (options?.preserve_quantities) {
        formData.append('preserve_quantities', 'true');
      }
      
      const importResult = await inventoryService.importProducts(formData);
      setResult(importResult);
      onSuccess?.(importResult);
      return importResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors de l\'import');
      setImportError(error);
      setError(error);
      onError?.(error);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, [duplicateActions, onSuccess, onError]);

  // Télécharger le template
  const downloadTemplate = useCallback(async (format: 'excel' | 'csv' = 'excel'): Promise<void> => {
    setIsDownloadingTemplate(true);
    setError(null);
    
    try {
      const blob = await inventoryService.getImportTemplate(format);
      const filename = `template_import_produits.${format === 'excel' ? 'xlsx' : 'csv'}`;
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erreur lors du téléchargement du template');
      setError(error);
      onError?.(error);
    } finally {
      setIsDownloadingTemplate(false);
    }
  }, [onError]);

  // Réinitialiser l'état
  const reset = useCallback(() => {
    setPreview(null);
    setResult(null);
    setError(null);
    setPreviewError(null);
    setImportError(null);
    setDuplicateActions({});
    setIsPreviewing(false);
    setIsImporting(false);
    setIsDownloadingTemplate(false);
  }, []);

  return {
    // État
    isPreviewing,
    isImporting,
    isDownloadingTemplate,
    preview,
    result,
    error,
    previewError,
    importError,
    
    // Actions
    previewImport,
    importProducts,
    downloadTemplate,
    reset,
    setDuplicateActions,
    
    // Utilitaires
    duplicateActions,
    getProductKey,
  };
};

export default useImport;