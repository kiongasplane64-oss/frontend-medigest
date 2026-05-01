// components/guards/ServiceGuardBridge.tsx
import { ReactNode } from 'react';
import ServiceGuardOriginal from './ServiceGuard';

interface ServiceGuardBridgeProps {
  children: ReactNode;
}

// Bridge component with explicit typing
export function ServiceGuardBridge({ children }: ServiceGuardBridgeProps) {
  return <ServiceGuardOriginal>{children}</ServiceGuardOriginal>;
}

export default ServiceGuardBridge;