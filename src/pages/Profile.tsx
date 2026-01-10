import { Link } from 'react-router-dom';
import { Mail, Phone, User, CheckCircle, AlertCircle, Settings, LogOut } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { IS_TEST_MODE, isAdminEmail } from '../lib/mode';
import { auth } from '../lib/firebase';
import { useState } from 'react';

export default function Profile() {
  const { userProfile, loading, isRegistered, isGoogleUser, googlePhotoURL, signInWithGoogle, signOut } = useUser();
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      // Don't show alert for user-cancelled sign-in
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
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="text-cinema-500 text-sm">Manage your details</p>
        </div>
        <Settings className="w-6 h-6 text-primary" />
      </div>

      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-4">
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
        </div>
      </div>

      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-3">
        <div className="text-sm font-semibold text-cinema-800">Preferences</div>
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
      </div>

      {/* Google Sign-In Section */}
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
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </button>

            <p className="text-xs text-cinema-500 text-center">
              Your anonymous data will be linked to your Google account
            </p>
          </div>
        )}
      </div>

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

