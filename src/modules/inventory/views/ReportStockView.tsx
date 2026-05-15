// src/modules/inventory/views/ReportStockView.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Collapse,
  InputAdornment,
  useTheme,
  alpha,
  styled,
  SelectChangeEvent,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Warning as WarningIcon,
  Inventory as InventoryIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  PictureAsPdf as PdfIcon,
  Folder as FolderIcon,
  Store as StoreIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from 'notistack';
import api from '@/api/client';
import { formatCurrency } from '@/utils/formatters';

// Types
interface Product {
  id: string;
  name: string;
  commercial_name?: string;
  code: string;
  barcode?: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  category: string | null;
  branch_id?: string;
  pharmacy_id?: string;
  expiry_date?: string;
  stock_status?: string;
  is_active: boolean;
}

interface CategoryStats {
  categoryName: string;
  totalQuantity: number;
  totalPurchaseValue: number;
  totalSellingValue: number;
  totalProfit: number;
  productCount: number;
  products: Product[];
}

interface BranchInfo {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  is_main_branch: boolean;
  is_active: boolean;
  parent_pharmacy_id?: string;
}

interface ReportData {
  branch: BranchInfo;
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

interface ReportStockViewProps {
  pharmacyId?: string;
  branchId?: string;
}

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontSize: '0.75rem',
  padding: '8px 4px',
  [theme.breakpoints.up('sm')]: {
    padding: '8px 12px',
    fontSize: '0.8125rem',
  },
}));

const StyledTableRow = styled(TableRow)(({ theme }) => ({
  '&:nth-of-type(odd)': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
}));

// Composant de section de catégorie optimisé avec React.memo
const CategorySection = React.memo(({ 
  category, 
  expanded,
  onToggle,
  searchQuery,
  sortBy,
  sortOrder,
  onCategorize,
  onDelete
}: {
  category: CategoryStats;
  expanded: boolean;
  onToggle: () => void;
  searchQuery: string;
  sortBy: string;
  sortOrder: string;
  onCategorize: (product: Product) => void;
  onDelete: (product: Product) => void;
}) => {
  const [visibleCount, setVisibleCount] = useState(50);
  
  // Filtrer et trier les produits avec useMemo pour éviter les recalculs inutiles
  const filteredProducts = useMemo(() => {
    let filtered = [...category.products];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        (p.barcode && p.barcode.toLowerCase().includes(query))
      );
    }
    
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
  }, [category.products, searchQuery, sortBy, sortOrder]);
  
  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = visibleCount < filteredProducts.length;
  
  return (
    <Paper sx={{ mb: 2, overflow: 'hidden' }}>
      <Box
        sx={{
          p: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          bgcolor: category.categoryName === 'Sans catégorie' ? '#FFF3E0' : '#FAFAFA',
          '&:hover': { bgcolor: '#F0F0F0' },
        }}
        onClick={onToggle}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {category.categoryName === 'Sans catégorie' ? (
            <WarningIcon sx={{ color: '#FF9800' }} />
          ) : (
            <FolderIcon color="primary" />
          )}
          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
            {category.categoryName}
          </Typography>
          {category.categoryName === 'Sans catégorie' && (
            <Chip label="Sans catégorie" size="small" color="warning" variant="outlined" />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="textSecondary">
            {category.productCount} produits | {category.totalQuantity} unités
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'success.main' }}>
            Profit: {formatCurrency(category.totalProfit)}
          </Typography>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ p: 2 }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <StyledTableRow>
                  <StyledTableCell>Code</StyledTableCell>
                  <StyledTableCell>Produit</StyledTableCell>
                  <StyledTableCell align="right">Qté</StyledTableCell>
                  <StyledTableCell align="right">PA</StyledTableCell>
                  <StyledTableCell align="right">PV</StyledTableCell>
                  <StyledTableCell align="right">Val Achat</StyledTableCell>
                  <StyledTableCell align="right">Val Vente</StyledTableCell>
                  <StyledTableCell align="right">Profit</StyledTableCell>
                  <StyledTableCell align="center">Actions</StyledTableCell>
                </StyledTableRow>
              </TableHead>
              <TableBody>
                {visibleProducts.map(product => {
                  const purchaseValue = (product.quantity || 0) * (product.purchase_price || 0);
                  const sellingValue = (product.quantity || 0) * (product.selling_price || 0);
                  const profit = sellingValue - purchaseValue;

                  return (
                    <StyledTableRow key={product.id}>
                      <StyledTableCell>{product.code}</StyledTableCell>
                      <StyledTableCell>
                        <Tooltip title={product.name}>
                          <span>{product.name.length > 30 ? product.name.substring(0, 30) + '...' : product.name}</span>
                        </Tooltip>
                        {product.commercial_name && (
                          <Typography variant="caption" component="div" color="textSecondary">
                            {product.commercial_name}
                          </Typography>
                        )}
                      </StyledTableCell>
                      <StyledTableCell align="right">{product.quantity || 0}</StyledTableCell>
                      <StyledTableCell align="right">{formatCurrency(product.purchase_price || 0)}</StyledTableCell>
                      <StyledTableCell align="right">{formatCurrency(product.selling_price || 0)}</StyledTableCell>
                      <StyledTableCell align="right">{formatCurrency(purchaseValue)}</StyledTableCell>
                      <StyledTableCell align="right">{formatCurrency(sellingValue)}</StyledTableCell>
                      <StyledTableCell align="right" sx={{ color: profit >= 0 ? '#4CAF50' : '#F44336' }}>
                        {formatCurrency(profit)}
                      </StyledTableCell>
                      <StyledTableCell align="center">
                        {category.categoryName === 'Sans catégorie' && (
                          <Tooltip title="Attribuer une catégorie">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCategorize(product);
                              }}
                            >
                              <EditIcon fontSize="small" sx={{ color: '#4CAF50' }} />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip title="Supprimer">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(product);
                            }}
                          >
                            <DeleteIcon fontSize="small" sx={{ color: '#F44336' }} />
                          </IconButton>
                        </Tooltip>
                      </StyledTableCell>
                    </StyledTableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Bouton "Voir plus" pour charger progressivement */}
          {hasMore && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button 
                size="small" 
                variant="outlined"
                onClick={() => setVisibleCount(prev => prev + 50)}
                startIcon={<ExpandMoreIcon />}
              >
                Voir plus ({filteredProducts.length - visibleCount} restants)
              </Button>
            </Box>
          )}
          
          {/* Total de la catégorie */}
          <Box sx={{ mt: 2, p: 1.5, bgcolor: '#F5F5F5', borderRadius: 1, display: 'flex', justifyContent: 'flex-end', gap: 3, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Total achat: {formatCurrency(category.totalPurchaseValue)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
              Total vente: {formatCurrency(category.totalSellingValue)}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#4CAF50' }}>
              Profit: {formatCurrency(category.totalProfit)}
            </Typography>
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
});

CategorySection.displayName = 'CategorySection';

// Service API
const apiService = {
  async getProducts(params?: { 
    get_all?: boolean; 
    pharmacy_id?: string; 
    branch_id?: string;
    search?: string;
    limit?: number;
  }): Promise<Product[]> {
    const queryParams = new URLSearchParams();
    if (params?.get_all) queryParams.append('get_all', 'true');
    if (params?.pharmacy_id) queryParams.append('pharmacy_id', params.pharmacy_id);
    if (params?.branch_id) queryParams.append('branch_id', params.branch_id);
    if (params?.search) queryParams.append('search', params.search);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const response = await api.get(`/stock/?${queryParams.toString()}`);
    return response.data.products || [];
  },

  async deleteProduct(productId: string, reason?: string): Promise<{ success: boolean; message: string; trash_id?: string }> {
    const response = await api.delete(`/stock/${productId}`, {
      params: { deletion_reason: reason || 'Suppression depuis rapport' }
    });
    return response.data;
  },

  async updateProductCategory(productId: string, category: string): Promise<Product> {
    const response = await api.put(`/stock/${productId}`, { category });
    return response.data;
  },

  async getBranchInfo(branchId?: string): Promise<BranchInfo | null> {
    if (branchId) {
      try {
        const response = await api.get(`/branches/${branchId}`);
        return response.data;
      } catch (error) {
        console.warn('⚠️ Erreur chargement branche spécifique:', error);
      }
    }

    try {
      const response = await api.get('/branches/current');
      return response.data;
    } catch (error: any) {
      console.warn('⚠️ Erreur sur /branches/current:', error?.response?.status);
      
      try {
        const userResponse = await api.get('/users/me');
        const userBranchId = userResponse.data?.branch_id || userResponse.data?.active_branch_id;
        
        if (userBranchId) {
          const branchResponse = await api.get(`/branches/${userBranchId}`);
          return branchResponse.data;
        }
      } catch (fallbackError) {
        console.warn('⚠️ Fallback échoué:', fallbackError);
      }
      
      return null;
    }
  },

  async generatePdfReport(reportData: any): Promise<Blob> {
    const response = await api.post('/stock/reports/stock-pdf', reportData, {
      responseType: 'blob',
    });
    return response.data;
  }
};

export default function ReportStockView({ pharmacyId, branchId }: ReportStockViewProps) {
  const { user } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productToCategorize, setProductToCategorize] = useState<Product | null>(null);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'profit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exporting, setExporting] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<BranchInfo | null>(null);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Calcul des statistiques par catégorie - optimisé avec useMemo
  const calculateStatsByCategory = useCallback((
    productsList: Product[],
    branch: BranchInfo | null,
    currentUser: any
  ): ReportData => {
    const categoryMap = new Map<string, CategoryStats>();

    productsList.forEach(product => {
      const quantity = product.quantity || 0;
      const purchaseValue = quantity * (product.purchase_price || 0);
      const sellingValue = quantity * (product.selling_price || 0);
      const profit = sellingValue - purchaseValue;
      const categoryName = product.category && product.category.trim() !== '' 
        ? product.category.trim() 
        : 'Sans catégorie';

      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, {
          categoryName,
          totalQuantity: 0,
          totalPurchaseValue: 0,
          totalSellingValue: 0,
          totalProfit: 0,
          productCount: 0,
          products: [],
        });
      }

      const stats = categoryMap.get(categoryName)!;
      stats.totalQuantity += quantity;
      stats.totalPurchaseValue += purchaseValue;
      stats.totalSellingValue += sellingValue;
      stats.totalProfit += profit;
      stats.productCount += 1;
      stats.products.push({ ...product });
    });

    let uncategorized: CategoryStats | null = null;
    const categoriesArray: CategoryStats[] = [];

    for (const [name, stats] of categoryMap.entries()) {
      if (name === 'Sans catégorie') {
        uncategorized = stats;
      } else {
        categoriesArray.push(stats);
      }
    }

    categoriesArray.sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    const globalTotals = {
      totalQuantity: categoriesArray.reduce((sum, c) => sum + c.totalQuantity, 0) + (uncategorized?.totalQuantity || 0),
      totalPurchaseValue: categoriesArray.reduce((sum, c) => sum + c.totalPurchaseValue, 0) + (uncategorized?.totalPurchaseValue || 0),
      totalSellingValue: categoriesArray.reduce((sum, c) => sum + c.totalSellingValue, 0) + (uncategorized?.totalSellingValue || 0),
      totalProfit: categoriesArray.reduce((sum, c) => sum + c.totalProfit, 0) + (uncategorized?.totalProfit || 0),
      productCount: productsList.length,
    };

    return {
      branch: branch || {
        id: branchId || '',
        name: 'Branche',
        code: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        is_main_branch: false,
        is_active: true,
        parent_pharmacy_id: pharmacyId,
      },
      user: {
        name: currentUser?.nom_complet || currentUser?.email || 'Utilisateur',
        email: currentUser?.email || '',
        role: currentUser?.role || '',
      },
      date: new Date().toLocaleDateString('fr-FR'),
      categories: categoriesArray,
      uncategorized: uncategorized || {
        categoryName: 'Sans catégorie',
        totalQuantity: 0,
        totalPurchaseValue: 0,
        totalSellingValue: 0,
        totalProfit: 0,
        productCount: 0,
        products: [],
      },
      globalTotals,
    };
  }, [branchId, pharmacyId]);

  // Chargement des données avec limite pour performance
  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      // Charger les produits avec limite pour éviter de surcharger le frontend
      const productsData = await apiService.getProducts({ 
        get_all: true,
        pharmacy_id: pharmacyId,
        branch_id: branchId,
        limit: 4000 // Limite à 4000 produits pour les performances
      });

      setAllProducts(productsData);

      // Extraire les catégories uniques
      const uniqueCategories = Array.from(
        new Set(
          productsData
            .filter(p => p.category && p.category.trim() !== '')
            .map(p => p.category as string)
        )
      ).sort();
      setAvailableCategories(uniqueCategories);

      // Charger la branche
      let branchData: BranchInfo | null = null;
      
      if (branchId) {
        branchData = await apiService.getBranchInfo(branchId);
      }
      
      if (!branchData) {
        branchData = await apiService.getBranchInfo();
      }

      if (!branchData && user) {
        branchData = {
          id: branchId || user?.branch_id || '',
          name: user?.branch_name || user?.nom_complet?.split(' ')[0] || 'Branche',
          code: '',
          address: '',
          city: '',
          phone: '',
          email: user?.email || '',
          is_main_branch: false,
          is_active: true,
          parent_pharmacy_id: pharmacyId,
        };
      }

      setCurrentBranch(branchData);

      // Calculer les statistiques
      const stats = calculateStatsByCategory(productsData, branchData, user);
      setReportData(stats);
      
    } catch (error) {
      console.error('❌ Erreur chargement données:', error);
      enqueueSnackbar('Impossible de charger les données du stock', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [user, enqueueSnackbar, pharmacyId, branchId, calculateStatsByCategory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const result = await apiService.deleteProduct(selectedProduct.id, deletionReason);

      if (result.success) {
        enqueueSnackbar(result.message, { variant: 'success' });
        setDeleteDialogOpen(false);
        setSelectedProduct(null);
        setDeletionReason('');
        loadData();
      } else {
        enqueueSnackbar(result.message, { variant: 'error' });
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
      enqueueSnackbar('Impossible de supprimer le produit', { variant: 'error' });
    }
  };

  const handleUpdateCategory = async () => {
    if (!productToCategorize || !newCategoryName.trim()) return;

    try {
      await apiService.updateProductCategory(productToCategorize.id, newCategoryName.trim());
      enqueueSnackbar('Catégorie mise à jour avec succès', { variant: 'success' });
      setCategoryDialogOpen(false);
      setProductToCategorize(null);
      setNewCategoryName('');
      loadData();
    } catch (error) {
      console.error('Erreur mise à jour catégorie:', error);
      enqueueSnackbar('Impossible de mettre à jour la catégorie', { variant: 'error' });
    }
  };

  const exportToPDF = async () => {
    if (!reportData) return;
    setExporting(true);

    try {
      const requestData = {
        branch: reportData.branch,
        user: reportData.user,
        categories: reportData.categories.map(cat => ({
          categoryName: cat.categoryName,
          totalQuantity: cat.totalQuantity,
          totalPurchaseValue: cat.totalPurchaseValue,
          totalSellingValue: cat.totalSellingValue,
          totalProfit: cat.totalProfit,
          productCount: cat.productCount,
          products: cat.products.slice(0, 500).map(p => ({  // Limiter pour le PDF
            id: p.id,
            name: p.name,
            code: p.code,
            quantity: p.quantity,
            purchase_price: p.purchase_price,
            selling_price: p.selling_price,
            category: p.category
          }))
        })),
        uncategorized: reportData.uncategorized,
        globalTotals: reportData.globalTotals,
        pharmacy_id: pharmacyId,
        branch_id: branchId,
      };

      const pdfBlob = await apiService.generatePdfReport(requestData);
      
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_stock_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      enqueueSnackbar('PDF généré avec succès', { variant: 'success' });
    } catch (error: any) {
      console.error('Erreur export PDF:', error);
      enqueueSnackbar('Impossible de générer le PDF: ' + (error.message || 'Erreur inconnue'), { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const toggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryName)) {
        next.delete(categoryName);
      } else {
        next.add(categoryName);
      }
      return next;
    });
  }, []);

  const totalProductsCount = allProducts.length;
  const branchName = currentBranch?.name || 'Branche';
  const branchCode = currentBranch?.code || '';

  // Filtrer les catégories à afficher avec useMemo
  const categoriesToDisplay = useMemo(() => {
    if (!reportData) return [];
    
    const allCats = [...reportData.categories];
    if (selectedCategory === 'all') {
      return allCats;
    }
    if (selectedCategory === 'uncategorized') {
      return reportData.uncategorized.productCount > 0 ? [reportData.uncategorized] : [];
    }
    const found = allCats.find(c => c.categoryName === selectedCategory);
    return found ? [found] : [];
  }, [reportData, selectedCategory]);

  const activeFilters = [];
  if (pharmacyId) activeFilters.push(`Pharmacie: ${pharmacyId.substring(0, 8)}...`);
  if (branchId) activeFilters.push(`Branche: ${branchId.substring(0, 8)}...`);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Chargement du rapport...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 2, bgcolor: theme.palette.primary.main, color: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <InventoryIcon fontSize="large" />
              Rapport de Stock - {branchName}
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9, mt: 1 }}>
              par catégorie | Total produits: {totalProductsCount}
            </Typography>
            {activeFilters.length > 0 && (
              <Typography variant="caption" sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}>
                Filtres actifs: {activeFilters.join(' • ')}
              </Typography>
            )}
          </Box>
          {branchCode && (
            <Chip 
              icon={<StoreIcon />} 
              label={`Code: ${branchCode}`} 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: '#fff',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }} 
            />
          )}
        </Box>
      </Paper>

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Rechercher un produit..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearchQuery('')}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Catégorie</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e: SelectChangeEvent) => setSelectedCategory(e.target.value)}
                label="Catégorie"
              >
                <MenuItem value="all">📁 Toutes les catégories</MenuItem>
                {availableCategories.map(cat => (
                  <MenuItem key={cat} value={cat}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CategoryIcon fontSize="small" />
                      {cat}
                    </Box>
                  </MenuItem>
                ))}
                <MenuItem value="uncategorized">⚠️ Sans catégorie</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={3} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Trier par</InputLabel>
              <Select
                value={sortBy}
                onChange={(e: SelectChangeEvent) => setSortBy(e.target.value as any)}
                label="Trier par"
              >
                <MenuItem value="name">Nom</MenuItem>
                <MenuItem value="quantity">Quantité</MenuItem>
                <MenuItem value="profit">Profit</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={3} md={2}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑ Croissant' : '↓ Décroissant'}
            </Button>
          </Grid>

          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              color="success"
              onClick={exportToPDF}
              disabled={exporting}
              startIcon={exporting ? <CircularProgress size={20} /> : <PdfIcon />}
            >
              PDF
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Global Summary */}
      {reportData && (
        <Paper sx={{ p: 3, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <TrendingUpIcon color="primary" />
            Résumé global
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: 'center', bgcolor: '#E3F2FD' }}>
                <CardContent>
                  <InventoryIcon color="primary" />
                  <Typography variant="caption" component="div">Produits</Typography>
                  <Typography variant="h6">{reportData.globalTotals.productCount}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: 'center', bgcolor: '#FFF3E0' }}>
                <CardContent>
                  <InventoryIcon color="warning" />
                  <Typography variant="caption" component="div">Unités</Typography>
                  <Typography variant="h6">{reportData.globalTotals.totalQuantity}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: 'center', bgcolor: '#E8F5E9' }}>
                <CardContent>
                  <MoneyIcon color="success" />
                  <Typography variant="caption" component="div">Valeur achat</Typography>
                  <Typography variant="body2">{formatCurrency(reportData.globalTotals.totalPurchaseValue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Card sx={{ textAlign: 'center', bgcolor: '#E8EAF6' }}>
                <CardContent>
                  <MoneyIcon color="info" />
                  <Typography variant="caption" component="div">Valeur vente</Typography>
                  <Typography variant="body2">{formatCurrency(reportData.globalTotals.totalSellingValue)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={8} md={4}>
              <Card sx={{ textAlign: 'center', bgcolor: '#C8E6C9' }}>
                <CardContent>
                  <TrendingUpIcon sx={{ color: '#2E7D32' }} />
                  <Typography variant="caption" component="div">Profit potentiel</Typography>
                  <Typography variant="h6" sx={{ color: '#2E7D32' }}>
                    {formatCurrency(reportData.globalTotals.totalProfit)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Categories List - Version optimisée avec CategorySection */}
      <Box>
        {categoriesToDisplay.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <InventoryIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              Aucune catégorie trouvée
            </Typography>
            <Typography variant="body2" color="text.disabled">
              {searchQuery 
                ? 'Aucun produit ne correspond à votre recherche' 
                : 'Aucun produit dans cette catégorie'}
            </Typography>
          </Paper>
        ) : (
          categoriesToDisplay.map(category => (
            <CategorySection
              key={category.categoryName}
              category={category}
              expanded={expandedCategories.has(category.categoryName)}
              onToggle={() => toggleCategory(category.categoryName)}
              searchQuery={searchQuery}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onCategorize={(product) => {
                setProductToCategorize(product);
                setCategoryDialogOpen(true);
              }}
              onDelete={(product) => {
                setSelectedProduct(product);
                setDeleteDialogOpen(true);
              }}
            />
          ))
        )}
      </Box>

      {/* Footer */}
      <Paper sx={{ p: 2, textAlign: 'center', bgcolor: '#FAFAFA' }}>
        <Typography variant="caption" color="textSecondary" component="div">
          📅 Rapport généré le {new Date().toLocaleString('fr-FR')}
        </Typography>
        <Typography variant="caption" color="textSecondary" component="div">
          👤 {user?.nom_complet || user?.email}
        </Typography>
        {currentBranch?.city && (
          <Typography variant="caption" color="textSecondary" component="div">
            📍 {currentBranch.name} - {currentBranch.city}
          </Typography>
        )}
        {(pharmacyId || branchId) && (
          <Typography variant="caption" color="textSecondary" component="div" sx={{ mt: 0.5 }}>
            🔍 Filtré par: {pharmacyId && `Pharmacie ${pharmacyId.substring(0, 8)}...`} {branchId && `Branche ${branchId.substring(0, 8)}...`}
          </Typography>
        )}
      </Paper>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>🗑️ Supprimer le produit</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            {selectedProduct?.name} ({selectedProduct?.code})
          </Typography>
          <TextField
            fullWidth
            label="Raison de la suppression (optionnel)"
            value={deletionReason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeletionReason(e.target.value)}
            multiline
            rows={3}
            margin="normal"
            placeholder="Ex: Produit périmé, fin de série..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleDeleteProduct} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>🏷️ Attribuer une catégorie</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" color="primary" gutterBottom>
            {productToCategorize?.name}
          </Typography>
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Choisir une catégorie existante</InputLabel>
            <Select
              value={newCategoryName}
              onChange={(e: SelectChangeEvent) => setNewCategoryName(e.target.value)}
              label="Choisir une catégorie existante"
            >
              <MenuItem value="">-- Choisir --</MenuItem>
              {availableCategories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Typography variant="body2" color="textSecondary" sx={{ my: 1, textAlign: 'center' }}>
            — OU —
          </Typography>
          
          <TextField
            fullWidth
            label="Nouvelle catégorie"
            value={newCategoryName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategoryName(e.target.value)}
            placeholder="Ex: Antibiotiques, Pansements, ..."
            helperText="Vous pouvez créer une nouvelle catégorie en tapant son nom"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleUpdateCategory} variant="contained" disabled={!newCategoryName.trim()}>
            Valider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}