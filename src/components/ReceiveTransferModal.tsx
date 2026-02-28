import { useState } from 'react';
import { CheckCircle2, X, AlertTriangle, PackageCheck } from 'lucide-react';
import { Transfer } from '@/services/inventoryService';

// 1. Définition des interfaces pour corriger les erreurs de type "any" et "property not exist"
interface TransferItem {
  product_id: string;
  product_name: string;
  product_code: string;
  requested_quantity: number;
  unit_price: string | number;
}

interface LocalPricingItem {
  product_id: string;
  name: string;
  code: string;
  requested_qty: number;
  received_qty: number;
  purchase_price: number | string;
  sale_price: string;
}

interface ReceiveTransferModalProps {
  // On s'assure que transfer contient items (Intersection type si le type global Transfer est incomplet)
  transfer: Transfer & { items?: TransferItem[] };
  onClose: () => void;
  onConfirm: (pricingData: LocalPricingItem[]) => void;
}

export default function ReceiveTransferModal({ transfer, onClose, onConfirm }: ReceiveTransferModalProps) {
  // 2. Initialisation typée
  const [items, setItems] = useState<LocalPricingItem[]>(
    transfer.items?.map((item: TransferItem) => ({
      product_id: item.product_id,
      name: item.product_name,
      code: item.product_code,
      requested_qty: item.requested_quantity,
      received_qty: item.requested_quantity, 
      purchase_price: item.unit_price,
      sale_price: (Number(item.unit_price) * 1.3).toFixed(2), 
    })) || []
  );

  const handleUpdateItem = (id: string, field: keyof LocalPricingItem, value: string | number) => {
    setItems((prev: LocalPricingItem[]) => prev.map((item) => 
      item.product_id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSubmit = () => {
    onConfirm(items);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      {/* Correction Tailwind: rounded-4xl au lieu de rounded-[32px] */}
      <div className="bg-white w-full max-w-4xl rounded-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <PackageCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800">Réception du transfert</h2>
              <p className="text-sm text-slate-500 font-medium">{transfer.reference} • De: {transfer.source_depot}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
            <X size={24} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3 mb-6">
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            <p className="text-xs text-amber-700 font-medium">
              Vérifiez soigneusement les quantités reçues. En validant, les produits seront ajoutés à votre inventaire local et les prix de vente seront mis à jour.
            </p>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-2">Produit</th>
                <th className="px-4 py-2 w-32">Qté Attendue</th>
                <th className="px-4 py-2 w-32">Qté Reçue</th>
                <th className="px-4 py-2 w-40">Prix Vente (FG)</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.product_id} className="group">
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-slate-700">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase">{item.code}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm font-bold text-slate-400">{item.requested_qty}</span>
                  </td>
                  <td className="px-4 py-4">
                    <input 
                      type="number"
                      value={item.received_qty}
                      onChange={(e) => handleUpdateItem(item.product_id, 'received_qty', Number(e.target.value))}
                      className="w-20 px-3 py-2 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="relative">
                      <input 
                        type="number"
                        value={item.sale_price}
                        onChange={(e) => handleUpdateItem(item.product_id, 'sale_price', e.target.value)}
                        className="w-full pl-3 pr-3 py-2 bg-blue-50/50 border border-blue-100 rounded-xl text-sm font-black text-blue-600 outline-none"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <p className="text-sm font-bold text-slate-700">
                      {(Number(item.sale_price) * Number(item.received_qty)).toLocaleString()}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="p-6 border-t border-slate-50 flex items-center justify-between bg-slate-50/30">
          <div className="hidden md:block">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Valeur Totale Réceptionnée</p>
            <p className="text-xl font-black text-slate-800">
              {items.reduce((acc: number, curr: LocalPricingItem) => acc + (Number(curr.sale_price) * Number(curr.received_qty)), 0).toLocaleString()} FG
            </p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button 
              onClick={handleSubmit}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-green-100 hover:bg-green-700 transition-all"
            >
              <CheckCircle2 size={20} />
              Confirmer la réception
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}