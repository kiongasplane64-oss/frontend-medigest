// Historique.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  ArrowLeft,
  Download,
  Printer,
  Eye,
  TrendingUp,
  Package,
  Users,
  CreditCard,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  Receipt,
  Calendar,
  RefreshCw,
  WifiOff,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { saleService, type SaleResponse} from '@/services/saleService';
import { useAuthStore } from '@/store/useAuthStore';
import { useOnline } from '@/hooks/useOnline';
import { useToast } from '@/hooks/useToast';

interface SaleItem {
  productId?: string;
  id?: string;
  name: string;
  price: number;
  quantity: number;
  code?: string;
}

interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethod: string;
  timestamp: number;
  cashierName?: string;
  posName?: string;
  sessionNumber?: string;
  receiptNumber?: string;
  clientName?: string;
  status?: 'completed' | 'pending' | 'cancelled';
  synced?: boolean;
}

type DateRange = 'today' | 'week' | 'month' | 'custom';

export default function Historique() {
  const { user } = useAuthStore();
  const isOnline = useOnline();
  const { toast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [filteredSales, setFilteredSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const [dateRange, setDateRange] = useState<DateRange>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  // CORRECTION: Suppression de la variable inutilisée dailyStats
  // Le useState était mal utilisé - on supprime cette variable car elle n'est pas utilisée

  const itemsPerPage = 20;

  useEffect(() => {
    void loadSales();
  }, [currentPage, dateRange, customStartDate, customEndDate, paymentFilter]);

  useEffect(() => {
    filterSales();
  }, [sales, search]);

  useEffect(() => {
    void loadDailyStats();
  }, []);

  async function loadDailyStats() {
    try {
      const stats = await saleService.getDailyStats();
      // Les stats journalières sont récupérées mais non utilisées
      // On pourrait les stocker dans une variable d'état si nécessaire
      console.debug('Stats journalières chargées:', stats);
    } catch (error) {
      console.error('Erreur chargement stats journalières:', error);
    }
  }

  function normalizeSale(sale: SaleResponse): Sale {
    return {
      id: sale.id,
      items: (sale.items || []).map(item => ({
        id: item.product_id,
        name: item.product_name,
        price: item.unit_price,
        quantity: item.quantity,
        code: item.product_code,
      })),
      total: sale.total_amount,
      paymentMethod: sale.payment_method,
      timestamp: new Date(sale.created_at).getTime(),
      cashierName: sale.seller_name,
      posName: sale.pharmacy_id,
      sessionNumber: sale.reference?.slice(0, 8),
      receiptNumber: sale.receipt_number || sale.invoice_number || sale.reference,
      clientName: sale.client_name || 'Passager',
      status: sale.status as 'completed' | 'pending' | 'cancelled',
      synced: true,
    };
  }

  function buildDateParams() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (dateRange) {
      case 'today': {
        const startDate = today.toISOString();
        const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();
        return { start_date: startDate, end_date: endDate };
      }
      case 'week': {
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return {
          start_date: weekAgo.toISOString(),
          end_date: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
        };
      }
      case 'month': {
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        return {
          start_date: monthAgo.toISOString(),
          end_date: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(),
        };
      }
      case 'custom': {
        const params: { start_date?: string; end_date?: string } = {};
        if (customStartDate) {
          params.start_date = new Date(customStartDate).toISOString();
        }
        if (customEndDate) {
          params.end_date = new Date(
            new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1,
          ).toISOString();
        }
        return params;
      }
      default:
        return {};
    }
  }

  async function loadSales() {
    setLoading(true);
    try {
      const dateParams = buildDateParams();
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        sort_by: 'created_at',
        sort_order: 'desc',
        ...dateParams,
      };

      if (paymentFilter !== 'all') {
        params.payment_method = paymentFilter;
      }

      const response = await saleService.getSales(params);

      const normalizedSales = (response.items || []).map(normalizeSale);
      setSales(normalizedSales);
      setTotalPages(Math.max(1, Math.ceil((response.total || 0) / itemsPerPage)));
      setTotalCount(response.total || normalizedSales.length);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger l'historique",
        variant: "destructive",
      });
      setSales([]);
      setTotalPages(1);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  function filterSales() {
    if (!search.trim()) {
      setFilteredSales(sales);
      return;
    }

    const searchLower = search.toLowerCase().trim();
    const filtered = sales.filter((sale) => {
      const saleNumber = getSaleNumber(sale).toLowerCase();
      const client = getClientName(sale).toLowerCase();
      const cashier = getCashierName(sale).toLowerCase();
      return (
        saleNumber.includes(searchLower) ||
        client.includes(searchLower) ||
        cashier.includes(searchLower) ||
        sale.items.some((item) => item.name.toLowerCase().includes(searchLower))
      );
    });

    setFilteredSales(filtered);
  }

  const stats = useMemo(() => {
    const totalAmount = filteredSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const totalItems = filteredSales.reduce(
      (sum, sale) =>
        sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
      0,
    );
    const totalSales = filteredSales.length;
    const averageTicket = totalSales > 0 ? totalAmount / totalSales : 0;

    return { totalAmount, totalItems, totalSales, averageTicket };
  }, [filteredSales]);

  function getSaleNumber(sale: Sale): string {
    return sale.receiptNumber || sale.id.slice(0, 8) || 'N/A';
  }

  function getCashierName(sale: Sale): string {
    return sale.cashierName || user?.nom_complet || user?.email || 'Inconnu';
  }

  function getClientName(sale: Sale): string {
    return sale.clientName || 'Passager';
  }

  function getPosName(sale: Sale): string {
    return sale.posName || 'POS-01';
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash':
        return 'Espèces';
      case 'mobile_money':
      case 'mobile':
        return 'Mobile Money';
      case 'account':
        return 'Compte Client';
      default:
        return method || 'Non défini';
    }
  }

  function getPaymentMethodColor(method: string): string {
    switch (method) {
      case 'cash':
        return 'bg-emerald-100 text-emerald-700';
      case 'mobile_money':
      case 'mobile':
        return 'bg-blue-100 text-blue-700';
      case 'account':
        return 'bg-violet-100 text-violet-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  async function exportToCSV() {
    try {
      let exportData = filteredSales;

      if (filteredSales.length < totalCount) {
        const dateParams = buildDateParams();
        const response = await saleService.getSales({
          limit: 1000,
          ...dateParams,
          payment_method: paymentFilter !== 'all' ? paymentFilter : undefined,
        });
        exportData = (response.items || []).map(normalizeSale);
      }

      const headers = [
        'Numero',
        'Date',
        'Client',
        'Caissier',
        'POS',
        'Articles',
        'Total',
        'Paiement',
        'Statut',
      ];

      const csvData = exportData.map((sale) => [
        getSaleNumber(sale),
        formatDate(sale.timestamp),
        getClientName(sale),
        getCashierName(sale),
        getPosName(sale),
        sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        Number(sale.total).toFixed(2),
        getPaymentMethodLabel(sale.paymentMethod),
        sale.status === 'cancelled' ? 'Annulée' : sale.status === 'pending' ? 'En attente' : 'Terminée',
      ]);

      const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
      const csv = [headers, ...csvData]
        .map((row) => row.map(escapeCell).join(','))
        .join('\n');

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historique_ventes_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Export réussi",
        description: "Le fichier CSV a été téléchargé",
      });
    } catch (error) {
      console.error('Erreur export CSV:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'exporter les données",
        variant: "destructive",
      });
    }
  }

  function printSale(sale: Sale) {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vente #${getSaleNumber(sale)}</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              background: white;
            }
            .receipt {
              max-width: 320px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #ccc;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 6px;
              font-size: 12px;
            }
            .total {
              border-top: 1px solid #000;
              padding-top: 8px;
              margin-top: 8px;
              font-weight: bold;
            }
            .meta {
              font-size: 11px;
              color: #666;
              margin: 2px 0;
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h2>GoApp Pharmacie</h2>
              <div class="meta">Vente #${getSaleNumber(sale)}</div>
              <div class="meta">${formatDate(sale.timestamp)}</div>
              <div class="meta">Caissier: ${getCashierName(sale)}</div>
              <div class="meta">POS: ${getPosName(sale)}</div>
              <div class="meta">Client: ${getClientName(sale)}</div>
            </div>

            ${sale.items
              .map(
                (item) => `
                  <div class="row">
                    <span>${item.quantity} x ${item.name}</span>
                    <span>${(Number(item.price) * Number(item.quantity)).toFixed(2)} $</span>
                  </div>
                `,
              )
              .join('')}

            <div class="row total">
              <span>Total</span>
              <span>${Number(sale.total).toFixed(2)} $</span>
            </div>

            <div class="meta" style="text-align:center; margin-top:16px;">
              Paiement: ${getPaymentMethodLabel(sale.paymentMethod)}
            </div>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function handleDateRangeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setDateRange(e.target.value as DateRange);
    setCurrentPage(1);
  }

  function handlePaymentFilterChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setPaymentFilter(e.target.value);
    setCurrentPage(1);
  }

  function resetFilters() {
    setSearch('');
    setDateRange('today');
    setPaymentFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setCurrentPage(1);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/pos"
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 md:text-2xl">
                Historique des ventes
              </h1>
              <p className="text-sm text-slate-400">
                Consultation, filtres, export et impression
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isOnline && (
              <span className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs font-medium text-amber-700">
                <WifiOff size={14} />
                Mode hors-ligne
              </span>
            )}

            {(search || dateRange !== 'today' || paymentFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Réinitialiser
              </button>
            )}

            <button
              onClick={() => void loadSales()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw size={18} />
              Actualiser
            </button>

            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              <Download size={18} />
              Exporter CSV
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Rechercher par numéro, client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <select
                value={dateRange}
                onChange={handleDateRangeChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Aujourd&apos;hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="custom">Personnalisé</option>
              </select>
            </div>

            <div>
              <select
                value={paymentFilter}
                onChange={handlePaymentFilterChange}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous les paiements</option>
                <option value="cash">Espèces</option>
                <option value="mobile_money">Mobile Money</option>
                <option value="account">Compte Client</option>
              </select>
            </div>

            {dateRange === 'custom' ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            ) : (
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Calendar size={18} />
                Période active
              </div>
            )}
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100">
                <TrendingUp size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Chiffre d&apos;affaires</p>
                <p className="text-xl font-black text-slate-800">
                  {stats.totalAmount.toFixed(2)} $
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100">
                <Package size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Articles vendus</p>
                <p className="text-xl font-black text-slate-800">{stats.totalItems}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100">
                <Users size={20} className="text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Nombre de ventes</p>
                <p className="text-xl font-black text-slate-800">{stats.totalSales}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100">
                <CreditCard size={20} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Ticket moyen</p>
                <p className="text-xl font-black text-slate-800">
                  {stats.averageTicket.toFixed(2)} $
                </p>
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4 md:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
              <Clock size={20} className="text-blue-600" />
              Transactions ({filteredSales.length})
            </h2>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="flex items-center justify-center p-10 text-slate-400">
                <Loader2 className="mr-2 animate-spin" size={20} />
                Chargement...
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Aucune vente trouvée</div>
            ) : (
              filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-4 transition-colors hover:bg-slate-50 md:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-600">
                          #{getSaleNumber(sale)}
                        </span>

                        <span className="text-sm text-slate-400">
                          {formatDate(sale.timestamp)}
                        </span>

                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentMethodColor(
                            sale.paymentMethod,
                          )}`}
                        >
                          {getPaymentMethodLabel(sale.paymentMethod)}
                        </span>

                        {sale.status === 'cancelled' && (
                          <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                            Annulée
                          </span>
                        )}
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-400">Client</p>
                          <p className="font-semibold text-slate-800">{getClientName(sale)}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Caissier</p>
                          <p className="font-semibold text-slate-800">{getCashierName(sale)}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Articles</p>
                          <p className="font-semibold text-slate-800">
                            {sale.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Montant</p>
                          <p className="text-lg font-black text-blue-600">
                            {Number(sale.total).toFixed(2)} $
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setSelectedSale(sale)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Voir détails"
                      >
                        <Eye size={18} />
                      </button>

                      <button
                        onClick={() => printSale(sale)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Imprimer"
                      >
                        <Printer size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col gap-4 border-t border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-400">
                Affichage {(currentPage - 1) * itemsPerPage + 1} à{' '}
                {Math.min(currentPage * itemsPerPage, totalCount)} sur {totalCount} ventes
              </p>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft size={18} />
                </button>

                <span className="px-3 py-2 text-sm font-medium text-slate-700">
                  Page {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <Receipt size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-800 md:text-xl">
                      Détails vente #{getSaleNumber(selectedSale)}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {formatDate(selectedSale.timestamp)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedSale(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Date</p>
                  <p className="font-bold text-slate-800">{formatDate(selectedSale.timestamp)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Caissier</p>
                  <p className="font-bold text-slate-800">{getCashierName(selectedSale)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Client</p>
                  <p className="font-bold text-slate-800">{getClientName(selectedSale)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Paiement</p>
                  <span
                    className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${getPaymentMethodColor(
                      selectedSale.paymentMethod,
                    )}`}
                  >
                    {getPaymentMethodLabel(selectedSale.paymentMethod)}
                  </span>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <h4 className="font-bold text-slate-800">Articles</h4>
                </div>

                <div className="divide-y divide-slate-100">
                  {selectedSale.items.map((item, idx) => (
                    <div
                      key={`${item.id || idx}`}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {Number(item.price).toFixed(2)} $/unité
                          {item.code ? ` · ${item.code}` : ''}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-semibold text-slate-800">
                          {item.quantity} × {Number(item.price).toFixed(2)} $
                        </p>
                        <p className="text-sm font-bold text-blue-600">
                          {(Number(item.price) * Number(item.quantity)).toFixed(2)} $
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="flex items-center justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-blue-600">
                    {Number(selectedSale.total).toFixed(2)} $
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-5 md:p-6">
              <button
                onClick={() => printSale(selectedSale)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
              >
                <Printer size={18} />
                Imprimer
              </button>

              <button
                onClick={() => setSelectedSale(null)}
                className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700 hover:bg-slate-50"
              >
                <X size={18} />
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}