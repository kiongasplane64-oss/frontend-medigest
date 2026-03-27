// components/inventory/ViewToggle.tsx
import { Grid3x3, List } from 'lucide-react';

interface ViewToggleProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export default function ViewToggle({ viewMode, onViewModeChange }: ViewToggleProps) {
  return (
    <div className="flex bg-slate-100 rounded-lg p-1">
      <button
        onClick={() => onViewModeChange('grid')}
        className={`p-2 rounded-lg transition-colors ${
          viewMode === 'grid'
            ? 'bg-white text-medical shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Vue grille"
      >
        <Grid3x3 size={18} />
      </button>
      <button
        onClick={() => onViewModeChange('list')}
        className={`p-2 rounded-lg transition-colors ${
          viewMode === 'list'
            ? 'bg-white text-medical shadow-sm'
            : 'text-slate-500 hover:text-slate-700'
        }`}
        title="Vue liste"
      >
        <List size={18} />
      </button>
    </div>
  );
}