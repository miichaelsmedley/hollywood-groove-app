import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

function normalizeRtdbPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (trimmed.length === 0) return "";
  const withoutLeadingSlashes = trimmed.replace(/^\/+/, "");
  return withoutLeadingSlashes.endsWith("/")
    ? withoutLeadingSlashes
    : `${withoutLeadingSlashes}/`;
}

// Check for test mode override via URL query parameter or localStorage
function getTestModeOverride(): boolean {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const currentTestMode = localStorage.getItem('hg_test_mode') === 'true';

    // Allow ?testMode=true to enable test mode
    if (urlParams.get('testMode') === 'true') {
      if (!currentTestMode) {
        localStorage.setItem('hg_test_mode', 'true');
        // Reload without query param to apply new mode
        window.location.href = window.location.pathname;
        return true;
      }
      return true;
    }
    // Allow ?testMode=false to disable test mode
    if (urlParams.get('testMode') === 'false') {
      if (currentTestMode) {
        localStorage.removeItem('hg_test_mode');
        // Reload without query param to apply new mode
        window.location.href = window.location.pathname;
        return false;
      }
      return false;
    }
    // Check localStorage for persisted test mode
    return currentTestMode;
  }
  return false;
}

const isTestModeOverride = getTestModeOverride();
const defaultRtdbPrefix = import.meta.env.DEV || isTestModeOverride ? "test/" : "";

// Log prefix for debugging
if (typeof window !== 'undefined') {
  console.log(`🔧 Firebase RTDB prefix: "${defaultRtdbPrefix}" (testMode: ${isTestModeOverride}, DEV: ${import.meta.env.DEV})`);
}

// Export for debugging
export const IS_TEST_MODE = isTestModeOverride || import.meta.env.DEV;

export const RTDB_PREFIX = normalizeRtdbPrefix(
  typeof import.meta.env.VITE_RTDB_PREFIX === "string"
    ? import.meta.env.VITE_RTDB_PREFIX
    : defaultRtdbPrefix
);

export function rtdbPath(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return `${RTDB_PREFIX}${trimmed}`;
}

// Firebase configuration - uses environment variables from Azure
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCg-2pHPaQjn2p9wdboksZGxhFyCJXG6SQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "theta-inkwell-448908-g9.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    "https://theta-inkwell-448908-g9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "theta-inkwell-448908-g9",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "theta-inkwell-448908-g9.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "491349312100",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:491349312100:web:d688fd9d4ffff2e2115571",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-8NMHF3ZPWQ",
};

console.log('🔧 Firebase authDomain configured as:', firebaseConfig.authDomain);

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

// Set persistence to localStorage for better reliability across redirects
// This ensures auth state survives the OAuth redirect on mobile browsers
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('✅ Firebase auth persistence set to localStorage');
  })
  .catch((error) => {
    console.error('⚠️ Failed to set auth persistence:', error);
  });

export default app;
