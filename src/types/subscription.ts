// types/subscription.ts - CORRECTION
export type SubscriptionPlanType = 'starter' | 'professional' | 'enterprise' | 'trial';

export interface PlanLimits {
  pharmacies: number;
  users: number;
  products?: number;
  storage?: number;
  support?: 'basic' | 'priority' | 'dedicated';
}

export const PLAN_LIMITS: Record<SubscriptionPlanType, PlanLimits> = {
  starter: { pharmacies: 1, users: 3, products: 100, storage: 1, support: 'basic' },
  professional: { pharmacies: 2, users: 5, products: 500, storage: 5, support: 'priority' },
  enterprise: { pharmacies: 10, users: 999, products: 9999, storage: 50, support: 'dedicated' },
  trial: { pharmacies: 1, users: 3, products: 50, storage: 0.5, support: 'basic' },
};

// Fonctions utilitaires
export const getPlanLimits = (planType: string): PlanLimits => {
  return PLAN_LIMITS[planType as SubscriptionPlanType] || PLAN_LIMITS.starter;
};

export const isLimitUnlimited = (limit: number): boolean => {
  return limit === 999 || limit === 9999 || limit === 999999;
};

export const formatLimit = (limit: number): string | number => {
  return isLimitUnlimited(limit) ? 'Illimité' : limit;
};