import { RTDB_PREFIX } from './firebase';

export const IS_TEST_MODE = RTDB_PREFIX.startsWith('test/');

/** Admin email for accessing diagnostics and dev tools */
export const ADMIN_EMAIL = 'miichael.smedley@gmail.com';

/** Check if the given email is an admin */
export const isAdminEmail = (email: string | null | undefined): boolean => {
  return email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
};

