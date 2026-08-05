import assert from 'node:assert/strict';
import test from 'node:test';

import { TUTOR_STUB_AB_GENERIC_PLAN } from '../services/tutorStubAbArms.js';
import { TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS } from '../services/tutorStubTutorTurnPreparation.js';

// The fallible-learner outcome contrast (workplan/items/
// tutor-fallible-learner-closure-prereg.md) runs three live versions: bare,
// contract-only, and the fixed empty plan. The first two always existed on the
// live path; the empty plan lived only in the frozen-replay A/B arms. These
// tests pin the live wiring so `--blocks empty_plan` cannot silently regress
// to a bare tutor that reports a prompt shape it did not have.

test('empty_plan is a gated speaker block the runner can request', () => {
  assert.ok(
    TUTOR_STUB_SPEAKER_GATED_BLOCK_IDS.includes('empty_plan'),
    'empty_plan missing from the gated block ids — --blocks empty_plan would fail closed',
  );
});

test('the live empty-plan control is the frozen A/B generic plan, unbracketed', () => {
  assert.equal(typeof TUTOR_STUB_AB_GENERIC_PLAN, 'string');
  assert.ok(TUTOR_STUB_AB_GENERIC_PLAN.length > 500, 'generic plan lost its length-control mass');
  // [header] blocks are instrumentation; the advisory parser fails closed on
  // unknown headers, so the control must stay unbracketed prose.
  assert.ok(!/^\[/mu.test(TUTOR_STUB_AB_GENERIC_PLAN), 'generic plan grew a bracketed header');
  // The control carries plan shape, never case content: the four slot names
  // are its identity.
  for (const slot of ['OPEN', 'CHECK', 'OFFER', 'ASK']) {
    assert.ok(TUTOR_STUB_AB_GENERIC_PLAN.includes(slot), `generic plan lost its ${slot} slot`);
  }
});
