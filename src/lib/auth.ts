import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  linkWithPopup,
  linkWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  signInWithCredential,
  User,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();
// Request email and profile scopes
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Flag to prevent auto-anonymous sign-in during Google auth flow
let googleAuthInProgress = false;

// Storage keys for tracking auth state across redirects
const REDIRECT_PENDING_KEY = 'hg_google_auth_redirect_pending';
const REDIRECT_TIMESTAMP_KEY = 'hg_google_auth_redirect_timestamp';
// NEW: Track popup auth start (survives page focus changes)
const POPUP_AUTH_KEY = 'hg_google_auth_popup_pending';

// Maximum time to wait for redirect result (5 minutes)
const REDIRECT_MAX_AGE_MS = 5 * 60 * 1000;
// Popup auth timeout (30 seconds - popups should complete quickly)
const POPUP_MAX_AGE_MS = 30 * 1000;

export interface RedirectResult {
  success: boolean;
  userSignedInWithGoogle: boolean;
  wasRedirectPending: boolean;
  error?: Error;
}

export function isGoogleAuthInProgress(): boolean {
  // Check in-memory flag first
  if (googleAuthInProgress) return true;

  // Check localStorage for redirect pending
  const redirectPending = localStorage.getItem(REDIRECT_PENDING_KEY) === 'true';
  if (redirectPending) {
    const timestamp = localStorage.getItem(REDIRECT_TIMESTAMP_KEY);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > REDIRECT_MAX_AGE_MS) {
        console.log('🧹 Clearing stale redirect state (age:', Math.round(age / 1000), 'seconds)');
        clearRedirectPending();
      } else {
        return true;
      }
    }
  }

  // Check localStorage for popup pending (survives page focus changes)
  const popupPending = localStorage.getItem(POPUP_AUTH_KEY) === 'true';
  if (popupPending) {
    const timestamp = localStorage.getItem(REDIRECT_TIMESTAMP_KEY);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      if (age > POPUP_MAX_AGE_MS) {
        console.log('🧹 Clearing stale popup auth state (age:', Math.round(age / 1000), 'seconds)');
        clearPopupPending();
      } else {
        return true;
      }
    }
  }

  return false;
}

function setPopupPending(pending: boolean): void {
  if (pending) {
    localStorage.setItem(POPUP_AUTH_KEY, 'true');
    localStorage.setItem(REDIRECT_TIMESTAMP_KEY, Date.now().toString());
  } else {
    clearPopupPending();
  }
}

function clearPopupPending(): void {
  localStorage.removeItem(POPUP_AUTH_KEY);
}

function setRedirectPending(pending: boolean): void {
  if (pending) {
    localStorage.setItem(REDIRECT_PENDING_KEY, 'true');
    localStorage.setItem(REDIRECT_TIMESTAMP_KEY, Date.now().toString());
  } else {
    clearRedirectPending();
  }
}

function clearRedirectPending(): void {
  localStorage.removeItem(REDIRECT_PENDING_KEY);
  localStorage.removeItem(REDIRECT_TIMESTAMP_KEY);
}

/**
 * Clear all pending auth state - use when auth completes or fails
 */
export function clearAllPendingAuth(): void {
  clearRedirectPending();
  clearPopupPending();
  googleAuthInProgress = false;
}

/**
 * Check if a user is signed in with Google provider.
 */
function hasGoogleProvider(user: User | null): boolean {
  if (!user) return false;
  return user.providerData.some(p => p.providerId === 'google.com');
}

/**
 * Wait for auth state to fully stabilize after a redirect.
 * Mobile browsers can take time to restore auth state from localStorage.
 */
async function waitForAuthStateStable(maxWaitMs: number = 2000): Promise<User | null> {
  const startTime = Date.now();
  const checkInterval = 100;

  // First wait for Firebase's auth state ready
  await auth.authStateReady();

  // If we already have a Google user, we're done
  if (hasGoogleProvider(auth.currentUser)) {
    console.log('✅ Google user already present after authStateReady');
    return auth.currentUser;
  }

  // On mobile, auth state restoration can be slow - poll for it
  while (Date.now() - startTime < maxWaitMs) {
    if (hasGoogleProvider(auth.currentUser)) {
      console.log('✅ Google user detected after', Date.now() - startTime, 'ms');
      return auth.currentUser;
    }

    // If we have any non-anonymous user, that's also good
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      console.log('✅ Non-anonymous user detected after', Date.now() - startTime, 'ms');
      return auth.currentUser;
    }

    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }

  console.log('⏱️ Auth state wait timed out after', maxWaitMs, 'ms');
  return auth.currentUser;
}

/**
 * Handle redirect result on app load.
 * Call this once when the app initializes.
 *
 * Returns a detailed result object indicating:
 * - success: whether auth flow completed successfully
 * - userSignedInWithGoogle: whether user is now signed in with Google
 * - wasRedirectPending: whether we were expecting a redirect
 * - error: any error that occurred
 */
export async function handleRedirectResult(): Promise<RedirectResult> {
  const wasRedirectPending = localStorage.getItem(REDIRECT_PENDING_KEY) === 'true';
  const wasPopupPending = localStorage.getItem(POPUP_AUTH_KEY) === 'true';

  console.log('🔍 Checking for redirect result...');
  console.log('Current URL:', window.location.href);
  console.log('Auth domain configured:', auth.app.options.authDomain);
  console.log('Redirect was pending:', wasRedirectPending);
  console.log('Popup was pending:', wasPopupPending);

  // Clear popup pending since we're now checking auth state
  // (popup should have completed or failed by now)
  if (wasPopupPending) {
    clearPopupPending();
  }

  // CRITICAL: Wait for auth state to fully stabilize
  // On mobile, this can take longer due to localStorage restoration
  const waitTime = wasRedirectPending ? 3000 : 1000; // Wait longer if we expect a redirect
  console.log('⏳ Waiting up to', waitTime, 'ms for auth state to stabilize...');
  const user = await waitForAuthStateStable(waitTime);

  console.log('Auth state after wait:', user ? {
    uid: user.uid,
    email: user.email,
    isAnonymous: user.isAnonymous,
    providers: user.providerData.map(p => p.providerId),
  } : 'null');

  // IMPORTANT: Check if user is already signed in with Google FIRST
  // This handles the common case where auth state was preserved but getRedirectResult returns null
  if (hasGoogleProvider(user)) {
    console.log('✅ User already signed in with Google (auth state preserved):', {
      uid: user!.uid,
      email: user!.email,
      isAnonymous: user!.isAnonymous,
    });
    // Clear the pending flag since auth is complete
    clearRedirectPending();
    return {
      success: true,
      userSignedInWithGoogle: true,
      wasRedirectPending,
    };
  }

  // Now try getRedirectResult for cases where auth state wasn't preserved
  try {
    console.log('📞 Calling getRedirectResult...');
    const result = await getRedirectResult(auth);

    if (result) {
      console.log('✅ Successfully signed in/linked with Google after redirect:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        isAnonymous: result.user.isAnonymous,
        providerData: result.user.providerData,
      });
      clearRedirectPending();
      return {
        success: true,
        userSignedInWithGoogle: true,
        wasRedirectPending,
      };
    }

    // No result from getRedirectResult - check if we were expecting one
    if (wasRedirectPending) {
      console.log('⚠️ Redirect was pending but getRedirectResult returned null');

      // Final check: maybe auth state was restored after our initial wait
      if (hasGoogleProvider(auth.currentUser)) {
        console.log('✅ Google user found on recheck');
        clearRedirectPending();
        return {
          success: true,
          userSignedInWithGoogle: true,
          wasRedirectPending,
        };
      }

      // Check if user is signed in but not with Google (edge case)
      if (auth.currentUser && !auth.currentUser.isAnonymous) {
        console.log('✅ Non-anonymous user found (auth state was preserved)');
        clearRedirectPending();
        return {
          success: true,
          userSignedInWithGoogle: hasGoogleProvider(auth.currentUser),
          wasRedirectPending,
        };
      }

      // Redirect was expected but auth failed - clear the pending state
      // but indicate failure so the app can handle appropriately
      console.log('❌ Redirect was pending but no user signed in - redirect may have failed');
      clearRedirectPending();
      return {
        success: false,
        userSignedInWithGoogle: false,
        wasRedirectPending,
        error: new Error('Redirect authentication failed - no user signed in after redirect'),
      };
    }

    // Normal page load, no redirect expected
    console.log('No redirect result found (normal page load)');
    return {
      success: true, // Not a failure, just nothing to do
      userSignedInWithGoogle: hasGoogleProvider(auth.currentUser),
      wasRedirectPending: false,
    };

  } catch (error: any) {
    console.error('❌ Error handling redirect result:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.code === 'auth/credential-already-in-use') {
      // The Google account is already linked to a different Firebase user.
      // We need to sign in with that existing account instead.
      console.warn('Google account already linked to another user. Signing in with existing account...');

      const credential = GoogleAuthProvider.credentialFromError(error);
      if (credential) {
        try {
          // Sign out the anonymous user first
          await firebaseSignOut(auth);
          // Sign in with the credential (this will sign in as the existing Google user)
          const signInResult = await signInWithCredential(auth, credential);
          console.log('✅ Signed in with existing Google account:', {
            uid: signInResult.user.uid,
            email: signInResult.user.email,
          });
          clearRedirectPending();
          return {
            success: true,
            userSignedInWithGoogle: true,
            wasRedirectPending,
          };
        } catch (signInError: any) {
          console.error('Failed to sign in with existing credential:', signInError);
          clearRedirectPending();
          return {
            success: false,
            userSignedInWithGoogle: false,
            wasRedirectPending,
            error: signInError,
          };
        }
      }

      // No credential available - this is a failure case
      clearRedirectPending();
      return {
        success: false,
        userSignedInWithGoogle: false,
        wasRedirectPending,
        error,
      };
    }

    if (error.code === 'auth/popup-closed-by-user') {
      // User cancelled - not really an error
      clearRedirectPending();
      return {
        success: true,
        userSignedInWithGoogle: false,
        wasRedirectPending,
      };
    }

    // Clear pending state on any error
    clearRedirectPending();
    return {
      success: false,
      userSignedInWithGoogle: false,
      wasRedirectPending,
      error,
    };
  }
}

/**
 * Sign in with Google.
 *
 * Uses popup flow for all devices - redirect flow has reliability issues on some
 * mobile browsers where the auth state is lost during the redirect.
 *
 * Returns true if sign-in was successful.
 */
export async function signInWithGoogle(): Promise<boolean> {
  const currentUser = auth.currentUser;

  // If already signed in with Google, nothing to do
  if (currentUser?.providerData.some(p => p.providerId === 'google.com')) {
    console.log('Already signed in with Google');
    return true;
  }

  // Set flags to prevent auto-anonymous sign-in during this flow
  googleAuthInProgress = true;
  // Track popup auth in localStorage so it survives page focus loss
  setPopupPending(true);

  try {
    console.log('🔐 Starting Google sign-in (popup mode)...');
    console.log('User agent:', navigator.userAgent);
    console.log('Auth domain:', auth.app.options.authDomain);
    console.log('Current URL:', window.location.href);

    if (currentUser?.isAnonymous) {
      console.log('Linking anonymous user with Google...');
      try {
        const result = await linkWithPopup(currentUser, googleProvider);
        console.log('✅ Linked anonymous user with Google:', {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          isAnonymous: result.user.isAnonymous,
          providerData: result.user.providerData,
        });
        clearPopupPending();
        return true;
      } catch (popupError: any) {
        console.log('Popup attempt result:', popupError.code, popupError.message);

        if (popupError.code === 'auth/popup-blocked') {
          console.log('📱 Popup blocked, falling back to redirect...');
          clearPopupPending();
          setRedirectPending(true);
          await linkWithRedirect(currentUser, googleProvider);
          return false; // Will complete after redirect
        } else if (popupError.code === 'auth/credential-already-in-use') {
          console.warn('Google account already linked to another user. Signing in with existing account...');
          const credential = GoogleAuthProvider.credentialFromError(popupError);
          if (credential) {
            await firebaseSignOut(auth);
            const result = await signInWithCredential(auth, credential);
            console.log('✅ Signed in with existing Google account:', {
              uid: result.user.uid,
              email: result.user.email,
            });
            clearPopupPending();
            return true;
          }
          throw popupError;
        } else if (
          popupError.code === 'auth/popup-closed-by-user' ||
          popupError.code === 'auth/cancelled-popup-request'
        ) {
          console.log('User cancelled sign-in');
          clearPopupPending();
          throw new Error('Sign-in cancelled');
        } else {
          throw popupError;
        }
      }
    }

    // Always try popup first - it's more reliable across all browsers
    // Most modern mobile browsers support popups now
    try {
      const result = await signInWithPopup(auth, googleProvider);
      console.log('✅ Signed in with Google:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        isAnonymous: result.user.isAnonymous,
        providerData: result.user.providerData,
      });
      clearPopupPending();
      return true;
    } catch (popupError: any) {
      console.log('Popup attempt result:', popupError.code, popupError.message);

      // Only fall back to redirect if popup was actually blocked (not just closed)
      if (popupError.code === 'auth/popup-blocked') {
        console.log('📱 Popup blocked, falling back to redirect...');
        clearPopupPending();
        setRedirectPending(true);
        await signInWithRedirect(auth, googleProvider);
        return false; // Will complete after redirect
      } else if (
        popupError.code === 'auth/popup-closed-by-user' ||
        popupError.code === 'auth/cancelled-popup-request'
      ) {
        console.log('User cancelled sign-in');
        clearPopupPending();
        // DON'T auto-sign-in anonymously here - let the caller decide
        throw new Error('Sign-in cancelled');
      } else {
        throw popupError;
      }
    }
  } catch (error: any) {
    console.error('Google sign-in error:', error.code, error.message);
    clearPopupPending();
    // DON'T auto-sign-in anonymously - let the error bubble up
    throw error;
  } finally {
    googleAuthInProgress = false;
  }
}

/**
 * Sign out the current user.
 * App will automatically sign in anonymously again (see App.tsx).
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Check if the current user is signed in with Google.
 */
export function isSignedInWithGoogle(): boolean {
  const user = auth.currentUser;
  if (!user) return false;
  return user.providerData.some(p => p.providerId === 'google.com');
}

/**
 * Get the user's Google photo URL if available.
 */
export function getGooglePhotoURL(): string | null {
  const user = auth.currentUser;
  if (!user) return null;

  const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
  return googleProvider?.photoURL || user.photoURL;
}
