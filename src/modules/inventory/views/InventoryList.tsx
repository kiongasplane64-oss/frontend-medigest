import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getInventory, updateProduct, deleteProduct, restockProduct, createProduct, 
  ProductStock, getProductHistory, StockMovement
} from '@/services/stockService';
import { 
  AlertCircle, Search, DollarSign, TrendingUp,
  ChevronUp, ChevronDown, X, Save, Loader2, Plus, Trash2, RefreshCcw, 
  Tag, Camera, FileText, Table as TableIcon, History, ArrowUpRight, ArrowDownLeft,
  Percent
} from 'lucide-react';
import { Html5QrcodeScanner } from "html5-qrcode";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import Barcode from 'react-barcode';

// Interface étendue pour inclure les champs TVA
interface ProductStockWithVAT extends ProductStock {
  has_tva?: boolean;
  tva_rate?: number;
}

export default function InventoryList() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [sortConfig, setSortConfig] = useState<{ key: keyof ProductStock; direction: 'asc' | 'desc' } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductStockWithVAT | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [newProductTvaRate, setNewProductTvaRate] = useState<number>(0);

  const { data: products, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: getInventory
  });

  // Récupération de l'historique réel
  const { data: history, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['product-history', selectedProduct?.id],
    queryFn: () => selectedProduct ? getProductHistory(selectedProduct.id) : Promise.resolve([]),
    enabled: !!selectedProduct && !isEditing,
  });

  // Scanner QR Code
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (isScanning) {
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
      
      scanner.render(
        (decodedText) => {
          const foundProduct = products?.find(p => p.code === decodedText);
          if (foundProduct) {
            setSelectedProduct(foundProduct as ProductStockWithVAT);
            setIsScanning(false);
          } else {
            setSearchTerm(decodedText);
            setIsScanning(false);
          }
          if (scanner) scanner.clear().catch(console.error);
        },
        (error) => { console.warn(error); }
      );
    }
    
    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error("Scanner cleanup error:", err));
      }
    };
  }, [isScanning, products]);

  // Impression d'étiquette
  const printLabel = (product: ProductStockWithVAT) => {
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Impression Étiquette - ${product.name}</title>
          <style>
            @page { size: 50mm 30mm; margin: 0; }
            body { 
              font-family: sans-serif; 
              display: flex; 
              flex-direction: column; 
              align-items: center; 
              justify-content: center;
              height: 30mm; width: 50mm;
              padding: 2mm; box-sizing: border-box;
              text-align: center;
            }
            .name { font-size: 10pt; font-weight: bold; margin-bottom: 1mm; text-transform: uppercase; }
            .price { font-size: 9pt; font-weight: bold; margin-bottom: 1mm; }
            .barcode { max-width: 100%; }
          </style>
        </head>
        <body>
          <div class="name">${product.name}</div>
          <div class="price">${product.selling_price.toLocaleString()} FG</div>
          <div id="bc"></div>
          <script>
            window.opener.document.getElementById('temp-barcode').querySelectorAll('svg').forEach(svg => {
              document.getElementById('bc').appendChild(svg.cloneNode(true));
            });
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Omit<ProductStock, 'id'>) => createProduct(data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['inventory'] }); 
      setShowAddModal(false); 
      setNewProductTvaRate(0);
    },
    onError: (error) => {
      console.error("Erreur lors de la création du produit:", error);
      alert("Erreur lors de la création du produit. Vérifiez les données saisies.");
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProductStock> }) => updateProduct(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['inventory'] }); 
      queryClient.invalidateQueries({ queryKey: ['product-history'] });
      setIsEditing(false); 
      setSelectedProduct(null); 
    },
    onError: (error) => {
      console.error("Erreur lors de la mise à jour du produit:", error);
      alert("Erreur lors de la mise à jour. Vérifiez les données saisies.");
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['inventory'] }); 
      setSelectedProduct(null); 
    }
  });

  const restockMutation = useMutation({
    mutationFn: ({ id, qty }: { id: string; qty: number }) => restockProduct(id, qty),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-history'] });
    }
  });

  // Logique métier
  const { stats, displayList, categories } = useMemo(() => {
    const list = (products || []) as ProductStockWithVAT[];
    
    const summary = list.reduce((acc, p) => ({
      patrimoine: acc.patrimoine + (p.quantity * p.selling_price),
      profit: acc.profit + (p.quantity * (p.selling_price - p.purchase_price)),
      alertes: acc.alertes + (p.quantity <= p.alert_threshold ? 1 : 0),
    }), { patrimoine: 0, profit: 0, alertes: 0 });

    // Catégories uniques
    const uniqueCategories = ['Tous', ...new Set(list.map(p => p.category).filter(Boolean))];

    // Filtrage des produits
    let filtered = list.filter(p => 
      (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
       p.code.toLowerCase().includes(searchTerm.toLowerCase())) &&
      (selectedCategory === 'Tous' || p.category === selectedCategory)
    );

    // Tri des produits
    if (sortConfig) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';
        return sortConfig.direction === 'asc' ? (aVal < bVal ? -1 : 1) : (aVal > bVal ? -1 : 1);
      });
    }
    
    return { 
      stats: summary, 
      displayList: filtered, 
      categories: uniqueCategories 
    };
  }, [products, searchTerm, selectedCategory, sortConfig]);

  // Validation des données TVA
  const validateVATData = (has_tva: boolean, tva_rate: number): boolean => {
    if (has_tva && (tva_rate === undefined || tva_rate <= 0)) {
      alert("Pour un produit soumis à TVA, le taux doit être supérieur à 0.");
      return false;
    }
    return true;
  };

  // Exports
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("INVENTAIRE PHARMACIE", 14, 15);
    autoTable(doc, {
      head: [['Code', 'Produit', 'Stock', 'Prix Vente', 'TVA']],
      body: displayList.map((p: ProductStockWithVAT) => [
        p.code, 
        p.name, 
        p.quantity, 
        `${p.selling_price} FG`, 
        p.has_tva ? `${p.tva_rate || 0}%` : 'Non'
      ]),
      startY: 20,
      headStyles: { fillColor: [14, 165, 233] }
    });
    doc.save("inventaire-pharma.pdf");
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(displayList);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventaire");
    XLSX.writeFile(wb, "inventaire-pharma.xlsx");
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-medical" size={40} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50/50 min-h-screen">
      {/* Élément invisible pour générer le SVG du code-barres */}
      <div id="temp-barcode" className="hidden">
        {selectedProduct && (
          <Barcode 
            value={selectedProduct.code} 
            width={1.5} 
            height={40} 
            fontSize={10} 
          />
        )}
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter italic uppercase">
            PHARMA<span className="text-medical">STOCK</span>
          </h1>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">
            Inventory Management System
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={exportPDF}
            className="flex-1 md:flex-none bg-white border p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <FileText size={18}/> PDF
          </button>
          <button 
            onClick={exportExcel}
            className="flex-1 md:flex-none bg-white border p-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs hover:bg-slate-50 transition-colors"
          >
            <TableIcon size={18}/> EXCEL
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex-1 md:flex-none bg-medical text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-medical-dark shadow-xl shadow-blue-100 flex items-center gap-2 transition-all active:scale-95"
          >
            <Plus size={18} /> NOUVEAU
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          label="Valeur Stock" 
          value={`${stats.patrimoine.toLocaleString()} FG`} 
          icon={<DollarSign/>} 
          color="medical" 
        />
        <StatCard 
          label="Profit Estimé" 
          value={`${stats.profit.toLocaleString()} FG`} 
          icon={<TrendingUp/>} 
          color="success" 
        />
        <StatCard 
          label="Alertes" 
          value={stats.alertes} 
          icon={<AlertCircle/>} 
          color={stats.alertes > 0 ? "danger" : "slate"} 
        />
      </div>

      {/* Recherche, filtre & scan */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              className="w-full pl-16 pr-8 py-5 bg-white border-none rounded-4xl shadow-sm outline-none focus:ring-4 focus:ring-medical/5 font-bold text-slate-700 transition-all" 
              placeholder="Nom ou code à scanner..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-6 py-5 bg-white border border-slate-100 rounded-4xl shadow-sm outline-none focus:ring-4 focus:ring-medical/5 font-bold text-slate-700 min-w-45"
          >
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
          <button 
            onClick={() => setIsScanning(!isScanning)} 
            className={`px-6 rounded-4xl transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest border shadow-sm ${
              isScanning ? 'bg-danger text-white border-danger' : 'bg-white text-medical border-slate-100 hover:bg-slate-50'
            }`}
          >
            <Camera size={20}/> {isScanning ? "STOP" : "SCAN"}
          </button>
        </div>

        {isScanning && (
          <div className="relative overflow-hidden rounded-3xl border-4 border-medical bg-black shadow-2xl">
            <div id="reader" className="w-full"></div>
            <div className="absolute inset-0 border-2 border-medical/30 pointer-events-none animate-pulse"></div>
          </div>
        )}
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-4xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50/50 border-b border-slate-100">
            <tr>
              <SortHeader label="Médicament" sortKey="name" current={sortConfig} onSort={setSortConfig} />
              <SortHeader label="Stock" sortKey="quantity" current={sortConfig} onSort={setSortConfig} align="center" />
              <SortHeader label="Prix Vente" sortKey="selling_price" current={sortConfig} onSort={setSortConfig} align="right" />
              <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">TVA</th>
              <th className="p-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayList.map((p: ProductStockWithVAT) => (
              <tr 
                key={p.id} 
                className="hover:bg-medical-light/20 transition-all cursor-pointer group"
              >
                <td className="p-6" onClick={() => setSelectedProduct(p)}>
                  <p className="font-black text-slate-800 uppercase text-sm">{p.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                    <Tag size={10}/> {p.code}
                  </p>
                </td>
                <td className="p-6 text-center" onClick={() => setSelectedProduct(p)}>
                  <span className={`px-4 py-1.5 rounded-full font-black text-xs ${
                    p.quantity <= p.alert_threshold 
                      ? 'bg-danger/10 text-danger' 
                      : 'bg-success/10 text-success'
                  }`}>
                    {p.quantity}
                  </span>
                </td>
                <td className="p-6 text-right font-bold text-slate-600" onClick={() => setSelectedProduct(p)}>
                  {p.selling_price.toLocaleString()} FG
                  {p.has_tva && (
                    <div className="text-[10px] text-slate-400 font-bold">
                      dont TVA: {Math.round(p.selling_price * ((p.tva_rate || 0) / 100)).toLocaleString()} FG
                    </div>
                  )}
                </td>
                <td className="p-6 text-center" onClick={() => setSelectedProduct(p)}>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    p.has_tva 
                      ? 'bg-success/10 text-success' 
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {p.has_tva ? `${p.tva_rate || 0}%` : 'Non'}
                  </span>
                </td>
                <td className="p-6">
                  <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-all">
                    <button 
                      onClick={() => { 
                        const q = prompt("Quantité réappro ?"); 
                        if(q) restockMutation.mutate({id: p.id, qty: Number(q)}); 
                      }} 
                      className="p-2.5 bg-success/10 text-success rounded-xl hover:scale-105 transition-transform"
                    >
                      <RefreshCcw size={16}/>
                    </button>
                    <button 
                      onClick={() => { 
                        if(confirm("Supprimer ce produit ?")) deleteMutation.mutate(p.id); 
                      }} 
                      className="p-2.5 bg-danger/10 text-danger rounded-xl hover:scale-105 transition-transform"
                    >
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer détails avec historique */}
      {selectedProduct && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40" 
            onClick={() => setSelectedProduct(null)} 
          />
          <div className="fixed right-0 top-0 h-screen w-full md:w-112.5 bg-white z-50 shadow-2xl p-10 animate-in slide-in-from-right duration-500 overflow-y-auto">
            <div className="flex justify-between mb-8">
              <div className="flex gap-2">
                <button 
                  onClick={() => setIsEditing(!isEditing)}
                  className="text-[10px] font-black uppercase bg-medical-light text-medical-dark px-4 py-2 rounded-xl hover:bg-medical-light/80 transition-colors"
                >
                  {isEditing ? 'ANNULER' : 'MODIFIER'}
                </button>
                {/* Bouton étiquette */}
                {!isEditing && (
                  <button 
                    onClick={() => printLabel(selectedProduct)}
                    className="text-[10px] font-black uppercase bg-slate-100 text-slate-600 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-200 transition-colors"
                  >
                    <Tag size={12}/> Étiquette
                  </button>
                )}
              </div>
              <button 
                onClick={() => setSelectedProduct(null)}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X/>
              </button>
            </div>
            
            <h2 className="text-4xl font-black text-slate-900 italic uppercase mb-2 leading-none">
              {selectedProduct.name}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10">
              {selectedProduct.category}
            </p>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const has_tva = fd.get('has_tva') === 'on';
                const tva_rate = Number(fd.get('tva_rate'));
                
                if (!validateVATData(has_tva, tva_rate)) {
                  return;
                }

                updateMutation.mutate({
                  id: selectedProduct.id,
                  data: {
                    quantity: Number(fd.get('quantity')),
                    purchase_price: Number(fd.get('purchase_price')),
                    selling_price: Number(fd.get('selling_price')),
                    alert_threshold: Number(fd.get('alert_threshold')),
                    has_tva: has_tva,
                    tva_rate: has_tva ? tva_rate : 0
                  }
                });
              }} 
              className="space-y-6 mb-12"
            >
              <InputField 
                label="Stock Actuel" 
                name="quantity" 
                type="number" 
                defaultValue={selectedProduct.quantity} 
                disabled={!isEditing} 
              />
              <div className="grid grid-cols-2 gap-4">
                <InputField 
                  label="P. Achat" 
                  name="purchase_price" 
                  type="number" 
                  defaultValue={selectedProduct.purchase_price} 
                  disabled={!isEditing} 
                />
                <InputField 
                  label="P. Vente" 
                  name="selling_price" 
                  type="number" 
                  defaultValue={selectedProduct.selling_price} 
                  disabled={!isEditing} 
                />
              </div>

              {/* Champs TVA pour l'édition */}
              {isEditing && (
                <div className="space-y-4 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="has_tva"
                      name="has_tva" 
                      defaultChecked={selectedProduct.has_tva}
                      className="w-5 h-5 rounded-md border-slate-300 text-medical focus:ring-medical/20 cursor-pointer"
                    />
                    <label htmlFor="has_tva" className="text-sm font-bold text-slate-700 cursor-pointer">
                      Soumis à TVA
                    </label>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <InputField 
                      label="Taux TVA (%)" 
                      name="tva_rate" 
                      type="number" 
                      min="0.1"
                      step="0.1"
                      defaultValue={selectedProduct.tva_rate || 0}
                      disabled={!isEditing}
                    />
                    {selectedProduct.has_tva && (
                      <div className="bg-white p-5 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Montant TVA</p>
                        <p className="font-bold text-slate-900">
                          {Math.round(selectedProduct.selling_price * ((selectedProduct.tva_rate || 0) / 100)).toLocaleString()} FG
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <InputField 
                label="Seuil Alerte" 
                name="alert_threshold" 
                type="number" 
                defaultValue={selectedProduct.alert_threshold} 
                disabled={!isEditing} 
              />

              {isEditing ? (
                <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-800 transition-colors"
                >
                  <Save size={18}/> SAUVEGARDER
                </button>
              ) : (
                <div className="space-y-6">
                  {/* Affichage TVA en lecture seule */}
                  {!isEditing && (
                    <div className="flex items-center justify-between p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${
                          selectedProduct.has_tva 
                            ? 'bg-success/10 text-success' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Percent size={18}/>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase">TVA</p>
                          <p className="text-sm font-bold text-slate-700">
                            {selectedProduct.has_tva 
                              ? `Soumis à TVA (${selectedProduct.tva_rate || 0}%)` 
                              : 'Non soumis à TVA'
                            }
                          </p>
                        </div>
                      </div>
                      {selectedProduct.has_tva && (
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Montant TVA</p>
                          <p className="text-lg font-black text-success">
                            {Math.round(selectedProduct.selling_price * ((selectedProduct.tva_rate || 0) / 100)).toLocaleString()} FG
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-slate-900">
                    <History size={18} className="text-medical" />
                    <h3 className="font-black uppercase text-xs tracking-widest">Mouvements de Stock</h3>
                  </div>

                  {isLoadingHistory ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="animate-spin text-slate-200" />
                    </div>
                  ) : history && history.length > 0 ? (
                    <div className="space-y-3">
                      {history.map((move: StockMovement) => (
                        <div 
                          key={move.id} 
                          className="flex justify-between items-center p-5 bg-slate-50 rounded-3xl border border-slate-100"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-xl ${
                              move.type === 'in' 
                                ? 'bg-success/10 text-success' 
                                : 'bg-danger/10 text-danger'
                            }`}>
                              {move.type === 'in' ? <ArrowDownLeft size={16}/> : <ArrowUpRight size={16}/>}
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase text-slate-400">
                                {move.type === 'in' ? 'Réappro' : 'Vente'}
                              </p>
                              <p className="text-xs font-bold text-slate-700">
                                {new Date(move.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <p className={`font-black ${
                            move.type === 'in' ? 'text-success' : 'text-danger'
                          }`}>
                            {move.type === 'in' ? '+' : '-'}{move.quantity}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-xs font-bold text-slate-300 py-10 uppercase tracking-widest">
                      Aucun mouvement
                    </p>
                  )}
                </div>
              )}
            </form>
          </div>
        </>
      )}

      {/* Modal ajout */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-4xl p-10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black uppercase italic text-slate-900">Nouveau Produit</h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setNewProductTvaRate(0);
                }}
                className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X/>
              </button>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const has_tva = fd.get('has_tva') === 'on';
                const tva_rate = Number(fd.get('tva_rate'));
                
                if (!validateVATData(has_tva, tva_rate)) {
                  return;
                }

                const productData = {
                  name: String(fd.get('name')),
                  code: String(fd.get('code')) || `PROD-${Math.floor(1000 + Math.random()*9000)}`,
                  category: String(fd.get('category')),
                  quantity: Number(fd.get('quantity')),
                  purchase_price: Number(fd.get('purchase_price')),
                  selling_price: Number(fd.get('selling_price')),
                  alert_threshold: Number(fd.get('alert_threshold')) || 0,
                  expiry_date: String(fd.get('expiry_date')),
                  has_tva: has_tva,
                  tva_rate: has_tva ? tva_rate : 0
                };

                createMutation.mutate(productData);
              }} 
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Désignation" name="name" required />
                <InputField label="Code Barre" name="code" placeholder="PROD-XXXX" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <InputField label="Catégorie" name="category" required />
                <InputField label="Date Expiration" name="expiry_date" type="date" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <InputField label="Stock Initial" name="quantity" type="number" required />
                <InputField label="Prix Achat" name="purchase_price" type="number" required />
                <InputField label="Prix Vente" name="selling_price" type="number" required />
              </div>
              
              {/* Champs TVA dans le modal d'ajout */}
              <div className="space-y-4 p-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    id="add_has_tva"
                    name="has_tva" 
                    className="w-5 h-5 rounded-md border-slate-300 text-medical focus:ring-medical/20 cursor-pointer"
                    onChange={(e) => {
                      if (!e.target.checked) {
                        setNewProductTvaRate(0);
                      }
                    }}
                  />
                  <label htmlFor="add_has_tva" className="text-sm font-bold text-slate-700 cursor-pointer">
                    Soumis à TVA
                  </label>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
                      Taux TVA (%)
                    </label>
                    <input 
                      name="tva_rate" 
                      type="number" 
                      min="0.1"
                      step="0.1"
                      defaultValue="0"
                      value={newProductTvaRate}
                      onChange={(e) => setNewProductTvaRate(Number(e.target.value))}
                      className="w-full border-none rounded-2xl p-5 font-black text-slate-900 outline-none transition-all bg-slate-100 focus:bg-white ring-2 ring-transparent focus:ring-medical/10"
                    />
                  </div>
                  <div className="bg-white p-5 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-1">
                      Montant TVA estimé
                    </p>
                    <p className="font-bold text-slate-900">
                      {(() => {
                        const sellingPriceInput = document.querySelector('input[name="selling_price"]') as HTMLInputElement;
                        const sellingPrice = sellingPriceInput ? Number(sellingPriceInput.value) || 0 : 0;
                        return Math.round(sellingPrice * (newProductTvaRate / 100)).toLocaleString();
                      })()} FG
                    </p>
                  </div>
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-medical text-white py-6 rounded-3xl font-black uppercase tracking-widest hover:bg-medical-dark transition-all mt-4"
              >
                Valider l'entrée
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Sous-composants
const StatCard = ({ label, value, icon, color }: any) => {
  const styles: any = {
    medical: "bg-medical-light text-medical",
    success: "bg-emerald-50 text-success",
    danger: "bg-danger/10 text-danger",
    slate: "bg-slate-50 text-slate-400"
  };
  
  return (
    <div className="bg-white p-8 rounded-4xl border border-slate-100 shadow-sm transition-all hover:shadow-xl group">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${styles[color]}`}>
        {icon}
      </div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className="text-3xl font-black text-slate-900 italic tracking-tight">
        {value}
      </p>
    </div>
  );
};

const SortHeader = ({ label, sortKey, current, onSort, align = "left" }: any) => (
  <th 
    className={`p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer hover:text-medical transition-all ${
      align === "center" ? "text-center" : align === "right" ? "text-right" : ""
    }`}
    onClick={() => onSort({ 
      key: sortKey, 
      direction: current?.key === sortKey && current.direction === 'asc' ? 'desc' : 'asc' 
    })}
  >
    <div className={`flex items-center gap-2 ${
      align === "center" ? "justify-center" : align === "right" ? "justify-end" : ""
    }`}>
      {label}
      <div className="flex flex-col opacity-20">
        <ChevronUp 
          size={10} 
          className={current?.key === sortKey && current.direction === 'asc' ? 'text-medical opacity-100' : ''} 
        />
        <ChevronDown 
          size={10} 
          className={current?.key === sortKey && current.direction === 'desc' ? 'text-medical opacity-100' : ''} 
        />
      </div>
    </div>
  </th>
);

const InputField = ({ label, name, type = "text", defaultValue, disabled, required, placeholder, min, step }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">
      {label}
    </label>
    <input 
      name={name} 
      type={type} 
      defaultValue={defaultValue} 
      required={required} 
      readOnly={disabled} 
      placeholder={placeholder}
      min={min}
      step={step}
      className={`w-full border-none rounded-2xl p-5 font-black text-slate-900 outline-none transition-all ${
        disabled 
          ? 'bg-slate-50 opacity-60 cursor-not-allowed' 
          : 'bg-slate-100 focus:bg-white ring-2 ring-transparent focus:ring-medical/10'
      }`} 
    />
  </div>
);