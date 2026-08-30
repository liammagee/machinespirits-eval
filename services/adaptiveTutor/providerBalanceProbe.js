// Optional provider-balance lookup for budgeted runs.
//
// The local ledger is the binding control: it reserves before every dispatch
// and refuses to cross the ceiling. This probe adds one thing the ledger
// cannot know — how much credit the account actually has left — and it is
// deliberately narrow:
//
//   - A provider is probed ONLY where its own configuration declares the
//     capability, with the URL and the response fields written down. Nothing
//     is inferred from a provider's name, and no adapter is hardcoded, so a
//     route cannot start being probed because someone guessed its API.
//   - `unsupported`, `unavailable`, and `known` stay three different answers.
//     A failed, malformed, or undeclared lookup NEVER becomes a numeric zero:
//     `remainingUsd` is null unless the status is `known`.
//   - The probe is advisory unless it returns a known balance under a declared
//     policy. A ceiling larger than the current credit is not proof the run
//     will spend that much, so the warn-or-stop choice is written down as
//     policy rather than smuggled into the transport.
//   - A known balance is cached for the life of the process, per provider, so
//     one run does not re-probe on every call. Nothing is written to disk.
//
// To declare the capability, add a `balance_probe` block to the provider in
// config/providers.yaml:
//
//   openrouter:
//     balance_probe:
//       url: https://openrouter.ai/api/v1/credits
//       granted_path: data.total_credits
//       used_path: data.total_usage
//       # or, when the API reports the remainder directly:
//       # remaining_path: data.remaining_credits
//       auth: bearer            # bearer | none
//       documented_at: '2026-08-28'
//
// No provider ships with the block. Confirm the response shape against the
// provider's own current documentation and a real response before adding it —
// an adapter written from memory is how a probe starts reporting a confident
// wrong number.

export const BALANCE_STATUS = Object.freeze({
  UNSUPPORTED: 'unsupported',
  UNAVAILABLE: 'unavailable',
  KNOWN: 'known',
});

export const BALANCE_POLICY = Object.freeze({
  WARN: 'warn',
  STOP: 'stop',
});

const processCache = new Map();

export function resetProviderBalanceCache() {
  processCache.clear();
}

function readPath(source, dottedPath) {
  if (!dottedPath) return undefined;
  return String(dottedPath)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unsupported(provider, reason) {
  return Object.freeze({
    provider,
    supported: false,
    status: BALANCE_STATUS.UNSUPPORTED,
    remainingUsd: null,
    reason,
    cached: false,
  });
}

function unavailable(provider, reason, extra = {}) {
  return Object.freeze({
    provider,
    supported: true,
    status: BALANCE_STATUS.UNAVAILABLE,
    remainingUsd: null,
    reason,
    cached: false,
    ...extra,
  });
}

// Read the declared capability, or say why the provider is not probeable.
// A block missing its URL or its response fields is a configuration error the
// operator should see, not a silent fall back to "no balance".
export function describeBalanceCapability(providerConfig = {}, provider = 'unknown') {
  const declared = providerConfig?.balance_probe;
  if (!declared) {
    return { provider, supported: false, reason: 'Provider config declares no balance_probe capability.' };
  }
  if (!declared.url) {
    return { provider, supported: false, reason: 'balance_probe is declared without a url.' };
  }
  const hasRemaining = Boolean(declared.remaining_path);
  const hasGrantedAndUsed = Boolean(declared.granted_path && declared.used_path);
  if (!hasRemaining && !hasGrantedAndUsed) {
    return {
      provider,
      supported: false,
      reason: 'balance_probe needs either remaining_path, or both granted_path and used_path.',
    };
  }
  return {
    provider,
    supported: true,
    url: declared.url,
    auth: declared.auth || 'bearer',
    remainingPath: declared.remaining_path || null,
    grantedPath: declared.granted_path || null,
    usedPath: declared.used_path || null,
    documentedAt: declared.documented_at || null,
  };
}

export async function probeProviderBalance({
  provider,
  providerConfig = {},
  fetchImpl = globalThis.fetch,
  timeoutMs = 5000,
  useCache = true,
} = {}) {
  const name = String(provider || 'unknown');
  const capability = describeBalanceCapability(providerConfig, name);
  if (!capability.supported) return unsupported(name, capability.reason);

  if (useCache && processCache.has(name)) {
    return Object.freeze({ ...processCache.get(name), cached: true });
  }

  if (typeof fetchImpl !== 'function') {
    return unavailable(name, 'No fetch implementation is available to run the lookup.');
  }
  if (capability.auth === 'bearer' && !providerConfig.apiKey) {
    return unavailable(name, 'Provider has no API key, so the balance endpoint cannot be called.');
  }

  let payload;
  try {
    const response = await fetchImpl(capability.url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(capability.auth === 'bearer' ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout?.(timeoutMs),
    });
    if (!response?.ok) {
      return unavailable(name, `Balance endpoint returned HTTP ${response?.status ?? 'no status'}.`);
    }
    payload = await response.json();
  } catch (error) {
    // A network failure tells us nothing about the account, so it must not
    // read as an empty balance.
    return unavailable(name, `Balance lookup failed: ${error?.message || String(error)}`);
  }

  let remainingUsd = null;
  if (capability.remainingPath) {
    remainingUsd = finiteNumber(readPath(payload, capability.remainingPath));
  } else {
    const granted = finiteNumber(readPath(payload, capability.grantedPath));
    const used = finiteNumber(readPath(payload, capability.usedPath));
    if (granted != null && used != null) remainingUsd = granted - used;
  }

  if (remainingUsd == null) {
    return unavailable(name, 'Balance response did not carry the declared fields as finite numbers.', {
      malformedResponse: true,
    });
  }

  const known = {
    provider: name,
    supported: true,
    status: BALANCE_STATUS.KNOWN,
    remainingUsd,
    reason: null,
    documentedAt: capability.documentedAt,
  };
  if (useCache) processCache.set(name, known);
  return Object.freeze({ ...known, cached: false });
}

// Compare a known balance with the ceiling this run can still reach.
//
// The comparison is deliberately conservative in what it claims: a ceiling
// above the remaining credit means the run COULD outspend the account, not
// that it will. The declared policy decides whether that is a warning or a
// reason to stop.
export function compareCeilingWithBalance({
  balance,
  maxCostUsd,
  alreadyExposedUsd = 0,
  policy = BALANCE_POLICY.WARN,
} = {}) {
  const headroomUsd = Math.max(0, Number(maxCostUsd || 0) - Number(alreadyExposedUsd || 0));

  if (!balance || balance.status !== BALANCE_STATUS.KNOWN) {
    return {
      decision: 'proceed',
      advisory: true,
      headroomUsd,
      remainingUsd: null,
      reason:
        balance?.status === BALANCE_STATUS.UNSUPPORTED
          ? 'Provider declares no balance capability; the local ceiling is the only control.'
          : 'Balance is unknown; the local ceiling is the only control.',
    };
  }

  if (balance.remainingUsd >= headroomUsd) {
    return {
      decision: 'proceed',
      advisory: false,
      headroomUsd,
      remainingUsd: balance.remainingUsd,
      reason: 'Remaining credit covers the ceiling this run can still reach.',
    };
  }

  const reason =
    `Ceiling headroom $${headroomUsd.toFixed(2)} is above the reported remaining credit ` +
    `$${balance.remainingUsd.toFixed(2)}. The run may not be able to spend its whole ceiling; ` +
    `this is not evidence that it would.`;
  return {
    decision: policy === BALANCE_POLICY.STOP ? 'stop' : 'warn',
    advisory: policy !== BALANCE_POLICY.STOP,
    headroomUsd,
    remainingUsd: balance.remainingUsd,
    reason,
  };
}

export class ProviderBalanceStopError extends Error {
  constructor(message, { provider, remainingUsd, headroomUsd } = {}) {
    super(message);
    this.name = 'ProviderBalanceStopError';
    this.code = 'PROVIDER_BALANCE_STOP';
    this.provider = provider;
    this.remainingUsd = remainingUsd;
    this.headroomUsd = headroomUsd;
  }
}
