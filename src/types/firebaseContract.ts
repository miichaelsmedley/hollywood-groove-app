// 0. Platform / franchise organizations
// Platform-owned member identity stays global under /members/{uid}; org records
// scope operator access, engagement, controller licensing, and show content.
export type OrganizationStatus = 'active' | 'paused' | 'suspended';
export type OrganizationLicenseTier = 'platform' | 'franchise' | 'trial' | 'cost_recovery';
export type OrgRole =
  | 'org_owner'
  | 'show_operator'
  | 'content_editor'
  | 'marketer'
  | 'door_staff';

export interface OrganizationTheme {
  displayName?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  logoUrl?: string;
  showTagline?: string;
}

// Path: organizations/{orgId}
export interface Organization {
  displayName: string;
  status: OrganizationStatus;
  licenseTier: OrganizationLicenseTier;
  theme: OrganizationTheme;
  allowedFeatures: Record<string, boolean>;
  controllerLicenseIds: string[];
  billing?: {
    billingStatus?: 'included' | 'trial' | 'active' | 'past_due' | 'paused';
    monthlyCostCapCents?: number;
    currency?: 'AUD';
  };
  usage?: {
    aiTokens?: number;
    aiCostCents?: number;
    emailSends?: number;
    storageMb?: number;
    lastCalculatedAt?: number;
  };
  createdAt: number;
  updatedAt: number;
}

// Path: organizations/{orgId}/controller_licenses/{controllerLicenseId}
export interface ControllerLicense {
  orgId: string;
  controllerLicenseId: string;
  status: 'active' | 'paused' | 'revoked';
  deviceName?: string;
  enabledFeatureFlags: string[];
  permittedShowIds: string[];
  theme?: OrganizationTheme;
  firebasePathPrefixPolicy: 'shows/{showId}';
  activatedByUid?: string;
  activatedAt?: number;
  lastSeenAt?: number;
}

export interface AiGenerationMetadata {
  generatorSource: 'manual' | 'ai_show_pack' | 'ai_daily_trivia' | string;
  modelUsed?: string;
  promptVersion?: string;
  inputTokens?: number;
  outputTokens?: number;
  costCents?: number;
  generatedAt?: number;
}

// Path: members/{uid}/org_roles/{orgId}
export interface OrgMembership {
  orgId: string;
  roles: OrgRole[];
  status: 'active' | 'paused' | 'revoked';
  grantedBy?: string;
  grantedAt?: number;
  updatedAt?: number;
}

// Path: members/{uid}/org_engagement/{orgId}
export interface OrgEngagementSummary {
  orgId: string;
  sourceShowId?: string;
  showsAttended: number;
  triviaPlayed: number;
  activitiesPlayed: number;
  ticketsPurchased: number;
  lastShowId?: string;
  lastEngagedAt?: number;
}

export type ReviewStatus = 'draft' | 'needs_review' | 'approved' | 'rejected';

// Path: organizations/{orgId}/show_packs/{showPackId}
export interface ShowPack {
  orgId: string;
  showId?: string;
  title: string;
  themeName?: string;
  status: ReviewStatus;
  generatedBy?: AiGenerationMetadata;
  approvedBy?: string;
  approvedAt?: number;
  stageTraxxMapping?: {
    stageTraxxShowId?: string;
    trackMappings: Record<string, string>;
    validatedAt?: number;
  };
  mediaAssetIds?: string[];
  activityIds?: string[];
  createdAt: number;
  updatedAt: number;
}

// Path: organizations/{orgId}/media_assets/{assetId}
export interface GeneratedMediaAsset {
  orgId: string;
  showPackId?: string;
  kind: 'image' | 'audio' | 'video' | 'map' | 'face_composite';
  storagePath?: string;
  publicUrl?: string;
  status: ReviewStatus;
  generatedBy?: AiGenerationMetadata;
  approvedBy?: string;
  approvedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// Path: campaigns/{campaignId}
export interface MarketingCampaign {
  orgId?: string;
  title: string;
  channel: 'email' | 'sms' | 'push' | 'social';
  status: 'draft' | 'requested' | 'approved' | 'scheduled' | 'sent' | 'cancelled';
  requestedByUid?: string;
  approvedByUid?: string;
  approvedAt?: number;
  audienceRule?: {
    memberOptInRequired: boolean;
    orgEngagementOrgId?: string;
    sourceShowId?: string;
  };
  resendBroadcastId?: string;
  scheduledAt?: number;
  sentAt?: number;
  createdAt: number;
  updatedAt: number;
}

// 1. Show Metadata (Public read)
// Path: shows/{showId}/meta
export interface ShowMeta {
  orgId?: string;
  platformOwner?: 'hollywood-groove';
  title: string;
  startDate: string; // ISO 8601 string
  venueName: string;
  schemaVersion: number;
  publishedAt: number; // Timestamp
  isTestShow?: boolean; // If true, only visible to testers
  ticketUrl?: string; // External URL to purchase tickets
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
  orgId?: string;
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
    kind: 'multi' | 'multiple_choice' | 'freeform' | 'text' | 'boolean' | 'scale';
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
  revealedCorrectAnswer?: string | null;
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

// Path: shows/{showId}/live/moment  (rich media moment — additive, v2.2)
export type MomentKind = 'image' | 'video' | 'audio' | 'map' | 'gallery';
export type MomentPhase = 'displaying' | 'idle';
export type MomentDisplayStyle = 'fullscreen' | 'lowerThird' | 'overlay';

export interface LiveMomentState {
  kind: MomentKind;
  phase: MomentPhase;
  targetDisplays: 'audience' | 'band' | 'both';
  displayStyle: MomentDisplayStyle;
  startedAt: number;            // Server timestamp
  title?: string;
  caption?: string;
  assetUrl?: string;            // Firebase Storage download URL (image/video/audio/map image)
  mimeType?: string;
  holdSeconds?: number;
  mapPins?: { lat: number; lng: number; label?: string }[];
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

// Social links structure
export interface SocialLinks {
  instagram?: string;  // Instagram username (without @)
  tiktok?: string;     // TikTok username (without @)
  facebook?: string;   // Facebook profile URL or username
  twitter?: string;    // X/Twitter username (without @)
  threads?: string;    // Threads username (without @)
  youtube?: string;    // YouTube channel URL or handle
  spotify?: string;    // Spotify profile URL
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

  // Extended profile fields (progressive profiling)
  suburb?: string;           // Area/suburb location
  socials?: SocialLinks;     // Social media links
  photo_url?: string;        // Profile picture URL (selfie, Google, or Gravatar)

  // Role-based permissions
  roles?: string[];
  org_roles?: Record<string, OrgMembership>;
  org_engagement?: Record<string, OrgEngagementSummary>;
  role_assigned_by?: string;
  role_assigned_at?: number;
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
  // Extended profile fields (progressive profiling)
  suburb?: string;           // Area/suburb location
  socials?: SocialLinks;     // Social media links
  photoURL?: string;         // Profile picture (selfie, Google, or Gravatar)
}

// ============================================
// TRIVIA LIBRARY (Between-Show Engagement)
// ============================================
// Path: trivia_library/

// Path: trivia_library/settings
export interface TriviaLibrarySettings {
  global_daily_limit: number;      // Max questions ANY user can answer per day
  default_user_limit: number;      // Default per-user daily limit
  timezone: string;                // For midnight reset (e.g., "Australia/Melbourne")
  star_daily_cap: number;          // Max stars earnable per day from trivia
  star_weekly_cap: number;         // Max stars earnable per week from trivia
  stars_per_threshold: number;     // Stars earned when threshold met (usually 1)
  star_threshold: number;          // Sum of star_values needed for 1 star (e.g., 3.0)
  ai_autopilot_enabled?: boolean;  // Opt-in automatic daily-question backfill
  ai_min_questions_per_pool?: number;
  ai_target_questions_per_pool?: number;
  ai_batch_size?: number;
  ai_model?: string;
}

// Path: trivia_library/categories/{categoryId}
export interface TriviaLibraryCategory {
  orgId?: string;                    // Optional org theme; omitted means global HG
  name: string;
  description: string;
  icon: string;                    // Lucide icon name
  color: string;                   // Hex color for UI
  subcategories?: string[];        // Optional groupings
  question_count: number;          // Auto-updated count
  activity_count: number;
  created_at: number;
  updated_at: number;
}

// Question option structure
export interface TriviaQuestionOption {
  index: number;
  text: string;
}

// Path: trivia_library/questions/{questionId}
export type TriviaQuestionDifficulty = 'easy' | 'medium' | 'hard';
export type TriviaQuestionType =
  | 'multiple_choice'
  | 'multi_select'
  | 'image_choice'
  | 'image_reveal'
  | 'mixed_image_faces'
  | 'guess_person'
  | 'map_guess_place'
  | 'pin_on_image'
  | 'type_answer'
  | 'closest_number'
  | 'ordering'
  | 'lyric_completion'
  | 'audio_clip'
  | 'true_false';

export interface TriviaLibraryQuestion {
  // Core fields
  orgId?: string;                    // Optional org/show-pack scope; omitted means global HG
  category_id: string;
  subcategory?: string;
  type: TriviaQuestionType;

  // Question content
  question: string;
  options?: TriviaQuestionOption[];
  correct_index?: number;
  correct_indices?: number[];
  correct_text?: string | string[];
  correct_order?: number[];
  numeric_answer?: number;
  numeric_tolerance?: number;
  map_target?: {
    lat: number;
    lng: number;
    radiusMeters?: number;
    label?: string;
  };
  image_hotspot?: {
    x: number;
    y: number;
    radius?: number;
    label?: string;
  };

  // Metadata
  difficulty: TriviaQuestionDifficulty;
  star_value: number;              // Contribution toward star threshold (e.g., 1.0)
  image_url?: string | null;
  audio_url?: string | null;
  audio_mime_type?: string | null;
  duration_seconds?: number;
  explanation?: string;            // Shown after answer

  // AI generation metadata (optional for seed data)
  created_at: number;
  created_by: string;              // "manual" or "ai_generator"
  model_used?: string;
  prompt_version?: string;
  generator_source?: 'manual' | 'ai_show_pack' | 'ai_daily_trivia' | string;
  review_status?: 'draft' | 'needs_review' | 'approved' | 'rejected';
  approved_by?: string;
  approved_at?: number;
  ai_cost_cents?: number;

  // Usage stats
  times_served: number;
  times_correct: number;
  correct_rate: number;

  // Flags
  active: boolean;
  reviewed: boolean;
}

// Path: trivia_library/activities/{activityId}
export type TriviaActivityType = 'yes_no' | 'rating' | 'poll' | 'opinion';

export interface TriviaLibraryActivity {
  // Core fields
  orgId?: string;
  category_id: string;
  subcategory?: string;
  type: TriviaActivityType;

  // Activity content
  question: string;
  options?: TriviaQuestionOption[];  // For yes_no, poll

  // For ratings
  rating_min?: number;
  rating_max?: number;
  rating_labels?: string[];

  // Metadata
  star_value: number;              // Participation = credit (e.g., 0.5)

  // Same metadata as questions
  created_at: number;
  created_by: string;
  active: boolean;
  times_served: number;
}

// Path: trivia_library/schedule/{date} (key format: "YYYY-MM-DD")
export interface TriviaLibrarySchedule {
  orgId?: string;                    // Optional org theme; omitted means global daily HG
  category_id: string;
  subcategory?: string;
  theme_name: string;
  description: string;
  priority: number;                // If multiple schedules, highest wins
  source?: 'manual' | 'auto';      // Optional metadata for scheduler ownership
  generated_at?: number;           // Auto scheduler timestamp (ms epoch)
  generator_version?: string;      // Scheduler version marker
  generated_question_count?: number;
}

// Path: trivia_library/usage/{userId}
export interface TriviaLibraryUsage {
  // Daily tracking (reset at midnight in configured timezone)
  questions_today: number;
  activities_today: number;
  last_activity_date: string;      // "YYYY-MM-DD" format

  // Star progress
  star_progress_today: number;     // Sum of star_values today
  stars_earned_today: number;      // Stars awarded today
  stars_earned_this_week: number;  // Stars awarded this week
  week_start_date: string;         // Monday of current week "YYYY-MM-DD"

  // History (avoid repeats)
  recent_questions: string[];      // Last N question IDs answered
  recent_activities: string[];     // Last N activity IDs completed

  // Lifetime stats
  total_questions_answered: number;
  total_correct: number;
  total_activities_completed: number;
  total_stars_from_engagement: number;
}

// ============================================
// TEAMS (Competitive Team Feature)
// ============================================

// Path: /teams/{teamId}
export interface Team {
  name: string;                     // Team display name (e.g., "The Smiths")
  code: string;                     // Join code (6-char alphanumeric, e.g., "HG4X9K")
  created_by: string;               // Owner's uid
  created_at: number;               // Timestamp
  settings: TeamSettings;
  member_count: number;             // Denormalized for quick reads
}

export interface TeamSettings {
  max_members: number;              // Default 8
  top_contributors: number;         // How many scores count (default 5)
}

// Path: /teams/{teamId}/members/{uid}
export interface TeamMember {
  display_name: string;
  joined_at: number;
  role: 'owner' | 'member';
  photo_url?: string;
}

// Stored in /members/{uid}/current_team
export interface MemberTeamInfo {
  team_id: string;
  team_name: string;
  joined_at: number;
  role: 'owner' | 'member';
}

// Path: /team_codes/{code}
export interface TeamCodeIndex {
  team_id: string;
  created_by?: string;
}

// Path: /shows/{showId}/team_scores/{teamId}
export interface TeamShowScore {
  team_name: string;
  combined_score: number;           // Sum of top N contributors
  member_scores: Record<string, { display_name: string; score: number }>;
  contributing_members: string[];   // UIDs of top N included in combined score
  updated_at: number;
}

// Path: /shows/{showId}/team_leaderboard
export interface TeamLeaderboardEntry {
  team_id: string;
  team_name: string;
  combined_score: number;
  member_count: number;
  rank?: number;
}

export interface TeamLeaderboard {
  top: TeamLeaderboardEntry[];
  updated_at: number;
}

export * from './ticketingContract';
