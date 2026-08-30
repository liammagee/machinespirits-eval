// Offline tests for the optional provider-balance probe.
//
// Every lookup here is a supplied function. Nothing contacts a live provider,
// and no test asserts anything about a real provider's response shape — that
// is the operator's declaration to make in config/providers.yaml, not this
// module's to assume.

import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  BALANCE_POLICY,
  BALANCE_STATUS,
  ProviderBalanceStopError,
  compareCeilingWithBalance,
  describeBalanceCapability,
  probeProviderBalance,
  resetProviderBalanceCache,
} from '../services/adaptiveTutor/providerBalanceProbe.js';
import { checkBalanceBeforeDispatch } from '../services/adaptiveTutor/meteredRunSession.js';

const DECLARED_PROVIDER = {
  apiKey: 'offline-probe-test-key',
  balance_probe: {
    url: 'https://provider.example/api/credits',
    granted_path: 'data.total_credits',
    used_path: 'data.total_usage',
    documented_at: '2026-08-28',
  },
};

function jsonResponse(payload, { ok = true, status = 200 } = {}) {
  return async () => ({ ok, status, json: async () => payload });
}

beforeEach(() => {
  resetProviderBalanceCache();
});

describe('balance capability declaration', () => {
  it('probes only where the provider config declares the capability', async () => {
    // Nothing ships with the block, so every provider is unsupported until an
    // operator writes down a verified contract.
    for (const provider of ['anthropic', 'openai', 'gemini', 'claude-code', 'codex', 'local', 'openrouter']) {
      const result = await probeProviderBalance({
        provider,
        providerConfig: { apiKey: 'k' },
        fetchImpl: () => {
          throw new Error('an undeclared provider must never be contacted');
        },
      });
      assert.equal(result.status, BALANCE_STATUS.UNSUPPORTED, provider);
      assert.equal(result.supported, false);
      // Never a numeric zero.
      assert.equal(result.remainingUsd, null);
    }
  });

  it('treats an incomplete declaration as a configuration error, not as no balance', () => {
    assert.equal(describeBalanceCapability({}, 'p').supported, false);
    assert.match(describeBalanceCapability({}, 'p').reason, /declares no balance_probe/u);

    const noUrl = describeBalanceCapability({ balance_probe: { remaining_path: 'a.b' } }, 'p');
    assert.equal(noUrl.supported, false);
    assert.match(noUrl.reason, /without a url/u);

    const noFields = describeBalanceCapability({ balance_probe: { url: 'https://x' } }, 'p');
    assert.equal(noFields.supported, false);
    assert.match(noFields.reason, /remaining_path, or both granted_path and used_path/u);

    const complete = describeBalanceCapability(DECLARED_PROVIDER, 'p');
    assert.equal(complete.supported, true);
    assert.equal(complete.auth, 'bearer');
    assert.equal(complete.documentedAt, '2026-08-28');
  });
});

describe('balance lookup states stay distinct', () => {
  it('reports a known balance from the declared fields', async () => {
    const result = await probeProviderBalance({
      provider: 'declared',
      providerConfig: DECLARED_PROVIDER,
      fetchImpl: jsonResponse({ data: { total_credits: 40, total_usage: 12.5 } }),
    });
    assert.equal(result.status, BALANCE_STATUS.KNOWN);
    assert.equal(result.supported, true);
    assert.equal(result.remainingUsd, 27.5);
  });

  it('reads a remaining_path declaration directly', async () => {
    const result = await probeProviderBalance({
      provider: 'declared-remaining',
      providerConfig: {
        apiKey: 'k',
        balance_probe: { url: 'https://provider.example/c', remaining_path: 'credits.remaining' },
      },
      fetchImpl: jsonResponse({ credits: { remaining: 3.25 } }),
    });
    assert.equal(result.status, BALANCE_STATUS.KNOWN);
    assert.equal(result.remainingUsd, 3.25);
  });

  it('keeps a real zero balance distinct from an unknown one', async () => {
    const spent = await probeProviderBalance({
      provider: 'spent',
      providerConfig: DECLARED_PROVIDER,
      fetchImpl: jsonResponse({ data: { total_credits: 10, total_usage: 10 } }),
    });
    assert.equal(spent.status, BALANCE_STATUS.KNOWN);
    assert.equal(spent.remainingUsd, 0, 'a reported zero is a real number');

    resetProviderBalanceCache();
    const failed = await probeProviderBalance({
      provider: 'spent',
      providerConfig: DECLARED_PROVIDER,
      fetchImpl: async () => {
        throw new Error('connection reset');
      },
    });
    assert.equal(failed.status, BALANCE_STATUS.UNAVAILABLE);
    assert.equal(failed.remainingUsd, null, 'a failed lookup is not a zero balance');
  });

  it('reports a malformed or refused response as unavailable, never as zero', async () => {
    const malformed = await probeProviderBalance({
      provider: 'malformed',
      providerConfig: DECLARED_PROVIDER,
      fetchImpl: jsonResponse({ data: { total_credits: 'lots', total_usage: null } }),
    });
    assert.equal(malformed.status, BALANCE_STATUS.UNAVAILABLE);
    assert.equal(malformed.remainingUsd, null);
    assert.equal(malformed.malformedResponse, true);

    resetProviderBalanceCache();
    const refused = await probeProviderBalance({
      provider: 'refused',
      providerConfig: DECLARED_PROVIDER,
      fetchImpl: jsonResponse({}, { ok: false, status: 401 }),
    });
    assert.equal(refused.status, BALANCE_STATUS.UNAVAILABLE);
    assert.equal(refused.remainingUsd, null);
    assert.match(refused.reason, /HTTP 401/u);

    resetProviderBalanceCache();
    const noKey = await probeProviderBalance({
      provider: 'no-key',
      providerConfig: { ...DECLARED_PROVIDER, apiKey: '' },
      fetchImpl: () => {
        throw new Error('must not be called without a credential');
      },
    });
    assert.equal(noKey.status, BALANCE_STATUS.UNAVAILABLE);
    assert.equal(noKey.remainingUsd, null);
  });
});

describe('balance caching', () => {
  it('caches a known balance per provider for this process only', async () => {
    let lookups = 0;
    const fetchImpl = async () => {
      lookups += 1;
      return { ok: true, status: 200, json: async () => ({ data: { total_credits: 9, total_usage: 1 } }) };
    };

    const first = await probeProviderBalance({ provider: 'cached', providerConfig: DECLARED_PROVIDER, fetchImpl });
    const second = await probeProviderBalance({ provider: 'cached', providerConfig: DECLARED_PROVIDER, fetchImpl });
    assert.equal(lookups, 1, 'a run does not re-probe on every call');
    assert.equal(first.cached, false);
    assert.equal(second.cached, true);
    assert.equal(second.remainingUsd, 8);

    // A different provider is a different cache entry.
    await probeProviderBalance({ provider: 'other', providerConfig: DECLARED_PROVIDER, fetchImpl });
    assert.equal(lookups, 2);

    // And an unavailable answer is not cached, so a transient failure does not
    // stick for the life of the process.
    resetProviderBalanceCache();
    let failures = 0;
    const failing = async () => {
      failures += 1;
      throw new Error('timeout');
    };
    await probeProviderBalance({ provider: 'flaky', providerConfig: DECLARED_PROVIDER, fetchImpl: failing });
    await probeProviderBalance({ provider: 'flaky', providerConfig: DECLARED_PROVIDER, fetchImpl: failing });
    assert.equal(failures, 2);
  });
});

describe('comparing a ceiling with a balance', () => {
  const known = (remainingUsd) => ({ status: BALANCE_STATUS.KNOWN, remainingUsd, supported: true });

  it('proceeds when the credit covers the headroom the run can still reach', () => {
    const verdict = compareCeilingWithBalance({ balance: known(50), maxCostUsd: 20, alreadyExposedUsd: 5 });
    assert.equal(verdict.decision, 'proceed');
    assert.equal(verdict.advisory, false);
    assert.equal(verdict.headroomUsd, 15);
  });

  it('never stops on an unknown balance, whatever the policy', () => {
    for (const balance of [
      null,
      { status: BALANCE_STATUS.UNSUPPORTED, remainingUsd: null },
      { status: BALANCE_STATUS.UNAVAILABLE, remainingUsd: null },
    ]) {
      const verdict = compareCeilingWithBalance({ balance, maxCostUsd: 100, policy: BALANCE_POLICY.STOP });
      assert.equal(verdict.decision, 'proceed');
      assert.equal(verdict.advisory, true);
      assert.equal(verdict.remainingUsd, null);
    }
  });

  it('warns by default on a shortfall and says why that is not proof of overspend', () => {
    const verdict = compareCeilingWithBalance({ balance: known(2), maxCostUsd: 10 });
    assert.equal(verdict.decision, 'warn');
    assert.equal(verdict.advisory, true);
    assert.match(verdict.reason, /may not be able to spend its whole ceiling/u);
    assert.match(verdict.reason, /not evidence that it would/u);
  });

  it('stops only under an explicitly declared stop policy', () => {
    const verdict = compareCeilingWithBalance({ balance: known(2), maxCostUsd: 10, policy: BALANCE_POLICY.STOP });
    assert.equal(verdict.decision, 'stop');
    assert.equal(verdict.advisory, false);
  });
});

describe('the pre-dispatch check used by the launchers', () => {
  it('does nothing when the run carries no ceiling', async () => {
    const result = await checkBalanceBeforeDispatch({
      provider: 'declared',
      providerConfig: DECLARED_PROVIDER,
      maxCostUsd: null,
      fetchImpl: () => {
        throw new Error('an unmetered run must not probe');
      },
    });
    assert.equal(result, null);
  });

  it('lets an unsupported provider proceed on the local ceiling alone', async () => {
    const { verdict } = await checkBalanceBeforeDispatch({
      provider: 'anthropic',
      providerConfig: { apiKey: 'k' },
      maxCostUsd: 10,
      fetchImpl: () => {
        throw new Error('must not be contacted');
      },
    });
    assert.equal(verdict.decision, 'proceed');
    assert.match(verdict.reason, /declares no balance capability/u);
  });

  it('compares the known balance against the ceiling still unspent', async () => {
    const { verdict } = await checkBalanceBeforeDispatch({
      provider: 'declared',
      providerConfig: DECLARED_PROVIDER,
      maxCostUsd: 10,
      alreadyExposedUsd: 7,
      fetchImpl: jsonResponse({ data: { total_credits: 5, total_usage: 1 } }),
    });
    // $3 of ceiling left against $4 of credit, so a $10 ceiling is not itself
    // the thing being compared.
    assert.equal(verdict.headroomUsd, 3);
    assert.equal(verdict.remainingUsd, 4);
    assert.equal(verdict.decision, 'proceed');
  });

  it('raises a stop error before the first dispatch under a stop policy', async () => {
    await assert.rejects(
      checkBalanceBeforeDispatch({
        provider: 'declared',
        providerConfig: DECLARED_PROVIDER,
        maxCostUsd: 20,
        policy: BALANCE_POLICY.STOP,
        label: 'test-run',
        fetchImpl: jsonResponse({ data: { total_credits: 3, total_usage: 1 } }),
      }),
      (error) => {
        assert.ok(error instanceof ProviderBalanceStopError);
        assert.equal(error.code, 'PROVIDER_BALANCE_STOP');
        assert.equal(error.remainingUsd, 2);
        assert.equal(error.headroomUsd, 20);
        return true;
      },
    );
  });
});
