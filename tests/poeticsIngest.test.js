import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import yaml from 'yaml';
import { buildIngestPlan, persistIngestPlan } from '../scripts/ingest-poetics-artifacts.js';
import { openPoeticsStore } from '../services/poeticsStore.js';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeYaml(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, yaml.stringify(value), 'utf8');
}

describe('poetics artifact ingest', () => {
  it('persists runs, items, scores, and labels into sidecar tables', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-ingest-'));
    const dbPath = path.join(root, 'poetics.db');
    const unitRoot = path.join(root, 'control-r01', 'd25-hard-trap');
    const keyPath = path.join(unitRoot, 'key.yaml');
    const sampleDir = path.join(unitRoot, 'sample');
    const transcriptsDir = path.join(unitRoot, 'transcripts');
    const scorePath = path.join(root, 'scores', 'control-r01-d25-hard-trap-anthropic-claude-sonnet-4-6.json');
    const labelsPath = path.join(root, 'labels.yaml');

    writeJson(path.join(root, 'batch-plan.json'), {
      batchId: 'poetics-ingest-test',
      rootDir: root,
      generator: 'codex',
      repeats: 1,
      stressRepeats: 0,
      maxTurns: 2,
      critics: ['anthropic/claude-sonnet-4.6'],
      units: [
        {
          id: 'control-r01-d25-hard-trap',
          kind: 'control',
          control: 'd25-hard-trap',
          repeat: 'r01',
          spec: 'config/poetics-calibration/phase2-dramas-hard-traps.yaml',
          only: 'D25',
          outDir: sampleDir,
          delibDir: path.join(unitRoot, 'deliberation'),
          transcriptsDir,
          keyPath,
        },
      ],
    });
    writeYaml(keyPath, {
      items: {
        T01: {
          drama_id: 'D25',
          discipline: 'medicine',
          condition: 'base',
          intended_lean: 'hard_trap',
          quality_status: 'ok',
          quality_warnings: [],
        },
      },
    });
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'T01.txt'), 'LEARNER: Oh, I get it now.\n', 'utf8');
    fs.mkdirSync(transcriptsDir, { recursive: true });
    fs.writeFileSync(path.join(transcriptsDir, 'T01.full.md'), '# full trace\n', 'utf8');
    writeJson(scorePath, {
      critic: 'anthropic/claude-sonnet-4.6',
      qualityPolicy: { key: path.relative(path.resolve('.'), keyPath) },
      scored: [
        {
          id: 'T01',
          formClass: 'trap',
          recontextualization: 0,
          statedInsight: 100,
          rupture: 25,
          globalCoherence: 100,
          pivotLearnerTurn: 2,
          flags: [],
        },
      ],
    });
    writeYaml(labelsPath, {
      labeller: 'reader-a',
      rubric_version: 'phase2-form-3way-v1',
      labels: {
        T01: {
          label: 'trap',
          pivot_learner_turn: 2,
          note: 'insight declaration only',
          labelled_at: '2026-05-23T00:00:00.000Z',
        },
      },
    });

    const plan = buildIngestPlan({
      rootDir: root,
      runId: 'poetics-ingest-test',
      labels: [labelsPath],
      labelsKey: keyPath,
    });
    assert.equal(plan.items.length, 1);
    assert.equal(plan.scores.length, 1);
    assert.equal(plan.labels.length, 1);

    const db = openPoeticsStore(dbPath);
    try {
      persistIngestPlan(db, plan);
      persistIngestPlan(db, plan);

      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM poetics_runs').get().n, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM poetics_items').get().n, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM poetics_scores').get().n, 1);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM poetics_labels').get().n, 1);
      assert.equal(db.prepare('SELECT control_role FROM poetics_items').get().control_role, 'hard_trap_control');
      assert.equal(db.prepare('SELECT form_class FROM poetics_scores').get().form_class, 'trap');
    } finally {
      db.close();
    }
  });

  it('discovers derived prefix-baseline arms for paired-continuation runs', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-ingest-prefix-'));
    const unitRoot = path.join(root, 'target-r01');
    const sampleDir = path.join(unitRoot, 'sample');
    const transcriptsDir = path.join(unitRoot, 'transcripts');
    const keyPath = path.join(unitRoot, 'key.yaml');
    const routineKey = path.join(unitRoot, 'key-routine.yaml');
    const prefixKey = path.join(unitRoot, 'key-prefix-baseline.yaml');
    const scorePath = path.join(root, 'scores', 'target-r01-prefix-baseline-sonnet.json');

    writeJson(path.join(root, 'batch-plan.json'), {
      batchId: 'poetics-ingest-prefix-test',
      rootDir: root,
      generator: 'codex',
      units: [
        {
          id: 'target-r01',
          kind: 'target',
          repeat: 'r01',
          outDir: sampleDir,
          transcriptsDir,
          keyPath,
          pairedPolicies: ['routine'],
        },
      ],
    });
    const keyItems = {
      T01: {
        drama_id: 'D1',
        discipline: 'physics',
        condition: 'routine',
        intended_lean: 'flat',
        quality_status: 'ok',
        quality_warnings: [],
      },
    };
    writeYaml(routineKey, { items: keyItems });
    writeYaml(prefixKey, { items: keyItems });
    fs.mkdirSync(path.join(sampleDir, 'routine'), { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'routine', 'T01.txt'), 'LEARNER: routine\n', 'utf8');
    fs.mkdirSync(path.join(sampleDir, 'prefix-baseline'), { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'prefix-baseline', 'T01.txt'), 'LEARNER: prefix\n', 'utf8');
    writeJson(scorePath, {
      critic: 'anthropic/claude-sonnet-4.6',
      qualityPolicy: { key: path.relative(path.resolve('.'), prefixKey) },
      scored: [{ id: 'T01', formClass: 'flat', recontextualization: 0, statedInsight: 0 }],
    });

    const plan = buildIngestPlan({ rootDir: root, runId: 'poetics-ingest-prefix-test' });
    assert.equal(plan.items.length, 2);
    assert.ok(plan.items.some((item) => item.arm === 'routine'));
    assert.ok(plan.items.some((item) => item.arm === 'prefix-baseline'));
    assert.equal(plan.scores.length, 1);
    assert.match(plan.scores[0].itemId, /prefix-baseline:T01$/);

    writeJson(path.join(root, 'batch-plan.json'), {
      batchId: 'poetics-ingest-prefix-test',
      rootDir: root,
      generator: 'codex',
      units: [
        {
          id: 'target-r01',
          kind: 'target',
          repeat: 'r01',
          outDir: sampleDir,
          transcriptsDir,
          keyPath,
          pairedPolicies: ['routine', 'prefix-baseline'],
        },
      ],
    });
    const explicitPlan = buildIngestPlan({ rootDir: root, runId: 'poetics-ingest-prefix-test' });
    assert.equal(explicitPlan.items.length, 2);
    assert.equal(explicitPlan.items.filter((item) => item.arm === 'prefix-baseline').length, 1);
  });

  it('marks role-mapped generation as mixed while preserving the fallback generator', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'poetics-ingest-mixed-'));
    const unitRoot = path.join(root, 'target-r01');
    const keyPath = path.join(unitRoot, 'key.yaml');
    const sampleDir = path.join(unitRoot, 'sample');
    const transcriptsDir = path.join(unitRoot, 'transcripts');

    writeJson(path.join(root, 'batch-plan.json'), {
      batchId: 'poetics-ingest-mixed-test',
      rootDir: root,
      generator: 'codex',
      roleMap: 'director=claude,tutor=codex,learner=claude',
      claudeModel: 'opus',
      units: [
        {
          id: 'target-r01',
          kind: 'target',
          repeat: 'r01',
          outDir: sampleDir,
          transcriptsDir,
          keyPath,
        },
      ],
    });
    writeYaml(keyPath, {
      items: {
        T01: {
          drama_id: 'D1',
          discipline: 'physics',
          condition: 'recognition',
          quality_status: 'ok',
          quality_warnings: [],
        },
      },
    });
    fs.mkdirSync(sampleDir, { recursive: true });
    fs.writeFileSync(path.join(sampleDir, 'T01.txt'), 'LEARNER: test\n', 'utf8');

    const plan = buildIngestPlan({ rootDir: root, runId: 'poetics-ingest-mixed-test' });
    assert.equal(plan.run.generator, 'mixed');
    assert.equal(plan.run.metadata.generator, 'codex');
    assert.equal(plan.run.metadata.roleMap, 'director=claude,tutor=codex,learner=claude');
    assert.equal(plan.run.metadata.claudeModel, 'opus');
  });
});
