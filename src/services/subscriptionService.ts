// app/api/client.ts
// Ce fichier doit exister dans votre projet avec la configuration de l'API client
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

export interface BillingHistoryItem {
  id: string;
  date: string;
  amount: number;
  currency: string;
  status: string;
  type?: 'transaction' | 'invoice' | 'plan_change';
  invoice_url?: string;
  description?: string;
  transaction_type?: string;
  payment_method?: string;
}

export interface BillingHistoryResponse {
  success: boolean;
  user: {
    id: string;
    email: string;
    tenant_id?: string;
  };
  billing_history: BillingHistoryItem[];
  summary: {
    total_items: number;
    total_transactions: number;
    total_invoices: number;
    total_plan_changes: number;
    total_spent: number;
    last_payment: BillingHistoryItem | null;
    has_unpaid_invoices: boolean;
    unpaid_invoices_count: number;
  };
  pagination: {
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters_applied: {
    start_date?: string;
    end_date?: string;
  };
  timestamp: string;
}

export interface InvoiceDetails {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: string;
  pdf_url?: string;
  created_at?: string;
  due_date?: string;
  paid_at?: string;
  subscription_id: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  billing_address?: any;
  tax_amount: number;
  subtotal: number;
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

export interface SubscriptionStatus {
  subscription: Subscription;
  access: {
    mode: string;
    is_read_only: boolean;
    restrictions: any;
  };
  limits: {
    max_users: number | string;
    max_products: number | string;
    max_pharmacies: number | string;
    features: string[];
  };
  usage?: {
    current_users: number;
    current_products: number;
    current_pharmacies: number;
    users_percentage: number;
    products_percentage: number;
    pharmacies_percentage: number;
  };
  metadata: {
    checked_at: string;
    requires_upgrade: boolean;
    requires_subscription: boolean;
  };
}

// ============================================================================
// FONCTIONS PRINCIPALES
// ============================================================================

/**
 * Récupère les détails de l'abonnement actuel
 */
export const getSubscription = async (): Promise<Subscription> => {
  try {
    // Utiliser /status qui renvoie toutes les infos
    const { data } = await api.get('/subscriptions/status');
    
    // La réponse de /status contient subscription, access, etc.
    if (data.subscription) {
      return {
        id: data.subscription.id,
        plan_name: data.subscription.plan_name,
        plan_type: data.subscription.plan,
        status: data.subscription.status,
        start_date: data.subscription.start_date,
        end_date: data.subscription.end_date,
        price: data.subscription.price_monthly || data.subscription.price || 0,
        currency: data.subscription.currency || 'EUR',
        billing_cycle: data.subscription.billing_cycle || 'monthly',
        auto_renew: data.subscription.auto_renew,
        days_remaining: data.subscription.days_remaining,
        is_trial: data.subscription.is_trial,
        trial_end_date: data.subscription.trial_end_date,
      };
    }
    
    // Fallback: si la structure est directe
    if (data.plan_name || data.status) {
      return {
        plan_name: data.plan_name || 'Gratuit',
        plan_type: data.plan,
        status: data.status,
        start_date: data.start_date,
        end_date: data.end_date,
        price: data.price_monthly || data.price || 0,
        currency: data.currency || 'EUR',
        billing_cycle: data.billing_cycle || 'monthly',
        auto_renew: data.auto_renew,
        days_remaining: data.days_remaining,
        is_trial: data.is_trial,
        trial_end_date: data.trial_end_date,
      };
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

/**
 * Récupère les détails complets du statut d'abonnement
 */
export const getSubscriptionStatus = async (): Promise<SubscriptionStatus> => {
  try {
    const { data } = await api.get('/subscriptions/status');
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération du statut:', error);
    throw error;
  }
};

/**
 * Récupère les statistiques d'utilisation
 */
export const getSubscriptionUsage = async (): Promise<SubscriptionUsage> => {
  try {
    const { data } = await api.get('/subscriptions/usage');
    
    // La réponse de /usage contient usage, limits, percentages
    if (data.usage) {
      return {
        current_products: data.usage.products || data.usage.current_products || 0,
        max_products: data.limits?.products || data.usage.max_products || 100,
        usage_percentage: data.percentages?.products || data.usage.usage_percentage || 0,
        remaining_products: data.usage.remaining_products || 0,
        current_users: data.usage.users || data.usage.current_users || 1,
        max_users: data.limits?.users || data.usage.max_users || 1,
        users_usage_percentage: data.percentages?.users || data.usage.users_usage_percentage || 0,
        remaining_users: data.usage.remaining_users || 0,
        current_pharmacies: data.usage.pharmacies || data.usage.current_pharmacies || 0,
        max_pharmacies: data.limits?.pharmacies || data.usage.max_pharmacies || 1,
        pharmacies_usage_percentage: data.percentages?.pharmacies || data.usage.pharmacies_usage_percentage || 0,
        remaining_pharmacies: data.usage.remaining_pharmacies || 0,
        subscription: data.subscription
      };
    }
    
    // Fallback
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

/**
 * Récupère la liste des plans disponibles
 */
// subscriptionService.ts - CORRECTION
export const getAvailablePlans = async (includeTrial: boolean = false): Promise<Plan[]> => {
  try {
    const url = includeTrial ? '/subscriptions/plans?include_trial=true' : '/subscriptions/plans';
    const { data } = await api.get(url);
    
    // CORRECTION: La réponse de l'API est { plans: [...] }
    let plansArray: any[] = [];
    
    if (data && data.plans && Array.isArray(data.plans)) {
      // Format standard: { plans: [...] }
      plansArray = data.plans;
    } else if (Array.isArray(data)) {
      // Fallback: tableau direct
      plansArray = data;
    } else if (data && typeof data === 'object') {
      // Fallback: chercher un tableau dans la réponse
      plansArray = Object.values(data).find(Array.isArray) || [];
    }
    
    // Transformer les plans au format attendu
    return plansArray.map((plan: any) => ({
      id: plan.id || plan.type || plan.name?.toLowerCase(),
      name: plan.name,
      type: plan.type || plan.id || plan.name?.toLowerCase(),
      price: typeof plan.price_monthly === 'number' ? plan.price_monthly : (plan.price || 0),
      price_monthly: plan.price_monthly || plan.price || 0,
      price_yearly: plan.price_yearly || 0,
      max_users: plan.max_users === "Illimité" ? "Illimité" : (Number(plan.max_users) || 1),
      max_products: plan.max_products === "Illimité" ? "Illimité" : (Number(plan.max_products) || 100),
      max_pharmacies: plan.max_pharmacies === "Illimité" ? "Illimité" : (Number(plan.max_pharmacies) || 1),
      billing_cycle: 'monthly',
      features: Array.isArray(plan.features) ? plan.features : [],
      is_popular: plan.is_popular || plan.name === 'professional' || plan.name === 'Pro',
      description: plan.description || `Plan ${plan.name}`
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des plans:', error);
    return [];
  }
};

/**
 * Met à jour l'abonnement (upgrade/downgrade)
 */
export const updateSubscription = async (payload: { plan: string; billing_cycle: string }): Promise<any> => {
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

/**
 * Met à niveau l'abonnement (POST /upgrade)
 */
export const upgradeSubscription = async (payload: { plan: string; billing_cycle: string; payment_id?: string; payment_method?: string }): Promise<any> => {
  try {
    console.log('🔄 Envoi de la requête POST /subscriptions/upgrade avec payload:', payload);
    
    const { data } = await api.post('/subscriptions/upgrade', payload);
    
    return data;
  } catch (error: any) {
    console.error('❌ Erreur lors de la mise à niveau de l\'abonnement:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || error.response?.data?.detail
      || error.message
      || 'Erreur lors de la mise à niveau';
    
    throw new Error(errorMessage);
  }
};

// ============================================================================
// FONCTIONS DE PAIEMENT
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

/**
 * Annule l'abonnement
 */
export const cancelSubscription = async (): Promise<void> => {
  try {
    await api.delete('/subscriptions/');
  } catch (error) {
    console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
    throw error;
  }
};

/**
 * Récupère l'historique des factures
 */
export const getBillingHistory = async (
  limit: number = 50,
  offset: number = 0,
  startDate?: string,
  endDate?: string
): Promise<BillingHistoryResponse> => {
  try {
    const params: any = { limit, offset };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const { data } = await api.get('/subscriptions/billing-history', { params });
    
    return data;
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || 'Erreur lors de la récupération de l\'historique';
    
    throw new Error(errorMessage);
  }
};

/**
 * Récupère les détails d'une facture spécifique
 */
export const getInvoiceDetails = async (invoiceId: string): Promise<InvoiceDetails> => {
  try {
    const { data } = await api.get(`/subscriptions/billing-history/invoice/${invoiceId}`);
    
    if (data.success && data.invoice) {
      return data.invoice;
    }
    
    throw new Error('Format de réponse invalide');
  } catch (error: any) {
    console.error('Erreur lors de la récupération des détails de la facture:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || 'Erreur lors de la récupération des détails';
    
    throw new Error(errorMessage);
  }
};

/**
 * Exporte l'historique des factures
 */
export const exportBillingHistory = async (
  format: 'csv' | 'json' = 'csv',
  startDate?: string,
  endDate?: string
): Promise<any> => {
  try {
    const params: any = { format };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const { data } = await api.get('/subscriptions/billing-history/export', { params });
    
    return data;
  } catch (error: any) {
    console.error('Erreur lors de l\'export de l\'historique:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || 'Erreur lors de l\'export';
    
    throw new Error(errorMessage);
  }
};

/**
 * Récupère la prochaine date de facturation
 */
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
// FONCTIONS D'ACCÈS ET DE VÉRIFICATION
// ============================================================================

/**
 * Vérifie l'accès à une fonctionnalité
 */
export const checkFeatureAccess = async (feature: string): Promise<{
  feature: string;
  has_access: boolean;
  subscription_active: boolean;
  has_subscription: boolean;
  plan: string;
  mode: string;
  is_read_only: boolean;
  access_denied_reason?: string;
  requires_upgrade: boolean;
}> => {
  try {
    const { data } = await api.get(`/subscriptions/check-access/${feature}`);
    return data;
  } catch (error) {
    console.error('Erreur lors de la vérification d\'accès:', error);
    throw error;
  }
};

// ============================================================================
// FONCTIONS ADMIN (SUPER ADMIN)
// ============================================================================

/**
 * Récupère la vue d'ensemble des abonnements (admin only)
 */
export const getSubscriptionsOverview = async (tenantId?: string): Promise<any> => {
  try {
    const params = tenantId ? { tenant_id: tenantId } : {};
    const { data } = await api.get('/subscriptions/admin/overview', { params });
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération de la vue d\'ensemble:', error);
    throw error;
  }
};

/**
 * Active manuellement un abonnement (admin only)
 */
export const manualActivateSubscription = async (payload: {
  user_id: string;
  plan: string;
  billing_cycle: string;
  payment_id?: string;
  payment_method?: string;
  reference?: string;
}): Promise<any> => {
  try {
    const { data } = await api.post('/subscriptions/admin/manual-activation', payload);
    return data;
  } catch (error: any) {
    console.error('Erreur lors de l\'activation manuelle:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || 'Erreur lors de l\'activation manuelle';
    
    throw new Error(errorMessage);
  }
};

/**
 * Prolonge la période d'essai (admin only)
 */
export const extendTrialPeriod = async (userId: string, extraDays: number): Promise<any> => {
  try {
    const { data } = await api.post(`/subscriptions/admin/extend-trial/${userId}?extra_days=${extraDays}`);
    return data;
  } catch (error: any) {
    console.error('Erreur lors de la prolongation de l\'essai:', error);
    
    const errorMessage = error.response?.data?.detail?.message 
      || error.response?.data?.message 
      || 'Erreur lors de la prolongation';
    
    throw new Error(errorMessage);
  }
};

/**
 * Récupère les abonnements d'un tenant (admin only)
 */
export const getTenantSubscriptions = async (tenantId: string): Promise<any> => {
  try {
    const { data } = await api.get(`/subscriptions/admin/tenant/${tenantId}`);
    return data;
  } catch (error) {
    console.error('Erreur lors de la récupération des abonnements du tenant:', error);
    throw error;
  }
};

// ============================================================================
// FONCTIONS UTILITAIRES
// ============================================================================

/**
 * Formate l'affichage d'une valeur "Illimité"
 */
export const formatMaxDisplay = (value: number | "Illimité"): string => {
  return value === "Illimité" ? "∞" : value.toString();
};

/**
 * Formate le texte des ressources restantes
 */
export const formatRemainingText = (value: number | "Illimité", singular: string, plural: string): string => {
  if (value === "Illimité") {
    return "Illimité";
  }
  return `${value} ${value !== 1 ? plural : singular} restant${value !== 1 ? 's' : ''}`;
};

/**
 * Vérifie si une limite est illimitée
 */
export const isUnlimited = (value: number | "Illimité"): boolean => {
  return value === "Illimité";
};

/**
 * Obtient la valeur numérique effective d'une limite
 */
export const getEffectiveLimit = (value: number | "Illimité", unlimitedValue: number = 999999): number => {
  return value === "Illimité" ? unlimitedValue : value;
};

/**
 * Met à jour l'abonnement avec gestion du paiement
 */
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

/**
 * Valide qu'un objet est un tableau de plans
 */
export const isValidPlansArray = (data: any): data is Plan[] => {
  return Array.isArray(data) && data.every(item => 
    item && typeof item === 'object' && 'id' in item && 'name' in item
  );
};

/**
 * Calcule le pourcentage d'utilisation
 */
export const calculateUsagePercentage = (current: number, max: number | "Illimité"): number => {
  if (max === "Illimité" || max === 0) return 0;
  return Math.min(100, Math.round((current / (max as number)) * 100));
};

/**
 * Détermine la classe de couleur pour l'affichage du pourcentage
 */
export const getUsageColorClass = (percentage: number): string => {
  if (percentage >= 90) return 'text-red-600 bg-red-50';
  if (percentage >= 75) return 'text-orange-600 bg-orange-50';
  if (percentage >= 50) return 'text-yellow-600 bg-yellow-50';
  return 'text-green-600 bg-green-50';
};

/**
 * Formate un montant en devise
 */
export const formatAmount = (amount: number, currency: string = 'EUR'): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formate une date
 */
export const formatDate = (dateString?: string, format: 'short' | 'long' = 'short'): string => {
  if (!dateString) return '—';
  
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  
  if (format === 'short') {
    return date.toLocaleDateString('fr-FR');
  }
  
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Vérifie si un abonnement est expiré
 */
export const isSubscriptionExpired = (subscription: Subscription): boolean => {
  if (!subscription.end_date) return false;
  return new Date(subscription.end_date) < new Date();
};

/**
 * Récupère le statut de l'abonnement en français
 */
export const getSubscriptionStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    'active': 'Actif',
    'inactive': 'Inactif',
    'expired': 'Expiré',
    'cancelled': 'Annulé',
    'pending': 'En attente',
    'trial': 'Essai'
  };
  return statusMap[status.toLowerCase()] || status;
};