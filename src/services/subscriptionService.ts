import api from '@/api/client';

export interface Subscription {
  plan_name: string;      // ex: 'Premium', 'Basic'
  status: string;         // ex: 'active', 'expired'
  start_date: string;
  end_date: string;
  max_products: number | "Illimité";  // ← Changé pour support "Illimité"
  current_usage: number;  // Nombre de produits actuels
  price: number;
  currency?: string;
  billing_cycle?: string;
}

export interface SubscriptionUsage {
  current_products: number;
  max_products: number | "Illimité";    // ← Changé pour support "Illimité"
  usage_percentage: number;
  remaining_products: number | "Illimité";  // ← Changé pour support "Illimité"
  current_users: number;
  max_users: number | "Illimité";
  users_usage_percentage: number;
  remaining_users: number | "Illimité";  // ← Changé pour support "Illimité"
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
  max_users: number | "Illimité";
  max_products: number | "Illimité";
  billing_cycle: 'monthly' | 'yearly';
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

export const getSubscription = async (): Promise<Subscription> => {
  const { data } = await api.get('/subscriptions/status');
  return data;
};

export const getSubscriptionUsage = async (): Promise<SubscriptionUsage> => {
  const { data } = await api.get('/subscriptions/usage');
  return data;
};

export const getAvailablePlans = async (): Promise<Plan[]> => {
  const { data } = await api.get('/subscriptions/plans');
  return data;
};

export const updateSubscription = async (planData: Plan) => {
  // Préparer les données selon l'API backend
  const payload = {
    plan_name: planData.name,
    plan_type: planData.type,
    price: planData.price,
    max_users: planData.max_users === "Illimité" ? 999 : planData.max_users,
    max_products: planData.max_products === "Illimité" ? 999999 : planData.max_products,
    billing_cycle: planData.billing_cycle,
    is_active: true
  };

  const { data } = await api.put('/subscriptions/', payload);
  return data;
};

export const cancelSubscription = async (): Promise<void> => {
  await api.delete('/subscriptions/');
};

export const getBillingHistory = async (): Promise<BillingHistory[]> => {
  const { data } = await api.get('/subscriptions/billing-history');
  return data;
};

export const getNextBillingDate = async (): Promise<{ next_billing_date: string }> => {
  const { data } = await api.get('/subscriptions/next-billing');
  return data;
};

// Fonctions utilitaires pour traiter les valeurs "Illimité"
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

// Fonction pour obtenir la limite réelle (nombre ou une valeur très grande pour "Illimité")
export const getEffectiveLimit = (value: number | "Illimité", unlimitedValue: number = 999999): number => {
  return value === "Illimité" ? unlimitedValue : value;
};

// Ajouter cette fonction dans subscriptionService.ts
export const createSubscriptionPayment = async (paymentData: {
  plan: string;
  billing_period: string;
  payment_method: string;
  amount: number;
  reference?: string;
}): Promise<any> => {
  const token = localStorage.getItem('token');
  
  const response = await api.post('/subscriptions/payment', paymentData, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  
  return response.data;
};

// Modifier updateSubscription pour inclure la redirection
export const updateSubscriptionWithPayment = async (plan: Plan): Promise<{ redirect: boolean, plan: Plan }> => {
  // Si le plan est payant, indiquer qu'une redirection est nécessaire
  if (plan.price > 0) {
    return { redirect: true, plan };
  }
  
  // Si gratuit, procéder normalement
  return await updateSubscription(plan);
};