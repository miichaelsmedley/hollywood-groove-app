import { useEffect, useState } from 'react';
import { onAuthStateChanged, onIdTokenChanged, signInAnonymously } from 'firebase/auth';
import { auth, authPersistenceReady } from '../lib/firebase';
import {
  clearAllPendingAuth,
  handleRedirectResult,
  isGoogleAuthInProgress,
} from '../lib/auth';
import type { RedirectResult } from '../lib/auth';

const AUTH_REDIRECT_KEYS = [
  'hg_google_auth_redirect_pending',
  'hg_google_auth_redirect_timestamp',
  'hg_google_auth_popup_pending',
];

const RETRYABLE_ANONYMOUS_AUTH_CODES = new Set([
  'auth/network-request-failed',
  'auth/too-many-requests',
]);

const MAX_ANONYMOUS_AUTH_RETRY_DELAY_MS = 30_000;

function getAuthErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const maybeError = error as { code?: unknown };
  return typeof maybeError.code === 'string' ? maybeError.code : null;
}

function isRetryableAnonymousAuthError(error: unknown): boolean {
  const code = getAuthErrorCode(error);
  return code ? RETRYABLE_ANONYMOUS_AUTH_CODES.has(code) : false;
}

function getAnonymousAuthRetryDelay(attempt: number): number {
  const exponentialDelay = Math.min(
    MAX_ANONYMOUS_AUTH_RETRY_DELAY_MS,
    1000 * 2 ** attempt
  );
  const jitter = Math.round(exponentialDelay * (0.2 + Math.random() * 0.3));
  return Math.min(MAX_ANONYMOUS_AUTH_RETRY_DELAY_MS, exponentialDelay + jitter);
}

export function clearStoredAuthAttempt(): void {
  AUTH_REDIRECT_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function useAuthBootstrap() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [authStatusLabel, setAuthStatusLabel] = useState('Loading...');

  useEffect(() => {
    if (!authError || !authReady) {
      return;
    }

    setShowErrorBanner(true);
    const timer = window.setTimeout(() => setShowErrorBanner(false), 10000);
    return () => window.clearTimeout(timer);
  }, [authError, authReady]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let tokenUnsubscribe: (() => void) | undefined;
    let isMounted = true;
    let retryTimer: number | null = null;

    const waitForRetry = (delayMs: number) => new Promise<void>((resolve) => {
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        resolve();
      }, delayMs);
    });

    const observeAuthChanges = (label = 'Auth state changed') => {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        console.log(label, user ? {
          uid: user.uid,
          isAnonymous: user.isAnonymous,
          email: user.email,
        } : 'null');
      });
    };

    (async () => {
      console.log('Waiting for auth persistence to be configured...');
      await authPersistenceReady;

      let redirectResult: RedirectResult;
      let hadAuthAttempt = false;

      try {
        console.log('Processing redirect result...');
        redirectResult = await handleRedirectResult();
        console.log('Redirect result:', redirectResult);
        hadAuthAttempt = redirectResult.wasRedirectPending;

        if (!redirectResult.success && redirectResult.error) {
          console.error('Auth redirect failed:', redirectResult.error);
          clearAllPendingAuth();
          setAuthError('Sign-in failed. Please try again.');
        }
      } catch (error) {
        console.error('Error handling redirect:', error);
        clearAllPendingAuth();
        redirectResult = {
          success: false,
          userSignedInWithGoogle: false,
          wasRedirectPending: false,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }

      if (!isMounted) {
        return;
      }

      tokenUnsubscribe = onIdTokenChanged(auth, (user) => {
        if (user) {
          localStorage.setItem('hg_last_token_refresh', new Date().toISOString());
          console.log('Auth token refreshed for:', user.uid);
        }
      });

      if (redirectResult.userSignedInWithGoogle) {
        console.log('User is signed in with Google, auth initialization complete');
        setAuthReady(true);
        observeAuthChanges();
        return;
      }

      console.log('Waiting for auth state to be fully ready...');
      await auth.authStateReady();

      if (!isMounted) {
        return;
      }

      console.log('Auth state ready, current user:', auth.currentUser ? {
        uid: auth.currentUser.uid,
        isAnonymous: auth.currentUser.isAnonymous,
        email: auth.currentUser.email,
        providers: auth.currentUser.providerData?.map((provider) => provider.providerId),
      } : 'null');

      if (auth.currentUser) {
        console.log('User already signed in after auth state ready');
        setAuthReady(true);
        observeAuthChanges();
        return;
      }

      if (isGoogleAuthInProgress()) {
        console.log('No user but Google auth in progress, waiting...');
        setAuthReady(true);
        observeAuthChanges('Auth state changed (waiting for Google)');
        return;
      }

      if (hadAuthAttempt && !redirectResult.success) {
        console.log('Auth attempt failed, not auto-signing in anonymously');
        setAuthReady(true);
        observeAuthChanges('Auth state changed (after failed attempt)');
        return;
      }

      let anonymousSignInComplete = false;
      let anonymousSignInAttempt = 0;

      while (isMounted && !anonymousSignInComplete) {
        try {
          console.log('No user found, signing in anonymously...');
          await signInAnonymously(auth);
          console.log('Anonymous sign-in complete');
          anonymousSignInComplete = true;
          setAuthStatusLabel('Loading...');
        } catch (error) {
          console.error('Firebase auth error:', error);

          if (!isRetryableAnonymousAuthError(error)) {
            setAuthError('Authentication failed. Please refresh the page.');
            break;
          }

          const retryDelay = getAnonymousAuthRetryDelay(anonymousSignInAttempt);
          anonymousSignInAttempt += 1;
          setAuthError(null);
          setAuthStatusLabel('Connecting... hang tight');
          console.warn(
            `Anonymous sign-in throttled or offline; retrying in ${Math.round(retryDelay / 1000)}s`
          );
          await waitForRetry(retryDelay);
        }
      }

      if (!isMounted) {
        return;
      }

      setAuthReady(true);
      observeAuthChanges();
    })();

    return () => {
      isMounted = false;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
      unsubscribe?.();
      tokenUnsubscribe?.();
    };
  }, []);

  return {
    authReady,
    authError,
    showErrorBanner,
    authStatusLabel,
    clearAuthError: () => {
      setShowErrorBanner(false);
      setAuthError(null);
      clearAllPendingAuth();
    },
  };
}
