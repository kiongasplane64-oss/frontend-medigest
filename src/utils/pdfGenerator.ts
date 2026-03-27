/**
 * ===================================================================
 * GÉNÉRATEUR DE PDF - Utilitaires pour l'export de rapports
 * ===================================================================
 *
 * Version réécrite et corrigée :
 * - TypeScript strict
 * - Guards de types robustes
 * - Compatible jsPDF + jspdf-autotable
 * - Plus de dépendance fragile à getNumberOfPages()
 * - Gestion propre de lastAutoTable
 * - Aucune erreur de type sur body: RowInput[]
 */

import jsPDF from 'jspdf';
import autoTable, { type RowInput } from 'jspdf-autotable';

// ===================================================================
// TYPES
// ===================================================================

export interface PDFData {
  type: string;
  data: unknown;
  userName: string;
  pharmacyName: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  pharmacyEmail?: string;
  date?: Date;
}

export interface PDFOptions {
  title?: string;
  subtitle?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  theme?: 'light' | 'dark';
}

interface AlertItem {
  product_name: string;
  current_stock: number;
  threshold: number;
  severity: 'high' | 'medium' | 'low';
  message?: string;
}

interface NeverSoldProduct {
  name: string;
  code: string;
  quantity: number;
  category: string;
  stock_value: number;
  days_in_stock: number;
}

interface UserSales {
  user_id: string;
  user_name: string;
  user_role: string;
  sales_count: number;
  total_amount: number;
  average_basket: number;
  percentage: number;
}

interface DailyProfitSummary {
  total_sales: number;
  total_cost: number;
  gross_profit: number;
  net_profit: number;
  profit_margin: number;
  sales_count: number;
}

interface DailyProfitSale {
  sale_id: string;
  reference: string;
  profit: number;
}

interface DailyProfitData {
  date: string;
  summary: DailyProfitSummary;
  sales: DailyProfitSale[];
}

interface SalesDashboardData {
  daily_sales: number;
  sales_trend: number;
  monthly_sales: number;
  total_stock_value: number;
  total_products: number;
  total_customers: number;
  net_profit: number;
  potential_profit: number;
}

interface SalesByUserData {
  users: UserSales[];
  summary?: {
    total_sales_count: number;
    total_amount: number;
  };
}

interface NeverSoldData {
  products: NeverSoldProduct[];
  total_count: number;
  total_value: number;
}

interface PerformanceData {
  turnover_rate: number;
  average_cart: number;
  conversion_rate: number;
  customer_satisfaction: number;
  employee_productivity: number;
}

type InternalPageSize = {
  getWidth?: () => number;
  getHeight?: () => number;
};

type InternalDoc = {
  getNumberOfPages?: () => number;
  pages?: unknown[];
  pageSize?: InternalPageSize;
};

type AutoTableCapableDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
  getNumberOfPages?: () => number;
  internal?: InternalDoc;
};

// ===================================================================
// HELPERS DE TYPES
// ===================================================================

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
};

const toStringSafe = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
};

const getFinalY = (doc: AutoTableCapableDoc, fallback: number): number => {
  return typeof doc.lastAutoTable?.finalY === 'number'
    ? doc.lastAutoTable.finalY
    : fallback;
};

const getPageCount = (doc: AutoTableCapableDoc): number => {
  if (typeof doc.getNumberOfPages === 'function') {
    return doc.getNumberOfPages();
  }

  if (typeof doc.internal?.getNumberOfPages === 'function') {
    return doc.internal.getNumberOfPages();
  }

  if (Array.isArray(doc.internal?.pages)) {
    return Math.max(1, doc.internal.pages.length - 1);
  }

  return 1;
};

const getPageWidth = (doc: AutoTableCapableDoc): number => {
  return doc.internal?.pageSize?.getWidth?.() ?? 210;
};

const getPageHeight = (doc: AutoTableCapableDoc): number => {
  return doc.internal?.pageSize?.getHeight?.() ?? 297;
};

// ===================================================================
// FORMATAGE
// ===================================================================

export const formatPDFDate = (date: Date): string => {
  return (
    date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }) +
    ' ' +
    date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  );
};

export const formatCurrencyPDF = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'XAF',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const slugify = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// ===================================================================
// MISE EN PAGE PDF
// ===================================================================

const addHeader = (
  doc: AutoTableCapableDoc,
  pharmacyName: string,
  title: string,
  date: string
): void => {
  const pageWidth = getPageWidth(doc);

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, pageWidth, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('MédiGest', pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(title, pageWidth / 2, 28, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(`Pharmacie : ${pharmacyName}`, 20, 50);
  doc.text(`Généré le : ${date}`, 20, 57);
};

const addFooter = (
  doc: AutoTableCapableDoc,
  pharmacyName: string,
  pageCount: number
): void => {
  const pageWidth = getPageWidth(doc);
  const pageHeight = getPageHeight(doc);

  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Document généré par MédiGest - ${pharmacyName} - Page ${i} sur ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }
};

const addPharmacyInfo = (
  doc: AutoTableCapableDoc,
  userName: string,
  pharmacyAddress?: string,
  pharmacyPhone?: string,
  pharmacyEmail?: string,
  startY = 65
): number => {
  let currentY = startY;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);

  if (pharmacyAddress) {
    doc.text(`Adresse : ${pharmacyAddress}`, 20, currentY);
    currentY += 7;
  }

  if (pharmacyPhone) {
    doc.text(`Téléphone : ${pharmacyPhone}`, 20, currentY);
    currentY += 7;
  }

  if (pharmacyEmail) {
    doc.text(`Email : ${pharmacyEmail}`, 20, currentY);
    currentY += 7;
  }

  doc.text(`Utilisateur : ${userName}`, 20, currentY);
  currentY += 10;

  return currentY;
};

// ===================================================================
// EXTRACTION DES DONNÉES
// ===================================================================

const extractSalesDashboardData = (data: unknown): SalesDashboardData => {
  if (!isRecord(data)) {
    return {
      daily_sales: 0,
      sales_trend: 0,
      monthly_sales: 0,
      total_stock_value: 0,
      total_products: 0,
      total_customers: 0,
      net_profit: 0,
      potential_profit: 0,
    };
  }

  return {
    daily_sales: toNumber(data.daily_sales),
    sales_trend: toNumber(data.sales_trend),
    monthly_sales: toNumber(data.monthly_sales),
    total_stock_value: toNumber(data.total_stock_value),
    total_products: toNumber(data.total_products),
    total_customers: toNumber(data.total_customers),
    net_profit: toNumber(data.net_profit),
    potential_profit: toNumber(data.potential_profit),
  };
};

const extractNeverSoldData = (data: unknown): NeverSoldData => {
  if (!isRecord(data)) {
    return { products: [], total_count: 0, total_value: 0 };
  }

  const rawProducts = Array.isArray(data.products) ? data.products : [];

  const products: NeverSoldProduct[] = rawProducts
    .filter(isRecord)
    .map((product) => ({
      name: toStringSafe(product.name, '-'),
      code: toStringSafe(product.code, '-'),
      quantity: toNumber(product.quantity),
      category: toStringSafe(product.category, '-'),
      stock_value: toNumber(product.stock_value),
      days_in_stock: toNumber(product.days_in_stock),
    }));

  return {
    products,
    total_count: toNumber(data.total_count, products.length),
    total_value: toNumber(data.total_value),
  };
};

const extractSalesByUserData = (data: unknown): SalesByUserData => {
  if (!isRecord(data)) {
    return { users: [] };
  }

  const rawUsers = Array.isArray(data.users) ? data.users : [];

  const users: UserSales[] = rawUsers
    .filter(isRecord)
    .map((user) => ({
      user_id: toStringSafe(user.user_id),
      user_name: toStringSafe(user.user_name, 'Inconnu'),
      user_role: toStringSafe(user.user_role, '-'),
      sales_count: toNumber(user.sales_count),
      total_amount: toNumber(user.total_amount),
      average_basket: toNumber(user.average_basket),
      percentage: toNumber(user.percentage),
    }));

  let summary: SalesByUserData['summary'];

  if (isRecord(data.summary)) {
    summary = {
      total_sales_count: toNumber(data.summary.total_sales_count),
      total_amount: toNumber(data.summary.total_amount),
    };
  }

  return { users, summary };
};

const extractDailyProfitData = (data: unknown): DailyProfitData | null => {
  if (!isRecord(data) || !isRecord(data.summary)) {
    return null;
  }

  const rawSales = Array.isArray(data.sales) ? data.sales : [];

  return {
    date: toStringSafe(data.date),
    summary: {
      total_sales: toNumber(data.summary.total_sales),
      total_cost: toNumber(data.summary.total_cost),
      gross_profit: toNumber(data.summary.gross_profit),
      net_profit: toNumber(data.summary.net_profit),
      profit_margin: toNumber(data.summary.profit_margin),
      sales_count: toNumber(data.summary.sales_count),
    },
    sales: rawSales
      .filter(isRecord)
      .map((sale) => ({
        sale_id: toStringSafe(sale.sale_id),
        reference: toStringSafe(sale.reference, '-'),
        profit: toNumber(sale.profit),
      })),
  };
};

const extractAlerts = (data: unknown): AlertItem[] => {
  const rawAlerts = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.alerts)
      ? data.alerts
      : [];

  return rawAlerts
    .filter(isRecord)
    .map((alert) => {
      const severityRaw = toStringSafe(alert.severity, 'low');

      const severity: AlertItem['severity'] =
        severityRaw === 'high' || severityRaw === 'medium' || severityRaw === 'low'
          ? severityRaw
          : 'low';

      return {
        product_name: toStringSafe(alert.product_name, '-'),
        current_stock: toNumber(alert.current_stock),
        threshold: toNumber(alert.threshold),
        severity,
        message: toStringSafe(alert.message),
      };
    });
};

const extractPerformanceData = (data: unknown): PerformanceData => {
  if (!isRecord(data)) {
    return {
      turnover_rate: 0,
      average_cart: 0,
      conversion_rate: 0,
      customer_satisfaction: 0,
      employee_productivity: 0,
    };
  }

  return {
    turnover_rate: toNumber(data.turnover_rate),
    average_cart: toNumber(data.average_cart),
    conversion_rate: toNumber(data.conversion_rate),
    customer_satisfaction: toNumber(data.customer_satisfaction),
    employee_productivity: toNumber(data.employee_productivity),
  };
};

// ===================================================================
// GÉNÉRATEURS DE RAPPORTS
// ===================================================================

const generateSalesReport = (
  doc: AutoTableCapableDoc,
  rawData: unknown,
  startY: number
): number => {
  const data = extractSalesDashboardData(rawData);

  const body: RowInput[] = [
    ['Aujourd’hui', formatCurrencyPDF(data.daily_sales), `${data.sales_trend}%`],
    ['Ce mois', formatCurrencyPDF(data.monthly_sales), '-'],
    ['Stock total', formatCurrencyPDF(data.total_stock_value), '-'],
  ];

  autoTable(doc, {
    head: [['Période', 'Montant', 'Tendance']],
    body,
    startY,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
  });

  let currentY = getFinalY(doc, startY) + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text(`Total produits : ${String(data.total_products)}`, 20, currentY);
  currentY += 7;

  doc.text(`Clients : ${String(data.total_customers)}`, 20, currentY);
  currentY += 7;

  doc.text(`Bénéfice net : ${formatCurrencyPDF(data.net_profit)}`, 20, currentY);
  currentY += 7;

  if (data.potential_profit > 0) {
    doc.text(`Bénéfice potentiel : ${formatCurrencyPDF(data.potential_profit)}`, 20, currentY);
    currentY += 7;
  }

  return currentY;
};

const generateNeverSoldReport = (
  doc: AutoTableCapableDoc,
  rawData: unknown,
  startY: number
): number => {
  const data = extractNeverSoldData(rawData);

  if (data.products.length === 0) {
    doc.text('Aucun produit jamais vendu.', 20, startY);
    return startY + 10;
  }

  const body: RowInput[] = data.products.map((product) => [
    product.name,
    product.code,
    String(product.quantity),
    product.category,
    formatCurrencyPDF(product.stock_value),
  ]);

  autoTable(doc, {
    head: [['Produit', 'Code', 'Quantité', 'Catégorie', 'Valeur']],
    body,
    startY,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8 },
  });

  const finalY = getFinalY(doc, startY) + 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Total produits : ${String(data.total_count)}`, 20, finalY);
  doc.text(`Valeur totale : ${formatCurrencyPDF(data.total_value)}`, 20, finalY + 7);

  return finalY + 14;
};

const generateSalesByUserReport = (
  doc: AutoTableCapableDoc,
  rawData: unknown,
  startY: number
): number => {
  const data = extractSalesByUserData(rawData);

  if (data.users.length === 0) {
    doc.text('Aucune vente enregistrée.', 20, startY);
    return startY + 10;
  }

  const body: RowInput[] = data.users.map((user) => [
    user.user_name,
    String(user.sales_count),
    formatCurrencyPDF(user.total_amount),
    formatCurrencyPDF(user.average_basket),
  ]);

  autoTable(doc, {
    head: [['Utilisateur', 'Nb ventes', 'Montant total', 'Panier moyen']],
    body,
    startY,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 8 },
  });

  const finalY = getFinalY(doc, startY) + 10;

  if (data.summary) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total ventes : ${String(data.summary.total_sales_count)}`, 20, finalY);
    doc.text(`Montant total : ${formatCurrencyPDF(data.summary.total_amount)}`, 20, finalY + 7);
    return finalY + 14;
  }

  return finalY;
};

const generateDailyProfitReport = (
  doc: AutoTableCapableDoc,
  rawData: unknown,
  startY: number,
  formattedDate: string
): number => {
  const data = extractDailyProfitData(rawData);

  if (!data) {
    doc.text('Aucune donnée disponible.', 20, startY);
    return startY + 10;
  }

  let currentY = startY;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Résumé du ${formattedDate}`, 20, currentY);
  currentY += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text(`Ventes totales : ${formatCurrencyPDF(data.summary.total_sales)}`, 20, currentY);
  currentY += 7;

  doc.text(`Coût total : ${formatCurrencyPDF(data.summary.total_cost)}`, 20, currentY);
  currentY += 7;

  doc.text(`Bénéfice brut : ${formatCurrencyPDF(data.summary.gross_profit)}`, 20, currentY);
  currentY += 7;

  doc.text(`Bénéfice net : ${formatCurrencyPDF(data.summary.net_profit)}`, 20, currentY);
  currentY += 7;

  doc.text(`Marge bénéficiaire : ${String(data.summary.profit_margin)}%`, 20, currentY);
  currentY += 7;

  doc.text(`Nombre de ventes : ${String(data.summary.sales_count)}`, 20, currentY);
  currentY += 12;

  if (data.sales.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Détail des ventes :', 20, currentY);
    currentY += 8;

    const body: RowInput[] = data.sales.slice(0, 20).map((sale) => [
      sale.reference,
      formatCurrencyPDF(sale.profit),
    ]);

    autoTable(doc, {
      head: [['Référence', 'Profit']],
      body,
      startY: currentY,
      theme: 'striped',
      headStyles: { fillColor: [37, 99, 235] },
      styles: { fontSize: 9 },
    });

    currentY = getFinalY(doc, currentY) + 8;

    if (data.sales.length > 20) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text(`... et ${String(data.sales.length - 20)} autre(s) vente(s)`, 20, currentY);
      currentY += 5;
    }
  }

  return currentY;
};

const generateAlertsReport = (
  doc: AutoTableCapableDoc,
  rawData: unknown,
  startY: number
): number => {
  const alerts = extractAlerts(rawData);

  if (alerts.length === 0) {
    doc.text('Aucune alerte en cours.', 20, startY);
    return startY + 10;
  }

  const body: RowInput[] = alerts.map((alert) => [
    alert.product_name,
    String(alert.current_stock),
    String(alert.threshold),
    alert.severity === 'high'
      ? 'Élevée'
      : alert.severity === 'medium'
        ? 'Moyenne'
        : 'Basse',
  ]);

  autoTable(doc, {
    head: [['Produit', 'Stock actuel', 'Seuil', 'Sévérité']],
    body,
    startY,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 9 },
  });

  return getFinalY(doc, startY) + 10;
};

const generatePerformanceReport = (
  doc: AutoTableCapableDoc,
  rawData: unknown,
  startY: number
): number => {
  const data = extractPerformanceData(rawData);
  let currentY = startY;

  const metrics: Array<{ label: string; value: string }> = [
    {
      label: 'Taux de rotation du stock',
      value: `${data.turnover_rate.toFixed(2)}x`,
    },
    {
      label: 'Panier moyen',
      value: formatCurrencyPDF(data.average_cart),
    },
    {
      label: 'Taux de conversion',
      value: `${data.conversion_rate}%`,
    },
    {
      label: 'Satisfaction client',
      value: `${data.customer_satisfaction}%`,
    },
    {
      label: 'Productivité employé',
      value: `${data.employee_productivity}%`,
    },
  ];

  doc.setFontSize(10);

  for (const metric of metrics) {
    doc.setFont('helvetica', 'normal');
    doc.text(`${metric.label} :`, 20, currentY);

    doc.setFont('helvetica', 'bold');
    doc.text(metric.value, 105, currentY);

    currentY += 8;
  }

  return currentY;
};

const generateDefaultReport = (
  doc: AutoTableCapableDoc,
  data: unknown,
  startY: number
): number => {
  if (!isRecord(data)) {
    doc.text('Aucune donnée disponible.', 20, startY);
    return startY + 10;
  }

  const rows: RowInput[] = Object.entries(data)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
    .map(([key, value]) => [
      String(key),
      typeof value === 'number' ? formatCurrencyPDF(value) : String(value),
    ]);

  if (rows.length === 0) {
    doc.text('Aucune donnée disponible.', 20, startY);
    return startY + 10;
  }

  autoTable(doc, {
    head: [['Indicateur', 'Valeur']],
    body: rows,
    startY,
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235] },
    styles: { fontSize: 10 },
  });

  return getFinalY(doc, startY) + 10;
};

// ===================================================================
// DISPATCH
// ===================================================================

const getReportTitle = (type: string): string => {
  const key = type.toLowerCase();

  const titles: Record<string, string> = {
    ventes: 'Rapport des ventes',
    sales: 'Rapport des ventes',
    'ventes mensuelles': 'Rapport des ventes mensuelles',
    'ventes du jour': 'Rapport des ventes journalières',
    'détail des ventes': 'Rapport détaillé des ventes',
    'valeur du stock': 'Rapport de la valeur du stock',
    stock: 'Rapport du stock',
    bénéfices: 'Rapport des bénéfices',
    profits: 'Rapport des bénéfices',
    'alertes de stock': 'Rapport des alertes stock',
    alerts: 'Rapport des alertes',
    'produits à péremption': 'Rapport des produits à péremption',
    expiry: 'Rapport des produits à péremption',
    'produits jamais vendus': 'Rapport des produits sans vente',
    'never-sold': 'Rapport des produits sans vente',
    'ventes par utilisateur': 'Rapport des ventes par utilisateur',
    'sales-by-user': 'Rapport des ventes par utilisateur',
    'bénéfice journalier détaillé': 'Rapport du bénéfice journalier',
    'daily-profit': 'Rapport du bénéfice journalier',
    'indicateurs de performance': 'Rapport des indicateurs de performance',
    performance: 'Rapport des performances',
    'aperçu complet': 'Rapport complet du tableau de bord',
  };

  return titles[key] ?? `Rapport - ${type}`;
};

const generateReportByType = (
  doc: AutoTableCapableDoc,
  type: string,
  data: unknown,
  startY: number,
  formattedDate: string
): number => {
  const typeLower = type.toLowerCase();

  if (typeLower.includes('never-sold') || typeLower.includes('jamais vendu')) {
    return generateNeverSoldReport(doc, data, startY);
  }

  if (typeLower.includes('sales-by-user') || typeLower.includes('par utilisateur')) {
    return generateSalesByUserReport(doc, data, startY);
  }

  if (typeLower.includes('daily-profit') || typeLower.includes('bénéfice journalier')) {
    return generateDailyProfitReport(doc, data, startY, formattedDate);
  }

  if (typeLower.includes('alert') || typeLower === 'alerts') {
    return generateAlertsReport(doc, data, startY);
  }

  if (typeLower.includes('performance') || typeLower.includes('indicateur')) {
    return generatePerformanceReport(doc, data, startY);
  }

  if (typeLower.includes('vente') || typeLower === 'sales') {
    return generateSalesReport(doc, data, startY);
  }

  return generateDefaultReport(doc, data, startY);
};

const generateFilename = (type: string, pharmacyName: string): string => {
  const timestamp = Date.now();
  const typeSlug = slugify(type || 'rapport');
  const pharmacySlug = slugify(pharmacyName || 'pharmacie');

  return `rapport-${pharmacySlug}-${typeSlug}-${timestamp}.pdf`;
};

// ===================================================================
// FONCTION PRINCIPALE
// ===================================================================

export const generateDashboardPDF = (pdfData: PDFData): void => {
  const {
    type,
    data,
    userName,
    pharmacyName,
    pharmacyAddress,
    pharmacyPhone,
    pharmacyEmail,
    date = new Date(),
  } = pdfData;

  if (data === null || data === undefined) {
    console.error('Aucune donnée à exporter.');
    return;
  }

  try {
    const doc = new jsPDF() as AutoTableCapableDoc;
    const formattedDate = formatPDFDate(date);
    const title = getReportTitle(type);

    addHeader(doc, pharmacyName, title, formattedDate);

    let currentY = addPharmacyInfo(
      doc,
      userName,
      pharmacyAddress,
      pharmacyPhone,
      pharmacyEmail,
      65
    );

    currentY = generateReportByType(doc, type, data, currentY, formattedDate);

    const pageCount = getPageCount(doc);
    addFooter(doc, pharmacyName, pageCount);

    const filename = generateFilename(type, pharmacyName);
    doc.save(filename);
  } catch (error) {
    console.error('Erreur lors de la génération du PDF :', error);
    throw new Error('Impossible de générer le PDF');
  }
};

export default {
  generateDashboardPDF,
  formatCurrencyPDF,
  formatPDFDate,
};