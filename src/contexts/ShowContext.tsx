import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { ref, onValue, set } from 'firebase/database';
import { auth, db, rtdbPath } from '../lib/firebase';
import { ShowSettings, LiveActivityState, LiveTriviaState } from '../types/firebaseContract';

interface DanceClaimRecord {
  lastClaimAt: number;
  claimCount: number;
  activityId: string;
}

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

  // Break state
  isOnBreak: boolean;
  setIsOnBreak: (value: boolean) => void;

  // Actions
  claimDancePoints: () => Promise<boolean>;
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
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Listen to show settings
  useEffect(() => {
    const settingsRef = ref(db, rtdbPath(`shows/${showId}/settings`));
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
    const activityRef = ref(db, rtdbPath(`shows/${showId}/live/activity`));
    const unsubscribe = onValue(activityRef, (snapshot) => {
      const data = snapshot.val();
      setLiveActivity(data as LiveActivityState | null);
    });
    return () => unsubscribe();
  }, [showId]);

  // Listen to live trivia state
  useEffect(() => {
    const triviaRef = ref(db, rtdbPath(`shows/${showId}/live/trivia`));
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

    const claimsRef = ref(db, rtdbPath(`shows/${showId}/dance_claims/${uid}`));
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

  const canClaimDance = dancingEnabled && !isOnBreak && cooldownRemaining === 0;

  // Claim dance points
  const claimDancePoints = useCallback(async (): Promise<boolean> => {
    const uid = auth.currentUser?.uid;
    if (!uid || !canClaimDance) return false;

    try {
      // Determine activity ID - use live dancing activity or create a persistent one
      const activityId = liveActivity?.type === 'dancing' && liveActivity.activityId
        ? liveActivity.activityId
        : `dance-persistent-${showId}`;

      // Write to responses (for scoring by Cloud Functions)
      await set(ref(db, rtdbPath(`shows/${showId}/responses/${activityId}/${uid}`)), {
        type: 'dance_claim',
        claimedAt: Date.now(),
        displayName: auth.currentUser?.displayName || 'Anonymous',
        median: currentMedian,
      });

      // Update dance claims record for cooldown tracking
      const newClaimCount = (lastDanceClaim?.claimCount || 0) + 1;
      await set(ref(db, rtdbPath(`shows/${showId}/dance_claims/${uid}`)), {
        lastClaimAt: Date.now(),
        claimCount: newClaimCount,
        activityId,
      });

      return true;
    } catch (error) {
      console.error('Failed to claim dance points:', error);
      return false;
    }
  }, [showId, canClaimDance, liveActivity, currentMedian, lastDanceClaim]);

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
        isOnBreak,
        setIsOnBreak,
        claimDancePoints,
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
