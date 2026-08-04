import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  createTutorStubInterimController,
  createTutorStubInterimState,
} from '../services/tutorStubInterimController.js';
import { createTutorStubLearnerAnalysisRuntime } from '../services/tutorStubLearnerAnalysisRuntime.js';
import { createTutorStubLearnerEvidenceRuntime } from '../services/tutorStubLearnerEvidenceRuntime.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('learner evidence runtime preserves release projections and pre-model trace timing', () => {
  const traceEvents = [];
  const runtime = createTutorStubLearnerEvidenceRuntime({
    appendTraceEvent: (_trace, event) => traceEvents.push(event),
    buildTutorStubLearnerDagPreflight: (input) => ({ schema: 'preflight', input }),
    projectTutorStubCommittedReleaseRows: (_pacing, _world, throughTurn, options) => [
      { turn: throughTurn, fallbackRows: options.fallbackRows },
    ],
    projectTutorStubCurrentReleaseRows: (_pacing, _world, tutorTurn, options) => [
      { turn: tutorTurn, pointOfAction: options.pointOfAction },
    ],
    projectTutorStubLearnerPublicEvidenceState: (rows) => ({ publicStagedEvidence: rows }),
    projectTutorStubNextReleaseRow: () => ({ turn: 4 }),
    projectTutorStubPublicReleaseLedger: (rows) => ({ rows }),
    projectTutorStubSpeakerPublicPremise: () => null,
    stagedEvidenceRows: () => [{ id: 'fallback' }],
  });
  const state = {
    trace: {},
    releasePacing: {},
    pointOfAction: { current: 'standing_book' },
    world: { id: 'world' },
    learnerDag: { enabled: true, record: { board: new Map() } },
  };

  assert.deepEqual(runtime.currentReleaseRows(state, 3), [{ turn: 3, pointOfAction: 'standing_book' }]);
  assert.deepEqual(runtime.nextReleaseRow(state), { turn: 4 });
  assert.deepEqual(runtime.publicReleaseLedger(state, 3), {
    rows: [{ turn: 3, fallbackRows: runtime.committedReleaseRows(state, 3)[0].fallbackRows }],
  });
  const preflight = runtime.learnerDagPreflightForTurn(state, 3, { traceSource: 'unit' });
  assert.equal(preflight.schema, 'preflight');
  assert.equal(traceEvents[0].timing, 'before_model_call');
  assert.equal(traceEvents[0].source, 'unit');
});

test('learner analysis runtime preserves combined-result aliases and fallback classification', () => {
  const runtime = createTutorStubLearnerAnalysisRuntime({
    failedClassification: (input) => ({ error: input.message, latencyMs: input.latencyMs }),
  });
  const state = { learnerDag: { resolved: { provider: 'codex', model: 'analysis' } } };
  const raw = {
    parsed: {
      learner_classification: { turn: { summary: 'A move.' }, overall: { summary: 'A path.' } },
      public_record: { adopt: ['p1'] },
    },
    parseError: null,
    provider: 'codex',
    model: 'analysis',
    latencyMs: 12,
    usage: { totalTokens: 9 },
  };

  assert.deepEqual(runtime.classificationFromCombinedAnalysis(raw, state), {
    turn: { summary: 'A move.' },
    overall: { summary: 'A path.' },
    parseError: null,
    provider: 'codex',
    model: 'analysis',
    latencyMs: 12,
    usage: { totalTokens: 9 },
    combined: true,
  });
  assert.deepEqual(runtime.learnerRecordFromCombinedAnalysis(raw), {
    adopt: ['p1'],
    parseError: null,
    provider: 'codex',
    model: 'analysis',
    latencyMs: 12,
    usage: { totalTokens: 9 },
    combined: true,
  });
  assert.deepEqual(runtime.classificationFromCombinedAnalysis({ parsed: {}, latencyMs: 7 }, state), {
    error: 'Combined learner analysis did not include a classification object.',
    latencyMs: 7,
  });
});

test('interim controller owns disabled-terminal lifecycle and tutor context projection', () => {
  const interim = createTutorStubInterimState({ enabled: true });
  const controller = createTutorStubInterimController({
    buildHumanDiscourseFrame: (input) => ({ turn: input.tutorTurn }),
    buildTutorDagSnapshot: (_state, turn) => ({ turn }),
    colors: { reset: '' },
    getPresentation: () => ({ motion: 'off' }),
    output: { isTTY: false, columns: 80 },
    write() {},
  });
  const state = { interim, turns: [{ turn: 1 }] };

  assert.equal(controller.startInterimAnimation(state, 'analysis'), null);
  assert.deepEqual(controller.buildTutorInterimContext({ learnerText: 'Why?', state, classification: { turn: {} } }), {
    learnerText: 'Why?',
    tutorTurn: 2,
    classification: { turn: {} },
    tutorLearnerDag: null,
    registerSelection: null,
    previousRegisterEfficacy: null,
    tutorDagSnapshot: { turn: 2 },
    humanDiscourseFrame: { turn: 2 },
  });
  assert.equal(controller.pauseInterimAnimation(state), false);
  assert.equal(controller.stopInterimAnimation(state), false);
});

test('entrypoint binds bounded learner-analysis and interim owners', () => {
  const cliSource = fs.readFileSync(path.join(ROOT, 'scripts', 'tutor-stub.js'), 'utf8');
  const owners = [
    ['services/tutorStubLearnerAnalysisRuntime.js', 1_000],
    ['services/tutorStubInterimController.js', 320],
    ['services/tutorStubLearnerEvidenceRuntime.js', 320],
  ];

  assert.match(cliSource, /createTutorStubLearnerAnalysisRuntime/u);
  assert.match(cliSource, /createTutorStubInterimController/u);
  assert.match(cliSource, /createTutorStubLearnerEvidenceRuntime/u);
  assert.doesNotMatch(
    cliSource,
    /function (?:analyzeLearnerTurn|renderInterimStatus|learnerDagPreflightForTurn)\s*\(/u,
  );
  assert.ok(cliSource.split('\n').length <= 13_100, 'macro cycle 8 keeps the entrypoint line-count ratchet');
  for (const [relativePath, limit] of owners) {
    const source = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
    assert.ok(source.split('\n').length < limit, `${relativePath} must remain a bounded owner`);
  }
});
