// src/modules/finance/views/ReturnPage.tsx
import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Snackbar,
  Tooltip,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Visibility as ViewIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  PlayArrow as ProcessIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/api/client';
import StatsCards from './StatsCards';

// ==================== Types ====================
interface ReturnItem {
  id: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_price: number;
  total: number;
  reason: string;
  condition: string;
}

interface Return {
  id: string;
  return_number: string;
  invoice_number?: string;
  return_type: 'customer' | 'supplier' | 'internal';
  status: 'pending' | 'approved' | 'rejected' | 'processed' | 'cancelled';
  reason: string;
  customer_name?: string;
  customer_phone?: string;
  supplier_name?: string;
  total_amount: number;
  subtotal?: number;
  tax_amount?: number;
  refund_amount?: number;
  created_at: string;
  requested_date: string;
  processed_date?: string;
  items: ReturnItem[];
  items_count?: number;
  total_quantity?: number;
  notes?: string;
}

interface ReturnListResponse {
  total: number;
  page: number;
  page_size: number;
  data: Array<{
    return: Return;
    items: ReturnItem[];
    items_count: number;
    total_quantity: number;
  }>;
}

interface StatsResponse {
  period: string;
  start_date: string;
  end_date: string;
  total_returns: number;
  pending_count: number;
  approved_count: number;
  rejected_count: number;
  processed_count: number;
  total_refund_amount: number;
  total_restocking_fees: number;
  customer_returns: number;
  supplier_returns: number;
  internal_returns: number;
  top_returned_products: Array<{
    product_name: string;
    quantity: number;
    value: number;
  }>;
}

// ==================== Constantes ====================
const STATUS_CONFIG: Record<string, { label: string; color: 'warning' | 'info' | 'error' | 'success' | 'default' }> = {
  pending: { label: 'En attente', color: 'warning' },
  approved: { label: 'Approuvé', color: 'info' },
  rejected: { label: 'Rejeté', color: 'error' },
  processed: { label: 'Traité', color: 'success' },
  cancelled: { label: 'Annulé', color: 'default' },
};

const TYPE_CONFIG: Record<string, { label: string; color: 'primary' | 'secondary' | 'default' }> = {
  customer: { label: 'Client', color: 'primary' },
  supplier: { label: 'Fournisseur', color: 'secondary' },
  internal: { label: 'Interne', color: 'default' },
};

const PERIOD_OPTIONS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'yesterday', label: 'Hier' },
  { value: 'this_week', label: 'Cette semaine' },
  { value: 'this_month', label: 'Ce mois' },
  { value: 'this_year', label: 'Cette année' },
];

// ==================== Composant Principal ====================
const ReturnPage: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  // États de pagination et filtres
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('this_month');
  
  // États des dialogues
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<Return | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processData, setProcessData] = useState({
    restoreStock: true,
    refundAmount: 0,
    refundMethod: 'cash',
    generateCreditNote: true,
  });
  
  // Notification - Version corrigée avec types étendus
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // ==================== Requêtes API ====================
  const { data: returnsData, isLoading, refetch } = useQuery({
    queryKey: ['returns', page, rowsPerPage, searchTerm, statusFilter, typeFilter, periodFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        skip: String(page * rowsPerPage),
        limit: String(rowsPerPage),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter && { status: statusFilter }),
        ...(typeFilter && { return_type: typeFilter }),
        ...(periodFilter && { period: periodFilter }),
      });
      
      const response = await api.get<ReturnListResponse>('/returns', { params });
      return response.data;
    },
  });
  
  const { data: stats } = useQuery({
    queryKey: ['returns-stats', periodFilter],
    queryFn: async () => {
      const response = await api.get<StatsResponse>('/returns/stats/overview', {
        params: { period: periodFilter }
      });
      return response.data;
    },
  });
  
  // ==================== Mutations ====================
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      const response = await api.put(`/returns/${id}/approve`, { notes });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['returns-stats'] });
      setDetailsDialogOpen(false);
      showNotification('Retour approuvé avec succès', 'success');
    },
    onError: (error: any) => {
      showNotification(error.response?.data?.detail || 'Erreur lors de l\'approbation', 'error');
    },
  });
  
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.put(`/returns/${id}/reject`, null, {
        params: { rejection_reason: reason }
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['returns-stats'] });
      setRejectDialogOpen(false);
      setDetailsDialogOpen(false);
      setRejectionReason('');
      showNotification('Retour rejeté', 'info');
    },
    onError: (error: any) => {
      showNotification(error.response?.data?.detail || 'Erreur lors du rejet', 'error');
    },
  });
  
  const processMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await api.post(`/returns/${id}/process`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['returns-stats'] });
      setProcessDialogOpen(false);
      setDetailsDialogOpen(false);
      showNotification('Retour traité avec succès', 'success');
    },
    onError: (error: any) => {
      showNotification(error.response?.data?.detail || 'Erreur lors du traitement', 'error');
    },
  });
  
  // ==================== Handlers ====================
  const showNotification = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
    setSnackbar({ open: true, message, severity });
  }, []);
  
  const handleViewDetails = useCallback((returnObj: Return) => {
    setSelectedReturn(returnObj);
    setDetailsDialogOpen(true);
  }, []);
  
  const handleApprove = useCallback(async (returnObj: Return) => {
    if (window.confirm(`Approuver le retour ${returnObj.return_number} ?`)) {
      await approveMutation.mutateAsync({ id: returnObj.id });
    }
  }, [approveMutation]);
  
  const handleReject = useCallback(() => {
    if (selectedReturn && rejectionReason.trim()) {
      rejectMutation.mutate({ id: selectedReturn.id, reason: rejectionReason });
    }
  }, [selectedReturn, rejectionReason, rejectMutation]);
  
  const handleProcess = useCallback(() => {
    if (selectedReturn) {
      processMutation.mutate({
        id: selectedReturn.id,
        data: {
          restore_stock: processData.restoreStock,
          refund_amount: processData.refundAmount,
          refund_method: processData.refundMethod,
          generate_credit_note: processData.generateCreditNote,
        }
      });
    }
  }, [selectedReturn, processData, processMutation]);
  
  const openProcessDialog = useCallback((returnObj: Return) => {
    setSelectedReturn(returnObj);
    setProcessData({
      restoreStock: true,
      refundAmount: returnObj.total_amount,
      refundMethod: 'cash',
      generateCreditNote: true,
    });
    setProcessDialogOpen(true);
  }, []);
  
  const resetFilters = useCallback(() => {
    setStatusFilter('');
    setTypeFilter('');
    setPeriodFilter('this_month');
    setSearchTerm('');
    setPage(0);
  }, []);
  
  // ==================== Fonctions de rendu ====================
  const getStatusChip = useCallback((status: string) => {
    const config = STATUS_CONFIG[status] || { label: status, color: 'default' as const };
    return <Chip label={config.label} color={config.color} size="small" />;
  }, []);
  
  const getTypeChip = useCallback((type: string) => {
    const config = TYPE_CONFIG[type] || { label: type, color: 'default' as const };
    return <Chip label={config.label} size="small" variant="outlined" color={config.color} />;
  }, []);
  
  const getCustomerDisplay = useCallback((returnObj: Return) => {
    return returnObj.customer_name || returnObj.customer_phone || '-';
  }, []);
  
  // ==================== Rendu ====================
  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box sx={{ p: 3 }}>
        {/* En-tête */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            Gestion des Retours Produits
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Actualiser
          </Button>
        </Box>
        
        {/* Cartes statistiques */}
        {stats && <StatsCards stats={stats} period={periodFilter} />}
        
        {/* Filtres */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              sx={{ flex: 1, minWidth: 200 }}
              size="small"
              placeholder="Rechercher par numéro, facture, client..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                },
              }}
            />
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Statut</InputLabel>
              <Select value={statusFilter} label="Statut" onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="pending">En attente</MenuItem>
                <MenuItem value="approved">Approuvé</MenuItem>
                <MenuItem value="rejected">Rejeté</MenuItem>
                <MenuItem value="processed">Traité</MenuItem>
                <MenuItem value="cancelled">Annulé</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Type</InputLabel>
              <Select value={typeFilter} label="Type" onChange={(e) => setTypeFilter(e.target.value)}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="customer">Client</MenuItem>
                <MenuItem value="supplier">Fournisseur</MenuItem>
                <MenuItem value="internal">Interne</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Période</InputLabel>
              <Select value={periodFilter} label="Période" onChange={(e) => setPeriodFilter(e.target.value)}>
                {PERIOD_OPTIONS.map(option => (
                  <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button variant="outlined" startIcon={<FilterIcon />} onClick={resetFilters}>
              Réinitialiser
            </Button>
          </Box>
        </Paper>
        
        {/* Tableau des retours */}
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.grey[100], 0.5) }}>
                  <TableCell>N° Retour</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Client/Fournisseur</TableCell>
                  <TableCell>Facture</TableCell>
                  <TableCell align="right">Montant</TableCell>
                  <TableCell>Statut</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : !returnsData?.data.length ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 8 }}>
                      <Typography color="textSecondary">Aucun retour trouvé</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  returnsData.data.map((item) => (
                    <TableRow key={item.return.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {item.return.return_number}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {item.items_count} article(s)
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {format(new Date(item.return.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell>{getTypeChip(item.return.return_type)}</TableCell>
                      <TableCell>{getCustomerDisplay(item.return)}</TableCell>
                      <TableCell>{item.return.invoice_number || '-'}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {item.return.total_amount.toLocaleString('fr-FR')} FCFA
                        </Typography>
                        {item.return.refund_amount && (
                          <Typography variant="caption" color="success.main">
                            Remboursé: {item.return.refund_amount.toLocaleString('fr-FR')} FCFA
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{getStatusChip(item.return.status)}</TableCell>
                      <TableCell align="center">
                        <Tooltip title="Voir détails">
                          <IconButton size="small" onClick={() => handleViewDetails(item.return)}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={returnsData?.total || 0}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Lignes par page"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
          />
        </Paper>
        
        {/* Dialogue détails */}
        <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Détails du retour {selectedReturn?.return_number}
            <IconButton onClick={() => setDetailsDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {selectedReturn && (
              <Box>
                {/* Informations générales */}
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Informations générales
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Type</Typography>
                    <Box>{getTypeChip(selectedReturn.return_type)}</Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Statut</Typography>
                    <Box>{getStatusChip(selectedReturn.status)}</Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Client</Typography>
                    <Typography variant="body2">{selectedReturn.customer_name || 'Non renseigné'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Téléphone</Typography>
                    <Typography variant="body2">{selectedReturn.customer_phone || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Facture</Typography>
                    <Typography variant="body2">{selectedReturn.invoice_number || '-'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Date demande</Typography>
                    <Typography variant="body2">
                      {format(new Date(selectedReturn.requested_date), 'dd/MM/yyyy HH:mm')}
                    </Typography>
                  </Box>
                </Box>
                
                {/* Montants */}
                <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                  Montants
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, mb: 3, p: 2, bgcolor: alpha(theme.palette.grey[50], 0.5), borderRadius: 1 }}>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Sous-total</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {selectedReturn.subtotal?.toLocaleString('fr-FR') || 0} FCFA
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Taxes</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                      {selectedReturn.tax_amount?.toLocaleString('fr-FR') || 0} FCFA
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">Total</Typography>
                    <Typography variant="h6" color="primary.main">
                      {selectedReturn.total_amount.toLocaleString('fr-FR')} FCFA
                    </Typography>
                  </Box>
                </Box>
                
                {/* Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
                  {selectedReturn.status === 'pending' && (
                    <>
                      <Button variant="outlined" color="error" startIcon={<RejectIcon />} onClick={() => setRejectDialogOpen(true)}>
                        Rejeter
                      </Button>
                      <Button variant="contained" color="success" startIcon={<ApproveIcon />} onClick={() => handleApprove(selectedReturn)}>
                        Approuver
                      </Button>
                    </>
                  )}
                  {selectedReturn.status === 'approved' && (
                    <Button variant="contained" color="primary" startIcon={<ProcessIcon />} onClick={() => openProcessDialog(selectedReturn)}>
                      Traiter le retour
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Dialogue traitement */}
        <Dialog open={processDialogOpen} onClose={() => setProcessDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Traiter le retour</DialogTitle>
          <DialogContent dividers>
            {selectedReturn && (
              <Box sx={{ pt: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Retour n°: {selectedReturn.return_number}
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                  Montant total: {selectedReturn.total_amount.toLocaleString('fr-FR')} FCFA
                </Typography>
                <Divider sx={{ my: 2 }} />
                
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Méthode de remboursement</InputLabel>
                  <Select
                    value={processData.refundMethod}
                    label="Méthode de remboursement"
                    onChange={(e) => setProcessData(prev => ({ ...prev, refundMethod: e.target.value }))}
                  >
                    <MenuItem value="cash">Espèces</MenuItem>
                    <MenuItem value="bank_transfer">Virement bancaire</MenuItem>
                    <MenuItem value="mobile_money">Mobile Money</MenuItem>
                    <MenuItem value="store_credit">Avoir magasin</MenuItem>
                  </Select>
                </FormControl>
                
                <TextField
                  fullWidth
                  type="number"
                  label="Montant du remboursement"
                  value={processData.refundAmount}
                  onChange={(e) => setProcessData(prev => ({ ...prev, refundAmount: parseFloat(e.target.value) || 0 }))}
                  sx={{ mb: 2 }}
                />
                
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleProcess}
                  disabled={processMutation.isPending}
                >
                  {processMutation.isPending ? <CircularProgress size={24} /> : 'Confirmer le traitement'}
                </Button>
              </Box>
            )}
          </DialogContent>
        </Dialog>
        
        {/* Dialogue rejet */}
        <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Rejeter le retour</DialogTitle>
          <DialogContent dividers>
            <DialogContentText gutterBottom>
              Veuillez indiquer la raison du rejet:
            </DialogContentText>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Raison du rejet..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              sx={{ my: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRejectDialogOpen(false)}>Annuler</Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleReject}
              disabled={rejectMutation.isPending || !rejectionReason.trim()}
            >
              {rejectMutation.isPending ? <CircularProgress size={20} /> : 'Confirmer le rejet'}
            </Button>
          </DialogActions>
        </Dialog>
        
        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant="filled">
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default ReturnPage;