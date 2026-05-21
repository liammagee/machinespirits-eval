import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), '..');

describe('generate-pedagogical-dramas', () => {
  it('routes tutor and learner roles to different backends and persists held-out role transcripts', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drama-gen-test-'));
    const sampleDir = path.join(tmp, 'sample');
    const delibDir = path.join(tmp, 'delib');
    const transcriptsDir = path.join(tmp, 'transcripts');
    const keyPath = path.join(tmp, 'key.yaml');

    execFileSync(
      process.execPath,
      [
        'scripts/generate-pedagogical-dramas.js',
        '--mock',
        '--max-turns',
        '1',
        '--spec',
        'config/poetics-calibration/phase2-dramas-v3.yaml',
        '--tid-start',
        '6',
        '--only',
        'D7',
        '--role-map',
        'tutor=claude,learner=codex',
        '--out-dir',
        sampleDir,
        '--delib-dir',
        delibDir,
        '--transcripts-dir',
        transcriptsDir,
        '--key',
        keyPath,
        '--force',
      ],
      { cwd: ROOT, stdio: 'pipe', env: { ...process.env, GEN_DRAMAS_CLI_TRACE: '0' } },
    );

    const traceFile = fs.readdirSync(delibDir).find((f) => /^T\d+\.json$/.test(f));
    assert.ok(traceFile, 'expected a held-out trace file');
    const trace = JSON.parse(fs.readFileSync(path.join(delibDir, traceFile), 'utf8'));

    assert.equal(trace.run.generator, 'mixed');
    assert.deepEqual(trace.run.role_map, { tutor: 'claude', learner: 'codex' });
    assert.equal(trace.run.writing_pad.mode, 'isolated');
    assert.ok(['ok', 'review_before_scoring'].includes(trace.quality_status));
    assert.ok(Array.isArray(trace.quality_warnings), 'quality warnings should always be machine-readable');

    const tutorEntries = trace.turns
      .filter((turn) => turn.phase === 'tutor')
      .flatMap((turn) => turn.internalDeliberation || []);
    const learnerEntries = trace.turns
      .filter((turn) => turn.phase === 'learner')
      .flatMap((turn) => turn.internalDeliberation || []);

    assert.ok(tutorEntries.length > 0, 'expected tutor deliberation entries');
    assert.ok(learnerEntries.length > 0, 'expected learner deliberation entries');
    assert.ok(
      tutorEntries.every((entry) => entry.provenance?.backend === 'claude'),
      'all tutor role calls should be routed to claude',
    );
    assert.ok(
      learnerEntries.every((entry) => entry.provenance?.backend === 'codex'),
      'all learner role calls should be routed to codex',
    );
    assert.ok(
      [...tutorEntries, ...learnerEntries].every((entry) => entry.provenance?.promptHashes?.combined),
      'every role call should persist a prompt hash',
    );
    assert.ok(
      learnerEntries.filter((entry) => entry.role === 'ego').every((entry) => entry.provenance?.agentRole === 'learner_ego'),
      'learner ego should be one stable routed role across initial and adjudication stages',
    );
    assert.ok(
      tutorEntries.filter((entry) => entry.role === 'ego').every((entry) => entry.provenance?.agentRole === 'tutor_ego'),
      'tutor ego should be one stable routed role across initial and adjudication stages',
    );
    assert.ok(
      learnerEntries.some((entry) => entry.role === 'ego' && entry.stage === 'adjudication'),
      'expected learner ego adjudication stage',
    );
    assert.ok(
      tutorEntries.some((entry) => entry.role === 'ego' && entry.stage === 'adjudication'),
      'expected tutor ego adjudication stage',
    );
    assert.ok(
      learnerEntries.every((entry) => entry.role !== 'ego_initial' && entry.role !== 'ego_revision'),
      'initial/revision should be stages, not separate learner ego roles',
    );

    const tid = traceFile.replace(/\.json$/, '');
    for (const suffix of ['public.txt', 'full.md', 'stage.md', 'tutor.md', 'learner.md']) {
      assert.ok(fs.existsSync(path.join(transcriptsDir, `${tid}.${suffix}`)), `missing ${suffix} transcript`);
    }
    const publicSample = fs.readFileSync(path.join(sampleDir, `${tid}.txt`), 'utf8');
    assert.match(publicSample, /^STAGE:/m, 'public drama sample should expose visible stage directions');
    const fullTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.full.md`), 'utf8');
    assert.match(fullTranscript, /Director Scene Card/);
    assert.match(fullTranscript, /Tutor Ego \(adjudication\/final authority\)/);
    assert.match(fullTranscript, /Learner Ego \(adjudication\/final authority\)/);
    const tutorTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.tutor.md`), 'utf8');
    const learnerTranscript = fs.readFileSync(path.join(transcriptsDir, `${tid}.learner.md`), 'utf8');
    assert.match(tutorTranscript, /backend=claude/);
    assert.match(learnerTranscript, /backend=codex/);

    const key = yaml.parse(fs.readFileSync(keyPath, 'utf8'));
    assert.equal(key.writing_pad.mode, 'isolated');
    assert.equal(key.transcripts_dir, path.relative(ROOT, transcriptsDir));
    assert.equal(key.items[tid].quality_status, trace.quality_status);
    assert.equal(key.quality_warning_count, key.items[tid].quality_warnings.length);

    const scorePath = path.join(tmp, 'score.json');
    execFileSync(
      process.execPath,
      ['scripts/score-poetics-phase2.js', '--mock', '--sample-dir', sampleDir, '--key', keyPath, '--out', scorePath],
      { cwd: ROOT, stdio: 'pipe' },
    );
    const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
    assert.equal(score.scored[0].id, tid);
    assert.deepEqual(score.qualityPolicy.skipped, []);
  });
});
