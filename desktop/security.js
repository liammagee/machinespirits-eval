// desktop/security.js
//
// Pure security helpers (no electron import) so they can be unit-tested under
// plain `node --test`. main.js wires them into the BrowserWindow / session.

/** Is `url` on the app's own loopback origin? */
export function isLoopbackUrl(url, base) {
  if (typeof url !== 'string' || !base) return false;
  return url === base || url.startsWith(base + '/') || url.startsWith(base + '?') || url.startsWith(base + '#');
}

/** Should this navigation target be handed to the system browser instead? */
export function shouldOpenExternally(url, base) {
  if (typeof url !== 'string') return false;
  if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return false;
  return !isLoopbackUrl(url, base);
}

/**
 * Content-Security-Policy that permits EXACTLY the external origins the bundled
 * UI uses (Google Fonts + jsDelivr) while keeping default-src locked to self.
 * Enumerated from the actual public/ + server-rendered pages — keep in sync if
 * the UI adds a new CDN. Alpine.js needs 'unsafe-eval'; inline <style>/<script>
 * in the pages need 'unsafe-inline'.
 */
export function buildCSP() {
  const CDN = 'https://cdn.jsdelivr.net';
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${CDN}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com ${CDN}`,
    `font-src 'self' data: https://fonts.gstatic.com ${CDN}`,
    "img-src 'self' data: blob: https:",
    "connect-src 'self'",
    "media-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** Encode an HTTP Basic credential pair. */
export function basicAuthHeader(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}
