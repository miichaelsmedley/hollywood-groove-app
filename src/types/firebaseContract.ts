// 1. Show Metadata (Public read)
// Path: shows/{showId}/meta
export interface ShowMeta {
  title: string;
  startDate: string; // ISO 8601 string
  venueName: string;
  schemaVersion: number;
  publishedAt: number; // Timestamp
}

// 2. Crowd Activity (Public read)
// Path: shows/{showId}/activities/{activityId}
export type ActivityType =
  | 'trivia'
  | 'dancing'
  | 'sing_signup'
  | 'backup_singer'
  | 'costume_contest'
  | 'competition'
  | 'stage_participation'
  | 'vote'
  | 'raffle';

export interface BaseActivity {
  type: ActivityType;
  title: string;
  sequence?: number;
  setId?: number;
  songId?: number;
  description?: string;
  prompt?: string;
  prize?: string;
  maxParticipants?: number;
  dancing?: {
    prompt?: string;
    current_median?: number;
  };
  options?: {
    index: number;
    text: string;
  }[];
}

export interface TriviaActivity extends BaseActivity {
  type: 'trivia';
  trivia: {
    question: string;
    // Controller uses `freeform`; keep `text` as a backward-compatible alias.
    kind: 'multi' | 'freeform' | 'text' | 'boolean' | 'scale';
    durationSeconds?: number;
    image?: {
      mimeType: 'image/png' | 'image/jpeg';
      base64: string;
    };
    options?: {
      index: number;
      text: string;
    }[];
    scale?: {
      min: number;
      max: number;
      step?: number;
      leftLabel?: string;
      rightLabel?: string;
    };
  };
}

// Union type for all activities
export type CrowdActivity = TriviaActivity | BaseActivity;

// 3. Show Settings (Controller writes, PWA reads)
// Path: shows/{showId}/settings
export type DancingMode = 'per_song' | 'interval' | 'activity' | 'disabled';

export interface ShowSettings {
  dancing_mode: DancingMode;
  dancing_cooldown_minutes: number;
  dancing_floor: number;
  dancing_cap: number;
  streak_mode?: 'per_round' | 'per_show' | 'disabled';
  score_compression?: boolean;
  leader_gap_alert?: number;
}

// 4. Live State (Public read, minimal traffic)
// Path: shows/{showId}/live/trivia
export type TriviaPhase = 'idle' | 'question' | 'answer';

export interface LiveTriviaState {
  activityId: string | null;
  phase: TriviaPhase;
  startedAt: number;      // Server timestamp
  durationSeconds: number;
  revealedWinnerUid?: string | null;
}

// Path: shows/{showId}/live/activity
export interface LiveActivityState {
  activityId: string | null;
  type: ActivityType;
  status: 'active' | 'ended';
  startedAt: number;
  currentMedian?: number;      // Dancing only
  prompt?: string;             // Participation activities
  slotsAvailable?: number;     // Participation activities
  fixedPoints?: number;        // Participation activities
}

// 4. User Response (Write only)
// Path: shows/{showId}/responses/{activityId}/{uid}
export interface UserResponse {
  optionIndex?: number; // For multi-choice
  text?: string | null; // For free text inputs
  booleanValue?: boolean; // For boolean inputs
  scaleValue?: number; // For sliding scale inputs
  answeredAt: number;   // Timestamp (ms since epoch)
  responseTime?: number; // Milliseconds elapsed since question start
  displayName: string;
}

// 5. User Score (Read only - calculated by Cloud Functions)
// Path: shows/{showId}/scores/{uid}
export interface UserScore {
  displayName: string;
  totalScore: number;
  correctCount: number;
  breakdown?: {
    trivia?: number;
    dancing?: number;
    participation?: number;
    starting_bonus?: number;
  };
  currentStreak?: number;
  tier?: string | null;
  lastAnsweredAt: number;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalScore: number;
  tier?: string | null;
}

export interface ShowLeaderboard {
  updatedAt?: number;
  top?: LeaderboardEntry[];
}

export interface AllTimeLeaderboardEntry {
  member_id: string;
  display_name: string;
  stars: number;
  tier?: string | null;
}

export interface AllTimeLeaderboard {
  updatedAt?: number;
  top?: AllTimeLeaderboardEntry[];
}

export interface MemberProfile {
  display_name: string;
  email_hash?: string | null;
  created_at: number;
  auth_provider: string;
  stars: {
    total: number;
    tier: string;
    starting_bonus: number;
    breakdown: {
      shows_attended: number;
      trivia_participated: number;
      dancing_engaged: number;
      stage_participation: number;
      between_show_trivia: number;
      referrals: number;
      early_tickets: number;
      social_shares: number;
      feedback_given: number;
    };
    last_show_date?: string | null;
    decay_warning_sent?: boolean;
    decay_warning_sent_at?: number | null;
    total_stars_decayed?: number;
  };
  email_opt_in?: boolean;
  sms_opt_in?: boolean;
}

// 6. User Profile (User writes, app reads)
// Path: users/{uid}
export interface UserProfile {
  uid: string;
  displayName: string;
  email?: string;
  phone?: string;
  createdAt: number;
  lastSeenAt: number;
  showsAttended: string[]; // Array of show IDs
  preferences: {
    marketingEmails: boolean;
    marketingSMS: boolean;
    notifications: boolean;
  };
}
