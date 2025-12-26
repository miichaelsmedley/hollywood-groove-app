import {
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from './firebase';

const googleProvider = new GoogleAuthProvider();

/**
 * Sign in with Google.
 * If user is anonymous, link the Google account to preserve data.
 * If user is already signed in with Google, this is a no-op.
 */
export async function signInWithGoogle(): Promise<void> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    // No user at all - regular Google sign-in
    await signInWithPopup(auth, googleProvider);
    return;
  }

  // Check if user is anonymous
  if (currentUser.isAnonymous) {
    // Link anonymous account to Google (preserves user data)
    try {
      await linkWithPopup(currentUser, googleProvider);
    } catch (error: any) {
      // Handle account linking errors
      if (error.code === 'auth/credential-already-in-use') {
        // The Google account is already linked to another account
        // Sign in with that account instead (user data may be lost)
        console.warn('Google account already in use. Switching to existing account.');
        await signInWithPopup(auth, googleProvider);
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed the popup - just ignore
        throw new Error('Sign-in cancelled');
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  } else if (currentUser.providerData.some(p => p.providerId === 'google.com')) {
    // Already signed in with Google - no action needed
    console.log('Already signed in with Google');
  } else {
    // Signed in with another provider - link Google to it
    try {
      await linkWithPopup(currentUser, googleProvider);
    } catch (error: any) {
      if (error.code === 'auth/credential-already-in-use') {
        console.warn('Google account already in use. Switching to existing account.');
        await signInWithPopup(auth, googleProvider);
      } else if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in cancelled');
      } else {
        throw error;
      }
    }
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
