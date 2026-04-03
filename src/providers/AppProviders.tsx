// src/providers/AppProviders.tsx
'use client';

import React from 'react';
import { PharmacyProvider } from '@/contexts/PharmacyContext';
import { ToastProvider } from '@/components/ui/Toast';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ToastProvider>
      <PharmacyProvider>
        {children}
      </PharmacyProvider>
    </ToastProvider>
  );
}