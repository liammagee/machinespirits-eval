import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { validatePaperManifest } from '../services/paperManifestValidator.js';
import {
  computeSemanticAuthorityFingerprint,
  validatePaper2EvidenceManifest,
} from '../services/paper2EvidenceManifestValidator.js';
import { resolvePaperManifestTarget } from '../scripts/validate-paper-manifest.js';

const RUN_ID = 'eval-2026-07-25-abcd1234';
const CLI_PATH = fileURLToPath(new URL('../scripts/validate-paper-manifest.js', import.meta.url));

function createManifest(overrides = {}) {
  const evaluation = {
    label: 'Synthetic evaluation',
    run_ids: [RUN_ID],
    primary_judge_pattern: '%opus%',
    expected_attempts: 1,
    expected_scored: 1,
    unit: 'tutor response',
    ...overrides.evaluation,
  };
  return {
    version: 'test-1',
    generated: '2026-07-25',
    key_evaluations: [evaluation],
    totals: {
      expected_attempts: evaluation.expected_attempts,
      expected_scored: evaluation.expected_scored,
      evaluations: 1,
      opus_primary_count: 1,
      sonnet_primary_count: 0,
      ...overrides.totals,
    },
  };
}

function createPaper(manifest, extraBody = '') {
  const attempts = manifest.totals.expected_attempts;
  const scored = manifest.totals.expected_scored;
  const runId = manifest.key_evaluations[0].run_ids[0];
  return `# Synthetic paper

N=${scored}. N=${scored}. N=${scored}. N=${scored}. This covers one key evaluations.

**Table 2: Synthetic evaluation inventory.**

| Evaluation | Run ID | Section | Attempts | Scored | Unit |
|---|---|---|---:|---:|---|
| Synthetic | ${runId} | Section 1 | ${attempts} | ${scored} | tutor response |
| **Paper totals** | — | — | **${attempts}** | **${scored}** | — |

## 1. Results

Section 1 contains the synthetic result. ${extraBody}

## Appendix D

The registered run is ${runId}.
`;
}

function createDatabase({ status = 'completed', scored = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'paper-manifest-validator-'));
  const path = join(directory, 'evaluations.db');
  const db = new Database(path);
  db.exec(`
    CREATE TABLE evaluation_runs (
      id TEXT PRIMARY KEY,
      status TEXT,
      completed_at TEXT
    );
    CREATE TABLE evaluation_results (
      run_id TEXT,
      judge_model TEXT,
      profile_name TEXT,
      tutor_first_turn_score REAL,
      learner_overall_score REAL
    );
  `);
  db.prepare('INSERT INTO evaluation_runs (id, status) VALUES (?, ?)').run(RUN_ID, status);
  db.prepare(
    `INSERT INTO evaluation_results
      (run_id, judge_model, profile_name, tutor_first_turn_score, learner_overall_score)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(RUN_ID, 'claude-code.opus', 'synthetic', scored ? 4 : null, scored ? 4 : null);
  return { db, path, directory };
}

function messages(result, type = 'fail') {
  return result.entries.filter((entry) => entry.type === type).map((entry) => entry.message);
}

test('validator passes a complete synthetic paper and database in deep mode', () => {
  const manifest = createManifest();
  const { db } = createDatabase();
  const result = validatePaperManifest({ manifest, db, paper: createPaper(manifest), deep: true });
  db.close();

  assert.equal(result.exitCode, 0);
  assert.equal(result.failCount, 0);
  assert.equal(result.warnCount, 0);
  assert.ok(result.passCount >= 15);
});

test('validator fails closed on score drift and missing runs', () => {
  const driftManifest = createManifest({
    evaluation: { expected_scored: 2 },
    totals: { expected_scored: 2 },
  });
  const missingRunManifest = createManifest({ evaluation: { run_ids: ['eval-2026-07-25-deadbeef'] } });
  const { db } = createDatabase();

  const drift = validatePaperManifest({
    manifest: driftManifest,
    db,
    paper: createPaper(driftManifest),
  });
  const missingRun = validatePaperManifest({
    manifest: missingRunManifest,
    db,
    paper: createPaper(missingRunManifest),
  });
  db.close();

  assert.equal(drift.exitCode, 1);
  assert.match(messages(drift).join('\n'), /scored=1, expected=2/);
  assert.equal(missingRun.exitCode, 1);
  assert.match(messages(missingRun).join('\n'), /not found in evaluation_runs/);
});

test('validator fails closed on malformed manifests and missing required inputs', () => {
  const malformed = validatePaperManifest({ manifest: { totals: {} }, db: null, paper: null });
  const missing = validatePaperManifest({
    manifest: createManifest(),
    db: null,
    paper: null,
    databasePath: '/fixtures/missing.db',
    paperPath: '/fixtures/missing.md',
  });

  assert.equal(malformed.exitCode, 1);
  assert.match(messages(malformed).join('\n'), /key_evaluations must be an array/);
  assert.equal(missing.exitCode, 1);
  assert.deepEqual(messages(missing), [
    'Database not found or unreadable: /fixtures/missing.db',
    'Paper not found or unreadable: /fixtures/missing.md',
  ]);
});

test('validator preserves explicit status repair behavior', () => {
  const manifest = createManifest();
  const { db } = createDatabase({ status: 'running' });
  const beforeRepair = validatePaperManifest({ manifest, db, paper: createPaper(manifest) });
  const repaired = validatePaperManifest({
    manifest,
    db,
    paper: createPaper(manifest),
    fixStatus: true,
  });
  const run = db.prepare('SELECT status, completed_at FROM evaluation_runs WHERE id = ?').get(RUN_ID);
  db.close();

  assert.equal(beforeRepair.exitCode, 1);
  assert.equal(repaired.exitCode, 0);
  assert.match(messages(repaired, 'warn').join('\n'), /fixed to 'completed'/);
  assert.equal(run.status, 'completed');
  assert.ok(run.completed_at);
});

test('deep checks fail on broken paper references', () => {
  const manifest = createManifest();
  const { db } = createDatabase();
  const result = validatePaperManifest({
    manifest,
    db,
    paper: createPaper(manifest, 'Table 99 and Section 9.9 do not exist.'),
    deep: true,
  });
  db.close();

  assert.equal(result.exitCode, 1);
  assert.match(messages(result).join('\n'), /Table 99 referenced/);
  assert.match(messages(result).join('\n'), /Section 9.9 referenced/);
});

test('CLI accepts explicit fixture paths and returns exact success/failure codes', () => {
  const manifest = createManifest();
  const { db, path, directory } = createDatabase();
  db.close();
  const manifestPath = join(directory, 'manifest.json');
  const paperPath = join(directory, 'paper.md');
  writeFileSync(manifestPath, JSON.stringify(manifest));
  writeFileSync(paperPath, createPaper(manifest));

  const success = spawnSync(
    process.execPath,
    [CLI_PATH, '--manifest', manifestPath, '--paper', paperPath, '--db', path, '--deep'],
    { encoding: 'utf8' },
  );
  assert.equal(success.status, 0, success.stderr || success.stdout);
  assert.match(success.stdout, /Summary: \d+ pass, 0 warn, 0 fail/);

  const missingDatabase = spawnSync(
    process.execPath,
    [CLI_PATH, '--manifest', manifestPath, '--paper', paperPath, '--db', join(directory, 'missing.db')],
    { encoding: 'utf8' },
  );
  assert.equal(missingDatabase.status, 1);
  assert.match(missingDatabase.stdout, /Database not found or unreadable/);

  const missingManifest = spawnSync(
    process.execPath,
    [CLI_PATH, '--manifest', join(directory, 'missing.json'), '--paper', paperPath, '--db', path],
    { encoding: 'utf8' },
  );
  assert.equal(missingManifest.status, 1);
  assert.match(missingManifest.stdout, /Manifest not found or unreadable/);

  const driftManifest = createManifest({
    evaluation: { expected_scored: 2 },
    totals: { expected_scored: 2 },
  });
  writeFileSync(manifestPath, JSON.stringify(driftManifest));
  writeFileSync(paperPath, createPaper(driftManifest));
  const drift = spawnSync(
    process.execPath,
    [CLI_PATH, `--manifest=${manifestPath}`, `--paper=${paperPath}`, `--db=${path}`],
    { encoding: 'utf8' },
  );
  assert.equal(drift.status, 1);
  assert.match(drift.stdout, /scored=1, expected=2/);
});

function createPaper2Fixture() {
  const authority = {
    id: 'fixture-claims',
    module_id: 'fixture.claims',
    locator: 'fixture-claims.yaml',
    format: 'yaml-claims',
    claim_id_prefixes: ['paper2.fixture.'],
  };
  const authoritySource = `claims:\n  - id: paper2.fixture.result\n    statement: { pattern: fixture }\n    evidence: { type: db_count }\n    assertion: { op: eq, expected: 1 }\n`;
  authority.semantic_sha256 = computeSemanticAuthorityFingerprint(authority, authoritySource);
  const disclosure = 'This estimate is historical-only and is not computationally reproducible.';
  const paper = `# Fixture Paper 2\n\n### 6.1 Fixture result\n\nCanonical fixture claim.\n\n### 7.9 Historical disclosure\n\n${disclosure}\n`;
  const manifest = {
    schema: 'paper2-evidence-manifest/v1',
    version: '1.0.0-test',
    paper: 'docs/research/paper-full-2.0.md',
    semantic_authorities: [authority],
    claim_families: [
      {
        id: 'fixture-db',
        paper_sections: ['6.1'],
        paper_markers: ['Canonical fixture claim.'],
        evidence_class: 'database-recomputable',
        semantic_authority_ids: ['fixture-claims'],
        substrates: [{ kind: 'evaluation-database', path: 'fixture.db' }],
      },
      {
        id: 'fixture-history',
        paper_sections: ['7.9'],
        paper_markers: [disclosure],
        evidence_class: 'historical-only',
        semantic_authority_ids: ['fixture-claims'],
        substrates: [],
        disclosure,
      },
    ],
  };
  return { manifest, paper, authoritySource };
}

test('canonical target is Paper 2 and legacy selection is explicit', () => {
  const root = '/fixture-root';
  const canonical = resolvePaperManifestTarget([], root);
  const legacy = resolvePaperManifestTarget(['--target', 'legacy'], root);

  assert.equal(canonical.paper, join(root, 'docs/research/paper-full-2.0.md'));
  assert.equal(canonical.manifest, join(root, 'config/paper2-evidence-manifest.v1.json'));
  assert.equal(legacy.paper, join(root, 'docs/research/paper-full.md'));
  assert.equal(legacy.manifest, join(root, 'config/paper-manifest.json'));
  assert.equal(resolvePaperManifestTarget(['--target', 'unknown'], root), null);
});

test('Paper 2 fixture accepts database and disclosed historical-only families', () => {
  const { manifest, paper, authoritySource } = createPaper2Fixture();
  const result = validatePaper2EvidenceManifest({
    manifest,
    paper,
    db: {},
    readAuthority: () => authoritySource,
  });

  assert.equal(result.exitCode, 0);
  assert.match(messages(result, 'pass').join('\n'), /1 database, 0 artifact, 1 historical-only/);
});

test('Paper 2 fixture fails on missing artifact substrate and unclassified evidence', () => {
  const { manifest, paper, authoritySource } = createPaper2Fixture();
  manifest.claim_families[0] = {
    ...manifest.claim_families[0],
    evidence_class: 'archived-artifact-recomputable',
    substrates: [{ kind: 'archived-artifact', path: 'missing-result.json' }],
  };
  const missing = validatePaper2EvidenceManifest({
    manifest,
    paper,
    db: {},
    readAuthority: () => authoritySource,
    substrateExists: () => false,
  });
  manifest.claim_families[0].evidence_class = 'unknown';
  const unclassified = validatePaper2EvidenceManifest({
    manifest,
    paper,
    db: {},
    readAuthority: () => authoritySource,
  });

  assert.equal(missing.exitCode, 1);
  assert.match(messages(missing).join('\n'), /archived substrate missing: missing-result\.json/);
  assert.equal(unclassified.exitCode, 1);
  assert.match(messages(unclassified).join('\n'), /evidence_class is missing or unclassified/);
});

test('Paper 2 fixture fails when a canonical claim is missing or misdirected', () => {
  const { manifest, paper, authoritySource } = createPaper2Fixture();
  manifest.claim_families[0].paper_markers = ['Claim copied from the legacy paper.'];
  manifest.claim_families[0].paper_sections = ['6.2'];
  const result = validatePaper2EvidenceManifest({
    manifest,
    paper,
    db: {},
    readAuthority: () => authoritySource,
  });

  assert.equal(result.exitCode, 1);
  assert.match(messages(result).join('\n'), /canonical paper marker missing/);
  assert.match(messages(result).join('\n'), /Unclassified Paper 2 result sections: 6\.1/);
});
