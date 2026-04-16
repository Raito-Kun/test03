import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';

interface RoleGuardProps {
  allow: string[];
  /** Where to send disallowed users. Default: /contacts (agent's primary workspace). */
  fallback?: string;
  children: React.ReactNode;
}

/**
 * Role-based route gate. Redirects users whose role is not in `allow`
 * to `fallback`. Use for routes that sidebar hides but that must also
 * be protected if navigated to directly via URL.
 */
export function RoleGuard({ allow, fallback = '/contacts', children }: RoleGuardProps) {
  const role = useAuthStore((s) => s.user?.role ?? '');
  if (!allow.includes(role)) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
