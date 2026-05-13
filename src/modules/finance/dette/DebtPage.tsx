// src/modules/finance/dette/DebtPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  CircularProgress,
  Chip,
  IconButton,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Autocomplete,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Payment as PaymentIcon,
  History as HistoryIcon,
  Close as CloseIcon,
  CreditCard as CreditCardIcon,
} from '@mui/icons-material';
import { format } from '@/utils/date';


// ============================================
// TYPES
// ============================================

interface Product {
  id: string;
  name: string;
  code: string;
  selling_price: number;
  quantity: number;
  category_id?: string;
}

interface DebtItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
}

interface Debt {
  id: string;
  debt_number: string;
  customer_name: string;
  customer_id?: string;
  items: DebtItem[];
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  due_date: string;
  status: 'pending' | 'partial' | 'paid';
  created_at: string;
  paid_at?: string;
  notes?: string;
}

interface Payment {
  id: string;
  debt_id: string;
  debt_number: string;
  customer_name: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference?: string;
  notes?: string;
  received_by: string;
}

type TabType = 'new' | 'payment' | 'list' | 'history';

interface TabPanelProps {
  children?: React.ReactNode;
  index: TabType;
  value: TabType;
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function DebtPage() {
  const [activeTab, setActiveTab] = useState<TabType>('new');
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  
  // États pour Nouvel Emprunt
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [debtCart, setDebtCart] = useState<DebtItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [savingDebt, setSavingDebt] = useState(false);
  
  // États pour Paiement
  const [debts, setDebts] = useState<Debt[]>([]);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // États pour Historique
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // États pour Liste
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // ============================================
  // CHARGEMENT DES DONNÉES
  // ============================================

  const loadProducts = useCallback(async () => {
    try {
      const mockProducts: Product[] = [
        {
          id: '1',
          name: 'Paracétamol 500mg',
          code: 'MED001',
          selling_price: 500,
          quantity: 100,
        },
        {
          id: '2',
          name: 'Amoxicilline 250mg',
          code: 'MED002',
          selling_price: 750,
          quantity: 50,
        },
        {
          id: '3',
          name: 'Vitamine C 1000mg',
          code: 'MED003',
          selling_price: 300,
          quantity: 200,
        },
      ];
      
      setProducts(mockProducts);
    } catch (error) {
      console.error('Erreur chargement produits:', error);
      showSnackbar('Impossible de charger les produits', 'error');
    }
  }, []);

  const loadDebts = useCallback(async () => {
    try {
      const mockDebts: Debt[] = [
        {
          id: '1',
          debt_number: 'DEBT-001',
          customer_name: 'Jean Mukeba',
          items: [
            {
              product_id: '1',
              product_name: 'Paracétamol 500mg',
              quantity: 2,
              unit_price: 500,
              total_amount: 1000,
            },
          ],
          total_amount: 1000,
          paid_amount: 300,
          remaining_amount: 700,
          due_date: '2024-12-31',
          status: 'partial',
          created_at: '2024-12-01T10:00:00Z',
        },
        {
          id: '2',
          debt_number: 'DEBT-002',
          customer_name: 'Marie Kabila',
          items: [
            {
              product_id: '2',
              product_name: 'Amoxicilline 250mg',
              quantity: 1,
              unit_price: 750,
              total_amount: 750,
            },
          ],
          total_amount: 750,
          paid_amount: 750,
          remaining_amount: 0,
          due_date: '2024-12-15',
          status: 'paid',
          created_at: '2024-12-02T14:30:00Z',
          paid_at: '2024-12-10T09:00:00Z',
        },
      ];
      
      setDebts(mockDebts);
    } catch (error) {
      console.error('Erreur chargement dettes:', error);
      showSnackbar('Impossible de charger les dettes', 'error');
    }
  }, []);

  const loadPayments = useCallback(async () => {
    try {
      const mockPayments: Payment[] = [
        {
          id: '1',
          debt_id: '1',
          debt_number: 'DEBT-001',
          customer_name: 'Jean Mukeba',
          amount: 300,
          payment_method: 'cash',
          payment_date: '2024-12-05T11:00:00Z',
          received_by: 'Admin',
        },
        {
          id: '2',
          debt_id: '2',
          debt_number: 'DEBT-002',
          customer_name: 'Marie Kabila',
          amount: 750,
          payment_method: 'mobile_money',
          payment_date: '2024-12-10T09:00:00Z',
          received_by: 'Admin',
        },
      ];
      
      setPayments(mockPayments);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
      showSnackbar('Impossible de charger les paiements', 'error');
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadProducts(), loadDebts(), loadPayments()]);
    } catch (error) {
      console.error('Erreur chargement:', error);
    } finally {
      setLoading(false);
    }
  }, [loadProducts, loadDebts, loadPayments]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  // ============================================
  // FILTRAGE PRODUITS
  // ============================================
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const term = searchTerm.toLowerCase();
    return products
      .filter(p => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, searchTerm]);

  // ============================================
  // GESTION PANIER D'EMPRUNT
  // ============================================
  const addToDebtCart = () => {
    if (!selectedProduct) {
      showSnackbar('Veuillez sélectionner un produit', 'error');
      return;
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty <= 0) {
      showSnackbar('Quantité invalide', 'error');
      return;
    }
    if (qty > selectedProduct.quantity) {
      showSnackbar(`Stock insuffisant. Disponible: ${selectedProduct.quantity}`, 'error');
      return;
    }

    const existingIndex = debtCart.findIndex(item => item.product_id === selectedProduct.id);
    if (existingIndex !== -1) {
      const newCart = [...debtCart];
      newCart[existingIndex] = {
        ...newCart[existingIndex],
        quantity: newCart[existingIndex].quantity + qty,
        total_amount: (newCart[existingIndex].quantity + qty) * selectedProduct.selling_price,
      };
      setDebtCart(newCart);
    } else {
      setDebtCart([...debtCart, {
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        quantity: qty,
        unit_price: selectedProduct.selling_price,
        total_amount: qty * selectedProduct.selling_price,
      }]);
    }

    setSelectedProduct(null);
    setSearchTerm('');
    setQuantity('1');
  };

  const removeFromDebtCart = (index: number) => {
    const newCart = [...debtCart];
    newCart.splice(index, 1);
    setDebtCart(newCart);
  };

  // ============================================
  // ENREGISTREMENT DE L'EMPRUNT
  // ============================================
  const saveDebt = async () => {
    if (debtCart.length === 0) {
      showSnackbar('Ajoutez au moins un produit', 'error');
      return;
    }
    if (!customerName.trim()) {
      showSnackbar('Nom du client requis', 'error');
      return;
    }

    setSavingDebt(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showSnackbar(`${debtCart.length} dette(s) enregistrée(s) avec succès`, 'success');
      
      setDebtCart([]);
      setCustomerName('');
      setNotes('');
      setDueDate(format(new Date(), 'yyyy-MM-dd'));
      
      await loadDebts();
      
    } catch (error) {
      console.error('Erreur enregistrement:', error);
      showSnackbar('Erreur lors de l\'enregistrement', 'error');
    } finally {
      setSavingDebt(false);
    }
  };

  // ============================================
  // PAIEMENT D'UNE DETTE
  // ============================================
  const openPaymentModal = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentModalVisible(true);
  };

  const processPayment = async () => {
    if (!selectedDebt) return;
    
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      showSnackbar('Montant invalide', 'error');
      return;
    }
    if (amount > selectedDebt.remaining_amount) {
      showSnackbar(`Le montant dépasse le solde restant (${selectedDebt.remaining_amount} FC)`, 'error');
      return;
    }

    setProcessingPayment(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      showSnackbar('Paiement enregistré avec succès', 'success');
      setPaymentModalVisible(false);
      
      await Promise.all([loadDebts(), loadPayments()]);
      
    } catch (error) {
      console.error('Erreur paiement:', error);
      showSnackbar('Erreur lors du paiement', 'error');
    } finally {
      setProcessingPayment(false);
    }
  };

  // ============================================
  // COMPOSANTS D'ONGLETS
  // ============================================

  const TabPanel = (props: TabPanelProps) => {
    const { children, value, index } = props;
    return value === index ? <Box sx={{ p: 3 }}>{children}</Box> : null;
  };

  const renderNewDebtTab = () => (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
      {/* Section Produits */}
      <Box sx={{ flex: { md: 7 }, width: '100%' }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            🛍️ Produits à emprunter
          </Typography>
          
          <Autocomplete
            fullWidth
            options={filteredProducts}
            getOptionLabel={(option: Product) => `${option.name} - ${option.selling_price} FC`}
            value={selectedProduct}
            onChange={(_event, newValue: Product | null) => setSelectedProduct(newValue)}
            inputValue={searchTerm}
            onInputChange={(_event, newInputValue: string) => setSearchTerm(newInputValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Rechercher un produit"
                variant="outlined"
                size="small"
              />
            )}
            renderOption={(props, option) => (
              <li {...props}>
                <Box>
                  <Typography variant="body2">{option.name}</Typography>
                  <Typography variant="caption" color="textSecondary">
                    Prix: {option.selling_price} FC | Stock: {option.quantity}
                  </Typography>
                </Box>
              </li>
            )}
          />

          {selectedProduct && (
            <Box sx={{ mt: 2, p: 2, bgcolor: '#E3F2FD', borderRadius: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} color="primary">
                {selectedProduct.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Prix: {selectedProduct.selling_price} FC
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2, alignItems: 'center' }}>
                <TextField
                  type="number"
                  label="Quantité"
                  value={quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                  size="small"
                  sx={{ width: 100 }}
                />
                <Button
                  variant="contained"
                  color="primary"
                  onClick={addToDebtCart}
                  startIcon={<AddIcon />}
                >
                  Ajouter
                </Button>
              </Box>
            </Box>
          )}

          {debtCart.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }} gutterBottom>
                📋 Panier d'emprunt
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Produit</TableCell>
                      <TableCell align="right">Quantité</TableCell>
                      <TableCell align="right">Prix unitaire</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell align="center">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {debtCart.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">{item.unit_price} FC</TableCell>
                        <TableCell align="right">{item.total_amount} FC</TableCell>
                        <TableCell align="center">
                          <IconButton size="small" color="error" onClick={() => removeFromDebtCart(index)}>
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} align="right" sx={{ fontWeight: 'bold' }}>
                        Total:
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {debtCart.reduce((s, i) => s + i.total_amount, 0)} FC
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>
      </Box>

      {/* Section Client */}
      <Box sx={{ flex: { md: 5 }, width: '100%' }}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            👤 Informations client
          </Typography>
          
          <TextField
            fullWidth
            label="Nom du client *"
            value={customerName}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomerName(e.target.value)}
            margin="normal"
            required
          />
          
          <TextField
            fullWidth
            label="Date d'échéance"
            type="date"
            value={dueDate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
            margin="normal"
            slotProps={{
              inputLabel: {
                shrink: true,
              },
            }}
          />
          
          <TextField
            fullWidth
            label="Notes (optionnel)"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
            margin="normal"
            multiline
            rows={3}
          />
          
          <Button
            fullWidth
            variant="contained"
            color="success"
            onClick={saveDebt}
            disabled={savingDebt}
            sx={{ mt: 3 }}
          >
            {savingDebt ? <CircularProgress size={24} /> : '💾 Enregistrer l\'emprunt'}
          </Button>
        </Paper>
      </Box>
    </Box>
  );

  const renderPaymentTab = () => {
    const unpaidDebts = debts.filter(d => d.status !== 'paid');
    
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {unpaidDebts.length === 0 ? (
          <Box sx={{ width: '100%' }}>
            <Paper sx={{ p: 5, textAlign: 'center' }}>
              <CreditCardIcon sx={{ fontSize: 64, color: '#ccc' }} />
              <Typography variant="h6" color="textSecondary">
                Aucune dette à payer
              </Typography>
            </Paper>
          </Box>
        ) : (
          unpaidDebts.map((debt) => (
            <Box key={debt.id} sx={{ width: { xs: '100%', md: 'calc(50% - 16px)' } }}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" color="primary">
                      {debt.debt_number}
                    </Typography>
                    <Chip
                      label={debt.status === 'partial' ? 'Partiel' : 'En attente'}
                      color={debt.status === 'partial' ? 'info' : 'warning'}
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="h6" gutterBottom>
                    👤 {debt.customer_name}
                  </Typography>
                  
                  {debt.items && debt.items.length > 0 && (
                    <Typography variant="body2" color="textSecondary" gutterBottom>
                      Produit: {debt.items[0]?.product_name || 'N/A'} 
                      {debt.items.length > 1 && ` +${debt.items.length - 1} autre(s)`}
                    </Typography>
                  )}
                  
                  <Box sx={{ my: 2 }}>
                    <Typography variant="body2">
                      Total: <strong>{debt.total_amount} FC</strong>
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      Payé: {debt.paid_amount} FC
                    </Typography>
                    <Typography variant="body2" color="error">
                      Reste: {debt.remaining_amount} FC
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" color="textSecondary">
                    Échéance: {format(new Date(debt.due_date), 'dd/MM/yyyy')}
                  </Typography>
                  
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    onClick={() => openPaymentModal(debt)}
                    startIcon={<PaymentIcon />}
                    sx={{ mt: 2 }}
                  >
                    Payer
                  </Button>
                </CardContent>
              </Card>
            </Box>
          ))
        )}
      </Box>
    );
  };

  const renderListTab = () => {
    const filteredDebts = filterStatus === 'all' 
      ? debts 
      : debts.filter(d => d.status === filterStatus);
    
    return (
      <Box>
        <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {['all', 'pending', 'partial', 'paid'].map((status) => (
            <Chip
              key={status}
              label={
                status === 'all' ? 'Tous' : 
                status === 'pending' ? 'En attente' :
                status === 'partial' ? 'Partiel' : 'Payé'
              }
              onClick={() => setFilterStatus(status)}
              color={filterStatus === status ? 'primary' : 'default'}
              variant={filterStatus === status ? 'filled' : 'outlined'}
            />
          ))}
        </Box>
        
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>N° Dette</TableCell>
                <TableCell>Client</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Payé</TableCell>
                <TableCell align="right">Reste</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Échéance</TableCell>
                <TableCell align="center">Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredDebts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell>{debt.debt_number}</TableCell>
                  <TableCell>{debt.customer_name}</TableCell>
                  <TableCell align="right">{debt.total_amount} FC</TableCell>
                  <TableCell align="right">{debt.paid_amount} FC</TableCell>
                  <TableCell align="right" sx={{ color: 'error.main' }}>
                    {debt.remaining_amount} FC
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={
                        debt.status === 'paid' ? 'Payé' :
                        debt.status === 'partial' ? 'Partiel' : 'En attente'
                      }
                      color={
                        debt.status === 'paid' ? 'success' :
                        debt.status === 'partial' ? 'info' : 'warning'
                      }
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {format(new Date(debt.due_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell align="center">
                    {debt.status !== 'paid' && (
                      <IconButton color="primary" onClick={() => openPaymentModal(debt)}>
                        <PaymentIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const renderHistoryTab = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>N° Dette</TableCell>
            <TableCell>Client</TableCell>
            <TableCell align="right">Montant</TableCell>
            <TableCell>Méthode</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>Reçu par</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 5 }}>
                <HistoryIcon sx={{ fontSize: 48, color: '#ccc' }} />
                <Typography color="textSecondary">Aucun historique de paiement</Typography>
              </TableCell>
            </TableRow>
          ) : (
            payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell>{payment.debt_number}</TableCell>
                <TableCell>{payment.customer_name}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                  {payment.amount} FC
                </TableCell>
                <TableCell>
                  {payment.payment_method === 'cash' ? 'Espèces' :
                   payment.payment_method === 'mobile_money' ? 'Mobile Money' : 'Compte'}
                </TableCell>
                <TableCell>
                  {format(new Date(payment.payment_date), 'dd MMM yyyy HH:mm')}
                </TableCell>
                <TableCell>{payment.received_by}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  // ============================================
  // MODAL DE PAIEMENT
  // ============================================
  const renderPaymentModal = () => (
    <Dialog open={paymentModalVisible} onClose={() => setPaymentModalVisible(false)} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Effectuer un paiement
          <IconButton onClick={() => setPaymentModalVisible(false)}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {selectedDebt && (
          <Box>
            <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
              <Typography variant="subtitle2" color="textSecondary">
                {selectedDebt.debt_number}
              </Typography>
              <Typography variant="h6" gutterBottom>
                {selectedDebt.customer_name}
              </Typography>
              <Typography variant="h5" color="error" sx={{ fontWeight: 'bold' }}>
                Montant restant: {selectedDebt.remaining_amount} FC
              </Typography>
            </Paper>
            
            <TextField
              fullWidth
              label="Montant à payer"
              type="number"
              value={paymentAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPaymentAmount(e.target.value)}
              margin="normal"
              placeholder="Ex: 5000"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Mode de paiement</InputLabel>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                label="Mode de paiement"
              >
                <MenuItem value="cash">Espèces</MenuItem>
                <MenuItem value="mobile_money">Mobile Money</MenuItem>
                <MenuItem value="account">Compte</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={() => setPaymentModalVisible(false)}>Annuler</Button>
        <Button
          onClick={processPayment}
          variant="contained"
          color="primary"
          disabled={processingPayment}
        >
          {processingPayment ? <CircularProgress size={24} /> : 'Confirmer le paiement'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ============================================
  // RENDU PRINCIPAL
  // ============================================
  
  return (
    <Box sx={{ flexGrow: 1, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Paper
        square
        sx={{
          bgcolor: '#2196F3',
          color: 'white',
          p: 2,
          borderRadius: 0,
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
          💰 Gestion des Dettes
        </Typography>
      </Paper>

      {/* Tabs */}
      <Paper square sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_event, newValue: TabType) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab label="📝 Nouvel emprunt" value="new" />
          <Tab label="💸 Paiement" value="payment" />
          <Tab label="📋 Liste" value="list" />
          <Tab label="📜 Historique" value="history" />
        </Tabs>
      </Paper>

      {/* Content */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Chargement...</Typography>
        </Box>
      ) : (
        <Box sx={{ p: 3 }}>
          <TabPanel value={activeTab} index="new">
            {renderNewDebtTab()}
          </TabPanel>
          <TabPanel value={activeTab} index="payment">
            {renderPaymentTab()}
          </TabPanel>
          <TabPanel value={activeTab} index="list">
            {renderListTab()}
          </TabPanel>
          <TabPanel value={activeTab} index="history">
            {renderHistoryTab()}
          </TabPanel>
        </Box>
      )}

      {/* Modal paiement */}
      {renderPaymentModal()}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}