export type AlertType = 'EXPIRED' | 'NEAR_EXPIRY' | 'STOCK_OUT' | 'LOW_STOCK';

export interface PharmacyAlert {
  id: string;
  type: AlertType;
  productName: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  date: Date;
}