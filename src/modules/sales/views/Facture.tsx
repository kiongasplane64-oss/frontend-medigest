// Facture.tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  FileText,
  Printer,
  Download,
  Eye,
  ArrowLeft,
  Filter,
  Receipt,
  Calendar,
  X,
  Loader2,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/useToast';
import { useSaleStore, type LocalSale } from '@/store/saleStore';
import { type SaleResponse } from '@/services/saleService';

// Types unifiés pour l'affichage
interface Invoice {
  id: string;
  receiptNumber?: string;
  items: Array<{
    id: string;
    name: string;
    price: number;
    quantity: number;
    code?: string;
  }>;
  total: number;
  paymentMethod: string;
  timestamp: number;
  cashierName?: string;
  posName?: string;
  sessionNumber?: string;
  clientName?: string;
  status?: string;
  synced: boolean;
  isLocal?: boolean;
}

export default function Facture() {
  const { toast } = useToast();
  const {
    sales: apiSales,
    localSales,
    fetchSales,
    syncPendingSales,
    loading: storeLoading,
    getPendingCount,
    resetFailedSales, // getSalesWithLocal retiré
  } = useSaleStore();

  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);

  const pendingCount = getPendingCount();

  // Chargement initial
  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    try {
      await fetchSales();
      // Tenter de synchroniser les ventes en attente
      await syncPendingSales();
    } catch (error) {
      console.error('Erreur chargement factures:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les factures",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Fonction de rafraîchissement manuel
  const handleRefresh = async () => {
    setLoading(true);
    try {
      await fetchSales();
      await syncPendingSales();
      toast({
        title: "Succès",
        description: "Factures mises à jour",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors du rafraîchissement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Réessayer les ventes en échec
  const handleRetryFailed = () => {
    resetFailedSales();
    toast({
      title: "Réessai",
      description: "Tentative de re-synchronisation des ventes échouées",
    });
  };

  // Normalisation d'une vente API vers Invoice
  function normalizeApiSaleToInvoice(sale: SaleResponse): Invoice {
    return {
      id: sale.id,
      receiptNumber: sale.receipt_number || sale.invoice_number || sale.reference,
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
      clientName: sale.client_name || 'Passager',
      status: sale.status,
      synced: true,
      isLocal: false,
    };
  }

  // Normalisation d'une vente locale vers Invoice
  function normalizeLocalSaleToInvoice(sale: LocalSale): Invoice {
    return {
      id: sale.id,
      receiptNumber: sale.receiptNumber,
      items: sale.items.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        code: item.code,
      })),
      total: sale.total,
      paymentMethod: sale.paymentMethod,
      timestamp: sale.timestamp,
      cashierName: sale.cashierName,
      posName: sale.posName,
      sessionNumber: sale.sessionNumber,
      clientName: sale.clientName || 'Passager',
      status: sale.status,
      synced: sale.synced,
      isLocal: true,
    };
  }

  // Récupération et combinaison des factures
  const invoices = useMemo(() => {
    const apiInvoices = apiSales.map(normalizeApiSaleToInvoice);
    const localInvoices = localSales.map(normalizeLocalSaleToInvoice);
    
    // Combiner et trier par date décroissante
    const combined = [...localInvoices, ...apiInvoices];
    combined.sort((a, b) => b.timestamp - a.timestamp);
    
    return combined;
  }, [apiSales, localSales]);

  // Filtrage des factures
  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    if (filterDate) {
      result = result.filter((invoice) => {
        const invoiceDate = new Date(invoice.timestamp).toISOString().slice(0, 10);
        return invoiceDate === filterDate;
      });
    }

    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((invoice) => {
        const invoiceNumber = getInvoiceNumber(invoice).toLowerCase();
        const client = getClientName(invoice).toLowerCase();
        const cashier = getCashierName(invoice).toLowerCase();
        return (
          invoiceNumber.includes(term) ||
          client.includes(term) ||
          cashier.includes(term)
        );
      });
    }

    return result;
  }, [invoices, search, filterDate]);

  // Helpers d'affichage
  function getInvoiceNumber(invoice: Invoice): string {
    return invoice.receiptNumber || invoice.id.slice(0, 8) || 'N/A';
  }

  function getCashierName(invoice: Invoice): string {
    return invoice.cashierName || 'Caissier';
  }

  function getPosName(invoice: Invoice): string {
    return invoice.posName || 'POS-01';
  }

  function getClientName(invoice: Invoice): string {
    return invoice.clientName || 'Passager';
  }

  function getPaymentLabel(method: string): string {
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

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // Impression
  function printInvoice(invoice: Invoice) {
    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Facture #${getInvoiceNumber(invoice)}</title>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              background: white;
            }
            .invoice {
              max-width: 320px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px dashed #ccc;
              padding-bottom: 12px;
            }
            .header h2 {
              margin: 0 0 8px 0;
              font-size: 18px;
            }
            .meta {
              font-size: 11px;
              color: #666;
              margin: 2px 0;
            }
            .pending-badge {
              background: #f59e0b;
              color: white;
              padding: 2px 6px;
              border-radius: 4px;
              font-size: 10px;
              display: inline-block;
              margin-top: 8px;
            }
            .items {
              margin: 16px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 6px;
              font-size: 12px;
            }
            .item-name {
              flex: 1;
              word-break: break-word;
            }
            .total {
              font-weight: bold;
              border-top: 1px solid #000;
              padding-top: 8px;
              margin-top: 8px;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              color: #666;
              margin-top: 20px;
              border-top: 1px dashed #ccc;
              padding-top: 12px;
            }
            .payment {
              margin-top: 12px;
              text-align: center;
              font-size: 11px;
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <h2>GoApp Pharmacie</h2>
              <div class="meta">Facture #${getInvoiceNumber(invoice)}</div>
              <div class="meta">${formatDate(invoice.timestamp)}</div>
              <div class="meta">Caissier: ${getCashierName(invoice)}</div>
              <div class="meta">Caisse: ${getPosName(invoice)}</div>
              <div class="meta">Client: ${getClientName(invoice)}</div>
              ${!invoice.synced ? '<div class="pending-badge">En attente de synchronisation</div>' : ''}
            </div>

            <div class="items">
              ${invoice.items
                .map(
                  (item) => `
                    <div class="item">
                      <span class="item-name">${item.quantity} × ${escapeHtml(item.name)}</span>
                      <span>${(item.price * item.quantity).toFixed(2)} $</span>
                    </div>
                  `,
                )
                .join('')}
            </div>

            <div class="item total">
              <span>TOTAL</span>
              <span>${Number(invoice.total).toFixed(2)} $</span>
            </div>

            <div class="payment">
              Paiement: ${getPaymentLabel(invoice.paymentMethod)}
            </div>

            <div class="footer">
              Merci de votre visite<br />
              Retrouvez-nous sur GoApp
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  // Téléchargement
  function downloadInvoice(invoice: Invoice) {
    const content = `========================================
FACTURE #${getInvoiceNumber(invoice)}
========================================
Date: ${formatDate(invoice.timestamp)}
Caissier: ${getCashierName(invoice)}
Caisse: ${getPosName(invoice)}
Client: ${getClientName(invoice)}
Paiement: ${getPaymentLabel(invoice.paymentMethod)}
${!invoice.synced ? 'STATUT: En attente de synchronisation\n' : ''}
----------------------------------------
ARTICLES:
${invoice.items
  .map((item) => `  ${item.quantity} x ${item.name} = ${(item.quantity * item.price).toFixed(2)} $`)
  .join('\n')}
----------------------------------------
TOTAL: ${Number(invoice.total).toFixed(2)} $
========================================
Merci de votre visite
    `;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facture-${getInvoiceNumber(invoice)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Helper pour échapper le HTML
  function escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const isLoading = loading || storeLoading;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Bannière de synchronisation */}
      {pendingCount > 0 && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
          <div className="flex items-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            {pendingCount} facture(s) en attente de synchronisation
          </div>
          <button
            onClick={handleRetryFailed}
            className="rounded-lg bg-white/20 px-3 py-1 text-xs hover:bg-white/30"
          >
            Réessayer
          </button>
        </div>
      )}

      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/pos"
              className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 md:text-2xl">Gestion des factures</h1>
              <p className="text-sm text-slate-400">Historique des ventes et impressions</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              'Actualiser'
            )}
          </button>
        </div>
      </header>

      <main className="p-4 md:p-6">
        {/* Filtres */}
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
            <input
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-12 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Rechercher par numéro, client, caissier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Calendar className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              onClick={() => {
                setSearch('');
                setFilterDate('');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Filter size={18} />
              Réinitialiser
            </button>
          </div>
        </div>

        {/* Liste des factures */}
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 p-4 md:p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-800">
              <FileText size={20} className="text-blue-600" />
              Historique des factures
            </h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-600">
              {filteredInvoices.length} facture(s)
            </span>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-10 text-slate-400">
              <Loader2 className="mr-2 animate-spin" size={20} />
              Chargement...
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-10 text-center text-slate-400">Aucune facture trouvée</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInvoices.map((invoice) => (
                <div key={`${invoice.isLocal ? 'local-' : 'api-'}${invoice.id}`} className="p-4 transition-colors hover:bg-slate-50 md:p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-600">
                          #{getInvoiceNumber(invoice)}
                        </span>

                        {!invoice.synced && (
                          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                            <Loader2 size={10} className="mr-1 inline animate-spin" />
                            En attente
                          </span>
                        )}

                        {invoice.isLocal && invoice.synced && (
                          <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
                            Synchronisé
                          </span>
                        )}

                        {invoice.status && invoice.status !== 'completed' && (
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              invoice.status === 'cancelled'
                                ? 'bg-red-100 text-red-700'
                                : invoice.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {invoice.status === 'cancelled'
                              ? 'Annulée'
                              : invoice.status === 'pending'
                                ? 'En attente'
                                : 'Terminée'}
                          </span>
                        )}

                        <span className="text-sm text-slate-400">{formatDate(invoice.timestamp)}</span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <p className="text-xs text-slate-400">Client</p>
                          <p className="font-semibold text-slate-800">{getClientName(invoice)}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Caissier</p>
                          <p className="font-semibold text-slate-800">{getCashierName(invoice)}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Articles</p>
                          <p className="font-semibold text-slate-800">{invoice.items.length}</p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Total</p>
                          <p className="text-lg font-black text-blue-600">{Number(invoice.total).toFixed(2)} $</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        onClick={() => setSelectedInvoice(invoice)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Voir détails"
                      >
                        <Eye size={18} />
                      </button>

                      <button
                        onClick={() => printInvoice(invoice)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Imprimer"
                      >
                        <Printer size={18} />
                      </button>

                      <button
                        onClick={() => downloadInvoice(invoice)}
                        className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        title="Télécharger"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Modal de détails */}
      {selectedInvoice && (
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
                      Détails facture #{getInvoiceNumber(selectedInvoice)}
                    </h3>
                    <p className="text-sm text-slate-400">{formatDate(selectedInvoice.timestamp)}</p>
                    {!selectedInvoice.synced && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                        <Loader2 size={10} className="animate-spin" />
                        En attente de synchronisation
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 md:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Client</p>
                  <p className="font-bold text-slate-800">{getClientName(selectedInvoice)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Caissier</p>
                  <p className="font-bold text-slate-800">{getCashierName(selectedInvoice)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Paiement</p>
                  <p className="font-bold text-slate-800">{getPaymentLabel(selectedInvoice.paymentMethod)}</p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-400">Caisse</p>
                  <p className="font-bold text-slate-800">{getPosName(selectedInvoice)}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-100">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <h4 className="font-bold text-slate-800">Articles</h4>
                </div>

                <div className="divide-y divide-slate-100">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={`${item.id || idx}`} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          {item.quantity} × {Number(item.price).toFixed(2)} $
                          {item.code ? ` · ${item.code}` : ''}
                        </p>
                      </div>

                      <p className="shrink-0 font-bold text-blue-600">
                        {(Number(item.price) * Number(item.quantity)).toFixed(2)} $
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 p-4">
                <div className="flex items-center justify-between text-lg font-black">
                  <span>Total</span>
                  <span className="text-blue-600">{Number(selectedInvoice.total).toFixed(2)} $</span>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  onClick={() => printInvoice(selectedInvoice)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700"
                >
                  <Printer size={18} />
                  Imprimer
                </button>

                <button
                  onClick={() => downloadInvoice(selectedInvoice)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Download size={18} />
                  Télécharger
                </button>

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700 hover:bg-slate-50"
                >
                  <X size={18} />
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}