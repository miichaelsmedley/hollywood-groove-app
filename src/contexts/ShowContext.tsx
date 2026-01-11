import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { auth, db } from '../lib/firebase';
import { ShowSettings, LiveActivityState, LiveTriviaState } from '../types/firebaseContract';
import { getShowPath } from '../lib/mode';

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

interface ShowContextType {
  showId: number | null;
  settings: ShowSettings | null;
  liveActivity: LiveActivityState | null;
  liveTrivia: LiveTriviaState | null;

  // Dancing state
  dancingEnabled: boolean;
  currentMedian: number | null;
  canClaimDance: boolean;
  cooldownRemaining: number; // seconds
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

// Default settings if not set by controller
const DEFAULT_SETTINGS: ShowSettings = {
  dancing_mode: 'interval',
  dancing_cooldown_minutes: 5,
  dancing_floor: 50,
  dancing_cap: 200,
};

interface ShowProviderProps {
  showId: number;
  children: ReactNode;
}

export function ShowProvider({ showId, children }: ShowProviderProps) {
  const [settings, setSettings] = useState<ShowSettings | null>(null);
  const [liveActivity, setLiveActivity] = useState<LiveActivityState | null>(null);
  const [liveTrivia, setLiveTrivia] = useState<LiveTriviaState | null>(null);
  const [lastDanceClaim, setLastDanceClaim] = useState<DanceClaimRecord | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Enhanced break mode state
  const [breakMode, setBreakMode] = useState<BreakMode>('off');
  const [pointsEarnedOnBreak, setPointsEarnedOnBreak] = useState(0);
  const [breakStartedAt, setBreakStartedAt] = useState<number | null>(null);

  // Refs for cleanup
  const breakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoClaimIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen to show settings
  useEffect(() => {
    const settingsRef = ref(db, getShowPath(String(showId), 'settings'));
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSettings(data as ShowSettings);
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    });
    return () => unsubscribe();
  }, [showId]);

  // Listen to live activity state
  useEffect(() => {
    const activityRef = ref(db, getShowPath(String(showId), 'live/activity'));
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val();
      setLiveActivity(data as LiveActivityState | null);
    });
    return () => unsubscribe();
  }, [showId]);

  // Listen to live trivia state
  useEffect(() => {
    const triviaRef = ref(db, getShowPath(String(showId), 'live/trivia'));
    const unsubscribe = onValue(triviaRef, (snapshot) => {
      const data = snapshot.val();
      setLiveTrivia(data as LiveTriviaState | null);
    });
    return () => unsubscribe();
  }, [showId]);

  // Listen to user's dance claims for cooldown tracking
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const claimsRef = ref(db, getShowPath(String(showId), `dance_claims/${uid}`));
    const unsubscribe = onValue(claimsRef, (snapshot) => {
      const data = snapshot.val();
      setLastDanceClaim(data as DanceClaimRecord | null);
    });
    return () => unsubscribe();
  }, [showId]);

  // Update cooldown timer
  useEffect(() => {
    if (!lastDanceClaim || !settings) {
      setCooldownRemaining(0);
      return;
    }

    const cooldownMs = settings.dancing_cooldown_minutes * 60 * 1000;
    const updateCooldown = () => {
      const elapsed = Date.now() - lastDanceClaim.lastClaimAt;
      const remaining = Math.max(0, cooldownMs - elapsed);
      setCooldownRemaining(Math.ceil(remaining / 1000));
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, [lastDanceClaim, settings]);

  // Derived state
  const effectiveSettings = settings || DEFAULT_SETTINGS;
  const dancingEnabled = effectiveSettings.dancing_mode !== 'disabled';

  // Get current median from live activity (if dancing) or use floor as default
  const currentMedian = liveActivity?.type === 'dancing' && liveActivity?.currentMedian != null
    ? liveActivity.currentMedian
    : effectiveSettings.dancing_floor;

  // Convenience derived state
  const isOnBreak = breakMode !== 'off';

  // Can claim if dancing is enabled and cooldown is done (break mode doesn't prevent claiming)
  const canClaimDance = dancingEnabled && cooldownRemaining === 0;

  // Claim dance points - returns points claimed or 0 if failed
  const claimDancePoints = useCallback(async (): Promise<boolean> => {
    const uid = auth.currentUser?.uid;
    if (!uid || !canClaimDance) return false;

    try {
      // Determine activity ID - use live dancing activity or create a persistent one
      const activityId = liveActivity?.type === 'dancing' && liveActivity.activityId
        ? liveActivity.activityId
        : `dance-persistent-${showId}`;

      const claimedMedian = currentMedian ?? effectiveSettings.dancing_floor;

      // Write to responses (for scoring by Cloud Functions)
      await set(ref(db, getShowPath(String(showId), `responses/${activityId}/${uid}`)), {
        type: 'dance_claim',
        claimedAt: Date.now(),
        displayName: auth.currentUser?.displayName || 'Anonymous',
        median: claimedMedian,
      });

      // Update dance claims record for cooldown tracking
      const newClaimCount = (lastDanceClaim?.claimCount || 0) + 1;
      await set(ref(db, getShowPath(String(showId), `dance_claims/${uid}`)), {
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
  }, [showId, canClaimDance, liveActivity, currentMedian, lastDanceClaim, effectiveSettings.dancing_floor, isOnBreak]);

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
    if (canClaimDance) {
      await claimDancePoints();
    }

    // Set up auto-timeout
    const timeoutDuration = BREAK_TIMEOUTS[mode];
    breakTimeoutRef.current = setTimeout(() => {
      setBreakMode('off');
      setBreakStartedAt(null);
      clearBreakTimers();
    }, timeoutDuration);

    // Set up periodic auto-claim (respects cooldown via canClaimDance check)
    autoClaimIntervalRef.current = setInterval(async () => {
      // Need to check dancingEnabled and cooldownRemaining directly since
      // canClaimDance might not update within the closure
      if (dancingEnabled) {
        // Attempt claim - claimDancePoints already checks canClaimDance
        await claimDancePoints();
      }
    }, AUTO_CLAIM_INTERVAL);
  }, [clearBreakTimers, canClaimDance, claimDancePoints, dancingEnabled]);

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

  return (
    <ShowContext.Provider
      value={{
        showId,
        settings: effectiveSettings,
        liveActivity,
        liveTrivia,
        dancingEnabled,
        currentMedian,
        canClaimDance,
        cooldownRemaining,
        lastDanceClaim,
        breakMode,
        pointsEarnedOnBreak,
        breakStartedAt,
        isOnBreak,
        claimDancePoints,
        enterBreakMode,
        exitBreakMode,
      }}
    >
      {children}
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
