import { useQuery } from '@tanstack/react-query';
import { getSuppliers } from '@/services/supplierService';
import { Truck, Phone, Mail, MapPin, MoreVertical } from 'lucide-react';

export default function Suppliers() {
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: getSuppliers
  });

  if (isLoading) return <div className="p-10 text-center">Chargement des fournisseurs...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Fournisseurs & Grossistes</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm">
          + Nouveau Fournisseur
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {suppliers?.map((supplier) => (
          <div key={supplier.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                <Truck size={24} />
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical size={20} />
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-slate-800">{supplier.name}</h3>
            <p className="text-xs text-slate-400 font-bold uppercase mb-4">{supplier.contact_person}</p>

            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone size={16} className="text-slate-400" />
                <span>{supplier.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail size={16} className="text-slate-400" />
                <span className="truncate">{supplier.email}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <MapPin size={16} className="text-slate-400" />
                <span className="truncate">{supplier.address}</span>
              </div>
            </div>

            <button className="w-full mt-6 py-2 border border-slate-100 rounded-xl text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors">
              Historique des achats
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}