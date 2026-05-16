export interface ReturnItemCreate {
  product_id: string;
  quantity: number;
  reason?: string;
  condition?: 'new' | 'opened' | 'damaged' | 'expired';
  sale_item_id?: string;
  unit_price?: number;
  discount_percent?: number;
}

export interface ReturnCreate {
  return_type: 'customer' | 'supplier' | 'internal';
  reason: string;
  sale_id?: string;
  invoice_number?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  branch_id?: string;
  items: ReturnItemCreate[];
  restocking_fee_percent?: number;
  notes?: string;
}