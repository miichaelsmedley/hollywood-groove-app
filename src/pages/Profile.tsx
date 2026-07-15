import { Link, useSearchParams } from 'react-router-dom';
import {
  Mail, Phone, User, CheckCircle, AlertCircle, LogOut,
  Edit3, Save, X, MapPin, Instagram, Loader2, Facebook, Youtube,
  Camera, RotateCcw
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useState, useEffect, useRef, useCallback } from 'react';
import StaffToolsCard from '../components/StaffToolsCard';
import type { SocialLinks } from '../types/firebaseContract';
import md5 from 'md5';
import { Ticket } from 'lucide-react';
import EmailLinkSignIn from '../features/auth/EmailLinkSignIn';
import { TikTokIcon, XIcon, ThreadsIcon, SpotifyIcon } from '../components/icons/SocialIcons';
import Spinner from '../components/ui/Spinner';
import GoogleSignInButton from '../components/ui/GoogleSignInButton';
import ProfileOfferClaims from '../components/offers/ProfileOfferClaims';

// Social brand icons moved to components/icons/SocialIcons (imported above).

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

// Generate Gravatar URL from email
function getGravatarUrl(email: string | undefined, size = 200): string | null {
  if (!email) return null;
  const hash = md5(email.trim().toLowerCase());
  return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

// Profile Picture Picker Component
interface ProfilePicturePickerProps {
  currentPhotoURL?: string;
  googlePhotoURL?: string | null;
  email?: string;
  onPhotoChange: (url: string | undefined) => void;
  onClose: () => void;
}

function ProfilePicturePicker({
  currentPhotoURL,
  googlePhotoURL,
  email,
  onPhotoChange,
  onClose,
}: ProfilePicturePickerProps) {
  const [mode, setMode] = useState<'select' | 'camera'>('select');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [gravatarExists, setGravatarExists] = useState<boolean | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const gravatarUrl = getGravatarUrl(email);

  // Check if Gravatar exists
  useEffect(() => {
    if (!gravatarUrl) {
      setGravatarExists(false);
      return;
    }

    const img = new window.Image();
    img.onload = () => setGravatarExists(true);
    img.onerror = () => setGravatarExists(false);
    img.src = gravatarUrl;
  }, [gravatarUrl]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      setCameraReady(false);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
        setMode('camera');
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Could not access camera. Please allow camera permissions.');
    }
  }, [facingMode]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setMode('select');
  }, []);

  // Flip camera
  const flipCamera = useCallback(async () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: newMode },
      audio: false,
    });

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
  }, [facingMode]);

  // Capture photo
  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Square crop for profile pic
    const size = Math.min(video.videoWidth, video.videoHeight);
    const sourceX = (video.videoWidth - size) / 2;
    const sourceY = (video.videoHeight - size) / 2;

    canvas.width = 400;
    canvas.height = 400;

    // Mirror for front camera
    if (facingMode === 'user') {
      ctx.translate(400, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, sourceX, sourceY, size, size, 0, 0, 400, 400);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    onPhotoChange(imageData);
    stopCamera();
    onClose();
  }, [facingMode, onPhotoChange, stopCamera, onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Camera preview */}
        <div className="flex-1 relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />

          {/* Square frame guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-64 h-64 border-4 border-white/50 rounded-full" />
          </div>
        </div>

        {/* Controls */}
        <div className="bg-black p-6 flex items-center justify-center gap-8">
          <button
            onClick={stopCamera}
            className="p-3 rounded-full bg-white/20"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <button
            onClick={capturePhoto}
            disabled={!cameraReady}
            className="w-16 h-16 rounded-full bg-white border-4 border-primary disabled:opacity-50"
          />

          <button
            onClick={flipCamera}
            className="p-3 rounded-full bg-white/20"
          >
            <RotateCcw className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="p-4 border-b border-cinema-200 flex items-center justify-between">
          <h3 className="font-bold text-lg">Profile Picture</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-cinema-100">
            <X className="w-5 h-5 text-cinema-500" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* Current photo preview */}
          <div className="flex justify-center mb-4">
            <div className="w-24 h-24 rounded-full bg-cinema-100 border-2 border-cinema-200 overflow-hidden flex items-center justify-center">
              {currentPhotoURL ? (
                <img src={currentPhotoURL} alt="Current" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-cinema-400" />
              )}
            </div>
          </div>

          {/* Take selfie option */}
          <button
            onClick={startCamera}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-cinema-200 hover:bg-cinema-50 transition"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <span className="font-medium">Take a selfie</span>
          </button>

          {cameraError && (
            <p className="text-sm text-red-600">{cameraError}</p>
          )}

          {/* Use Google photo option */}
          {googlePhotoURL && (
            <button
              onClick={() => {
                onPhotoChange(googlePhotoURL);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-cinema-200 hover:bg-cinema-50 transition"
            >
              <img src={googlePhotoURL} alt="Google" className="w-10 h-10 rounded-full" />
              <span className="font-medium">Use Google photo</span>
              {currentPhotoURL === googlePhotoURL && (
                <CheckCircle className="w-5 h-5 text-accent-green ml-auto" />
              )}
            </button>
          )}

          {/* Use Gravatar option */}
          {gravatarExists && gravatarUrl && (
            <button
              onClick={() => {
                onPhotoChange(gravatarUrl);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-cinema-200 hover:bg-cinema-50 transition"
            >
              <img src={gravatarUrl} alt="Gravatar" className="w-10 h-10 rounded-full" />
              <span className="font-medium">Use Gravatar</span>
              {currentPhotoURL === gravatarUrl && (
                <CheckCircle className="w-5 h-5 text-accent-green ml-auto" />
              )}
            </button>
          )}

          {/* Remove photo option */}
          {currentPhotoURL && (
            <button
              onClick={() => {
                onPhotoChange(undefined);
                onClose();
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition"
            >
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <X className="w-5 h-5" />
              </div>
              <span className="font-medium">Remove photo</span>
            </button>
          )}
        </div>

        <div className="p-4 border-t border-cinema-200">
          <button
            onClick={onClose}
            className="w-full py-2 text-cinema-500 font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Profile() {
  const [searchParams] = useSearchParams();
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
  const isTestShow = searchParams.get('test') === 'true';

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
  const [editPhotoURL, setEditPhotoURL] = useState<string | undefined>(undefined);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);

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
      setEditPhotoURL(userProfile.photoURL);
      setNameAvailable(null);
      setNameSuggestions([]);
      setSaveError(null);
      setShowPhotoPicker(false);
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
      photoURL: editPhotoURL,
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
          <Spinner className="h-12 w-12 border-b-2 border-primary mx-auto" />
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

        {/* Sign-in card - shown to anyone not yet signed in with Google */}
        {!isGoogleUser && (
          <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5 space-y-4">
            <div className="text-sm font-semibold text-cinema-800">Sign in</div>
            <p className="text-sm text-cinema-600">
              Save your progress across devices and unlock leaderboard features. Use
              Google or any email — both work.
            </p>

            <GoogleSignInButton
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-md transition disabled:opacity-50"
            >
              {signingIn ? 'Signing in...' : 'Sign in with Google'}
            </GoogleSignInButton>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-cinema-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-cinema-50 text-cinema-500">or use any email</span>
              </div>
            </div>

            <EmailLinkSignIn />

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

      {/* Tickets shortcut — wallet itself lives at /tickets */}
      <Link
        to="/tickets"
        className="flex items-center justify-between p-4 rounded-2xl bg-cinema-50 border border-cinema-200 hover:border-primary/60 transition-colors group"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 text-primary">
            <Ticket className="w-5 h-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-cinema-900">My tickets</p>
            <p className="text-xs text-cinema-600">View, manage, and present your tickets at the door.</p>
          </div>
        </div>
        <span className="text-primary text-sm font-semibold group-hover:translate-x-0.5 transition-transform">→</span>
      </Link>

      <ProfileOfferClaims uid={userProfile.uid} isTestShow={isTestShow} />

      {/* Staff & admin shortcuts — only renders for users with elevated claims */}
      <StaffToolsCard />

      {/* Save Error */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">
          {saveError}
        </div>
      )}

      {/* Profile Picture Picker Modal */}
      {showPhotoPicker && (
        <ProfilePicturePicker
          currentPhotoURL={editPhotoURL}
          googlePhotoURL={googlePhotoURL}
          email={userProfile.email}
          onPhotoChange={(url) => setEditPhotoURL(url)}
          onClose={() => setShowPhotoPicker(false)}
        />
      )}

      {/* Profile Picture Card */}
      <div className="bg-cinema-50 border border-cinema-200 rounded-2xl p-5">
        <div className="flex items-center gap-4">
          {/* Photo */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-cinema-100 border-2 border-cinema-200 overflow-hidden flex items-center justify-center">
              {(isEditing ? editPhotoURL : userProfile.photoURL) ? (
                <img
                  src={isEditing ? editPhotoURL : userProfile.photoURL}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : googlePhotoURL && !isEditing ? (
                <img
                  src={googlePhotoURL}
                  alt="Google profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-10 h-10 text-cinema-400" />
              )}
            </div>
            {isEditing && (
              <button
                onClick={() => setShowPhotoPicker(true)}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg hover:bg-primary/90 transition"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-lg truncate">{userProfile.displayName}</div>
            <div className="text-sm text-cinema-500">
              {isEditing ? 'Tap camera to change photo' : 'Your profile picture'}
            </div>
          </div>

          {!isEditing && !userProfile.photoURL && !googlePhotoURL && (
            <button
              onClick={() => {
                setIsEditing(true);
                setTimeout(() => setShowPhotoPicker(true), 100);
              }}
              className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition"
            >
              Add photo
            </button>
          )}
        </div>
      </div>

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
                Save your progress across devices and unlock leaderboard features. Use
                Google or any email — both work.
              </p>

              <GoogleSignInButton
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-md transition disabled:opacity-50"
              >
                {signingIn ? 'Signing in...' : 'Sign in with Google'}
              </GoogleSignInButton>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-cinema-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-cinema-500">or use any email</span>
                </div>
              </div>

              <EmailLinkSignIn />

              <p className="text-xs text-cinema-500 text-center">
                Your anonymous data will be linked to your Google account
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
