// src/pages/Returns/components/StatsCards.tsx
import React from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  Inventory as InventoryIcon,
  Pending as PendingIcon,
  CheckCircleOutlined as ProcessedIcon,
  CancelOutlined as RejectedIcon,
  AttachMoney as MoneyIcon,
  People as PeopleIcon,
  Store as StoreIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';

interface StatsCardsProps {
  stats: any;
  period: string;
  loading?: boolean;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats, period, loading = false }) => {
  const theme = useTheme();

  const periodLabels: Record<string, string> = {
    today: "aujourd'hui",
    yesterday: 'hier',
    this_week: 'cette semaine',
    this_month: 'ce mois',
    this_year: 'cette année',
  };

  const cards = [
    {
      title: 'Total retours',
      value: stats?.total_returns || 0,
      icon: <InventoryIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.primary.main,
      bgColor: `${theme.palette.primary.light}20`,
    },
    {
      title: 'En attente',
      value: stats?.pending_count || 0,
      icon: <PendingIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.warning.main,
      bgColor: `${theme.palette.warning.light}20`,
    },
    {
      title: 'Traités',
      value: stats?.processed_count || 0,
      icon: <ProcessedIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.success.main,
      bgColor: `${theme.palette.success.light}20`,
    },
    {
      title: 'Rejetés',
      value: stats?.rejected_count || 0,
      icon: <RejectedIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.error.main,
      bgColor: `${theme.palette.error.light}20`,
    },
    {
      title: 'Remboursements',
      value: `${(stats?.total_refund_amount || 0).toLocaleString('fr-FR')} FCFA`,
      icon: <MoneyIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.info.main,
      bgColor: `${theme.palette.info.light}20`,
    },
    {
      title: 'Retours clients',
      value: stats?.customer_returns || 0,
      icon: <PeopleIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.secondary.main,
      bgColor: `${theme.palette.secondary.light}20`,
    },
    {
      title: 'Retours fournisseurs',
      value: stats?.supplier_returns || 0,
      icon: <StoreIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.warning.main,
      bgColor: `${theme.palette.warning.light}20`,
    },
    {
      title: 'Frais de restockage',
      value: `${(stats?.total_restocking_fees || 0).toLocaleString('fr-FR')} FCFA`,
      icon: <TrendingUpIcon sx={{ fontSize: 32 }} />,
      color: theme.palette.grey[700],
      bgColor: `${theme.palette.grey[200]}`,
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Affichage de la période */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="body2" color="textSecondary">
          Période: <strong>{periodLabels[period] || period}</strong>
        </Typography>
      </Box>
      
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {cards.map((card, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
            <Paper
              elevation={2}
              sx={{
                p: 2,
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: theme.shadows[8],
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" color="textSecondary" gutterBottom>
                    {card.title}
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {card.value}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    backgroundColor: card.bgColor,
                    borderRadius: '50%',
                    p: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.color,
                  }}
                >
                  {card.icon}
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default StatsCards;