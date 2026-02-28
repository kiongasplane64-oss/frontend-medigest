export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  plan_expires_at?: string | null; 
  plan_name?: string | null;
}