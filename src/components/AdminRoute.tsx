import { Navigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { isAdminEmail } from '../lib/mode';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that only allows admin users to access the wrapped content.
 * Non-admin users are redirected to the home page.
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const isAdmin = isAdminEmail(auth.currentUser?.email);

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
