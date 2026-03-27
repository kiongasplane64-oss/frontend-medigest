// components/inventory/StockAlertBadge.tsx
import { AlertTriangle, PackageX, Clock } from 'lucide-react';

interface StockAlertBadgeProps {
  stockStatus?: string;
  expiryStatus?: string;
  quantity?: number;
  threshold?: number;
  expiryDate?: string | null;
}

export default function StockAlertBadge({
  stockStatus,
  expiryStatus,
  quantity,
  threshold,
  expiryDate,
}: StockAlertBadgeProps) {
  if (stockStatus === 'out_of_stock' || quantity === 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
        <PackageX size={12} />
        Rupture
      </span>
    );
  }

  if (stockStatus === 'low_stock' || (threshold && quantity && quantity <= threshold)) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
        <AlertTriangle size={12} />
        Stock faible
      </span>
    );
  }

  if (expiryStatus === 'expired' || (expiryDate && new Date(expiryDate) < new Date())) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
        <Clock size={12} />
        Expiré
      </span>
    );
  }

  if (expiryStatus === 'critical' || (expiryDate && new Date(expiryDate) < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
        <Clock size={12} />
        Expire bientôt
      </span>
    );
  }

  if (expiryStatus === 'warning' || (expiryDate && new Date(expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
        <Clock size={12} />
        Expire dans 30j
      </span>
    );
  }

  return null;
}