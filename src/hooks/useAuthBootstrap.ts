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

export function clearStoredAuthAttempt(): void {
  AUTH_REDIRECT_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function useAuthBootstrap() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showErrorBanner, setShowErrorBanner] = useState(false);

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

      try {
        console.log('No user found, signing in anonymously...');
        await signInAnonymously(auth);
        console.log('Anonymous sign-in complete');
      } catch (error) {
        console.error('Firebase auth error:', error);
        setAuthError('Authentication failed. Please refresh the page.');
      }

      if (!isMounted) {
        return;
      }

      setAuthReady(true);
      observeAuthChanges();
    })();

    return () => {
      isMounted = false;
      unsubscribe?.();
      tokenUnsubscribe?.();
    };
  }, []);

  return {
    authReady,
    authError,
    showErrorBanner,
    clearAuthError: () => {
      setShowErrorBanner(false);
      setAuthError(null);
      clearAllPendingAuth();
    },
  };
}
