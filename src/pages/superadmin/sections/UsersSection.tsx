// sections/UsersSection.tsx
import { Users } from 'lucide-react';

export default function UsersSection() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
      <Users size={48} className="mx-auto mb-4 text-gray-300" />
      <h3 className="text-lg font-medium text-gray-700 mb-2">Gestion des utilisateurs</h3>
      <p className="text-gray-400">Cette fonctionnalité est en cours de développement</p>
    </div>
  );
}