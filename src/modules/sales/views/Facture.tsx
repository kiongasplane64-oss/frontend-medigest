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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '@/db/offlineDb';

interface InvoiceItem {
  productId?: string;
  quantity: number;
  price: number;
  name: string;
  barcode?: string;
  code?: string;
}

interface Invoice {
  id?: string;
  localId?: number;
  items: InvoiceItem[];
  total: number;
  paymentMethod: 'cash' | 'mobile' | 'account' | string;
  timestamp: number;
  cashierId?: string;
  cashierName?: string;
  posId?: string;
  posName?: string;
  sessionId?: string;
  receiptNumber?: string;
  clientType?: string;
  synced?: boolean;
  status?: 'pending' | 'synced' | 'failed';
}

export default function Facture() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [filterDate, setFilterDate] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadInvoices();
  }, []);

  async function loadInvoices() {
    setLoading(true);
    try {
      const localInvoices = await db.sales.toArray();
      const normalized = (localInvoices as Invoice[]).sort(
        (a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0),
      );
      setInvoices(normalized);
    } catch (error) {
      console.error('Erreur chargement factures:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }

  function getInvoiceNumber(invoice: Invoice): string {
    return String(invoice.receiptNumber || invoice.id || invoice.localId || 'N/A');
  }

  function getCashierName(invoice: Invoice): string {
    return invoice.cashierName || 'Caissier';
  }

  function getPosName(invoice: Invoice): string {
    return invoice.posName || invoice.posId || 'POS-01';
  }

  function getClientName(invoice: Invoice): string {
    return invoice.clientType || 'Passager';
  }

  function getPaymentLabel(method: string): string {
    switch (method) {
      case 'cash':
        return 'Espèces';
      case 'mobile':
        return 'Mobile Money';
      case 'account':
        return 'Compte Client';
      default:
        return method || 'Non défini';
    }
  }

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
        const receipt = String(invoice.receiptNumber || '').toLowerCase();

        return (
          invoiceNumber.includes(term) ||
          client.includes(term) ||
          cashier.includes(term) ||
          receipt.includes(term)
        );
      });
    }

    return result;
  }, [invoices, search, filterDate]);

  function printInvoice(invoice: Invoice) {
    const printWindow = window.open('', '_blank', 'width=420,height=720');

    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Facture #${getInvoiceNumber(invoice)}</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #0f172a;
            }
            .invoice {
              max-width: 320px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 1px dashed #cbd5e1;
              padding-bottom: 12px;
            }
            .header h2 {
              margin: 0 0 8px 0;
            }
            .meta {
              font-size: 12px;
              color: #475569;
              margin: 2px 0;
            }
            .items {
              margin: 20px 0;
            }
            .item {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 8px;
              font-size: 13px;
            }
            .item-name {
              flex: 1;
            }
            .total {
              font-weight: bold;
              border-top: 1px solid #0f172a;
              padding-top: 10px;
              margin-top: 10px;
            }
            .footer {
              text-align: center;
              font-size: 12px;
              color: #475569;
              margin-top: 24px;
            }
          </style>
        </head>
        <body>
          <div class="invoice">
            <div class="header">
              <h2>GoApp</h2>
              <div class="meta">Facture #${getInvoiceNumber(invoice)}</div>
              <div class="meta">${new Date(invoice.timestamp).toLocaleString('fr-FR')}</div>
              <div class="meta">Caissier: ${getCashierName(invoice)}</div>
              <div class="meta">Caisse: ${getPosName(invoice)}</div>
              <div class="meta">Client: ${getClientName(invoice)}</div>
            </div>

            <div class="items">
              ${invoice.items
                .map(
                  (item) => `
                    <div class="item">
                      <span class="item-name">${item.quantity} × ${item.name}</span>
                      <span>${(item.price * item.quantity).toFixed(2)} $</span>
                    </div>
                  `,
                )
                .join('')}
            </div>

            <div class="item total">
              <span>Total</span>
              <span>${Number(invoice.total).toFixed(2)} $</span>
            </div>

            <div class="footer">
              Paiement: ${getPaymentLabel(invoice.paymentMethod)}
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

  function downloadInvoice(invoice: Invoice) {
    const content = `
FACTURE #${getInvoiceNumber(invoice)}
Date: ${new Date(invoice.timestamp).toLocaleString('fr-FR')}
Caissier: ${getCashierName(invoice)}
Caisse: ${getPosName(invoice)}
Client: ${getClientName(invoice)}
Paiement: ${getPaymentLabel(invoice.paymentMethod)}

Articles:
${invoice.items
  .map((item) => `- ${item.quantity} x ${item.name} = ${(item.quantity * item.price).toFixed(2)} $`)
  .join('\n')}

TOTAL: ${Number(invoice.total).toFixed(2)} $
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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link
            to="/pos"
            className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-black text-slate-800 md:text-2xl">
              Gestion des factures
            </h1>
            <p className="text-sm text-slate-400">
              Historique des ventes et impressions
            </p>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
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

          {loading ? (
            <div className="p-10 text-center text-slate-400">Chargement...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              Aucune facture trouvée
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredInvoices.map((invoice) => (
                <div
                  key={`${invoice.localId || ''}-${invoice.id || ''}-${invoice.timestamp}`}
                  className="p-4 transition-colors hover:bg-slate-50 md:p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-600">
                          #{getInvoiceNumber(invoice)}
                        </span>

                        {invoice.status && (
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                              invoice.status === 'synced'
                                ? 'bg-emerald-100 text-emerald-700'
                                : invoice.status === 'failed'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {invoice.status === 'synced'
                              ? 'Synchronisée'
                              : invoice.status === 'failed'
                                ? 'Échec sync'
                                : 'En attente'}
                          </span>
                        )}

                        <span className="text-sm text-slate-400">
                          {new Date(invoice.timestamp).toLocaleString('fr-FR')}
                        </span>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                        <div>
                          <p className="text-xs text-slate-400">Client</p>
                          <p className="font-semibold text-slate-800">
                            {getClientName(invoice)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Caissier</p>
                          <p className="font-semibold text-slate-800">
                            {getCashierName(invoice)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Caisse</p>
                          <p className="font-semibold text-slate-800">
                            {getPosName(invoice)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Articles</p>
                          <p className="font-semibold text-slate-800">
                            {invoice.items.length}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">Total</p>
                          <p className="text-lg font-black text-blue-600">
                            {Number(invoice.total).toFixed(2)} $
                          </p>
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
                    <p className="text-sm text-slate-400">
                      {new Date(selectedInvoice.timestamp).toLocaleString('fr-FR')}
                    </p>
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
                  <p className="font-bold text-slate-800">
                    {getPaymentLabel(selectedInvoice.paymentMethod)}
                  </p>
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
                    <div
                      key={`${item.productId || item.code || idx}`}
                      className="flex items-center justify-between gap-4 px-4 py-3"
                    >
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
                  <span className="text-blue-600">
                    {Number(selectedInvoice.total).toFixed(2)} $
                  </span>
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