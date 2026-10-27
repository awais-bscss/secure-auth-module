import React, { ReactNode } from 'react';
import { Permission, hasPermission } from './permissions';
// Auth context consumer hook
import { useAuth } from './useAuth';

export function useCan(permission: Permission): boolean {
  const { user } = useAuth();
  return hasPermission(user?.role, permission);
}

interface CanProps {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}

export const Can: React.FC<CanProps> = ({ permission, children, fallback = null }) => {
  const canAccess = useCan(permission);

  if (!canAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};
