import { UserRole } from '../api/auth';

export type Permission = 'dashboard:view' | 'users:read' | 'users:delete';

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['dashboard:view', 'users:read', 'users:delete'],
  manager: ['dashboard:view', 'users:read'],
  viewer: ['dashboard:view'],
};

/**
 * Client-side permission checks are for UX only (hiding/disabling);
 * the server is the authoritative source of authorization.
 */
export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}
