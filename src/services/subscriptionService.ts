import api from '@/api/client';

export interface Subscription {
  id?: string;
  plan_name: string;
  plan_type?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  price: number;
  currency?: string;
  billing_cycle?: string;
  auto_renew?: boolean;
  days_remaining?: number;
  is_trial?: boolean;
  trial_end_date?: string;
}

export interface SubscriptionUsage {
  current_products: number;
  max_products: number | "Illimité";
  usage_percentage: number;
  remaining_products: number | "Illimité";
  current_users: number;
  max_users: number | "Illimité";
  users_usage_percentage: number;
  remaining_users: number | "Illimité";
  current_pharmacies?: number;
  max_pharmacies?: number | "Illimité";
  pharmacies_usage_percentage?: number;
  remaining_pharmacies?: number | "Illimité";
  subscription?: {
    plan_name: string;
    plan_type: string;
    status: string;
    price: number;
    currency: string;
    billing_cycle: string;
    current_period_start?: string;
    current_period_end?: string;
  };
}

export interface Plan {
  id: string;
  name: string;
  type: string;
  price: number;
  price_monthly?: number;
  price_yearly?: number;
  max_users: number | "Illimité";
  max_products: number | "Illimité";
  max_pharmacies?: number | "Illimité";
  billing_cycle?: 'monthly' | 'yearly';
  features: string[];
  is_popular?: boolean;
  description?: string;
}

export interface BillingHistory {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  invoice_url?: string;
}

export interface PaymentData {
  plan: string;
  billing_period: string;
  payment_method: string;
  amount: number;
  reference?: string;
}

export interface PaymentResponse {
  success: boolean;
  subscription_id?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  paid_at?: string;
  type?: string;
  redirect_url?: string;
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

export const getSubscription = async (): Promise<Subscription> => {
  try {
    const { data } = await api.get('/subscriptions/status');
    
    if (data.subscription) {
      return data.subscription;
    }
    
    if (data.plan_name || data.status) {
      return data;
    }
    
    console.warn('Structure de réponse inattendue pour getSubscription:', data);
    return {
      plan_name: 'Gratuit',
      status: 'inactive',
      price: 0,
      currency: 'EUR'
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'abonnement:', error);
    throw error;
  }
};

export const getSubscriptionUsage = async (): Promise<SubscriptionUsage> => {
  try {
    const { data } = await api.get('/subscriptions/usage');
    
    if (data.usage) {
      return data.usage;
    }
    
    if (typeof data.current_products !== 'undefined') {
      return data;
    }
    
    console.warn('Structure de réponse inattendue pour getSubscriptionUsage:', data);
    return {
      current_products: 0,
      max_products: 100,
      usage_percentage: 0,
      remaining_products: 100,
      current_users: 1,
      max_users: 1,
      users_usage_percentage: 0,
      remaining_users: 0
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisation:', error);
    throw error;
  }
};

export const getAvailablePlans = async (): Promise<Plan[]> => {
  try {
    const { data } = await api.get('/subscriptions/plans');
    
    if (data && data.plans && Array.isArray(data.plans)) {
      return data.plans.map((plan: any) => ({
        id: plan.id || plan.type,
        name: plan.name,
        type: plan.type || plan.id,
        price: plan.price_monthly || plan.price || 0,
        price_monthly: plan.price_monthly || plan.price || 0,
        price_yearly: plan.price_yearly || 0,
        max_users: plan.max_users || 1,
        max_products: plan.max_products || 100,
        max_pharmacies: plan.max_pharmacies || 1,
        billing_cycle: 'monthly',
        features: Array.isArray(plan.features) ? plan.features : [],
        is_popular: plan.is_popular || false,
        description: plan.description || `Plan ${plan.name}`
      }));
    }
    
    if (Array.isArray(data)) {
      return data.map((plan: any) => ({
        id: plan.id || plan.type,
        name: plan.name,
        type: plan.type || plan.id,
        price: plan.price_monthly || plan.price || 0,
        price_monthly: plan.price_monthly || plan.price || 0,
        price_yearly: plan.price_yearly || 0,
        max_users: plan.max_users || 1,
        max_products: plan.max_products || 100,
        max_pharmacies: plan.max_pharmacies || 1,
        billing_cycle: 'monthly',
        features: Array.isArray(plan.features) ? plan.features : [],
        is_popular: plan.is_popular || false,
        description: plan.description || `Plan ${plan.name}`
      }));
    }
    
    console.warn('getAvailablePlans: Format de réponse inattendu', data);
    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération des plans:', error);
    return [];
  }
};

export const updateSubscription = async (payload: { plan: string; billing_cycle: string }) => {
  try {
    console.log('🔄 Envoi de la requête PUT /subscriptions/ avec payload:', payload);
    
    const { data } = await api.put('/subscriptions/', payload);
    
    return data.subscription || data;
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à jour de l\'abonnement:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || error.response?.data?.detail
      || error.message
      || 'Erreur lors de la mise à jour';
    
    throw new Error(errorMessage);
  }
};

// ============================================================================
// FONCTIONS DE PAIEMENT (AJOUTÉES)
// ============================================================================

/**
 * Crée un paiement d'abonnement
 */
export const createSubscriptionPayment = async (paymentData: PaymentData): Promise<PaymentResponse> => {
  try {
    console.log('💳 Création de paiement:', paymentData);
    
    const response = await api.post('/subscriptions/payment', paymentData);
    
    return response.data;
  } catch (error: any) {
    console.error('❌ Erreur lors de la création du paiement:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || error.response?.data?.detail
      || error.message
      || 'Erreur lors de la création du paiement';
    
    throw new Error(errorMessage);
  }
};

/**
 * Valide un code d'activation (paiement cash)
 */
export const validateActivationCode = async (code: string): Promise<any> => {
  try {
    const { data } = await api.get(`/subscription-codes/validate?code=${code}`);
    return data;
  } catch (error: any) {
    console.error('Erreur de validation du code:', error);
    throw error;
  }
};

/**
 * Active un abonnement avec un code
 */
export const activateWithCode = async (code: string): Promise<any> => {
  try {
    const { data } = await api.post('/subscription-codes/activate', { code });
    return data;
  } catch (error: any) {
    console.error('Erreur d\'activation avec code:', error);
    throw error;
  }
};

// ============================================================================
// FONCTIONS DE FACTURATION
// ============================================================================

export const cancelSubscription = async (): Promise<void> => {
  try {
    await api.delete('/subscriptions/');
  } catch (error) {
    console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
    throw error;
  }
};

export const getBillingHistory = async (): Promise<BillingHistory[]> => {
  try {
    const { data } = await api.get('/subscriptions/billing-history');
    
    if (Array.isArray(data)) {
      return data;
    } else if (data && Array.isArray(data.history)) {
      return data.history;
    } else if (data && Array.isArray(data.data)) {
      return data.data;
    }
    
    return [];
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    return [];
  }
};

export const getNextBillingDate = async (): Promise<{ next_billing_date: string }> => {
  try {
    const { data } = await api.get('/subscriptions/next-billing');
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération de la prochaine facturation:', error);
    throw error;
  }
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

export const formatMaxDisplay = (value: number | "Illimité"): string => {
  return value === "Illimité" ? "∞" : value.toString();
};

export const formatRemainingText = (value: number | "Illimité", singular: string, plural: string): string => {
  if (value === "Illimité") {
    return "Illimité";
  }
  return `${value} ${value !== 1 ? plural : singular} restant${value !== 1 ? 's' : ''}`;
};

export const isUnlimited = (value: number | "Illimité"): boolean => {
  return value === "Illimité";
};

export const getEffectiveLimit = (value: number | "Illimité", unlimitedValue: number = 999999): number => {
  return value === "Illimité" ? unlimitedValue : value;
};

export const updateSubscriptionWithPayment = async (plan: Plan): Promise<{ redirect: boolean, plan: Plan }> => {
  try {
    if (plan.price > 0) {
      return { redirect: true, plan };
    }
    
    const payload = {
      plan: plan.type || plan.id,
      billing_cycle: plan.billing_cycle || 'monthly'
    };
    
    const result = await updateSubscription(payload);
    return { redirect: false, plan: result };
  } catch (error) {
    console.error('Erreur lors de la mise à jour avec paiement:', error);
    throw error;
  }
};

export const isValidPlansArray = (data: any): data is Plan[] => {
  return Array.isArray(data) && data.every(item => 
    item && typeof item === 'object' && 'id' in item && 'name' in item
  );
};