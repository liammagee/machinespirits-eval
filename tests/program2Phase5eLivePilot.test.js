import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  PHASE5E_SPEC,
  buildPhase5LivePilotPlan,
  buildPhase5bLivePilotPlan,
  buildPhase5cLivePilotPlan,
  buildPhase5eLivePilotPlan,
  validatePhase5eLivePilotPlan,
} from '../scripts/run-program2-live-pilot.js';

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalJson(value[key])]),
    );
  }
  return value;
}

function planSha256(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalJson(value)))
    .digest('hex');
}

function flagValue(command, flag) {
  const index = command.indexOf(flag);
  return index >= 0 ? command[index + 1] : null;
}

describe('Program-2 Phase 5e live-pilot plan', () => {
  it('builds the frozen 10 committee + 8 fresh-control Skyway design', () => {
    const plan = buildPhase5eLivePilotPlan({ outputRoot: 'regression-output' });
    const validation = validatePhase5eLivePilotPlan(plan);

    assert.deepEqual(validation, { ok: true, errors: [], jobCount: 18, balancedCellCount: 4 });
    assert.equal(plan.schema, 'machinespirits.tutor-stub.program2-phase5e-plan.v1');
    assert.equal(plan.runSeed, 20260726);
    assert.equal(plan.world, 'world_026_skyway_bakery');
    assert.equal(plan.jobs.filter((job) => job.arm === 'committee').length, 10);
    assert.equal(plan.jobs.filter((job) => job.arm === 'silent_control').length, 8);
    assert.equal(new Set(plan.jobs.map((job) => job.id)).size, 18);

    for (const job of plan.jobs) {
      assert.equal(flagValue(job.command, '--world'), PHASE5E_SPEC.world);
      assert.equal(flagValue(job.command, '--run-seed'), String(PHASE5E_SPEC.runSeed));
      assert.equal(
        flagValue(job.command, '--committee-fallback-policy'),
        job.arm === 'committee' ? PHASE5E_SPEC.fallbackPolicy : null,
      );
    }
  });

  it('leaves the frozen Phase 5, 5b, and 5c plans byte-identical', () => {
    const outputRoot = 'regression-output';
    assert.equal(
      planSha256(buildPhase5LivePilotPlan({ outputRoot })),
      'a153e2de088e2b6424b471858c3bf7840568b1acceef3bc65e9d0b8b2c792549',
    );
    assert.equal(
      planSha256(buildPhase5bLivePilotPlan({ outputRoot })),
      'c3b24534cb10790522c3bd14a2a473e71e276cb5e274f4ecd253a8d00cccb100',
    );
    assert.equal(
      planSha256(buildPhase5cLivePilotPlan({ outputRoot })),
      '91748dcfcafc27e1e3cf3ae59c416f0a234226709dba89dd929696b64b3bd823',
    );
  });
});
