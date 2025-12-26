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

  useEffect(() => {
    // Load user profile from Firebase when auth changes
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setUserProfile(null);
        setIsGoogleUser(false);
        setGooglePhotoURL(null);
        setLoading(false);
        return;
      }

      // Update Google auth state
      setIsGoogleUser(isSignedInWithGoogle());
      setGooglePhotoURL(getGooglePhotoURL());

      // Check if user profile exists in Firebase
      const userRef = ref(db, rtdbPath(`users/${user.uid}`));
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const profile = snapshot.val() as UserProfile;
        setUserProfile(profile);

        // Update display name in auth if changed
        if (user.displayName !== profile.displayName) {
          await updateProfile(user, { displayName: profile.displayName });
        }
      } else {
        // Check localStorage for cached profile
        const cached = localStorage.getItem('userProfile');
        if (cached) {
          const profile = JSON.parse(cached) as UserProfile;
          setUserProfile(profile);
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

    // Save to Firebase
    await set(ref(db, rtdbPath(`users/${user.uid}`)), profile);

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

    await update(ref(db, rtdbPath(`users/${user.uid}`)), updates);

    setUserProfile({ ...userProfile, ...updates });
    localStorage.setItem('userProfile', JSON.stringify({ ...userProfile, ...updates }));
  };

  const addShowAttended = async (showId: string) => {
    const user = auth.currentUser;
    if (!user || !userProfile) return;

    // Don't add duplicates
    if (userProfile.showsAttended.includes(showId)) return;

    const updatedShows = [...userProfile.showsAttended, showId];

    await update(ref(db, rtdbPath(`users/${user.uid}`)), {
      showsAttended: updatedShows,
      lastSeenAt: Date.now(),
    });

    const updated = { ...userProfile, showsAttended: updatedShows, lastSeenAt: Date.now() };
    setUserProfile(updated);
    localStorage.setItem('userProfile', JSON.stringify(updated));
  };

  const handleSignInWithGoogle = async () => {
    await signInWithGoogle();
    // Auth state change will trigger useEffect to update profile
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
