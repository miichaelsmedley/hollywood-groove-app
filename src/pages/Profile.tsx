import { Link } from 'react-router-dom';
import {
  Mail, Phone, User, CheckCircle, AlertCircle, LogOut,
  Edit3, Save, X, MapPin, Instagram, Loader2, Facebook, Youtube
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { IS_TEST_MODE, isAdminEmail } from '../lib/mode';
import { auth } from '../lib/firebase';
import { useState, useEffect } from 'react';
import type { SocialLinks } from '../types/firebaseContract';

// TikTok icon component (not in lucide-react)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

// X (Twitter) icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

// Threads icon
function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.704 2.043-1.135 3.553-1.282.898-.088 1.814-.078 2.734.032l.007-.017c-.006-.904-.157-1.614-.449-2.11-.353-.6-.947-.898-1.767-.898h-.034c-.659.007-1.195.183-1.596.523-.39.333-.66.802-.807 1.395l-1.992-.466c.217-.872.654-1.622 1.302-2.228.82-.766 1.865-1.155 3.107-1.155h.043c1.467.016 2.588.542 3.335 1.562.67.917.996 2.142 1.002 3.75.35.157.687.33 1.01.523 1.137.682 1.98 1.574 2.507 2.653.728 1.49.842 3.883-.849 5.54-1.793 1.756-4.016 2.548-7.205 2.572zm-1.248-6.63c-.72.038-1.263.222-1.617.547-.326.299-.48.653-.459 1.052.044.788.717 1.496 2.05 1.496.048 0 .097-.001.146-.003 1.433-.077 2.303-1.072 2.586-2.955-.879-.152-1.792-.197-2.706-.137z"/>
    </svg>
  );
}

// Spotify icon
function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
}

// Social platform configuration with deep links
const SOCIAL_PLATFORMS = [
  {
    key: 'instagram',
    label: 'Instagram',
    Icon: Instagram,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/20',
    placeholder: 'username',
    deepLink: (u: string) => `instagram://user?username=${u}`,
    webUrl: (u: string) => `https://instagram.com/${u}`,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    Icon: TikTokIcon,
    color: 'text-cinema-800',
    bgColor: 'bg-cinema-300',
    placeholder: 'username',
    deepLink: (u: string) => `tiktok://user?username=${u}`,
    webUrl: (u: string) => `https://tiktok.com/@${u}`,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    Icon: Facebook,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/20',
    placeholder: 'username',
    deepLink: (u: string) => `fb://profile/${u}`,
    webUrl: (u: string) => `https://facebook.com/${u}`,
  },
  {
    key: 'twitter',
    label: 'X',
    Icon: XIcon,
    color: 'text-cinema-800',
    bgColor: 'bg-cinema-300',
    placeholder: 'username',
    deepLink: (u: string) => `twitter://user?screen_name=${u}`,
    webUrl: (u: string) => `https://x.com/${u}`,
  },
  {
    key: 'threads',
    label: 'Threads',
    Icon: ThreadsIcon,
    color: 'text-cinema-800',
    bgColor: 'bg-cinema-300',
    placeholder: 'username',
    deepLink: (u: string) => `barcelona://user?username=${u}`, // Threads app scheme
    webUrl: (u: string) => `https://threads.net/@${u}`,
  },
  {
    key: 'youtube',
    label: 'YouTube',
    Icon: Youtube,
    color: 'text-red-500',
    bgColor: 'bg-red-500/20',
    placeholder: '@handle or URL',
    deepLink: (u: string) => `youtube://www.youtube.com/@${u}`,
    webUrl: (u: string) => u.startsWith('http') ? u : `https://youtube.com/@${u}`,
  },
  {
    key: 'spotify',
    label: 'Spotify',
    Icon: SpotifyIcon,
    color: 'text-green-500',
    bgColor: 'bg-green-500/20',
    placeholder: 'profile URL',
    deepLink: (u: string) => u.startsWith('http') ? u.replace('https://open.spotify.com', 'spotify://') : `spotify://user/${u}`,
    webUrl: (u: string) => u.startsWith('http') ? u : `https://open.spotify.com/user/${u}`,
  },
] as const;

// Helper to open social profile with deep link fallback
function openSocialProfile(platform: typeof SOCIAL_PLATFORMS[number], username: string) {
  const deepLink = platform.deepLink(username);
  const webUrl = platform.webUrl(username);

  // Try deep link first, fall back to web URL
  const start = Date.now();
  window.location.href = deepLink;

  // If we're still here after 1.5s, the app didn't open - use web URL
  setTimeout(() => {
    if (Date.now() - start < 2000) {
      window.open(webUrl, '_blank');
    }
  }, 1500);
}

export default function Profile() {
  const {
    userProfile,
    loading,
    isRegistered,
    isGoogleUser,
    googlePhotoURL,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    checkDisplayNameAvailable,
    getSuggestedDisplayNames,
  } = useUser();

  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Edit form state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSuburb, setEditSuburb] = useState('');
  const [editSocials, setEditSocials] = useState<SocialLinks>({});
  const [editPreferences, setEditPreferences] = useState({
    marketingEmails: false,
    marketingSMS: false,
    notifications: true,
  });

  // Nickname validation state
  const [checkingName, setCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([]);

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditing && userProfile) {
      setEditDisplayName(userProfile.displayName || '');
      setEditPhone(userProfile.phone || '');
      setEditSuburb(userProfile.suburb || '');
      setEditSocials(userProfile.socials || {});
      setEditPreferences({
        marketingEmails: userProfile.preferences?.marketingEmails || false,
        marketingSMS: userProfile.preferences?.marketingSMS || false,
        notifications: userProfile.preferences?.notifications ?? true,
      });
      setNameAvailable(null);
      setNameSuggestions([]);
      setSaveError(null);
    }
  }, [isEditing, userProfile]);

  // Check display name availability with debounce
  useEffect(() => {
    if (!isEditing || !editDisplayName.trim()) {
      setNameAvailable(null);
      setNameSuggestions([]);
      return;
    }

    // Don't check if name hasn't changed
    if (editDisplayName.trim() === userProfile?.displayName) {
      setNameAvailable(true);
      setNameSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingName(true);
      const available = await checkDisplayNameAvailable(editDisplayName.trim());
      setNameAvailable(available);

      if (!available) {
        const suggestions = await getSuggestedDisplayNames(editDisplayName.trim());
        setNameSuggestions(suggestions);
      } else {
        setNameSuggestions([]);
      }
      setCheckingName(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [editDisplayName, isEditing, userProfile?.displayName, checkDisplayNameAvailable, getSuggestedDisplayNames]);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error?.message !== 'Sign-in cancelled') {
        alert('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    if (!confirm('Sign out? You\'ll be signed back in anonymously and can re-link your Google account anytime.')) {
      return;
    }
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };

  const handleSave = async () => {
    if (!editDisplayName.trim()) {
      setSaveError('Nickname is required');
      return;
    }

    if (nameAvailable === false) {
      setSaveError('Please choose a different nickname');
      return;
    }

    setSaving(true);
    setSaveError(null);

    const result = await updateUserProfile({
      displayName: editDisplayName.trim(),
      phone: editPhone.trim() || undefined,
      suburb: editSuburb.trim() || undefined,
      socials: editSocials,
      preferences: editPreferences,
    });

    setSaving(false);

    if (result.success) {
      setIsEditing(false);
    } else {
      setSaveError(result.error || 'Failed to save');
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSaveError(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[55vh]">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-cinema-500 font-medium">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!isRegistered || !userProfile) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-cinema-50 border border-cinema-200 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-cinema-500 text-sm">
            You're not registered yet. Join a show to set up your profile.
          </p>
        </div>

        {/* Google Sign-In Section - Show even when not registered */}
        {!isGoogleUser && (
          <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-4">
            <div className="text-sm font-semibold text-cinema-800">Sign in with Google</div>
            <p className="text-sm text-cinema-600">
              Sign in with Google to save your progress across devices and access leaderboard features.
            </p>

            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-md transition flex items-center justify-center gap-3 disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <p className="text-xs text-cinema-500 text-center">
              Sign in now or later when you join a show
            </p>
          </div>
        )}

        {isGoogleUser && (
          <div className="bg-accent-green/10 border border-accent-green/30 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              {googlePhotoURL && (
                <img
                  src={googlePhotoURL}
                  alt="Google profile"
                  className="w-10 h-10 rounded-full border-2 border-accent-green/30"
                />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium text-cinema-800">Signed in with Google</div>
                <div className="text-xs text-cinema-600">Ready to join shows!</div>
              </div>
              <CheckCircle className="w-5 h-5 text-accent-green" />
            </div>
          </div>
        )}

        <Link to="/join" className="block w-full btn-primary text-center">
          Join current show
        </Link>
      </div>
    );
  }

  // Registered user view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-cinema-500 text-sm">
            {isEditing ? 'Edit your details' : 'Manage your details'}
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition"
          >
            <Edit3 className="w-4 h-4" />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 px-3 py-2 rounded-xl border border-cinema-300 text-cinema-600 font-semibold hover:bg-cinema-50 transition disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || nameAvailable === false}
              className="flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 transition disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
          </div>
        )}
      </div>

      {/* Save Error */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
          {saveError}
        </div>
      )}

      {/* Basic Info Card */}
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-4">
        {isEditing ? (
          // Edit mode
          <div className="space-y-4">
            {/* Nickname */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-cinema-700">
                <User className="w-4 h-4 text-primary" />
                Nickname
              </label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                maxLength={30}
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white text-gray-900 transition focus:outline-none ${
                  nameAvailable === false
                    ? 'border-red-300 focus:border-red-400'
                    : nameAvailable === true
                    ? 'border-green-300 focus:border-green-400'
                    : 'border-cinema-200 focus:border-primary'
                }`}
                placeholder="Your display name"
              />
              {/* Name availability indicator */}
              {checkingName && (
                <p className="text-xs text-cinema-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Checking availability...
                </p>
              )}
              {!checkingName && nameAvailable === false && (
                <div className="space-y-2">
                  <p className="text-xs text-red-600">This nickname is already taken</p>
                  {nameSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs text-cinema-500">Try:</span>
                      {nameSuggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => setEditDisplayName(suggestion)}
                          className="text-xs px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!checkingName && nameAvailable === true && editDisplayName !== userProfile.displayName && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Available!
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-cinema-700">
                <Phone className="w-4 h-4 text-primary" />
                Mobile (optional)
              </label>
              <input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-cinema-200 bg-white text-gray-900 focus:border-primary focus:outline-none transition"
                placeholder="0400 000 000"
              />
            </div>

            {/* Suburb */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-cinema-700">
                <MapPin className="w-4 h-4 text-primary" />
                Area / Suburb (optional)
              </label>
              <input
                type="text"
                value={editSuburb}
                onChange={(e) => setEditSuburb(e.target.value)}
                maxLength={50}
                className="w-full px-4 py-3 rounded-xl border-2 border-cinema-200 bg-white text-gray-900 focus:border-primary focus:outline-none transition"
                placeholder="e.g. St Kilda, Melbourne"
              />
              <p className="text-xs text-cinema-500">Helps us bring shows closer to you</p>
            </div>
          </div>
        ) : (
          // View mode
          <>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">{userProfile.displayName}</div>
                <div className="text-xs text-cinema-500">Player profile</div>
              </div>
              <CheckCircle className="w-5 h-5 text-accent-green ml-auto" />
            </div>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-cinema-700">
                  <Mail className="w-4 h-4 text-primary" />
                  <span>Email</span>
                </div>
                <span className="text-sm text-cinema-800 truncate max-w-[60%]">
                  {userProfile.email ?? '—'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-cinema-700">
                  <Phone className="w-4 h-4 text-primary" />
                  <span>Mobile</span>
                </div>
                <span className="text-sm text-cinema-800 truncate max-w-[60%]">
                  {userProfile.phone ?? '—'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-cinema-700">
                  <MapPin className="w-4 h-4 text-primary" />
                  <span>Area</span>
                </div>
                <span className="text-sm text-cinema-800 truncate max-w-[60%]">
                  {userProfile.suburb ?? '—'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Social Links Card */}
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-cinema-800">Social Links</div>
          {!isEditing && (
            <span className="text-xs text-cinema-500">Tap edit to add</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            {/* Icon grid for selecting platforms */}
            <div className="grid grid-cols-7 gap-2">
              {SOCIAL_PLATFORMS.map(({ key, label, Icon, color, bgColor }) => {
                const isActive = !!editSocials[key as keyof SocialLinks];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (isActive) {
                        // Remove the social
                        const updated = { ...editSocials };
                        delete updated[key as keyof SocialLinks];
                        setEditSocials(updated);
                      } else {
                        // Add empty to show input
                        setEditSocials({ ...editSocials, [key]: '' });
                      }
                    }}
                    className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? `${bgColor} ring-2 ring-primary`
                        : 'bg-cinema-100 hover:bg-cinema-200'
                    }`}
                    title={label}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? color : 'text-cinema-400'}`} />
                    {isActive && (
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
                        <CheckCircle className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Input fields for active platforms */}
            <div className="space-y-3">
              {SOCIAL_PLATFORMS.filter(({ key }) => editSocials[key as keyof SocialLinks] !== undefined).map(({ key, Icon, color, placeholder }) => (
                <div key={key} className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${color} flex-shrink-0`} />
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={editSocials[key as keyof SocialLinks] || ''}
                      onChange={(e) => setEditSocials({ ...editSocials, [key]: e.target.value.replace('@', '') })}
                      className="w-full px-3 py-2 rounded-lg border border-cinema-200 bg-white text-gray-900 focus:border-primary focus:outline-none transition text-sm"
                      placeholder={placeholder}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const updated = { ...editSocials };
                      delete updated[key as keyof SocialLinks];
                      setEditSocials(updated);
                    }}
                    className="p-1.5 rounded-lg hover:bg-cinema-100 transition"
                  >
                    <X className="w-4 h-4 text-cinema-500" />
                  </button>
                </div>
              ))}
            </div>

            {Object.keys(editSocials).length === 0 && (
              <p className="text-sm text-cinema-500 text-center py-2">
                Tap an icon above to add your social links
              </p>
            )}

            <p className="text-xs text-cinema-500">
              Share your show moments and earn bonus stars!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Connected socials as clickable buttons - opens native app */}
            {Object.keys(userProfile.socials || {}).filter(key => userProfile.socials?.[key as keyof SocialLinks]).length > 0 ? (
              <>
                <p className="text-xs text-cinema-500">Tap to open in app</p>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_PLATFORMS.filter(({ key }) => userProfile.socials?.[key as keyof SocialLinks]).map((platform) => {
                    const username = userProfile.socials?.[platform.key as keyof SocialLinks];
                    if (!username) return null;
                    return (
                      <button
                        key={platform.key}
                        onClick={() => openSocialProfile(platform, username)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl ${platform.bgColor} hover:opacity-80 active:scale-95 transition-all`}
                      >
                        <platform.Icon className={`w-4 h-4 ${platform.color}`} />
                        <span className="text-sm text-cinema-800">@{username}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center gap-3 py-4 border-2 border-dashed border-cinema-200 rounded-xl">
                <div className="flex gap-1 opacity-40">
                  <Instagram className="w-5 h-5" />
                  <TikTokIcon className="w-5 h-5" />
                  <XIcon className="w-5 h-5" />
                </div>
                <p className="text-sm text-cinema-500">
                  No socials linked yet
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preferences Card */}
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold text-cinema-800">Preferences</div>

        {isEditing ? (
          <div className="space-y-3">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-cinema-700">Email updates about shows</span>
              <input
                type="checkbox"
                checked={editPreferences.marketingEmails}
                onChange={(e) => setEditPreferences({ ...editPreferences, marketingEmails: e.target.checked })}
                className="w-5 h-5 rounded border-cinema-300 text-primary focus:ring-primary"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-cinema-700">SMS reminders</span>
              <input
                type="checkbox"
                checked={editPreferences.marketingSMS}
                onChange={(e) => setEditPreferences({ ...editPreferences, marketingSMS: e.target.checked })}
                className="w-5 h-5 rounded border-cinema-300 text-primary focus:ring-primary"
              />
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-cinema-700">Push notifications</span>
              <input
                type="checkbox"
                checked={editPreferences.notifications}
                onChange={(e) => setEditPreferences({ ...editPreferences, notifications: e.target.checked })}
                className="w-5 h-5 rounded border-cinema-300 text-primary focus:ring-primary"
              />
            </label>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-cinema-700">
            <div className="flex items-center justify-between">
              <span>Opt-in updates</span>
              <span className="text-cinema-800 font-semibold">
                {userProfile.preferences.marketingEmails || userProfile.preferences.marketingSMS ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Notifications</span>
              <span className="text-cinema-800 font-semibold">
                {userProfile.preferences.notifications ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Google Sign-In Section */}
      {!isEditing && (
        <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-4">
          <div className="text-sm font-semibold text-cinema-800">Account</div>

          {isGoogleUser ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {googlePhotoURL && (
                  <img
                    src={googlePhotoURL}
                    alt="Google profile"
                    className="w-10 h-10 rounded-full border-2 border-primary/30"
                  />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium text-cinema-800">Signed in with Google</div>
                  <div className="text-xs text-cinema-600">Your progress is saved to your Google account</div>
                </div>
                <CheckCircle className="w-5 h-5 text-accent-green" />
              </div>

              <button
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-gray-400 hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-cinema-600">
                Sign in with Google to save your progress across devices and access leaderboard features.
              </p>

              <button
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-md transition flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {signingIn ? 'Signing in...' : 'Sign in with Google'}
              </button>

              <p className="text-xs text-cinema-500 text-center">
                Your anonymous data will be linked to your Google account
              </p>
            </div>
          )}
        </div>
      )}

      {IS_TEST_MODE && isAdminEmail(auth.currentUser?.email) && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold text-amber-900">Admin Testing</div>
          <div className="text-sm text-amber-800">
            Mode: <code className="px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-mono text-xs">Single path (no prefix)</code>
          </div>
          <Link
            to="/__testing/firebase"
            className="block w-full px-6 py-3 rounded-xl border border-amber-400 bg-white text-amber-900 font-semibold hover:bg-amber-100 transition text-center"
          >
            Open Firebase diagnostics
          </Link>
        </div>
      )}
    </div>
  );
}
