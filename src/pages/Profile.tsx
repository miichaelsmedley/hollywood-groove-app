import { Link } from 'react-router-dom';
import {
  Mail, Phone, User, CheckCircle, AlertCircle, Settings, LogOut,
  Edit3, Save, X, MapPin, Instagram, Plus, Loader2
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
                className={`w-full px-4 py-3 rounded-xl border-2 bg-white transition focus:outline-none ${
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
                className="w-full px-4 py-3 rounded-xl border-2 border-cinema-200 bg-white focus:border-primary focus:outline-none transition"
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
                className="w-full px-4 py-3 rounded-xl border-2 border-cinema-200 bg-white focus:border-primary focus:outline-none transition"
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
        <div className="text-sm font-semibold text-cinema-800">Social Links</div>

        {isEditing ? (
          <div className="space-y-3">
            {/* Instagram */}
            <div className="flex items-center gap-3">
              <Instagram className="w-5 h-5 text-pink-600 flex-shrink-0" />
              <input
                type="text"
                value={editSocials.instagram || ''}
                onChange={(e) => setEditSocials({ ...editSocials, instagram: e.target.value.replace('@', '') })}
                className="flex-1 px-3 py-2 rounded-lg border border-cinema-200 bg-white focus:border-primary focus:outline-none transition text-sm"
                placeholder="username"
              />
            </div>

            {/* TikTok */}
            <div className="flex items-center gap-3">
              <TikTokIcon className="w-5 h-5 text-cinema-800 flex-shrink-0" />
              <input
                type="text"
                value={editSocials.tiktok || ''}
                onChange={(e) => setEditSocials({ ...editSocials, tiktok: e.target.value.replace('@', '') })}
                className="flex-1 px-3 py-2 rounded-lg border border-cinema-200 bg-white focus:border-primary focus:outline-none transition text-sm"
                placeholder="username"
              />
            </div>

            <p className="text-xs text-cinema-500">
              Connect your socials to share your show moments
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {userProfile.socials?.instagram && (
              <div className="flex items-center gap-2 text-sm">
                <Instagram className="w-4 h-4 text-pink-600" />
                <span className="text-cinema-700">@{userProfile.socials.instagram}</span>
              </div>
            )}
            {userProfile.socials?.tiktok && (
              <div className="flex items-center gap-2 text-sm">
                <TikTokIcon className="w-4 h-4 text-cinema-800" />
                <span className="text-cinema-700">@{userProfile.socials.tiktok}</span>
              </div>
            )}
            {!userProfile.socials?.instagram && !userProfile.socials?.tiktok && (
              <p className="text-sm text-cinema-500 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add your social links
              </p>
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
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 space-y-3">
          <div className="text-sm font-semibold text-cinema-800">Testing</div>
          <div className="text-sm text-cinema-700">
            Mode: <code className="text-primary">Single path (no prefix)</code>
          </div>
          <Link
            to="/__testing/firebase"
            className="block w-full px-6 py-3 rounded-xl border border-primary/40 bg-cinema-50 text-cinema-900 font-semibold hover:border-primary transition text-center"
          >
            Open Firebase diagnostics
          </Link>
        </div>
      )}
    </div>
  );
}
