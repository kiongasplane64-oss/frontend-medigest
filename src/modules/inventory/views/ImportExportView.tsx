// components/inventory/ImportExportView.tsx
import { useState, useRef } from 'react';
import { Download, Upload, FileSpreadsheet, FileText, Printer, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useImport } from '@/hooks/useImport';
import { useExport } from '@/hooks/useExport';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';

interface ImportExportViewProps {
  pharmacyId?: string;
}

export default function ImportExportView({ pharmacyId }: ImportExportViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'replace' | 'update'>('add');
  
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
      await importProducts(selectedFile, importMode, duplicateActions);
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

  return (
    <div className="space-y-6">
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
          </div>

          <div className="p-6 space-y-4">
            {/* Téléchargement template */}
            <div className="flex gap-2">
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
                className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-medical file:text-white hover:file:bg-medical-dark"
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
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
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
                        <thead className="bg-slate-50">
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
                                    className="px-2 py-1 border border-slate-200 rounded text-sm"
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
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark disabled:opacity-50"
                  >
                    {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    {isImporting ? 'Import en cours...' : "Confirmer l'import"}
                  </button>
                  <button
                    onClick={resetForm}
                    className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
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
          </div>

          <div className="p-6 space-y-4">
            {/* Format d'export */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Format d'export
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setExportFormat('excel')}
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
                  onClick={() => setExportFormat('csv')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    exportFormat === 'csv'
                      ? 'bg-medical text-white border-medical'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <FileText size={18} />
                  CSV
                </button>
                <button
                  onClick={() => setExportFormat('pdf')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                    exportFormat === 'pdf'
                      ? 'bg-medical text-white border-medical'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Printer size={18} />
                  PDF
                </button>
              </div>
            </div>

            {/* Filtres d'export */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Filtres
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={exportFilters.stock_status || ''}
                  onChange={(e) => updateExportFilter('stock_status', e.target.value || undefined)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Tous les statuts</option>
                  <option value="out_of_stock">Rupture de stock</option>
                  <option value="low_stock">Stock faible</option>
                  <option value="normal">Stock normal</option>
                </select>
                <select
                  value={exportFilters.expiry_status || ''}
                  onChange={(e) => updateExportFilter('expiry_status', e.target.value || undefined)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">Toutes les expirations</option>
                  <option value="expired">Expirés</option>
                  <option value="critical">Expiration critique</option>
                  <option value="warning">Expiration proche</option>
                </select>
              </div>
            </div>

            {/* Bouton export */}
            <button
              onClick={() => exportStock()}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-medical text-white rounded-lg hover:bg-medical-dark disabled:opacity-50"
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
          <li>• Le fichier doit contenir les colonnes: nom, quantité, prix_achat, prix_vente</li>
          <li>• Les colonnes optionnelles: code, code-barres, date_expiration, catégorie, fournisseur, lot</li>
          <li>• Le prix de vente en {primaryCurrency} est requis pour chaque produit</li>
          <li>• Les dates d'expiration doivent être au format YYYY-MM-DD</li>
        </ul>
      </div>
    </div>
  );
}