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

type VerifySmsResponse = {
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
};

type ResendSmsResponse = {
  message: string;
  sms_sent: boolean;
  expires_in: number;
};

export const authService = {
  /**
   * Inscription d'un nouveau tenant (officine)
   */
  register: async (data: RegisterData) => {
    const response = await api.post('/auth/tenants/register', {
      ...data,
      email: data.email.toLowerCase(),
    });
    return response.data;
  },

  /**
   * Vérification de disponibilité (email, nom, téléphone)
   */
  checkAvailability: async (params: { email?: string; pharmacy_name?: string; phone?: string }) => {
    const response = await api.post('/auth/tenants/check-availability', params);
    return response.data;
  },

  /**
   * ✅ Vérification OTP (flow Facebook/WhatsApp)
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
   * ✅ Renvoi OTP
   * Backend attendu: POST /auth/resend-sms
   * Body: { email }
   *
   * Note: Le backend actuel ne gère pas encore method (sms/whatsapp/email).
   * On le garde optionnel pour l'UI mais on ne l'envoie pas.
   */
  resendSms: async (email: string, _method: 'sms' | 'whatsapp' | 'email' = 'sms'): Promise<ResendSmsResponse> => {
    const response = await api.post('/auth/resend-sms', {
      email: email.toLowerCase(),
    });
    return response.data;
  },
};