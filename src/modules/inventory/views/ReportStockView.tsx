// src/modules/inventory/views/ReportStockView.tsx
import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useAuthStore } from '@/store/useAuthStore';
import { Picker } from '@react-native-picker/picker';
import { Trash2, Edit2, X, Download, AlertTriangle } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Types
interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  category_id?: string;
  category?: Category;
  expired?: boolean;
  expiry_date?: string;
  stock_status?: string;
}

interface CategoryStats {
  categoryId: string;
  categoryName: string;
  totalQuantity: number;
  totalPurchaseValue: number;
  totalSellingValue: number;
  totalProfit: number;
  productCount: number;
  products: Product[];
}

interface PharmacyInfo {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  licenseNumber: string;
}

interface ReportData {
  pharmacy: PharmacyInfo;
  user: {
    name: string;
    email: string;
    role: string;
  };
  date: string;
  categories: CategoryStats[];
  uncategorized: CategoryStats;
  globalTotals: {
    totalQuantity: number;
    totalPurchaseValue: number;
    totalSellingValue: number;
    totalProfit: number;
    productCount: number;
  };
}

// API Service
const apiService = {
  async getCategories(): Promise<Category[]> {
    const response = await fetch('/api/stock/categories/simple');
    const data = await response.json();
    return data;
  },

  async getProducts(params?: { category_id?: string; get_all?: boolean }): Promise<Product[]> {
    const queryParams = new URLSearchParams();
    if (params?.category_id) queryParams.append('category_id', params.category_id);
    if (params?.get_all) queryParams.append('get_all', 'true');
    
    const response = await fetch(`/api/stock/?${queryParams.toString()}`);
    const data = await response.json();
    return data.products || [];
  },

  async deleteProduct(productId: string, reason?: string): Promise<{ success: boolean; message: string; trash_id?: string }> {
    const response = await fetch(`/api/stock/${productId}?deletion_reason=${encodeURIComponent(reason || 'Suppression depuis rapport')}`, {
      method: 'DELETE',
    });
    return response.json();
  },

  async updateProduct(productId: string, data: Partial<Product>): Promise<Product> {
    const response = await fetch(`/api/stock/${productId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async getPharmacyInfo(): Promise<PharmacyInfo> {
    const response = await fetch('/api/pharmacies/current');
    const data = await response.json();
    return data;
  },
};

export default function ReportStockView() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [productToCategorize, setProductToCategorize] = useState<Product | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'profit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exporting, setExporting] = useState(false);
  const [currentPharmacy, setCurrentPharmacy] = useState<PharmacyInfo | null>(null);

  // Chargement des données
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [categoriesData, productsData, pharmacyData] = await Promise.all([
        apiService.getCategories(),
        apiService.getProducts({ get_all: true }),
        apiService.getPharmacyInfo(),
      ]);
      
      setCategories(categoriesData);
      setAllProducts(productsData);
      setCurrentPharmacy(pharmacyData);
      
      // Calculer les statistiques par catégorie
      const stats = calculateStatsByCategory(productsData, categoriesData, pharmacyData, user);
      setReportData(stats);
      
    } catch (error) {
      console.error('Erreur chargement données:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du stock');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Calcul des statistiques par catégorie
  const calculateStatsByCategory = (
    productsListData: Product[], 
    categoriesList: Category[], 
    pharmacy: PharmacyInfo | null,
    currentUser: any
  ): ReportData => {
    const categoryMap = new Map<string, CategoryStats>();
    
    // Initialiser les catégories
    categoriesList.forEach(cat => {
      categoryMap.set(cat.id, {
        categoryId: cat.id,
        categoryName: cat.name,
        totalQuantity: 0,
        totalPurchaseValue: 0,
        totalSellingValue: 0,
        totalProfit: 0,
        productCount: 0,
        products: [],
      });
    });
    
    // Catégorie "Sans catégorie"
    const uncategorized: CategoryStats = {
      categoryId: 'uncategorized',
      categoryName: 'Sans catégorie',
      totalQuantity: 0,
      totalPurchaseValue: 0,
      totalSellingValue: 0,
      totalProfit: 0,
      productCount: 0,
      products: [],
    };
    
    // Variables pour les totaux globaux
    let globalTotals = {
      totalQuantity: 0,
      totalPurchaseValue: 0,
      totalSellingValue: 0,
      totalProfit: 0,
      productCount: 0,
    };
    
    // Parcourir tous les produits
    productsListData.forEach(product => {
      const quantity = product.quantity || 0;
      const purchaseValue = quantity * (product.purchase_price || 0);
      const sellingValue = quantity * (product.selling_price || 0);
      const profit = sellingValue - purchaseValue;
      
      const productWithStats = { ...product };
      
      // Mettre à jour les totaux globaux
      globalTotals.totalQuantity += quantity;
      globalTotals.totalPurchaseValue += purchaseValue;
      globalTotals.totalSellingValue += sellingValue;
      globalTotals.totalProfit += profit;
      globalTotals.productCount += 1;
      
      // Catégoriser le produit
      if (product.category_id && categoryMap.has(product.category_id)) {
        const stats = categoryMap.get(product.category_id)!;
        stats.totalQuantity += quantity;
        stats.totalPurchaseValue += purchaseValue;
        stats.totalSellingValue += sellingValue;
        stats.totalProfit += profit;
        stats.productCount += 1;
        stats.products.push(productWithStats);
        categoryMap.set(product.category_id, stats);
      } else {
        uncategorized.totalQuantity += quantity;
        uncategorized.totalPurchaseValue += purchaseValue;
        uncategorized.totalSellingValue += sellingValue;
        uncategorized.totalProfit += profit;
        uncategorized.productCount += 1;
        uncategorized.products.push(productWithStats);
      }
    });
    
    // Convertir la map en tableau et trier
    const categoriesArray = Array.from(categoryMap.values())
      .filter(cat => cat.productCount > 0)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    
    // Filtrer les catégories vides
    const nonEmptyCategories = uncategorized.productCount > 0 
      ? [...categoriesArray, uncategorized]
      : categoriesArray;
    
    return {
      pharmacy: pharmacy || {
        id: '',
        name: 'Pharmacie',
        address: '',
        phone: '',
        email: '',
        licenseNumber: '',
      },
      user: {
        name: currentUser?.nom_complet || currentUser?.email || 'Utilisateur',
        email: currentUser?.email || '',
        role: currentUser?.role || '',
      },
      date: new Date().toLocaleDateString('fr-FR'),
      categories: nonEmptyCategories,
      uncategorized,
      globalTotals,
    };
  };

  // Filtrer et trier les produits d'une catégorie
  const getFilteredProducts = (productsListData: Product[]): Product[] => {
    let filtered = [...productsListData];
    
    // Filtre par recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query))
      );
    }
    
    // Tri
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'quantity':
          comparison = (a.quantity || 0) - (b.quantity || 0);
          break;
        case 'profit':
          const profitA = (a.quantity || 0) * ((a.selling_price || 0) - (a.purchase_price || 0));
          const profitB = (b.quantity || 0) * ((b.selling_price || 0) - (b.purchase_price || 0));
          comparison = profitA - profitB;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  };

  // Supprimer un produit (envoyer à la corbeille)
  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;
    
    try {
      const result = await apiService.deleteProduct(selectedProduct.id, deletionReason);
      
      if (result.success) {
        Alert.alert('Succès', result.message);
        setShowDeleteModal(false);
        setSelectedProduct(null);
        setDeletionReason('');
        loadData();
      } else {
        Alert.alert('Erreur', result.message);
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer le produit');
    }
  };

  // Mettre à jour la catégorie d'un produit
  const handleUpdateCategory = async () => {
    if (!productToCategorize || !selectedCategoryId) return;
    
    try {
      await apiService.updateProduct(productToCategorize.id, { category_id: selectedCategoryId });
      Alert.alert('Succès', 'Catégorie mise à jour avec succès');
      setShowCategoryModal(false);
      setProductToCategorize(null);
      setSelectedCategoryId('');
      loadData();
    } catch (error) {
      console.error('Erreur mise à jour catégorie:', error);
      Alert.alert('Erreur', 'Impossible de mettre à jour la catégorie');
    }
  };

  // Exporter en PDF
  const exportToPDF = async () => {
    if (!reportData) return;
    
    setExporting(true);
    
    const getProductsHTML = (productsListData: Product[]) => {
      return productsListData.map(p => `
        <tr>
          <td>${escapeHtml(p.code)}</td>
          <td>${escapeHtml(p.name)}</td>
          <td class="number">${p.quantity || 0}</td>
          <td class="number">${formatMoney(p.purchase_price || 0)}</td>
          <td class="number">${formatMoney(p.selling_price || 0)}</td>
          <td class="number">${formatMoney(((p.quantity || 0) * (p.purchase_price || 0)))}</td>
          <td class="number">${formatMoney(((p.quantity || 0) * (p.selling_price || 0)))}</td>
          <td class="number">${formatMoney(((p.quantity || 0) * ((p.selling_price || 0) - (p.purchase_price || 0))))}</td>
        </tr>
      `).join('');
    };
    
    const categoriesHTML = reportData.categories.map(cat => `
      <div class="category-section">
        <div class="category-header">
          <h3>${escapeHtml(cat.categoryName)}</h3>
          <div class="category-stats">
            <span>📦 ${cat.productCount} produits</span>
            <span>📊 ${cat.totalQuantity} unités</span>
            <span>💰 Profit: ${formatMoney(cat.totalProfit)}</span>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Nom du produit</th>
              <th>Qté</th>
              <th>PA</th>
              <th>PV</th>
              <th>Valeur Achat</th>
              <th>Valeur Vente</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            ${getProductsHTML(cat.products)}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="4"></td>
              <td><strong>Totaux:</strong></td>
              <td class="number"><strong>${formatMoney(cat.totalPurchaseValue)}</strong></td>
              <td class="number"><strong>${formatMoney(cat.totalSellingValue)}</strong></td>
              <td class="number"><strong>${formatMoney(cat.totalProfit)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `).join('');
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport de Stock - ${escapeHtml(reportData.pharmacy.name)}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Helvetica', 'Arial', sans-serif; font-size: 12px; line-height: 1.4; color: #333; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #2196F3; }
          .header h1 { color: #2196F3; font-size: 24px; margin-bottom: 10px; }
          .pharmacy-info { margin-top: 10px; font-size: 11px; color: #666; }
          .report-meta { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 5px; }
          .global-summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px; border-radius: 10px; margin-bottom: 30px; }
          .global-summary h3 { margin-bottom: 10px; }
          .summary-grid { display: flex; justify-content: space-around; flex-wrap: wrap; }
          .summary-card { text-align: center; padding: 10px; }
          .summary-card .label { font-size: 11px; opacity: 0.9; }
          .summary-card .value { font-size: 18px; font-weight: bold; }
          .category-section { margin-bottom: 30px; page-break-inside: avoid; }
          .category-header { background: #e3f2fd; padding: 10px 15px; border-radius: 8px; margin-bottom: 15px; }
          .category-header h3 { color: #1976D2; margin-bottom: 5px; }
          .category-stats { display: flex; gap: 15px; font-size: 11px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; font-weight: bold; }
          .number { text-align: right; }
          .total-row { background-color: #f9f9f9; font-weight: bold; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 10px; color: #999; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>📊 RAPPORT DE STOCK</h1>
          <div class="pharmacy-info">
            <strong>${escapeHtml(reportData.pharmacy.name)}</strong><br/>
            ${escapeHtml(reportData.pharmacy.address)}<br/>
            Tél: ${escapeHtml(reportData.pharmacy.phone)} | Email: ${escapeHtml(reportData.pharmacy.email)}
          </div>
        </div>
        
        <div class="report-meta">
          <span>📅 Date: ${reportData.date}</span>
          <span>👤 Rapport généré par: ${escapeHtml(reportData.user.name)}</span>
          <span>🏷️ Rôle: ${escapeHtml(reportData.user.role)}</span>
        </div>
        
        <div class="global-summary">
          <h3>📈 RÉSUMÉ GLOBAL</h3>
          <div class="summary-grid">
            <div class="summary-card">
              <div class="label">Produits</div>
              <div class="value">${reportData.globalTotals.productCount}</div>
            </div>
            <div class="summary-card">
              <div class="label">Unités en stock</div>
              <div class="value">${reportData.globalTotals.totalQuantity}</div>
            </div>
            <div class="summary-card">
              <div class="label">Valeur d'achat</div>
              <div class="value">${formatMoney(reportData.globalTotals.totalPurchaseValue)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Valeur de vente</div>
              <div class="value">${formatMoney(reportData.globalTotals.totalSellingValue)}</div>
            </div>
            <div class="summary-card">
              <div class="label">Profit potentiel</div>
              <div class="value">${formatMoney(reportData.globalTotals.totalProfit)}</div>
            </div>
          </div>
        </div>
        
        ${categoriesHTML}
        
        <div class="footer">
          <p>Rapport généré automatiquement par le système de gestion de pharmacie</p>
          <p>Licence: ${escapeHtml(reportData.pharmacy.licenseNumber)}</p>
        </div>
      </body>
      </html>
    `;
    
    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Partager le rapport de stock',
      });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setExporting(false);
    }
  };

  const escapeHtml = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const formatMoney = (value: number): string => {
    return new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(value);
  };

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Utiliser allProducts pour le compteur de produits total
  const totalProductsCount = allProducts.length;
  
  // Utiliser currentPharmacy pour afficher le nom de la pharmacie dans le titre
  const pharmacyName = currentPharmacy?.name || 'Pharmacie';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement du rapport...</Text>
      </View>
    );
  }

  const filteredCategories = reportData?.categories.filter(cat => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'uncategorized') return cat.categoryId === 'uncategorized';
    return cat.categoryId === selectedCategory;
  }) || [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📊 Rapport de Stock - {pharmacyName}</Text>
        <Text style={styles.subtitle}>par catégorie | Total produits: {totalProductsCount}</Text>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un produit..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <X size={18} color="#666" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filters}>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={selectedCategory}
              onValueChange={(value: string) => setSelectedCategory(value)}
              style={styles.picker}
            >
              <Picker.Item label="Toutes les catégories" value="all" />
              {categories.map(cat => (
                <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
              ))}
              <Picker.Item label="⚠️ Sans catégorie" value="uncategorized" />
            </Picker>
          </View>

          <View style={styles.pickerContainerSmall}>
            <Picker
              selectedValue={sortBy}
              onValueChange={(value: string) => setSortBy(value as any)}
              style={styles.picker}
            >
              <Picker.Item label="Trier par nom" value="name" />
              <Picker.Item label="Trier par quantité" value="quantity" />
              <Picker.Item label="Trier par profit" value="profit" />
            </Picker>
          </View>

          <TouchableOpacity
            style={styles.sortOrderButton}
            onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
          >
            <Text style={styles.sortOrderText}>{sortOrder === 'asc' ? '↑' : '↓'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportButton}
            onPress={exportToPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Download size={18} color="#fff" />
                <Text style={styles.exportButtonText}>PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {reportData && (
        <View style={styles.globalSummary}>
          <Text style={styles.globalSummaryTitle}>📈 Résumé global</Text>
          <View style={styles.globalSummaryGrid}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Produits</Text>
              <Text style={styles.summaryValue}>{reportData.globalTotals.productCount}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Unités</Text>
              <Text style={styles.summaryValue}>{reportData.globalTotals.totalQuantity}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Valeur achat</Text>
              <Text style={styles.summaryValue}>{formatMoney(reportData.globalTotals.totalPurchaseValue)}</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Valeur vente</Text>
              <Text style={styles.summaryValue}>{formatMoney(reportData.globalTotals.totalSellingValue)}</Text>
            </View>
            <View style={[styles.summaryCard, styles.profitCard]}>
              <Text style={styles.summaryLabel}>Profit</Text>
              <Text style={styles.summaryProfit}>{formatMoney(reportData.globalTotals.totalProfit)}</Text>
            </View>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.categoriesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredCategories.map(category => (
          <View key={category.categoryId} style={styles.categoryCard}>
            <TouchableOpacity
              style={styles.categoryHeader}
              onPress={() => toggleCategory(category.categoryId)}
            >
              <View style={styles.categoryHeaderLeft}>
                <Text style={styles.categoryHeaderIcon}>
                  {category.categoryId === 'uncategorized' ? '⚠️' : '📁'}
                </Text>
                <Text style={styles.categoryName}>{category.categoryName}</Text>
                {category.categoryId === 'uncategorized' && (
                  <View style={styles.warningBadge}>
                    <AlertTriangle size={12} color="#FF9800" />
                    <Text style={styles.warningText}>Sans catégorie</Text>
                  </View>
                )}
              </View>
              <View style={styles.categoryStatsRight}>
                <Text style={styles.categoryStat}>{category.productCount} produits</Text>
                <Text style={styles.categoryStat}>{category.totalQuantity} unités</Text>
                <Text style={[styles.categoryStat, styles.profitText]}>
                  Profit: {formatMoney(category.totalProfit)}
                </Text>
                <Text style={styles.expandIcon}>
                  {expandedCategories.has(category.categoryId) ? '▼' : '▶'}
                </Text>
              </View>
            </TouchableOpacity>

            {expandedCategories.has(category.categoryId) && (
              <View style={styles.productsList}>
                <View style={[styles.productRow, styles.productHeader]}>
                  <Text style={[styles.productCell, styles.codeCell]}>Code</Text>
                  <Text style={[styles.productCell, styles.nameCell]}>Produit</Text>
                  <Text style={[styles.productCell, styles.qtyCell]}>Qté</Text>
                  <Text style={[styles.productCell, styles.priceCell]}>PA</Text>
                  <Text style={[styles.productCell, styles.priceCell]}>PV</Text>
                  <Text style={[styles.productCell, styles.valueCell]}>Val Achat</Text>
                  <Text style={[styles.productCell, styles.valueCell]}>Val Vente</Text>
                  <Text style={[styles.productCell, styles.valueCell]}>Profit</Text>
                  <Text style={[styles.productCell, styles.actionsCell]}>Actions</Text>
                </View>

                {getFilteredProducts(category.products).map(product => {
                  const purchaseValue = (product.quantity || 0) * (product.purchase_price || 0);
                  const sellingValue = (product.quantity || 0) * (product.selling_price || 0);
                  const profit = sellingValue - purchaseValue;
                  
                  return (
                    <View key={product.id} style={styles.productRow}>
                      <Text style={[styles.productCell, styles.codeCell]}>{product.code}</Text>
                      <Text style={[styles.productCell, styles.nameCell]} numberOfLines={1}>
                        {product.name}
                      </Text>
                      <Text style={[styles.productCell, styles.qtyCell]}>{product.quantity || 0}</Text>
                      <Text style={[styles.productCell, styles.priceCell]}>{formatMoney(product.purchase_price || 0)}</Text>
                      <Text style={[styles.productCell, styles.priceCell]}>{formatMoney(product.selling_price || 0)}</Text>
                      <Text style={[styles.productCell, styles.valueCell]}>{formatMoney(purchaseValue)}</Text>
                      <Text style={[styles.productCell, styles.valueCell]}>{formatMoney(sellingValue)}</Text>
                      <Text style={[styles.productCell, styles.valueCell, profit >= 0 ? styles.positive : styles.negative]}>
                        {formatMoney(profit)}
                      </Text>
                      <View style={[styles.productCell, styles.actionsCell]}>
                        {category.categoryId === 'uncategorized' && (
                          <TouchableOpacity
                            style={styles.categoryButton}
                            onPress={() => {
                              setProductToCategorize(product);
                              setShowCategoryModal(true);
                            }}
                          >
                            <Edit2 size={16} color="#4CAF50" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => {
                            setSelectedProduct(product);
                            setShowDeleteModal(true);
                          }}
                        >
                          <Trash2 size={16} color="#F44336" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                <View style={[styles.productRow, styles.categoryTotalRow]}>
                  <Text style={[styles.productCell, styles.codeCell]}></Text>
                  <Text style={[styles.productCell, styles.nameCell, styles.totalText]}>
                    Totaux {category.categoryName}
                  </Text>
                  <Text style={[styles.productCell, styles.qtyCell, styles.totalText]}>
                    {category.totalQuantity}
                  </Text>
                  <Text style={[styles.productCell, styles.priceCell]}></Text>
                  <Text style={[styles.productCell, styles.priceCell]}></Text>
                  <Text style={[styles.productCell, styles.valueCell, styles.totalText]}>
                    {formatMoney(category.totalPurchaseValue)}
                  </Text>
                  <Text style={[styles.productCell, styles.valueCell, styles.totalText]}>
                    {formatMoney(category.totalSellingValue)}
                  </Text>
                  <Text style={[styles.productCell, styles.valueCell, styles.totalText, styles.positive]}>
                    {formatMoney(category.totalProfit)}
                  </Text>
                  <Text style={[styles.productCell, styles.actionsCell]}></Text>
                </View>
              </View>
            )}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            📅 Rapport généré le {new Date().toLocaleString('fr-FR')}
          </Text>
          <Text style={styles.footerText}>
            👤 {user?.nom_complet || user?.email}
          </Text>
        </View>
      </ScrollView>

      {/* Modal de suppression */}
      <Modal
        visible={showDeleteModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🗑️ Supprimer le produit</Text>
            <Text style={styles.modalSubtitle}>
              {selectedProduct?.name} ({selectedProduct?.code})
            </Text>
            
            <Text style={styles.inputLabel}>Raison de la suppression (optionnel)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ex: Produit périmé, fin de série..."
              value={deletionReason}
              onChangeText={setDeletionReason}
              multiline
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowDeleteModal(false);
                  setSelectedProduct(null);
                  setDeletionReason('');
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleDeleteProduct}
              >
                <Text style={styles.confirmButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal d'attribution de catégorie */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCategoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🏷️ Attribuer une catégorie</Text>
            <Text style={styles.modalSubtitle}>
              {productToCategorize?.name}
            </Text>
            
            <Text style={styles.inputLabel}>Sélectionner une catégorie</Text>
            <View style={styles.pickerContainerFull}>
              <Picker
                selectedValue={selectedCategoryId}
                onValueChange={(value: string) => setSelectedCategoryId(value)}
              >
                <Picker.Item label="-- Choisir une catégorie --" value="" />
                {categories.map(cat => (
                  <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
                ))}
              </Picker>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowCategoryModal(false);
                  setProductToCategorize(null);
                  setSelectedCategoryId('');
                }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleUpdateCategory}
                disabled={!selectedCategoryId}
              >
                <Text style={styles.confirmButtonText}>Valider</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  toolbar: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
  },
  clearButton: {
    padding: 8,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerContainer: {
    flex: 2,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
  },
  pickerContainerSmall: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
  },
  pickerContainerFull: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    height: 44,
    justifyContent: 'center',
    marginBottom: 20,
    width: '100%',
  },
  picker: {
    height: 44,
  },
  sortOrderButton: {
    width: 44,
    height: 44,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortOrderText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  exportButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  globalSummary: {
    backgroundColor: '#fff',
    margin: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  globalSummaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  globalSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  profitCard: {
    backgroundColor: '#e8f5e9',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryProfit: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  categoriesList: {
    flex: 1,
  },
  categoryCard: {
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fafafa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  categoryHeaderIcon: {
    fontSize: 20,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  warningBadge: {
    flexDirection: 'row',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  warningText: {
    fontSize: 10,
    color: '#FF9800',
  },
  categoryStatsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryStat: {
    fontSize: 12,
    color: '#666',
  },
  profitText: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  expandIcon: {
    fontSize: 12,
    color: '#666',
  },
  productsList: {
    padding: 12,
  },
  productRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  productHeader: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  productCell: {
    fontSize: 12,
    paddingHorizontal: 4,
  },
  codeCell: {
    width: '12%',
  },
  nameCell: {
    width: '25%',
  },
  qtyCell: {
    width: '8%',
    textAlign: 'right',
  },
  priceCell: {
    width: '10%',
    textAlign: 'right',
  },
  valueCell: {
    width: '12%',
    textAlign: 'right',
  },
  actionsCell: {
    width: '11%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  categoryButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  categoryTotalRow: {
    backgroundColor: '#f9f9f9',
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
  },
  totalText: {
    fontWeight: 'bold',
  },
  positive: {
    color: '#4CAF50',
  },
  negative: {
    color: '#F44336',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  footerText: {
    fontSize: 11,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    color: '#333',
  },
  modalInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmButton: {
    backgroundColor: '#F44336',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
});