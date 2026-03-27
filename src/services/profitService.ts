// frontend/src/services/profit.service.ts
import api from '@/api/client';
import { 
  ProfitStats, 
  DailyProfit, 
  PeriodProfit, 
  UserProfit, 
  BranchProfit, 
  SessionProfit,
  ProfitComparison,
  ProfitTrend,
  SWOTAnalysis,
  ProfitForecast,
  BestPerformers,
  FinancialAnalysis,
  ProfitHistory,
  ProfitFilters
} from '@/types/profit';

class ProfitService {
  private baseUrl = '/profit';

  /**
   * Statistiques globales des bénéfices
   */
  async getStats(filters: ProfitFilters): Promise<ProfitStats> {
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period);
    if (filters.pharmacyId) params.append('pharmacy_id', filters.pharmacyId);
    if (filters.branchId) params.append('branch_id', filters.branchId);
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    
    const response = await api.get(`${this.baseUrl}/stats`, { params });
    return response.data;
  }

  /**
   * Bénéfices journaliers
   */
  async getDailyProfit(days: number = 30, pharmacyId?: string, branchId?: string): Promise<DailyProfit[]> {
    const params = new URLSearchParams();
    params.append('days', days.toString());
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    if (branchId) params.append('branch_id', branchId);
    
    const response = await api.get(`${this.baseUrl}/daily`, { params });
    return response.data;
  }

  /**
   * Bénéfices par période
   */
  async getPeriodProfit(
    period: string, 
    year?: number, 
    month?: number, 
    pharmacyId?: string, 
    branchId?: string
  ): Promise<PeriodProfit> {
    const params = new URLSearchParams();
    params.append('period', period);
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    if (branchId) params.append('branch_id', branchId);
    
    const response = await api.get(`${this.baseUrl}/by-period`, { params });
    return response.data;
  }

  /**
   * Bénéfices par utilisateur (vendeur)
   */
  async getProfitByUser(
    period: string = 'month',
    limit: number = 10,
    startDate?: string,
    endDate?: string,
    pharmacyId?: string
  ): Promise<UserProfit[]> {
    const params = new URLSearchParams();
    params.append('period', period);
    params.append('limit', limit.toString());
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/by-user`, { params });
    return response.data;
  }

  /**
   * Bénéfices par succursale
   */
  async getProfitByBranch(
    period: string = 'month',
    startDate?: string,
    endDate?: string,
    pharmacyId?: string
  ): Promise<BranchProfit[]> {
    const params = new URLSearchParams();
    params.append('period', period);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/by-branch`, { params });
    return response.data;
  }

  /**
   * Bénéfices par session de caisse
   */
  async getProfitBySession(
    date?: string,
    pharmacyId?: string,
    limit: number = 20
  ): Promise<SessionProfit[]> {
    const params = new URLSearchParams();
    if (date) params.append('date_filter', date);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    params.append('limit', limit.toString());
    
    const response = await api.get(`${this.baseUrl}/by-session`, { params });
    return response.data;
  }

  /**
   * Comparaison des bénéfices entre deux périodes
   */
  async compareProfit(
    period1Type: string,
    period2Type: string,
    period1Start?: string,
    period1End?: string,
    period2Start?: string,
    period2End?: string,
    pharmacyId?: string
  ): Promise<ProfitComparison> {
    const params = new URLSearchParams();
    params.append('period1_type', period1Type);
    params.append('period2_type', period2Type);
    if (period1Start) params.append('period1_start', period1Start);
    if (period1End) params.append('period1_end', period1End);
    if (period2Start) params.append('period2_start', period2Start);
    if (period2End) params.append('period2_end', period2End);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/comparison`, { params });
    return response.data;
  }

  /**
   * Tendance des bénéfices
   */
  async getProfitTrend(months: number = 12, pharmacyId?: string): Promise<ProfitTrend> {
    const params = new URLSearchParams();
    params.append('months', months.toString());
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/trend`, { params });
    return response.data;
  }

  /**
   * Analyse SWOT
   */
  async getSWOTAnalysis(pharmacyId?: string): Promise<SWOTAnalysis> {
    const params = new URLSearchParams();
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/swot`, { params });
    return response.data;
  }

  /**
   * Prévisions de bénéfices
   */
  async getProfitForecast(months: number = 6, pharmacyId?: string): Promise<ProfitForecast> {
    const params = new URLSearchParams();
    params.append('months', months.toString());
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/forecast`, { params });
    return response.data;
  }

  /**
   * Meilleurs performers
   */
  async getBestPerformers(
    period: string = 'month',
    limit: number = 5,
    startDate?: string,
    endDate?: string,
    pharmacyId?: string
  ): Promise<BestPerformers> {
    const params = new URLSearchParams();
    params.append('period', period);
    params.append('limit', limit.toString());
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/best-performers`, { params });
    return response.data;
  }

  /**
   * Historique des bénéfices
   */
  async getProfitHistory(
    startDate: string,
    endDate: string,
    groupBy: string = 'day',
    pharmacyId?: string,
    branchId?: string
  ): Promise<ProfitHistory> {
    const params = new URLSearchParams();
    params.append('start_date', startDate);
    params.append('end_date', endDate);
    params.append('group_by', groupBy);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    if (branchId) params.append('branch_id', branchId);
    
    const response = await api.get(`${this.baseUrl}/history`, { params });
    return response.data;
  }

  /**
   * Analyse financière complète
   */
  async getFinancialAnalysis(period: string = 'month', pharmacyId?: string): Promise<FinancialAnalysis> {
    const params = new URLSearchParams();
    params.append('period', period);
    if (pharmacyId) params.append('pharmacy_id', pharmacyId);
    
    const response = await api.get(`${this.baseUrl}/financial-analysis`, { params });
    return response.data;
  }
}

export const profitService = new ProfitService();
export default profitService;