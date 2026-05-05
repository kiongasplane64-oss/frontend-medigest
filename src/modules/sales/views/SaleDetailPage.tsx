// SaleDetailPage.tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Download,
  User,
  Store,
  CreditCard,
  Clock,
  Package,
  TrendingUp,
  Receipt,
  Loader2,
  Eye,
} from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useToast } from '@/hooks/useToast';
import api from '@/api/client';
import type { SaleResponse, SaleItemResponse } from '@/services/saleService';

interface ProductWithCost {
  id: string;
  name: string;
  code: string;
  purchase_price: number;
  selling_price: number;
}

interface SaleDetailWithProfit extends SaleResponse {
  itemsWithProfit?: Array<SaleItemResponse & {
    purchase_price: number;
    profit: number;
    profit_margin: number;
  }>;
  total_profit: number;
  total_margin_percent: number;
}

const formatPrice = (price: number): string => {
  return price.toFixed(2) + ' FC';
};

const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getPaymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'cash': return 'Espèces';
    case 'mobile_money': case 'mobile': return 'Mobile Money';
    case 'credit': return 'Crédit';
    case 'account': return 'Compte Client';
    default: return method || 'Non défini';
  }
};

const getPaymentMethodColor = (method: string): string => {
  switch (method) {
    case 'cash': return 'bg-emerald-100 text-emerald-700';
    case 'mobile_money': case 'mobile': return 'bg-blue-100 text-blue-700';
    case 'credit': return 'bg-amber-100 text-amber-700';
    case 'account': return 'bg-violet-100 text-violet-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'completed': return 'Terminée';
    case 'pending': return 'En attente';
    case 'cancelled': return 'Annulée';
    default: return status;
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-700';
    case 'pending': return 'bg-yellow-100 text-yellow-700';
    case 'cancelled': return 'bg-red-100 text-red-700';
    default: return 'bg-slate-100 text-slate-700';
  }
};

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { toast } = useToast();
  
  const [sale, setSale] = useState<SaleDetailWithProfit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productsCost, setProductsCost] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (id) {
      loadSaleDetails();
    }
  }, [id]);

  const loadSaleDetails = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Récupérer la vente
      const response = await api.get(`/sales/${id}`);
      const saleData = response.data as SaleResponse;
      
      // Récupérer les prix d'achat des produits
      const productIds = saleData.items.map(item => item.product_id).filter(Boolean);
      const costMap = new Map<string, number>();
      
      if (productIds.length > 0) {
        try {
          // Récupérer les produits avec leurs prix d'achat
          const productsResponse = await api.post('/products/batch', {
            product_ids: productIds,
            fields: ['id', 'purchase_price', 'selling_price', 'name', 'code']
          });
          
          const products = productsResponse.data?.data || productsResponse.data || [];
          if (Array.isArray(products)) {
            products.forEach((product: ProductWithCost) => {
              costMap.set(product.id, product.purchase_price || 0);
            });
          }
        } catch (err) {
          console.warn('Impossible de récupérer les prix d\'achat:', err);
          // Continuer sans les bénéfices
        }
      }
      
      setProductsCost(costMap);
      
      // Calculer les bénéfices
      const itemsWithProfit = saleData.items.map(item => {
        const purchasePrice = costMap.get(item.product_id) || 0;
        const sellingPrice = item.unit_price || 0;
        const quantity = item.quantity || 0;
        const profit = (sellingPrice - purchasePrice) * quantity;
        const profitMargin = sellingPrice > 0 ? ((sellingPrice - purchasePrice) / sellingPrice) * 100 : 0;
        
        return {
          ...item,
          purchase_price: purchasePrice,
          profit,
          profit_margin: profitMargin,
        };
      });
      
      const totalProfit = itemsWithProfit.reduce((sum, item) => sum + item.profit, 0);
      const totalAmount = saleData.total_amount || 0;
      const totalMarginPercent = totalAmount > 0 ? (totalProfit / totalAmount) * 100 : 0;
      
      setSale({
        ...saleData,
        itemsWithProfit,
        total_profit: totalProfit,
        total_margin_percent: totalMarginPercent,
      });
      
    } catch (err: any) {
      console.error('Erreur chargement détails:', err);
      setError(err.response?.data?.detail || 'Erreur lors du chargement des détails');
      toast({
        title: "Erreur",
        description: "Impossible de charger les détails de la vente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const printSale = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Vente #${sale?.reference || id}</title>
          <meta charset="UTF-8" />
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Courier New', monospace; padding: 20px; background: white; }
            .container { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 16px; margin-bottom: 20px; }
            .header h1 { margin-bottom: 8px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px; }
            .info-item { border-bottom: 1px solid #ccc; padding: 8px 0; }
            .info-label { font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total-row { font-weight: bold; border-top: 2px solid #000; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>GoApp Pharmacie</h1>
              <h2>Facture #${sale?.reference || id}</h2>
              <p>${sale ? formatDateTime(sale.created_at) : ''}</p>
            </div>
            
            <div class="info-grid">
              <div class="info-item"><span class="info-label">Caissier:</span> ${sale?.seller_name || user?.nom_complet || 'N/A'}</div>
              <div class="info-item"><span class="info-label">Client:</span> ${sale?.customer_name || 'Passager'}</div>
              <div class="info-item"><span class="info-label">Paiement:</span> ${getPaymentMethodLabel(sale?.payment_method || '')}</div>
              <div class="info-item"><span class="info-label">Statut:</span> ${getStatusLabel(sale?.status || '')}</div>
            </div>
            
            <table>
              <thead>
                <tr><th>Produit</th><th>Qté</th><th>Prix unitaire</th><th>Total</th></tr>
              </thead>
              <tbody>
                ${sale?.items.map(item => `
                  <tr>
                    <td>${item.product_name}</td>
                    <td>${item.quantity}</td>
                    <td>${formatPrice(item.unit_price)}</td>
                    <td>${formatPrice(item.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div style="text-align: right; margin-top: 20px;">
              <p>Sous-total: ${formatPrice(sale?.subtotal || 0)}</p>
              <p>TVA: ${formatPrice(sale?.total_tva || 0)}</p>
              <p style="font-size: 18px; font-weight: bold;">Total: ${formatPrice(sale?.total_amount || 0)}</p>
            </div>
            
            <div class="footer">
              <p>Merci de votre visite !</p>
            </div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportToCSV = () => {
    if (!sale) return;
    
    const headers = ['Produit', 'Code', 'Quantité', 'Prix unitaire', 'Prix d\'achat', 'Bénéfice unitaire', 'Total HT', 'TVA', 'Total TTC', 'Bénéfice total'];
    
    const rows = sale.itemsWithProfit?.map(item => [
      item.product_name,
      item.product_code || '',
      item.quantity,
      item.unit_price,
      item.purchase_price,
      (item.unit_price - item.purchase_price).toFixed(2),
      item.subtotal,
      item.tva_amount,
      item.total,
      item.profit.toFixed(2),
    ]) || [];
    
    const escapeCell = (value: any) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vente_${sale.reference}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Export réussi", description: "Le fichier CSV a été téléchargé" });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
          <p className="text-slate-500">Chargement des détails...</p>
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-4xl">
          <Link to="/historique" className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-slate-600 shadow-sm hover:bg-slate-50">
            <ArrowLeft size={18} /> Retour à l'historique
          </Link>
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-800">Vente non trouvée</h2>
            <p className="text-slate-500">{error || "La vente que vous recherchez n'existe pas ou a été supprimée."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/historique" className="rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 md:text-2xl">Détail de la vente</h1>
              <p className="text-sm text-slate-400">Référence: {sale.reference} | Facture: {sale.invoice_number || 'N/A'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={printSale} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
              <Printer size={18} /> Imprimer
            </button>
            <button onClick={exportToCSV} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              <Download size={18} /> Exporter CSV
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          {/* Informations générales */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100"><User size={18} className="text-blue-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Vendeur / Caissier</p>
                  <p className="font-bold text-slate-800">{sale.seller_name || user?.nom_complet || 'N/A'}</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100"><Clock size={18} className="text-emerald-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Date et heure</p>
                  <p className="font-bold text-slate-800">{formatDate(sale.created_at)}</p>
                  <p className="text-xs text-slate-500">{formatTime(sale.created_at)}</p>
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100"><Store size={18} className="text-violet-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Client</p>
                  <p className="font-bold text-slate-800">{sale.customer_name || 'Passager'}</p>
                  {sale.customer_phone && <p className="text-xs text-slate-500">{sale.customer_phone}</p>}
                </div>
              </div>
            </div>
            
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100"><CreditCard size={18} className="text-amber-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Paiement</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${getPaymentMethodColor(sale.payment_method)}`}>
                    {getPaymentMethodLabel(sale.payment_method)}
                  </span>
                  {sale.is_credit && <p className="text-xs text-amber-600">Crédit</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Tableau des produits vendus */}
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h2 className="flex items-center gap-2 font-bold text-slate-800">
                <Package size={18} className="text-blue-600" />
                Produits vendus
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Produit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Qté</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Prix unitaire</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Prix achat</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Bénéfice unitaire</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Total HT</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">TVA</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Total TTC</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Bénéfice total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sale.itemsWithProfit?.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{item.product_name}</p>
                        <p className="text-xs text-slate-400">{item.product_code}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">{formatPrice(item.unit_price)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatPrice(item.purchase_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${item.unit_price - item.purchase_price > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPrice(item.unit_price - item.purchase_price)}
                        </span>
                        <span className="ml-1 text-xs text-slate-400">({item.profit_margin.toFixed(1)}%)</span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatPrice(item.subtotal)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{formatPrice(item.tva_amount)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-600">{formatPrice(item.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${item.profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPrice(item.profit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-800">Totaux</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatPrice(sale.subtotal)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatPrice(sale.total_tva)}</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-600">{formatPrice(sale.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${sale.total_profit > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatPrice(sale.total_profit)}
                      </span>
                      <span className="ml-1 text-xs text-slate-400">({sale.total_margin_percent.toFixed(1)}%)</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Résumé supplémentaire */}
            <div className="border-t border-slate-100 bg-slate-50/50 p-5">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-400">Sous-total</p>
                  <p className="text-lg font-bold text-slate-800">{formatPrice(sale.subtotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Remise globale</p>
                  <p className="text-lg font-bold text-slate-800">{formatPrice(sale.total_discount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">TVA totale</p>
                  <p className="text-lg font-bold text-slate-800">{formatPrice(sale.total_tva)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Total TTC</p>
                  <p className="text-lg font-bold text-blue-600">{formatPrice(sale.total_amount)}</p>
                </div>
              </div>
            </div>

            {/* Notes si présentes */}
            {sale.notes && (
              <div className="border-t border-slate-100 p-5">
                <p className="text-xs text-slate-400">Notes</p>
                <p className="text-sm text-slate-600">{sale.notes}</p>
              </div>
            )}
          </div>

          {/* Informations de crédit si applicable */}
          {sale.is_credit && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-amber-100 bg-amber-50 shadow-sm">
              <div className="p-5">
                <h3 className="mb-3 font-bold text-amber-800">Informations de crédit</h3>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-amber-600">Date d'échéance</p>
                    <p className="font-semibold text-amber-800">{sale.credit_due_date ? new Date(sale.credit_due_date).toLocaleDateString('fr-FR') : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600">Dépôt de garantie</p>
                    <p className="font-semibold text-amber-800">{formatPrice(sale.guarantee_deposit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600">Garant</p>
                    <p className="font-semibold text-amber-800">{sale.guarantor_name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-600">Tél. garant</p>
                    <p className="font-semibold text-amber-800">{sale.guarantor_phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}