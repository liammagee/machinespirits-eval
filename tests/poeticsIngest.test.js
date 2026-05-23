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
});
