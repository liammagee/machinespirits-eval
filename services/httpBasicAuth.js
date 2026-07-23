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
      req.evalRole = 'admin'; // a single-pair guard authenticates the admin role
      return next();
    }
    res.set('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    return res.status(401).type('text/plain').send('Authentication required.\n');
  };
}

// Express middleware enforcing TWO credential pairs and tagging the request with
// its role. `admin` and/or `participant` may be null (a null pair can never be
// matched). On success sets req.evalRole = 'admin' | 'participant'; on failure
// issues the same 401 + WWW-Authenticate challenge as the single-pair guard.
export function roleAuthMiddleware({ admin = null, participant = null, realm = 'machine spirits' }) {
  if (!admin && !participant) throw new Error('roleAuthMiddleware requires at least one credential pair');
  return function roleAuth(req, res, next) {
    const creds = parseBasicAuthHeader(req.headers.authorization);
    if (creds) {
      if (admin && safeEqual(creds.user, admin.user) && safeEqual(creds.pass, admin.pass)) {
        req.evalRole = 'admin';
        return next();
      }
      if (participant && safeEqual(creds.user, participant.user) && safeEqual(creds.pass, participant.pass)) {
        req.evalRole = 'participant';
        return next();
      }
    }
    res.set('WWW-Authenticate', `Basic realm="${realm}", charset="UTF-8"`);
    return res.status(401).type('text/plain').send('Authentication required.\n');
  };
}

/**
 * Resolve the auth middleware for a server about to bind `host`.
 *
 * Two roles are supported (Design A — perimeter RBAC):
 *   - admin       — <PREFIX>_AUTH_USER/PASS         (or shared MS_AUTH_USER/PASS)
 *   - participant — <PREFIX>_PARTICIPANT_USER/PASS  (or MS_PARTICIPANT_USER/PASS)
 * When a participant pair is configured the guard becomes role-aware and tags
 * req.evalRole; pair it with makeRoleGate() to default-deny the non-allowlisted
 * surfaces to the participant role. With only an admin pair it stays the simple
 * single-pair guard (backward-compatible with every existing deploy).
 *
 * @returns Express middleware when ANY credentials are configured; `null` when
 *          running open on localhost (req.evalRole stays undefined → treated as
 *          admin by makeRoleGate). THROWS when a non-local host is requested
 *          with NO credentials at all (fail-safe: never expose unauthenticated).
 */
export function resolveBasicAuthGuard({ env = process.env, prefix, host, realm = 'machine spirits' }) {
  const adminUser = env[`${prefix}_AUTH_USER`] || env.MS_AUTH_USER;
  const adminPass = env[`${prefix}_AUTH_PASS`] || env.MS_AUTH_PASS;
  const partUser = env[`${prefix}_PARTICIPANT_USER`] || env.MS_PARTICIPANT_USER;
  const partPass = env[`${prefix}_PARTICIPANT_PASS`] || env.MS_PARTICIPANT_PASS;
  const admin = adminUser && adminPass ? { user: adminUser, pass: adminPass } : null;
  const participant = partUser && partPass ? { user: partUser, pass: partPass } : null;

  if (participant) return roleAuthMiddleware({ admin, participant, realm });
  if (admin) return basicAuthMiddleware({ user: admin.user, pass: admin.pass, realm });
  if (!isLocalHost(host)) {
    throw new Error(
      `[basic-auth] Refusing to bind non-local host "${host}" without credentials. ` +
        `Set ${prefix}_AUTH_USER and ${prefix}_AUTH_PASS (or MS_AUTH_USER / MS_AUTH_PASS).`,
    );
  }
  return null; // localhost, no creds → open dev mode (everyone is admin)
}

/**
 * The ONLY paths a 'participant' role may reach — everything else is admin-only
 * (default-deny). Each entry matches a request path by exact-equal OR as a
 * path-segment prefix (`entry + '/'`), so '/pilot' allows '/pilot/app.js' but
 * NOT '/pilot-admin'. Deliberately EXCLUDES every metered/admin surface:
 * /api/eval/*, the rest of /api/chat/*, /api/pilot/admin/*, the poetics-native
 * /api/jobs + /api/compose/live/*, every /api/chat/* compatibility endpoint,
 * /pilot-admin, and the researcher dashboard. The participant's one metered
 * surface is now part of the bounded pilot session API itself:
 *   - '/api/pilot/session' — covers the whole per-session flow, including the
 *     dedicated blinded tutor-turn adapter.
 */
export const PARTICIPANT_ALLOWLIST = Object.freeze([
  '/health', // server.js liveness (poetics' /healthz is registered pre-guard)
  '/healthz',
  '/favicon.ico',
  '/components', // shared static UI assets
  '/pilot', // participant study UI (static shell)
  '/adjudication', // coder forms UI (static shell)
  '/api/pilot/config',
  '/api/pilot/enroll',
  '/api/pilot/session', // per-session participant flow
  '/api/a19/adjudication', // assignment + submissions (coder)
]);

function pathAllowedForParticipant(p, allowlist) {
  return allowlist.some((entry) => p === entry || p.startsWith(entry + '/'));
}

/**
 * Default-deny role gate. Apply AFTER resolveBasicAuthGuard so req.evalRole is
 * set. Admins — and the localhost-open case, where req.evalRole is undefined —
 * pass everything; the 'participant' role reaches ONLY the allowlist and is
 * 403'd elsewhere. A misclassified path therefore locks a participant OUT
 * (benign) rather than exposing a paid/admin endpoint (the asymmetry that makes
 * allowlisting the safe default). Applying it unconditionally is a no-op when no
 * participant role exists, so both servers add it right after their auth guard.
 */
export function makeRoleGate({ allowlist = PARTICIPANT_ALLOWLIST } = {}) {
  return function roleGate(req, res, next) {
    if (req.evalRole !== 'participant') return next(); // admin or localhost-open
    if (pathAllowedForParticipant(req.path, allowlist)) return next();
    return res.status(403).type('text/plain').send('Forbidden: an admin role is required for this surface.\n');
  };
}
