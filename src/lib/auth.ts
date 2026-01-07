import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  signInAnonymously,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();
// Request email and profile scopes
googleProvider.addScope('email');
googleProvider.addScope('profile');

// Flag to prevent auto-anonymous sign-in during Google auth flow
let googleAuthInProgress = false;

// Storage key to track pending redirect across page loads
const REDIRECT_PENDING_KEY = 'hg_google_auth_redirect_pending';

export function isGoogleAuthInProgress(): boolean {
  // Check both in-memory flag and localStorage (for cross-redirect detection)
  return googleAuthInProgress || localStorage.getItem(REDIRECT_PENDING_KEY) === 'true';
}

function setRedirectPending(pending: boolean): void {
  if (pending) {
    localStorage.setItem(REDIRECT_PENDING_KEY, 'true');
  } else {
    localStorage.removeItem(REDIRECT_PENDING_KEY);
  }
}

/**
 * Handle redirect result on app load.
 * Call this once when the app initializes.
 * Returns true if a redirect was processed, false otherwise.
 */
export async function handleRedirectResult(): Promise<boolean> {
  const wasRedirectPending = localStorage.getItem(REDIRECT_PENDING_KEY) === 'true';

  console.log('🔍 Checking for redirect result...');
  console.log('Current URL:', window.location.href);
  console.log('Auth domain configured:', auth.app.options.authDomain);
  console.log('Redirect was pending:', wasRedirectPending);

  // Wait for auth to be ready before checking redirect result
  // This is important because getRedirectResult needs auth to be initialized
  await auth.authStateReady();
  console.log('Auth state ready');

  // IMPORTANT: Check if user is already signed in with Google FIRST
  // This handles the case where auth state was preserved but getRedirectResult returns null
  if (auth.currentUser && auth.currentUser.providerData.some(p => p.providerId === 'google.com')) {
    console.log('✅ User already signed in with Google (auth state preserved):', {
      uid: auth.currentUser.uid,
      email: auth.currentUser.email,
      isAnonymous: auth.currentUser.isAnonymous,
    });
    // Clear the pending flag since auth is complete
    setRedirectPending(false);
    return true;
  }

  console.log('Current user before getRedirectResult:', auth.currentUser ? {
    uid: auth.currentUser.uid,
    email: auth.currentUser.email,
    isAnonymous: auth.currentUser.isAnonymous,
  } : 'null');

  try {
    const result = await getRedirectResult(auth);

    // Clear the pending flag regardless of result
    setRedirectPending(false);

    if (result) {
      console.log('✅ Successfully signed in/linked with Google after redirect:', {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        isAnonymous: result.user.isAnonymous,
        providerData: result.user.providerData,
      });
      return true;
    } else {
      // Check if we were expecting a redirect but didn't get a result
      if (wasRedirectPending) {
        console.log('⚠️ Redirect was pending but no result returned');
        console.log('Current user after getRedirectResult:', auth.currentUser ? {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          isAnonymous: auth.currentUser.isAnonymous,
          providerData: auth.currentUser.providerData,
        } : 'null');

        // The user might already be signed in - check currentUser
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
          console.log('✅ User is already signed in (auth state was preserved)');
          return true;
        }
      }
      console.log('No redirect result found (normal page load)');
      return false;
    }
  } catch (error: any) {
    // Clear the pending flag on error too
    setRedirectPending(false);

    console.error('❌ Error handling redirect result:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.error('Error details:', JSON.stringify(error, null, 2));

    if (error.code === 'auth/credential-already-in-use') {
      // The Google account is already linked to a different Firebase user.
      // We need to sign in with that existing account instead.
      // The credential is available in the error object.
      console.warn('Google account already linked to another user. Signing in with existing account...');

      // Get the credential from the error
      const credential = GoogleAuthProvider.credentialFromError(error);
      if (credential) {
        try {
          // Sign out the anonymous user first
          await firebaseSignOut(auth);
          // Sign in with the credential (this will sign in as the existing Google user)
          const { signInWithCredential } = await import('firebase/auth');
          const result = await signInWithCredential(auth, credential);
          console.log('✅ Signed in with existing Google account:', {
            uid: result.user.uid,
            email: result.user.email,
          });
          return true;
        } catch (signInError) {
          console.error('Failed to sign in with existing credential:', signInError);
          // Fall back to regular redirect sign-in
          await signInWithRedirect(auth, googleProvider);
          return true;
        }
      } else {
        // No credential available, fall back to regular sign-in
        console.log('No credential in error, falling back to redirect sign-in');
        await firebaseSignOut(auth);
        await signInWithRedirect(auth, googleProvider);
        return true;
      }
    } else if (error.code === 'auth/popup-closed-by-user') {
      // User cancelled - ignore
      return false;
    } else {
      throw error;
    }
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

  // Set flag to prevent auto-anonymous sign-in during this flow
  googleAuthInProgress = true;

  try {
    // Sign out any existing user (anonymous or otherwise)
    if (currentUser) {
      console.log('Signing out current user before Google sign-in...');
      await firebaseSignOut(auth);
    }

    console.log('🔐 Starting Google sign-in (popup mode)...');
    console.log('User agent:', navigator.userAgent);
    console.log('Auth domain:', auth.app.options.authDomain);
    console.log('Current URL:', window.location.href);

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
      return true;
    } catch (popupError: any) {
      console.log('Popup attempt result:', popupError.code, popupError.message);

      // Only fall back to redirect if popup was actually blocked (not just closed)
      if (popupError.code === 'auth/popup-blocked') {
        console.log('📱 Popup blocked, falling back to redirect...');
        setRedirectPending(true);
        await signInWithRedirect(auth, googleProvider);
        return false; // Will complete after redirect
      } else if (popupError.code === 'auth/popup-closed-by-user' ||
                 popupError.code === 'auth/cancelled-popup-request') {
        console.log('User cancelled sign-in');
        // Re-sign in anonymously since we signed out
        await signInAnonymously(auth);
        throw new Error('Sign-in cancelled');
      } else {
        throw popupError;
      }
    }
  } catch (error: any) {
    console.error('Google sign-in error:', error.code, error.message);
    // Re-sign in anonymously on any error (if not already signed in)
    if (!auth.currentUser) {
      await signInAnonymously(auth);
    }
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
