// modules/inventory/views/ReportStockView.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Download, Printer, Package, TrendingUp, TrendingDown, AlertTriangle, DollarSign } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import { usePharmacyConfig } from '@/hooks/usePharmacyConfig';
import type { ExpiryAlert } from '@/types/inventory.types';

interface ReportStockViewProps {
  pharmacyId?: string;
}

type ReportType = 'summary' | 'turnover' | 'valuation' | 'expiry' | 'movements';

export default function ReportStockView({ pharmacyId }: ReportStockViewProps) {
  const { formatPrice } = usePharmacyConfig(pharmacyId);
  const [activeReport, setActiveReport] = useState<ReportType>('summary');

  // Récupérer les statistiques
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stock-stats', pharmacyId],
    queryFn: () => inventoryService.getStats(),
  });

  // Récupérer le taux de rotation
  const { data: turnover, isLoading: turnoverLoading } = useQuery({
    queryKey: ['stock-turnover', pharmacyId],
    queryFn: () => inventoryService.getStockTurnover(365, pharmacyId),
  });

  // Récupérer la valorisation du stock
  const { data: valuation, isLoading: valuationLoading } = useQuery({
    queryKey: ['stock-valuation', pharmacyId],
    queryFn: () => inventoryService.getStockValuation('purchase', pharmacyId),
  });

  // Récupérer les alertes d'expiration
  const { data: expiryAlerts, isLoading: expiryLoading } = useQuery({
    queryKey: ['expiry-alerts', pharmacyId],
    queryFn: () => inventoryService.getExpiryAlerts(90),
  });

  const isLoading = statsLoading || turnoverLoading || valuationLoading || expiryLoading;

  const handleExportPDF = () => {
    // Implémentation de l'export PDF
    console.log('Export PDF');
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Rapports de stock</h2>
          <p className="text-sm text-slate-500">
            Analyse et rapports sur l'état de votre stock
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Download size={18} />
            Exporter PDF
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Printer size={18} />
            Imprimer
          </button>
        </div>
      </div>

      {/* Onglets des rapports */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        {[
          { id: 'summary', label: 'Résumé', icon: Package },
          { id: 'turnover', label: 'Rotation', icon: TrendingUp },
          { id: 'valuation', label: 'Valorisation', icon: DollarSign },
          { id: 'expiry', label: 'Expiration', icon: AlertTriangle },
        ].map((report) => (
          <button
            key={report.id}
            onClick={() => setActiveReport(report.id as ReportType)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeReport === report.id
                ? 'text-medical border-b-2 border-medical'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <report.icon size={16} />
            {report.label}
          </button>
        ))}
      </div>

      {/* Rapport Résumé */}
      {activeReport === 'summary' && stats && (
        <div className="space-y-6">
          {/* Cartes KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <Package className="text-medical" size={24} />
                <span className="text-2xl font-bold text-slate-800">{stats.total_products}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Produits en stock</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <DollarSign className="text-green-500" size={24} />
                <span className="text-2xl font-bold text-slate-800">{formatPrice(stats.total_selling_value)}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Valeur du stock</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <TrendingDown className="text-red-500" size={24} />
                <span className="text-2xl font-bold text-slate-800">{stats.out_of_stock_count}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Ruptures de stock</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between">
                <AlertTriangle className="text-amber-500" size={24} />
                <span className="text-2xl font-bold text-slate-800">{stats.low_stock_count}</span>
              </div>
              <p className="text-sm text-slate-500 mt-2">Stock faible</p>
            </div>
          </div>

          {/* Détails */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Statut du stock</h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Stock normal</span>
                    <span>{stats.total_products - stats.low_stock_count - stats.out_of_stock_count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${((stats.total_products - stats.low_stock_count - stats.out_of_stock_count) / stats.total_products) * 100}%`
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Stock faible</span>
                    <span>{stats.low_stock_count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${(stats.low_stock_count / stats.total_products) * 100}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Rupture</span>
                    <span>{stats.out_of_stock_count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{ width: `${(stats.out_of_stock_count / stats.total_products) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <h3 className="font-semibold text-slate-800 mb-3">Valeur par catégorie</h3>
              {stats.category_breakdown?.slice(0, 5).map((cat, idx) => (
                <div key={idx} className="flex justify-between text-sm py-2 border-b border-slate-100 last:border-0">
                  <span>{cat.category}</span>
                  <span className="font-medium">{formatPrice(cat.total_selling_value)}</span>
                </div>
              ))}
              {(!stats.category_breakdown || stats.category_breakdown.length === 0) && (
                <p className="text-slate-400 text-center py-4">Aucune donnée</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rapport Rotation */}
      {activeReport === 'turnover' && turnover && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-medical">{turnover.average_turnover_rate}</h3>
              <p className="text-sm text-slate-500">Taux de rotation moyen</p>
              <p className="text-xs text-slate-400">Sur {turnover.period_days} jours</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Produit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Vendus</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Stock moyen</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Rotation</th>
                  </tr>
                </thead>
                <tbody>
                  {turnover.products.slice(0, 10).map((product) => (
                    <tr key={product.product_id} className="border-b border-slate-100">
                      <td className="px-4 py-2">
                        <div className="font-medium text-sm">{product.product_name}</div>
                        <div className="text-xs text-slate-400">{product.product_code}</div>
                       </td>
                      <td className="px-4 py-2 text-right">{product.total_sold}</td>
                      <td className="px-4 py-2 text-right">{product.avg_inventory}</td>
                      <td className="px-4 py-2 text-right font-medium">
                        <span className={product.turnover_rate > 2 ? 'text-green-600' : product.turnover_rate > 1 ? 'text-amber-600' : 'text-red-600'}>
                          {product.turnover_rate}
                        </span>
                       </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rapport Valorisation */}
      {activeReport === 'valuation' && valuation && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500 mb-2">Valeur d'achat</p>
              <p className="text-2xl font-bold text-slate-800">{formatPrice(valuation.total_purchase_value)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500 mb-2">Valeur de vente</p>
              <p className="text-2xl font-bold text-green-600">{formatPrice(valuation.total_selling_value)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
              <p className="text-sm text-slate-500 mb-2">Marge potentielle</p>
              <p className="text-2xl font-bold text-medical">{formatPrice(valuation.total_profit)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-semibold text-slate-800 mb-4">Détail par catégorie</h3>
            <div className="h-64 flex items-center justify-center text-slate-400">
              Graphique de valorisation (à implémenter avec Recharts)
            </div>
          </div>
        </div>
      )}

      {/* Rapport Expiration */}
      {activeReport === 'expiry' && expiryAlerts && (
        <div className="space-y-6">
          {/* Statistiques expiration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-500">Expirés</p>
              <p className="text-2xl font-bold text-red-600">{expiryAlerts.counts?.expired || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-500">Expiration critique (7j)</p>
              <p className="text-2xl font-bold text-orange-600">
                {expiryAlerts.expiring_soon?.filter((a: ExpiryAlert) => a.days_remaining <= 7).length || 0}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
              <p className="text-sm text-slate-500">Expiration proche (30j)</p>
              <p className="text-2xl font-bold text-amber-600">
                {expiryAlerts.expiring_soon?.filter((a: ExpiryAlert) => a.days_remaining <= 30 && a.days_remaining > 7).length || 0}
              </p>
            </div>
          </div>

          {/* Produits expirés */}
          {expiryAlerts.expired && expiryAlerts.expired.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-red-50 px-4 py-3 border-b border-red-200">
                <h3 className="font-semibold text-red-700">Produits expirés</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Produit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date expiration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiryAlerts.expired.map((alert: ExpiryAlert) => (
                      <tr key={alert.product_id} className="border-b border-slate-100">
                        <td className="px-4 py-2 text-sm">{alert.product_name}</td>
                        <td className="px-4 py-2 text-sm text-slate-500">{alert.product_id}</td>
                        <td className="px-4 py-2 text-sm text-red-600">
                          {format(new Date(alert.expiry_date), 'dd/MM/yyyy', { locale: fr })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Produits expirant bientôt */}
          {expiryAlerts.expiring_soon && expiryAlerts.expiring_soon.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-amber-50 px-4 py-3 border-b border-amber-200">
                <h3 className="font-semibold text-amber-700">Produits expirant bientôt</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Produit</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Date expiration</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Jours restants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiryAlerts.expiring_soon.map((alert: ExpiryAlert) => (
                      <tr key={alert.product_id} className="border-b border-slate-100">
                        <td className="px-4 py-2 text-sm">{alert.product_name}</td>
                        <td className="px-4 py-2 text-sm text-slate-500">{alert.product_id}</td>
                        <td className="px-4 py-2 text-sm">
                          {format(new Date(alert.expiry_date), 'dd/MM/yyyy', { locale: fr })}
                        </td>
                        <td className={`px-4 py-2 text-right font-medium ${
                          alert.days_remaining <= 7 ? 'text-red-600' : 'text-amber-600'
                        }`}>
                          {alert.days_remaining} jours
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!expiryAlerts.expired || expiryAlerts.expired.length === 0) && 
           (!expiryAlerts.expiring_soon || expiryAlerts.expiring_soon.length === 0) && (
            <div className="bg-green-50 rounded-xl p-8 text-center">
              <Package size={48} className="mx-auto mb-3 text-green-500 opacity-50" />
              <p className="text-green-700">Aucun produit avec problème d'expiration</p>
              <p className="text-sm text-green-600 mt-1">Tous les produits sont valides</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}