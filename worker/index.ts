/**
 * Hollywood Groove PWA — Cloudflare Worker entry.
 *
 * The Vite build output in ./dist is served via the [assets] binding
 * (see wrangler.toml). This worker wraps each response to attach the
 * security headers and webmanifest MIME type on top of the static-assets
 * runtime.
 *
 * SPA routing (navigationFallback) is handled by the static assets
 * runtime via `not_found_handling = "single-page-application"` — any
 * request that doesn't match a built file returns /index.html with
 * status 200. That covers React Router routes AND the Firebase Auth
 * `/__/auth/*` paths the previous config rewrote explicitly.
 */

interface Env {
  ASSETS: Fetcher;
}

// Flip to `true` to ENFORCE the Content-Security-Policy. It ships in
// report-only mode first: violations are logged to the browser console (and
// any report endpoint) but nothing is blocked. This lets us validate the live
// Google sign-in + Stripe checkout flows on a money-handling app before turning
// enforcement on. Rollout: deploy with this `false`, open the live site with
// DevTools, run through sign-in and buy a test ticket, confirm there are no CSP
// violations in the console, then set this to `true` and redeploy.
const CSP_ENFORCE = false;

/**
 * Content-Security-Policy for the app shell (HTML documents only).
 *
 * The dangerous directives are tight: no inline/eval scripts, no plugins, the
 * page can't be framed (clickjacking), and <base> is locked. The allow-lists
 * enumerate the exact first-party + Google/Firebase origins the app uses:
 *   - script  : self + Google reCAPTCHA / App Check loaders
 *   - connect : Firebase over *.googleapis.com (Firestore/Auth/AppCheck/Storage),
 *               RTDB websocket (wss://*.firebasedatabase.app), Cloud Functions
 *               callables (*.cloudfunctions.net), reCAPTCHA
 *   - img/media: self, data: (base64 trivia art), blob: (camera capture),
 *               Gravatar, Google avatars, Firebase Storage
 *   - frame   : reCAPTCHA challenge + Firebase Auth iframe
 * Stripe Checkout is a top-level redirect (window.location), not an embedded
 * frame or script, so it needs no script-src/frame-src entry.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.gravatar.com https://lh3.googleusercontent.com https://*.googleapis.com https://*.firebasestorage.app https://www.gstatic.com",
  "font-src 'self'",
  "media-src 'self' blob: https://*.firebasestorage.app https://firebasestorage.googleapis.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.cloudfunctions.net https://*.firebaseio.com https://www.google.com https://www.gstatic.com",
  "frame-src https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://*.firebaseapp.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

function applySecurityHeaders(headers: Headers, isDocument: boolean): void {
  // Safe on every response (assets + documents).
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), payment=()",
  );

  // Document-only: the CSP and the cross-origin opener policy that the Firebase
  // Auth sign-in popup relies on (same value as the Vite dev server).
  if (isDocument) {
    headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
    headers.set(
      CSP_ENFORCE ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      CONTENT_SECURITY_POLICY,
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Let the static-assets runtime serve the file (or SPA-fall back to index.html).
    const assetResponse = await env.ASSETS.fetch(request);

    // Clone headers so we can mutate them.
    const headers = new Headers(assetResponse.headers);

    const isDocument = (headers.get("Content-Type") ?? "").includes("text/html");
    applySecurityHeaders(headers, isDocument);

    // Custom MIME type for .webmanifest (Azure SWA mimeTypes equivalent).
    if (url.pathname.endsWith(".webmanifest")) {
      headers.set("Content-Type", "application/manifest+json");
    }

    return new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
