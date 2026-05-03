// pages/CorbeillePage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Trash2, RotateCcw, X, Search, Filter, AlertTriangle } from 'lucide-react-native';

interface TrashItem {
  id: string;
  item_type: string;
  original_id: string;
  original_reference?: string;
  original_name?: string;
  deleted_by_name?: string;
  deleted_by_email?: string;
  deletion_reason?: string;
  deleted_at: string;
  auto_delete_at?: string;
  is_restored: boolean;
  data?: any;
}

const apiService = {
  async getTrashItems(params?: { page?: number; limit?: number; item_type?: string; search?: string }): Promise<{ items: TrashItem[]; total: number }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.item_type) queryParams.append('item_type', params.item_type);
    if (params?.search) queryParams.append('search', params.search);
    
    const response = await fetch(`/api/trash/?${queryParams.toString()}`);
    const data = await response.json();
    return { items: data.items || [], total: data.total || 0 };
  },

  async restoreTrashItem(trashId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/trash/${trashId}/restore`, { method: 'POST' });
    return response.json();
  },

  async deleteTrashItemPermanently(trashId: string): Promise<{ message: string }> {
    const response = await fetch(`/api/trash/${trashId}`, { method: 'DELETE' });
    return response.json();
  },

  async cleanupExpiredTrash(): Promise<{ deleted_count: number }> {
    const response = await fetch('/api/trash/cleanup/expired', { method: 'DELETE' });
    return response.json();
  },

  async getTrashStats(): Promise<{ total_items: number; items_by_type: Array<{ type: string; count: number }> }> {
    const response = await fetch('/api/trash/stats/overview');
    return response.json();
  },
};

export default function CorbeillePage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [stats, setStats] = useState<{ total_items: number; items_by_type: Array<{ type: string; count: number }> } | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TrashItem | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsItem, setDetailsItem] = useState<TrashItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [trashData, statsData] = await Promise.all([
        apiService.getTrashItems({ page, limit: 20, item_type: selectedType || undefined, search: searchQuery || undefined }),
        apiService.getTrashStats(),
      ]);
      setItems(trashData.items);
      setTotal(trashData.total);
      setStats(statsData);
    } catch (error) {
      console.error('Erreur chargement corbeille:', error);
      Alert.alert('Erreur', 'Impossible de charger la corbeille');
    } finally {
      setLoading(false);
    }
  }, [page, selectedType, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRestore = async () => {
    if (!selectedItem) return;
    
    try {
      const result = await apiService.restoreTrashItem(selectedItem.id);
      Alert.alert('Succès', result.message);
      setShowRestoreModal(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Erreur restauration:', error);
      Alert.alert('Erreur', 'Impossible de restaurer l\'élément');
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    Alert.alert(
      'Suppression définitive',
      `Êtes-vous sûr de vouloir supprimer définitivement "${item.original_name}" ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await apiService.deleteTrashItemPermanently(item.id);
              Alert.alert('Succès', result.message);
              loadData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer l\'élément');
            }
          },
        },
      ]
    );
  };

  const handleCleanupExpired = async () => {
    Alert.alert(
      'Nettoyage automatique',
      'Cette action supprimera définitivement tous les éléments expirés de la corbeille.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Nettoyer',
          onPress: async () => {
            try {
              const result = await apiService.cleanupExpiredTrash();
              Alert.alert('Succès', `${result.deleted_count} éléments supprimés`);
              loadData();
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de nettoyer la corbeille');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('fr-FR');
  };

  const getItemTypeIcon = (type: string) => {
    switch (type) {
      case 'product': return '📦';
      case 'sale': return '💰';
      case 'customer': return '👤';
      default: return '📄';
    }
  };

  const getItemTypeLabel = (type: string) => {
    switch (type) {
      case 'product': return 'Produit';
      case 'sale': return 'Vente';
      case 'customer': return 'Client';
      default: return type;
    }
  };

  if (loading && page === 1) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗑️ Corbeille</Text>
        <TouchableOpacity style={styles.cleanupButton} onPress={handleCleanupExpired}>
          <Text style={styles.cleanupButtonText}>Nettoyer</Text>
        </TouchableOpacity>
      </View>

      {stats && (
        <View style={styles.statsBar}>
          <Text style={styles.statsText}>Total: {stats.total_items} éléments</Text>
          <View style={styles.statsTypes}>
            {stats.items_by_type.slice(0, 4).map(type => (
              <Text key={type.type} style={styles.statsType}>
                {getItemTypeIcon(type.type)} {type.count}
              </Text>
            ))}
          </View>
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.searchContainer}>
          <Search size={18} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.filterButton} onPress={() => {
          // Simple toggle entre les types
          Alert.alert('Filtrer par type', 'Choisissez un type', [
            { text: 'Tous', onPress: () => setSelectedType('') },
            { text: 'Produits', onPress: () => setSelectedType('product') },
            { text: 'Ventes', onPress: () => setSelectedType('sale') },
            { text: 'Clients', onPress: () => setSelectedType('customer') },
            { text: 'Annuler', style: 'cancel' },
          ]);
        }}>
          <Filter size={18} color="#666" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.itemsList}>
        {items.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Trash2 size={48} color="#ccc" />
            <Text style={styles.emptyText}>La corbeille est vide</Text>
          </View>
        ) : (
          items.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.itemCard}
              onPress={() => {
                setDetailsItem(item);
                setShowDetailsModal(true);
              }}
            >
              <View style={styles.itemHeader}>
                <Text style={styles.itemIcon}>{getItemTypeIcon(item.item_type)}</Text>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.original_name}</Text>
                  <Text style={styles.itemRef}>{item.original_reference}</Text>
                </View>
                <Text style={styles.itemType}>{getItemTypeLabel(item.item_type)}</Text>
              </View>
              
              <View style={styles.itemDetails}>
                <Text style={styles.itemDetail}>
                  🗑️ Supprimé par {item.deleted_by_name || 'Inconnu'} le {formatDate(item.deleted_at)}
                </Text>
                {item.deletion_reason && (
                  <Text style={styles.itemReason}>📝 {item.deletion_reason}</Text>
                )}
                {item.auto_delete_at && (
                  <Text style={styles.itemAutoDelete}>
                    ⏰ Suppression auto: {formatDate(item.auto_delete_at)}
                  </Text>
                )}
              </View>
              
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.restoreButton]}
                  onPress={() => {
                    setSelectedItem(item);
                    setShowRestoreModal(true);
                  }}
                >
                  <RotateCcw size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Restaurer</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handlePermanentDelete(item)}
                >
                  <Trash2 size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Supprimer</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal de restauration */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <AlertTriangle size={40} color="#FF9800" />
            <Text style={styles.modalTitle}>Restaurer l'élément</Text>
            <Text style={styles.modalMessage}>
              Voulez-vous restaurer "{selectedItem?.original_name}" ?
              Il sera remis dans sa catégorie d'origine.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelModalButton]}
                onPress={() => setShowRestoreModal(false)}
              >
                <Text style={styles.cancelModalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmModalButton]}
                onPress={handleRestore}
              >
                <Text style={styles.confirmModalButtonText}>Restaurer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal des détails */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.detailsModal]}>
            <View style={styles.detailsHeader}>
              <Text style={styles.detailsTitle}>
                {getItemTypeIcon(detailsItem?.item_type || '')} Détails
              </Text>
              <TouchableOpacity onPress={() => setShowDetailsModal(false)}>
                <X size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {detailsItem && (
              <ScrollView style={styles.detailsContent}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Nom:</Text>
                  <Text style={styles.detailValue}>{detailsItem.original_name}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Référence:</Text>
                  <Text style={styles.detailValue}>{detailsItem.original_reference || 'N/A'}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{getItemTypeLabel(detailsItem.item_type)}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Supprimé par:</Text>
                  <Text style={styles.detailValue}>{detailsItem.deleted_by_name} ({detailsItem.deleted_by_email})</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date suppression:</Text>
                  <Text style={styles.detailValue}>{formatDate(detailsItem.deleted_at)}</Text>
                </View>
                {detailsItem.deletion_reason && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Raison:</Text>
                    <Text style={styles.detailValue}>{detailsItem.deletion_reason}</Text>
                  </View>
                )}
                {detailsItem.auto_delete_at && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Suppression auto:</Text>
                    <Text style={styles.detailValue}>{formatDate(detailsItem.auto_delete_at)}</Text>
                  </View>
                )}
                
                {/* Données JSON */}
                {detailsItem.data && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Données:</Text>
                    <Text style={[styles.detailValue, styles.jsonData]}>
                      {JSON.stringify(detailsItem.data, null, 2)}
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#2196F3',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  cleanupButton: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  cleanupButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsText: {
    fontSize: 12,
    color: '#666',
  },
  statsTypes: {
    flexDirection: 'row',
    gap: 12,
  },
  statsType: {
    fontSize: 11,
    color: '#888',
  },
  toolbar: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    gap: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemsList: {
    flex: 1,
    padding: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 12,
    color: '#999',
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemRef: {
    fontSize: 12,
    color: '#999',
  },
  itemType: {
    fontSize: 11,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    color: '#666',
  },
  itemDetails: {
    marginBottom: 12,
  },
  itemDetail: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  itemReason: {
    fontSize: 11,
    color: '#FF9800',
    fontStyle: 'italic',
    marginBottom: 4,
  },
  itemAutoDelete: {
    fontSize: 10,
    color: '#F44336',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  restoreButton: {
    backgroundColor: '#4CAF50',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '85%',
    alignItems: 'center',
  },
  detailsModal: {
    width: '90%',
    maxHeight: '80%',
    alignItems: 'stretch',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButton: {
    backgroundColor: '#f5f5f5',
  },
  confirmModalButton: {
    backgroundColor: '#4CAF50',
  },
  cancelModalButtonText: {
    color: '#666',
  },
  confirmModalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  detailsContent: {
    maxHeight: 500,
  },
  detailRow: {
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
  },
  jsonData: {
    fontSize: 10,
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    padding: 8,
    borderRadius: 8,
  },
});