// SellerReport.tsx
// Rapport de vente et stock par utilisateur (vendeur/caissier)

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
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
  IconButton,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TextField,
  InputAdornment,
  Alert,
  Tabs,
  Tab,
  Divider,
  Tooltip,
  Avatar,
  LinearProgress,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  TrendingUp as TrendingUpIcon,
  Inventory as InventoryIcon,
  ShoppingCart as ShoppingCartIcon,
  AttachMoney as MoneyIcon,
  Person as PersonIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Print as PrintIcon,
  Visibility as VisibilityIcon,
  DateRange as DateRangeIcon,
} from '@mui/icons-material';

// Importer les utilitaires de date - TOUS sont utilisés
import {
  formatDate,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isSameDay,
  formatPeriod,
  now,
  differenceInDays,
  newDate,
} from '@/utils/date';

// Types
interface Seller {
  id: string;
  email: string;
  nom_complet: string;
  role: string;
  is_active: boolean;
}

interface ProductSalesItem {
  product_id: string;
  product_code: string;
  product_name: string;
  unit: string;
  initial_stock: number;
  sold_quantity: number;
  sold_revenue: number;
  borrowed_quantity: number;
  borrowed_value: number;
  remaining_stock: number;
  remaining_value: number;
  average_price: number;
  alert_threshold: number;
  stock_status: 'out_of_stock' | 'low_stock' | 'normal';
  expiry_status?: 'expired' | 'critical' | 'warning' | 'normal';
  expiry_date?: string;
}

interface SellerStats {
  seller_id: string;
  seller_name: string;
  seller_role: string;
  total_sales_count: number;
  total_quantity_sold: number;
  total_revenue: number;
  total_credit_sales: number;
  total_cash_sales: number;
  total_products_handled: number;
  average_basket: number;
  top_products: ProductSalesItem[];
  products: ProductSalesItem[];
  performance_score: number;
}

interface PeriodSummary {
  total_sellers: number;
  total_revenue: number;
  total_quantity_sold: number;
  total_sales_count: number;
  total_initial_stock_value: number;
  total_remaining_stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_soon_count: number;
}

interface ApiResponse {
  success: boolean;
  period: string;
  start_date: string;
  end_date: string;
  sellers: SellerStats[];
  summary: PeriodSummary;
}

// Service API
const API_BASE = '/api/v1';

const apiService = {
  getSellers: async (pharmacyId?: string): Promise<Seller[]> => {
    const url = pharmacyId 
      ? `${API_BASE}/stock/sellers/${pharmacyId}`
      : `${API_BASE}/stock/sellers`;
    const response = await fetch(url);
    const data = await response.json();
    return data.sellers || [];
  },

  getSellerSalesReport: async (
    sellerId: string,
    startDate: string,
    endDate: string,
    branchId?: string
  ): Promise<SellerStats> => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    if (branchId) params.append('branch_id', branchId);
    
    const response = await fetch(
      `${API_BASE}/stock/seller-report/${sellerId}?${params}`
    );
    if (!response.ok) throw new Error('Erreur lors du chargement du rapport');
    return response.json();
  },

  getAllSellersReport: async (
    startDate: string,
    endDate: string,
    branchId?: string,
    sellerId?: string
  ): Promise<ApiResponse> => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });
    if (branchId) params.append('branch_id', branchId);
    if (sellerId) params.append('seller_id', sellerId);
    
    const response = await fetch(
      `${API_BASE}/stock/sellers-report?${params}`
    );
    if (!response.ok) throw new Error('Erreur lors du chargement du rapport');
    return response.json();
  },

  exportReport: async (
    startDate: string,
    endDate: string,
    format: 'excel' | 'csv' | 'pdf',
    sellerId?: string
  ): Promise<Blob> => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      format,
    });
    if (sellerId) params.append('seller_id', sellerId);
    
    const response = await fetch(
      `${API_BASE}/stock/export-seller-report?${params}`,
      { method: 'GET' }
    );
    if (!response.ok) throw new Error('Erreur lors de l\'export');
    return response.blob();
  },
};

// Composant de carte de statistiques
const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  trend?: number;
  tooltip?: string;
}> = ({ title, value, icon, color = '#1976d2', trend, tooltip }) => (
  <Tooltip title={tooltip || title}>
    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" component="div" fontWeight="bold">
              {typeof value === 'number' && title.includes('FC') 
                ? new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(value)
                : value}
            </Typography>
            {trend !== undefined && (
              <Typography variant="caption" color={trend >= 0 ? 'success.main' : 'error.main'}>
                {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
              </Typography>
            )}
          </Box>
          <Avatar sx={{ bgcolor: alpha(color, 0.1), color: color }}>
            {icon}
          </Avatar>
        </Box>
      </CardContent>
    </Card>
  </Tooltip>
);

// Composant de ligne de produit
const ProductRow: React.FC<{ product: ProductSalesItem; showExpiry?: boolean }> = ({ 
  product, 
  showExpiry = false 
}) => {
  const getStockStatusChip = () => {
    switch (product.stock_status) {
      case 'out_of_stock':
        return <Chip size="small" color="error" label="Rupture" icon={<WarningIcon />} />;
      case 'low_stock':
        return <Chip size="small" color="warning" label="Stock faible" />;
      default:
        return <Chip size="small" color="success" label="Normal" />;
    }
  };

  const getExpiryStatusChip = () => {
    if (!product.expiry_date) return null;
    switch (product.expiry_status) {
      case 'expired':
        return <Chip size="small" color="error" label="Expiré" />;
      case 'critical':
        return <Chip size="small" color="warning" label="Expire bientôt" />;
      case 'warning':
        return <Chip size="small" color="info" label="Expiration proche" />;
      default:
        return null;
    }
  };

  // Utilisation de fonctions date pour les calculs d'expiration
  const daysUntilExpiry = product.expiry_date 
    ? differenceInDays(product.expiry_date, now())
    : null;
  
  const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;

  return (
    <TableRow hover>
      <TableCell>{product.product_code}</TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight="medium">
          {product.product_name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {product.unit}
        </Typography>
      </TableCell>
      <TableCell align="right">{product.initial_stock}</TableCell>
      <TableCell align="right">
        <Box>
          <Typography variant="body2">{product.sold_quantity}</Typography>
          <Typography variant="caption" color="text.secondary">
            {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(product.sold_revenue)}
          </Typography>
        </Box>
      </TableCell>
      <TableCell align="right">
        {product.borrowed_quantity > 0 ? (
          <Box>
            <Typography variant="body2" color="warning.main">
              {product.borrowed_quantity}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(product.borrowed_value)}
            </Typography>
          </Box>
        ) : '-'}
      </TableCell>
      <TableCell align="right">
        <Typography variant="body2" fontWeight="medium">
          {product.remaining_stock}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(product.remaining_value)}
        </Typography>
      </TableCell>
      <TableCell align="center">{getStockStatusChip()}</TableCell>
      {showExpiry && (
        <TableCell align="center">
          {getExpiryStatusChip()}
          {product.expiry_date && (
            <Tooltip title={`Expire dans ${daysUntilExpiry} jours`}>
              <Typography variant="caption" display="block" color={isExpiringSoon ? 'error.main' : 'text.secondary'}>
                {formatDate(product.expiry_date)}
              </Typography>
            </Tooltip>
          )}
        </TableCell>
      )}
    </TableRow>
  );
};

// Composant principal
const SellerReport: React.FC = () => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('week');
  const [customStartDate, setCustomStartDate] = useState<Date | null>(startOfMonth(now()));
  const [customEndDate, setCustomEndDate] = useState<Date | null>(now());
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [reportData, setReportData] = useState<ApiResponse | null>(null);
  const [selectedSellerStats, setSelectedSellerStats] = useState<SellerStats | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Calculer les dates par défaut
  const getDefaultDates = useCallback(() => {
    const nowDate = now();
    
    switch (period) {
      case 'today':
        return { start: startOfDay(nowDate), end: endOfDay(nowDate) };
      case 'week':
        return { start: startOfWeek(nowDate), end: endOfWeek(nowDate) };
      case 'month':
        return { start: startOfMonth(nowDate), end: endOfMonth(nowDate) };
      case 'year':
        return { start: startOfYear(nowDate), end: endOfYear(nowDate) };
      default:
        return { 
          start: customStartDate || startOfMonth(nowDate), 
          end: customEndDate || nowDate 
        };
    }
  }, [period, customStartDate, customEndDate]);

  // Charger la liste des vendeurs
  useEffect(() => {
    const loadSellers = async () => {
      try {
        const sellersList = await apiService.getSellers();
        setSellers(sellersList);
        if (sellersList.length > 0 && !selectedSellerId) {
          setSelectedSellerId(sellersList[0].id);
        }
      } catch (err) {
        console.error('Erreur chargement vendeurs:', err);
      }
    };
    loadSellers();
  }, []);

  // Charger le rapport
  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { start, end } = getDefaultDates();
      const startStr = formatDate(start, 'YYYY-MM-DD');
      const endStr = formatDate(end, 'YYYY-MM-DD');
      
      const response = await apiService.getAllSellersReport(startStr, endStr, undefined, selectedSellerId || undefined);
      setReportData(response);
      
      if (selectedSellerId && response.sellers) {
        const sellerStats = response.sellers.find(s => s.seller_id === selectedSellerId);
        setSelectedSellerStats(sellerStats || null);
      } else if (response.sellers && response.sellers.length > 0) {
        setSelectedSellerStats(response.sellers[0]);
        setSelectedSellerId(response.sellers[0].seller_id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du rapport');
    } finally {
      setLoading(false);
    }
  }, [period, customStartDate, customEndDate, selectedSellerId, getDefaultDates]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Exporter le rapport
  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    try {
      const { start, end } = getDefaultDates();
      const blob = await apiService.exportReport(
        formatDate(start, 'YYYY-MM-DD'),
        formatDate(end, 'YYYY-MM-DD'),
        format,
        selectedSellerId || undefined
      );
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapport_ventes_${formatDate(now(), 'YYYY-MM-DD_HH-mm-ss')}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Erreur lors de l\'export');
    }
  };

  // Filtrer les produits
  const filteredProducts = selectedSellerStats?.products?.filter(p =>
    p.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.product_code.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const summary = reportData?.summary;
  const sellersList = reportData?.sellers || [];
  
  const { start, end } = getDefaultDates();
  const periodText = formatPeriod(start, end);

  // Calcul des statistiques additionnelles avec les fonctions date
  const periodDuration = differenceInDays(end, start);
  const isCurrentWeek = isSameDay(start, startOfWeek(now())) && isSameDay(end, endOfWeek(now()));
  const isCurrentMonth = isSameDay(start, startOfMonth(now())) && isSameDay(end, endOfMonth(now()));

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <LinearProgress />
        <Typography sx={{ mt: 2, textAlign: 'center' }}>Chargement du rapport...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* En-tête */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Rapport de vente par utilisateur
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Suivi des ventes et impact sur le stock - {periodText}
              {periodDuration > 0 && ` (${periodDuration} jours)`}
              {isCurrentWeek && ' - Semaine en cours'}
              {isCurrentMonth && ' - Mois en cours'}
            </Typography>
          </Box>
          
          <Box display="flex" gap={1}>
            <Button
              variant="outlined"
              startIcon={<PrintIcon />}
              onClick={() => handleExport('pdf')}
            >
              PDF
            </Button>
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={() => handleExport('excel')}
            >
              Excel
            </Button>
            <IconButton onClick={loadReport}>
              <RefreshIcon />
            </IconButton>
          </Box>
        </Box>
      </Paper>

      {/* Filtres */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Période</InputLabel>
              <Select
                value={period}
                label="Période"
                onChange={(e) => setPeriod(e.target.value as typeof period)}
              >
                <MenuItem value="today">Aujourd'hui</MenuItem>
                <MenuItem value="week">Cette semaine</MenuItem>
                <MenuItem value="month">Ce mois</MenuItem>
                <MenuItem value="year">Cette année</MenuItem>
                <MenuItem value="custom">Personnalisée</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Vendeur</InputLabel>
              <Select
                value={selectedSellerId}
                label="Vendeur"
                onChange={(e) => setSelectedSellerId(e.target.value)}
              >
                <MenuItem value="">Tous les vendeurs</MenuItem>
                {sellers.map((seller) => (
                  <MenuItem key={seller.id} value={seller.id}>
                    {seller.nom_complet} ({seller.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          {period === 'custom' && (
            <>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Date début"
                  value={customStartDate ? formatDate(customStartDate, 'YYYY-MM-DD') : ''}
                  onChange={(e) => setCustomStartDate(newDate(parseInt(e.target.value.split('-')[0]), parseInt(e.target.value.split('-')[1]), parseInt(e.target.value.split('-')[2])))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Date fin"
                  value={customEndDate ? formatDate(customEndDate, 'YYYY-MM-DD') : ''}
                  onChange={(e) => setCustomEndDate(newDate(parseInt(e.target.value.split('-')[0]), parseInt(e.target.value.split('-')[1]), parseInt(e.target.value.split('-')[2])))}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Cartes de résumé */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Vendeurs actifs"
              value={sellersList.length}
              icon={<PersonIcon />}
              color={theme.palette.info.main}
              tooltip="Nombre total de vendeurs actifs sur la période"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Chiffre d'affaires"
              value={summary.total_revenue}
              icon={<MoneyIcon />}
              color={theme.palette.success.main}
              tooltip="Chiffre d'affaires total FC"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Ventes"
              value={summary.total_sales_count}
              icon={<ShoppingCartIcon />}
              color={theme.palette.primary.main}
              tooltip="Nombre total de transactions"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Quantité vendue"
              value={summary.total_quantity_sold}
              icon={<TrendingUpIcon />}
              color={theme.palette.warning.main}
              tooltip="Quantité totale d'articles vendus"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Valeur stock initial"
              value={summary.total_initial_stock_value}
              icon={<InventoryIcon />}
              color={theme.palette.grey[600]}
              tooltip="Valeur totale du stock en début de période"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Valeur stock restant"
              value={summary.total_remaining_stock_value}
              icon={<CheckCircleIcon />}
              color={theme.palette.success.light}
              tooltip="Valeur totale du stock restant"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Stock faible"
              value={summary.low_stock_count}
              icon={<WarningIcon />}
              color={theme.palette.warning.main}
              tooltip="Nombre de produits avec stock bas"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Expirations proches"
              value={summary.expiring_soon_count}
              icon={<DateRangeIcon />}
              color={theme.palette.error.main}
              tooltip="Produits expirant dans moins de 30 jours"
            />
          </Grid>
        </Grid>
      )}

      {/* Liste des vendeurs avec leurs performances */}
      <Paper sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Typography variant="subtitle1" sx={{ p: 2, bgcolor: theme.palette.grey[100], fontWeight: 'bold' }}>
          Performance par vendeur
        </Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: theme.palette.grey[50] }}>
                <TableCell>Vendeur</TableCell>
                <TableCell align="right">Ventes</TableCell>
                <TableCell align="right">CA (FC)</TableCell>
                <TableCell align="right">Qté vendue</TableCell>
                <TableCell align="right">Panier moyen</TableCell>
                <TableCell align="right">Score</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sellersList.map((seller) => (
                <TableRow 
                  key={seller.seller_id}
                  hover
                  sx={{ 
                    cursor: 'pointer',
                    bgcolor: selectedSellerId === seller.seller_id ? alpha(theme.palette.primary.main, 0.05) : 'inherit'
                  }}
                  onClick={() => {
                    setSelectedSellerId(seller.seller_id);
                    setSelectedSellerStats(seller);
                    setActiveTab(1);
                  }}
                >
                  <TableCell>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Avatar sx={{ width: 32, height: 32, bgcolor: theme.palette.primary.main }}>
                        {seller.seller_name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {seller.seller_name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {seller.seller_role}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{seller.total_sales_count}</TableCell>
                  <TableCell align="right">
                    {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(seller.total_revenue)}
                  </TableCell>
                  <TableCell align="right">{seller.total_quantity_sold}</TableCell>
                  <TableCell align="right">
                    {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(seller.average_basket)}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title={`Score de performance: ${seller.performance_score}%`}>
                      <Chip 
                        size="small"
                        label={`${seller.performance_score}%`}
                        color={seller.performance_score >= 70 ? 'success' : seller.performance_score >= 50 ? 'warning' : 'error'}
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Voir détails">
                      <IconButton size="small" onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSellerId(seller.seller_id);
                        setSelectedSellerStats(seller);
                        setActiveTab(1);
                      }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Détails du vendeur sélectionné */}
      {selectedSellerStats && (
        <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
            <Tab label="Détails vendeur" />
            <Tab label="Produits vendus" />
            <Tab label="Stock par produit" />
          </Tabs>
          
          {activeTab === 0 && (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={4}>
                  <Card>
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <Avatar sx={{ width: 64, height: 64, bgcolor: theme.palette.primary.main }}>
                          {selectedSellerStats.seller_name.charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="h6">{selectedSellerStats.seller_name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {selectedSellerStats.seller_role}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {selectedSellerStats.seller_id}
                          </Typography>
                        </Box>
                      </Box>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="body2" color="text.secondary">
                        Score de performance: 
                        <Chip 
                          size="small" 
                          label={`${selectedSellerStats.performance_score}%`}
                          color={selectedSellerStats.performance_score >= 70 ? 'success' : 'warning'}
                          sx={{ ml: 1 }}
                        />
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Produits gérés: {selectedSellerStats.total_products_handled}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={8}>
                  <Grid container spacing={2}>
                    <Grid item xs={6} sm={3}>
                      <StatCard 
                        title="Ventes" 
                        value={selectedSellerStats.total_sales_count} 
                        icon={<ShoppingCartIcon />}
                        tooltip="Nombre total de ventes"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StatCard 
                        title="CA Total" 
                        value={selectedSellerStats.total_revenue} 
                        icon={<MoneyIcon />}
                        tooltip="Chiffre d'affaires total"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StatCard 
                        title="Qté vendue" 
                        value={selectedSellerStats.total_quantity_sold} 
                        icon={<TrendingUpIcon />}
                        tooltip="Quantité totale vendue"
                      />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <StatCard 
                        title="Panier moyen" 
                        value={selectedSellerStats.average_basket} 
                        icon={<ShoppingCartIcon />}
                        tooltip="Montant moyen par vente"
                      />
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
              
              <Typography variant="subtitle1" sx={{ mt: 3, mb: 2, fontWeight: 'bold' }}>
                Top 5 produits les plus vendus
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Quantité vendue</TableCell>
                      <TableCell align="right">CA</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSellerStats.top_products.slice(0, 5).map((product) => (
                      <TableRow key={product.product_id}>
                        <TableCell>{product.product_name}</TableCell>
                        <TableCell align="right">{product.sold_quantity}</TableCell>
                        <TableCell align="right">
                          {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(product.sold_revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              <TextField
                size="small"
                placeholder="Rechercher un produit..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ mb: 2, width: 300 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.grey[50] }}>
                      <TableCell>Code</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Stock initial</TableCell>
                      <TableCell align="right">Vendu</TableCell>
                      <TableCell align="right">Emprunté</TableCell>
                      <TableCell align="right">Reste</TableCell>
                      <TableCell align="center">Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <ProductRow key={product.product_id} product={product} showExpiry={false} />
                    ))}
                    {filteredProducts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          Aucun produit trouvé
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
          
          {activeTab === 2 && (
            <Box sx={{ p: 3 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: theme.palette.grey[50] }}>
                      <TableCell>Code</TableCell>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Stock initial</TableCell>
                      <TableCell align="right">Stock restant</TableCell>
                      <TableCell align="center">Statut stock</TableCell>
                      <TableCell align="center">Expiration</TableCell>
                      <TableCell align="center">Alerte</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedSellerStats.products.map((product) => (
                      <ProductRow key={product.product_id} product={product} showExpiry />
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default SellerReport;