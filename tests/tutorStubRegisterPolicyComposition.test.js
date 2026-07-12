import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  evaluateTutorStubRegisterPolicyOverlay,
  normalizeTutorStubRegisterOverlayThreshold,
  parseTutorStubRegisterPolicyStack,
} from '../services/tutorStubRegisterPolicyComposition.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('register-policy stack parses a primary plus ordered state/field overlays', () => {
  assert.deepEqual(parseTutorStubRegisterPolicyStack('dynamical-system+state+field+state'), {
    primary: 'dynamical_system',
    overlays: ['state', 'field'],
    id: 'dynamical_system+state+field',
  });
  assert.throws(
    () => parseTutorStubRegisterPolicyStack('negative+state'),
    /control negative cannot have overlays/u,
  );
  assert.throws(
    () => parseTutorStubRegisterPolicyStack('dynamical_system+trajectory'),
    /Unknown register-policy overlay/u,
  );
  assert.throws(
    () => parseTutorStubRegisterPolicyStack('field+field'),
    /duplicates the primary/u,
  );
});

test('register overlay threshold accepts the closed unit interval', () => {
  assert.equal(normalizeTutorStubRegisterOverlayThreshold('0.7'), 0.7);
  assert.equal(normalizeTutorStubRegisterOverlayThreshold(0), 0);
  assert.equal(normalizeTutorStubRegisterOverlayThreshold(1), 1);
  assert.throws(() => normalizeTutorStubRegisterOverlayThreshold(1.1), /between 0 and 1/u);
});

test('state overlay fires on a strong individual classified-state change', () => {
  const state = {
    turns: [
      {
        classification: {
          turn: {
            request_type: 'evidence_request',
            discourse_move: 'claim',
            evidence_use: 'links_evidence_to_rule',
            epistemic_stance: 'grounded',
            affect: 'settled',
            agency: 'steering',
            scores: {
              conceptual_engagement: { score: 4 },
              epistemic_readiness: { score: 4 },
            },
          },
        },
      },
    ],
  };
  const classification = {
    turn: {
      request_type: 'plain_language_request',
      discourse_move: 'question',
      evidence_use: 'none',
      epistemic_stance: 'confused',
      affect: 'anxious',
      agency: 'seeking_support',
      scores: {
        conceptual_engagement: { score: 2 },
        epistemic_readiness: { score: 1 },
      },
    },
  };
  const evaluation = evaluateTutorStubRegisterPolicyOverlay({
    overlay: 'state',
    state,
    classification,
    candidate: { selected_register: 'plain' },
    primaryRegister: 'charismatic',
    threshold: 0.7,
  });

  assert.equal(evaluation.signal_strength, 1);
  assert.equal(evaluation.threshold_met, true);
  assert.equal(evaluation.differs_from_primary, true);
  assert.equal(evaluation.eligible, true);
});

test('state overlay cannot fire on the first classified turn', () => {
  const evaluation = evaluateTutorStubRegisterPolicyOverlay({
    overlay: 'state',
    state: { turns: [] },
    classification: { turn: { request_type: 'plain_language_request' } },
    candidate: { selected_register: 'plain' },
    primaryRegister: 'precise',
    threshold: 0.7,
  });

  assert.equal(evaluation.signal_strength, 0);
  assert.equal(evaluation.eligible, false);
});

test('field overlay fires on a strong field/DAG divergence but not an aligned recommendation', () => {
  const candidate = {
    selected_register: 'warm',
    field_policy: {
      features: {
        field: { relation: 'field_without_dag', delta: 0.2 },
        dag: { progressScore: 0 },
      },
    },
  };
  const changed = evaluateTutorStubRegisterPolicyOverlay({
    overlay: 'field',
    candidate,
    primaryRegister: 'precise',
    threshold: 0.7,
  });
  const aligned = evaluateTutorStubRegisterPolicyOverlay({
    overlay: 'field',
    candidate,
    primaryRegister: 'warm',
    threshold: 0.7,
  });

  assert.equal(changed.signal_strength, 0.8);
  assert.equal(changed.eligible, true);
  assert.equal(aligned.threshold_met, true);
  assert.equal(aligned.differs_from_primary, false);
  assert.equal(aligned.eligible, false);
});

test('tutor-stub dry run exposes the composed policy and threshold', () => {
  const config = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/tutor-stub.js',
        '--dry-run',
        '--no-trace',
        '--world',
        'world_005_marrick',
        '--dag',
        '--tutor-learner-dag',
        '--register-policy',
        'dynamical-system+state+field',
        '--register-overlay-threshold',
        '0.75',
      ],
      { cwd: ROOT, encoding: 'utf8' },
    ),
  );

  assert.equal(config.registerSelection.policy, 'dynamical_system+state+field');
  assert.equal(config.registerSelection.primaryPolicy, 'dynamical_system');
  assert.deepEqual(config.registerSelection.overlayPolicies, ['state', 'field']);
  assert.equal(config.registerSelection.overlayThreshold, 0.75);
});

test('interactive settings can add, remove, clear, and retune register overlays', () => {
  const result = spawnSync(
    process.execPath,
    [
      'scripts/tutor-stub.js',
      '--no-opening',
      '--no-closeout-report',
      '--no-interim-animation',
      '--no-stream',
      '--no-trace',
      '--world',
      'world_005_marrick',
      '--register-policy',
      'dynamical_system',
    ],
    {
      cwd: ROOT,
      encoding: 'utf8',
      input:
        '/settings policy add state\n/settings policy add field\n/settings policy threshold 0.8\n/clear\n/settings\n/settings policy remove state\n/settings policy clear\n/quit\n',
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /policy stack dynamical_system\+state/u);
  assert.match(result.stdout, /policy stack dynamical_system\+state\+field/u);
  assert.ok((result.stdout.match(/policy stack: dynamical_system\+state\+field/gu) || []).length >= 1);
  assert.match(result.stdout, /strong-change threshold 0\.8/u);
  assert.match(result.stdout, /policy stack dynamical_system\+field/u);
  assert.match(result.stdout, /policy stack dynamical_system; strong-change threshold 0\.8/u);
});
