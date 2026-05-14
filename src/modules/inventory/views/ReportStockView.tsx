// src/modules/inventory/views/ReportStockView.tsx
import React, { useState, useEffect, useCallback } from 'react';
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
} from '@mui/icons-material';
import { useAuthStore } from '@/store/useAuthStore';
import { useSnackbar } from 'notistack';
import api from '@/api/client';
import { formatCurrency } from '@/utils/formatters';

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

const apiService = {
  async getCategories(): Promise<Category[]> {
    const response = await api.get('/stock/categories/simple');
    return response.data;
  },

  async getProducts(params?: { category_id?: string; get_all?: boolean }): Promise<Product[]> {
    const queryParams = new URLSearchParams();
    if (params?.category_id) queryParams.append('category_id', params.category_id);
    if (params?.get_all) queryParams.append('get_all', 'true');

    const response = await api.get(`/stock/?${queryParams.toString()}`);
    return response.data.products || [];
  },

  async deleteProduct(productId: string, reason?: string): Promise<{ success: boolean; message: string; trash_id?: string }> {
    const response = await api.delete(`/stock/${productId}`, {
      params: { deletion_reason: reason || 'Suppression depuis rapport' }
    });
    return response.data;
  },

  async updateProduct(productId: string, data: Partial<Product>): Promise<Product> {
    const response = await api.put(`/stock/${productId}`, data);
    return response.data;
  },

  // ✅ CORRIGÉ : Récupérer la branche au lieu de la pharmacie
  async getCurrentBranch(): Promise<BranchInfo> {
    try {
      // Essayer l'endpoint branch/current s'il existe
      const response = await api.get('/branches/current');
      return response.data;
    } catch (error: any) {
      // Fallback : récupérer la première branche active
      if (error.response?.status === 404 || error.response?.status === 400) {
        const branchesResponse = await api.get('/branches/', {
          params: { limit: 1, is_active: true }
        });
        
        if (branchesResponse.data?.items?.length > 0) {
          return branchesResponse.data.items[0];
        }
      }
      throw error;
    }
  },
};

export default function ReportStockView() {
  const { user } = useAuthStore();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [deletionReason, setDeletionReason] = useState('');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [productToCategorize, setProductToCategorize] = useState<Product | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'profit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [exporting, setExporting] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<BranchInfo | null>(null);
  

  const loadData = useCallback(async () => {
  try {
    setLoading(true);

    // Charger les catégories et produits en parallèle
    const [categoriesData, productsData] = await Promise.all([
      apiService.getCategories(),
      apiService.getProducts({ get_all: true }),
    ]);

    setCategories(categoriesData);
    setAllProducts(productsData);

    // Charger la branche séparément avec gestion d'erreur robuste
    let branchData: BranchInfo | null = null;
    
    try {
      branchData = await apiService.getCurrentBranch();
    } catch (branchError: any) {
      console.warn('⚠️ Impossible de charger les infos de la branche:', branchError?.response?.data || branchError);
    }

    // Si la branche n'a pas pu être chargée, utiliser une valeur par défaut
    if (!branchData) {
      branchData = {
        id: user?.branch_id || '',
        name: user?.branch_name || user?.nom_complet || 'Branche',
        code: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        is_main_branch: false,
        is_active: true,
      };
    }

    setCurrentBranch(branchData);

    // Calculer les statistiques avec les données chargées
    const stats = calculateStatsByCategory(productsData, categoriesData, branchData, user);
    setReportData(stats);
    
  } catch (error) {
    console.error('❌ Erreur chargement données:', error);
    enqueueSnackbar('Impossible de charger les données du stock', { variant: 'error' });
  } finally {
    setLoading(false);
  }
}, [user, enqueueSnackbar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateStatsByCategory = (
    productsListData: Product[],
    categoriesList: Category[],
    branch: BranchInfo | null,
    currentUser: any
  ): ReportData => {
    const categoryMap = new Map<string, CategoryStats>();

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

    let globalTotals = {
      totalQuantity: 0,
      totalPurchaseValue: 0,
      totalSellingValue: 0,
      totalProfit: 0,
      productCount: 0,
    };

    productsListData.forEach(product => {
      const quantity = product.quantity || 0;
      const purchaseValue = quantity * (product.purchase_price || 0);
      const sellingValue = quantity * (product.selling_price || 0);
      const profit = sellingValue - purchaseValue;

      const productWithStats = { ...product };

      globalTotals.totalQuantity += quantity;
      globalTotals.totalPurchaseValue += purchaseValue;
      globalTotals.totalSellingValue += sellingValue;
      globalTotals.totalProfit += profit;
      globalTotals.productCount += 1;

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

    const categoriesArray = Array.from(categoryMap.values())
      .filter(cat => cat.productCount > 0)
      .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

    return {
      branch: branch || {
        id: '',
        name: 'Branche',
        code: '',
        address: '',
        city: '',
        phone: '',
        email: '',
        is_main_branch: false,
        is_active: true,
      },
      user: {
        name: currentUser?.nom_complet || currentUser?.email || 'Utilisateur',
        email: currentUser?.email || '',
        role: currentUser?.role || '',
      },
      date: new Date().toLocaleDateString('fr-FR'),
      categories: categoriesArray,
      uncategorized,
      globalTotals,
    };
  };

  const getFilteredProducts = (productsListData: Product[]): Product[] => {
    let filtered = [...productsListData];

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
  };

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
    if (!productToCategorize || !selectedCategoryId) return;

    try {
      await apiService.updateProduct(productToCategorize.id, { category_id: selectedCategoryId });
      enqueueSnackbar('Catégorie mise à jour avec succès', { variant: 'success' });
      setCategoryDialogOpen(false);
      setProductToCategorize(null);
      setSelectedCategoryId('');
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
      const response = await api.post('/reports/stock-pdf', reportData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rapport_stock_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      enqueueSnackbar('PDF généré avec succès', { variant: 'success' });
    } catch (error) {
      console.error('Erreur export PDF:', error);
      enqueueSnackbar('Impossible de générer le PDF', { variant: 'error' });
    } finally {
      setExporting(false);
    }
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

  const totalProductsCount = allProducts.length;
  const branchName = currentBranch?.name || 'Branche';
  const branchCode = currentBranch?.code || '';

  const filteredCategories = reportData?.categories.filter(cat => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'uncategorized') return cat.categoryId === 'uncategorized';
    return cat.categoryId === selectedCategory;
  }) || [];

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
                <MenuItem value="all">Toutes les catégories</MenuItem>
                {categories.map(cat => (
                  <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
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

      {/* Categories List */}
      <Box>
        {filteredCategories.length === 0 ? (
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
          filteredCategories.map(category => (
            <Paper key={category.categoryId} sx={{ mb: 2, overflow: 'hidden' }}>
              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  bgcolor: category.categoryId === 'uncategorized' ? '#FFF3E0' : '#FAFAFA',
                  '&:hover': { bgcolor: '#F0F0F0' },
                }}
                onClick={() => toggleCategory(category.categoryId)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {category.categoryId === 'uncategorized' ? (
                    <WarningIcon sx={{ color: '#FF9800' }} />
                  ) : (
                    <FolderIcon color="primary" />
                  )}
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {category.categoryName}
                  </Typography>
                  {category.categoryId === 'uncategorized' && (
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
                  {expandedCategories.has(category.categoryId) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
              </Box>

              <Collapse in={expandedCategories.has(category.categoryId)}>
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
                        {getFilteredProducts(category.products).map(product => {
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
                                {category.categoryId === 'uncategorized' && (
                                  <Tooltip title="Attribuer une catégorie">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProductToCategorize(product);
                                        setCategoryDialogOpen(true);
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
                                      setSelectedProduct(product);
                                      setDeleteDialogOpen(true);
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" sx={{ color: '#F44336' }} />
                                  </IconButton>
                                </Tooltip>
                              </StyledTableCell>
                            </StyledTableRow>
                          );
                        })}

                        {/* Category Total Row */}
                        <StyledTableRow sx={{ bgcolor: '#F5F5F5' }}>
                          <StyledTableCell colSpan={5}>
                            <Typography sx={{ fontWeight: 'bold' }}>Totaux {category.categoryName}</Typography>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <Typography sx={{ fontWeight: 'bold' }}>{formatCurrency(category.totalPurchaseValue)}</Typography>
                          </StyledTableCell>
                          <StyledTableCell align="right">
                            <Typography sx={{ fontWeight: 'bold' }}>{formatCurrency(category.totalSellingValue)}</Typography>
                          </StyledTableCell>
                          <StyledTableCell align="right" sx={{ color: '#4CAF50' }}>
                            <Typography sx={{ fontWeight: 'bold' }}>{formatCurrency(category.totalProfit)}</Typography>
                          </StyledTableCell>
                          <StyledTableCell />
                        </StyledTableRow>
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </Collapse>
            </Paper>
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
            <InputLabel>Catégorie</InputLabel>
            <Select
              value={selectedCategoryId}
              onChange={(e: SelectChangeEvent) => setSelectedCategoryId(e.target.value)}
              label="Catégorie"
            >
              <MenuItem value="">-- Choisir une catégorie --</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleUpdateCategory} variant="contained" disabled={!selectedCategoryId}>
            Valider
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}