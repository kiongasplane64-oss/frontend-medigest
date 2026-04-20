// components/inventory/ImportExportView.tsx
import { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, FileText, AlertCircle, CheckCircle, Loader2, Building2, Filter } from 'lucide-react';
import { useImport } from '@/hooks/useImport';
import { useExport } from '@/hooks/useExport';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { ExportFormat } from '@/types/inventory.types';

interface ImportExportViewProps {
  pharmacyId?: string;
  branchId?: string;
}

export default function ImportExportView({ pharmacyId, branchId }: ImportExportViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'replace' | 'update'>('add');
  const [showExportFilters, setShowExportFilters] = useState(false);
  
  const { primaryCurrency } = usePharmacyConfig(pharmacyId);
  
  const {
    isPreviewing,
    isImporting,
    isDownloadingTemplate,
    preview,
    result,
    previewError,
    importError,
    previewImport,
    importProducts,
    downloadTemplate,
    duplicateActions,
    setDuplicateActions,
    reset: resetImport,
  } = useImport({
    onSuccess: () => {
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const {
    isExporting,
    error: exportError,
    format: exportFormat,
    setFormat: setExportFormat,
    exportStock,
    filters: exportFilters,
    updateFilter: updateExportFilter,
  } = useExport({
    defaultFormat: 'excel',
    defaultFilename: `stock_export_${new Date().toISOString().slice(0, 10)}`,
    onSuccess: (filename) => {
      console.log('Export réussi:', filename);
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      await previewImport(file);
    }
  };

  const handleStartImport = async () => {
    if (selectedFile) {
      // Forcer preserve_prices et preserve_quantities à true
      // Les prix et quantités du fichier source sont toujours préservés
      await importProducts(selectedFile, importMode, duplicateActions, {
        preserve_prices: true,     // Toujours true - les prix ne sont jamais recalculés
        preserve_quantities: true  // Toujours true - les quantités ne sont jamais modifiées
      });
    }
  };

  const handleDuplicateActionChange = (productKey: string, action: string) => {
    setDuplicateActions({
      ...duplicateActions,
      [productKey]: action,
    });
  };

  const resetForm = () => {
    setSelectedFile(null);
    resetImport();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Fonction d'export corrigée
  const handleExportWithFilters = async () => {
    if (!pharmacyId) {
      console.error('Aucune pharmacie sélectionnée pour l\'export');
      return;
    }

    // Construire les paramètres d'export
    const exportParams: {
      pharmacy_id: string;
      branch_id?: string;
      stock_status?: string;
      expiry_status?: string;
      category_id?: string;
      search?: string;
    } = {
      pharmacy_id: pharmacyId,
    };
    
    // Ajouter branch_id seulement si présent
    if (branchId && branchId.trim()) {
      exportParams.branch_id = branchId;
    }
    
    // Ajouter les filtres non vides
    if (exportFilters.stock_status && exportFilters.stock_status !== '') {
      exportParams.stock_status = exportFilters.stock_status;
    }
    if (exportFilters.expiry_status && exportFilters.expiry_status !== '') {
      exportParams.expiry_status = exportFilters.expiry_status;
    }
    if (exportFilters.category_id && exportFilters.category_id !== '') {
      exportParams.category_id = exportFilters.category_id;
    }
    if (exportFilters.search && exportFilters.search.trim() !== '') {
      exportParams.search = exportFilters.search.trim();
    }
    
    try {
      // Appeler exportStock avec le format et les paramètres
      await exportStock(exportFormat, exportParams);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    }
  };

  const handleFormatChange = (format: ExportFormat) => {
    setExportFormat(format);
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec infos pharmacie/branche */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl p-4 border border-slate-200">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Building2 size={16} />
          <span>Pharmacie: {pharmacyId || 'Non définie'}</span>
          {branchId && (
            <>
              <span className="text-slate-300">|</span>
              <span>Branche: {branchId}</span>
            </>
          )}
        </div>
        <div className="text-xs text-slate-400">
          Devise principale: {primaryCurrency}
        </div>
      </div>

      {/* Onglets Import/Export */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Import */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Upload size={20} className="text-medical" />
              <h2 className="font-semibold text-slate-800">Import de produits</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Importez vos produits depuis un fichier Excel ou CSV
            </p>
            {branchId && (
              <p className="text-xs text-medical mt-1">
                ⚡ Les produits seront importés dans la branche sélectionnée
              </p>
            )}
          </div>

          <div className="p-6 space-y-4">
            {/* Téléchargement template */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => downloadTemplate('excel')}
                disabled={isDownloadingTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FileSpreadsheet size={18} />
                {isDownloadingTemplate ? 'Téléchargement...' : 'Template Excel'}
              </button>
              <button
                onClick={() => downloadTemplate('csv')}
                disabled={isDownloadingTemplate}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FileText size={18} />
                {isDownloadingTemplate ? 'Téléchargement...' : 'Template CSV'}
              </button>
            </div>

            {/* Options de préservation des données - TOUJOURS ACTIVES */}
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <p className="text-sm font-medium text-green-800 mb-2">✅ Protection des données importées</p>
              <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                <span><strong>Prix d'achat et de vente conservés</strong> - Aucun recalcul automatique</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-green-700">
                <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">✓</div>
                <span><strong>Quantités exactes conservées</strong> - Pas de modification automatique</span>
              </div>
              <p className="text-xs text-green-700 mt-3 pt-2 border-t border-green-200">
                ⚠️ <strong>Important:</strong> Les prix et quantités du fichier source sont toujours préservés. 
                Aucun recalcul automatique n'est appliqué, même si la configuration de prix automatique est activée.
              </p>
            </div>

            {/* Sélection fichier */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Fichier à importer
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-medical file:text-white hover:file:bg-medical-dark cursor-pointer"
              />
            </div>

            {/* Mode d'import */}
            {preview && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Mode d'import
                </label>
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as typeof importMode)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-medical"
                >
                  <option value="add">Ajouter uniquement (ignorer les doublons)</option>
                  <option value="update">Mettre à jour les produits existants</option>
                  <option value="replace">Remplacer tous les produits</option>
                </select>
              </div>
            )}

            {/* Aperçu */}
            {isPreviewing && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-medical" size={32} />
                <span className="ml-2 text-slate-500">Analyse du fichier...</span>
              </div>
            )}

            {previewError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} />
                <span className="text-sm">{previewError.message}</span>
              </div>
            )}

            {preview && (
              <div className="space-y-4">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle size={18} />
                    <span className="font-medium">Aperçu du fichier</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-sm">
                    <div>Total: <strong>{preview.summary.total_products}</strong></div>
                    <div>Nouveaux: <strong>{preview.summary.new_products_count}</strong></div>
                    <div>Doublons: <strong>{preview.summary.duplicates_count}</strong></div>
                    <div>Erreurs: <strong>{preview.summary.errors_count}</strong></div>
                  </div>
                </div>

                {/* Gestion des doublons */}
                {preview.duplicates.length > 0 && (
                  <div>
                    <h3 className="font-medium text-slate-800 mb-2">Doublons détectés</h3>
                    <div className="border border-slate-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Produit</th>
                            <th className="px-3 py-2 text-left">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.duplicates.map((dup, idx) => {
                            const key = dup.code || dup.barcode || dup.name;
                            return (
                              <tr key={idx} className="border-t border-slate-100">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{dup.name}</div>
                                  <div className="text-xs text-slate-400">{dup.code || dup.barcode}</div>
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={duplicateActions[key] || 'update'}
                                    onChange={(e) => handleDuplicateActionChange(key, e.target.value)}
                                    className="px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-medical"
                                  >
                                    <option value="update">Mettre à jour</option>
                                    <option value="merge_quantity">Fusionner les quantités</option>
                                    <option value="keep_both">Conserver les deux</option>
                                    <option value="skip">Ignorer</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Actions import */}
                <div className="flex gap-2 pt-4">
                  <button
                    onClick={handleStartImport}
                    disabled={isImporting}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark disabled:opacity-50 transition-colors"
                  >
                    {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    {isImporting ? 'Import en cours...' : "Confirmer l'import"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>

                {importError && (
                  <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                    {importError.message}
                  </div>
                )}

                {result && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle size={18} />
                      <span className="font-medium">Import terminé !</span>
                    </div>
                    <div className="text-sm text-green-600 mt-1">
                      {result.message || `${result.created} produits créés, ${result.updated} mis à jour, ${result.skipped} ignorés`}
                    </div>
                    <div className="text-xs text-green-600 mt-2 pt-1 border-t border-green-200">
                      ✅ Les prix et quantités ont été importés sans modification
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section Export */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Download size={20} className="text-medical" />
              <h2 className="font-semibold text-slate-800">Export de stock</h2>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Exportez votre stock dans différents formats
            </p>
            {branchId && (
              <p className="text-xs text-medical mt-1">
                ⚡ Export du stock pour la branche sélectionnée
              </p>
            )}
          </div>

          <div className="p-6 space-y-4">
            {/* Format d'export */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Format d'export
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleFormatChange('excel')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    exportFormat === 'excel'
                      ? 'bg-medical text-white border-medical'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet size={18} />
                  Excel
                </button>
                <button
                  onClick={() => handleFormatChange('csv')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    exportFormat === 'csv'
                      ? 'bg-medical text-white border-medical'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FileText size={18} />
                  CSV
                </button>
              </div>
            </div>

            {/* Bouton afficher/masquer filtres */}
            <button
              onClick={() => setShowExportFilters(!showExportFilters)}
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-medical transition-colors"
            >
              <Filter size={14} />
              {showExportFilters ? 'Masquer les filtres' : 'Afficher les filtres'}
            </button>

            {/* Filtres d'export */}
            {showExportFilters && (
              <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Statut stock</label>
                    <select
                      value={exportFilters.stock_status || ''}
                      onChange={(e) => updateExportFilter('stock_status', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
                    >
                      <option value="">Tous les statuts</option>
                      <option value="out_of_stock">Rupture de stock</option>
                      <option value="low_stock">Stock faible</option>
                      <option value="normal">Stock normal</option>
                      <option value="over_stock">Surstock</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Statut expiration</label>
                    <select
                      value={exportFilters.expiry_status || ''}
                      onChange={(e) => updateExportFilter('expiry_status', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
                    >
                      <option value="">Toutes les expirations</option>
                      <option value="expired">Expirés</option>
                      <option value="critical">Expiration critique (&lt;7j)</option>
                      <option value="warning">Expiration proche (&lt;30j)</option>
                      <option value="valid">Valides</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Recherche</label>
                    <input
                      type="text"
                      value={exportFilters.search || ''}
                      onChange={(e) => updateExportFilter('search', e.target.value || undefined)}
                      placeholder="Nom, code, code-barres..."
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Catégorie</label>
                    <input
                      type="text"
                      value={exportFilters.category_id || ''}
                      onChange={(e) => updateExportFilter('category_id', e.target.value || undefined)}
                      placeholder="ID de catégorie"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-medical"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bouton export */}
            <button
              onClick={handleExportWithFilters}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark disabled:opacity-50 transition-colors"
            >
              {isExporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
              {isExporting ? 'Export en cours...' : `Exporter en ${exportFormat.toUpperCase()}`}
            </button>

            {exportError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {exportError.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Informations supplémentaires */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <h3 className="font-medium text-blue-800 mb-2">📋 Informations d'import</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Le fichier doit contenir les colonnes: <strong>nom, quantité, prix_achat, prix_vente</strong></li>
          <li>• Les colonnes optionnelles: code, code-barres, date_expiration, catégorie, fournisseur, lot</li>
          <li>• Le prix de vente en <strong>{primaryCurrency}</strong> est requis pour chaque produit</li>
          <li>• Les dates d'expiration doivent être au format <strong>YYYY-MM-DD</strong></li>
          <li>• <strong className="text-blue-800">✅ Important:</strong> Les prix et quantités importés sont toujours conservés sans modification</li>
          {branchId && (
            <li>• Les produits seront automatiquement liés à la branche <strong>{branchId}</strong></li>
          )}
        </ul>
      </div>

      {/* Information sur l'export par branche */}
      {branchId && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <h3 className="font-medium text-amber-800 mb-2">📤 Export par branche</h3>
          <p className="text-sm text-amber-700">
            L'export ne concerne que les produits de la branche <strong>{branchId}</strong>.
            {exportFilters.stock_status === 'low_stock' && ' Filtre "stock faible" actif.'}
            {exportFilters.expiry_status === 'critical' && ' Filtre "expiration critique" actif.'}
          </p>
        </div>
      )}
    </div>
  );
}