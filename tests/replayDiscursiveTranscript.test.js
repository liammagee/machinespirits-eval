import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  adversarialCheckerFor,
  evaluateLocalGate,
  extractPublicTranscript,
  normalizeBackend,
  parseArgs,
  parseJsonResponse,
  runReplay,
  summarizeGate,
} from '../scripts/replay-discursive-transcript.js';

test('extractPublicTranscript pulls fenced Public Performance from full transcript', () => {
  const full = `# Full held-out role transcript

## Director Scene Card

hidden notes

## Public Performance

\`\`\`text
STAGE: [a board]

TUTOR: "public"
\`\`\`

## Private Ego-Superego Dialogue

private`;

  assert.equal(extractPublicTranscript(full), 'STAGE: [a board]\n\nTUTOR: "public"');
});

test('parseJsonResponse handles fenced repaired JSON', () => {
  const parsed = parseJsonResponse('```json\n{"passes": true, "scores": {"a": 1,}}\n```');
  assert.equal(parsed.passes, true);
  assert.equal(parsed.scores.a, 1);
});

test('normalizeBackend aliases gemini to agy', () => {
  assert.equal(normalizeBackend('gemini'), 'agy');
  assert.equal(normalizeBackend('AGY'), 'agy');
});

test('parseArgs resolves adversarial checker policy from generator', () => {
  const codexArgs = parseArgs(['--transcript', '/tmp/T01.txt', '--generator', 'codex', '--checker', 'adversarial']);
  assert.equal(codexArgs.checker, 'claude');
  assert.equal(codexArgs.checkerPolicy, 'adversarial');
  assert.equal(adversarialCheckerFor('claude'), 'codex');
  assert.equal(adversarialCheckerFor('gemini'), 'codex');
});

test('evaluateLocalGate accepts a clean local checker result', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.8,
        tactic_selection: 0.8,
        learner_uptake_or_contest: 0.8,
        dyadic_revision: 0.75,
        non_leakage: 1,
        prose_preservation: 0.7,
      },
      findings: [],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'survivor');
  assert.equal(gate.escalate, true);
});

test('evaluateLocalGate rejects low non-leakage and failed checker results', () => {
  const gate = evaluateLocalGate(
    {
      passes: false,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.8,
        tactic_selection: 0.8,
        learner_uptake_or_contest: 0.8,
        dyadic_revision: 0.8,
        non_leakage: 0.5,
        prose_preservation: 0.7,
      },
      findings: [{ severity: 'fail', criterion: 'non_leakage', evidence: 'hidden cue leaked' }],
      recommended_action: 'discard',
    },
    {
      non_leakage_check: { passes: false },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'reject');
  assert.equal(gate.escalate, false);
  assert.ok(gate.failures.some((failure) => failure.criterion === 'non_leakage'));
  assert.ok(gate.failures.some((failure) => failure.criterion === 'recommended_action'));
});

test('evaluateLocalGate normalizes 0-5 checker scores before thresholding', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 5,
        tactic_selection: 4,
        learner_uptake_or_contest: 5,
        dyadic_revision: 4,
        non_leakage: 5,
        prose_preservation: 5,
      },
      findings: [],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'survivor');
  assert.equal(gate.scores.tactic_selection.raw, 4);
  assert.equal(gate.scores.tactic_selection.value, 0.8);
  assert.equal(gate.scores.tactic_selection.scale, '0-5');
});

test('summarizeGate separates survivor, revision, and reject buckets', () => {
  const summary = summarizeGate([
    { item: { id: 'a' }, gate: { status: 'survivor' }, paths: { revisedPublic: '/tmp/a.txt' } },
    { item: { id: 'b' }, gate: { status: 'revise_again' }, paths: { revisedPublic: '/tmp/b.txt' } },
    { item: { id: 'c' }, gate: { status: 'reject' }, paths: { revisedPublic: '/tmp/c.txt' } },
  ]);

  assert.equal(summary.counts.survivor, 1);
  assert.equal(summary.counts.revise_again, 1);
  assert.equal(summary.counts.reject, 1);
  assert.equal(summary.survivors[0].item_id, 'a');
  assert.equal(summary.needs_revision[0].item_id, 'b');
  assert.equal(summary.rejected[0].item_id, 'c');
});

test('mock replay writes counterfactual artifact bundle without DB', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-test-'));
  const transcript = path.join(tmp, 'T01.full.md');
  const key = path.join(tmp, 'key.yaml');
  const outDir = path.join(tmp, 'out');
  fs.writeFileSync(
    transcript,
    `# Full held-out role transcript

## Public Performance

\`\`\`text
LEARNER: "It still seems like the decimal is another label."
TUTOR: "Place it below."
\`\`\`

## Private Ego-Superego Dialogue

The tutor privately notices a repair opportunity.`,
  );
  fs.writeFileSync(key, 'items:\n  T01:\n    tutor_adaptation_policy: peripeteia\n');

  const result = await runReplay({
    transcript,
    key,
    outDir,
    generator: 'mock',
    checker: 'mock',
    limit: 1,
    timeoutMs: 1000,
    publicMaxChars: 5000,
    innerMaxChars: 5000,
    force: false,
    dryRun: false,
    codexEffort: 'xhigh',
    codexModel: null,
    claudeModel: null,
    claudeEffort: null,
    agyBin: 'agy',
    agyModelLabel: 'mock',
    itemIds: [],
    runId: null,
    db: path.join(tmp, 'missing.db'),
  });

  assert.equal(result.manifest.count, 1);
  const record = result.manifest.records[0];
  assert.ok(fs.existsSync(record.paths.revisedPublic));
  assert.ok(fs.existsSync(record.paths.revisionJson));
  assert.ok(fs.existsSync(record.paths.checkJson));
  assert.ok(fs.existsSync(record.paths.gateJson));
  assert.equal(record.gate.status, 'survivor');
  assert.equal(record.gate.escalate, true);
  assert.equal(result.manifest.local_gate.summary.counts.survivor, 1);
  assert.ok(fs.existsSync(path.join(outDir, 'survivors.json')));
  assert.ok(fs.existsSync(path.join(outDir, 'survivors.txt')));
  const revision = JSON.parse(fs.readFileSync(record.paths.revisionJson, 'utf8'));
  assert.equal(revision.claim_boundary, 'counterfactual_revision_not_online_adaptation');
});
