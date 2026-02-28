import api from '@/api/client';

export interface AuditLog {
  id: string;
  user_name: string;
  action: string;      // ex: "DELETE_SALE", "UPDATE_STOCK", "LOGIN"
  module: string;      // ex: "SALES", "INVENTORY", "AUTH"
  details: string;     // ex: "Annulation de la vente #452"
  timestamp: string;
  ip_address: string;
}

export const getAuditLogs = async (): Promise<AuditLog[]> => {
  const { data } = await api.get('/v1/audit-logs');
  return data;
};