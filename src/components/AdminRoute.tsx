import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Link } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { auth } from '../lib/firebase';
import { readStaffClaims, type StaffClaims } from '../lib/claims';
import { signInWithGoogle } from '../lib/auth';

export type AdminRouteRole = 'platform_admin' | 'event_admin';

interface AdminRouteProps {
  children: React.ReactNode;
  allowedRoles?: readonly AdminRouteRole[];
}

const DEFAULT_ALLOWED_ROLES: readonly AdminRouteRole[] = ['platform_admin'];

function roleAllowed(claims: StaffClaims, role: AdminRouteRole): boolean {
  if (role === 'platform_admin') return claims.isPlatformAdmin;
  return claims.isEventAdmin;
}

function roleLabel(roles: readonly AdminRouteRole[]): string {
  return roles.join(' or ');
}

/**
 * Route guard that only allows users with the requested admin claims to access
 * the wrapped content. Platform-admin remains the default for every route.
 */
export default function AdminRoute({
  children,
  allowedRoles = DEFAULT_ALLOWED_ROLES,
}: AdminRouteProps) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requiredClaimLabel = roleLabel(allowedRoles);

  useEffect(() => {
    let isActive = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user || user.isAnonymous) {
          if (isActive) {
            setNeedsSignIn(true);
            setIsAdmin(false);
          }
          return;
        }
        setNeedsSignIn(false);
        const claims = await readStaffClaims(user);
        const allowed = allowedRoles.some((role) => roleAllowed(claims, role));
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
  }, [allowedRoles]);

  if (isAdmin === null) {
    return (
      <AdminGateShell>
        <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" />
      </AdminGateShell>
    );
  }

  if (needsSignIn) {
    return (
      <AdminGateShell>
        <ShieldCheck className="w-10 h-10 text-primary mx-auto" />
        <h1 className="text-xl font-bold text-cinema-900 text-center">Admin sign-in</h1>
        <p className="text-sm text-cinema-600 text-center">
          Sign in with the Google account that has the Hollywood Groove
          {requiredClaimLabel} claim.
        </p>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}
        <button
          type="button"
          disabled={signingIn}
          onClick={async () => {
            setError(null);
            setSigningIn(true);
            try {
              await signInWithGoogle();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Sign-in failed.');
            } finally {
              setSigningIn(false);
            }
          }}
          className="btn-primary w-full py-3 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {signingIn && <Loader2 className="w-4 h-4 animate-spin" />}
          Sign in with Google
        </button>
        <Link to="/" className="text-center text-sm text-cinema-500 hover:text-cinema-900">
          Back to app
        </Link>
      </AdminGateShell>
    );
  }

  if (!isAdmin) {
    return (
      <AdminGateShell>
        <ShieldCheck className="w-10 h-10 text-amber-500 mx-auto" />
        <h1 className="text-xl font-bold text-cinema-900 text-center">No admin access</h1>
        <p className="text-sm text-cinema-600 text-center">
          This account is signed in, but it does not have the {requiredClaimLabel} claim.
        </p>
        <Link to="/" className="btn-primary w-full py-3 text-center text-sm font-bold">
          Back to app
        </Link>
      </AdminGateShell>
    );
  }

  return <>{children}</>;
}

function AdminGateShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl border border-cinema-200 bg-cinema-50 p-6 space-y-4">
        {children}
      </div>
    </div>
  );
}
