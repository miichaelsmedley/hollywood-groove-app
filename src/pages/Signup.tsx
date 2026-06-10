import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { Music, Mail, Phone, User, Check, Sparkles, AlertCircle, CheckCircle, PartyPopper, ExternalLink } from 'lucide-react';
import { signInWithGoogle } from '../lib/auth';
import EmailLinkSignIn from '../features/auth/EmailLinkSignIn';
import { safeReturnUrl } from '../lib/safeRedirect';
import GoogleSignInButton from '../components/ui/GoogleSignInButton';
import {
  checkNicknameAvailability as checkNicknameAvailabilityViaCallable,
  getSuggestedNicknames,
} from '../lib/nicknameService';

export default function Signup() {
  const [searchParams] = useSearchParams();
  const {
    isRegistered,
    registerUser,
    isGoogleUser,
    googlePhotoURL,
    loading: userLoading,
  } = useUser();

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [suggestedNicknames, setSuggestedNicknames] = useState<string[]>([]);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  // Get return URL from query params — validated to a trusted host / in-app
  // path so a crafted `?return=` can't turn "Back to Website" into a phishing
  // redirect (or a javascript: URI).
  const returnUrl = safeReturnUrl(
    searchParams.get('return'),
    'https://hollywoodgroove.com.au',
  );

  // Pre-fill form when user signs in with Google
  useEffect(() => {
    if (isGoogleUser && auth.currentUser) {
      const user = auth.currentUser;
      console.log('🔄 Pre-filling form from Google:', {
        displayName: user.displayName,
        email: user.email,
      });

      // Pre-fill email if available
      if (user.email && !email) {
        setEmail(user.email);
      }

      // Pre-fill nickname: use displayName, or derive from email as fallback
      if (!displayName) {
        if (user.displayName) {
          setDisplayName(user.displayName);
        } else if (user.email) {
          // Derive nickname from email (e.g., "Michael Smith" from "michael.smith@gmail.com")
          const emailName = user.email.split('@')[0];
          const derivedName = emailName
            .replace(/[._]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
          console.log('📝 Derived nickname from email:', derivedName);
          setDisplayName(derivedName);
        }
      }
    }
  }, [isGoogleUser, displayName, email]);

  // If already registered, show success state
  useEffect(() => {
    if (isRegistered && !userLoading) {
      setSignupComplete(true);
    }
  }, [isRegistered, userLoading]);

  const handleGoogleSignIn = async () => {
    setSigningInWithGoogle(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error?.message !== 'Sign-in cancelled') {
        alert('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setSigningInWithGoogle(false);
    }
  };

  const checkNicknameAvailability = useCallback(async (nickname: string) => {
    if (!nickname.trim()) {
      setNicknameAvailable(null);
      setSuggestedNicknames([]);
      return;
    }

    setCheckingNickname(true);

    try {
      const result = await checkNicknameAvailabilityViaCallable(nickname);
      if (!result.available) {
        setNicknameAvailable(false);
        setSuggestedNicknames(await getSuggestedNicknames(nickname));
      } else {
        setNicknameAvailable(true);
        setSuggestedNicknames([]);
      }
    } catch (error) {
      console.error('Error checking nickname:', error);
      setNicknameAvailable(true);
    } finally {
      setCheckingNickname(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (displayName.trim()) {
        checkNicknameAvailability(displayName.trim());
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [displayName, checkNicknameAvailability]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) return;
    if (nicknameAvailable === false) {
      alert('This nickname is already taken. Please choose a different one.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      alert('Please provide either an email address or mobile number.');
      return;
    }

    if (!auth.currentUser) {
      console.error('No authenticated user - cannot register');
      alert('Session expired. Please refresh the page and try again.');
      return;
    }

    setSubmitting(true);

    try {
      await registerUser({
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        marketingEmails: email.trim() ? marketingConsent : false,
        marketingSMS: phone.trim() ? marketingConsent : false,
      });

      setSignupComplete(true);
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission')) {
        alert('Unable to save your profile. Please try signing in with Google instead.');
      } else {
        alert('Failed to register. Please try again or sign in with Google.');
      }
      setSubmitting(false);
    }
  };

  // Loading state
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cinema-900 via-cinema to-cinema-900 flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cinema-200 border-t-primary mx-auto"></div>
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-cinema-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Success state - show options to go to app or website
  if (signupComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-cinema-900 via-cinema to-cinema-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-8 animate-slide-up">
          {/* Success Icon */}
          <div className="relative">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-amber-400 rounded-full flex items-center justify-center shadow-glow-lg">
              <PartyPopper className="w-12 h-12 text-cinema-900" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent-green rounded-full flex items-center justify-center shadow-lg">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Success Message */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-bold text-cinema-900">
              Welcome to the Groove!
            </h1>
            <p className="text-cinema-600 text-lg">
              You're all set to join our shows and compete for amazing prizes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4 pt-4">
            <a
              href="https://app.hollywoodgroove.com.au"
              className="block w-full rounded-2xl bg-primary px-6 py-4 text-cinema font-bold shadow-glow-lg hover:bg-primary-600 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-center gap-3">
                <Music className="w-6 h-6" />
                <span className="text-lg">Open the App</span>
              </div>
            </a>

            <a
              href={returnUrl}
              className="block w-full rounded-2xl bg-cinema-50 border-2 border-cinema-200 px-6 py-4 font-semibold text-cinema-900 hover:border-primary/60 transition-all"
            >
              <div className="flex items-center justify-center gap-3">
                <ExternalLink className="w-5 h-5" />
                <span>Back to Website</span>
              </div>
            </a>
          </div>

          {/* Tips */}
          <div className="bg-cinema-50 border border-cinema-200 rounded-xl p-4 text-left">
            <h3 className="font-semibold text-cinema-900 mb-2">What's next?</h3>
            <ul className="text-sm text-cinema-600 space-y-1">
              <li>Join us at a live show to play trivia</li>
              <li>Earn stars and climb the leaderboard</li>
              <li>Win prizes and exclusive rewards</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen bg-gradient-to-b from-cinema-900 via-cinema to-cinema-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-4 relative z-10 animate-slide-up">
        {/* Header - Compact */}
        <div className="text-center space-y-1">
          <h1 className="font-display text-3xl text-primary drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            HOLLYWOOD GROOVE
          </h1>
          <p className="text-cinema-600 text-sm">
            Sign up to play trivia and win prizes!
          </p>
        </div>

        {/* Registration Card */}
        <div className="bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-cinema-200">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Google Sign-In Option */}
            {!isGoogleUser && (
              <div className="space-y-3">
                <GoogleSignInButton
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={signingInWithGoogle}
                  className="w-full px-3 py-3 rounded-xl border-2 border-gray-300 bg-white text-gray-700 font-semibold hover:border-primary/60 hover:shadow-lg transition-all disabled:opacity-50 text-sm"
                >
                  {signingInWithGoogle ? 'Signing in...' : 'Continue with Google'}
                </GoogleSignInButton>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-cinema-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-cinema-500">or sign in with email</span>
                  </div>
                </div>

                <EmailLinkSignIn />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-cinema-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-white text-cinema-500">or fill in your details below</span>
                  </div>
                </div>
              </div>
            )}

            {/* Google User Indicator */}
            {isGoogleUser && (
              <div className="flex items-center gap-2 p-2 bg-accent-green/10 border border-accent-green/30 rounded-lg text-sm">
                {googlePhotoURL && (
                  <img src={googlePhotoURL} alt="" className="w-8 h-8 rounded-full border border-accent-green/30" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-cinema-800 truncate">{auth.currentUser?.email}</div>
                </div>
                <CheckCircle className="w-5 h-5 text-accent-green flex-shrink-0" />
              </div>
            )}

            {/* Nickname Field */}
            <div>
              <label className="block text-xs font-semibold text-cinema-700 mb-1">Nickname</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-400 z-10" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your leaderboard name"
                  required
                  className={`w-full pl-9 pr-9 py-2.5 bg-cinema-50 border-2 rounded-lg text-cinema-900 placeholder-cinema-400 outline-none transition-all ${
                    nicknameAvailable === true
                      ? 'border-accent-green focus:ring-1 focus:ring-accent-green/20'
                      : nicknameAvailable === false
                      ? 'border-accent-red focus:ring-1 focus:ring-accent-red/20'
                      : 'border-cinema-200 focus:border-primary focus:ring-1 focus:ring-primary/10'
                  }`}
                />
                {checkingNickname && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!checkingNickname && nicknameAvailable === true && (
                  <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-green" />
                )}
                {!checkingNickname && nicknameAvailable === false && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent-red" />
                )}
              </div>

              {nicknameAvailable === false && suggestedNicknames.length > 0 && (
                <div className="mt-1.5 p-2 bg-cinema-50 border border-cinema-200 rounded-lg">
                  <p className="text-[10px] text-accent-red mb-1">Taken. Try:</p>
                  <div className="flex flex-wrap gap-1">
                    {suggestedNicknames.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setDisplayName(suggestion)}
                        className="px-2 py-1 bg-white border border-cinema-300 rounded text-xs text-cinema-800 hover:border-primary hover:text-primary transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Email & Phone in compact grid */}
            <div className="grid grid-cols-1 gap-2">
              <div>
                <label className="block text-xs font-semibold text-cinema-700 mb-1">
                  Email <span className="text-cinema-400 font-normal">(or phone)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-cinema-50 border-2 border-cinema-200 rounded-lg text-cinema-900 placeholder-cinema-400 focus:border-primary focus:ring-1 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cinema-700 mb-1">
                  Mobile <span className="text-cinema-400 font-normal">(or email)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="04XX XXX XXX"
                    className="w-full pl-9 pr-3 py-2.5 bg-cinema-50 border-2 border-cinema-200 rounded-lg text-cinema-900 placeholder-cinema-400 focus:border-primary focus:ring-1 focus:ring-primary/10 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Marketing Consent - Compact */}
            {(email || phone) && (
              <label className="flex items-center gap-2 cursor-pointer p-2 bg-cinema-50 border border-cinema-200 rounded-lg hover:border-primary/40 transition-all">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-cinema-300 rounded peer-checked:border-primary peer-checked:bg-primary transition-all flex items-center justify-center">
                    {marketingConsent && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
                <span className="text-xs text-cinema-700">Send me show updates & offers</span>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!displayName.trim() || nicknameAvailable === false || (!email.trim() && !phone.trim()) || submitting}
              className="w-full py-3 rounded-lg bg-primary text-cinema font-bold shadow-glow hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none transition-all active:scale-[0.98]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-cinema border-t-transparent rounded-full animate-spin"></div>
                  Creating...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            {/* Terms - inline */}
            <p className="text-[10px] text-center text-cinema-500">
              By signing up, you agree to our{' '}
              <a href="https://hollywoodgroove.com.au/terms" className="text-primary hover:underline">terms</a>
              {' & '}
              <a href="https://hollywoodgroove.com.au/privacy" className="text-primary hover:underline">privacy</a>
            </p>
          </form>
        </div>

        {/* Already have account? - Compact */}
        <p className="text-center text-cinema-600 text-sm">
          Already signed up?{' '}
          <a href="https://app.hollywoodgroove.com.au" className="text-primary font-semibold hover:underline">
            Open the app
          </a>
        </p>
      </div>
    </div>
  );
}
