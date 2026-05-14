// ReportSales.tsx
// Composant pour l'export PDF des rapports de ventes avec suivi de stock

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  TextField,
  CircularProgress,
  Alert,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormLabel,
  Stack,
  LinearProgress,
  useTheme,
  alpha,
  Avatar,
} from '@mui/material';
import {
  PictureAsPdf as PdfIcon,
  Close as CloseIcon,
  CalendarToday as CalendarIcon,
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingUpIcon,
  ShoppingCart as ShoppingCartIcon,
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
  formatPeriod,
  now,
  isSameDay,
  differenceInDays,
  isToday,
  isPast,
  isFuture,
  isValid,
  getYear,
  getMonth,
  getDate,
} from '@/utils/date';

// Types
interface ExportOptions {
  format: 'pdf' | 'excel' | 'csv';
  orientation: 'portrait' | 'landscape';
  includeCharts: boolean;
  includeDetails: boolean;
  exportType: 'all' | 'with_changes' | 'by_seller';
  selectedSellerId?: string;
  selectedBranchId?: string;
  pageSize: 'A4' | 'A3' | 'Letter';
  title?: string;
  notes?: string;
}

interface Branch {
  id: string;
  name: string;
  code: string;
  is_main_branch: boolean;
}

interface Seller {
  id: string;
  nom_complet: string;
  email: string;
  role: string;
}

interface ExportProgress {
  status: 'idle' | 'preparing' | 'generating' | 'downloading' | 'completed' | 'error';
  progress: number;
  message: string;
}

// Service API pour les exports
const API_BASE = '/api/v1';

const exportService = {
  getBranches: async (): Promise<Branch[]> => {
    const response = await fetch(`${API_BASE}/stock/branches`);
    const data = await response.json();
    return data.branches || [];
  },

  getSellers: async (branchId?: string): Promise<Seller[]> => {
    const url = branchId 
      ? `${API_BASE}/stock/sellers/${branchId}`
      : `${API_BASE}/stock/sellers`;
    const response = await fetch(url);
    const data = await response.json();
    return data.sellers || [];
  },

  exportSalesReport: async (
    startDate: string,
    endDate: string,
    options: ExportOptions
  ): Promise<Blob> => {
    const params = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
      format: options.format,
      orientation: options.orientation,
      include_charts: String(options.includeCharts),
      include_details: String(options.includeDetails),
      export_type: options.exportType,
      page_size: options.pageSize,
    });
    
    if (options.selectedSellerId) {
      params.append('seller_id', options.selectedSellerId);
    }
    if (options.selectedBranchId) {
      params.append('branch_id', options.selectedBranchId);
    }
    if (options.title) {
      params.append('title', options.title);
    }
    if (options.notes) {
      params.append('notes', options.notes);
    }
    
    const response = await fetch(`${API_BASE}/stock/export-sales-report?${params}`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Erreur lors de l\'export');
    }
    
    return response.blob();
  },
};

// Composant de dialogue d'export
interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  loading: boolean;
  startDate: Date | null;
  endDate: Date | null;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  onExport,
  loading,
  startDate,
  endDate,
}) => {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'pdf',
    orientation: 'landscape',
    includeCharts: true,
    includeDetails: true,
    exportType: 'all',
    pageSize: 'A4',
    title: '',
    notes: '',
  });
  
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);

  useEffect(() => {
    if (open) {
      loadBranches();
    }
  }, [open]);

  const loadBranches = async () => {
    try {
      const branchesList = await exportService.getBranches();
      setBranches(branchesList);
    } catch (err) {
      console.error('Erreur chargement branches:', err);
    }
  };

  useEffect(() => {
    if (options.selectedBranchId) {
      const loadSellers = async () => {
        const sellersList = await exportService.getSellers(options.selectedBranchId);
        setSellers(sellersList);
      };
      loadSellers();
    } else {
      setSellers([]);
    }
  }, [options.selectedBranchId]);

  const periodText = formatPeriod(startDate, endDate);
  
  // Utilisation des fonctions date pour les calculs
  const periodDuration = startDate && endDate ? differenceInDays(endDate, startDate) : 0;
  const isCurrentMonth = startDate && endDate ? 
    isSameDay(startDate, startOfMonth(now())) && isSameDay(endDate, endOfMonth(now())) : false;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">📄 Export du rapport de ventes</Typography>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers>
        <Stack spacing={3}>
          {/* Période */}
          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f9f9f9' }}>
            <Typography variant="subtitle2" gutterBottom>
              <CalendarIcon fontSize="small" sx={{ mr: 1, verticalAlign: 'middle' }} />
              Période du rapport
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {periodText}
              {periodDuration > 0 && ` (${periodDuration} jours)`}
              {isCurrentMonth && ' - Mois en cours'}
            </Typography>
          </Paper>
          
          {/* Format et orientation */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Format</InputLabel>
                <Select
                  value={options.format}
                  label="Format"
                  onChange={(e) => setOptions({ ...options, format: e.target.value as ExportOptions['format'] })}
                >
                  <MenuItem value="pdf">PDF (recommandé)</MenuItem>
                  <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                  <MenuItem value="csv">CSV</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" disabled={options.format !== 'pdf'}>
                <InputLabel>Orientation</InputLabel>
                <Select
                  value={options.orientation}
                  label="Orientation"
                  onChange={(e) => setOptions({ ...options, orientation: e.target.value as ExportOptions['orientation'] })}
                >
                  <MenuItem value="portrait">Portrait</MenuItem>
                  <MenuItem value="landscape">Paysage (recommandé)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" disabled={options.format !== 'pdf'}>
                <InputLabel>Format papier</InputLabel>
                <Select
                  value={options.pageSize}
                  label="Format papier"
                  onChange={(e) => setOptions({ ...options, pageSize: e.target.value as ExportOptions['pageSize'] })}
                >
                  <MenuItem value="A4">A4</MenuItem>
                  <MenuItem value="A3">A3</MenuItem>
                  <MenuItem value="Letter">Letter</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          
          {/* Type d'export */}
          <FormControl component="fieldset">
            <FormLabel>Type d'export</FormLabel>
            <RadioGroup
              value={options.exportType}
              onChange={(e) => setOptions({ ...options, exportType: e.target.value as ExportOptions['exportType'] })}
            >
              <FormControlLabel value="all" control={<Radio />} label="Tous les produits" />
              <FormControlLabel 
                value="with_changes" 
                control={<Radio />} 
                label="Uniquement les produits avec ventes ou emprunts" 
              />
              <FormControlLabel 
                value="by_seller" 
                control={<Radio />} 
                label="Par vendeur" 
              />
            </RadioGroup>
          </FormControl>
          
          {/* Filtres supplémentaires */}
          {options.exportType === 'by_seller' && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Branche / Succursale</InputLabel>
                  <Select
                    value={options.selectedBranchId || ''}
                    label="Branche / Succursale"
                    onChange={(e) => setOptions({ ...options, selectedBranchId: e.target.value, selectedSellerId: undefined })}
                  >
                    <MenuItem value="">Toutes les branches</MenuItem>
                    {branches.map((branch) => (
                      <MenuItem key={branch.id} value={branch.id}>
                        {branch.name} ({branch.code})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel>Vendeur</InputLabel>
                  <Select
                    value={options.selectedSellerId || ''}
                    label="Vendeur"
                    onChange={(e) => setOptions({ ...options, selectedSellerId: e.target.value })}
                    disabled={sellers.length === 0 && !options.selectedBranchId}
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
            </Grid>
          )}
          
          {/* Options de contenu */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeCharts}
                    onChange={(e) => setOptions({ ...options, includeCharts: e.target.checked })}
                  />
                }
                label="Inclure les graphiques"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.includeDetails}
                    onChange={(e) => setOptions({ ...options, includeDetails: e.target.checked })}
                  />
                }
                label="Inclure les détails des produits"
              />
            </Grid>
          </Grid>
          
          {/* Options supplémentaires pour PDF */}
          {options.format === 'pdf' && (
            <>
              <TextField
                label="Titre personnalisé"
                size="small"
                fullWidth
                value={options.title}
                onChange={(e) => setOptions({ ...options, title: e.target.value })}
                placeholder="Ex: Rapport de ventes - Janvier 2024"
              />
              <TextField
                label="Notes / Commentaires"
                size="small"
                fullWidth
                multiline
                rows={2}
                value={options.notes}
                onChange={(e) => setOptions({ ...options, notes: e.target.value })}
                placeholder="Notes additionnelles à inclure dans le rapport..."
              />
            </>
          )}
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button
          variant="contained"
          onClick={() => onExport(options)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : <PdfIcon />}
        >
          {loading ? 'Préparation...' : 'Exporter'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// Composant principal
const ReportSales: React.FC = () => {
  const theme = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(startOfMonth(now()));
  const [endDate, setEndDate] = useState<Date | null>(now());
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgress>({
    status: 'idle',
    progress: 0,
    message: '',
  });

  const handleExport = async (options: ExportOptions) => {
    if (!startDate || !endDate) {
      setError('Veuillez sélectionner une période');
      return;
    }
    
    // Validation des dates avec isValid
    if (!isValid(startDate) || !isValid(endDate)) {
      setError('Dates invalides');
      return;
    }
    
    // Vérification que la date de début n'est pas après la date de fin
    if (isPast(startDate) && isFuture(endDate)) {
      // Période valide
    }
    
    setLoading(true);
    setProgress({ status: 'preparing', progress: 10, message: 'Préparation des données...' });
    setError(null);
    
    try {
      setProgress({ status: 'generating', progress: 50, message: 'Génération du rapport...' });
      
      const blob = await exportService.exportSalesReport(
        formatDate(startDate, 'YYYY-MM-DD'),
        formatDate(endDate, 'YYYY-MM-DD'),
        options
      );
      
      setProgress({ status: 'downloading', progress: 90, message: 'Téléchargement...' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = options.format === 'pdf' ? 'pdf' : options.format === 'excel' ? 'xlsx' : 'csv';
      const fileName = `rapport_ventes_${formatDate(startDate, 'YYYY-MM-DD')}_${formatDate(endDate, 'YYYY-MM-DD')}.${extension}`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      setProgress({ status: 'completed', progress: 100, message: 'Export terminé !' });
      setTimeout(() => setExportDialogOpen(false), 1000);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'export');
      setProgress({ status: 'error', progress: 0, message: 'Erreur lors de l\'export' });
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const getDefaultDates = (period: 'today' | 'week' | 'month' | 'year') => {
    const nowDate = now();
    
    switch (period) {
      case 'today':
        setStartDate(startOfDay(nowDate));
        setEndDate(endOfDay(nowDate));
        break;
      case 'week':
        setStartDate(startOfWeek(nowDate));
        setEndDate(endOfWeek(nowDate));
        break;
      case 'month':
        setStartDate(startOfMonth(nowDate));
        setEndDate(endOfMonth(nowDate));
        break;
      case 'year':
        setStartDate(startOfYear(nowDate));
        setEndDate(endOfYear(nowDate));
        break;
    }
  };

  const periodText = formatPeriod(startDate, endDate);
  
  // Calcul des métriques avec les fonctions date
  const periodDays = startDate && endDate ? differenceInDays(endDate, startDate) : 0;
  const canExport = startDate && endDate && isValid(startDate) && isValid(endDate);

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* En-tête */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Box>
            <Typography variant="h5" fontWeight="bold">
              Export des rapports de ventes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Générez et exportez des rapports détaillés de ventes avec suivi de stock
              {periodDays > 0 && ` - Période de ${periodDays} jour${periodDays > 1 ? 's' : ''}`}
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <Button
              variant="contained"
              startIcon={<PdfIcon />}
              onClick={() => setExportDialogOpen(true)}
              disabled={!canExport}
            >
              Exporter
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Sélection période rapide */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Période rapide
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button 
            size="small" 
            variant={isToday(startDate || new Date()) ? 'contained' : 'outlined'}
            onClick={() => getDefaultDates('today')}
          >
            Aujourd'hui
          </Button>
          <Button size="small" onClick={() => getDefaultDates('week')}>Cette semaine</Button>
          <Button size="small" onClick={() => getDefaultDates('month')}>Ce mois</Button>
          <Button size="small" onClick={() => getDefaultDates('year')}>Cette année</Button>
        </Stack>
        <Divider sx={{ my: 2 }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Période sélectionnée: <strong>{periodText}</strong>
        </Typography>
        {startDate && endDate && (
          <Typography variant="caption" color="text.secondary">
            Année: {getYear(startDate)} - Mois: {getMonth(startDate) + 1} - Jour: {getDate(startDate)}
          </Typography>
        )}
      </Paper>

      {/* Cartes récapitulatives */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Chiffre d'affaires</Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), width: 32, height: 32 }}>
                  <MoneyIcon sx={{ color: theme.palette.success.main, fontSize: 18 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(0)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                (Sélectionnez une période)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Nombre de ventes</Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), width: 32, height: 32 }}>
                  <ShoppingCartIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                0
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Quantité vendue</Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), width: 32, height: 32 }}>
                  <TrendingUpIcon sx={{ color: theme.palette.warning.main, fontSize: 18 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                0
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="caption" color="text.secondary">Panier moyen</Typography>
                <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), width: 32, height: 32 }}>
                  <ShoppingCartIcon sx={{ color: theme.palette.info.main, fontSize: 18 }} />
                </Avatar>
              </Box>
              <Typography variant="h6" fontWeight="bold" sx={{ mt: 1 }}>
                {new Intl.NumberFormat('fr-CD', { style: 'currency', currency: 'CDF' }).format(0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {loading && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress variant="determinate" value={progress.progress} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {progress.message}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Dialogue d'export */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        loading={loading}
        startDate={startDate}
        endDate={endDate}
      />
    </Box>
  );
};

export default ReportSales;