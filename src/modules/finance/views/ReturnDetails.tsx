// src/pages/Returns/components/ReturnDetails.tsx
import React from 'react';
import {
  Box,
  Grid,
  Typography,
  Chip,
  Paper,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  PlayArrow as ProcessIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ReturnDetailsProps {
  returnObj: any;
  onApprove?: () => void;
  onReject?: () => void;
  onProcess?: () => void;
}

const ReturnDetails: React.FC<ReturnDetailsProps> = ({
  returnObj,
  onApprove,
  onReject,
  onProcess,
}) => {
  const theme = useTheme();
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return theme.palette.warning.main;
      case 'approved': return theme.palette.info.main;
      case 'rejected': return theme.palette.error.main;
      case 'processed': return theme.palette.success.main;
      default: return theme.palette.grey[500];
    }
  };
  
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'approved': return 'Approuvé';
      case 'rejected': return 'Rejeté';
      case 'processed': return 'Traité';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };
  
  return (
    <Box>
      {/* En-tête avec statut */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {returnObj.return_number}
        </Typography>
        <Chip
          label={getStatusLabel(returnObj.status)}
          sx={{
            backgroundColor: getStatusColor(returnObj.status) + '20',
            color: getStatusColor(returnObj.status),
            fontWeight: 'bold',
          }}
        />
      </Box>
      
      {/* Informations principales */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Informations client
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  {returnObj.customer_name || 'Non renseigné'}
                </Typography>
              </Box>
              {returnObj.customer_phone && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2">{returnObj.customer_phone}</Typography>
                </Box>
              )}
              {returnObj.customer_email && (
                <Typography variant="body2" color="textSecondary">
                  {returnObj.customer_email}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
        
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="textSecondary" gutterBottom>
              Détails du retour
            </Typography>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ReceiptIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Facture: {returnObj.invoice_number || 'Non renseignée'}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CalendarIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  Demandé le: {format(new Date(returnObj.requested_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </Typography>
              </Box>
              {returnObj.processed_date && (
                <Typography variant="body2" color="success.main">
                  Traité le: {format(new Date(returnObj.processed_date), 'dd MMMM yyyy à HH:mm', { locale: fr })}
                </Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Montants */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          Montants
        </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="textSecondary">
              Sous-total
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
              {returnObj.subtotal?.toLocaleString('fr-FR') || 0} FCFA
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="textSecondary">
              Taxes
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
              {returnObj.tax_amount?.toLocaleString('fr-FR') || 0} FCFA
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="textSecondary">
              Total
            </Typography>
            <Typography variant="h6" color="primary.main">
              {returnObj.total_amount?.toLocaleString('fr-FR') || 0} FCFA
            </Typography>
          </Grid>
        </Grid>
        {returnObj.refund_amount && (
          <Box sx={{ mt: 2, pt: 1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="success.main">
              Remboursé: {returnObj.refund_amount.toLocaleString('fr-FR')} FCFA
            </Typography>
          </Box>
        )}
      </Paper>
      
      {/* Produits retournés */}
      <Typography variant="subtitle2" gutterBottom>
        Produits retournés
      </Typography>
      <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: theme.palette.grey[100] }}>
              <TableCell>Produit</TableCell>
              <TableCell align="center">Quantité</TableCell>
              <TableCell align="right">Prix unitaire</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>État</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returnObj.items?.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                    {item.product_name}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {item.product_code}
                  </Typography>
                </TableCell>
                <TableCell align="center">{item.quantity}</TableCell>
                <TableCell align="right">
                  {item.unit_price?.toLocaleString('fr-FR')} FCFA
                </TableCell>
                <TableCell align="right">
                  <Typography sx={{ fontWeight: 'medium' }}>
                    {item.total?.toLocaleString('fr-FR')} FCFA
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={
                      item.condition === 'new' ? 'Neuf' : 
                      item.condition === 'opened' ? 'Ouvert' : 
                      item.condition === 'damaged' ? 'Endommagé' :
                      item.condition === 'expired' ? 'Expiré' : 'Standard'
                    }
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      {/* Notes */}
      {returnObj.notes && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Notes
          </Typography>
          <Typography variant="body2">{returnObj.notes}</Typography>
        </Paper>
      )}
      
      {/* Actions */}
      {['pending', 'approved'].includes(returnObj.status) && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
          {returnObj.status === 'pending' && (
            <>
              <Button
                variant="outlined"
                color="error"
                startIcon={<RejectIcon />}
                onClick={onReject}
              >
                Rejeter
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={<ApproveIcon />}
                onClick={onApprove}
              >
                Approuver
              </Button>
            </>
          )}
          {returnObj.status === 'approved' && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<ProcessIcon />}
              onClick={onProcess}
            >
              Traiter le retour
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ReturnDetails;