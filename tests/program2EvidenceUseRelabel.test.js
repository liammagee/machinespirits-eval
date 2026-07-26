// The archive relabel tool re-asks stored classifier calls under v2 by replacing
// one line of the stored prompt. That is only a faithful relabel if the result is
// the prompt a native v2 run would have built — otherwise the relabelled corpus is
// a third construct, neither v1 nor v2. These tests prove that identity with the
// real prompt builder and no API calls, and pin the refusal behaviour that keeps a
// drifted prompt from being relabelled under a false premise.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  TUTOR_STUB_EVIDENCE_USE_RUBRICS,
  buildTutorStubPublicLearnerAnalysisPrompt,
  buildTutorStubPublicLearnerAnalysisWorld,
} from '../services/tutorStubPublicLearnerAnalysis.js';
import { substituteEvidenceUseClause } from '../scripts/relabel-program2-evidence-use.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function promptFor(evidenceUseRubric, overrides = {}) {
  return buildTutorStubPublicLearnerAnalysisPrompt({
    learnerText: 'I enter the verdict: Edony struck the false shillings.',
    topic: 'evidence reasoning',
    world: buildTutorStubPublicLearnerAnalysisWorld(
      loadWorld(path.join(ROOT, 'config/drama-derivation/world-000-smoke.yaml')),
    ),
    tutorTurn: 1,
    publicStagedEvidence: [],
    evidenceUseRubric,
    ...overrides,
  });
}

test('substituting the clause in a v1 prompt reproduces a native v2 prompt byte-for-byte', () => {
  const v1 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
  const v2 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
  assert.notEqual(v1, v2, 'the two rubrics must produce different prompts or there is nothing to relabel');

  const substituted = substituteEvidenceUseClause(v1);
  assert.equal(substituted.ok, true, substituted.reason ?? 'substitution refused a valid v1 prompt');
  // The identity the whole relabel rests on: a replayed record is not merely
  // "close to" a v2 run, it is the same prompt.
  assert.equal(substituted.prompt, v2);
});

test('the identity holds with register selection on, where the prompt grows around the clause', () => {
  // The clause is spliced into a line array whose length varies with options, so
  // the substitution must be position-independent, not an index into the prompt.
  const v1 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1, { includeRegisterSelection: true });
  const v2 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED, { includeRegisterSelection: true });
  assert.equal(substituteEvidenceUseClause(v1).prompt, v2);
});

test('a prompt with no v1 clause is refused rather than passed through', () => {
  // This is what prompt drift looks like: a stored record whose builder has moved
  // on. Relabelling it would silently produce a v1/v2 hybrid.
  const v2 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V2_BRIDGE_VOICED);
  const result = substituteEvidenceUseClause(v2);
  assert.equal(result.ok, false);
  assert.equal(result.prompt, null);
  assert.match(result.reason, /exactly one v1 precedence clause, found 0/u);

  for (const empty of [null, undefined, '']) {
    assert.equal(substituteEvidenceUseClause(empty).ok, false);
  }
});

test('a prompt carrying the v1 clause twice is refused rather than half-substituted', () => {
  const v1 = promptFor(TUTOR_STUB_EVIDENCE_USE_RUBRICS.V1);
  const clause = v1.split('\n').find((line) => line.startsWith('- evidence precedence:'));
  assert.ok(clause, 'could not locate the v1 precedence line in the built prompt');
  const doubled = `${v1}\n${clause}`;
  const result = substituteEvidenceUseClause(doubled);
  assert.equal(result.ok, false);
  assert.match(result.reason, /found 2/u);
});
