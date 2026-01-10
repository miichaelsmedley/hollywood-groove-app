import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { updateProfile } from 'firebase/auth';
import { ref, set, get, update } from 'firebase/database';
import { auth, db, rtdbPath } from '../lib/firebase';
import { UserProfile } from '../types/firebaseContract';
import { signInWithGoogle, signOut as authSignOut, isSignedInWithGoogle, getGooglePhotoURL } from '../lib/auth';

interface UserContextType {
  userProfile: UserProfile | null;
  isRegistered: boolean;
  loading: boolean;
  isGoogleUser: boolean;
  googlePhotoURL: string | null;
  canUseTestMode: boolean;
  registerUser: (data: RegisterUserData) => Promise<void>;
  updateLastSeen: () => Promise<void>;
  addShowAttended: (showId: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
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

  useEffect(() => {
    // Load user profile from Firebase when auth changes
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
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
      const userRef = ref(db, rtdbPath(`members/${user.uid}`));
      console.log('Fetching profile from:', rtdbPath(`members/${user.uid}`));
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        console.log('Profile exists in Firebase:', snapshot.val());
        const profile = snapshot.val() as UserProfile;

        // Ensure required fields exist (for profiles created by controller)
        const normalizedProfile: UserProfile = {
          ...profile,
          uid: user.uid,
          showsAttended: profile.showsAttended || [],
          preferences: profile.preferences || {
            marketingEmails: false,
            marketingSMS: false,
            notifications: true,
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
        console.log('Profile does NOT exist in Firebase');
        // Check localStorage for cached profile ONLY if UID matches
        const cached = localStorage.getItem('userProfile');
        if (cached) {
          const profile = JSON.parse(cached) as UserProfile;
          // Verify UID matches - if not, clear stale cache
          if (profile.uid === user.uid) {
            setUserProfile(profile);
          } else {
            console.warn('UID mismatch in cached profile, clearing cache');
            localStorage.removeItem('userProfile');
            setUserProfile(null);
          }
        } else {
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

    // Build profile object, only including email/phone if provided
    const profile: UserProfile = {
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

    // Save to Firebase (/members/ path per contract)
    await set(ref(db, rtdbPath(`members/${user.uid}`)), profile);

    // Save to localStorage
    localStorage.setItem('userProfile', JSON.stringify(profile));

    // Update auth profile
    await updateProfile(user, { displayName: data.displayName });

    setUserProfile(profile);
  };

  const updateLastSeen = async () => {
    const user = auth.currentUser;
    if (!user || !userProfile) return;

    const updates = {
      lastSeenAt: Date.now(),
    };

    await update(ref(db, rtdbPath(`members/${user.uid}`)), updates);

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

    await update(ref(db, rtdbPath(`members/${user.uid}`)), {
      showsAttended: updatedShows,
      lastSeenAt: Date.now(),
    });

    const updated = { ...userProfile, showsAttended: updatedShows, lastSeenAt: Date.now() };
    setUserProfile(updated);
    localStorage.setItem('userProfile', JSON.stringify(updated));
  };

  const handleSignInWithGoogle = async () => {
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
        registerUser,
        updateLastSeen,
        addShowAttended,
        signInWithGoogle: handleSignInWithGoogle,
        signOut: handleSignOut,
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
