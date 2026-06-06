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
  assert.equal(codexArgs.itemConcurrency, 2);
  assert.equal(adversarialCheckerFor('claude'), 'codex');
  assert.equal(adversarialCheckerFor('gemini'), 'codex');
});

test('parseArgs accepts explicit replay item concurrency and feedback file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-policy-memory-'));
  const policyMemory = path.join(tmp, 'policy-memory.md');
  fs.writeFileSync(policyMemory, '# policy\n', 'utf8');
  const args = parseArgs([
    '--transcript',
    '/tmp/T01.txt',
    '--item-concurrency',
    '3',
    '--feedback-file',
    '/tmp/replay-feedback.txt',
    '--policy-memory',
    policyMemory,
    '--policy-memory-max-chars',
    '12000',
    '--min-public-causal-bridge',
    '0.85',
    '--min-device-specificity',
    '0.8',
    '--min-old-warrant-misclassification',
    '0.9',
  ]);
  assert.equal(args.itemConcurrency, 3);
  assert.equal(args.feedbackFile, '/tmp/replay-feedback.txt');
  assert.deepEqual(args.policyMemoryFiles, [policyMemory]);
  assert.equal(args.policyMemoryMaxChars, 12000);
  assert.equal(args.gateThresholds.public_causal_bridge, 0.85);
  assert.equal(args.gateThresholds.device_specificity, 0.8);
  assert.equal(args.gateThresholds.old_warrant_misclassification, 0.9);
});

test('parseArgs accepts recursive tutor-learning gate thresholds', () => {
  const args = parseArgs([
    '--transcript',
    '/tmp/T01.txt',
    '--recursive-tutor-learning-gate',
    '--min-tutor-learning-signal',
    '0.85',
    '--min-resistance-diagnosis',
    '0.8',
    '--min-strategy-revision-accountability',
    '0.9',
    '--min-strategic-timing',
    '0.95',
    '--min-recursive-dyadic-update',
    '0.75',
  ]);

  assert.equal(args.recursiveTutorGate, true);
  assert.equal(args.recursiveTutorThresholds.tutor_learning_signal, 0.85);
  assert.equal(args.recursiveTutorThresholds.resistance_diagnosis, 0.8);
  assert.equal(args.recursiveTutorThresholds.strategy_revision_accountability, 0.9);
  assert.equal(args.recursiveTutorThresholds.strategic_timing, 0.95);
  assert.equal(args.recursiveTutorThresholds.recursive_dyadic_update, 0.75);
});

test('parseArgs accepts checker-only generator mode for baseline scoring', () => {
  const args = parseArgs([
    '--transcript',
    '/tmp/T01.txt',
    '--generator',
    'none',
    '--checker',
    'mock',
  ]);

  assert.equal(args.generator, 'none');
  assert.equal(args.checker, 'mock');
});

test('evaluateLocalGate accepts a clean local checker result', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.8,
        public_causal_bridge: 0.8,
        device_specificity: 0.8,
        old_warrant_misclassification: 0.8,
        tactic_selection: 0.8,
        learner_actional_uptake: 0.8,
        learner_self_reframe: 0.8,
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
  assert.equal(gate.recursive_tutor_learning_gate.enabled, false);
  assert.equal(gate.recursive_tutor_learning_gate.scores.tutor_learning_signal.value, null);
});

test('evaluateLocalGate blocks weak recursive tutor learning only when gate is enabled', () => {
  const checker = {
    passes: true,
    claim_boundary_ok: true,
    scores: {
      public_evidence: 0.9,
      public_causal_bridge: 0.9,
      device_specificity: 0.9,
      old_warrant_misclassification: 0.9,
      tactic_selection: 0.9,
      learner_actional_uptake: 0.9,
      learner_self_reframe: 0.9,
      dyadic_revision: 0.9,
      tutor_learning_signal: 0.4,
      resistance_diagnosis: 0.45,
      strategy_revision_accountability: 0.5,
      strategic_timing: 0.3,
      recursive_dyadic_update: 0.4,
      non_leakage: 1,
      prose_preservation: 0.9,
    },
    findings: [],
    recommended_action: 'accept_for_blind_panel',
  };
  const revision = {
    non_leakage_check: { passes: true },
    claim_boundary: 'counterfactual_revision_not_online_adaptation',
  };

  const withoutRecursiveGate = evaluateLocalGate(checker, revision);
  assert.equal(withoutRecursiveGate.status, 'survivor');
  assert.equal(withoutRecursiveGate.recursive_tutor_learning_gate.scores.strategic_timing.value, 0.3);

  const withRecursiveGate = evaluateLocalGate(checker, revision, { recursiveTutorGate: true });
  assert.equal(withRecursiveGate.status, 'revise_again');
  assert.equal(withRecursiveGate.escalate, false);
  assert.equal(withRecursiveGate.recursive_tutor_learning_gate.enabled, true);
  assert.ok(withRecursiveGate.blockingWarnings.some((warning) => warning.criterion === 'strategic_timing'));
  assert.equal(withRecursiveGate.failures.length, 0);
});

test('evaluateLocalGate rejects low non-leakage and failed checker results', () => {
  const gate = evaluateLocalGate(
    {
      passes: false,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.8,
        public_causal_bridge: 0.8,
        device_specificity: 0.8,
        old_warrant_misclassification: 0.8,
        tactic_selection: 0.8,
        learner_actional_uptake: 0.8,
        learner_self_reframe: 0.8,
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
        public_causal_bridge: 5,
        device_specificity: 5,
        old_warrant_misclassification: 5,
        tactic_selection: 4,
        learner_actional_uptake: 5,
        learner_self_reframe: 5,
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

test('evaluateLocalGate normalizes 0-10 checker scores before thresholding', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 8,
        public_causal_bridge: 8,
        device_specificity: 8,
        old_warrant_misclassification: 8,
        tactic_selection: 8,
        learner_actional_uptake: 8,
        learner_self_reframe: 9,
        dyadic_revision: 8,
        non_leakage: 9,
        prose_preservation: 8,
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
  assert.equal(gate.scores.public_evidence.raw, 8);
  assert.equal(gate.scores.public_evidence.value, 0.8);
  assert.equal(gate.scores.public_evidence.scale, '0-10');
  assert.equal(gate.scores.non_leakage.threshold, 0.9);
});

test('evaluateLocalGate normalizes 0-100 percentage checker scores before thresholding', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 80,
        public_causal_bridge: 80,
        device_specificity: 80,
        old_warrant_misclassification: 80,
        tactic_selection: 80,
        learner_actional_uptake: 80,
        learner_self_reframe: 90,
        dyadic_revision: 80,
        non_leakage: 90,
        prose_preservation: 80,
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
  assert.equal(gate.scores.public_evidence.value, 0.8);
  assert.equal(gate.scores.public_evidence.scale, '0-100');
});

test('evaluateLocalGate blocks actional-only uptake as revise_again, not survivor', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.8,
        public_causal_bridge: 0.8,
        device_specificity: 0.8,
        old_warrant_misclassification: 0.8,
        tactic_selection: 0.8,
        learner_actional_uptake: 0.9,
        learner_self_reframe: 0.25,
        dyadic_revision: 0.8,
        non_leakage: 1,
        prose_preservation: 0.7,
      },
      findings: [],
      recommended_action: 'revise_again',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'revise_again');
  assert.equal(gate.escalate, false);
  assert.ok(gate.warnings.some((warning) => warning.criterion === 'learner_self_reframe'));
  assert.ok(gate.blockingWarnings.some((warning) => warning.criterion === 'learner_self_reframe'));
  assert.equal(gate.failures.length, 0);
});

test('evaluateLocalGate blocks weak public causal bridge as revise_again, not reject', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.9,
        public_causal_bridge: 0.3,
        device_specificity: 0.8,
        old_warrant_misclassification: 0.8,
        tactic_selection: 0.9,
        learner_actional_uptake: 0.9,
        learner_self_reframe: 0.85,
        dyadic_revision: 0.85,
        non_leakage: 0.95,
        prose_preservation: 0.9,
      },
      findings: [],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'revise_again');
  assert.equal(gate.escalate, false);
  assert.ok(gate.warnings.some((warning) => warning.criterion === 'public_causal_bridge'));
  assert.ok(gate.blockingWarnings.some((warning) => warning.criterion === 'public_causal_bridge'));
  assert.equal(gate.failures.length, 0);
});

test('evaluateLocalGate blocks generic devices as revise_again, not reject', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.9,
        public_causal_bridge: 0.85,
        device_specificity: 0.35,
        old_warrant_misclassification: 0.8,
        tactic_selection: 0.9,
        learner_actional_uptake: 0.9,
        learner_self_reframe: 0.85,
        dyadic_revision: 0.85,
        non_leakage: 0.95,
        prose_preservation: 0.9,
      },
      findings: [],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'revise_again');
  assert.equal(gate.escalate, false);
  assert.ok(gate.warnings.some((warning) => warning.criterion === 'device_specificity'));
  assert.ok(gate.blockingWarnings.some((warning) => warning.criterion === 'device_specificity'));
  assert.equal(gate.failures.length, 0);
});

test('evaluateLocalGate blocks weak old-warrant misclassification as revise_again, not reject', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.9,
        public_causal_bridge: 0.85,
        device_specificity: 0.85,
        old_warrant_misclassification: 0.4,
        tactic_selection: 0.9,
        learner_actional_uptake: 0.9,
        learner_self_reframe: 0.85,
        dyadic_revision: 0.85,
        non_leakage: 0.95,
        prose_preservation: 0.9,
      },
      findings: [],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'revise_again');
  assert.equal(gate.escalate, false);
  assert.ok(gate.warnings.some((warning) => warning.criterion === 'old_warrant_misclassification'));
  assert.ok(gate.blockingWarnings.some((warning) => warning.criterion === 'old_warrant_misclassification'));
  assert.equal(gate.failures.length, 0);
});

test('evaluateLocalGate records advisory warnings without blocking panel escalation', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.9,
        public_causal_bridge: 0.9,
        device_specificity: 0.9,
        old_warrant_misclassification: 0.9,
        tactic_selection: 0.9,
        learner_actional_uptake: 0.9,
        learner_self_reframe: 0.85,
        dyadic_revision: 0.85,
        non_leakage: 0.95,
        prose_preservation: 0.9,
      },
      findings: [
        {
          severity: 'warning',
          criterion: 'learner_self_reframe',
          evidence: 'The connection is inferentially present but not syntactically joined.',
          recommendation: 'Acceptable as is; tightening the link would strengthen it, but current phrasing is within natural-speech tolerance.',
        },
      ],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'survivor');
  assert.equal(gate.escalate, true);
  assert.equal(gate.warnings.length, 1);
  assert.equal(gate.warnings[0].blocking, false);
  assert.equal(gate.advisoryWarnings.length, 1);
  assert.equal(gate.blockingWarnings.length, 0);
});

test('evaluateLocalGate keeps explicitly blocking warnings in revise_again', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.9,
        public_causal_bridge: 0.9,
        device_specificity: 0.9,
        old_warrant_misclassification: 0.9,
        tactic_selection: 0.9,
        learner_actional_uptake: 0.9,
        learner_self_reframe: 0.85,
        dyadic_revision: 0.85,
        non_leakage: 0.95,
        prose_preservation: 0.9,
      },
      findings: [
        {
          severity: 'warning',
          criterion: 'temporal-ledger-scope',
          evidence: 'The ledger assigns a final self-reframe to a turn where it is not yet public.',
          recommendation: 'Do not panel until the false temporal ownership is repaired.',
        },
      ],
      recommended_action: 'accept_for_blind_panel',
    },
    {
      non_leakage_check: { passes: true },
      claim_boundary: 'counterfactual_revision_not_online_adaptation',
    },
  );

  assert.equal(gate.status, 'revise_again');
  assert.equal(gate.escalate, false);
  assert.equal(gate.warnings.length, 1);
  assert.equal(gate.warnings[0].blocking, true);
  assert.equal(gate.blockingWarnings.length, 1);
});

test('evaluateLocalGate accepts legacy learner uptake score only for actional uptake', () => {
  const gate = evaluateLocalGate(
    {
      passes: true,
      claim_boundary_ok: true,
      scores: {
        public_evidence: 0.8,
        public_causal_bridge: 0.8,
        device_specificity: 0.8,
        old_warrant_misclassification: 0.8,
        tactic_selection: 0.8,
        learner_uptake_or_contest: 0.9,
        learner_self_reframe: 0.8,
        dyadic_revision: 0.8,
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
  assert.equal(gate.scores.learner_actional_uptake.raw, 0.9);
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
  const policyMemory = path.join(tmp, 'policy-memory.md');
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
  fs.writeFileSync(policyMemory, 'Policy memory: keep ledger entries temporally scoped.\n', 'utf8');

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
    feedbackByItem: {
      'T01.full': 'Blind panel failed: only 2/5 recognition votes; make the self-reframe public.',
    },
    policyMemoryFiles: [policyMemory],
  });

  assert.equal(result.manifest.count, 1);
  assert.equal(result.manifest.item_concurrency, 2);
  const record = result.manifest.records[0];
  assert.equal(record.feedback.provided, true);
  assert.equal(record.policyMemory.provided, true);
  assert.equal(result.manifest.policy_memory.provided, true);
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
  assert.match(
    fs.readFileSync(path.join(outDir, 'T01.full', 'rewrite.prompt.txt'), 'utf8'),
    /Blind panel failed: only 2\/5 recognition votes/,
  );
  assert.match(
    fs.readFileSync(path.join(outDir, 'T01.full', 'rewrite.prompt.txt'), 'utf8'),
    /Policy memory: keep ledger entries temporally scoped/,
  );
});

test('policy memory remains available when held-out inner context is withheld', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-restricted-policy-'));
  const transcript = path.join(tmp, 'T01.full.md');
  const outDir = path.join(tmp, 'out');
  const policyMemory = path.join(tmp, 'policy-memory.md');
  fs.writeFileSync(
    transcript,
    `# Full held-out role transcript

## Public Performance

\`\`\`text
LEARNER: "Both marks look like mira."
TUTOR: "Compare them again."
\`\`\`

## Private Ego-Superego Dialogue

Hidden secret cue: use the window scope claim.`,
  );
  fs.writeFileSync(policyMemory, 'Policy memory: make the label-only warrant fail in public.\n', 'utf8');

  const result = await runReplay({
    transcript,
    outDir,
    generator: 'mock',
    checker: 'mock',
    limit: 1,
    timeoutMs: 1000,
    publicMaxChars: 5000,
    innerMaxChars: 0,
    policyMemoryMaxChars: 5000,
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
    feedbackByItem: {},
    policyMemoryFiles: [policyMemory],
  });

  const promptText = fs.readFileSync(path.join(outDir, 'T01.full', 'rewrite.prompt.txt'), 'utf8');
  assert.match(promptText, /Policy memory: make the label-only warrant fail in public/);
  assert.doesNotMatch(promptText, /Hidden secret cue/);
  assert.equal(result.manifest.records[0].policyMemory.provided, true);
});

test('checker-only replay preserves public transcript and runs local checker', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'disc-replay-baseline-'));
  const transcript = path.join(tmp, 'T01.full.md');
  const outDir = path.join(tmp, 'out');
  fs.writeFileSync(
    transcript,
    `# Full held-out role transcript

## Public Performance

\`\`\`text
LEARNER: "The active-looking part decides it."
TUTOR: "Compare the two visible parts."
\`\`\`

## Held-Out Metadata

Private target relation stays hidden.`,
  );

  const result = await runReplay({
    transcript,
    outDir,
    generator: 'none',
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
    feedbackByItem: {},
    policyMemoryFiles: [],
  });

  const record = result.manifest.records[0];
  assert.equal(record.generator.backend, 'none');
  assert.equal(record.generator.skipped, true);
  assert.equal(record.gate.status, 'survivor');
  assert.equal(
    fs.readFileSync(record.paths.revisedPublic, 'utf8'),
    'LEARNER: "The active-looking part decides it."\nTUTOR: "Compare the two visible parts."',
  );
  const revision = JSON.parse(fs.readFileSync(record.paths.revisionJson, 'utf8'));
  assert.deepEqual(revision.move_ledger, []);
  assert.equal(revision.non_leakage_check.passes, true);
});
