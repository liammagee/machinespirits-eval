import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import assert from 'node:assert/strict';

// Stage A3 (Line A, notes/2026-07-06-longitudinal-drift-adaptation-prereg.md
// §8.5/§8.7): hermetic unit coverage for services/writingPadNarrativeBuilder.js
// against a REAL (throwaway, temp) Writing Pad DB — never the production
// tutor-core/data/lms.sqlite. Must be set before the first getDb() call
// (triggered lazily by any writingPadService/dbService function), so the
// tutor-core imports below are dynamic and come after this assignment.
const TMP_DB_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'writing-pad-narrative-test-')), 'lms.sqlite');
process.env.AUTH_DB_PATH = TMP_DB_PATH;

const { getOrInitializeWritingPad, createRecognitionMoment, updateUnconscious } =
  await import('../../tutor-core/services/writingPadService.js');
const { runBackgroundMaintenance } = await import('../../tutor-core/services/memoryDynamicsService.js');
const { closeDb } = await import('../../tutor-core/services/dbService.js');
const { buildWritingPadNarrative, WRITING_PAD_NARRATIVE_BUILDER_VERSION } =
  await import('../writingPadNarrativeBuilder.js');

after(() => {
  closeDb();
  fs.rmSync(path.dirname(TMP_DB_PATH), { recursive: true, force: true });
});

test('buildWritingPadNarrative: null learnerId/empty string returns null without touching the DB', () => {
  assert.equal(buildWritingPadNarrative(null), null);
  assert.equal(buildWritingPadNarrative(undefined), null);
  assert.equal(buildWritingPadNarrative(''), null);
});

test('buildWritingPadNarrative: returns null for a learner with no pad row at all', () => {
  assert.equal(buildWritingPadNarrative(`narrative-test-nopad-${Date.now()}`), null);
});

test('buildWritingPadNarrative: returns null for a freshly initialized pad (zero permanentTraces)', () => {
  const learnerId = `narrative-test-fresh-${Date.now()}`;
  getOrInitializeWritingPad(learnerId);
  assert.equal(buildWritingPadNarrative(learnerId), null);
});

test('buildWritingPadNarrative: §8.5 precondition-gate case — a real settled recognition moment surfaces its synthesis text', () => {
  const learnerId = `narrative-test-marker-${Date.now()}`;
  const pad = getOrInitializeWritingPad(learnerId);
  const marker = `STAGE-A3-MARKER-${Date.now()}`;

  // The same call dialecticalEngine.negotiateDialectically makes on a real
  // superego disapproval (Step 3), followed by the same eager consolidation
  // call services/evaluationRunner.js already makes after every session.
  createRecognitionMoment({
    writingPadId: pad.id,
    sessionId: null,
    ghostDemand: { voice: 'stage-a3-check-voice', principle: 'stage-a3-check-principle' },
    learnerNeed: { need: 'stage-a3-check-need', intensity: 0.6 },
    synthesis: { synthesis: `Learner reached ${marker} while working through fractions.`, transformative: true },
    parameters: { superegoCompliance: 0.7, recognitionSeeking: 0.6 },
  });
  runBackgroundMaintenance(learnerId, { consolidation: { minAge: 0, requireTransformative: false } });

  const narrative = buildWritingPadNarrative(learnerId);
  assert.ok(narrative, 'narrative should be non-null once a moment has been consolidated to unconscious');
  assert.ok(narrative.includes(marker), `narrative should include the seeded marker; got: ${narrative}`);
});

test('buildWritingPadNarrative: falls back to transformations text when synthesis is empty', () => {
  const learnerId = `narrative-test-fallback-transform-${Date.now()}`;
  getOrInitializeWritingPad(learnerId);
  updateUnconscious(learnerId, {
    permanentTraces: [
      {
        id: 'synthetic-1',
        synthesis: '',
        transformations: { ego: 'ego-fallback-marker-text', superego: '', learner: '' },
        recognitionType: null,
      },
    ],
  });
  const narrative = buildWritingPadNarrative(learnerId);
  assert.ok(narrative, 'narrative should be non-null via the transformations fallback');
  assert.ok(narrative.includes('ego-fallback-marker-text'));
});

test('buildWritingPadNarrative: falls back to recognitionType when synthesis and transformations are both empty', () => {
  const learnerId = `narrative-test-fallback-type-${Date.now()}`;
  getOrInitializeWritingPad(learnerId);
  updateUnconscious(learnerId, {
    permanentTraces: [
      { id: 'synthetic-2', synthesis: '', transformations: {}, recognitionType: 'breakthrough-marker-type' },
    ],
  });
  const narrative = buildWritingPadNarrative(learnerId);
  assert.ok(narrative, 'narrative should be non-null via the recognitionType fallback');
  assert.ok(narrative.includes('breakthrough-marker-type'));
});

test('buildWritingPadNarrative: a fully empty trace (no synthesis/transformations/recognitionType) yields null overall', () => {
  const learnerId = `narrative-test-allempty-${Date.now()}`;
  getOrInitializeWritingPad(learnerId);
  updateUnconscious(learnerId, {
    permanentTraces: [{ id: 'synthetic-3', synthesis: '', transformations: {}, recognitionType: null }],
  });
  assert.equal(buildWritingPadNarrative(learnerId), null);
});

test('buildWritingPadNarrative: respects maxTraces (only the most recent N are rendered)', () => {
  const learnerId = `narrative-test-maxtraces-${Date.now()}`;
  getOrInitializeWritingPad(learnerId);
  const traces = Array.from({ length: 5 }, (_, i) => ({
    id: `t${i}`,
    synthesis: `trace-number-${i}`,
    transformations: {},
    recognitionType: null,
  }));
  updateUnconscious(learnerId, { permanentTraces: traces });

  const narrative = buildWritingPadNarrative(learnerId, { maxTraces: 2 });
  assert.ok(narrative);
  assert.ok(!narrative.includes('trace-number-0'), 'oldest traces beyond the cap should be dropped');
  assert.ok(!narrative.includes('trace-number-2'));
  assert.ok(narrative.includes('trace-number-3'), 'the most recent traces should be kept');
  assert.ok(narrative.includes('trace-number-4'));
});

test('buildWritingPadNarrative: respects maxChars (truncates on a line boundary, never mid-line)', () => {
  const learnerId = `narrative-test-maxchars-${Date.now()}`;
  getOrInitializeWritingPad(learnerId);
  const longLine = 'x'.repeat(500);
  updateUnconscious(learnerId, {
    permanentTraces: [
      { id: 't1', synthesis: longLine, transformations: {}, recognitionType: null },
      { id: 't2', synthesis: longLine, transformations: {}, recognitionType: null },
      { id: 't3', synthesis: longLine, transformations: {}, recognitionType: null },
    ],
  });
  const narrative = buildWritingPadNarrative(learnerId, { maxChars: 600 });
  assert.ok(narrative.length <= 600, `narrative should respect the maxChars bound; got length ${narrative.length}`);
  // Truncation happens on a whole rendered line — every kept line's full
  // synthesis text (the 500-char run) should appear intact, never sliced.
  const keptLines = narrative.split('\n').filter((line) => line.startsWith('- '));
  for (const line of keptLines) {
    assert.equal(line, `- ${longLine}`, 'a kept line must be the full, untruncated rendered trace line');
  }
});

test('WRITING_PAD_NARRATIVE_BUILDER_VERSION is a non-empty string', () => {
  assert.equal(typeof WRITING_PAD_NARRATIVE_BUILDER_VERSION, 'string');
  assert.ok(WRITING_PAD_NARRATIVE_BUILDER_VERSION.length > 0);
});
