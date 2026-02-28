import api from '@/api/client';

export type PaymentProvider = 'stripe' | 'serdipay' | 'orange_money';

export interface CheckoutSession {
  checkout_url: string; // L'URL vers laquelle rediriger l'utilisateur
  session_id: string;
}

export const createCheckoutSession = async (
  planName: string, 
  billingCycle: 'monthly' | 'yearly',
  provider: PaymentProvider
): Promise<CheckoutSession> => {
  const { data } = await api.post('/v1/payments/create-session', {
    plan_name: planName,
    cycle: billingCycle,
    provider: provider
  });
  return data;
};