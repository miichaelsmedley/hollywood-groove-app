import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getDatabase } from "firebase/database";

// Test access code for easy tester onboarding (shared secret)
const TEST_ACCESS_CODE = 'groove2024';

// Check for test access via URL query parameter
// This grants the user tester privileges (can see test shows)
function checkTestAccess(): boolean {
  if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search);
    const hasTestAccess = localStorage.getItem('hg_test_access') === 'true';

    // Check for test access code in URL - grants persistent test access
    const testCode = urlParams.get('testCode');
    if (testCode === TEST_ACCESS_CODE) {
      console.log('✅ Test access granted via code');
      localStorage.setItem('hg_test_access', 'true');
      // Reload without query param
      window.location.href = window.location.pathname;
      return true;
    }

    return hasTestAccess;
  }
  return false;
}

// Whether this user has test access (can see test shows)
// This is set via URL code or Firebase /testers/{uid} entry
export const HAS_LOCAL_TEST_ACCESS = checkTestAccess();

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

console.log('🔧 Firebase initialized (single path mode - no test prefix)');
console.log('🌐 Current origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR');
console.log('🔑 Auth domain:', firebaseConfig.authDomain);

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

// Promise that resolves when auth persistence is configured
// Components should await this before relying on auth state
export const authPersistenceReady: Promise<void> = (async () => {
  try {
    // Set persistence to localStorage for better reliability across redirects
    // This ensures auth state survives the OAuth redirect on mobile browsers
    // IMPORTANT: In incognito mode, localStorage is available but cleared when window closes
    await setPersistence(auth, browserLocalPersistence);
    console.log('✅ Firebase auth persistence set to localStorage');
  } catch (error) {
    console.error('⚠️ Failed to set auth persistence:', error);
  }
})();

export default app;
