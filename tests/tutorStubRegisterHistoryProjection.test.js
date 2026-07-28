import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { projectTutorStubRegisterHistoryPrompt } from '../services/tutorStubRegisterHistoryProjection.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('register history prompt preserves bounds, normalization, ratings, reasons, and pending efficacy', () => {
  const history = Array.from({ length: 8 }, (_, index) => ({
    turn: index + 1,
    selected_register: index === 7 ? null : `register_${index + 1}`,
    register_reason: index === 6 ? '' : `reason ${index + 1}`,
    efficacy:
      index === 5
        ? { label: 'advanced', progressScore: 0.75, learnerFeedback: { rating: 4 }, summary: 'strong uptake' }
        : null,
  }));
  const output = projectTutorStubRegisterHistoryPrompt(
    { register: { history } },
    { normalizeSelection: (entry) => entry },
  );

  assert.equal(output.split('\n').length, 6);
  assert.doesNotMatch(output, /Turn 1:|Turn 2:/u);
  assert.match(
    output,
    /Turn 6: register_6 — reason 6; efficacy: advanced \(DAG score 0\.75; learner rating 4; strong uptake\)/u,
  );
  assert.match(output, /Turn 7: register_7 — no reason; efficacy: pending next learner turn/u);
  assert.match(output, /Turn 8: unknown — reason 8; efficacy: pending next learner turn/u);
});

test('register history prompt preserves empty-state fallback and legacy normalization', () => {
  assert.equal(
    projectTutorStubRegisterHistoryPrompt(null, { normalizeSelection: (entry) => entry }),
    'No prior tutor-register choices.',
  );
  assert.equal(
    projectTutorStubRegisterHistoryPrompt(
      { register: { history: [{ turn: 2, register: 'warm', register_reason: 'repair' }] } },
      { normalizeSelection: (entry) => ({ ...entry, selected_register: entry.register }) },
    ),
    'Turn 2: warm — repair; efficacy: pending next learner turn',
  );
});

test('the CLI binds rather than redeclares register-history projection', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubRegisterHistoryProjection.js'), 'utf8');

  assert.match(cliSource, /projectTutorStubRegisterHistoryPrompt/u);
  assert.doesNotMatch(cliSource, /function registerHistoryPromptSummary/u);
  assert.doesNotMatch(serviceSource, /^import\s/mu);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|Date\.now)\s*[.(]/u);
});
