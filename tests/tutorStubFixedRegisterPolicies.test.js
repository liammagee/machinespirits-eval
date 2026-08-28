import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TUTOR_STUB_FIXED_REGISTER_POLICIES,
  parseTutorStubRegisterPolicyStack,
} from '../services/tutorStubRegisterPolicyComposition.js';
import { createTutorStubResponsePolicySelectionRuntime } from '../services/tutorStubResponsePolicySelectionRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sourceOf(relativePath) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function selectionRuntime() {
  return createTutorStubResponsePolicySelectionRuntime({
    preferredLegacyRegister: ({ register }) => `legacy:${register}`,
  });
}

test('fixed-register policies parse as overlay-free controls', () => {
  assert.deepEqual(parseTutorStubRegisterPolicyStack('fixed_sarcastic'), {
    primary: 'fixed_sarcastic',
    overlays: [],
    id: 'fixed_sarcastic',
  });
  assert.deepEqual(parseTutorStubRegisterPolicyStack('fixed-warm'), {
    primary: 'fixed_warm',
    overlays: [],
    id: 'fixed_warm',
  });
  assert.throws(
    () => parseTutorStubRegisterPolicyStack('fixed_sarcastic+state'),
    /control fixed_sarcastic cannot have overlays/u,
  );
  assert.throws(
    () => parseTutorStubRegisterPolicyStack('fixed_warm+edge_timing'),
    /control fixed_warm cannot have overlays/u,
  );
});

test('the fixed-register map pins one registry register per policy', () => {
  assert.deepEqual(TUTOR_STUB_FIXED_REGISTER_POLICIES, {
    fixed_warm: 'warm',
    fixed_sarcastic: 'sarcastic',
  });
  assert.ok(Object.isFrozen(TUTOR_STUB_FIXED_REGISTER_POLICIES));

  const registry = sourceOf('config/engagement-registers.yaml');
  for (const register of Object.values(TUTOR_STUB_FIXED_REGISTER_POLICIES)) {
    assert.match(registry, new RegExp(`^  ${register}:$`, 'mu'), `${register} must exist in the register registry`);
  }
});

test('fixed-register selection pins the mapped register on every turn', () => {
  const runtime = selectionRuntime();
  const state = { register: { palette: ['warm', 'sarcastic'] } };

  const sharp = runtime.fixedRegisterEngagementStanceSelection({
    state,
    classification: { turn: { request_type: 'position_statement', summary: 'learner pushes back' } },
    policy: 'fixed_sarcastic',
  });
  assert.equal(sharp.selected_register, 'sarcastic');
  assert.equal(sharp.legacy_selected_register, 'legacy:sarcastic');
  assert.equal(sharp.reviewer_signal, 'fixed_sarcastic_policy');
  assert.equal(sharp.source, 'fixed_register_policy');
  assert.equal(sharp.request_type, 'position_statement');
  assert.deepEqual(sharp.risk_flags, []);

  const sharpAgain = runtime.fixedRegisterEngagementStanceSelection({
    state,
    classification: null,
    policy: 'fixed_sarcastic',
  });
  assert.equal(sharpAgain.selected_register, 'sarcastic');
  assert.equal(sharpAgain.request_type, 'fixed_register_baseline');

  const warm = runtime.fixedRegisterEngagementStanceSelection({
    state,
    classification: { turn: { request_type: 'evidence_request', summary: 'learner asks for a clue' } },
    policy: 'fixed_warm',
  });
  assert.equal(warm.selected_register, 'warm');
  assert.equal(warm.reviewer_signal, 'fixed_warm_policy');
});

test('fixed-register selection fails closed instead of substituting a register', () => {
  const runtime = selectionRuntime();

  assert.throws(
    () =>
      runtime.fixedRegisterEngagementStanceSelection({
        state: { register: { palette: ['warm', 'plain'] } },
        classification: null,
        policy: 'fixed_sarcastic',
      }),
    /never substitutes another register/u,
  );
  assert.throws(
    () =>
      runtime.fixedRegisterEngagementStanceSelection({
        state: { register: { palette: [] } },
        classification: null,
        policy: 'fixed_warm',
      }),
    /never substitutes another register/u,
  );
  assert.throws(
    () =>
      runtime.fixedRegisterEngagementStanceSelection({
        state: { register: { palette: ['warm', 'sarcastic'] } },
        classification: null,
        policy: 'fixed_plain',
      }),
    /Unknown fixed-register policy/u,
  );
});

test('fixed-register dispatch, launch validation, and prompt line are wired', () => {
  const configuration = sourceOf('services/tutorStubResponseConfigurationSelectionRuntime.js');
  assert.match(configuration, /policy in TUTOR_STUB_FIXED_REGISTER_POLICIES/u);
  assert.match(configuration, /fixedRegisterEngagementStanceSelection\(\{ state, classification, policy \}\)/u);

  const context = sourceOf('services/tutorStubSessionApplicationContext.js');
  assert.match(context, /registerPolicy in TUTOR_STUB_FIXED_REGISTER_POLICIES/u);
  assert.match(context, /fixedRegisterSelectionEnabled \|\|/u);
  assert.match(context, /the policy never substitutes another register/u);

  const host = sourceOf('services/tutorStubCliApplicationHost.js');
  assert.match(host, /pins the \$\{TUTOR_STUB_FIXED_REGISTER_POLICIES\[policy\]\} register on every tutor turn/u);

  const analysis = sourceOf('services/tutorStubPublicLearnerAnalysis.js');
  assert.match(analysis, /'fixed_warm',\n\s*'fixed_sarcastic',\n\]\);/u);
});
