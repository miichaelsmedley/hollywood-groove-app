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
