import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildDiagnosticReport, renderMarkdown } from '../scripts/diagnose-poetics-adaptation-failures.js';
import {
  openPoeticsStore,
  upsertPoeticsItem,
  upsertPoeticsRun,
  upsertPoeticsScore,
  upsertPoeticsTutorAdaptation,
} from '../services/poeticsStore.js';

function withDb(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-adaptation-diagnose-'));
  const db = openPoeticsStore(path.join(root, 'poetics.db'));
  try {
    seed(db, root);
    return fn(db, root);
  } finally {
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function seed(db, root) {
  const samplePath = path.join(root, 'sample', 'T01.txt');
  const tutorPath = path.join(root, 'transcripts', 'T01.tutor.md');
  const fullPath = path.join(root, 'transcripts', 'T01.full.md');
  write(
    samplePath,
    'TUTOR: Try the same method again.\n\nLEARNER: That still does not explain the case.\n\nTUTOR: Repeat the rule.',
  );
  write(fullPath, '# Full transcript\n');
  write(
    tutorPath,
    `# Tutor held-out role transcript

## Turn 2 / TUTOR

### Tutor Superego (critique)

PERIPETEIA_CHECK: Fail. The draft notices resistance but repeats the prior method.

KEEP_OR_CHANGE: Change route, not just wording.

### Tutor Ego (adjudication/final authority)

_private decision: Keep the explanation and make it shorter._

### Tutor Public Output

Repeat the same rule in fewer words.
`,
  );

  upsertPoeticsRun(db, {
    id: 'diag-run',
    sourceRoot: root,
    batchId: 'diag-run',
    generator: 'codex',
    metadata: {},
  });
  upsertPoeticsItem(db, {
    id: 'diag-run:target-r01:peripeteia-only:T01',
    runId: 'diag-run',
    unitId: 'target-r01',
    arm: 'peripeteia-only',
    tid: 'T01',
    dramaId: 'D1',
    discipline: 'math',
    condition: 'recognition',
    intendedLean: 'recognition',
    samplePath,
    fullTranscriptPath: fullPath,
    metadata: {},
  });
  upsertPoeticsScore(db, {
    itemId: 'diag-run:target-r01:peripeteia-only:T01',
    criticModel: 'qwen/qwen3.7-max',
    scoreFile: 'scores/qwen.json',
    formClass: 'flat',
    recontextualization: 50,
    statedInsight: 25,
    metadata: {
      tutor_adaptive_mechanism: 25,
      tutor_contingent_adaptation: 0,
      tutor_reversal_evidence: '',
    },
  });
  upsertPoeticsTutorAdaptation(db, {
    itemId: 'diag-run:target-r01:peripeteia-only:T01',
    analyzerVersion: 'tutor-adaptation-v4',
    sourceTracePath: tutorPath,
    learnerSelfReframe: false,
    tutorContingentAdaptation: false,
    tutorAdaptationScore: 0,
    metadata: {
      peripeteia: {
        learner_reversal_pressure: true,
        instrumented_pressure: true,
        private_mechanism_declared: false,
        tutor_adaptive_mechanism: false,
        tutor_peripeteia_score: 20,
      },
    },
  });
}

describe('diagnose-poetics-adaptation-failures', () => {
  it('surfaces adaptive-arm failures with public and tutor-inner fragments', () =>
    withDb((db) => {
      const report = buildDiagnosticReport(db, {
        runId: 'diag-run',
        arms: ['peripeteia-only'],
        limit: 4,
        minTutorMechanism: 70,
        maxPublicChars: 1000,
        maxInnerChars: 1000,
      });
      assert.equal(report.cases.length, 1);
      assert.deepEqual(report.cases[0].issueTags.sort(), [
        'consensus_insufficient',
        'low_judge_tutor_mechanism',
        'no_private_route',
        'no_public_habit_break',
      ]);
      assert.match(report.cases[0].publicFragment, /That still does not explain/);
      assert.match(report.cases[0].tutorInnerFragment, /PERIPETEIA_CHECK: Fail/);
      assert.match(renderMarkdown(report), /Judge Mechanism Evidence/);
    }));
});
