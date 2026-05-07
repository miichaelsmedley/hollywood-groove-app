import type { User } from 'firebase/auth';
import { HAS_LOCAL_TEST_ACCESS } from './firebase';

// Whether user can see test shows (via URL code or Firebase /testers/{uid})
// This is determined by UserContext checking both local access and Firebase testers list
export const HAS_TEST_ACCESS = HAS_LOCAL_TEST_ACCESS;

// Backwards compatibility - now means "can see test content" not "use test paths"
export const IS_TEST_MODE = HAS_LOCAL_TEST_ACCESS || import.meta.env.DEV;

/** Admin email for accessing diagnostics and dev tools */
export const ADMIN_EMAIL = 'miichael.smedley@gmail.com';

/** Check if the given email is an admin */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

/** Check whether the current Firebase ID token carries the custom admin claim. */
export const hasPlatformAdminClaim = async (user: User | null | undefined): Promise<boolean> => {
  if (!user) {
    return false;
  }

  const tokenResult = await user.getIdTokenResult();
  return tokenResult.claims.platform_admin === true;
};

/**
 * Transition-only admin check.
 * Phase 0.5 moves admin authority to custom claims. The email fallback is kept
 * until existing admins are migrated and production RTDB rules are tightened.
 */
export const isTransitionAdminUser = async (user: User | null | undefined): Promise<boolean> => {
  if (!user) {
    return false;
  }

  try {
    if (await hasPlatformAdminClaim(user)) {
      return true;
    }
  } catch (error) {
    console.warn('Admin claim check failed', error);
  }

  return isAdminEmail(user.email);
};

/**
 * Get the base path for PRODUCTION show data in Firebase.
 * Always returns 'shows' - use getTestShowBasePath() for test shows.
 */
export const getShowBasePath = (): string => {
  return 'shows';
};

/**
 * Get the base path for TEST show data in Firebase.
 * Always returns 'test/shows'.
 */
export const getTestShowBasePath = (): string => {
  return 'test/shows';
};

/**
 * Get the full Firebase path for a specific PRODUCTION show.
 * @param showId The show ID
 * @param suffix Optional path suffix (e.g., 'meta', 'attendees', 'scores')
 */
export const getShowPath = (showId: string, suffix?: string): string => {
  const basePath = getShowBasePath();
  if (suffix) {
    return `${basePath}/${showId}/${suffix}`;
  }
  return `${basePath}/${showId}`;
};

/**
 * Get the full Firebase path for a specific TEST show.
 * @param showId The show ID
 * @param suffix Optional path suffix (e.g., 'meta', 'attendees', 'scores')
 */
export const getTestShowPath = (showId: string, suffix?: string): string => {
  const basePath = getTestShowBasePath();
  if (suffix) {
    return `${basePath}/${showId}/${suffix}`;
  }
  return `${basePath}/${showId}`;
};
