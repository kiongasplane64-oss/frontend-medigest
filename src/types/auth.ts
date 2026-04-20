export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  plan_expires_at?: string | null; 
  plan_name?: string | null;
  has_subscription?: boolean;  // À ajouter
  subscription_status?: string; // À ajouter
  subscription_end_date?: string; // À ajouter
}

export interface SuperAdminLoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  access_type: string;
  user: {
    id: string;
    email: string;
    nom_complet: string;
    role: string;
    is_newly_created?: boolean;
  };
  temp_password?: string;
  message?: string;
}

// Types unifiés pour toute l'application
export interface UserResponse {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id?: string | null;
  actif: boolean;
  activated?: boolean;
  phone?: string;
  telephone?: string;
  has_subscription?: boolean;
  subscription_status?: string;
  subscription_end_date?: string;
  permissions?: Record<string, boolean>;
}

export interface NormalizedUser {
  id: string;
  email: string;
  role: string;
  nom_complet: string;
  tenant_id: string | null;
  actif: boolean;
  telephone: string;
  phone: string;
  permissions: Record<string, boolean>;
  has_subscription: boolean;
  subscription_status: string;
  subscription_end_date?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: UserResponse;
}

export interface SetupResponse {
  message: string;
  credentials?: {
    email: string;
    password: string;
  };
}

// Fonction utilitaire de normalisation
export const normalizeUser = (userData: UserResponse): NormalizedUser => ({
  id: userData.id,
  email: userData.email,
  role: userData.role,
  nom_complet: userData.nom_complet,
  tenant_id: userData.tenant_id ?? null,
  actif: userData.actif ?? userData.activated ?? true,
  telephone: userData.telephone || userData.phone || '',
  phone: userData.phone || userData.telephone || '',
  permissions: userData.permissions ?? {},
  has_subscription: userData.has_subscription ?? false,
  subscription_status: userData.subscription_status || 'none',
  subscription_end_date: userData.subscription_end_date,
});