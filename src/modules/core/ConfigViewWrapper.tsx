// ConfigViewWrapper.tsx - Composant wrapper
import { useAuthStore } from '@/store/useAuthStore';
import { useParams } from 'react-router-dom';
import ConfigView from '@/modules/core/ConfigView';

const ConfigViewWrapper = () => {
  const { pharmacyId: urlPharmacyId } = useParams<{ pharmacyId: string }>();
  const { user } = useAuthStore();
  
  // Priorité à l'ID de l'URL, sinon celui du contexte
  const pharmacyId = urlPharmacyId || user?.pharmacy_id;

  if (!pharmacyId) {
    return <div>Chargement...</div>;
  }

  return <ConfigView pharmacyId={pharmacyId} />;
};

export default ConfigViewWrapper;