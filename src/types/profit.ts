// frontend/src/types/profit.ts
export interface ProfitFilters {
  period?: 'day' | 'week' | 'month' | 'year' | 'custom';
  pharmacyId?: string;
  branchId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ProfitStats {
  gross_profit: number;
  net_profit: number;
  total_revenue: number;
  total_cost: number;
  expected_profit: number;
  actual_profit: number;
  remaining_profit: number;
  margin_rate: number;
  purchase_value: number;
  selling_value: number;
  period_start?: string;
  period_end?: string;
}

export interface DailyProfit {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  margin_rate: number;
  sales_count: number;
}

export interface PeriodProfitData {
  period: string;
  profit: number;
  revenue: number;
}

export interface PeriodProfit {
  period: string;
  data: PeriodProfitData[];
  total_profit: number;
  total_revenue: number;
  average_profit: number;
  best_day: PeriodProfitData | null;
  worst_day: PeriodProfitData | null;
}

export interface UserProfit {
  user_id: string;
  user_name: string;
  user_role: string;
  total_revenue: number;
  total_profit: number;
  sale_count: number;
  margin_rate: number;
}

export interface BranchProfit {
  branch_id: string;
  branch_name: string;
  total_revenue: number;
  total_profit: number;
  sale_count: number;
  margin_rate: number;
  city?: string;
}

export interface SessionProfit {
  session_id: string;
  user_id: string;
  user_name: string;
  pharmacy_id?: string;
  session_start: string;
  session_end?: string;
  total_revenue: number;
  total_profit: number;
  sale_count: number;
  margin_rate: number;
}

export interface ProfitComparison {
  period1: {
    start: string;
    end: string;
    profit: number;
    revenue: number;
  };
  period2: {
    start: string;
    end: string;
    profit: number;
    revenue: number;
  };
  absolute_change: number;
  percentage_change: number;
  trend: 'up' | 'down' | 'stable';
  analysis: string;
}

export interface MonthlyData {
  month: string;
  profit: number;
  revenue: number;
}

export interface ForecastData {
  month: string;
  projected_profit: number;
  confidence: string;
}

export interface ProfitTrend {
  monthly_data: MonthlyData[];
  trend_percentage: number;
  trend_direction: 'up' | 'down' | 'stable';
  forecast: ForecastData[];
}

export interface SWOTItem {
  category: string;
  description: string;
  impact?: string;
  score?: number;
  potential?: number;
  action?: string;
  severity?: number;
  mitigation?: string;
}

export interface SWOTAnalysis {
  strengths: SWOTItem[];
  weaknesses: SWOTItem[];
  opportunities: SWOTItem[];
  threats: SWOTItem[];
  recommendations: string[];
  summary: string;
  last_updated: string;
}

export interface ForecastItem {
  month: string;
  projected_profit: number;
  lower_bound: number;
  upper_bound: number;
}

export interface ProfitForecast {
  forecast: ForecastItem[];
  confidence_level: number;
  methodology: string;
  historical_average?: number;
  historical_trend?: number;
}

export interface TopProduct {
  product_id: string;
  product_name: string;
  product_code: string;
  total_sold: number;
  total_revenue: number;
  profit: number;
  margin_rate: number;
}

export interface TopSeller {
  user_id: string;
  user_name: string;
  total_revenue: number;
  sale_count: number;
  average_basket: number;
}

export interface TopCategory {
  category: string;
  total_sold: number;
  total_revenue: number;
  percentage: number;
}

export interface TopPeriod {
  period: string;
  profit: number;
  revenue: number;
}

export interface BestPerformers {
  top_products: TopProduct[];
  top_sellers: TopSeller[];
  top_categories: TopCategory[];
  top_periods: TopPeriod[];
}

export interface HistoryItem {
  period: string;
  period_label: string;
  revenue: number;
  profit: number;
  sale_count: number;
  margin_rate: number;
}

export interface ProfitHistory {
  history: HistoryItem[];
  total_profit: number;
  total_revenue: number;
  average_profit: number;
  periods_count: number;
  start_date: string;
  end_date: string;
  group_by: string;
}

export interface ProfitabilityRatios {
  gross_margin: number;
  gross_margin_rate: number;
  net_margin_rate: number;
  roi: number;
}

export interface CostStructure {
  cost_of_goods_sold: number;
  cost_percentage: number;
  operating_expenses: number;
  taxes: number;
  net_profit: number;
}

export interface MarginAnalysis {
  average_product_margin: number;
  high_margin_products: number;
  low_margin_products: number;
  margin_distribution: Record<string, number>;
}

export interface PerformanceIndicators {
  revenue_per_sale: number;
  profit_per_sale: number;
  sales_per_day: number;
  conversion_rate: number;
}

export interface TopProductAnalysis {
  name: string;
  quantity: number;
  revenue: number;
}

export interface FinancialAnalysis {
  profitability_ratios: ProfitabilityRatios;
  cost_structure: CostStructure;
  margin_analysis: MarginAnalysis;
  performance_indicators: PerformanceIndicators;
  recommendations: string[];
  payment_methods_breakdown?: Record<string, number>;
  top_products?: TopProductAnalysis[];
}