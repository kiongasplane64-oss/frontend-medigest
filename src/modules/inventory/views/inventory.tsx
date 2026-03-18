import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  QrCode,
  Camera,
  Save,
  X,
  RefreshCcw,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Printer,
  Download
} from 'lucide-react';
import api from '@/api/client';
import { formatCurrency, formatDate } from '@/utils/formatters';

// Définition des types
type InventoryStatus = 'pending' | 'counted' | 'verified';

interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  category: string;
  theoreticalStock: number;
  actualStock: number;
  difference: number;
  differenceValue: number;
  unitPrice: number;
  batchNumber: string;
  expiryDate: string;
  location: string;
  lastCount: string;
  countedBy: string;
  notes: string;
  status: InventoryStatus;
}

interface InventorySummary {
  totalItems: number;
  countedItems: number;
  verifiedItems: number;
  positiveDifferences: number;
  positiveDifferenceValue: number;
  negativeDifferences: number;
  negativeDifferenceValue: number;
  totalDifferenceValue: number;
}

interface InventorySession {
  id: string;
  pharmacyId: string;
  pharmacyName: string;
  date: string;
  status: 'in_progress' | 'completed' | 'cancelled';
  items: InventoryItem[];
  startedBy: string;
  completedBy?: string;
  completedAt?: string;
  summary: InventorySummary;
}

interface InventoryProps {
  pharmacyId: string;
  sessionId?: string;
}

const Inventory = ({ pharmacyId, sessionId }: InventoryProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<InventorySession | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showScanner, setShowScanner] = useState(false);
  const [scanValue, setScanValue] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<number>(0);

  useEffect(() => {
    if (sessionId) {
      loadInventorySession();
    } else {
      startNewSession();
    }
  }, [pharmacyId, sessionId]);

  const loadInventorySession = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/v1/inventory/${sessionId}`);
      setSession(response.data);
    } catch (error) {
      console.error('Erreur lors du chargement de l\'inventaire:', error);
    } finally {
      setLoading(false);
    }
  };

  const startNewSession = async () => {
    setLoading(true);
    try {
      const response = await api.post('/api/v1/inventory/start', {
        pharmacyId,
        date: new Date().toISOString()
      });
      setSession(response.data);
    } catch (error) {
      console.error('Erreur lors du démarrage de l\'inventaire:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStock = (productId: string, newStock: number) => {
    if (!session) return;

    const updatedItems: InventoryItem[] = session.items.map(item => {
      if (item.productId === productId) {
        const difference = newStock - item.theoreticalStock;
        const differenceValue = difference * item.unitPrice;
        
        return {
          ...item,
          actualStock: newStock,
          difference,
          differenceValue,
          status: newStock !== item.theoreticalStock ? 'counted' as InventoryStatus : 'verified' as InventoryStatus,
          lastCount: new Date().toISOString()
        };
      }
      return item;
    });

    setSession({
      ...session,
      items: updatedItems,
      summary: calculateSummary(updatedItems)
    });
  };

  const verifyItem = (productId: string) => {
    if (!session) return;

    const updatedItems: InventoryItem[] = session.items.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          status: 'verified' as InventoryStatus
        };
      }
      return item;
    });

    setSession({
      ...session,
      items: updatedItems,
      summary: calculateSummary(updatedItems)
    });
  };

  const calculateSummary = (items: InventoryItem[]): InventorySummary => {
    const countedItems = items.filter(i => i.status !== 'pending').length;
    const verifiedItems = items.filter(i => i.status === 'verified').length;
    
    const positiveDifferences = items.filter(i => i.difference > 0);
    const negativeDifferences = items.filter(i => i.difference < 0);
    
    const positiveDifferenceValue = positiveDifferences.reduce((sum, i) => sum + i.differenceValue, 0);
    const negativeDifferenceValue = negativeDifferences.reduce((sum, i) => sum + i.differenceValue, 0);
    
    return {
      totalItems: items.length,
      countedItems,
      verifiedItems,
      positiveDifferences: positiveDifferences.length,
      positiveDifferenceValue,
      negativeDifferences: negativeDifferences.length,
      negativeDifferenceValue,
      totalDifferenceValue: positiveDifferenceValue + negativeDifferenceValue
    };
  };

  const handleScan = (barcode: string) => {
    if (!session) return;
    
    const product = session.items.find(i => 
      i.productCode === barcode || i.productId === barcode
    );
    
    if (product) {
      setEditingItem(product.productId);
      setEditValue(product.actualStock);
    }
    
    setScanValue('');
    setShowScanner(false);
  };

  const completeInventory = async () => {
    if (!session) return;
    
    setSaving(true);
    try {
      await api.post(`/api/v1/inventory/${session.id}/complete`, {
        items: session.items
      });
      
      // Redirection ou notification
      alert('Inventaire finalisé avec succès !');
    } catch (error) {
      console.error('Erreur lors de la finalisation:', error);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = session?.items.filter(item => {
    const matchesSearch = item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const categories = [...new Set(session?.items.map(i => i.category))];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <RefreshCcw className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-slate-600">Chargement de l'inventaire...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Erreur de chargement</h2>
          <p className="text-slate-600 mb-4">Impossible de charger la session d'inventaire</p>
          <button
            onClick={startNewSession}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700"
          >
            Nouvel inventaire
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* En-tête */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-blue-600" />
                Inventaire - {session.pharmacyName}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Session du {formatDate(session.date)} • {session.status === 'in_progress' ? 'En cours' : 'Terminé'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                <Printer className="w-4 h-4" />
                Imprimer
              </button>
              
              <button
                onClick={() => {/* Exporter */}}
                className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                <Download className="w-4 h-4" />
                Exporter
              </button>
              
              {session.status === 'in_progress' && (
                <button
                  onClick={completeInventory}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Finalisation...' : 'Finaliser l\'inventaire'}
                </button>
              )}
            </div>
          </div>

          {/* Barre de progression */}
          <div className="mt-4 grid grid-cols-4 gap-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500">Total produits</p>
              <p className="text-xl font-bold text-slate-800">{session.summary.totalItems}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500">Produits comptés</p>
              <p className="text-xl font-bold text-blue-600">{session.summary.countedItems}</p>
              <div className="w-full h-1 bg-slate-200 rounded-full mt-2">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${(session.summary.countedItems / session.summary.totalItems) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500">Écarts positifs</p>
              <p className="text-xl font-bold text-green-600">
                +{formatCurrency(session.summary.positiveDifferenceValue)}
              </p>
              <p className="text-xs text-green-600">{session.summary.positiveDifferences} produits</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-xs text-slate-500">Écarts négatifs</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(session.summary.negativeDifferenceValue)}
              </p>
              <p className="text-xs text-red-600">{session.summary.negativeDifferences} produits</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenu principal */}
      <div className="p-6">
        {/* Barre d'outils */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom, code ou lot..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg"
              />
            </div>
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
            >
              <option value="all">Toutes catégories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <QrCode className="w-4 h-4" />
              Scanner
            </button>
          </div>
          
          {showScanner && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-blue-600" />
                <input
                  type="text"
                  value={scanValue}
                  onChange={(e) => setScanValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan(scanValue)}
                  placeholder="Scannez ou saisissez le code-barres..."
                  className="flex-1 p-2 border border-slate-200 rounded-lg"
                  autoFocus
                />
                <button
                  onClick={() => setShowScanner(false)}
                  className="p-2 hover:bg-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tableau d'inventaire */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Produit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Lot</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Emplacement</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Expiration</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock théorique</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Stock réel</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Écart</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Valeur écart</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Statut</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{item.productName}</p>
                        <p className="text-xs text-slate-500">Code: {item.productCode}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.batchNumber}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.location}</td>
                    <td className="px-6 py-4">
                      <span className={`text-sm ${
                        new Date(item.expiryDate) < new Date() ? 'text-red-600' :
                        new Date(item.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) ? 'text-orange-600' :
                        'text-slate-600'
                      }`}>
                        {formatDate(item.expiryDate)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">
                      {item.theoreticalStock}
                    </td>
                    <td className="px-6 py-4">
                      {editingItem === item.productId ? (
                        <input
                          type="number"
                          value={editValue}
                          onChange={(e) => setEditValue(Number(e.target.value))}
                          onBlur={() => {
                            updateStock(item.productId, editValue);
                            setEditingItem(null);
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && setEditingItem(null)}
                          className="w-20 p-1 border border-blue-500 rounded-lg"
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() => {
                            setEditingItem(item.productId);
                            setEditValue(item.actualStock);
                          }}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded"
                        >
                          {item.actualStock}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        item.difference > 0 ? 'text-green-600' :
                        item.difference < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {item.difference > 0 ? '+' : ''}{item.difference}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-sm font-medium ${
                        item.differenceValue > 0 ? 'text-green-600' :
                        item.differenceValue < 0 ? 'text-red-600' : 'text-slate-500'
                      }`}>
                        {item.differenceValue > 0 ? '+' : ''}{formatCurrency(item.differenceValue)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        item.status === 'verified' ? 'bg-green-100 text-green-700' :
                        item.status === 'counted' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {item.status === 'verified' ? 'Vérifié' :
                         item.status === 'counted' ? 'Compté' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {item.status !== 'verified' && (
                        <button
                          onClick={() => verifyItem(item.productId)}
                          className="text-green-600 hover:text-green-700"
                          title="Vérifier"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Affichage {filteredItems.length} sur {session.items.length} produits
            </p>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg">1</span>
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Résumé des écarts */}
        {session.summary.totalDifferenceValue !== 0 && (
          <div className={`mt-6 p-4 rounded-xl border ${
            session.summary.totalDifferenceValue > 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              {session.summary.totalDifferenceValue > 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              <div>
                <p className="font-medium text-slate-800">
                  Écart total: {session.summary.totalDifferenceValue > 0 ? '+' : ''}
                  {formatCurrency(session.summary.totalDifferenceValue)}
                </p>
                <p className="text-sm text-slate-600">
                  {session.summary.positiveDifferences} produits en excédent, {session.summary.negativeDifferences} produits en manque
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inventory;