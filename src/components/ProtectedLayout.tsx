// components/ProtectedLayout.tsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import { SubscriptionEnd } from './SubscriptionEnd';
import { useAuthStore } from '@/store/useAuthStore';

export const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SubscriptionEnd>
      <Outlet />
    </SubscriptionEnd>
  );
};