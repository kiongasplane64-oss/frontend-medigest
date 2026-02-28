import api from '@/api/client';

export interface FinanceSummary {
  revenue: number;      // Chiffre d'affaires
  expenses: number;     // Dépenses totales
  net_profit: number;   // Bénéfice net
  capital: number;      // Capital actuel
}

export const getFinanceSummary = async (): Promise<FinanceSummary> => {
  const { data } = await api.get('/routes/finance/summary');
  return data;
};