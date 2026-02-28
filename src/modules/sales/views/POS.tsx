import { useState } from 'react';
import { Search, Trash2, CreditCard, Banknote, Loader2, CheckCircle, Lock } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { db } from '@/db/offlineDb';
import api from '@/api/client';

export default function POS() {
  const { isExpired } = useSubscription();
  const [cart, setCart] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calcul du total
  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const addToCart = (product: any) => {
    if (isExpired) return; // Sécurité supplémentaire
    setCart([...cart, { ...product, quantity: 1 }]);
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
  };

  const handleValidateSale = async () => {
    if (cart.length === 0 || isExpired) return;

    setIsProcessing(true);
    const newSale = {
      items: cart,
      total: total,
      timestamp: Date.now(),
      status: 'pending' as const
    };

    try {
      await api.post('/sales', newSale);
      alert("Vente enregistrée avec succès !");
      setCart([]);
    } catch (err) {
      await db.sales.add(newSale);
      alert("Mode hors-ligne : Vente enregistrée localement.");
      setCart([]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="relative flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)]">
      
      {/* 1. Overlay de lecture seule (Bloque les interactions si expiré) */}
      {isExpired && (
        <div className="absolute inset-0 z-50 bg-slate-50/40 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl border border-orange-100 max-w-sm text-center animate-in fade-in zoom-in duration-300">
            <div className="h-16 w-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Abonnement Expiré</h2>
            <p className="text-slate-500 text-sm mt-2 mb-6">
              Votre accès est en <strong>lecture seule</strong>. Les ventes sont désactivées.
            </p>
            <button className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors">
              Renouveler l'abonnement
            </button>
          </div>
        </div>
      )}

      {/* 2. Zone de recherche (Désactivée si expiré) */}
      <div className={`flex-1 space-y-4 overflow-y-auto ${isExpired ? 'pointer-events-none opacity-60' : ''}`}>
        <div className="relative">
          <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
          <input 
            disabled={isExpired}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border-none shadow-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            placeholder="Rechercher un médicament..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            onClick={() => addToCart({id: 1, name: 'Doliprane 500mg', price: 2500})} 
            className="bg-white p-4 rounded-xl border border-slate-100 hover:border-blue-500 cursor-pointer transition-all shadow-sm group"
          >
            <h4 className="font-bold text-slate-700 group-hover:text-blue-600">Doliprane 500mg</h4>
            <p className="text-blue-600 font-bold">2 500 FG</p>
            <p className="text-xs text-slate-400">En stock: 45</p>
          </div>
        </div>
      </div>

      {/* 3. Panier (Désactivé si expiré) */}
      <div className={`w-full lg:w-96 bg-white rounded-3xl shadow-lg border border-slate-100 flex flex-col ${isExpired ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="p-6 border-b border-slate-50">
          <h3 className="font-bold text-lg flex items-center gap-2 text-slate-800">
            Panier <span className="bg-blue-100 text-blue-600 text-xs px-2 py-0.5 rounded-full">{cart.length}</span>
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center text-slate-400 mt-10 italic text-sm">Panier vide</div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                <div>
                  <p className="font-semibold text-sm text-slate-700">{item.name}</p>
                  <p className="text-xs text-slate-400">1 x {item.price.toLocaleString()} FG</p>
                </div>
                <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-slate-50 rounded-b-3xl space-y-4">
          <div className="flex justify-between items-center font-bold text-xl text-slate-800">
            <span>Total</span>
            <span className="text-blue-600">{total.toLocaleString()} FG</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3 text-slate-400">
            <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl">
              <Banknote size={20} />
              <span className="text-[10px] font-bold">ESPÈCES</span>
            </div>
            <div className="flex flex-col items-center justify-center p-3 bg-white border border-slate-100 rounded-xl">
              <CreditCard size={20} />
              <span className="text-[10px] font-bold">MOBILE</span>
            </div>
          </div>

          <button 
            onClick={handleValidateSale}
            disabled={isProcessing || cart.length === 0 || isExpired}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
          >
            {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
            {isProcessing ? "Validation..." : "Valider la Vente"}
          </button>
        </div>
      </div>
    </div>
  );
}