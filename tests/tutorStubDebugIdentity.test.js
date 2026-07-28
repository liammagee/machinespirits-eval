import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  createTutorStubDebugLinePrinters,
  formatTutorStubOpeningDebugId,
  formatTutorStubSafeTimestamp,
  formatTutorStubStateTurnDebugId,
  formatTutorStubTurnDebugId,
  printTutorStubAutomaticTechnicalDetails,
  printTutorStubDebugIdLine,
  projectTutorStubCurrentDebugSelection,
  resolveTutorStubStateRunDebugId,
  tutorStubAutomaticTechnicalDetailsEnabled,
} from '../services/tutorStubDebugIdentity.js';

test('debug timestamps remain filename-safe and byte-exact', () => {
  assert.equal(formatTutorStubSafeTimestamp(new Date('2026-07-28T01:02:03.456Z')), '2026-07-28T01-02-03-456Z');
});

test('turn debug ids normalize run ids and pad positive turns', () => {
  assert.equal(formatTutorStubTurnDebugId(' run-fixed ', 7), 'run-fixed:t007');
  assert.equal(formatTutorStubTurnDebugId('', '12'), 'no-trace:t012');
});

test('invalid turn numbers preserve the normalized run identity', () => {
  assert.equal(formatTutorStubTurnDebugId(' run-fixed ', 0), 'run-fixed');
  assert.equal(formatTutorStubTurnDebugId(null, 'not-a-turn'), 'no-trace');
});

test('opening debug ids share the same run normalization', () => {
  assert.equal(formatTutorStubOpeningDebugId(' run-fixed '), 'run-fixed:opening');
  assert.equal(formatTutorStubOpeningDebugId(''), 'no-trace:opening');
});

test('state debug identity preserves explicit, trace, and no-trace precedence', () => {
  assert.equal(resolveTutorStubStateRunDebugId({ debugRunId: 'explicit', trace: { runId: 'trace' } }), 'explicit');
  assert.equal(resolveTutorStubStateRunDebugId({ trace: { runId: 'trace' } }), 'trace');
  assert.equal(resolveTutorStubStateRunDebugId({}), 'no-trace');
  assert.equal(resolveTutorStubStateRunDebugId(null), 'no-trace');
});

test('state turn debug ids reuse canonical run normalization and turn padding', () => {
  assert.equal(formatTutorStubStateTurnDebugId({ debugRunId: 'run' }, 4), 'run:t004');
  assert.equal(formatTutorStubStateTurnDebugId({ trace: { runId: 'trace' } }, '12'), 'trace:t012');
  assert.equal(formatTutorStubStateTurnDebugId(null, 0), 'no-trace');
});

test('automatic technical details require both enabled explanatory debug and the technical format', () => {
  assert.equal(tutorStubAutomaticTechnicalDetailsEnabled(null), false);
  assert.equal(tutorStubAutomaticTechnicalDetailsEnabled({}), false);
  assert.equal(tutorStubAutomaticTechnicalDetailsEnabled({ explanatoryDebug: { enabled: true } }), false);
  assert.equal(
    tutorStubAutomaticTechnicalDetailsEnabled({ explanatoryDebug: { enabled: false, format: 'technical' } }),
    false,
  );
  assert.equal(
    tutorStubAutomaticTechnicalDetailsEnabled({ explanatoryDebug: { enabled: true, format: 'concise' } }),
    false,
  );
  assert.equal(
    tutorStubAutomaticTechnicalDetailsEnabled({ explanatoryDebug: { enabled: true, format: 'technical' } }),
    true,
  );
});

test('automatic technical-details printing preserves the disabled gate and injected state-aware printer', () => {
  const calls = [];
  const render = () => 'rendered';
  const options = { print: (state, callback) => calls.push({ state, callback }) };
  const disabled = { explanatoryDebug: { enabled: false, format: 'technical' } };
  const enabled = { explanatoryDebug: { enabled: true, format: 'technical' } };
  assert.equal(printTutorStubAutomaticTechnicalDetails(disabled, render, options), false);
  assert.deepEqual(calls, []);
  assert.equal(printTutorStubAutomaticTechnicalDetails(enabled, render, options), true);
  assert.deepEqual(calls, [{ state: enabled, callback: render }]);
});

test('current debug selection preserves run, opening, completed-turn, active-turn, and trace precedence', () => {
  assert.deepEqual(projectTutorStubCurrentDebugSelection({ trace: { runId: 'run-a' } }), {
    runId: 'run-a',
    completedId: null,
    activeId: null,
    selectedId: 'run-a',
    tracePath: null,
    lastCompletedTurnId: null,
  });
  assert.deepEqual(
    projectTutorStubCurrentDebugSelection(
      {
        trace: { runId: 'run-a', filePath: '/tmp/run-a.jsonl' },
        history: [{ role: 'assistant', content: 'opening' }],
      },
      { duringTurn: true },
    ),
    {
      runId: 'run-a',
      completedId: 'run-a:opening',
      activeId: 'run-a:t001',
      selectedId: 'run-a:t001',
      tracePath: '/tmp/run-a.jsonl',
      lastCompletedTurnId: null,
    },
  );
  assert.deepEqual(
    projectTutorStubCurrentDebugSelection({ trace: { runId: 'run-a' }, turns: [{ turn: 3, turnId: 'custom-id' }] }),
    {
      runId: 'run-a',
      completedId: 'custom-id',
      activeId: null,
      selectedId: 'custom-id',
      tracePath: null,
      lastCompletedTurnId: 'custom-id',
    },
  );
  assert.equal(
    projectTutorStubCurrentDebugSelection({ trace: { runId: 'run-a' }, turns: [{ turn: 3 }] }, { duringTurn: true })
      .lastCompletedTurnId,
    'run-a:t003',
  );
});

test('debug line printers preserve technical gating, IDs, duplicate suppression, and shared colors', () => {
  const lines = [];
  const colors = { cyan: '<cyan>', reset: '<reset>' };
  const printers = createTutorStubDebugLinePrinters({ write: (line) => lines.push(line), colors });
  const disabled = { trace: { runId: 'run-a' }, explanatoryDebug: { enabled: false, format: 'technical' } };
  const enabled = { trace: { runId: 'run-a' }, explanatoryDebug: { enabled: true, format: 'technical' } };
  assert.equal(printers.printTurnDebugLine(disabled, 2), null);
  assert.equal(printers.printOpeningDebugLine(disabled), null);
  assert.equal(printers.printTurnDebugLine(enabled, 2), 'run-a:t002');
  assert.equal(printers.printTurnDebugLine(enabled, 2), 'run-a:t002');
  colors.cyan = '<updated>';
  assert.equal(printers.printOpeningDebugLine(enabled), 'run-a:opening');
  assert.deepEqual(lines, ['<cyan>turn id ><reset> run-a:t002', '<updated>turn id ><reset> run-a:opening']);
});

test('debug-ID line printing preserves missing IDs, first-print formatting, de-duplication, labels, and state', () => {
  const state = {};
  const lines = [];
  const options = {
    write: (line) => lines.push(line),
    colors: { cyan: '<cyan>', reset: '<reset>' },
  };
  assert.equal(printTutorStubDebugIdLine(state, null, 'turn id', options), null);
  assert.equal(state.printedDebugIds, undefined);
  assert.equal(printTutorStubDebugIdLine(state, 'run:t001', 'active id', options), 'run:t001');
  assert.equal(printTutorStubDebugIdLine(state, 'run:t001', 'changed label', options), 'run:t001');
  assert.equal(printTutorStubDebugIdLine(state, 'run:t002', undefined, options), 'run:t002');
  assert.deepEqual(lines, ['<cyan>active id ><reset> run:t001', '<cyan>turn id ><reset> run:t002']);
  assert.deepEqual([...state.printedDebugIds], ['run:t001', 'run:t002']);
});

test('the CLI imports rather than redeclares the debug identity model', () => {
  const source = fs.readFileSync(new URL('../scripts/tutor-stub.js', import.meta.url), 'utf8');
  assert.match(source, /from '\.\.\/services\/tutorStubDebugIdentity\.js'/u);
  assert.doesNotMatch(
    source,
    /function (?:safeTimestampForFile|formatTurnDebugId|openingDebugId|stateRunDebugId|turnDebugId|automaticTechnicalDetailsEnabled|printDebugIdLine)\(/u,
  );
});
