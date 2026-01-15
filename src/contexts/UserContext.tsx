import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { updateProfile } from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types/firebaseContract';
import { signInWithGoogle, signOut as authSignOut, isSignedInWithGoogle, getGooglePhotoURL } from '../lib/auth';

interface UserContextType {
  userProfile: UserProfile | null;
  isRegistered: boolean;
  loading: boolean;
  isGoogleUser: boolean;
  googlePhotoURL: string | null;
  canUseTestMode: boolean;
  authError: string | null;
  isSigningIn: boolean;
  registerUser: (data: RegisterUserData) => Promise<void>;
  updateLastSeen: () => Promise<void>;
  addShowAttended: (showId: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

export interface RegisterUserData {
  displayName: string;
  email?: string;
  phone?: string;
  marketingEmails: boolean;
  marketingSMS: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGoogleUser, setIsGoogleUser] = useState(false);
  const [googlePhotoURL, setGooglePhotoURL] = useState<string | null>(null);
  const [canUseTestMode, setCanUseTestMode] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    console.log('🔍 UserContext: Setting up auth listener');

    // Load user profile from Firebase when auth changes
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      console.log('🔍 UserContext: onAuthStateChanged fired', user ? { uid: user.uid, isAnonymous: user.isAnonymous } : 'null');

      if (!user) {
        setUserProfile(null);
        setIsGoogleUser(false);
        setGooglePhotoURL(null);
        // Keep test access if it was granted via URL code (don't clear hg_test_access)
        const hasLocalTestAccess = localStorage.getItem('hg_test_access') === 'true';
        setCanUseTestMode(hasLocalTestAccess);
        setLoading(false);
        return;
      }

      console.log('Auth state changed:', {
        uid: user.uid,
        isAnonymous: user.isAnonymous,
        providerData: user.providerData,
        displayName: user.displayName,
        email: user.email,
      });

      // Update Google auth state
      setIsGoogleUser(isSignedInWithGoogle());
      setGooglePhotoURL(getGooglePhotoURL());

      // Test mode access can be granted via:
      // 1. URL test code (?testCode=groove2024) - sets hg_test_access in localStorage
      // 2. Firebase /testers/{uid} entry for non-anonymous users
      const hasLocalTestAccess = localStorage.getItem('hg_test_access') === 'true';

      if (hasLocalTestAccess) {
        // Already has test access (from URL code or previous Firebase check)
        setCanUseTestMode(true);
      } else if (!user.isAnonymous) {
        // Check Firebase testers list for non-anonymous users
        try {
          const testerRef = ref(db, `testers/${user.uid}`);
          const testerSnap = await get(testerRef);
          const allowed = Boolean(testerSnap.val());
          setCanUseTestMode(allowed);
          if (allowed) {
            localStorage.setItem('hg_test_access', 'true');
          }
        } catch (error) {
          console.warn('Failed to check test mode access:', error);
          setCanUseTestMode(false);
        }
      } else {
        setCanUseTestMode(false);
      }

      // Check if user profile exists in Firebase (/members/ path per contract)
      const userRef = ref(db, `members/${user.uid}`);
      console.log('Fetching profile from:', `members/${user.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        console.log('Profile exists in Firebase:', snapshot.val());
        const rawProfile = snapshot.val();

        // Handle both snake_case (MemberProfile from Controller/new saves)
        // and camelCase (old UserProfile format)
        const displayName = rawProfile.display_name || rawProfile.displayName || user.displayName || 'Guest';
        const createdAt = rawProfile.created_at || rawProfile.createdAt || Date.now();
        const emailOptIn = rawProfile.email_opt_in ?? rawProfile.preferences?.marketingEmails ?? false;
        const smsOptIn = rawProfile.sms_opt_in ?? rawProfile.preferences?.marketingSMS ?? false;

        // Normalize to UserProfile format for PWA state
        const normalizedProfile: UserProfile = {
          uid: user.uid,
          displayName,
          email: rawProfile.email,
          phone: rawProfile.phone,
          createdAt,
          lastSeenAt: rawProfile.lastSeenAt || Date.now(),
          showsAttended: rawProfile.showsAttended || rawProfile.shows ? Object.keys(rawProfile.shows) : [],
          preferences: {
            marketingEmails: emailOptIn,
            marketingSMS: smsOptIn,
            notifications: rawProfile.preferences?.notifications ?? true,
          },
        };

        console.log('Normalized profile:', normalizedProfile);
        setUserProfile(normalizedProfile);
        // Save to localStorage with current UID
        localStorage.setItem('userProfile', JSON.stringify(normalizedProfile));

        // Update display name in auth if changed
        if (user.displayName !== normalizedProfile.displayName) {
          await updateProfile(user, { displayName: normalizedProfile.displayName });
        }
      } else {
        console.log('🔍 Profile does NOT exist in Firebase for UID:', user.uid);
        // Check localStorage for cached profile ONLY if UID matches
        const cached = localStorage.getItem('userProfile');
        console.log('🔍 Checking localStorage cache:', cached ? 'found' : 'not found');
        if (cached) {
          const profile = JSON.parse(cached) as UserProfile;
          console.log('🔍 Cached profile UID:', profile.uid, 'Current UID:', user.uid);
          // Verify UID matches - if not, clear stale cache
          if (profile.uid === user.uid) {
            console.log('🔍 UID matches, using cached profile');
            setUserProfile(profile);
          } else {
            console.warn('🔍 UID mismatch in cached profile, clearing cache');
            localStorage.removeItem('userProfile');
            setUserProfile(null);
          }
        } else {
          console.log('🔍 No cached profile, user not registered');
          setUserProfile(null);
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const registerUser = async (data: RegisterUserData) => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const authProvider =
      user.providerData?.[0]?.providerId || (user.isAnonymous ? 'anonymous' : 'unknown');

    // Build profile in MemberProfile format (snake_case) for Firebase
    // This matches what the Controller expects
    const firebaseProfile = {
      display_name: data.displayName,
      created_at: Date.now(),
      auth_provider: authProvider,
      stars: {
        total: 0,
        tier: 'extra',
        starting_bonus: 0,
        breakdown: {
          shows_attended: 0,
          trivia_participated: 0,
          dancing_engaged: 0,
          stage_participation: 0,
          between_show_trivia: 0,
          referrals: 0,
          early_tickets: 0,
          social_shares: 0,
          feedback_given: 0,
        },
      },
      email_opt_in: data.marketingEmails,
      sms_opt_in: data.marketingSMS,
      ...(data.email && { email: data.email }),
      ...(data.phone && { phone: data.phone }),
    };

    // Save to Firebase (/members/ path per contract)
    console.log('📝 Writing member profile to Firebase:', `members/${user.uid}`);
    console.log('📝 Profile data:', JSON.stringify(firebaseProfile, null, 2));
    try {
      await set(ref(db, `members/${user.uid}`), firebaseProfile);
      console.log('✅ Member profile saved to Firebase successfully');
    } catch (firebaseError) {
      console.error('❌ Firebase write failed:', firebaseError);
      throw firebaseError; // Re-throw so the UI shows error
    }

    // Build local profile in UserProfile format (camelCase) for PWA state
    const localProfile: UserProfile = {
      uid: user.uid,
      displayName: data.displayName,
      ...(data.email && { email: data.email }),
      ...(data.phone && { phone: data.phone }),
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      showsAttended: [],
      preferences: {
        marketingEmails: data.marketingEmails,
        marketingSMS: data.marketingSMS,
        notifications: true,
      },
    };

    // Save to localStorage
    localStorage.setItem('userProfile', JSON.stringify(localProfile));

    // Update auth profile
    await updateProfile(user, { displayName: data.displayName });

    setUserProfile(localProfile);
  };

  const updateLastSeen = async () => {
    const user = auth.currentUser;
    if (!user || !userProfile) return;

    const updates = {
      lastSeenAt: Date.now(),
    };

    await update(ref(db, `members/${user.uid}`), updates);

    setUserProfile({ ...userProfile, ...updates });
    localStorage.setItem('userProfile', JSON.stringify({ ...userProfile, ...updates }));
  };

  const addShowAttended = async (showId: string) => {
    const user = auth.currentUser;
    if (!user || !userProfile) return;

    // Ensure showsAttended exists (might be undefined from controller-created profiles)
    const currentShows = userProfile.showsAttended || [];

    // Don't add duplicates
    if (currentShows.includes(showId)) return;

    const updatedShows = [...currentShows, showId];

    await update(ref(db, `members/${user.uid}`), {
      showsAttended: updatedShows,
      lastSeenAt: Date.now(),
    });

    const updated = { ...userProfile, showsAttended: updatedShows, lastSeenAt: Date.now() };
    setUserProfile(updated);
    localStorage.setItem('userProfile', JSON.stringify(updated));
  };

  const handleSignInWithGoogle = async () => {
    // Clear any previous error
    setAuthError(null);
    setIsSigningIn(true);

    try {
      const success = await signInWithGoogle();

      if (success) {
        // Sign-in/link was successful (popup completed)
        // Manually update state since onAuthStateChanged may not fire for linking
        const currentUser = auth.currentUser;
        if (currentUser) {
          await currentUser.reload();
          setIsGoogleUser(isSignedInWithGoogle());
          setGooglePhotoURL(getGooglePhotoURL());
          console.log('✅ Google auth state updated after successful link:', {
            isGoogleUser: isSignedInWithGoogle(),
            providerData: auth.currentUser?.providerData,
          });
        }
      }
      // If success is false, a redirect was initiated - state will update on return
    } catch (error: any) {
      console.error('❌ Google sign-in error:', error);

      // Provide user-friendly error messages
      if (error.message === 'Sign-in cancelled') {
        // User cancelled, not really an error - don't show message
        console.log('User cancelled sign-in');
      } else if (error.code === 'auth/network-request-failed') {
        setAuthError('Network error. Please check your connection and try again.');
      } else if (error.code === 'auth/too-many-requests') {
        setAuthError('Too many attempts. Please wait a moment and try again.');
      } else if (error.code === 'auth/popup-blocked') {
        // This shouldn't happen as we fall back to redirect, but just in case
        setAuthError('Popup was blocked. Please allow popups or try again.');
      } else {
        setAuthError('Sign-in failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  const handleSignOut = async () => {
    // Clear cached profile
    localStorage.removeItem('userProfile');
    await authSignOut();
    // Auth state change will trigger useEffect to reset state
  };

  return (
    <UserContext.Provider
      value={{
        userProfile,
        isRegistered: !!userProfile,
        loading,
        isGoogleUser,
        googlePhotoURL,
        canUseTestMode,
        authError,
        isSigningIn,
        registerUser,
        updateLastSeen,
        addShowAttended,
        signInWithGoogle: handleSignInWithGoogle,
        signOut: handleSignOut,
        clearAuthError,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within UserProvider');
  }
  return context;
}
