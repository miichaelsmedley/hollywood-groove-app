import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserRole } from '../hooks/useUserRole';
import { UserRole, hasRole } from '../types/roles';
import { Sparkles } from 'lucide-react';

interface RoleGateProps {
  children: ReactNode;
  /** User must have at least one of these roles to access */
  requiredRoles: UserRole[];
  /** If true, user must have ALL specified roles (default: any one role) */
  requireAll?: boolean;
  /** Custom fallback to show when access denied */
  fallback?: ReactNode;
  /** Where to redirect if access denied (default: no redirect, show fallback) */
  redirectTo?: string;
}

/**
 * Route guard that restricts access based on user roles.
 *
 * Usage:
 * ```tsx
 * <RoleGate requiredRoles={['band_member', 'admin']}>
 *   <TestShowPage />
 * </RoleGate>
 * ```
 */
export function RoleGate({
  children,
  requiredRoles,
  requireAll = false,
  fallback,
  redirectTo,
}: RoleGateProps) {
  const { roles, isLoading } = useUserRole();

  // Show loading spinner while checking roles
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-cinema-200 border-t-primary mx-auto"></div>
            <Sparkles className="w-5 h-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-cinema-500 text-sm">Checking access...</p>
        </div>
      </div>
    );
  }

  // Check if user has required access
  const hasAccess = requireAll
    ? requiredRoles.every((role) => hasRole(roles, role))
    : requiredRoles.some((role) => hasRole(roles, role));

  if (!hasAccess) {
    // Redirect if specified
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    // Show fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }
    // Default access denied view
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <div className="w-16 h-16 rounded-full bg-cinema-100 flex items-center justify-center mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-xl font-semibold text-cinema-900 mb-2">Access Restricted</h2>
        <p className="text-cinema-600 max-w-sm">
          You don't have permission to view this content. Contact the admin if you believe this is
          an error.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Convenience component for band members and admins only.
 */
export function BandMemberGate({
  children,
  fallback,
  redirectTo,
}: Omit<RoleGateProps, 'requiredRoles'>) {
  return (
    <RoleGate requiredRoles={['band_member', 'admin']} fallback={fallback} redirectTo={redirectTo}>
      {children}
    </RoleGate>
  );
}

/**
 * Convenience component for scorers and admins only.
 */
export function ScorerGate({
  children,
  fallback,
  redirectTo,
}: Omit<RoleGateProps, 'requiredRoles'>) {
  return (
    <RoleGate requiredRoles={['scorer', 'admin']} fallback={fallback} redirectTo={redirectTo}>
      {children}
    </RoleGate>
  );
}

/**
 * Convenience component for admins only.
 */
export function AdminGate({
  children,
  fallback,
  redirectTo,
}: Omit<RoleGateProps, 'requiredRoles'>) {
  return (
    <RoleGate requiredRoles={['admin']} fallback={fallback} redirectTo={redirectTo}>
      {children}
    </RoleGate>
  );
}
