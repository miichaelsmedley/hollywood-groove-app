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
  CSP_ENFORCE?: string;
}

// Flip to `true` to ENFORCE the Content-Security-Policy. It ships in
// report-only mode first: violations are logged to the browser console (and
// any report endpoint) but nothing is blocked. This lets us validate the live
// Google sign-in + Stripe checkout flows on a money-handling app before turning
// enforcement on. Rollout: deploy with this `false`, open the live site with
// DevTools, run through sign-in and buy a test ticket, confirm there are no CSP
// violations in the console, then set this to `true` and redeploy.
const CSP_ENFORCE = false;
const CSP_REPORT_PATH = "/csp-report";
const CSP_REPORT_GROUP = "csp-endpoint";

/**
 * Content-Security-Policy for the app shell (HTML documents only).
 *
 * The dangerous directives are tight: no inline/eval scripts, no plugins, the
 * page can't be framed (clickjacking), and <base> is locked. The allow-lists
 * enumerate the exact first-party + Google/Firebase origins the app uses:
 *   - script  : self + Google reCAPTCHA / App Check + YouTube IFrame API
 *   - connect : Firebase over *.googleapis.com (Firestore/Auth/AppCheck/Storage),
 *               RTDB websocket (wss://*.firebasedatabase.app), Cloud Functions
 *               callables (*.cloudfunctions.net), reCAPTCHA
 *   - img/media: self, data: (base64 trivia art), blob: (camera capture),
 *               Gravatar, Google avatars, Firebase Storage
 *   - frame   : reCAPTCHA challenge + Firebase Auth + weekly YouTube player
 * Stripe Checkout is a top-level redirect (window.location), not an embedded
 * frame or script, so it needs no script-src/frame-src entry.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "script-src 'self' https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://apis.google.com https://www.youtube.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.gravatar.com https://lh3.googleusercontent.com https://*.googleapis.com https://*.firebasestorage.app https://www.gstatic.com",
  "font-src 'self'",
  "media-src 'self' blob: https://*.firebasestorage.app https://firebasestorage.googleapis.com",
  "connect-src 'self' https://*.googleapis.com https://*.firebasedatabase.app wss://*.firebasedatabase.app https://*.cloudfunctions.net https://*.firebaseio.com https://www.google.com https://www.gstatic.com",
  "frame-src https://www.google.com https://www.gstatic.com https://www.recaptcha.net https://*.firebaseapp.com https://www.youtube.com https://www.youtube-nocookie.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_REPORT_GROUP}`,
].join("; ");

function shouldEnforceCsp(env: Env): boolean {
  const configured = env.CSP_ENFORCE;
  if (typeof configured === "undefined") return CSP_ENFORCE;
  const normalised = configured.trim().toLowerCase();
  if (!normalised) return CSP_ENFORCE;
  return normalised === "true" || normalised === "1";
}

function applySecurityHeaders(
  headers: Headers,
  isDocument: boolean,
  cspEnforce: boolean,
  origin: string,
): void {
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
      "Report-To",
      JSON.stringify({
        group: CSP_REPORT_GROUP,
        max_age: 10886400,
        endpoints: [{ url: `${origin}${CSP_REPORT_PATH}` }],
      }),
    );
    headers.set(
      "Reporting-Endpoints",
      `${CSP_REPORT_GROUP}="${origin}${CSP_REPORT_PATH}"`,
    );
    headers.set(
      cspEnforce ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only",
      CONTENT_SECURITY_POLICY,
    );
  }
}

async function handleCspReport(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: {
        Allow: "POST",
        "Cache-Control": "no-store",
      },
    });
  }

  // Cap what we read/log so a hostile client can't flood wrangler tail.
  const MAX_CSP_REPORT_CHARS = 8192;
  const raw = await request.text();
  const body = raw.length > MAX_CSP_REPORT_CHARS ? raw.slice(0, MAX_CSP_REPORT_CHARS) : raw;
  let report: unknown = body;
  try {
    report = body ? JSON.parse(body) : {};
  } catch {
    // Keep malformed (or truncated) reports visible in wrangler tail rather than rejecting them.
  }
  console.log("CSP violation report", JSON.stringify(report));

  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === CSP_REPORT_PATH) {
      return handleCspReport(request);
    }

    // Let the static-assets runtime serve the file (or SPA-fall back to index.html).
    const assetResponse = await env.ASSETS.fetch(request);

    // Clone headers so we can mutate them.
    const headers = new Headers(assetResponse.headers);

    const isDocument = (headers.get("Content-Type") ?? "").includes("text/html");
    applySecurityHeaders(headers, isDocument, shouldEnforceCsp(env), url.origin);

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
