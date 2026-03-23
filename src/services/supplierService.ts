import api from '@/api/client';

export interface Supplier {
  id: string;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
}

export const getSuppliers = async (): Promise<Supplier[]> => {
  const { data } = await api.get('/suppliers'); // Adaptez selon votre route exacte
  return data;
};