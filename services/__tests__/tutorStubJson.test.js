import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { closeTruncatedTutorStubJson, normalizeTutorStubAnalysisEnvelope } from '../tutorStubJson.js';

describe('tutor-stub truncated JSON repair', () => {
  it('closes the single missing object delimiter seen in the learner analysis trace', () => {
    const truncated =
      '{"classification":{"turn":{"summary":"Learner gives an ambiguous answer."},"overall":{"summary":"Continuation."},"learner_record":{"human_discourse":{"proof_status":"unclear"},"notes":"No update."}}';
    const repaired = closeTruncatedTutorStubJson(truncated);

    assert.ok(repaired);
    assert.deepEqual(JSON.parse(repaired), {
      classification: {
        turn: { summary: 'Learner gives an ambiguous answer.' },
        overall: { summary: 'Continuation.' },
        learner_record: { human_discourse: { proof_status: 'unclear' }, notes: 'No update.' },
      },
    });
  });

  it('promotes known combined-analysis fields nested by the missing delimiter', () => {
    const normalized = normalizeTutorStubAnalysisEnvelope({
      classification: {
        turn: { summary: 'A contextual answer.' },
        overall: { summary: 'Progressing.' },
        learner_record: { human_discourse: { proof_status: 'provisional_scaffold' } },
      },
    });

    assert.deepEqual(normalized, {
      classification: {
        turn: { summary: 'A contextual answer.' },
        overall: { summary: 'Progressing.' },
      },
      learner_record: { human_discourse: { proof_status: 'provisional_scaffold' } },
    });
  });

  it('refuses unterminated strings and trailing prose', () => {
    assert.equal(closeTruncatedTutorStubJson('{"summary":"unfinished}'), null);
    assert.equal(closeTruncatedTutorStubJson('{"summary":"done"} extra'), null);
  });

  it('refuses repairs larger than the bounded delimiter allowance', () => {
    assert.equal(closeTruncatedTutorStubJson('{"a":[{"b":1'), null);
  });
});
