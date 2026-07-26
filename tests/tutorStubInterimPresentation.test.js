import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  formatTutorStubSignedInterimNumber,
  summarizeTutorStubInterimCapabilities,
  tutorStubInterimCliHintPanels,
  tutorStubInterimLevel,
  tutorStubPlainInterimBottleneck,
} from '../services/tutorStubInterimPresentation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('interim signed numbers preserve null, sign, rounding, and precision behavior', () => {
  assert.equal(formatTutorStubSignedInterimNumber(undefined), null);
  assert.equal(formatTutorStubSignedInterimNumber(Number.NaN), null);
  assert.equal(formatTutorStubSignedInterimNumber(0), null);
  assert.equal(formatTutorStubSignedInterimNumber('0'), null);
  assert.equal(formatTutorStubSignedInterimNumber(0.125), '+0.13');
  assert.equal(formatTutorStubSignedInterimNumber(-0.125), '-0.13');
  assert.equal(formatTutorStubSignedInterimNumber(1.2345, { decimals: 3 }), '+1.234');
});

test('interim capability summaries preserve ordering and the plain-response fallback', () => {
  assert.equal(summarizeTutorStubInterimCapabilities(null), 'plain tutor response');
  assert.equal(summarizeTutorStubInterimCapabilities({}), 'plain tutor response');
  assert.equal(
    summarizeTutorStubInterimCapabilities({
      classifier: { enabled: true },
      learnerDag: { enabled: true },
      register: { enabled: true },
      dag: {},
    }),
    'learner reading, reasoning progress, response style, evidence pacing',
  );
  assert.equal(summarizeTutorStubInterimCapabilities({ classifier: { enabled: false }, dag: true }), 'evidence pacing');
});

test('interim strength bands pin unavailable handling and every threshold boundary', () => {
  assert.equal(tutorStubInterimLevel(undefined), 'not available');
  assert.equal(tutorStubInterimLevel('not-a-number'), 'not available');
  assert.equal(tutorStubInterimLevel(-1), 'low');
  assert.equal(tutorStubInterimLevel(0.249), 'low');
  assert.equal(tutorStubInterimLevel(0.25), 'developing');
  assert.equal(tutorStubInterimLevel(0.499), 'developing');
  assert.equal(tutorStubInterimLevel(0.5), 'strong');
  assert.equal(tutorStubInterimLevel(0.749), 'strong');
  assert.equal(tutorStubInterimLevel(0.75), 'very strong');
  assert.equal(tutorStubInterimLevel(2), 'very strong');
});

test('interim bottleneck labels preserve authored copy and readable fallback normalization', () => {
  const expected = {
    release_or_pacing_gap: 'the learner needs the next usable piece of evidence',
    warrant_gap: 'the learner needs a clearer reasoning link',
    unsupported_assertion: 'the conclusion has moved beyond the evidence',
    grounded_asserted_secret: 'the conclusion is supported and stated',
    grounded_unasserted_secret: 'the conclusion is supported but not yet stated',
  };
  for (const [value, label] of Object.entries(expected)) {
    assert.equal(tutorStubPlainInterimBottleneck(value), label);
  }
  assert.equal(tutorStubPlainInterimBottleneck('custom_learning_gap'), 'custom learning gap');
  assert.equal(tutorStubPlainInterimBottleneck(), 'the next useful learner move');
});

test('interim CLI hints preserve passthrough, setup, coach, auto, and learner contexts', () => {
  const shared = {
    label: 'CLI hint',
    tone: 'neutral',
    text: 'type / to browse | type to filter | Tab completes | /help groups commands',
  };
  const cases = [
    {
      active: { state: { passthrough: { enabled: true }, interaction: { mode: 'coach' } } },
      contextual: {
        label: 'While waiting',
        tone: 'neutral',
        text: '/status and /transcript stay live | /scenario changes the case | /reset cancels unfinished work',
      },
    },
    {
      active: { basePhase: 'Preparing Scenario', state: { interaction: { mode: 'coach' } } },
      contextual: {
        label: 'Change setup',
        tone: 'neutral',
        text: '/scenario switches case | /profile changes learner | /settings adjusts models and pacing',
      },
    },
    {
      active: { phase: 'opening artifacts', state: {} },
      contextual: {
        label: 'Change setup',
        tone: 'neutral',
        text: '/scenario switches case | /profile changes learner | /settings adjusts models and pacing',
      },
    },
    {
      active: { state: { interaction: { mode: 'coach' } } },
      contextual: {
        label: 'Coach controls',
        tone: 'neutral',
        text: '/coach adds private guidance | /mode learner returns control | /analysis inspects the exchange',
      },
    },
    {
      active: { state: { interaction: { mode: 'auto' } } },
      contextual: {
        label: 'Auto controls',
        tone: 'neutral',
        text: '/status checks progress | /analysis inspects the exchange | /reset cancels safely',
      },
    },
    {
      active: { state: { interaction: { mode: 'learner', autoRunning: true } } },
      contextual: {
        label: 'Auto controls',
        tone: 'neutral',
        text: '/status checks progress | /analysis inspects the exchange | /reset cancels safely',
      },
    },
    {
      active: { state: { interaction: { mode: 'learner' } } },
      contextual: {
        label: 'Next moves',
        tone: 'neutral',
        text: '/clue asks for direction | /suggest previews a reply | /coach privately guides the tutor',
      },
    },
  ];

  for (const fixture of cases) {
    const before = structuredClone(fixture.active);
    assert.deepEqual(tutorStubInterimCliHintPanels(fixture.active), [shared, fixture.contextual]);
    assert.deepEqual(fixture.active, before, 'hint projection must not mutate live animation state');
  }
});

test('the CLI and learning summary share pure interim copy while retaining runtime and report ownership', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const learningSummarySource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubLearningSummary.js'), 'utf8');
  const serviceSource = fs.readFileSync(path.join(ROOT, 'services', 'tutorStubInterimPresentation.js'), 'utf8');

  assert.match(cliSource, /from '\.\.\/services\/tutorStubInterimPresentation\.js';/u);
  assert.match(learningSummarySource, /from '\.\/tutorStubInterimPresentation\.js';/u);
  assert.doesNotMatch(
    cliSource,
    /function (?:formatSignedInterimNumber|compactInterimStateSummary|interimLevel|plainInterimBottleneck|compactInterimCliHintPanels)\s*\(/u,
  );
  assert.doesNotMatch(learningSummarySource, /function plainInterimBottleneck\s*\(/u);
  assert.match(cliSource, /function renderInterimStatus\s*\(/u);
  assert.match(cliSource, /function startInterimAnimation\s*\(/u);
  assert.match(cliSource, /function stopInterimAnimation\s*\(/u);
  assert.doesNotMatch(serviceSource, /\b(?:fs|console|process|fetch|setInterval|clearInterval)\s*[.(]/u);
});
