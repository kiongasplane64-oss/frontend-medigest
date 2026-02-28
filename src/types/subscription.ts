export type SubscriptionPlan = 'starter' | 'professional' | 'enterprise';

export const PLAN_LIMITS = {
  starter: { pharmacies: 1, users: 3 },
  professional: { pharmacies: 2, users: 5 },
  enterprise: { pharmacies: 10, users: 999 },
};