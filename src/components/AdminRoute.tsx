import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Navigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { hasPlatformAdminClaim } from '../lib/claims';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard that only allows admin users to access the wrapped content.
 * Non-admin users are redirected to the home page.
 */
export default function AdminRoute({ children }: AdminRouteProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const allowed = await hasPlatformAdminClaim(user);
        if (isActive) {
          setIsAdmin(allowed);
        }
      } catch (error) {
        console.warn('Admin claim check failed', error);
        if (isActive) {
          setIsAdmin(false);
        }
      }
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, []);

  if (isAdmin === null) {
    return null;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
