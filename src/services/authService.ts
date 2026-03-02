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

export const authService = {
  /**
   * Inscription d'un nouveau tenant (officine)
   */
  register: async (data: RegisterData) => {
    const response = await api.post('/auth/tenants/register', data);
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
   * Vérification du code OTP (SMS/WhatsApp/Email)
   * Note : Le backend attend 'verification_code' selon votre implémentation précédente
   */
  verifySms: async (email: string, code: string) => {
    const response = await api.post('/auth/login-with-code', { 
      email: email.toLowerCase(), 
      verification_code: code 
    });
    return response.data;
  },

  /**
   * Renvoi du code de vérification via un canal spécifique
   * @param method 'sms' | 'whatsapp' | 'email'
   */
  resendSms: async (email: string, method: string = 'sms') => {
    const response = await api.post('/auth/resend-sms', { 
      email: email.toLowerCase(), 
      method: method // 'sms', 'whatsapp' ou 'email'
    });
    return response.data;
  }
};