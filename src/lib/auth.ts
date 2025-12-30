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

export function isGoogleAuthInProgress(): boolean {
  return googleAuthInProgress;
}

/**
 * Handle redirect result on app load.
 * Call this once when the app initializes.
 * Returns true if a redirect was processed, false otherwise.
 */
export async function handleRedirectResult(): Promise<boolean> {
  console.log('Checking for redirect result...');
  try {
    const result = await getRedirectResult(auth);
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
      console.log('No redirect result found (normal page load)');
      return false;
    }
  } catch (error: any) {
    console.error('❌ Error handling redirect result:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

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
 * Simplified approach: Sign out anonymous user first, then sign in with Google.
 * This avoids the complexity of linkWithPopup which has cross-origin issues.
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

    // Now do a fresh Google sign-in
    console.log('Starting Google sign-in...');
    const result = await signInWithPopup(auth, googleProvider);
    console.log('✅ Signed in with Google:', {
      uid: result.user.uid,
      email: result.user.email,
      displayName: result.user.displayName,
      isAnonymous: result.user.isAnonymous,
      providerData: result.user.providerData,
    });
    return true;
  } catch (error: any) {
    console.error('Google sign-in error:', error.code, error.message);

    if (error.code === 'auth/popup-blocked') {
      console.log('Popup blocked, falling back to redirect');
      await signInWithRedirect(auth, googleProvider);
      return false; // Will complete after redirect
    } else if (error.code === 'auth/popup-closed-by-user' ||
               error.code === 'auth/cancelled-popup-request') {
      console.log('User cancelled sign-in');
      // Re-sign in anonymously since we signed out
      await signInAnonymously(auth);
      throw new Error('Sign-in cancelled');
    } else {
      throw error;
    }
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
