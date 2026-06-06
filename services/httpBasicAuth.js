/**
 * httpBasicAuth.js — shared HTTP Basic auth guard for the repo's two internal
 * servers (server.js, scripts/browse-poetics-scripts.js).
 *
 * Both servers expose unauthenticated, money-spending endpoints and are built on
 * a localhost trust model. This guard makes a public bind safe by construction:
 *
 *   - credentials present              → auth is enforced on every request
 *   - no credentials, localhost bind   → open (frictionless local dev)
 *   - no credentials, NON-local bind   → resolveBasicAuthGuard() THROWS, so the
 *                                        server refuses to start exposed-and-open
 *
 * Credentials come from <PREFIX>_AUTH_USER / <PREFIX>_AUTH_PASS (e.g.
 * POETICS_AUTH_USER, EVAL_AUTH_USER), falling back to the shared
 * MS_AUTH_USER / MS_AUTH_PASS so one pair can cover both servers.
 */
import { timingSafeEqual } from 'node:crypto';

// Loopback forms Node may report for a "localhost" bind. Anything outside this
// set is treated as public, and therefore requires credentials.
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);

export function isLocalHost(host) {
  return LOCAL_HOSTS.has(
    String(host == null ? '' : host)
      .trim()
      .toLowerCase(),
  );
}

// Constant-time equality. Unequal-length inputs can't be compared by
// timingSafeEqual (it throws on length mismatch), so we run a throwaway equal
// compare to keep the reject path from being trivially faster, then return false.
function safeEqual(a, b) {
  const ab = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

// Parse an `Authorization: Basic <base64>` header into { user, pass }, or null.
export function parseBasicAuthHeader(header) {
  const m = /^\s*Basic\s+([A-Za-z0-9+/=]+)\s*$/.exec(header || '');
  if (!m) return null;
  let decoded;
  try {
    decoded = Buffer.from(m[1], 'base64').toString('utf8');
  } catch {
    return null;
  }
  const i = decoded.indexOf(':');
  if (i < 0) return null; // a Basic credential is always user:pass
  return { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
}

// Express middleware enforcing one username/password pair.
export function basicAuthMiddleware({ user, pass, realm = 'machine spirits' }) {
  if (!user || !pass) throw new Error('basicAuthMiddleware requires user and pass');
  return function basicAuth(req, res, next) {
    const creds = parseBasicAuthHeader(req.headers.authorization);
    if (creds && safeEqual(creds.user, user) && safeEqual(creds.pass, pass)) {
      return next();
    }
    res.set('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    return res.status(401).type('text/plain').send('Authentication required.\n');
  };
}

/**
 * Resolve the auth middleware for a server about to bind `host`.
 * @returns an Express middleware when credentials are configured, or `null`
 *          when running open on localhost. THROWS when a non-local host is
 *          requested without credentials (fail-safe: never expose unauthenticated).
 */
export function resolveBasicAuthGuard({ env = process.env, prefix, host, realm = 'machine spirits' }) {
  const user = env[`${prefix}_AUTH_USER`] || env.MS_AUTH_USER;
  const pass = env[`${prefix}_AUTH_PASS`] || env.MS_AUTH_PASS;
  if (user && pass) return basicAuthMiddleware({ user, pass, realm });
  if (!isLocalHost(host)) {
    throw new Error(
      `[basic-auth] Refusing to bind non-local host "${host}" without credentials. ` +
        `Set ${prefix}_AUTH_USER and ${prefix}_AUTH_PASS (or MS_AUTH_USER / MS_AUTH_PASS).`,
    );
  }
  return null; // localhost, no creds → open dev mode
}
