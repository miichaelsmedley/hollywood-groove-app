import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { ref, onValue, set, serverTimestamp, onDisconnect } from 'firebase/database';
import { auth, db } from '../lib/firebase';
import { ShowSettings, LiveActivityState, LiveTriviaState, LiveMomentState, LiveSetState, LiveDanceWindowState, LiveCallupState } from '../types/firebaseContract';
import { getShowPath, getTestShowPath } from '../lib/mode';
import { useRealtimeConnection } from '../hooks/useRealtimeConnection';

interface DanceClaimRecord {
  lastClaimAt: number;
  claimCount: number;
  activityId: string;
}

// Break mode types
export type BreakMode = 'off' | 'dancing' | 'toilet' | 'chatting';

// Auto-timeout durations (in milliseconds)
// Dancing has no auto-timeout (user exits manually), set to 4 hours as a safety limit
const BREAK_TIMEOUTS: Record<Exclude<BreakMode, 'off'>, number> = {
  dancing: 4 * 60 * 60 * 1000, // 4 hours (effectively no limit)
  toilet: 2 * 60 * 1000,       // 2 minutes
  chatting: 5 * 60 * 1000,     // 5 minutes
};

// Auto-claim interval (check every 60 seconds)
const AUTO_CLAIM_INTERVAL = 60 * 1000;
const DANCE_PRESENCE_HEARTBEAT = 10 * 1000;

interface ShowContextType {
  showId: string | null;
  isTestShow: boolean;
  settings: ShowSettings | null;
  liveActivity: LiveActivityState | null;
  liveTrivia: LiveTriviaState | null;
  liveSet: LiveSetState | null;
  liveDanceWindow: LiveDanceWindowState | null;
  liveCallup: LiveCallupState | null;
  liveMoment: LiveMomentState | null;
  isRealtimeConnected: boolean;

  // Dancing state
  dancingEnabled: boolean;
  currentMedian: number | null;
  lastDanceClaim: DanceClaimRecord | null;

  // Enhanced break state
  breakMode: BreakMode;
  pointsEarnedOnBreak: number;
  breakStartedAt: number | null;
  isOnBreak: boolean; // Convenience getter (breakMode !== 'off')

  // Actions
  claimDancePoints: () => Promise<boolean>;
  enterBreakMode: (mode: Exclude<BreakMode, 'off'>) => Promise<void>;
  exitBreakMode: () => void;
}

const ShowContext = createContext<ShowContextType | undefined>(undefined);

interface DanceCooldownContextType {
  canClaimDance: boolean;
  cooldownRemaining: number;
}

const DanceCooldownContext = createContext<DanceCooldownContextType | undefined>(undefined);

// Default settings if not set by controller
const DEFAULT_SETTINGS: ShowSettings = {
  dancing_mode: 'interval',
  dancing_cooldown_minutes: 5,
  dancing_floor: 50,
  dancing_cap: 200,
};

function getCooldownRemainingSeconds(
  lastDanceClaim: DanceClaimRecord | null,
  settings: ShowSettings
): number {
  if (!lastDanceClaim) return 0;
  const cooldownMs = settings.dancing_cooldown_minutes * 60 * 1000;
  const elapsed = Date.now() - lastDanceClaim.lastClaimAt;
  return Math.ceil(Math.max(0, cooldownMs - elapsed) / 1000);
}

function DanceCooldownProvider({
  children,
  dancingEnabled,
  lastDanceClaim,
  settings,
}: {
  children: ReactNode;
  dancingEnabled: boolean;
  lastDanceClaim: DanceClaimRecord | null;
  settings: ShowSettings;
}) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    const updateCooldown = () => {
      const nextRemaining = getCooldownRemainingSeconds(lastDanceClaim, settings);
      setCooldownRemaining(nextRemaining);
      return nextRemaining;
    };

    const initialRemaining = updateCooldown();
    if (initialRemaining <= 0) {
      return;
    }

    const interval = window.setInterval(() => {
      if (updateCooldown() <= 0) {
        window.clearInterval(interval);
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [lastDanceClaim, settings]);

  const value = useMemo(
    () => ({
      canClaimDance: dancingEnabled && cooldownRemaining === 0,
      cooldownRemaining,
    }),
    [cooldownRemaining, dancingEnabled]
  );

  return (
    <DanceCooldownContext.Provider value={value}>
      {children}
    </DanceCooldownContext.Provider>
  );
}

interface ShowProviderProps {
  showId: string;
  isTestShow?: boolean;
  children: ReactNode;
}

export function ShowProvider({ showId, isTestShow = false, children }: ShowProviderProps) {
  // Create path helper that respects test mode
  const getPath = useMemo(() => {
    return (suffix?: string) => {
      return isTestShow
        ? getTestShowPath(showId, suffix)
        : getShowPath(showId, suffix);
    };
  }, [showId, isTestShow]);

  // Log path mode for debugging
  useEffect(() => {
    console.log(`📡 ShowContext: Using ${isTestShow ? 'TEST' : 'PRODUCTION'} paths for show ${showId}`);
    console.log(`📡 Example path: ${getPath('live/trivia')}`);
  }, [showId, isTestShow, getPath]);
  const [settings, setSettings] = useState<ShowSettings | null>(null);
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [liveTrivia, setLiveTrivia] = useState<LiveTriviaState | null>(null);
  const [liveSet, setLiveSet] = useState<LiveSetState | null>(null);
  const [liveDanceWindow, setLiveDanceWindow] = useState<LiveDanceWindowState | null>(null);
  const [liveCallup, setLiveCallup] = useState<LiveCallupState | null>(null);
  const [liveMoment, setLiveMoment] = useState<LiveMomentState | null>(null);
  const [lastDanceClaim, setLastDanceClaim] = useState<DanceClaimRecord | null>(null);
  const isRealtimeConnected = useRealtimeConnection();

  // Enhanced break mode state
  const [breakMode, setBreakMode] = useState<BreakMode>('off');
  const [pointsEarnedOnBreak, setPointsEarnedOnBreak] = useState(0);
  const [breakStartedAt, setBreakStartedAt] = useState<number | null>(null);

  // Refs for cleanup
  const breakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoClaimIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to show settings
  useEffect(() => {
    const settingsRef = ref(db, getPath('settings'));
    console.log(`📡 ShowContext: Listening to settings at ${getPath('settings')}`);
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings(data as ShowSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to live activity state
  useEffect(() => {
    const activityRef = ref(db, getPath('live/activity'));
    console.log(`📡 ShowContext: Listening to live/activity at ${getPath('live/activity')}`);
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val();
      setLiveActivity(data as LiveActivityState | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to live trivia state
  useEffect(() => {
    const triviaRef = ref(db, getPath('live/trivia'));
    console.log(`📡 ShowContext: Listening to live/trivia at ${getPath('live/trivia')}`);
    const unsubscribe = onValue(triviaRef, (snapshot) => {
      const data = snapshot.val();
      console.log(`📡 ShowContext: Received trivia data:`, data);
      setLiveTrivia(data as LiveTriviaState | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to live media moment state (rich media overlay)
  useEffect(() => {
    const momentRef = ref(db, getPath('live/moment'));
    const unsubscribe = onValue(momentRef, (snapshot) => {
      setLiveMoment(snapshot.val() as LiveMomentState | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to the current set marker used for set-scoped scoring.
  useEffect(() => {
    const setRef = ref(db, getPath('live/set'));
    const unsubscribe = onValue(setRef, (snapshot) => {
      setLiveSet(snapshot.val() as LiveSetState | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to the current dance window.
  useEffect(() => {
    const windowRef = ref(db, getPath('live/dance_window'));
    const unsubscribe = onValue(windowRef, (snapshot) => {
      setLiveDanceWindow(snapshot.val() as LiveDanceWindowState | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to the current participation callup.
  useEffect(() => {
    const callupRef = ref(db, getPath('live/callup'));
    const unsubscribe = onValue(callupRef, (snapshot) => {
      setLiveCallup(snapshot.val() as LiveCallupState | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Listen to user's dance claims for cooldown tracking
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const claimsRef = ref(db, getPath(`dance_claims/${uid}`));
    const unsubscribe = onValue(claimsRef, (snapshot) => {
      const data = snapshot.val();
      setLastDanceClaim(data as DanceClaimRecord | null);
    });
    return () => unsubscribe();
  }, [getPath]);

  // Derived state
  const effectiveSettings = settings || DEFAULT_SETTINGS;
  const dancingEnabled = effectiveSettings.dancing_mode !== 'disabled';

  // Get current median from live activity (if dancing) or use floor as default
  const currentMedian = liveActivity?.type === 'dancing' && liveActivity?.currentMedian != null
    ? liveActivity.currentMedian
    : effectiveSettings.dancing_floor;

  // Convenience derived state
  const isOnBreak = breakMode !== 'off';
  const isDanceWindowOpen = Boolean(
    liveDanceWindow?.status === 'open' &&
    typeof liveDanceWindow.endsAt === 'number' &&
    liveDanceWindow.endsAt > Date.now()
  );

  const writeDancePresence = useCallback(async (active: boolean) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const displayName = auth.currentUser?.displayName || 'Anonymous';
    const presenceRef = ref(db, getPath(`dance_presence/${uid}`));
    const payload = active
      ? {
          active: true,
          mode: 'dancing',
          displayName,
          enteredAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }
      : {
          active: false,
          mode: 'off',
          displayName,
          updatedAt: serverTimestamp(),
        };
    await set(presenceRef, payload);
    if (active) {
      onDisconnect(presenceRef).set({
        active: false,
        mode: 'off',
        displayName,
        updatedAt: serverTimestamp(),
      }).catch((error) => {
        console.warn('Failed to attach dance presence disconnect cleanup:', error);
      });
    } else {
      onDisconnect(presenceRef).cancel().catch(() => undefined);
    }
  }, [getPath]);

  useEffect(() => {
    if (breakMode !== 'dancing') {
      void writeDancePresence(false);
      return;
    }

    void writeDancePresence(true);
    const interval = window.setInterval(() => {
      void writeDancePresence(true);
    }, DANCE_PRESENCE_HEARTBEAT);

    return () => {
      window.clearInterval(interval);
      void writeDancePresence(false);
    };
  }, [breakMode, writeDancePresence]);

  // Claim dance points - returns points claimed or 0 if failed
  const claimDancePoints = useCallback(async (): Promise<boolean> => {
    const uid = auth.currentUser?.uid;
    const cooldownRemaining = getCooldownRemainingSeconds(lastDanceClaim, effectiveSettings);
    if (!uid || !dancingEnabled) return false;

    if (isDanceWindowOpen) {
      await writeDancePresence(true);
      return true;
    }

    if (cooldownRemaining > 0) return false;

    try {
      // Determine activity ID - use live dancing activity or create a persistent one
      const activityId = liveActivity?.type === 'dancing' && liveActivity.activityId
        ? liveActivity.activityId
        : `dance-persistent-${showId}`;

      const claimedMedian = currentMedian ?? effectiveSettings.dancing_floor;

      // Write to responses (for scoring by Cloud Functions)
      await set(ref(db, getPath(`responses/${activityId}/${uid}`)), {
        type: 'dance_claim',
        claimedAt: Date.now(),
        displayName: auth.currentUser?.displayName || 'Anonymous',
      });

      // Update dance claims record for cooldown tracking
      const newClaimCount = (lastDanceClaim?.claimCount || 0) + 1;
      await set(ref(db, getPath(`dance_claims/${uid}`)), {
        lastClaimAt: Date.now(),
        claimCount: newClaimCount,
        activityId,
      });

      // If on break, track points earned
      if (isOnBreak) {
        setPointsEarnedOnBreak((prev) => prev + claimedMedian);
      }

      return true;
    } catch (error) {
      console.error('Failed to claim dance points:', error);
      return false;
    }
  }, [getPath, showId, dancingEnabled, liveActivity, currentMedian, lastDanceClaim, effectiveSettings, isOnBreak, isDanceWindowOpen, writeDancePresence]);

  // Clear break timers
  const clearBreakTimers = useCallback(() => {
    if (breakTimeoutRef.current) {
      clearTimeout(breakTimeoutRef.current);
      breakTimeoutRef.current = null;
    }
    if (autoClaimIntervalRef.current) {
      clearInterval(autoClaimIntervalRef.current);
      autoClaimIntervalRef.current = null;
    }
  }, []);

  // Enter break mode
  const enterBreakMode = useCallback(async (mode: Exclude<BreakMode, 'off'>) => {
    // Clear any existing timers
    clearBreakTimers();

    // Set break state
    setBreakMode(mode);
    setBreakStartedAt(Date.now());
    setPointsEarnedOnBreak(0);

    // Auto-claim dance points immediately when entering break mode
    await claimDancePoints();

    // Set up auto-timeout
    const timeoutDuration = BREAK_TIMEOUTS[mode];
    breakTimeoutRef.current = setTimeout(() => {
      setBreakMode('off');
      setBreakStartedAt(null);
      clearBreakTimers();
    }, timeoutDuration);

    // Set up periodic auto-claim (respects cooldown via canClaimDance check)
    autoClaimIntervalRef.current = setInterval(async () => {
      if (dancingEnabled) {
        // Attempt claim - claimDancePoints checks cooldown at call time.
        await claimDancePoints();
      }
    }, AUTO_CLAIM_INTERVAL);
  }, [clearBreakTimers, claimDancePoints, dancingEnabled]);

  // Exit break mode
  const exitBreakMode = useCallback(() => {
    clearBreakTimers();
    setBreakMode('off');
    setBreakStartedAt(null);
    // Don't reset pointsEarnedOnBreak immediately - let UI show it briefly
    setTimeout(() => setPointsEarnedOnBreak(0), 2000);
  }, [clearBreakTimers]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearBreakTimers();
    };
  }, [clearBreakTimers]);

  const value = useMemo(
    () => ({
        showId,
        isTestShow,
        settings: effectiveSettings,
        liveActivity,
        liveTrivia,
        liveSet,
        liveDanceWindow,
        liveCallup,
        liveMoment,
        isRealtimeConnected,
        dancingEnabled,
        currentMedian,
        lastDanceClaim,
        breakMode,
        pointsEarnedOnBreak,
        breakStartedAt,
        isOnBreak,
        claimDancePoints,
        enterBreakMode,
        exitBreakMode,
      }),
    [
      showId,
      isTestShow,
      effectiveSettings,
      liveActivity,
      liveTrivia,
      liveSet,
      liveDanceWindow,
      liveCallup,
      liveMoment,
      isRealtimeConnected,
      dancingEnabled,
      currentMedian,
      lastDanceClaim,
      breakMode,
      pointsEarnedOnBreak,
      breakStartedAt,
      isOnBreak,
      claimDancePoints,
      enterBreakMode,
      exitBreakMode,
    ]
  );

  return (
    <ShowContext.Provider value={value}>
      <DanceCooldownProvider
        dancingEnabled={dancingEnabled}
        lastDanceClaim={lastDanceClaim}
        settings={effectiveSettings}
      >
        {children}
      </DanceCooldownProvider>
    </ShowContext.Provider>
  );
}

export function useShow() {
  const context = useContext(ShowContext);
  if (!context) {
    throw new Error('useShow must be used within ShowProvider');
  }
  return context;
}

export function useDanceCooldown() {
  const context = useContext(DanceCooldownContext);
  if (!context) {
    throw new Error('useDanceCooldown must be used within ShowProvider');
  }
  return context;
}
