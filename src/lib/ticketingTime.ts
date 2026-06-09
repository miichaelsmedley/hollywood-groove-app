// Shared coercion for the date shapes that flow through ticketing data:
// a Firestore Timestamp, a JS Date, epoch milliseconds, an ISO string, or a
// { seconds } object. This logic was previously hand-copied into ~8 call sites
// (Play / Admin / Event / Claim / Scanner / View / wallet) that had quietly
// drifted — some handled strings and { seconds }, others didn't. Single source.

/** Coerce any supported timestamp shape into a Date, or null if unparseable. */
export function toTicketingDate(value: unknown): Date | null {
  let date: Date | null = null;

  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    date = new Date((value as { toMillis: () => number }).toMillis());
  } else if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number") {
    date = new Date(value);
  } else if (typeof value === "string") {
    date = new Date(value);
  } else if (
    value &&
    typeof value === "object" &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  }

  if (!date || !Number.isFinite(date.getTime())) return null;
  return date;
}

/** Coerce any supported timestamp shape into epoch ms, or null if unparseable. */
export function toTicketingMillis(value: unknown): number | null {
  return toTicketingDate(value)?.getTime() ?? null;
}
