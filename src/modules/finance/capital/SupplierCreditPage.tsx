// supplierCreditPage.tsx - Version corrigée
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
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
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  InputAdornment,
  Divider,
  LinearProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  TablePagination,
  InputBase,
  alpha,
  styled,
  Fade,
  Grow,
  Zoom,
} from '@mui/material';
import {
  TrendingUp,
  AccountBalance,
  Warning,
  Payment,
  ShoppingCart,
  CreditCard,
  Add,
  Search as SearchIcon,
  Refresh,
  Delete,
  Edit,
  Visibility,
  CheckCircle,
  Cancel,
  Receipt,
  Business,
  LocationOn,
  People,
  Assessment,
  Dashboard as DashboardIconMui,
  ContactSupport as ContactSupportIconMui,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { fr } from 'date-fns/locale';
import { useSnackbar } from 'notistack';
import api from '@/api/client';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/formatters';

// ... (tous vos types restent identiques) ...

const SupplierCreditPage: React.FC = () => {
  // ... (tous vos states et fonctions restent identiques jusqu'au rendu) ...

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Box sx={{ p: 3 }}>
        {/* En-tête */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCard fontSize="large" color="primary" />
              Crédit Fournisseurs
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Gérez les achats à crédit, suivez vos dettes fournisseurs et analysez votre santé financière
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={handleRefresh}
              disabled={loading}
            >
              Actualiser
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => {
                resetSupplierForm();
                setSupplierDialogOpen(true);
              }}
            >
              Nouveau fournisseur
            </Button>
          </Box>
        </Box>

        {/* Onglets */}
        <Tabs
          value={activeTab}
          onChange={(_event: React.SyntheticEvent, v: number) => setActiveTab(v)}
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<DashboardIconMui />} label="Tableau de bord" iconPosition="start" />
          <Tab icon={<People />} label="Fournisseurs" iconPosition="start" />
          <Tab icon={<CreditCard />} label="Configurations" iconPosition="start" />
          <Tab icon={<Assessment />} label="Bénéfice réel" iconPosition="start" />
          <Tab icon={<Receipt />} label="Coûts" iconPosition="start" />
          <Tab icon={<AccountBalance />} label="Budgets" iconPosition="start" />
        </Tabs>

        {/* ============================================== */}
        {/* TAB 0: TABLEAU DE BORD */}
        {/* ============================================== */}
        {activeTab === 0 && dashboardStats && (
          <Fade in>
            <Box>
              {/* Cartes KPI */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={300}>
                    <Card sx={{ height: '100%', position: 'relative', overflow: 'visible' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Dette totale
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'error.main', mt: 0.5 }}>
                              {formatCurrency(dashboardStats.summary.total_supplier_debt)}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'error.light', width: 48, height: 48 }}>
                            <AccountBalance sx={{ color: 'error.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={400}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Crédits actifs
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                              {dashboardStats.summary.active_credits}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'primary.light', width: 48, height: 48 }}>
                            <ShoppingCart sx={{ color: 'primary.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={500}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Crédits en retard
                            </Typography>
                            <Typography 
                              variant="h5" 
                              sx={{ 
                                fontWeight: 'bold', 
                                mt: 0.5,
                                color: dashboardStats.summary.overdue_credits > 0 ? 'warning.main' : 'inherit'
                              }}
                            >
                              {dashboardStats.summary.overdue_credits}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'warning.light', width: 48, height: 48 }}>
                            <Warning sx={{ color: 'warning.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>

                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <Grow in timeout={600}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', fontWeight: 500 }}>
                              Fournisseurs débiteurs
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                              {dashboardStats.summary.suppliers_with_debt}
                            </Typography>
                          </Box>
                          <Avatar sx={{ bgcolor: 'info.light', width: 48, height: 48 }}>
                            <Business sx={{ color: 'info.main' }} />
                          </Avatar>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grow>
                </Grid>
              </Grid>

              {/* Capital ajusté et Alertes */}
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Zoom in timeout={400}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <AccountBalance color="primary" />
                          Capital ajusté
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                          Formule: Capital réel = Actif total - Dettes fournisseurs
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 6 }}>
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Actif total
                              </Typography>
                              <Typography variant="h6">{formatCurrency(dashboardStats.adjusted_capital.gross_capital)}</Typography>
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 6 }}>
                            <Paper variant="outlined" sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                Dettes fournisseurs
                              </Typography>
                              <Typography variant="h6" sx={{ color: 'error.main' }}>
                                -{formatCurrency(dashboardStats.adjusted_capital.total_supplier_debt)}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid size={{ xs: 12 }}>
                            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
                              <Typography variant="caption">Capital ajusté</Typography>
                              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                                {formatCurrency(dashboardStats.adjusted_capital.adjusted_capital)}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Zoom in timeout={500}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TrendingUp color="primary" />
                          Indicateurs de santé financière
                        </Typography>
                        
                        <Box sx={{ mb: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2">Ratio d'endettement</Typography>
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                fontWeight: 'bold',
                                color: dashboardStats.alerts.high_debt_ratio > 70 ? 'error.main' 
                                  : dashboardStats.alerts.high_debt_ratio > 50 ? 'warning.main' 
                                  : 'success.main'
                              }}
                            >
                              {dashboardStats.alerts.high_debt_ratio.toFixed(1)}%
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(dashboardStats.alerts.high_debt_ratio, 100)}
                            sx={{ 
                              height: 8, 
                              borderRadius: 4,
                              bgcolor: 'grey.200',
                              '& .MuiLinearProgress-bar': {
                                bgcolor: dashboardStats.alerts.high_debt_ratio > 70 ? 'error.main' 
                                  : dashboardStats.alerts.high_debt_ratio > 50 ? 'warning.main' 
                                  : 'success.main'
                              }
                            }}
                          />
                          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 0.5, display: 'block' }}>
                            {dashboardStats.alerts.high_debt_ratio > 70 
                              ? 'Endettement critique - Action nécessaire immédiate'
                              : dashboardStats.alerts.high_debt_ratio > 50 
                              ? 'Endettement élevé - Surveiller attentivement'
                              : 'Endettement maîtrisé'}
                          </Typography>
                        </Box>

                        {dashboardStats.alerts.overdue_alert && (
                          <Alert severity="warning" icon={<Warning />} sx={{ mt: 2 }}>
                            Des crédits fournisseurs sont en retard de paiement. Veuillez vérifier les échéances.
                          </Alert>
                        )}
                      </CardContent>
                    </Card>
                  </Zoom>
                </Grid>
              </Grid>

              {/* Top fournisseurs débiteurs */}
              {dashboardStats.top_debt_suppliers && dashboardStats.top_debt_suppliers.length > 0 && (
                <Card sx={{ mb: 4 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Top 5 fournisseurs débiteurs
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Fournisseur</TableCell>
                            <TableCell align="right">Dette</TableCell>
                            <TableCell align="right">% de la dette totale</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {dashboardStats.top_debt_suppliers.map((supplierItem, index) => (
                            <TableRow key={index}>
                              <TableCell>{supplierItem.supplier_name}</TableCell>
                              <TableCell align="right" sx={{ color: 'error.main' }}>
                                {formatCurrency(supplierItem.current_debt)}
                              </TableCell>
                              <TableCell align="right">
                                {((supplierItem.current_debt / dashboardStats.summary.total_supplier_debt) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 1: FOURNISSEURS */}
        {/* ============================================== */}
        {activeTab === 1 && (
          <Fade in>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Fournisseurs</Typography>
                      <Button size="small" startIcon={<Add />} onClick={() => {
                        resetSupplierForm();
                        setSupplierDialogOpen(true);
                      }}>
                        Ajouter
                      </Button>
                    </Box>
                    
                    <SearchInput sx={{ mb: 2 }}>
                      <SearchIconWrapper>
                        <SearchIcon />
                      </SearchIconWrapper>
                      <StyledInputBase
                        placeholder="Rechercher..."
                        inputProps={{ 'aria-label': 'search' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </SearchInput>
                    
                    <Divider sx={{ mb: 2 }} />
                    
                    {loadingBalance && suppliersBalances.length === 0 ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress size={30} />
                      </Box>
                    ) : (
                      <>
                        {paginatedSuppliers.map((supplier) => (
                          <Box
                            key={supplier.supplier_id}
                            onClick={() => handleSelectSupplier(supplier)}
                            sx={{
                              p: 2,
                              mb: 1,
                              borderRadius: 2,
                              cursor: 'pointer',
                              bgcolor: selectedSupplier?.supplier_id === supplier.supplier_id ? 'primary.light' : 'grey.50',
                              '&:hover': { bgcolor: 'grey.100' },
                              transition: 'all 0.2s',
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontWeight: 'bold' }}>{supplier.supplier_name}</Typography>
                                {supplier.active_credits_count > 0 && (
                                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {supplier.active_credits_count} crédit(s) actif(s)
                                  </Typography>
                                )}
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Chip
                                  label={formatCurrency(supplier.current_debt)}
                                  size="small"
                                  color={supplier.current_debt > 0 ? 'error' : 'success'}
                                />
                                <Tooltip title="Voir les détails du fournisseur">
                                  <IconButton 
                                    size="small" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const supplierInfo = suppliersList.find(s => s.id === supplier.supplier_id);
                                      if (supplierInfo) {
                                        handleViewSupplierDetail(supplierInfo);
                                      }
                                    }}
                                  >
                                    <Visibility fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </Box>
                            {supplier.overdue_credits_count > 0 && (
                              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                                <Warning fontSize="small" sx={{ mr: 0.5, color: 'warning.main' }} />
                                <Typography variant="caption" sx={{ color: 'warning.main' }}>
                                  {supplier.overdue_credits_count} crédit(s) en retard
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        ))}
                        
                        <TablePagination
                          component="div"
                          count={filteredSuppliers.length}
                          page={supplierPage}
                          onPageChange={(_event: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => setSupplierPage(newPage)}
                          rowsPerPage={supplierRowsPerPage}
                          onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            setSupplierRowsPerPage(parseInt(event.target.value, 10));
                            setSupplierPage(0);
                          }}
                          labelRowsPerPage="Lignes par page"
                          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
                        />
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 8 }}>
                {selectedSupplier ? (
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
                        <Box>
                          <Typography variant="h6">{selectedSupplier.supplier_name}</Typography>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            ID: {selectedSupplier.supplier_id.slice(0, 8)}...
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Tooltip title="Voir les détails du fournisseur">
                            <IconButton 
                              onClick={() => {
                                const supplierInfo = suppliersList.find(s => s.id === selectedSupplier.supplier_id);
                                if (supplierInfo) {
                                  handleViewSupplierDetail(supplierInfo);
                                }
                              }}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Voir les transactions">
                            <IconButton onClick={() => handleViewTransactions()}>
                              <Receipt />
                            </IconButton>
                          </Tooltip>
                          <Button
                            variant="contained"
                            startIcon={<Payment />}
                            onClick={() => setRepaymentDialogOpen(true)}
                            disabled={selectedSupplier.current_debt <= 0}
                          >
                            Rembourser
                          </Button>
                        </Box>
                      </Box>

                      <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Dette actuelle
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'error.main' }}>
                              {formatCurrency(selectedSupplier.current_debt)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Achats à crédit
                            </Typography>
                            <Typography variant="h6">
                              {formatCurrency(selectedSupplier.total_credit_purchases)}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Remboursements
                            </Typography>
                            <Typography variant="h6" sx={{ color: 'success.main' }}>
                              {formatCurrency(selectedSupplier.total_repayments)}
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      {selectedSupplier.config && (
                        <Alert severity="info" sx={{ mb: 3 }}>
                          <Typography variant="subtitle2">Configuration de crédit</Typography>
                          <Typography variant="body2">
                            Limite: {formatCurrency(selectedSupplier.config.credit_limit)} | 
                            Délai: {selectedSupplier.config.payment_delay_days} jours | 
                            Taux d'intérêt: {selectedSupplier.config.interest_rate}%
                          </Typography>
                        </Alert>
                      )}

                      <Typography variant="subtitle2" gutterBottom>
                        Historique des crédits
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Date</TableCell>
                              <TableCell>Montant</TableCell>
                              <TableCell>Restant dû</TableCell>
                              <TableCell>Échéance</TableCell>
                              <TableCell>Statut</TableCell>
                              <TableCell>Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {loadingBalance ? (
                              <TableRow>
                                <TableCell colSpan={6} align="center">
                                  <CircularProgress size={30} />
                                </TableCell>
                              </TableRow>
                            ) : (selectedSupplier.credits || []).map((credit) => (
                              <TableRow key={credit.id}>
                                <TableCell>{formatDate(credit.created_at)}</TableCell>
                                <TableCell>{formatCurrency(credit.credit_amount)}</TableCell>
                                <TableCell>{formatCurrency(credit.remaining_amount)}</TableCell>
                                <TableCell>
                                  {formatDate(credit.due_date)}
                                  {new Date(credit.due_date) < new Date() && credit.status !== 'fully_paid' && (
                                    <Warning fontSize="small" sx={{ ml: 1, color: 'warning.main' }} />
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    label={getStatusLabel(credit.status)}
                                    size="small"
                                    color={getStatusColor(credit.status)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Tooltip title="Détails">
                                    <IconButton size="small">
                                      <Visibility fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(selectedSupplier.credits || []).length === 0 && !loadingBalance && (
                              <TableRow>
                                <TableCell colSpan={6} align="center">
                                  <Typography color="text.secondary">Aucun crédit trouvé</Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </CardContent>
                  </Card>
                ) : (
                  <Paper sx={{ p: 4, textAlign: 'center' }}>
                    <Typography sx={{ color: 'text.secondary' }}>
                      Sélectionnez un fournisseur pour voir les détails
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 2: CONFIGURATIONS CRÉDIT */}
        {/* ============================================== */}
        {activeTab === 2 && (
          <Fade in>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6">Configurations crédit fournisseurs</Typography>
                  <Button 
                    variant="contained" 
                    startIcon={<CreditCard />} 
                    onClick={() => {
                      resetConfigForm();
                      setConfigDialogOpen(true);
                    }}
                  >
                    Nouvelle configuration
                  </Button>
                </Box>

                <SearchInput sx={{ mb: 2, width: '100%', maxWidth: 300 }}>
                  <SearchIconWrapper>
                    <SearchIcon />
                  </SearchIconWrapper>
                  <StyledInputBase
                    placeholder="Rechercher un fournisseur..."
                    inputProps={{ 'aria-label': 'search' }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </SearchInput>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Fournisseur</TableCell>
                        <TableCell align="right">Limite de crédit</TableCell>
                        <TableCell align="right">Délai (jours)</TableCell>
                        <TableCell align="right">Taux d'intérêt</TableCell>
                        <TableCell align="center">Auto-approbation</TableCell>
                        <TableCell align="center">Fréquence</TableCell>
                        <TableCell align="center">Statut</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredConfigs.length > 0 ? (
                        filteredConfigs.map((config) => (
                          <TableRow key={config.id}>
                            <TableCell>{config.supplier_name}</TableCell>
                            <TableCell align="right">{formatCurrency(config.credit_limit)}</TableCell>
                            <TableCell align="right">{config.payment_delay_days}</TableCell>
                            <TableCell align="right">{config.interest_rate}%</TableCell>
                            <TableCell align="center">
                              {config.auto_approve ? (
                                <CheckCircle color="success" fontSize="small" />
                              ) : (
                                <Cancel color="error" fontSize="small" />
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={config.payment_frequency || 'Mensuel'} 
                                size="small" 
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Chip 
                                label={config.is_active ? 'Actif' : 'Inactif'} 
                                size="small"
                                color={config.is_active ? 'success' : 'default'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="Modifier">
                                <IconButton size="small" onClick={() => handleEditConfig(config)}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Supprimer">
                                <IconButton size="small" onClick={() => handleDeleteConfig(config)}>
                                  <Delete fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography color="text.secondary">
                              {searchQuery ? 'Aucune configuration trouvée' : 'Aucune configuration créée'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Fournisseurs sans configuration
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Fournisseur</TableCell>
                          <TableCell align="right">Type</TableCell>
                          <TableCell align="right">Téléphone</TableCell>
                          <TableCell align="center">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {suppliersList
                          .filter(s => !configs.some(c => c.supplier_id === s.id))
                          .slice(0, 10)
                          .map((supplier) => (
                            <TableRow key={supplier.id}>
                              <TableCell>{supplier.name}</TableCell>
                              <TableCell align="right">{supplier.type_supplier || '-'}</TableCell>
                              <TableCell align="right">{supplier.phone || '-'}</TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setSelectedSupplierForConfig(supplier.id);
                                    resetConfigForm();
                                    setConfigDialogOpen(true);
                                  }}
                                >
                                  Configurer
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 3: BÉNÉFICE RÉEL */}
        {/* ============================================== */}
        {activeTab === 3 && (
          <Fade in>
            <Box>
              <Card sx={{ mb: 4 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Assessment color="primary" />
                    Calcul du bénéfice réel
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                    Le bénéfice réel tient compte de la variation de la dette fournisseurs pour donner une vision plus précise de la santé financière.
                  </Typography>
                  <Grid container spacing={2} sx={{ alignItems: 'flex-end' }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <DatePicker
                        label="Date début"
                        value={profitPeriod.start}
                        onChange={(date: Date | null) => setProfitPeriod({ ...profitPeriod, start: date })}
                        sx={{ width: '100%' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <DatePicker
                        label="Date fin"
                        value={profitPeriod.end}
                        onChange={(date: Date | null) => setProfitPeriod({ ...profitPeriod, end: date })}
                        sx={{ width: '100%' }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <Button variant="contained" fullWidth onClick={handleCalculateRealProfit}>
                        Calculer
                      </Button>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {realProfit && (
                <Zoom in>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Résultats pour la période
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
                        Du {formatDate(realProfit.start_date)} au {formatDate(realProfit.end_date)}
                      </Typography>

                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Bénéfice brut
                            </Typography>
                            <Typography variant="h5" sx={{ color: realProfit.gross_profit >= 0 ? 'success.main' : 'error.main' }}>
                              {formatCurrency(realProfit.gross_profit)}
                            </Typography>
                            <TrendingUp sx={{ mt: 1, color: realProfit.gross_profit >= 0 ? 'success.main' : 'error.main' }} />
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Variation de la dette
                            </Typography>
                            <Typography variant="h5" sx={{ color: realProfit.debt_variation <= 0 ? 'success.main' : 'error.main' }}>
                              {formatCurrency(Math.abs(realProfit.debt_variation))}
                            </Typography>
                            <Typography variant="caption" component="div">
                              {realProfit.debt_variation > 0 ? '(Augmentation de la dette ↗)' : '(Diminution de la dette ↘)'}
                            </Typography>
                          </Paper>
                        </Grid>
                        <Grid size={{ xs: 12, md: 4 }}>
                          <Paper
                            sx={{
                              p: 3,
                              textAlign: 'center',
                              bgcolor: realProfit.adjusted_profit >= 0 ? 'success.light' : 'error.light',
                              color: 'white',
                            }}
                          >
                            <Typography variant="caption">Bénéfice réel</Typography>
                            <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                              {formatCurrency(realProfit.adjusted_profit)}
                            </Typography>
                            <Typography variant="caption" component="div">
                              = Bénéfice brut - Augmentation de la dette
                            </Typography>
                          </Paper>
                        </Grid>
                      </Grid>

                      <Alert severity="info" sx={{ mt: 3 }}>
                        Le bénéfice réel est calculé en soustrayant l'augmentation de la dette fournisseurs
                        du bénéfice brut. Cela donne une vision plus précise de la santé financière réelle
                        de votre entreprise.
                        {realProfit.opening_debt !== undefined && realProfit.closing_debt !== undefined && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" component="div">
                              Dette d'ouverture: {formatCurrency(realProfit.opening_debt)}
                            </Typography>
                            <Typography variant="caption" component="div">
                              Dette de clôture: {formatCurrency(realProfit.closing_debt)}
                            </Typography>
                          </Box>
                        )}
                      </Alert>
                    </CardContent>
                  </Card>
                </Zoom>
              )}
            </Box>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 4: COÛTS */}
        {/* ============================================== */}
        {activeTab === 4 && (
          <Fade in>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <Typography variant="h6">Coûts enregistrés</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Catégorie</InputLabel>
                      <Select
                        value={filterCategory}
                        onChange={(e: SelectChangeEvent) => setFilterCategory(e.target.value)}
                        label="Catégorie"
                      >
                        <MenuItem value="all">Toutes</MenuItem>
                        <MenuItem value="stock">Stock</MenuItem>
                        <MenuItem value="services">Services</MenuItem>
                        <MenuItem value="salaries">Salaires</MenuItem>
                        <MenuItem value="rent">Loyer</MenuItem>
                        <MenuItem value="utilities">Utilités</MenuItem>
                        <MenuItem value="marketing">Marketing</MenuItem>
                        <MenuItem value="other">Autres</MenuItem>
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Statut</InputLabel>
                      <Select
                        value={filterStatus}
                        onChange={(e: SelectChangeEvent) => setFilterStatus(e.target.value)}
                        label="Statut"
                      >
                        <MenuItem value="all">Tous</MenuItem>
                        <MenuItem value="paid">Payé</MenuItem>
                        <MenuItem value="draft">Brouillon</MenuItem>
                        <MenuItem value="pending">En attente</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>
                </Box>

                <TableContainer component={Paper} variant="outlined">
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Référence</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Catégorie</TableCell>
                        <TableCell align="right">Montant</TableCell>
                        <TableCell>Date paiement</TableCell>
                        <TableCell>Fournisseur</TableCell>
                        <TableCell align="center">Statut</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {costs.map((cost) => (
                        <TableRow key={cost.id}>
                          <TableCell>{cost.reference}</TableCell>
                          <TableCell>{cost.description}</TableCell>
                          <TableCell>{cost.category}</TableCell>
                          <TableCell align="right">{formatCurrency(cost.total_amount)}</TableCell>
                          <TableCell>{formatDate(cost.payment_date)}</TableCell>
                          <TableCell>{cost.supplier_name || '-'}</TableCell>
                          <TableCell align="center">
                            <Chip
                              label={cost.status}
                              size="small"
                              color={cost.is_paid ? 'success' : 'warning'}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip title="Voir détails">
                              <IconButton size="small">
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {cost.supplier_id && !cost.is_paid && (
                              <Tooltip title="Convertir en crédit">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleCreatePurchaseCredit(cost.id)}
                                >
                                  <CreditCard fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {costs.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} align="center">
                            <Typography color="text.secondary">Aucun coût trouvé</Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* ============================================== */}
        {/* TAB 5: BUDGETS */}
        {/* ============================================== */}
        {activeTab === 5 && (
          <Fade in>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>Budgets en cours</Typography>
                <Grid container spacing={3}>
                  {budgets.map((budget) => {
                    const percentage = (budget.spent_amount / budget.allocated_amount) * 100;
                    return (
                      <Grid size={{ xs: 12, md: 6 }} key={budget.id}>
                        <Card variant="outlined">
                          <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                  {budget.name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Catégorie: {budget.category}
                                </Typography>
                              </Box>
                              <Chip
                                label={budget.is_active ? 'Actif' : 'Inactif'}
                                size="small"
                                color={budget.is_active ? 'success' : 'default'}
                              />
                            </Box>
                            
                            <Box sx={{ mt: 2 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                <Typography variant="body2">Progression</Typography>
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    color: percentage >= budget.critical_threshold ? 'error.main' 
                                      : percentage >= budget.warning_threshold ? 'warning.main' 
                                      : 'success.main'
                                  }}
                                >
                                  {percentage.toFixed(1)}%
                                </Typography>
                              </Box>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(percentage, 100)}
                                sx={{ 
                                  height: 8, 
                                  borderRadius: 4,
                                  bgcolor: 'grey.200',
                                  '& .MuiLinearProgress-bar': {
                                    bgcolor: percentage >= budget.critical_threshold ? 'error.main' 
                                      : percentage >= budget.warning_threshold ? 'warning.main' 
                                      : 'success.main'
                                  }
                                }}
                              />
                            </Box>
                            
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                              <Grid size={{ xs: 4 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Alloué
                                </Typography>
                                <Typography variant="body2">{formatCurrency(budget.allocated_amount)}</Typography>
                              </Grid>
                              <Grid size={{ xs: 4 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Dépensé
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'warning.main' }}>
                                  {formatCurrency(budget.spent_amount)}
                                </Typography>
                              </Grid>
                              <Grid size={{ xs: 4 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                  Restant
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'success.main' }}>
                                  {formatCurrency(budget.remaining_amount)}
                                </Typography>
                              </Grid>
                            </Grid>
                            
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                              Période: {formatDate(budget.start_date)} - {formatDate(budget.end_date)}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                  {budgets.length === 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Paper sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">Aucun budget trouvé</Typography>
                      </Paper>
                    </Grid>
                  )}
                </Grid>
              </CardContent>
            </Card>
          </Fade>
        )}

        {/* ============================================== */}
        {/* DIALOGUES */}
        {/* ============================================== */}
        
        {/* Dialogue Ajout/Modification fournisseur */}
        <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingSupplier ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}
          </DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0 }}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Nom *"
                  value={supplierForm.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                  margin="normal"
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Nom de l'entreprise"
                  value={supplierForm.company_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, company_name: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Type de fournisseur</InputLabel>
                  <Select
                    value={supplierForm.type_supplier}
                    onChange={(e: SelectChangeEvent) => setSupplierForm({ ...supplierForm, type_supplier: e.target.value })}
                    label="Type de fournisseur"
                  >
                    <MenuItem value="regular">Régulier</MenuItem>
                    <MenuItem value="preferred">Préféré</MenuItem>
                    <MenuItem value="occasional">Occasionnel</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={supplierForm.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Téléphone"
                  value={supplierForm.phone}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Téléphone secondaire"
                  value={supplierForm.phone_secondary}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, phone_secondary: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Adresse"
                  value={supplierForm.address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Ville"
                  value={supplierForm.city}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Province"
                  value={supplierForm.province}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, province: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Pays"
                  value={supplierForm.country}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, country: e.target.value })}
                  margin="normal"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={supplierForm.notes}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSupplierForm({ ...supplierForm, notes: e.target.value })}
                  margin="normal"
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSupplierDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateSupplier} variant="contained">
              {editingSupplier ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialogue Remboursement */}
        <Dialog open={repaymentDialogOpen} onClose={() => setRepaymentDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            Remboursement fournisseur
            {selectedSupplier && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSupplier.supplier_name} - Dette: {formatCurrency(selectedSupplier.current_debt)}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Montant à rembourser"
              type="number"
              value={repaymentAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepaymentAmount(e.target.value)}
              margin="normal"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">FCFA</InputAdornment>,
                },
              }}
            />
            <TextField
              fullWidth
              label="Référence de paiement"
              value={repaymentReference}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepaymentReference(e.target.value)}
              margin="normal"
              placeholder="Facture #, Réf bancaire..."
            />
            <TextField
              fullWidth
              label="Notes (optionnel)"
              value={repaymentNotes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRepaymentNotes(e.target.value)}
              margin="normal"
              multiline
              rows={2}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRepaymentDialogOpen(false)}>Annuler</Button>
            <Button
              onClick={handleManualRepayment}
              variant="contained"
              disabled={!repaymentAmount || parseFloat(repaymentAmount) <= 0}
            >
              Confirmer le remboursement
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialogue Configuration crédit */}
        <Dialog open={configDialogOpen} onClose={() => setConfigDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {editingConfig ? 'Modifier la configuration' : 'Configuration crédit fournisseur'}
          </DialogTitle>
          <DialogContent>
            <FormControl fullWidth margin="normal">
              <InputLabel>Fournisseur</InputLabel>
              <Select
                value={selectedSupplierForConfig}
                onChange={(e: SelectChangeEvent) => setSelectedSupplierForConfig(e.target.value)}
                label="Fournisseur"
              >
                {suppliersList.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Limite de crédit"
              type="number"
              value={configForm.credit_limit}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfigForm({ ...configForm, credit_limit: e.target.value })}
              margin="normal"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">FCFA</InputAdornment>,
                },
              }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Délai de paiement (jours)</InputLabel>
              <Select
                value={configForm.payment_delay_days}
                onChange={(e: SelectChangeEvent) => setConfigForm({ ...configForm, payment_delay_days: e.target.value })}
                label="Délai de paiement (jours)"
              >
                <MenuItem value="7">7 jours</MenuItem>
                <MenuItem value="15">15 jours</MenuItem>
                <MenuItem value="30">30 jours</MenuItem>
                <MenuItem value="45">45 jours</MenuItem>
                <MenuItem value="60">60 jours</MenuItem>
                <MenuItem value="90">90 jours</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Taux d'intérêt (%)"
              type="number"
              value={configForm.interest_rate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfigForm({ ...configForm, interest_rate: e.target.value })}
              margin="normal"
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                },
              }}
            />

            <FormControl fullWidth margin="normal">
              <InputLabel>Fréquence de paiement</InputLabel>
              <Select
                value={configForm.payment_frequency}
                onChange={(e: SelectChangeEvent) => setConfigForm({ ...configForm, payment_frequency: e.target.value })}
                label="Fréquence de paiement"
              >
                <MenuItem value="daily">Quotidien</MenuItem>
                <MenuItem value="weekly">Hebdomadaire</MenuItem>
                <MenuItem value="monthly">Mensuel</MenuItem>
                <MenuItem value="quarterly">Trimestriel</MenuItem>
                <MenuItem value="semester">Semestriel</MenuItem>
                <MenuItem value="yearly">Annuel</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Pourcentage de remboursement sur vente (%)"
              type="number"
              value={configForm.repayment_percentage_of_sale}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfigForm({ ...configForm, repayment_percentage_of_sale: e.target.value })}
              margin="normal"
              helperText="Pourcentage de chaque vente utilisé pour rembourser la dette"
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                },
              }}
            />

            <FormControlLabel
              control={
                <Switch
                  checked={configForm.auto_approve}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfigForm({ ...configForm, auto_approve: e.target.checked })}
                />
              }
              label="Auto-approbation des achats à crédit"
              sx={{ mt: 2 }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfigDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateConfig} variant="contained">
              {editingConfig ? 'Mettre à jour' : 'Créer'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Dialogue Transactions */}
        <Dialog open={viewTransactionDialogOpen} onClose={() => setViewTransactionDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Transactions
            {selectedSupplier && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSupplier.supplier_name}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align="right">Montant</TableCell>
                    <TableCell>Référence</TableCell>
                    <TableCell>Description</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loadingTransactions ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <CircularProgress size={30} />
                      </TableCell>
                    </TableRow>
                  ) : transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{formatDateTime(transaction.transaction_date)}</TableCell>
                      <TableCell>
                        <Chip
                          label={transaction.transaction_type}
                          size="small"
                          color={
                            transaction.transaction_type === 'repayment' ? 'success'
                              : transaction.transaction_type === 'credit_purchase' ? 'primary'
                              : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ color: transaction.transaction_type === 'repayment' ? 'success.main' : 'error.main' }}>
                        {transaction.transaction_type === 'repayment' ? '-' : ''}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell>{transaction.payment_reference || '-'}</TableCell>
                      <TableCell>{transaction.description || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && !loadingTransactions && (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography color="text.secondary">Aucune transaction trouvée</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setViewTransactionDialogOpen(false)}>Fermer</Button>
          </DialogActions>
        </Dialog>

        {/* Dialogue Détails fournisseur */}
        <Dialog open={supplierDetailDialogOpen} onClose={() => setSupplierDetailDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>
            Détails du fournisseur
            {selectedSupplierDetail && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {selectedSupplierDetail.code}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            {selectedSupplierDetail && (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Business fontSize="small" />
                      Informations générales
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Nom:</strong> {selectedSupplierDetail.name}</Typography>
                    <Typography variant="body2"><strong>Entreprise:</strong> {selectedSupplierDetail.company_name || '-'}</Typography>
                    <Typography variant="body2"><strong>Type:</strong> {selectedSupplierDetail.type_supplier || '-'}</Typography>
                    <Typography variant="body2"><strong>Statut:</strong> {selectedSupplierDetail.status}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <ContactSupportIconMui fontSize="small" />
                      Contact
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Email:</strong> {selectedSupplierDetail.email || '-'}</Typography>
                    <Typography variant="body2"><strong>Téléphone:</strong> {selectedSupplierDetail.phone || '-'}</Typography>
                    <Typography variant="body2"><strong>Contact:</strong> {selectedSupplierDetail.contact_person || '-'}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocationOn fontSize="small" />
                      Adresse
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Adresse:</strong> {selectedSupplierDetail.address || '-'}</Typography>
                    <Typography variant="body2"><strong>Ville:</strong> {selectedSupplierDetail.city || '-'}</Typography>
                    <Typography variant="body2"><strong>Province:</strong> {selectedSupplierDetail.province || '-'}</Typography>
                    <Typography variant="body2"><strong>Pays:</strong> {selectedSupplierDetail.country || '-'}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <AccountBalance fontSize="small" />
                      Informations bancaires
                    </Typography>
                    <Divider sx={{ mb: 1 }} />
                    <Typography variant="body2"><strong>Banque:</strong> {selectedSupplierDetail.bank_name || '-'}</Typography>
                    <Typography variant="body2"><strong>Compte:</strong> {selectedSupplierDetail.bank_account || '-'}</Typography>
                    <Typography variant="body2"><strong>SWIFT:</strong> {selectedSupplierDetail.bank_swift || '-'}</Typography>
                  </Paper>
                </Grid>
                {selectedSupplierDetail.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="subtitle2">Notes</Typography>
                      <Divider sx={{ mb: 1 }} />
                      <Typography variant="body2">{selectedSupplierDetail.notes}</Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSupplierDetailDialogOpen(false)}>Fermer</Button>
            {selectedSupplierDetail && (
              <Button
                variant="contained"
                onClick={() => {
                  setSupplierDetailDialogOpen(false);
                  handleEditSupplier(selectedSupplierDetail);
                }}
              >
                Modifier
              </Button>
            )}
          </DialogActions>
        </Dialog>

        {/* Dialogue Confirmation */}
        <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
          <DialogTitle>{confirmTitle}</DialogTitle>
          <DialogContent>
            <Typography>{confirmMessage}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setConfirmDialogOpen(false)}>Annuler</Button>
            <Button onClick={confirmAction} color="error" variant="contained">
              Confirmer
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default SupplierCreditPage;