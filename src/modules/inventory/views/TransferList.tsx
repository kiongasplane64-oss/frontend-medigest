import { useState } from 'react';
import { 
  ArrowLeftRight, Plus, Search, Filter, 
  ChevronRight, Clock, CheckCircle2, Truck, RefreshCw, AlertCircle 
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inventoryService } from '@/services/inventoryService';
import type { Transfers, PricingUpdate } from '@/types/inventory.types';
import ReceiveTransferModal from '@/components/ReceiveTransferModal'; 
import toast, { Toaster } from 'react-hot-toast';
import api from '@/api/client';

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border-amber-100",
  shipped: "bg-blue-50 text-blue-600 border-blue-100",
  received: "bg-green-50 text-green-600 border-green-100",
  cancelled: "bg-red-50 text-red-600 border-red-100",
};

export default function TransferList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState<Transfers | null>(null);

  // 1. Récupération des données
  const { data: transfers = [], isLoading, isError, refetch } = useQuery<Transfers[]>({
    queryKey: ['transfers'],
    queryFn: () => inventoryService.getTransfers()
  });

  // 2. Mutation pour la réception
  const { mutate: confirmReceipt, isPending: isReceiving } = useMutation({
    mutationFn: (data: PricingUpdate[]) => api.post(`/transfers/${selectedTransfer?.id}/receive`, data),
    onMutate: () => {
      toast.loading('Mise à jour de l\'inventaire...', { id: 'receive-loader' });
    },
    onSuccess: () => {
      refetch();
      setSelectedTransfer(null);
      toast.success('Stock réceptionné avec succès !', { 
        id: 'receive-loader',
        icon: '✅',
        style: { borderRadius: '16px', background: '#333', color: '#fff' } 
      });
    },
    onError: (error: any) => {
      const errorMsg = error.response?.data?.detail || "Erreur de communication avec le serveur.";
      toast.error(errorMsg, { id: 'receive-loader' });
    }
  });

  // 3. Filtrage sécurisé
  const filteredTransfers = transfers.filter((transfer: Transfers) => 
    transfer.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.source_depot.toLowerCase().includes(searchTerm.toLowerCase()) ||
    transfer.destination_depot.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 gap-4">
        <RefreshCw className="animate-spin" size={40} />
        <p className="font-black tracking-widest uppercase text-[10px]">Chargement des flux de stock...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-red-500 gap-4 text-center">
        <AlertCircle size={48} className="opacity-20" />
        <div>
          <p className="font-black uppercase text-xs">Erreur de synchronisation</p>
          <button onClick={() => refetch()} className="mt-4 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] hover:bg-blue-600 transition-all shadow-xl">
            RÉESSAYER LE CHARGEMENT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Flux de Stocks</h1>
          <p className="text-slate-500 font-medium">Gestion des mouvements inter-sites et arrivages.</p>
        </div>
        <button className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-xs shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase">
          <Plus size={18} /> Nouveau Transfert
        </button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'À Recevoir', key: 'pending', icon: <Clock />, color: 'amber' },
          { label: 'En Transit', key: 'shipped', icon: <Truck />, color: 'blue' },
          { label: 'Terminés', key: 'received', icon: <CheckCircle2 />, color: 'green' }
        ].map((stat) => (
          <div key={stat.key} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-5 group hover:border-blue-200 transition-all">
            <div className={`w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
              {stat.icon}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{stat.label}</p>
              <p className="text-2xl font-black text-slate-800">
                {transfers.filter((t: Transfers) => t.status === stat.key).length.toString().padStart(2, '0')}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* TABLEAU DES TRANSFERTS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between bg-slate-50/30">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              type="text" 
              placeholder="Rechercher une référence ou un site..." 
              className="w-full pl-12 pr-4 py-3.5 bg-white border-none ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium transition-all shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="flex items-center justify-center gap-2 px-6 py-3 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-100">
            <Filter size={18} /> Filtres Avancés
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <th className="px-8 py-5">Référence</th>
                <th className="px-8 py-5">Mouvement</th>
                <th className="px-8 py-5 text-center">Volume</th>
                <th className="px-8 py-5">Statut</th>
                <th className="px-8 py-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTransfers.map((transfer: Transfers) => (
                <tr key={transfer.id} className="hover:bg-blue-50/20 transition-colors group">
                  <td className="px-8 py-6">
                    <p className="text-sm font-black text-slate-700">{transfer.reference}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{new Date(transfer.date_transfert).toLocaleDateString('fr-FR')}</p>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{transfer.source_depot}</span>
                      <ArrowLeftRight size={12} className="text-blue-400" />
                      <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">{transfer.destination_depot}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-md">{transfer.items_count}</span>
                  </td>
                  <td className="px-8 py-6">
                    <span className={`text-[9px] font-black uppercase px-2.5 py-1.5 rounded-xl border-2 ${statusStyles[transfer.status] || ""}`}>
                      {transfer.status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    {transfer.status === 'pending' || transfer.status === 'shipped' ? (
                      <button 
                        onClick={() => setSelectedTransfer(transfer)}
                        className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black hover:bg-blue-600 transition-all shadow-lg shadow-slate-200 active:scale-95"
                      >
                        RÉCEPTIONNER
                      </button>
                    ) : (
                      <button className="p-3 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                        <ChevronRight size={22} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE RÉCEPTION */}
      {selectedTransfer && (
        <ReceiveTransferModal 
          transfer={selectedTransfer}
          onClose={() => !isReceiving && setSelectedTransfer(null)}
          onConfirm={(data) => confirmReceipt(data)}
        />
      )}
    </div>
  );
}