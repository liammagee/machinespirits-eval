import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { tutorStubTypedActionDecisionFromTurn } from '../services/tutorStubTypedActionRestoration.js';

test('typed-action decision lookup preserves modern, legacy, and register precedence', () => {
  const modern = { contract_id: 'modern' };
  const legacy = { contract_id: 'legacy' };
  const register = { contract_id: 'register' };
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({
      typedActionDecision: modern,
      typed_action_decision: legacy,
      registerSelection: { typed_action_decision: register },
    }),
    modern,
  );
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({
      typed_action_decision: legacy,
      registerSelection: { typed_action_decision: register },
    }),
    legacy,
  );
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({ registerSelection: { typed_action_decision: register } }),
    register,
  );
});

test('typed-action decision lookup skips absent, primitive, and contractless candidates', () => {
  const fallback = { contract_id: 'fallback' };
  assert.equal(tutorStubTypedActionDecisionFromTurn(null), null);
  assert.equal(
    tutorStubTypedActionDecisionFromTurn({
      typedActionDecision: 'invalid',
      typed_action_decision: {},
      registerSelection: { typed_action_decision: fallback },
    }),
    fallback,
  );
  assert.equal(tutorStubTypedActionDecisionFromTurn({ typedActionDecision: { contract_id: '' } }), null);
});

test('the CLI imports rather than redeclares typed-action decision lookup', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /tutorStubTypedActionDecisionFromTurn as typedActionDecisionFromTurn/u);
  assert.doesNotMatch(source, /function typedActionDecisionFromTurn\(/u);
});
