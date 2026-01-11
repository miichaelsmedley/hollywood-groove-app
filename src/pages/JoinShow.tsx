import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { onValue, ref, get, query, orderByChild, equalTo, set, update, runTransaction } from 'firebase/database';
import { db, auth } from '../lib/firebase';
import { useUser } from '../contexts/UserContext';
import { MemberProfile, ShowMeta } from '../types/firebaseContract';
import { Music, Mail, Phone, User, Check, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { signInWithGoogle } from '../lib/auth';
import { getShowPath, getTestShowPath } from '../lib/mode';

const defaultStarBreakdown = {
  shows_attended: 0,
  trivia_participated: 0,
  dancing_engaged: 0,
  stage_participation: 0,
  between_show_trivia: 0,
  referrals: 0,
  early_tickets: 0,
  social_shares: 0,
  feedback_given: 0,
};

function resolveTierAndBonus(stars: number) {
  if (stars >= 51) return { tier: 'legend', bonus: 100 };
  if (stars >= 31) return { tier: 'director', bonus: 75 };
  if (stars >= 16) return { tier: 'lead', bonus: 50 };
  if (stars >= 8) return { tier: 'featured', bonus: 25 };
  if (stars >= 3) return { tier: 'supporting_role', bonus: 10 };
  return { tier: 'extra', bonus: 0 };
}

function resolveShowDate(startDate?: string) {
  if (!startDate) return new Date().toISOString().slice(0, 10);
  const parts = startDate.split('T');
  return parts[0] ?? new Date().toISOString().slice(0, 10);
}

export default function JoinShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    isRegistered,
    registerUser,
    addShowAttended,
    updateLastSeen,
    isGoogleUser,
    googlePhotoURL,
    userProfile,
    loading: userLoading,
    canUseTestMode,
  } = useUser();

  // Check if this is a test show via query param
  const isTestShow = searchParams.get('test') === 'true';

  // Helper to get the correct path based on whether it's a test show
  const getPath = useMemo(() => {
    return (showId: string, suffix?: string) => {
      return isTestShow ? getTestShowPath(showId, suffix) : getShowPath(showId, suffix);
    };
  }, [isTestShow]);

  const [showMeta, setShowMeta] = useState<ShowMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signingInWithGoogle, setSigningInWithGoogle] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [suggestedNicknames, setSuggestedNicknames] = useState<string[]>([]);
  const [checkingNickname, setCheckingNickname] = useState(false);
  const [nicknameAvailable, setNicknameAvailable] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [marketingConsent, setMarketingConsent] = useState(true);

  // Pre-fill form when user signs in with Google
  useEffect(() => {
    if (isGoogleUser && auth.currentUser) {
      const user = auth.currentUser;
      if (user.displayName && !displayName) {
        setDisplayName(user.displayName);
      }
      if (user.email && !email) {
        setEmail(user.email);
      }
    }
  }, [isGoogleUser, displayName, email]);

  const handleGoogleSignIn = async () => {
    setSigningInWithGoogle(true);
    try {
      await signInWithGoogle();
      // Form will auto-populate from the useEffect above
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      // Don't show alert for user-cancelled sign-in
      if (error?.message !== 'Sign-in cancelled') {
        alert('Failed to sign in with Google. Please try again.');
      }
    } finally {
      setSigningInWithGoogle(false);
    }
  };

  useEffect(() => {
    if (!id) return;

    const showRef = ref(db, getPath(id, 'meta'));
    const unsubscribe = onValue(showRef, (snapshot) => {
      setShowMeta(snapshot.val() as ShowMeta | null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  const ensureJoinRecords = useCallback(
    async (options?: { displayName?: string; emailOptIn?: boolean; smsOptIn?: boolean }) => {
      if (!id || !showMeta) return;
      const user = auth.currentUser;
      if (!user) return;

      const uid = user.uid;
      const resolvedDisplayName =
        options?.displayName?.trim() ||
        userProfile?.displayName?.trim() ||
        user.displayName?.trim() ||
        'Guest';

      const emailOptIn = options?.emailOptIn ?? userProfile?.preferences?.marketingEmails ?? false;
      const smsOptIn = options?.smsOptIn ?? userProfile?.preferences?.marketingSMS ?? false;

      const authProvider =
        user.providerData?.[0]?.providerId || (user.isAnonymous ? 'anonymous' : 'unknown');

      const memberRef = ref(db, `members/${uid}`);
      const memberSnap = await get(memberRef);
      let member: MemberProfile;

      if (memberSnap.exists()) {
        const existing = memberSnap.val() as MemberProfile;
        member = existing;

        const updates: Partial<MemberProfile> = {};
        if (resolvedDisplayName && existing.display_name !== resolvedDisplayName) {
          updates.display_name = resolvedDisplayName;
        }
        if (!existing.stars) {
          updates.stars = {
            total: 0,
            tier: 'extra',
            starting_bonus: 0,
            breakdown: defaultStarBreakdown,
          };
        }

        if (Object.keys(updates).length > 0) {
          await update(memberRef, updates);
          member = { ...existing, ...updates } as MemberProfile;
        }
      } else {
        member = {
          display_name: resolvedDisplayName,
          created_at: Date.now(),
          auth_provider: authProvider,
          stars: {
            total: 0,
            tier: 'extra',
            starting_bonus: 0,
            breakdown: defaultStarBreakdown,
          },
          email_opt_in: emailOptIn,
          sms_opt_in: smsOptIn,
        };
        await set(memberRef, member);
      }

      const starsTotal = member.stars?.total ?? 0;
      const { tier, bonus } = resolveTierAndBonus(starsTotal);

      const attendeeRef = ref(db, getPath(id, `attendees/${uid}`));
      const attendeeSnap = await get(attendeeRef);
      if (!attendeeSnap.exists()) {
        await set(attendeeRef, {
          member_id: uid,
          display_name: resolvedDisplayName,
          tier_at_checkin: tier,
          starting_bonus_applied: bonus,
          total_score: bonus,
          breakdown: {
            starting_bonus: bonus,
            trivia: 0,
            dancing: 0,
            participation: 0,
          },
          stars_earned: {
            attendance: 1,
            trivia: 0,
            dancing: 0,
            stage: 0,
            total: 1,
          },
          last_dance_claim: 0,
          dance_claim_count: 0,
          current_streak: 0,
          times_selected: 0,
        });
      } else if (resolvedDisplayName) {
        await update(attendeeRef, { display_name: resolvedDisplayName });
      }

      const scoreRef = ref(db, getPath(id, `scores/${uid}`));
      await runTransaction(scoreRef, (current) => {
        const existing = (current ?? {}) as Record<string, any>;
        const existingBreakdown = (existing.breakdown ?? {}) as Record<string, any>;
        const hasStartingBonus = typeof existingBreakdown.starting_bonus === 'number';

        if (hasStartingBonus) {
          return existing;
        }

        const existingTotal = typeof existing.totalScore === 'number' ? existing.totalScore : 0;
        const startingBonus = bonus;
        const nextBreakdown = {
          trivia: existingBreakdown.trivia ?? 0,
          dancing: existingBreakdown.dancing ?? 0,
          participation: existingBreakdown.participation ?? 0,
          starting_bonus: (existingBreakdown.starting_bonus ?? 0) + startingBonus,
        };

        return {
          ...existing,
          displayName: existing.displayName ?? resolvedDisplayName,
          tier: existing.tier ?? tier,
          totalScore: existingTotal + startingBonus,
          breakdown: nextBreakdown,
          correctCount: existing.correctCount ?? 0,
          lastAnsweredAt: existing.lastAnsweredAt ?? 0,
        };
      });

      const memberShowRef = ref(db, `members/${uid}/shows/${id}`);
      const memberShowSnap = await get(memberShowRef);
      if (!memberShowSnap.exists()) {
        const showDate = resolveShowDate(showMeta?.startDate);
        await set(memberShowRef, {
          date: showDate,
          stars_earned: 1,
        });

        const starsRef = ref(db, `members/${uid}/stars`);
        await runTransaction(starsRef, (current) => {
          const existing = (current ?? {}) as Record<string, any>;
          const existingTotal = typeof existing.total === 'number' ? existing.total : 0;
          const breakdown = (existing.breakdown ?? {}) as Record<string, any>;
          const showsAttended = typeof breakdown.shows_attended === 'number'
            ? breakdown.shows_attended
            : 0;

          const nextTotal = existingTotal + 1;
          const nextTier = resolveTierAndBonus(nextTotal);

          return {
            ...existing,
            total: nextTotal,
            tier: nextTier.tier,
            starting_bonus: nextTier.bonus,
            breakdown: {
              ...defaultStarBreakdown,
              ...breakdown,
              shows_attended: showsAttended + 1,
            },
            last_show_date: showDate,
          };
        });
      }
    },
    [id, showMeta, userProfile, getPath]
  );

  useEffect(() => {
    if (!isRegistered || !showMeta || !id) return;
    let cancelled = false;

    ensureJoinRecords()
      .then(async () => {
        if (cancelled) return;
        await addShowAttended(id);
        await updateLastSeen();
        if (!cancelled) {
          navigate(`/shows/${id}${isTestShow ? '?test=true' : ''}`);
        }
      })
      .catch((error) => {
        console.error('Join flow error:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [isRegistered, showMeta, id, navigate, addShowAttended, updateLastSeen, ensureJoinRecords, isTestShow]);

  const checkNicknameAvailability = useCallback(async (nickname: string) => {
    if (!nickname.trim()) {
      setNicknameAvailable(null);
      setSuggestedNicknames([]);
      return;
    }

    setCheckingNickname(true);

    try {
      const membersRef = ref(db, 'members');
      const nicknameQuery = query(membersRef, orderByChild('display_name'), equalTo(nickname));
      const snapshot = await get(nicknameQuery);

      if (snapshot.exists()) {
        setNicknameAvailable(false);
        generateSuggestions(nickname);
      } else {
        setNicknameAvailable(true);
        setSuggestedNicknames([]);
      }
    } catch (error) {
      console.error('Error checking nickname:', error);
      // On error, allow the nickname (server will validate)
      setNicknameAvailable(true);
    } finally {
      setCheckingNickname(false);
    }
  }, []);

  const generateSuggestions = async (baseName: string) => {
    const suggestions: string[] = [];
    const membersRef = ref(db, 'members');

    for (let i = 1; i <= 5; i++) {
      const candidate = `${baseName}_${String(i).padStart(3, '0')}`;
      const candidateQuery = query(membersRef, orderByChild('display_name'), equalTo(candidate));
      const snapshot = await get(candidateQuery);

      if (!snapshot.exists()) {
        suggestions.push(candidate);
        if (suggestions.length >= 3) break;
      }
    }

    const yearCandidate = `${baseName}_${new Date().getFullYear()}`;
    const yearQuery = query(membersRef, orderByChild('display_name'), equalTo(yearCandidate));
    const yearSnapshot = await get(yearQuery);
    if (!yearSnapshot.exists() && suggestions.length < 3) {
      suggestions.push(yearCandidate);
    }

    setSuggestedNicknames(suggestions);
  };

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
      alert('This nickname is already taken. Please choose a different one or use a suggested nickname.');
      return;
    }
    if (!email.trim() && !phone.trim()) {
      alert('Please provide either an email address or mobile number.');
      return;
    }

    // Check if we have an authenticated user
    if (!auth.currentUser) {
      console.error('No authenticated user - cannot register');
      alert('Session expired. Please refresh the page and try again.');
      return;
    }

    setSubmitting(true);
    console.log('📝 Starting registration for user:', auth.currentUser.uid);

    try {
      console.log('📝 Calling registerUser...');
      await registerUser({
        displayName: displayName.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        marketingEmails: email.trim() ? marketingConsent : false,
        marketingSMS: phone.trim() ? marketingConsent : false,
      });
      console.log('✅ registerUser completed');

      if (id) {
        console.log('📝 Calling ensureJoinRecords...');
        await ensureJoinRecords({
          displayName: displayName.trim(),
          emailOptIn: email.trim() ? marketingConsent : false,
          smsOptIn: phone.trim() ? marketingConsent : false,
        });
        console.log('✅ ensureJoinRecords completed');

        console.log('📝 Calling addShowAttended...');
        await addShowAttended(id);
        console.log('✅ addShowAttended completed');

        console.log('📝 Calling updateLastSeen...');
        await updateLastSeen();
        console.log('✅ updateLastSeen completed');
      }

      console.log('✅ Registration complete, navigating to show...');
      navigate(`/shows/${id}${isTestShow ? '?test=true' : ''}`);
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      // Provide more specific error messages
      if (error?.code === 'PERMISSION_DENIED' || error?.message?.includes('permission')) {
        alert('Unable to save your profile. Please try signing in with Google instead.');
      } else if (error?.code === 'auth/requires-recent-login') {
        alert('Your session has expired. Please refresh the page and try again.');
      } else {
        alert('Failed to register. Please try again or sign in with Google.');
      }
      setSubmitting(false);
    }
  };

  // Wait for both show metadata AND user auth to load
  if (loading || userLoading) {
    return (
      <div className="min-h-screen bg-cinema flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cinema-200 border-t-primary mx-auto"></div>
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-cinema-500 font-medium">
            {userLoading ? 'Checking your account...' : 'Loading show...'}
          </p>
        </div>
      </div>
    );
  }

  // Check for show not found BEFORE checking isRegistered
  // Otherwise we'd show "Joining show..." forever for a non-existent show
  if (!showMeta) {
    return (
      <div className="min-h-screen bg-cinema flex items-center justify-center p-4">
        <div className="text-center space-y-4 animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-cinema-50 border-2 border-cinema-200 flex items-center justify-center mx-auto">
            <Music className="w-10 h-10 text-cinema-500" />
          </div>
          <h2 className="text-2xl font-bold text-cinema-900">Show Not Found</h2>
          <p className="text-cinema-500 max-w-sm mx-auto">
            This show doesn't exist or hasn't been published yet.
          </p>
        </div>
      </div>
    );
  }

  // Check for test show access - only testers can see test shows
  if (showMeta.isTestShow && !canUseTestMode) {
    return (
      <div className="min-h-screen bg-cinema flex items-center justify-center p-4">
        <div className="text-center space-y-4 animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-cinema-50 border-2 border-cinema-200 flex items-center justify-center mx-auto">
            <Music className="w-10 h-10 text-cinema-500" />
          </div>
          <h2 className="text-2xl font-bold text-cinema-900">Show Not Found</h2>
          <p className="text-cinema-500 max-w-sm mx-auto">
            This show doesn't exist or hasn't been published yet.
          </p>
        </div>
      </div>
    );
  }

  // User is already registered - show loading while useEffect handles the join
  if (isRegistered) {
    return (
      <div className="min-h-screen bg-cinema flex items-center justify-center">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-cinema-200 border-t-primary mx-auto"></div>
            <Sparkles className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
          </div>
          <p className="text-cinema-500 font-medium">Joining show...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cinema flex items-center justify-center p-4 relative overflow-hidden">
      {/* Cinematic background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-4 relative z-10 animate-slide-up">
        {/* Hollywood Groove Logo - Text */}
        <div className="text-center">
          <h1 className="font-display text-4xl md:text-5xl text-primary drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]">
            HOLLYWOOD GROOVE
          </h1>
        </div>

        {/* Compact Registration Form */}
        <div className="card-cinema p-6 backdrop-blur-xl">
          <div className="mb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Music className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-cinema-900">{showMeta.title}</h3>
            </div>
            <p className="text-xs text-cinema-600">{showMeta.venueName}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Google Sign-In Option */}
            {!isGoogleUser && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={signingInWithGoogle}
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
                  {signingInWithGoogle ? 'Signing in...' : 'Sign in with Google'}
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-cinema-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-cinema text-cinema-500">or fill out manually</span>
                  </div>
                </div>
              </div>
            )}

            {/* Google User Indicator */}
            {isGoogleUser && (
              <div className="flex items-center gap-3 p-3 bg-accent-green/10 border border-accent-green/30 rounded-xl">
                {googlePhotoURL && (
                  <img
                    src={googlePhotoURL}
                    alt="Google profile"
                    className="w-8 h-8 rounded-full border-2 border-accent-green/30"
                  />
                )}
                <div className="flex-1 text-sm">
                  <div className="font-medium text-cinema-800">Signed in with Google</div>
                  <div className="text-xs text-cinema-600">Info pre-filled below</div>
                </div>
                <CheckCircle className="w-5 h-5 text-accent-green" />
              </div>
            )}

            {/* Nickname with inline feedback */}
            <div>
              <label className="block text-xs font-semibold text-cinema-700 mb-1.5">
                Nickname
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-500 z-10" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter nickname"
                  required
                  autoFocus
                  className={`w-full pl-10 pr-10 py-3 bg-cinema border-2 rounded-lg text-cinema-900 placeholder-cinema-500 outline-none transition-all ${
                    nicknameAvailable === true
                      ? 'border-accent-green focus:ring-2 focus:ring-accent-green/20'
                      : nicknameAvailable === false
                      ? 'border-accent-red focus:ring-2 focus:ring-accent-red/20'
                      : 'border-cinema-200 focus:border-primary focus:ring-2 focus:ring-primary/10'
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
                <div className="mt-2 p-2 bg-cinema-50 border border-cinema-200 rounded-lg">
                  <p className="text-xs text-accent-red mb-1.5">Try these:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestedNicknames.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setDisplayName(suggestion)}
                        className="px-2 py-1 bg-cinema border border-cinema-300 rounded text-xs text-cinema-800 hover:border-primary hover:text-primary transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Compact Contact Fields */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-cinema-700 mb-1.5">
                  Email <span className="text-cinema-500 font-normal">(or phone)</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@..."
                    className="w-full pl-10 pr-3 py-3 bg-cinema border-2 border-cinema-200 rounded-lg text-cinema-900 placeholder-cinema-500 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-cinema-700 mb-1.5">
                  Phone <span className="text-cinema-500 font-normal">(or email)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cinema-500" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="04XX..."
                    className="w-full pl-10 pr-3 py-3 bg-cinema border-2 border-cinema-200 rounded-lg text-cinema-900 placeholder-cinema-500 focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Compact Marketing Consent */}
            {(email || phone) && (
              <label className="flex items-start gap-2 cursor-pointer p-2 bg-cinema-50 border border-cinema-200 rounded-lg">
                <div className="relative flex-shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={marketingConsent}
                    onChange={(e) => setMarketingConsent(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-cinema-300 rounded peer-checked:border-primary peer-checked:bg-primary transition-all flex items-center justify-center">
                    {marketingConsent && <Check className="w-3 h-3 text-cinema font-bold" />}
                  </div>
                </div>
                <span className="text-xs text-cinema-800">
                  Opt in to receive show updates and trivia in between shows
                </span>
              </label>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!displayName.trim() || nicknameAvailable === false || (!email.trim() && !phone.trim()) || submitting}
              className="btn-primary w-full py-3 text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-cinema border-t-transparent rounded-full animate-spin"></div>
                  Joining...
                </span>
              ) : (
                'Join the Show'
              )}
            </button>

            {/* Warning for non-Google users */}
            {!isGoogleUser && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <p className="text-xs text-amber-700 text-center">
                  <strong>Tip:</strong> Sign in with Google above to save your progress permanently.
                  Manual registration may be lost if you clear browser data.
                </p>
              </div>
            )}

            <p className="text-xs text-center text-cinema-600">
              By joining, you agree to our{' '}
              <a href="#" className="text-primary hover:underline">terms</a>
              {' '}and{' '}
              <a href="#" className="text-primary hover:underline">privacy policy</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
