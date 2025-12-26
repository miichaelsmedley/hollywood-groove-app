import { RTDB_PREFIX } from './firebase';

export const IS_TEST_MODE = RTDB_PREFIX.startsWith('test/');

