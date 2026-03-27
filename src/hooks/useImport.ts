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
    duplicateActions?: Record<string, string>
  ) => Promise<BulkImportResult | null>;
  downloadTemplate: (format?: 'excel' | 'csv') => Promise<void>;
  reset: () => void;
  setDuplicateActions: (actions: Record<string, string>) => void;
  
  // Utilitaires
  duplicateActions: Record<string, string>;
  getProductKey: (product: ImportPreviewProduct) => string;
}

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
      setPreview(previewData);
      
      // Initialiser les actions par défaut pour les doublons
      const defaultActions: Record<string, string> = {};
      previewData.duplicates.forEach(dup => {
        const key = getProductKey(dup);
        defaultActions[key] = 'update';
      });
      setDuplicateActions(defaultActions);
      
      onPreviewSuccess?.(previewData);
      return previewData;
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

  // Importer les produits
  const importProducts = useCallback(async (
    file: File,
    mode: 'add' | 'replace' | 'update' = 'add',
    actions?: Record<string, string>
  ): Promise<BulkImportResult | null> => {
    setIsImporting(true);
    setImportError(null);
    setError(null);
    
    try {
      const actionsToUse = actions || duplicateActions;
      const importResult = await inventoryService.importProducts(file, mode, actionsToUse);
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
      inventoryService.downloadBlob(blob, filename);
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