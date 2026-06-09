// Safe resolution of user-supplied `?return=` redirect targets.
//
// A `return` query param that is reflected into an <a href> or a router
// navigation is an open-redirect / `javascript:`-URI sink if used verbatim.
// These helpers constrain it to in-app paths (or, for anchors, a small
// allow-list of trusted Hollywood Groove / Adele Show hosts) and fall back to
// a safe default otherwise. Mirrors the `returnPath.startsWith('/')` guard the
// email-link sender already applies in lib/auth.ts.

/** Hosts an absolute post-auth redirect is allowed to navigate to. */
const TRUSTED_REDIRECT_HOSTS = ["hollywoodgroove.com.au", "adeleshow.com.au"];

function isTrustedHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return TRUSTED_REDIRECT_HOSTS.some(
    (base) => host === base || host.endsWith(`.${base}`),
  );
}

/** True for a safe root-relative path (not protocol-relative `//evil.com`). */
function isInternalPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}

/**
 * Returns `value` only if it is a safe in-app path; otherwise `fallback`.
 * Use for client-side router navigation (e.g. react-router `navigate`).
 * Rejects absolute URLs, protocol-relative URLs, and `javascript:`/`data:` URIs.
 */
export function safeInternalPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (value && isInternalPath(value)) return value;
  return fallback;
}

/**
 * Resolves a user-supplied `return` URL for an anchor href. Accepts a safe
 * in-app path, or an absolute https URL pointing at a trusted host. Anything
 * else (other origins, http, protocol-relative, `javascript:`/`data:`) falls
 * back to `fallback`.
 */
export function safeReturnUrl(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value) return fallback;
  if (isInternalPath(value)) return value;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && isTrustedHost(url.hostname)) {
      return url.toString();
    }
  } catch {
    // Not a parseable absolute URL — fall through to the default.
  }
  return fallback;
}
