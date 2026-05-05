// src/pages/CorbeillePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
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
  InputAdornment,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Pagination,
  Stack,
  Alert,
  useTheme,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Restore as RestoreIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  CleaningServices as CleanIcon,
  Info as InfoIcon,
  Inventory as ProductIcon,
  AttachMoney as SaleIcon,
  Person as CustomerIcon,
  Description as OtherIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import api from '@/api/client';

interface TrashItem {
  id: string;
  item_type: string;
  original_id: string;
  original_reference?: string;
  original_name?: string;
  deleted_by_name?: string;
  deleted_by_email?: string;
  deletion_reason?: string;
  deleted_at: string;
  auto_delete_at?: string;
  is_restored: boolean;
  data?: any;
}

interface TrashStats {
  total_items: number;
  items_by_type: Array<{ type: string; count: number }>;
}

const apiService = {
  async getTrashItems(params?: { page?: number; limit?: number; item_type?: string; search?: string }): Promise<{ items: TrashItem[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.item_type) queryParams.append('item_type', params.item_type);
    if (params?.search) queryParams.append('search', params.search);
    
    const response = await api.get(`/trash/?${queryParams.toString()}`);
    return { items: response.data.items || [], total: response.data.total || 0 };
  },

  async restoreTrashItem(trashId: string): Promise<{ message: string }> {
    const response = await api.post(`/trash/${trashId}/restore`);
    return response.data;
  },

  async deleteTrashItemPermanently(trashId: string): Promise<{ message: string }> {
    const response = await api.delete(`/trash/${trashId}`);
    return response.data;
  },

  async cleanupExpiredTrash(): Promise<{ deleted_count: number }> {
    const response = await api.delete('/trash/cleanup/expired');
    return response.data;
  },

  async getTrashStats(): Promise<TrashStats> {
    const response = await api.get('/trash/stats/overview');
    return response.data;
  },
};

const getItemTypeIcon = (type: string) => {
  switch (type) {
    case 'product': return <ProductIcon sx={{ color: '#4CAF50' }} />;
    case 'sale': return <SaleIcon sx={{ color: '#2196F3' }} />;
    case 'customer': return <CustomerIcon sx={{ color: '#FF9800' }} />;
    default: return <OtherIcon sx={{ color: '#9E9E9E' }} />;
  }
};

const getItemTypeLabel = (type: string) => {
  switch (type) {
    case 'product': return 'Produit';
    case 'sale': return 'Vente';
    case 'customer': return 'Client';
    default: return type;
  }
};

const getItemTypeColor = (type: string) => {
  switch (type) {
    case 'product': return 'success';
    case 'sale': return 'primary';
    case 'customer': return 'warning';
    default: return 'default';
  }
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('fr-FR');
};

export default function CorbeillePage() {
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [stats, setStats] = useState<TrashStats | null>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [detailsItem, setDetailsItem] = useState<TrashItem | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);

  const limit = 20;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [trashData, statsData] = await Promise.all([
        apiService.getTrashItems({ 
          page, 
          limit, 
          item_type: selectedType || undefined, 
          search: searchQuery || undefined 
        }),
        apiService.getTrashStats(),
      ]);
      setItems(trashData.items);
      setTotal(trashData.total);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement corbeille:', error);
      enqueueSnackbar('Impossible de charger la corbeille', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [page, selectedType, searchQuery, enqueueSnackbar]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestore = async () => {
    if (!selectedItem) return;
    
    try {
      const result = await apiService.restoreTrashItem(selectedItem.id);
      enqueueSnackbar(result.message, { variant: 'success' });
      setRestoreDialogOpen(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur restauration:', error);
      enqueueSnackbar('Impossible de restaurer l\'élément', { variant: 'error' });
    }
  };

  const handlePermanentDelete = async () => {
    if (!selectedItem) return;
    
    try {
      const result = await apiService.deleteTrashItemPermanently(selectedItem.id);
      enqueueSnackbar(result.message, { variant: 'success' });
      setDeleteDialogOpen(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur suppression définitive:', error);
      enqueueSnackbar('Impossible de supprimer l\'élément', { variant: 'error' });
    }
  };

  const handleCleanupExpired = async () => {
    try {
      const result = await apiService.cleanupExpiredTrash();
      enqueueSnackbar(`${result.deleted_count} éléments supprimés`, { variant: 'success' });
      setCleanupDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Erreur nettoyage:', error);
      enqueueSnackbar('Impossible de nettoyer la corbeille', { variant: 'error' });
    }
  };

  const openDeleteDialog = (item: TrashItem) => {
    setSelectedItem(item);
    setDeleteDialogOpen(true);
  };

  const openRestoreDialog = (item: TrashItem) => {
    setSelectedItem(item);
    setRestoreDialogOpen(true);
  };

  const openDetailsDialog = (item: TrashItem) => {
    setDetailsItem(item);
    setDetailsDialogOpen(true);
  };

  const handleFilterClick = (event: React.MouseEvent<HTMLElement>) => {
    setFilterAnchorEl(event.currentTarget);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
  };

  const handleFilterSelect = (type: string) => {
    setSelectedType(type);
    setPage(1);
    handleFilterClose();
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(1);
  };

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  };

  if (loading && items.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Chargement...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Paper sx={{ p: 3, mb: 2, bgcolor: theme.palette.primary.main, color: '#fff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            🗑️ Corbeille
          </Typography>
          <Button
            variant="contained"
            startIcon={<CleanIcon />}
            onClick={() => setCleanupDialogOpen(true)}
            sx={{ bgcolor: '#FF9800', '&:hover': { bgcolor: '#F57C00' } }}
          >
            Nettoyer les éléments expirés
          </Button>
        </Box>
      </Paper>

      {/* Stats Bar */}
      {stats && (
        <Paper sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="body2" color="textSecondary">
            Total: <strong>{stats.total_items}</strong> éléments
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            {stats.items_by_type.slice(0, 5).map(type => (
              <Chip
                key={type.type}
                icon={getItemTypeIcon(type.type)}
                label={`${getItemTypeLabel(type.type)}: ${type.count}`}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Toolbar */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={handleSearchChange}
            sx={{ flex: 1, minWidth: 200 }}
            slotProps={{
              input: {
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
              },
            }}
          />
          
          <Button
            variant="outlined"
            startIcon={<FilterIcon />}
            onClick={handleFilterClick}
          >
            Filtrer {selectedType && `(${getItemTypeLabel(selectedType)})`}
          </Button>
          
          <Menu
            anchorEl={filterAnchorEl}
            open={Boolean(filterAnchorEl)}
            onClose={handleFilterClose}
          >
            <MenuItem onClick={() => handleFilterSelect('')}>
              <ListItemIcon>
                <OtherIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Tous</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('product')}>
              <ListItemIcon>
                <ProductIcon fontSize="small" sx={{ color: '#4CAF50' }} />
              </ListItemIcon>
              <ListItemText>Produits</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('sale')}>
              <ListItemIcon>
                <SaleIcon fontSize="small" sx={{ color: '#2196F3' }} />
              </ListItemIcon>
              <ListItemText>Ventes</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('customer')}>
              <ListItemIcon>
                <CustomerIcon fontSize="small" sx={{ color: '#FF9800' }} />
              </ListItemIcon>
              <ListItemText>Clients</ListItemText>
            </MenuItem>
          </Menu>
        </Box>
      </Paper>

      {/* Items Table */}
      {items.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <DeleteIcon sx={{ fontSize: 48, color: '#ccc', mb: 2 }} />
          <Typography color="textSecondary">La corbeille est vide</Typography>
        </Paper>
      ) : (
        <>
          <TableContainer component={Paper}>
            <Table size="medium">
              <TableHead>
                <TableRow sx={{ bgcolor: '#fafafa' }}>
                  <TableCell>Type</TableCell>
                  <TableCell>Nom/Référence</TableCell>
                  <TableCell>Supprimé par</TableCell>
                  <TableCell>Date suppression</TableCell>
                  <TableCell>Suppression auto</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>
                      <Chip
                        icon={getItemTypeIcon(item.item_type)}
                        label={getItemTypeLabel(item.item_type)}
                        size="small"
                        color={getItemTypeColor(item.item_type)}
                      />
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          {item.original_name}
                        </Typography>
                        {item.original_reference && (
                          <Typography variant="caption" color="textSecondary">
                            {item.original_reference}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {item.deleted_by_name || 'Inconnu'}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {item.deleted_by_email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(item.deleted_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {item.auto_delete_at ? (
                        <Typography variant="body2" color="error">
                          {formatDate(item.auto_delete_at)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="textSecondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                        <Tooltip title="Voir les détails">
                          <IconButton
                            size="small"
                            onClick={() => openDetailsDialog(item)}
                            sx={{ color: theme.palette.info.main }}
                          >
                            <InfoIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Restaurer">
                          <IconButton
                            size="small"
                            onClick={() => openRestoreDialog(item)}
                            sx={{ color: theme.palette.success.main }}
                          >
                            <RestoreIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer définitivement">
                          <IconButton
                            size="small"
                            onClick={() => openDeleteDialog(item)}
                            sx={{ color: theme.palette.error.main }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={Math.ceil(total / limit)}
              page={page}
              onChange={handlePageChange}
              color="primary"
              size="large"
            />
          </Box>
        </>
      )}

      {/* Restore Dialog */}
      <Dialog open={restoreDialogOpen} onClose={() => setRestoreDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: '#FF9800' }} />
          Restaurer l'élément
        </DialogTitle>
        <DialogContent>
          <Typography>
            Voulez-vous restaurer <strong>{selectedItem?.original_name}</strong> ?
            Il sera remis dans sa catégorie d'origine.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleRestore} variant="contained" color="success">
            Restaurer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Permanent Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon sx={{ color: '#F44336' }} />
          Suppression définitive
        </DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer définitivement <strong>{selectedItem?.original_name}</strong> ?
          </Typography>
          <Alert severity="error" sx={{ mt: 2 }}>
            Cette action est irréversible !
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Annuler</Button>
          <Button onClick={handlePermanentDelete} variant="contained" color="error">
            Supprimer définitivement
          </Button>
        </DialogActions>
      </Dialog>

      {/* Cleanup Dialog */}
      <Dialog open={cleanupDialogOpen} onClose={() => setCleanupDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CleanIcon sx={{ color: '#FF9800' }} />
          Nettoyage automatique
        </DialogTitle>
        <DialogContent>
          <Typography>
            Cette action supprimera définitivement tous les éléments expirés de la corbeille.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCleanupDialogOpen(false)}>Annuler</Button>
          <Button onClick={handleCleanupExpired} variant="contained" color="warning">
            Nettoyer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={() => setDetailsDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {detailsItem && getItemTypeIcon(detailsItem.item_type)}
              Détails de l'élément
            </Typography>
            <IconButton onClick={() => setDetailsDialogOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {detailsItem && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Nom</Typography>
                <Typography variant="body1">{detailsItem.original_name}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Référence</Typography>
                <Typography variant="body1">{detailsItem.original_reference || 'N/A'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Type</Typography>
                <Chip 
                  icon={getItemTypeIcon(detailsItem.item_type)}
                  label={getItemTypeLabel(detailsItem.item_type)} 
                  size="small"
                />
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Supprimé par</Typography>
                <Typography variant="body1">
                  {detailsItem.deleted_by_name} ({detailsItem.deleted_by_email})
                </Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="textSecondary">Date de suppression</Typography>
                <Typography variant="body1">{formatDate(detailsItem.deleted_at)}</Typography>
              </Box>
              {detailsItem.deletion_reason && (
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Raison</Typography>
                  <Typography variant="body1">{detailsItem.deletion_reason}</Typography>
                </Box>
              )}
              {detailsItem.auto_delete_at && (
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Suppression automatique</Typography>
                  <Typography variant="body1" color="error">{formatDate(detailsItem.auto_delete_at)}</Typography>
                </Box>
              )}
              {detailsItem.data && (
                <Box>
                  <Typography variant="subtitle2" color="textSecondary">Données</Typography>
                  <Paper sx={{ p: 2, bgcolor: '#f5f5f5', overflow: 'auto', maxHeight: 300 }}>
                    <pre style={{ margin: 0, fontSize: 11, fontFamily: 'monospace' }}>
                      {JSON.stringify(detailsItem.data, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}