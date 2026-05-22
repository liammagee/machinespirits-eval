import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseJsonResponse } from '../scripts/score-poetics-calibration.js';

test('poetics scorer JSON parser repairs raw LaTeX backslashes in model evidence', () => {
  const parsed = parseJsonResponse(
    '{"pivot_learner_turn":3,"recontextualization":{"evidence":"\\(\\sqrt{2}\\) starts from a fraction assumption"}}',
  );

  assert.equal(parsed.pivot_learner_turn, 3);
  assert.equal(parsed.recontextualization.evidence, '(sqrt{2}) starts from a fraction assumption');
});
