// pages/UserManagement/UserPageControl.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Chip,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  CircularProgress,
  Paper,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  History as HistoryIcon,
  VpnKey as KeyIcon,
  Phone as PhoneIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import api from '@/api/client';
import { format } from '@/utils/date';


// ============================================================
// TYPES
// ============================================================

interface User {
  id: string;
  email: string;
  nom_complet: string;
  username?: string;
  phone?: string;
  role: string;
  actif: boolean;
  is_active?: boolean;
  created_at: string;
  last_login?: string;
  tenant_id: string;
}

interface UserHistory {
  id: string;
  action_type: string;
  module: string;
  entity_name: string;
  action_description: string;
  created_at: string;
  status: string;
  ip_address?: string;
}

// Rôles disponibles
const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Administrateur', color: '#f44336' },
  { value: 'gerant', label: 'Gérant', color: '#ff9800' },
  { value: 'pharmacien', label: 'Pharmacien', color: '#2196f3' },
  { value: 'caissier', label: 'Caissier', color: '#4caf50' },
  { value: 'vendeur', label: 'Vendeur', color: '#9c27b0' },
  { value: 'superviseur', label: 'Superviseur', color: '#00bcd4' },
  { value: 'technicien', label: 'Technicien', color: '#795548' },
];

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

const UserPageControl: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [dialogOpen, setDialogOpen] = useState<'create' | 'edit' | 'delete' | 'history' | 'password' | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    email: '',
    nom_complet: '',
    username: '',
    phone: '',
    role: 'vendeur',
    actif: true,
  });
  const [userHistory, setUserHistory] = useState<UserHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [filterRole, setFilterRole] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  // CORRECTION: Ajouter old_password dans le state
  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await loadUsers();
    } catch (error) {
      console.error('Erreur chargement données:', error);
      showSnackbar('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchTerm, filterRole, filterStatus]);

  const loadUsers = async () => {
    try {
      const response = await api.get('/users', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: searchTerm || undefined,
          role: filterRole || undefined,
          actif: filterStatus ? filterStatus === 'active' : undefined,
        },
      });
      
      console.log('API Response:', response.data);
      
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        setTotalUsers(response.data.length);
      }
      else if (response.data && Array.isArray(response.data.items)) {
        setUsers(response.data.items);
        setTotalUsers(response.data.total || response.data.items.length);
      }
      else if (response.data && Array.isArray(response.data.data)) {
        setUsers(response.data.data);
        setTotalUsers(response.data.total || response.data.data.length);
      }
      else if (response.data && Array.isArray(response.data.users)) {
        setUsers(response.data.users);
        setTotalUsers(response.data.total || response.data.users.length);
      }
      else if (response.data && typeof response.data === 'object') {
        const possibleArrays = ['items', 'data', 'users', 'results', 'records'];
        let foundArray = null;
        for (const key of possibleArrays) {
          if (Array.isArray(response.data[key])) {
            foundArray = response.data[key];
            setTotalUsers(response.data.total || response.data.count || foundArray.length);
            break;
          }
        }
        setUsers(foundArray || []);
      }
      else {
        console.warn('Format de réponse non reconnu:', response.data);
        setUsers([]);
        setTotalUsers(0);
      }
    } catch (error) {
      console.error('Erreur chargement utilisateurs:', error);
      throw error;
    }
  };

  const loadUserHistory = async (userId: string, pageNum: number = 0) => {
    setHistoryLoading(true);
    try {
      const response = await api.get(`/user-history/users/${userId}`, {
        params: {
          page: pageNum + 1,
          limit: 20,
        },
      });
      setUserHistory(response.data.items || []);
      setHistoryTotal(response.data.total_actions || 0);
      setHistoryPage(pageNum);
    } catch (error) {
      console.error('Erreur chargement historique:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page, rowsPerPage, searchTerm, filterRole, filterStatus]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCreateUser = async () => {
    if (!formData.email || !formData.nom_complet || !formData.role) {
      showSnackbar('Veuillez remplir tous les champs obligatoires', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.post('/auth/register', {
        email: formData.email,
        nom_complet: formData.nom_complet,
        username: formData.username || formData.email?.split('@')[0],
        phone: formData.phone,
        role: formData.role,
        password: 'Medigest2024!',
        actif: formData.actif,
      });

      if (response.data) {
        showSnackbar('Utilisateur créé avec succès', 'success');
        setDialogOpen(null);
        resetForm();
        loadUsers();
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Erreur lors de la création', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      const response = await api.put(`/users/${selectedUser.id}`, {
        nom_complet: formData.nom_complet,
        username: formData.username,
        phone: formData.phone,
        role: formData.role,
        actif: formData.actif,
      });

      if (response.data) {
        showSnackbar('Utilisateur modifié avec succès', 'success');
        setDialogOpen(null);
        resetForm();
        loadUsers();
      }
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Erreur lors de la modification', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    try {
      await api.delete(`/users/${selectedUser.id}`);
      showSnackbar('Utilisateur supprimé avec succès', 'success');
      setDialogOpen(null);
      loadUsers();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Erreur lors de la suppression', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // CORRECTION: Fonction handleChangePassword complète
  const handleChangePassword = async () => {
    if (!selectedUser) return;
    
    // Récupérer l'utilisateur connecté depuis le localStorage
    let currentUser = null;
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        currentUser = JSON.parse(userStr);
      }
    } catch (e) {
      console.error('Erreur lecture user:', e);
    }
    
    const isOwnPassword = currentUser && selectedUser.id === currentUser.id;
    
    // Validation
    if (!passwordData.new_password || passwordData.new_password.length < 8) {
      showSnackbar('Le mot de passe doit contenir au moins 8 caractères', 'error');
      return;
    }
    
    if (passwordData.new_password !== passwordData.confirm_password) {
      showSnackbar('Les mots de passe ne correspondent pas', 'error');
      return;
    }
    
    // Si c'est son propre mot de passe, vérifier l'ancien mot de passe
    if (isOwnPassword && !passwordData.old_password) {
      showSnackbar('Veuillez saisir votre mot de passe actuel', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (isOwnPassword) {
        // Endpoint pour son propre compte
        await api.post('/users/me/change-password', {
          old_password: passwordData.old_password,
          new_password: passwordData.new_password,
        });
        showSnackbar('Votre mot de passe a été modifié avec succès', 'success');
      } else {
        // Endpoint admin pour les autres utilisateurs
        await api.post(`/users/${selectedUser.id}/change-password`, {
          new_password: passwordData.new_password,
        });
        showSnackbar(`Mot de passe modifié pour ${selectedUser.nom_complet}`, 'success');
      }
      
      setDialogOpen(null);
      setPasswordData({ 
        old_password: '', 
        new_password: '', 
        confirm_password: '' 
      });
      
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      
      let errorMessage = 'Erreur lors du changement de mot de passe';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      showSnackbar(errorMessage, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      nom_complet: '',
      username: '',
      phone: '',
      role: 'vendeur',
      actif: true,
    });
    setSelectedUser(null);
    setUserHistory([]);
    setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
  };

  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setFormData({
      nom_complet: user.nom_complet,
      username: user.username || '',
      phone: user.phone || '',
      role: user.role,
      actif: user.actif !== undefined ? user.actif : user.is_active !== undefined ? user.is_active : true,
    });
    setDialogOpen('edit');
  };

  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setDialogOpen('delete');
  };

  const openHistoryDialog = async (user: User) => {
    setSelectedUser(user);
    setDialogOpen('history');
    await loadUserHistory(user.id);
  };

  const openPasswordDialog = (user: User) => {
    setSelectedUser(user);
    setDialogOpen('password');
    setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
  };

  // Fonction pour vérifier si l'utilisateur sélectionné est l'utilisateur connecté
  const isCurrentUser = () => {
    if (!selectedUser) return false;
    try {
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      return selectedUser.id === currentUser.id;
    } catch {
      return false;
    }
  };

  const getRoleColor = (role: string) => {
    const found = AVAILABLE_ROLES.find(r => r.value === role);
    return found?.color || '#999';
  };

  const getRoleLabel = (role: string) => {
    const found = AVAILABLE_ROLES.find(r => r.value === role);
    return found?.label || role;
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {/* En-tête */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PeopleIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                  Gestion des Utilisateurs
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gérez les utilisateurs, leurs rôles et accès
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
                Actualiser
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => {
                  resetForm();
                  setDialogOpen('create');
                }}
              >
                Nouvel Utilisateur
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Card sx={{ mb: 3, borderRadius: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 300px' }, minWidth: '200px' }}>
              <TextField
                fullWidth
                placeholder="Rechercher par nom, email ou téléphone..."
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
                size="small"
              />
            </Box>
            <Box sx={{ minWidth: '150px' }}>
              <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Rôle</InputLabel>
                <Select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} label="Rôle">
                  <MenuItem value="">Tous</MenuItem>
                  {AVAILABLE_ROLES.map(role => (
                    <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ minWidth: '150px' }}>
              <FormControl fullWidth size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Statut</InputLabel>
                <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} label="Statut">
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="active">Actif</MenuItem>
                  <MenuItem value="inactive">Inactif</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {totalUsers} utilisateur{totalUsers > 1 ? 's' : ''}
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Tableau des utilisateurs */}
      <Card sx={{ borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#fafafa' }}>
              <TableRow>
                <TableCell>Utilisateur</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Rôle</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Dernière connexion</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography color="text.secondary">Aucun utilisateur trouvé</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Avatar sx={{ bgcolor: getRoleColor(user.role) }}>
                          {user.nom_complet?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                            {user.nom_complet}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" component="div">
                            {user.email}
                          </Typography>
                          {user.username && (
                            <Typography variant="caption" color="text.secondary" component="div">
                              @{user.username}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {user.phone && (
                        <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <PhoneIcon sx={{ fontSize: 14 }} /> {user.phone}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getRoleLabel(user.role)}
                        size="small"
                        sx={{
                          bgcolor: `${getRoleColor(user.role)}20`,
                          color: getRoleColor(user.role),
                          fontWeight: 'medium',
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={(user.actif !== undefined ? user.actif : user.is_active) ? 'Actif' : 'Inactif'}
                        size="small"
                        color={(user.actif !== undefined ? user.actif : user.is_active) ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {user.last_login ? (
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(user.last_login), 'dd MMM yyyy HH:mm')}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">Jamais</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="Modifier">
                          <IconButton size="small" onClick={() => openEditDialog(user)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Mot de passe">
                          <IconButton size="small" onClick={() => openPasswordDialog(user)}>
                            <KeyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Historique">
                          <IconButton size="small" onClick={() => openHistoryDialog(user)}>
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Supprimer">
                          <IconButton size="small" onClick={() => openDeleteDialog(user)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={totalUsers}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          labelRowsPerPage="Lignes par page"
          labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
        />
      </Card>

      {/* Dialog Création/Modification */}
      <Dialog open={dialogOpen === 'create' || dialogOpen === 'edit'} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogOpen === 'create' ? 'Créer un utilisateur' : "Modifier l'utilisateur"}
          <IconButton aria-label="close" onClick={() => setDialogOpen(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {dialogOpen === 'create' && (
              <TextField
                fullWidth
                label="Email *"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            )}
            <TextField
              fullWidth
              label="Nom complet *"
              value={formData.nom_complet}
              onChange={(e) => setFormData({ ...formData, nom_complet: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Nom d'utilisateur"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            />
            <TextField
              fullWidth
              label="Téléphone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Rôle *</InputLabel>
              <Select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                label="Rôle *"
              >
                {AVAILABLE_ROLES.map(role => (
                  <MenuItem key={role.value} value={role.value}>{role.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.actif}
                  onChange={(e) => setFormData({ ...formData, actif: e.target.checked })}
                />
              }
              label="Compte actif"
            />
            {dialogOpen === 'create' && (
              <Alert severity="info">
                Un mot de passe temporaire sera envoyé à l'utilisateur.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Annuler</Button>
          <Button
            variant="contained"
            onClick={dialogOpen === 'create' ? handleCreateUser : handleUpdateUser}
            disabled={submitting}
          >
            {dialogOpen === 'create' ? 'Créer' : 'Enregistrer'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Suppression */}
      <Dialog open={dialogOpen === 'delete'} onClose={() => setDialogOpen(null)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer l'utilisateur <strong>{selectedUser?.nom_complet}</strong> ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(null)}>Annuler</Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained" disabled={submitting}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Historique */}
      <Dialog open={dialogOpen === 'history'} onClose={() => setDialogOpen(null)} maxWidth="lg" fullWidth>
        <DialogTitle>
          Historique - {selectedUser?.nom_complet}
          <IconButton aria-label="close" onClick={() => setDialogOpen(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">Total : {historyTotal} actions</Typography>
          </Box>
          {historyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
          ) : userHistory.length === 0 ? (
            <Typography color="text.secondary" align="center" sx={{ py: 4 }}>Aucune action enregistrée</Typography>
          ) : (
            <>
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Module</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {userHistory.map((history) => (
                      <TableRow key={history.id} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {format(new Date(history.created_at), 'dd/MM/yyyy HH:mm:ss')}
                        </TableCell>
                        <TableCell><Chip label={history.action_type} size="small" variant="outlined" /></TableCell>
                        <TableCell><Chip label={history.module} size="small" variant="outlined" /></TableCell>
                        <TableCell>{history.action_description}</TableCell>
                        <TableCell>
                          <Chip label={history.status} size="small" color={history.status === 'success' ? 'success' : 'error'} variant="outlined" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={historyTotal}
                page={historyPage}
                onPageChange={(_, newPage) => selectedUser && loadUserHistory(selectedUser.id, newPage)}
                rowsPerPage={20}
                rowsPerPageOptions={[20]}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Mot de passe - CORRECTION: Ajouter le champ ancien mot de passe pour son propre compte */}
      <Dialog open={dialogOpen === 'password'} onClose={() => setDialogOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Changer le mot de passe - {selectedUser?.nom_complet}
          <IconButton aria-label="close" onClick={() => setDialogOpen(null)} sx={{ position: 'absolute', right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Alert severity={isCurrentUser() ? "info" : "warning"} sx={{ mb: 2 }}>
            {isCurrentUser() 
              ? "Pour modifier votre propre mot de passe, vous devez saisir votre mot de passe actuel" 
              : "Minimum 8 caractères"}
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Afficher l'ancien mot de passe UNIQUEMENT pour son propre compte */}
            {isCurrentUser() && (
              <TextField
                fullWidth
                type="password"
                label="Mot de passe actuel *"
                value={passwordData.old_password}
                onChange={(e) => setPasswordData({ ...passwordData, old_password: e.target.value })}
                required
              />
            )}
            <TextField
              fullWidth
              type="password"
              label="Nouveau mot de passe *"
              value={passwordData.new_password}
              onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
              required
            />
            <TextField
              fullWidth
              type="password"
              label="Confirmer le nouveau mot de passe *"
              value={passwordData.confirm_password}
              onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
              error={passwordData.confirm_password !== '' && passwordData.new_password !== passwordData.confirm_password}
              helperText={passwordData.confirm_password !== '' && passwordData.new_password !== passwordData.confirm_password 
                ? 'Les mots de passe ne correspondent pas' 
                : ''}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDialogOpen(null);
            setPasswordData({ old_password: '', new_password: '', confirm_password: '' });
          }}>
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleChangePassword}
            disabled={submitting || !passwordData.new_password || passwordData.new_password !== passwordData.confirm_password}
          >
            Changer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UserPageControl;