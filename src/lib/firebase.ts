import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

function normalizeRtdbPrefix(prefix: string): string {
  const trimmed = prefix.trim();
  if (trimmed.length === 0) return "";
  const withoutLeadingSlashes = trimmed.replace(/^\/+/, "");
  return withoutLeadingSlashes.endsWith("/")
    ? withoutLeadingSlashes
    : `${withoutLeadingSlashes}/`;
}

const defaultRtdbPrefix = import.meta.env.DEV ? "test/" : "";

export const RTDB_PREFIX = normalizeRtdbPrefix(
  typeof import.meta.env.VITE_RTDB_PREFIX === "string"
    ? import.meta.env.VITE_RTDB_PREFIX
    : defaultRtdbPrefix
);

export function rtdbPath(path: string): string {
  const trimmed = path.replace(/^\/+/, "");
  return `${RTDB_PREFIX}${trimmed}`;
}

const firebaseConfig = {
  apiKey: "AIzaSyCg-2pHPaQjn2p9wdboksZGxhFyCJXG6SQ",
  authDomain: "theta-inkwell-448908-g9.firebaseapp.com",
  databaseURL:
    "https://theta-inkwell-448908-g9-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "theta-inkwell-448908-g9",
  storageBucket: "theta-inkwell-448908-g9.firebasestorage.app",
  messagingSenderId: "491349312100",
  appId: "1:491349312100:web:d688fd9d4ffff2e2115571",
  measurementId: "G-8NMHF3ZPWQ",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);

export default app;
