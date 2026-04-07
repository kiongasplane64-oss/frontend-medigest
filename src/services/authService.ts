import api from '@/api/client';

export interface RegisterData {
  email: string;
  password: string;
  confirm_password: string;
  nom_complet: string;
  nom_pharmacie: string;
  ville: string;
  telephone: string;
  type_pharmacie: string;
  plan: string;
  plan_name: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface ResetRequestData {
  email: string;
}

export interface ResetConfirmData {
  email: string;
  code: string;
  new_password: string;
}

export interface RefreshTokenData {
  refresh_token: string;
}

export interface ChangePlanData {
  new_plan: string;
  plan_name?: string;
  billing_period?: string;
}

export interface CreateSubscriptionPaymentData {
  plan: string;
  billing_period: string;
  payment_method: string;
  amount: number;
  reference?: string;
}

export interface SuperAdminSetupData {
  email: string;
  password: string;
  nom_complet: string;
  setup_key: string;
}

// Types de réponse
export interface TokenPairResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
}

export interface UserResponse {
  id: string;
  email: string;
  nom_complet: string;
  role: string;
  tenant_id?: string | null;
  actif: boolean;
  telephone?: string;
}

export interface TenantResponse {
  id: string;
  tenant_code: string;
  slug?: string;
  nom_pharmacie: string;
  nom_commercial?: string;
  ville: string;
  pays: string;
  email_admin: string;
  nom_proprietaire?: string;
  telephone_principal?: string;
  telephone_secondaire?: string;
  type_pharmacie?: string;
  status: string;
  current_plan: string;
  plan_name?: string;
  max_users: number;
  max_products: number;
  max_pharmacies: number;
  active_pharmacies?: number;
  trial_start_date?: string | null;
  trial_end_date?: string | null;
  activated_at?: string | null;
  created_at?: string;
  updated_at?: string;
  config?: Record<string, any>;
}

export interface PharmacyResponse {
  id: string;
  name: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  is_main: boolean;
  pharmacy_code?: string;
  created_at?: string;
}

export interface LoginResponse extends TokenPairResponse {
  subscription_active: boolean;
  is_first_login: boolean;
  user: UserResponse;
  tenant: TenantResponse | null;
  pharmacies: PharmacyResponse[];
  current_pharmacy?: PharmacyResponse;
}

export interface RegisterResponse {
  status: string;
  message: string;
  data: {
    tenant_id: string;
    user_id: string;
    tenant_code: string;
    pharmacy_id: string;
    plan: string;
    plan_name: string;
    trial_end_date: string;
    trial_days: number;
    subscription: {
      id: string;
      status: string;
      days_remaining: number;
      is_trial: boolean;
      mode: string;
    };
    limits: {
      max_users: number;
      max_products: number;
      max_pharmacies: number;
    };
    created_at: string;
  };
  next_steps: {
    login: {
      message: string;
      action: string;
      required_data: {
        email: string;
        password: string;
      };
    };
    welcome_sms: {
      message: string;
      note: string;
    };
    trial_info: string;
    dashboard_access: string;
  };
  recommendations: string[];
}

export interface VerifySmsResponse {
  message?: string;
  access_token: string;
  token_type?: string;
  user?: {
    id: string;
    email: string;
    nom_complet?: string;
    role?: string;
    activated?: boolean;
    actif?: boolean;
    tenant_id?: string;
  };
  tenant?: any;
  pharmacy?: any;
}

export interface ResendSmsResponse {
  message: string;
  sms_sent: boolean;
  expires_in: number;
}

export interface CheckAvailabilityResponse {
  available: boolean;
  checks: Array<{
    field: string;
    available: boolean;
    message: string;
  }>;
  suggestions: Array<{
    field: string;
    message: string;
    alternatives?: string[];
  }>;
}

export interface CheckPhoneExistsResponse {
  exists: boolean;
  is_active?: boolean;
  email_hint?: string | null;
  message?: string;
  suggestions?: string[];
}

export interface SubscriptionStatusResponse {
  tenant_id: string;
  tenant_code: string;
  tenant_status: string;
  current_plan: string;
  plan_name: string;
  subscription_active: boolean;
  trial_end_date: string | null;
  days_remaining: number | null;
  is_expired: boolean;
  is_near_expiry: boolean;
  limits: {
    max_users: number;
    max_products: number;
    max_pharmacies: number;
  };
  last_payment: {
    id: string | null;
    amount: number | null;
    payment_method: string | null;
    paid_at: string | null;
  } | null;
}

export interface CurrentSessionResponse {
  sessionId: string;
  sessionNumber: string;
  posId: string;
  posName: string;
  pharmacyId: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  startedAt: string;
  status: string;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  service: string;
  version: string;
  endpoints_available: string[];
}

export interface ApiStatusResponse {
  status: string;
  timestamp: string;
  apis: {
    auth: {
      status: string;
      version: string;
      endpoints: number;
    };
    health: {
      status: string;
      endpoint: string;
    };
  };
}

export const authService = {
  /**
   * Inscription d'un nouveau tenant (officine)
   */
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    const response = await api.post('/auth/tenants/register', {
      ...data,
      email: data.email.toLowerCase(),
    });
    return response.data;
  },

  /**
   * Connexion utilisateur
   */
  login: async (data: LoginData): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', {
      email: data.email.toLowerCase(),
      password: data.password,
    });
    return response.data;
  },

  /**
   * Rafraîchissement du token d'accès
   */
  refreshToken: async (refreshToken: string): Promise<TokenPairResponse> => {
    const response = await api.post('/auth/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  /**
   * Vérification de disponibilité (email, nom, téléphone)
   */
  checkAvailability: async (params: {
      email?: string;
      pharmacy_name?: string;
      phone?: string;
    }): Promise<CheckAvailabilityResponse> => {
      // Utiliser POST avec body comme l'API l'attend
      const response = await api.post('/auth/tenants/check-availability', params);
      return response.data;
    },

  /**
   * Vérifie si un numéro de téléphone existe déjà
   */
  checkPhoneExists: async (phone: string): Promise<CheckPhoneExistsResponse> => {
      // L'API attend un body, pas des query params
      const response = await api.post('/auth/check-phone-exists', { phone });
      return response.data;
    },

  /**
   * Demande de réinitialisation de mot de passe (envoi d'un code par SMS)
   */
  requestPasswordReset: async (email: string): Promise<{ message: string; sms_sent: boolean }> => {
    const response = await api.post('/auth/password/reset/request', {
      email: email.toLowerCase(),
    });
    return response.data;
  },

  /**
   * Confirmation de réinitialisation de mot de passe
   */
  confirmPasswordReset: async (data: ResetConfirmData): Promise<{ message: string }> => {
    const response = await api.post('/auth/password/reset/confirm', {
      email: data.email.toLowerCase(),
      code: data.code,
      new_password: data.new_password,
    });
    return response.data;
  },

  /**
   * Vérification OTP (flow Facebook/WhatsApp)
   * Backend attendu: POST /auth/verify-sms
   * Body: { email, code }
   */
  verifySms: async (email: string, code: string): Promise<VerifySmsResponse> => {
    const response = await api.post('/auth/verify-sms', {
      email: email.toLowerCase(),
      code: code.trim(),
    });
    return response.data;
  },

  /**
   * Renvoi OTP
   * Backend attendu: POST /auth/resend-sms
   * Body: { email }
   */
  resendSms: async (
    email: string,
    _method: 'sms' | 'whatsapp' | 'email' = 'sms'
  ): Promise<ResendSmsResponse> => {
    const response = await api.post('/auth/resend-sms', {
      email: email.toLowerCase(),
    });
    return response.data;
  },

  /**
   * Récupère les informations de l'utilisateur connecté
   */
  getMe: async (): Promise<{
    user: UserResponse;
    tenant: TenantResponse | null;
    subscription_active: boolean;
    current_pharmacy: { id: string; name: string; pharmacy_code: string } | null;
  }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  /**
   * Récupère les informations du tenant de l'utilisateur connecté
   */
  getCurrentTenant: async (): Promise<{ tenant: TenantResponse; main_pharmacy?: PharmacyResponse }> => {
    const response = await api.get('/auth/tenants/me');
    return response.data;
  },

  /**
   * Récupère le statut de l'abonnement actuel
   */
  getSubscriptionStatus: async (): Promise<SubscriptionStatusResponse> => {
    const response = await api.get('/auth/subscription/status');
    return response.data;
  },

  /**
   * Crée un paiement pour un abonnement
   */
  createSubscriptionPayment: async (
    data: CreateSubscriptionPaymentData
  ): Promise<{
    message: string;
    payment: {
      id: string;
      amount: number;
      payment_method: string;
      status: string;
      reference: string | null;
      paid_at: string;
    };
    subscription: {
      plan: string;
      billing_period: string;
      period_start: string;
      period_end: string;
      tenant_status: string;
      limits: {
        max_users: number;
        max_products: number;
        max_pharmacies: number;
      };
    };
  }> => {
    const response = await api.post('/auth/subscription/payment', data);
    return response.data;
  },

  /**
   * Vérifie la clé d'accès super administrateur
   */
  verifySuperAdminKey: async (key: string): Promise<{ valid: boolean; access_type?: string; message?: string }> => {
    const response = await api.post('/auth/super-admin/verify-key', { key });
    return response.data;
  },

  /**
   * Crée le premier super administrateur (nécessite une clé d'installation)
   */
  setupSuperAdmin: async (data: SuperAdminSetupData): Promise<{
    message: string;
    credentials?: { email: string; password: string };
  }> => {
    const response = await api.post('/auth/super-admin/setup', {
      ...data,
      email: data.email.toLowerCase(),
    });
    return response.data;
  },

  /**
   * Récupère la session courante de l'utilisateur
   */
  getCurrentSession: async (): Promise<CurrentSessionResponse> => {
    const response = await api.get('/auth/current-session');
    return response.data;
  },

  /**
   * Test de session pour vérifier que l'authentification fonctionne
   */
  testSession: async (): Promise<{
    authenticated: boolean;
    user: {
      id: string;
      email: string;
      nom_complet: string;
      role: string;
    };
    tenant: {
      id: string | null;
      nom_pharmacie: string | null;
      tenant_code: string | null;
    };
    timestamp: string;
  }> => {
    const response = await api.get('/auth/session/test');
    return response.data;
  },

  /**
   * Health check
   */
  healthCheck: async (): Promise<HealthCheckResponse> => {
    const response = await api.get('/auth/health');
    return response.data;
  },

  /**
   * Statut des APIs
   */
  apiStatus: async (): Promise<ApiStatusResponse> => {
    const response = await api.get('/auth/api-status');
    return response.data;
  },
};