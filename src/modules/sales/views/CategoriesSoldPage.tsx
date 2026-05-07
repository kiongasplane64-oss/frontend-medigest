// CategoriesSoldPage.tsx
import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Download,
  FolderTree,
  Package,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
} from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import api from '@/api/client';
import type { SaleResponse } from '@/services/saleService';

// Extension du type SaleItemResponse pour inclure category_id
interface ExtendedSaleItem {
  id?: string;
  sale_id: string;
  product_id: string;
  product_name: string;
  product_code?: string;
  quantity: number;
  unit_price: number;
  total?: number;
  category_id?: string; // Ajout de la propriété category_id
}

interface CategoryStat {
  categoryId: string;
  categoryName: string;
  totalAmount: number;
  quantitySold: number;
  saleCount: number;
  percentage: number;
  productCount: number;
  products: Map<string, {
    productId: string;
    productName: string;
    productCode: string;
    quantity: number;
    amount: number;
    percentage: number;
  }>;
}

const formatPrice = (price: number): string => {
  return price.toFixed(2) + ' FC';
};

const formatDate = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

type PeriodType = 'today' | 'week' | 'month' | 'year' | 'custom';

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

export default function CategoriesSoldPage() {
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [sales, setSales] = useState<SaleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Charger les catégories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await api.get('/categories');
        const categoriesData = response.data?.data || response.data || [];
        if (Array.isArray(categoriesData)) {
          setCategories(categoriesData.map((cat: any) => ({ id: cat.id, name: cat.name })));
        }
      } catch (error) {
        console.error('Erreur chargement catégories:', error);
      }
    };
    loadCategories();
  }, []);

  // Charger les ventes
  useEffect(() => {
    loadSales();
  }, [periodType, customStartDate, customEndDate, selectedYear, selectedMonth]);

  const loadSales = async () => {
    setLoading(true);
    try {
      let startDate: string | undefined;
      let endDate: string | undefined;
      const now = new Date();
      
      switch (periodType) {
        case 'today':
          startDate = new Date().toISOString().split('T')[0];
          endDate = startDate;
          break;
        case 'week':
          const monday = new Date(now);
          monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
          startDate = monday.toISOString().split('T')[0];
          endDate = new Date().toISOString().split('T')[0];
          break;
        case 'month':
          startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
          endDate = new Date().toISOString().split('T')[0];
          break;
        case 'year':
          startDate = `${selectedYear}-01-01`;
          endDate = `${selectedYear}-12-31`;
          if (selectedMonth !== null) {
            startDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
            const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
            endDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${lastDay}`;
          }
          break;
        case 'custom':
          if (customStartDate && customEndDate) {
            startDate = customStartDate;
            endDate = customEndDate;
          }
          break;
      }
      
      const params: any = {
        limit: 1000,
        status: 'completed',
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await api.get('/sales', { params });
      const salesData = response.data?.items || response.data?.data || [];
      setSales(Array.isArray(salesData) ? salesData : []);
      
    } catch (error) {
      console.error('Erreur chargement ventes:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données des ventes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Statistiques par catégorie
  const categoryStats = useMemo((): CategoryStat[] => {
    const categoryMap = new Map<string, CategoryStat>();
    let totalAmountAll = 0;
    
    // Agrégation par catégorie
    sales.forEach(sale => {
      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item: ExtendedSaleItem) => {
          let categoryId = item.category_id || 'uncategorized';
          let categoryName = 'Non catégorisé';
          
          // Chercher le nom de la catégorie dans la liste
          const foundCategory = categories.find(c => c.id === categoryId);
          if (foundCategory) {
            categoryName = foundCategory.name;
          } else if (categoryId === 'uncategorized') {
            categoryName = 'Non catégorisé';
          }
          
          if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, {
              categoryId,
              categoryName,
              totalAmount: 0,
              quantitySold: 0,
              saleCount: 0,
              percentage: 0,
              productCount: 0,
              products: new Map(),
            });
          }
          
          const stats = categoryMap.get(categoryId)!;
          const itemTotal = item.total || (item.unit_price * item.quantity);
          stats.totalAmount += itemTotal;
          stats.quantitySold += item.quantity;
          stats.saleCount++;
          totalAmountAll += itemTotal;
          
          // Agrégation par produit dans la catégorie
          const productKey = item.product_id;
          if (!stats.products.has(productKey)) {
            stats.products.set(productKey, {
              productId: item.product_id,
              productName: item.product_name,
              productCode: item.product_code || '',
              quantity: 0,
              amount: 0,
              percentage: 0,
            });
            stats.productCount++;
          }
          const productStat = stats.products.get(productKey)!;
          productStat.quantity += item.quantity;
          productStat.amount += itemTotal;
        });
      }
    });
    
    // Calculer les pourcentages
    const result = Array.from(categoryMap.values());
    result.forEach(stats => {
      stats.percentage = totalAmountAll > 0 ? (stats.totalAmount / totalAmountAll) * 100 : 0;
      
      // Pourcentages par produit dans la catégorie
      stats.products.forEach(product => {
        product.percentage = stats.totalAmount > 0 ? (product.amount / stats.totalAmount) * 100 : 0;
      });
    });
    
    return result.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [sales, categories]);

  // Filtrer les catégories par recherche
  const filteredStats = useMemo(() => {
    if (!searchTerm.trim()) return categoryStats;
    const term = searchTerm.toLowerCase();
    return categoryStats.filter(stat => 
      stat.categoryName.toLowerCase().includes(term) ||
      Array.from(stat.products.values()).some(p => 
        p.productName.toLowerCase().includes(term) ||
        p.productCode.toLowerCase().includes(term)
      )
    );
  }, [categoryStats, searchTerm]);

  // Pagination
  const paginatedStats = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return {
      items: filteredStats.slice(start, end),
      totalCount: filteredStats.length,
      totalPages: Math.max(1, Math.ceil(filteredStats.length / itemsPerPage)),
    };
  }, [filteredStats, currentPage]);

  const totalAmount = categoryStats.reduce((sum, cat) => sum + cat.totalAmount, 0);
  const totalQuantity = categoryStats.reduce((sum, cat) => sum + cat.quantitySold, 0);
  const totalSales = sales.length;

  const resetFilters = () => {
    setPeriodType('month');
    setCustomStartDate('');
    setCustomEndDate('');
    setSelectedYear(new Date().getFullYear());
    setSelectedMonth(null);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    const headers = ['Catégorie', 'CA (FC)', 'Quantité vendue', '% du CA', 'Nombre de produits', 'Nombre de ventes'];
    
    const rows = categoryStats.map(cat => [
      cat.categoryName,
      cat.totalAmount.toFixed(2),
      cat.quantitySold,
      cat.percentage.toFixed(2),
      cat.productCount,
      cat.saleCount,
    ]);
    
    const escapeCell = (value: any) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ventes_par_categorie_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Export réussi", description: "Le fichier CSV a été téléchargé" });
  };

  const exportCategoryDetails = (category: CategoryStat) => {
    const headers = ['Produit', 'Code', 'Quantité', 'CA (FC)', '% dans catégorie'];
    
    const rows = Array.from(category.products.values())
      .sort((a, b) => b.amount - a.amount)
      .map(product => [
        product.productName,
        product.productCode,
        product.quantity,
        product.amount.toFixed(2),
        product.percentage.toFixed(2),
      ]);
    
    const escapeCell = (value: any) => `"${String(value).replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\n');
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `categorie_${category.categoryName}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
    
    toast({ title: "Export réussi", description: `Détails de ${category.categoryName} exportés` });
  };

  const getPeriodLabel = (): string => {
    switch (periodType) {
      case 'today': return "aujourd'hui";
      case 'week': return 'cette semaine';
      case 'month': return 'ce mois-ci';
      case 'year': 
        if (selectedMonth !== null) {
          return `${MONTHS_FR[selectedMonth]} ${selectedYear}`;
        }
        return `l'année ${selectedYear}`;
      case 'custom':
        if (customStartDate && customEndDate) {
          return `du ${formatDate(customStartDate)} au ${formatDate(customEndDate)}`;
        }
        return 'période personnalisée';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
          <p className="text-slate-500">Chargement des statistiques...</p>
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
              <h1 className="text-xl font-black text-slate-800 md:text-2xl">Ventes par catégorie</h1>
              <p className="text-sm text-slate-400">
                Analyse des ventes {getPeriodLabel()} · {totalSales} ventes · {totalQuantity} articles
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={resetFilters} className="rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50">
              Réinitialiser
            </button>
            <button onClick={exportToCSV} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              <Download size={18} /> Exporter tout
            </button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          {/* Filtres */}
          <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6">
              <div className="relative">
                <Calendar className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <select
                  value={periodType}
                  onChange={(e) => { setPeriodType(e.target.value as PeriodType); setCurrentPage(1); }}
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="today">Aujourd'hui</option>
                  <option value="week">Cette semaine</option>
                  <option value="month">Ce mois</option>
                  <option value="year">Année</option>
                  <option value="custom">Personnalisé</option>
                </select>
              </div>

              {periodType === 'year' && (
                <>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  
                  <select
                    value={selectedMonth ?? ''}
                    onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : null)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Année complète</option>
                    {MONTHS_FR.map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                </>
              )}

              {periodType === 'custom' && (
                <>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Date début"
                  />
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Date fin"
                  />
                </>
              )}

              <div className="relative lg:col-span-2">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
                <input
                  className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Rechercher catégorie ou produit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Statistiques globales */}
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-100"><TrendingUp size={20} className="text-blue-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Chiffre d'affaires</p>
                  <p className="text-xl font-black text-slate-800">{formatPrice(totalAmount)}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100"><Package size={20} className="text-emerald-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Articles vendus</p>
                  <p className="text-xl font-black text-slate-800">{totalQuantity}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100"><FolderTree size={20} className="text-violet-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Catégories actives</p>
                  <p className="text-xl font-black text-slate-800">{categoryStats.length}</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100"><Calendar size={20} className="text-amber-600" /></div>
                <div>
                  <p className="text-xs text-slate-400">Nombre de ventes</p>
                  <p className="text-xl font-black text-slate-800">{totalSales}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tableau des ventes par catégorie */}
          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
              <h2 className="flex items-center gap-2 font-bold text-slate-800">
                <FolderTree size={18} className="text-blue-600" />
                Montant vendu par catégorie
              </h2>
            </div>
            
            {paginatedStats.items.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                Aucune donnée de catégorie disponible pour cette période
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Catégorie</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">CA (FC)</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Qté vendue</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">% du CA</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Produits</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Ventes</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedStats.items.map((category) => (
                        <tr key={category.categoryId} className="hover:bg-slate-50">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <FolderTree size={16} className="text-blue-500" />
                              <span className="font-medium text-slate-800">{category.categoryName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-emerald-600">
                            {formatPrice(category.totalAmount)}
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {category.quantitySold}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-sm font-medium text-slate-700">{category.percentage.toFixed(1)}%</span>
                              <div className="hidden w-20 overflow-hidden rounded-full bg-slate-200 sm:block">
                                <div 
                                  className="h-2 rounded-full bg-blue-500 transition-all"
                                  style={{ width: `${Math.min(category.percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {category.productCount}
                           </td>
                          <td className="px-4 py-4 text-right text-slate-600">
                            {category.saleCount}
                           </td>
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => setExpandedCategory(expandedCategory === category.categoryId ? null : category.categoryId)}
                              className="rounded-lg px-3 py-1 text-sm text-blue-600 hover:bg-blue-50"
                            >
                              {expandedCategory === category.categoryId ? '▲ Réduire' : '▼ Détail'}
                            </button>
                           </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Détails des produits par catégorie */}
                {expandedCategory && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {(() => {
                      const category = categoryStats.find(c => c.categoryId === expandedCategory);
                      if (!category) return null;
                      const products = Array.from(category.products.values())
                        .sort((a, b) => b.amount - a.amount);
                      
                      return (
                        <div className="p-5">
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                            <h3 className="font-bold text-slate-800">
                              Détail des produits - {category.categoryName}
                            </h3>
                            <button
                              onClick={() => exportCategoryDetails(category)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                              <Download size={14} /> Exporter
                            </button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Produit</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Code</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qté vendue</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">CA (FC)</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">% catégorie</th>
                                </tr>
                              </thead>
                              <tbody>
                                {products.map((product) => (
                                  <tr key={product.productId} className="border-b border-slate-100">
                                    <td className="px-3 py-2 text-sm text-slate-700">{product.productName}</td>
                                    <td className="px-3 py-2 text-right text-xs text-slate-400">{product.productCode}</td>
                                    <td className="px-3 py-2 text-right text-sm text-slate-600">{product.quantity}</td>
                                    <td className="px-3 py-2 text-right font-medium text-emerald-600">{formatPrice(product.amount)}</td>
                                    <td className="px-3 py-2 text-right text-sm text-slate-500">{product.percentage.toFixed(1)}%</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="bg-slate-100">
                                  <td colSpan={4} className="px-3 py-2 text-right font-bold text-slate-800">Total {category.categoryName}</td>
                                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{formatPrice(category.totalAmount)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Pagination */}
                {paginatedStats.totalPages > 1 && (
                  <div className="flex flex-col gap-4 border-t border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm text-slate-400">
                      Affichage {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, paginatedStats.totalCount)} sur {paginatedStats.totalCount} catégories
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <span className="px-3 py-2 text-sm font-medium text-slate-700">
                        Page {currentPage} / {paginatedStats.totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage(p => Math.min(paginatedStats.totalPages, p + 1))}
                        disabled={currentPage === paginatedStats.totalPages}
                        className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Barre de répartition des catégories */}
          {categoryStats.length > 1 && (
            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-5">
                <h3 className="font-bold text-slate-800">Répartition des ventes par catégorie</h3>
              </div>
              <div className="flex h-8 overflow-hidden">
                {categoryStats.map((cat, idx) => (
                  <div
                    key={cat.categoryId}
                    className="transition-all duration-300 hover:opacity-90"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: [
                        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
                      ][idx % 10],
                    }}
                    title={`${cat.categoryName}: ${cat.percentage.toFixed(1)}% (${formatPrice(cat.totalAmount)})`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-4 p-5">
                {categoryStats.slice(0, 10).map((cat, idx) => (
                  <div key={cat.categoryId} className="flex items-center gap-2">
                    <div 
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'][idx % 10] }}
                    />
                    <span className="text-xs text-slate-600">{cat.categoryName}</span>
                    <span className="text-xs font-medium text-slate-400">{cat.percentage.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}