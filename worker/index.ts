/**
 * Hollywood Groove PWA — Cloudflare Worker entry.
 *
 * The Vite build output in ./dist is served via the [assets] binding
 * (see wrangler.toml). This worker wraps each response to attach the
 * security headers and webmanifest MIME type that were previously
 * configured in staticwebapp.config.json on Azure Static Web Apps.
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Let the static-assets runtime serve the file (or SPA-fall back to index.html).
    const assetResponse = await env.ASSETS.fetch(request);

    // Clone headers so we can mutate them.
    const headers = new Headers(assetResponse.headers);

    // Security headers — match previous Azure SWA globalHeaders.
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");

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
