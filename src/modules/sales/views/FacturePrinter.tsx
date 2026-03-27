// components/FacturePrinter.tsx
import React, { useRef, useEffect, useState } from 'react';
import { formatDate, formatDateTime } from '@/utils/formatters';
import { Printer, Download, QrCode } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import QRCode from 'qrcode';

interface Product {
  id: string;
  name: string;
  price: number;      // Prix unitaire
  quantity: number;
  code?: string;
}

interface Sale {
  id: string;
  receiptNumber?: string;
  items: Product[];
  total: number;
  paymentMethod: string;
  timestamp: number;
  cashierName: string;
  posName: string;
  sessionNumber: string;
  clientName?: string;
}

interface PharmacyInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
  logoUrl?: string;
}

interface InvoiceConfig {
  autoPrint: boolean;
  autoSave: boolean;
  fontSize: number;
}

interface CurrencyConfig {
  code: string;
  symbol: string;
  exchangeRate: number;
}

interface FacturePrinterProps {
  sale: Sale;
  pharmacyInfo: PharmacyInfo;
  invoiceConfig: InvoiceConfig;
  primaryCurrency: string;
  currencies: CurrencyConfig[];
  onClose: () => void;
  onPrint?: () => void;
}

export const FacturePrinter: React.FC<FacturePrinterProps> = ({
  sale,
  pharmacyInfo,
  invoiceConfig,
  primaryCurrency,
  currencies,
  onClose,
  onPrint
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [showQrCode, setShowQrCode] = useState<boolean>(true);

  // Générer le QR code avec les détails de la facture
  useEffect(() => {
    const generateQRCode = async () => {
      const invoiceData = {
        invoiceNumber: sale.receiptNumber || sale.id,
        date: new Date(sale.timestamp).toISOString(),
        pharmacy: {
          name: pharmacyInfo.name,
          license: pharmacyInfo.licenseNumber,
          phone: pharmacyInfo.phone,
          address: pharmacyInfo.address,
          email: pharmacyInfo.email
        },
        cashier: sale.cashierName,
        pos: sale.posName,
        session: sale.sessionNumber,
        client: sale.clientName || 'Passager',
        items: sale.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
          code: item.code
        })),
        subtotal: sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        total: sale.total,
        paymentMethod: sale.paymentMethod,
        currency: primaryCurrency,
        timestamp: sale.timestamp
      };

      try {
        const qrData = JSON.stringify(invoiceData);
        const qrUrl = await QRCode.toDataURL(qrData, {
          width: 150,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          },
          errorCorrectionLevel: 'M'
        });
        setQrCodeDataUrl(qrUrl);
      } catch (error) {
        console.error('Erreur génération QR code:', error);
      }
    };

    generateQRCode();
  }, [sale, pharmacyInfo, primaryCurrency]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) return;

    const styles = `
      <style>
        @media print {
          @page {
            margin: 0;
            size: 80mm auto;
          }
          body {
            margin: 0;
            padding: 8px;
            font-family: monospace;
            font-size: ${invoiceConfig.fontSize}px;
          }
          .print-container {
            width: 80mm;
            margin: 0 auto;
          }
          .no-break {
            break-inside: avoid;
          }
          .qr-code {
            display: block;
            margin: 10px auto;
          }
        }
      </style>
    `;

    const content = printContent.cloneNode(true) as HTMLElement;
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Facture #${sale.receiptNumber || sale.id}</title>
          ${styles}
          <meta charset="UTF-8">
        </head>
        <body>
          ${content.outerHTML}
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();

    if (onPrint) onPrint();
  };

  const handleExportPDF = async () => {
    if (!receiptRef.current) return;
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait'
      });
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`facture-${sale.receiptNumber || sale.id}.pdf`);
    } catch (error) {
      console.error('Erreur export PDF:', error);
    }
  };

  const displayPrice = (price: number, currencyCode: string = primaryCurrency): string => {
    const currency = currencies.find(c => c.code === currencyCode);
    if (!currency) return `${price.toFixed(2)} ${currencyCode}`;
    
    const convertedPrice = price / currency.exchangeRate;
    return `${currency.symbol} ${convertedPrice.toFixed(2)}`;
  };

  const getPaymentMethodLabel = (method: string): string => {
    switch (method) {
      case 'cash': return 'Espèces';
      case 'mobile_money': return 'Mobile Money';
      case 'account': return 'Compte Client';
      default: return method;
    }
  };

  const ReceiptContent = () => (
    <div 
      ref={printRef}
      className="print-container"
      style={{ 
        fontFamily: 'monospace',
        fontSize: `${invoiceConfig.fontSize}px`,
        maxWidth: '80mm',
        margin: '0 auto',
        padding: '8px',
        backgroundColor: '#ffffff'
      }}
    >
      {/* En-tête de la facture */}
      <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
        {pharmacyInfo.logoUrl && (
          <img 
            src={pharmacyInfo.logoUrl} 
            alt="Logo" 
            className="mx-auto mb-2"
            style={{ maxWidth: '60px', maxHeight: '60px' }}
          />
        )}
        <h2 className="font-bold text-lg">{pharmacyInfo.name}</h2>
        <p className="text-xs">{pharmacyInfo.address}</p>
        <p className="text-xs">Tel: {pharmacyInfo.phone}</p>
        {pharmacyInfo.email && <p className="text-xs">{pharmacyInfo.email}</p>}
        <p className="text-xs">N° Licence: {pharmacyInfo.licenseNumber}</p>
        <div className="mt-2">
          <p className="font-bold">FACTURE</p>
          <p className="text-xs">N°: {sale.receiptNumber || sale.id}</p>
          <p className="text-xs">Date: {formatDateTime(sale.timestamp)}</p>
        </div>
      </div>

      {/* QR Code */}
      {qrCodeDataUrl && showQrCode && (
        <div className="flex flex-col items-center justify-center my-3">
          <div className="relative">
            <img 
              src={qrCodeDataUrl} 
              alt="QR Code facture" 
              className="qr-code"
              style={{ width: '70px', height: '70px' }}
            />
          </div>
          <p className="text-[8px] text-gray-400 mt-1">Scannez pour les détails</p>
        </div>
      )}

      {/* Bouton pour masquer/afficher le QR code */}
      <div className="flex justify-end mb-2 print:hidden">
        <button
          onClick={() => setShowQrCode(!showQrCode)}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <QrCode size={12} />
          {showQrCode ? 'Masquer QR' : 'Afficher QR'}
        </button>
      </div>

      {/* Informations vente */}
      <div className="mb-3 text-xs">
        <p>Caissier: {sale.cashierName}</p>
        <p>Caisse: {sale.posName}</p>
        <p>Session: {sale.sessionNumber}</p>
        {sale.clientName && <p>Client: {sale.clientName}</p>}
      </div>

      {/* Ligne de séparation */}
      <div className="border-t border-dashed border-gray-300 my-2"></div>

      {/* Articles */}
      <div className="mb-3">
        <div className="grid grid-cols-12 gap-1 text-xs font-bold mb-2">
          <span className="col-span-6">Article</span>
          <span className="col-span-2 text-center">Qté</span>
          <span className="col-span-2 text-right">Prix</span>
          <span className="col-span-2 text-right">Total</span>
        </div>
        
        {sale.items.map((item, index) => (
          <div key={index} className="grid grid-cols-12 gap-1 text-xs mb-1">
            <span className="col-span-6 truncate">{item.name}</span>
            <span className="col-span-2 text-center">{item.quantity}</span>
            <span className="col-span-2 text-right">{displayPrice(item.price)}</span>
            <span className="col-span-2 text-right">{displayPrice(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Ligne de séparation */}
      <div className="border-t border-dashed border-gray-300 my-2"></div>

      {/* Sous-total */}
      <div className="flex justify-between text-xs mb-1">
        <span>Sous-total</span>
        <span>{displayPrice(sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0))}</span>
      </div>

      {/* Total */}
      <div className="flex justify-between font-bold text-base mb-2">
        <span>TOTAL</span>
        <span>{displayPrice(sale.total)}</span>
      </div>

      {/* Paiement */}
      <div className="text-xs mb-3">
        <p>Paiement: {getPaymentMethodLabel(sale.paymentMethod)}</p>
      </div>

      {/* Pied de page */}
      <div className="text-center text-xs border-t border-dashed border-gray-300 pt-3 mt-3">
        <p>Merci de votre visite !</p>
        <p>Retour possible sous 30 jours</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white shadow-2xl">
        {/* En-tête modal */}
        <div className="border-b border-slate-100 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                <QrCode size={20} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">
                  Facture #{sale.receiptNumber || sale.id}
                </h3>
                <p className="text-sm text-slate-400">
                  {formatDate(sale.timestamp)} à {new Date(sale.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Contenu facture */}
        <div ref={receiptRef}>
          <ReceiptContent />
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-5">
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 transition-colors"
          >
            <Printer size={18} />
            Imprimer
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Download size={18} />
            PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default FacturePrinter;