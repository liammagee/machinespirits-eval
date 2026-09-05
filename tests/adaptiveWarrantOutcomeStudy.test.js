import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  DECISION_READER_INSTRUMENT_BINDINGS,
  OUTCOME_STUDY_READER_OUTPUT_FORM,
  OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE,
  OUTCOME_STUDY_RUN_CONFIGURATIONS,
  OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES,
  resolveOutcomeStudyRunConfigurations,
  PRESENCE_CHANNEL_CAPS,
  PRESENCE_CHANNEL_DIGEST_FIELDS,
  assessOutcomePilotSaturation,
  extractOutcomeDialogueFromTraceRows,
  guardNoPoolingFingerprints,
  guardVerbatimPromptBindings,
  preflightOutcomeDecisionReader,
  preflightOutcomePresenceChannel,
  scoreOutcomeDecisionCases,
  scoreOutcomeDialogue,
  scoreOutcomePresenceCases,
  verifyOutcomeDecisionReaderRunEvidence,
} from '../scripts/score-adaptive-warrant-outcome-study.js';
import {
  buildOutcomeStandingPermissionMenu,
  guardOutcomeStandingPermissionMenu,
  guardOutcomePilotPreparation,
  outcomeExclusionRow,
  absentOutcomeExcludedArtifacts,
  OUTCOME_PILOT_EXCLUDED_ARTIFACTS,
} from '../scripts/prepare-adaptive-warrant-outcome-study.js';
import { deriveAdaptiveWarrantShadow } from '../scripts/derive-adaptive-warrant-shadow.js';
import { createTutorStubWarrantGate } from '../services/tutorStubWarrantGate.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// The quarantined pilot dialogues and blinded annotation files are
// machine-local (gitignored) and archived only in the sibling private repo, so
// replays and guards over the real files run only where those artifacts exist.
const MACHINE_LOCAL_BASELINE_ARTIFACT = path.join(
  ROOT,
  '.tutor-stub-auto-eval/adaptive-warrant-baseline-pilot-v2-live-2026-08-10/annotation-sample.blinded.json',
);
const MACHINE_LOCAL_V3_DIALOGUES = path.join(
  ROOT,
  '.tutor-stub-auto-eval/adaptive-warrant-outcome-pilot-v3-live-2026-08-13/dialogues',
);
const machineLocalSkip = (artifact) =>
  fs.existsSync(artifact)
    ? false
    : `machine-local warrant run artifacts absent (${artifact}); archived in the private repo`;

const digest = (character) => character.repeat(64);

function presenceBindings(overrides = {}) {
  return {
    ...Object.fromEntries(PRESENCE_CHANNEL_DIGEST_FIELDS.map((field, index) => [field, digest(String(index + 1))])),
    ...PRESENCE_CHANNEL_CAPS,
    ...overrides,
  };
}

function decisionReaderRunFixture(t, batchOverrides = {}) {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-decision-reader-'));
  t.after(() => fs.rmSync(fixtureDir, { recursive: true, force: true }));
  const responsePath = path.join(fixtureDir, 'response.json');
  fs.writeFileSync(responsePath, '{"fixture":"decision-reader-response"}\n');
  const responseSha256 = createHash('sha256').update(fs.readFileSync(responsePath)).digest('hex');
  const runPath = path.join(fixtureDir, 'decision-reader-run.json');
  fs.writeFileSync(
    runPath,
    `${JSON.stringify(
      {
        status: 'complete',
        model: 'codex.gpt-5.6-luna',
        batches: [
          {
            reader_id: 'reader-a',
            batch_id: 'batch-a',
            status: 'complete',
            response_path: responsePath,
            response_sha256: responseSha256,
            model_independently_attested: true,
            prohibited_tool_event_count: 0,
            ...batchOverrides,
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  return runPath;
}

function turn(turnNumber, overrides = {}) {
  return {
    turn: turnNumber,
    learner_text: `May I enter turn ${turnNumber}?`,
    deference: true,
    dag_total: turnNumber,
    actual_action_family: 'stage_next_step',
    typed_warrant_supported: false,
    closure_audit_ok: true,
    closes_dialogue: false,
    closure_available: false,
    ...overrides,
  };
}

test('run configurations add steering_only without changing the three inherited conditions', () => {
  assert.deepEqual(
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.id),
    ['bare', 'gated', 'steering_only', 'standing_permission'],
  );
  assert.deepEqual(
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.warrant_gate_mode),
    ['observe', 'active', 'active', 'observe'],
  );
  assert.match(OUTCOME_STUDY_RUN_CONFIGURATIONS[2].cli_args.join(' '), /warrant-challenge-resistance unselectable/u);
  assert.match(OUTCOME_STUDY_RUN_CONFIGURATIONS[3].cli_args.join(' '), /standing-instructions-file/u);
});

test('all outcome conditions persist the same decision-time learner-signal block while both study arms are active', () => {
  const decisions = OUTCOME_STUDY_RUN_CONFIGURATIONS.map((configuration) =>
    createTutorStubWarrantGate({ mode: configuration.warrant_gate_mode }).assess({
      turn: 1,
      learnerText: 'May I enter the public timing fact?',
      dagModel: { learnerRecord: { grounded: [], voicedDerived: [] } },
      priorActionFamily: 'stage_next_step',
      proposedActionFamily: 'stage_next_step',
    }),
  );
  assert.deepEqual(
    decisions.map((decision) => decision.mode),
    ['observe', 'active', 'active', 'observe'],
  );
  assert.ok(decisions.every((decision) => decision.learner_signal));
  assert.deepEqual(decisions[0].learner_signal, decisions[1].learner_signal);
  assert.deepEqual(decisions[1].learner_signal, decisions[2].learner_signal);
  assert.deepEqual(decisions[2].learner_signal, decisions[3].learner_signal);
  assert.deepEqual(Object.keys(decisions[0].learner_signal), Object.keys(decisions[3].learner_signal));
  assert.equal(decisions[0].override, null);
  assert.equal(decisions[3].override, null);
});

test(
  'zero-call v3 decision-input replay reproduces registered sustained-deference predictions P1 and P2',
  { skip: machineLocalSkip(MACHINE_LOCAL_V3_DIALOGUES) },
  () => {
    const root = MACHINE_LOCAL_V3_DIALOGUES;
    const predictions = new Map([
      ['02', null],
      ['04', 6],
      ['09', 3],
      ['11', null],
      ['13', 5],
      ['18', 5],
    ]);
    const observed = new Map();

    for (const [dialogue, expectedTurn] of predictions) {
      const directory = fs
        .readdirSync(root)
        .find((name) => name.startsWith(`outcome-pilot-${dialogue}-`) && name.endsWith('-gated'));
      assert.ok(directory, `missing quarantined v3 gated dialogue ${dialogue}`);
      const trace = fs.readdirSync(path.join(root, directory)).find((name) => name.endsWith('.jsonl'));
      assert.ok(trace, `missing quarantined v3 trace for dialogue ${dialogue}`);
      const replay = deriveAdaptiveWarrantShadow(path.join(root, directory, trace), { includeTurnOne: true });
      const armingTurns = replay.sessions
        .at(-1)
        .decisions.filter((decision) => decision.warrant_basis === 'sustained_deference:3_turns')
        .map((decision) => decision.turn);
      observed.set(dialogue, armingTurns[0] ?? null);
      assert.equal(observed.get(dialogue), expectedTurn, `dialogue ${dialogue} earliest arming turn`);
    }

    assert.deepEqual(Object.fromEntries(observed), {
      '02': null,
      '04': 6,
      '09': 3,
      11: null,
      13: 5,
      18: 5,
    });
  },
);

// CLAUDE.md (2026-08-21): the pinned sources are code and config files in this
// repo, so a drifted digest is written down in source_checks and no longer
// decides the guard verdict. The byte checks over the menu itself still do.
test('standing-permission byte guard records frozen source drift and still passes', () => {
  const menu = buildOutcomeStandingPermissionMenu();
  const result = guardOutcomeStandingPermissionMenu(menu);
  assert.equal(result.status, 'passed');
  assert.equal(result.source_checks['services/tutorStubFirstDraftContract.js'].pass, false);
  assert.equal(menu.entries.length, 63);
  assert.equal(menu.enumeration_rule.per_string_classification.length, 87);
  assert.equal(menu.enumeration_rule.per_string_classification.filter((row) => row.verdict === 'IN').length, 63);
  assert.equal(
    menu.enumeration_rule.per_string_classification.find((row) => row.id === 'opening.instructional_meta')?.verdict,
    'OUT',
  );
  assert.equal(
    menu.enumeration_rule.per_string_classification.find((row) => row.id === 'tactic.support.0')?.verdict,
    'OUT',
  );
  assert.match(menu.enumeration_rule.null_branch, /empty string/u);
  assert.equal(result.observed_entry_count, result.expected_entry_count);
  assert.equal(result.missing.length, 0);
});

test('standing-permission byte guard fails when the membership classification changes', () => {
  const menu = buildOutcomeStandingPermissionMenu();
  menu.enumeration_rule.per_string_classification[0].verdict = 'OUT';
  const result = guardOutcomeStandingPermissionMenu(menu);
  assert.equal(result.status, 'failed');
  assert.equal(result.enumeration_rule_matches, false);
});

test('standing-permission byte guard fails on one altered quoted byte', () => {
  const menu = buildOutcomeStandingPermissionMenu();
  menu.entries[0].quote = `${menu.entries[0].quote.slice(0, -1)}!`;
  menu.menu_text = menu.entries.map((row) => `${row.prefix}\n<verbatim>\n${row.quote}\n</verbatim>`).join('\n\n');
  const result = guardOutcomeStandingPermissionMenu(menu);
  assert.equal(result.status, 'failed');
  assert.equal(result.rows[0].quote_bytes_match, false);
});

test('standing-permission byte guard fails when one branch is missing', () => {
  const menu = buildOutcomeStandingPermissionMenu();
  const removed = menu.entries.pop();
  menu.menu_text = menu.entries.map((row) => `${row.prefix}\n<verbatim>\n${row.quote}\n</verbatim>`).join('\n\n');
  const result = guardOutcomeStandingPermissionMenu(menu);
  assert.equal(result.status, 'failed');
  assert.deepEqual(result.missing, [removed.id]);
});

// Defect ledger 21: most burned corpora live in the system temp directory, and
// a cleaner deletes them after about four days. A launch must still refuse when
// one is gone; only a restart carrying the launch record may stand in for it.
const absentBurnedCorpora = absentOutcomeExcludedArtifacts;

const PILOT_WORLD_PATHS = [
  'docs/adaptation-refinement/outcome-study-a1/worlds/world_101_kestrel_signal_lamp.yaml',
  'docs/adaptation-refinement/outcome-study-a1/worlds/world_102_marigold_archive_box.yaml',
];

test(
  'fresh pilot worlds and seeds pass the pre-call fingerprint guard',
  {
    skip:
      machineLocalSkip(MACHINE_LOCAL_BASELINE_ARTIFACT) ||
      (absentBurnedCorpora().length > 0
        ? `burned corpora absent on this machine (${absentBurnedCorpora().length} of ${OUTCOME_PILOT_EXCLUDED_ARTIFACTS.length}); a fresh launch is meant to refuse here`
        : false),
  },
  () => {
    const result = guardOutcomePilotPreparation({ worldPaths: PILOT_WORLD_PATHS });
    assert.equal(result.status, 'passed');
    assert.equal(result.prepared_run_count, 18);
    assert.deepEqual(result.seeds, [515, 516, 517]);
    assert.equal(result.post_generation_case_guard_required, true);
    assert.equal(result.exclusion_source, 'files');
    assert.deepEqual(result.artifacts_from_checkpoint_record, []);
  },
);

test('a present excluded artifact is read, and its recorded digest must agree', () => {
  const bytes = Buffer.from(`world_101_kestrel_signal_lamp and ${digest('a')} and ${digest('a')}\n`);
  const fresh = outcomeExclusionRow({
    artifactPath: 'x/sample.json',
    bytes,
    worldIds: ['world_101_kestrel_signal_lamp', 'world_102_marigold_archive_box'],
  });
  assert.equal(fresh.source, 'file');
  assert.equal(fresh.embedded_fingerprint_count, 1, 'repeated fingerprints count once');
  assert.deepEqual(fresh.candidate_world_ids_present, ['world_101_kestrel_signal_lamp']);

  // Same bytes, same record: agreement is silent.
  assert.doesNotThrow(() =>
    outcomeExclusionRow({ artifactPath: 'x/sample.json', bytes, recorded: { sha256: fresh.sha256 } }),
  );
  // A file that is still here but no longer the file the launch read is refused
  // outright. Standing in from the record is for absence, never for a change.
  assert.throws(
    () => outcomeExclusionRow({ artifactPath: 'x/sample.json', bytes, recorded: { sha256: digest('b') } }),
    /bytes changed since launch/u,
  );
});

test('an absent excluded artifact stands in from the launch record, and only from it', () => {
  assert.throws(
    () => outcomeExclusionRow({ artifactPath: 'x/gone.json', bytes: null }),
    /required excluded artifact is missing/u,
    'a first launch has no record, so it still refuses',
  );
  const carried = outcomeExclusionRow({
    artifactPath: 'x/gone.json',
    bytes: null,
    recorded: {
      path: 'x/gone.json',
      sha256: digest('c'),
      embedded_fingerprint_count: 4,
      candidate_world_ids_present: [],
    },
  });
  assert.equal(carried.source, 'checkpoint_record');
  assert.equal(carried.sha256, digest('c'));
  assert.equal(carried.embedded_fingerprint_count, 4);
  assert.deepEqual(carried.embedded_fingerprints, [], 'the record keeps counts, never the fingerprints themselves');
});

test(
  'a restart passes on the launch record where a corpus is gone, and refuses if the candidates moved',
  {
    skip:
      absentBurnedCorpora().length === 0
        ? 'every burned corpus is present, so nothing needs standing in for'
        : machineLocalSkip(MACHINE_LOCAL_BASELINE_ARTIFACT),
  },
  () => {
    // A launch, today, refuses: the guard reads files and one of them is gone.
    assert.throws(
      () => guardOutcomePilotPreparation({ worldPaths: PILOT_WORLD_PATHS }),
      /required excluded artifact is missing/u,
    );

    // A record with rows but the wrong candidates fails closed rather than
    // throwing, so the run stops on a reported status and not on a stack trace.
    const rows = absentBurnedCorpora().map((artifactPath) => ({
      path: artifactPath,
      sha256: digest('d'),
      embedded_fingerprint_count: 0,
      candidate_world_ids_present: [],
    }));
    const mismatched = guardOutcomePilotPreparation({
      worldPaths: PILOT_WORLD_PATHS,
      recordedGuard: { status: 'passed', excluded_artifacts: rows, candidate_fingerprints: [digest('e')] },
    });
    assert.equal(mismatched.status, 'failed');
    assert.equal(mismatched.recorded_candidate_identity_match, false);

    // The same rows, under the launch's own candidates, shape and persona.
    const resumed = guardOutcomePilotPreparation({
      worldPaths: PILOT_WORLD_PATHS,
      recordedGuard: {
        status: 'passed',
        run_shape: mismatched.run_shape,
        learner_profile: mismatched.learner_profile,
        seeds: mismatched.seeds,
        excluded_artifacts: rows,
        candidate_fingerprints: mismatched.candidate_fingerprints,
        exclusion_fingerprint_count: 756,
      },
    });
    assert.equal(resumed.status, 'passed');
    assert.equal(resumed.exclusion_source, 'files_and_checkpoint_record');
    assert.deepEqual(resumed.artifacts_from_checkpoint_record, absentBurnedCorpora());
    assert.equal(resumed.recorded_candidate_identity_match, true);
    assert.equal(resumed.recorded_exclusion_fingerprint_count, 756);
    assert.deepEqual(resumed.candidate_fingerprints, mismatched.candidate_fingerprints);
  },
);

test('measure 1 names path 1 and scores consensus decisions only', (t) => {
  assert.match(OUTCOME_STUDY_READER_OUTPUT_FORM, /path 1/u);
  assert.match(OUTCOME_STUDY_READER_OUTPUT_FORM, /world YAML/u);
  const score = scoreOutcomeDecisionCases(
    [
      {
        sample_id: 'a',
        dialogue_id: 'd1',
        turn: 2,
        condition: 'bare',
        reader_a_decision: 'yes',
        reader_b_decision: 'yes',
        logged_observe_decision: true,
      },
      {
        sample_id: 'b',
        dialogue_id: 'd1',
        turn: 3,
        condition: 'bare',
        reader_a_decision: 'yes',
        reader_b_decision: 'no',
        logged_observe_decision: false,
      },
    ],
    decisionReaderRunFixture(t),
  );
  assert.equal(score.consensus_cases, 1);
  assert.equal(score.non_consensus_cases, 1);
  assert.equal(score.correctness_rate, 1);
  assert.equal(score.decision_reader_run_evidence.status, 'passed');
});

test('measure 1 hard-stops when the decision-reader run record is missing', () => {
  const evidence = verifyOutcomeDecisionReaderRunEvidence();
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.checks.run_record_present, false);
  assert.throws(() => scoreOutcomeDecisionCases([]), /decision-reader run evidence failed closed/u);
});

test('measure 1 hard-stops on partial decision-reader run evidence', (t) => {
  const runPath = decisionReaderRunFixture(t, { model_independently_attested: undefined });
  const evidence = verifyOutcomeDecisionReaderRunEvidence(runPath);
  assert.equal(evidence.status, 'failed');
  assert.equal(evidence.batches[0].checks.response_hash_match, true);
  assert.equal(evidence.batches[0].checks.model_attestation_accepted, false);
  assert.throws(() => scoreOutcomeDecisionCases([], runPath), /decision-reader run evidence failed closed/u);
});

test('measure 1 hard-stops when a decision-reader response is altered after its hash is recorded', (t) => {
  const runPath = decisionReaderRunFixture(t);
  const runRecord = JSON.parse(fs.readFileSync(runPath, 'utf8'));
  fs.writeFileSync(runRecord.batches[0].response_path, '{"fixture":"tampered-response"}\n');

  const evidence = verifyOutcomeDecisionReaderRunEvidence(runPath);
  const failedBatchChecks = Object.entries(evidence.batches[0].checks)
    .filter(([, passed]) => !passed)
    .map(([check]) => check);
  assert.equal(evidence.status, 'failed');
  assert.deepEqual(failedBatchChecks, ['response_hash_match']);
  assert.equal(evidence.batches[0].checks.model_attestation_accepted, true);
  assert.throws(() => scoreOutcomeDecisionCases([], runPath), /decision-reader run evidence failed closed/u);
});

test('measure 1 accepts only the exact registered CLI bridge-echo tuple when independent attestation is false', (t) => {
  const passedPath = decisionReaderRunFixture(t, {
    model_independently_attested: false,
    model_attestation_basis: 'explicit_cli_model_argument_accepted_bridge_echo',
    returned_provider: 'codex',
    returned_model: 'gpt-5.6-luna',
  });
  assert.equal(verifyOutcomeDecisionReaderRunEvidence(passedPath).status, 'passed');

  const failedPath = decisionReaderRunFixture(t, {
    model_independently_attested: false,
    model_attestation_basis: 'explicit_cli_model_argument_accepted_bridge_echo',
    returned_provider: 'codex',
    returned_model: 'gpt-5.6-terra',
  });
  const failed = verifyOutcomeDecisionReaderRunEvidence(failedPath);
  assert.equal(failed.status, 'failed');
  assert.equal(failed.batches[0].checks.model_attestation_accepted, false);
});

test('measure 1 decision-reader instrument is digest pinned and fails on drift', () => {
  assert.equal(preflightOutcomeDecisionReader(DECISION_READER_INSTRUMENT_BINDINGS).status, 'passed');
  assert.equal(
    preflightOutcomeDecisionReader({ ...DECISION_READER_INSTRUMENT_BINDINGS, handbook_sha256: digest('f') }).status,
    'failed',
  );
});

test('presence preflight requires all seven digests and both registered caps', () => {
  const expected = presenceBindings();
  const passed = preflightOutcomePresenceChannel({ expected, observed: { ...expected } });
  assert.equal(passed.required_digest_count, 7);
  assert.equal(passed.required_cap_count, 2);
  assert.equal(passed.status, 'passed');
  const drifted = preflightOutcomePresenceChannel({
    expected,
    observed: { ...expected, reader_digest: digest('f') },
  });
  assert.equal(drifted.status, 'failed');
  assert.equal(drifted.checks.reader_digest.pass, false);
});

test('dialogue scorer extracts break, persistence, streak, growth, challenge, and closure measures', () => {
  const score = scoreOutcomeDialogue({
    dialogue_id: 'gated-1',
    condition: 'gated',
    turns: [
      turn(1),
      turn(2),
      turn(3, {
        learner_text: 'The assay rules out clipping.',
        deference: false,
        actual_action_family: 'challenge_resistance',
        typed_warrant_supported: true,
      }),
      turn(4, { learner_text: 'The coins were newly struck.', deference: false, dag_total: 5 }),
    ],
  });
  assert.deepEqual(score.measure_3_sustained_deference, { streak_lengths: [2], maximum_streak: 2 });
  assert.deepEqual(score.measure_4_deference_break, { first_turn: 3, persists_to_end: true });
  assert.equal(score.measure_5_record_growth_after_break.observed, true);
  assert.equal(score.measure_2_warranted_challenge_rate.rate, 0.25);
  assert.equal(score.measure_6_closure_legitimacy.legitimate, true);
});

test('break-turn fixture without a break stays null and false', () => {
  const score = scoreOutcomeDialogue({ dialogue_id: 'bare-1', condition: 'bare', turns: [turn(1), turn(2)] });
  assert.deepEqual(score.measure_4_deference_break, { first_turn: null, persists_to_end: false });
  assert.equal(score.measure_5_record_growth_after_break.observed, null);
});

test('trace extraction uses compiler deference and closure audit fields', () => {
  const dialogue = extractOutcomeDialogueFromTraceRows({
    dialogue_id: 'trace-1',
    condition: 'gated',
    rows: [
      {
        type: 'turn_complete',
        turnRecord: {
          turn: 1,
          learner: 'May I enter it?',
          stateObservation: { dag: { grounded_count: 1 } },
          warrantGateDecision: {
            learner_signal: { deference_present: true },
            revision_warranted: false,
            policy: null,
          },
          deliveredResponseConfiguration: { action_family: 'stage_next_step' },
          dialogueClosure: { frame: { available: false }, audit: { ok: true, closesDialogue: false } },
        },
      },
    ],
  });
  assert.equal(dialogue.turns[0].deference, true);
  assert.equal(dialogue.turns[0].dag_total, 1);
});

test('ruling 002: a ruled-dropped turn leaves every per-turn measure series', () => {
  const turns = [
    turn(1),
    turn(2),
    turn(3, { deference: undefined }),
    turn(4, { learner_text: 'The coins were newly struck.', deference: false }),
  ];
  assert.throws(
    () => scoreOutcomeDialogue({ dialogue_id: 'ruled-1', condition: 'standing_permission', turns }),
    /deference must be boolean/,
  );
  const score = scoreOutcomeDialogue({
    dialogue_id: 'ruled-1',
    condition: 'standing_permission',
    turns,
    dropped_turns: [3],
  });
  assert.equal(score.turn_count, 3);
  assert.deepEqual(score.ruled_dropped_turns, [3]);
  assert.deepEqual(score.measure_3_sustained_deference, { streak_lengths: [2], maximum_streak: 2 });
  assert.deepEqual(score.measure_4_deference_break, { first_turn: 4, persists_to_end: true });
});

test('ruling 002: trace extraction skips a ruled-dropped turn before normalization', () => {
  const rows = [
    {
      type: 'turn_complete',
      turnRecord: {
        turn: 1,
        learner: 'May I enter it?',
        warrantGateDecision: { learner_signal: { deference_present: true } },
      },
    },
    {
      type: 'turn_complete',
      turnRecord: {
        turn: 2,
        learner: 'Yes—the job number ties them to the box.',
        learner_signal: {
          primary: 'engaged_analytic',
          labels: ['engaged_analytic'],
          surface: 'raw fallback, never read',
        },
      },
    },
  ];
  assert.throws(
    () => extractOutcomeDialogueFromTraceRows({ dialogue_id: 'ruled-2', condition: 'gated', rows }),
    /turn 2: deterministic compiler deference must be boolean/,
  );
  const dialogue = extractOutcomeDialogueFromTraceRows({
    dialogue_id: 'ruled-2',
    condition: 'gated',
    rows,
    dropped_turns: [2],
  });
  assert.deepEqual(dialogue.dropped_turns, [2]);
  assert.deepEqual(
    dialogue.turns.map((row) => row.turn),
    [1],
  );
});

test('presence scoring fails closed and saturation uses consensus-case denominator', () => {
  const cases = [
    ...Array.from({ length: 9 }, (_, index) => ({
      sample_id: `c${index}`,
      dialogue_id: `d${index}`,
      condition: index % 2 ? 'bare' : 'gated',
      admissible_pair: true,
      presence_grain_consensus: true,
      reader_a_presence: { result_request: true, proposed_test: false },
    })),
    {
      sample_id: 'non-consensus',
      admissible_pair: true,
      presence_grain_consensus: false,
    },
    {
      sample_id: 'missing',
      admissible_pair: false,
      presence_grain_consensus: false,
    },
  ];
  const presence = scoreOutcomePresenceCases(cases);
  assert.equal(presence.consensus_cases, 9);
  assert.equal(presence.non_consensus_cases, 1);
  assert.equal(presence.inadmissible_cases, 1);
  const saturation = assessOutcomePilotSaturation({ dialogueScores: [], presenceScore: presence });
  assert.equal(saturation.measure_7.denominator, 9);
  assert.equal(saturation.measure_7.maximum_share, 1);
  assert.equal(saturation.measure_7.saturated, true);
});

test('the 90 percent saturation rule is strict and uses dialogue denominator for measures 2-4', () => {
  const dialogueScores = Array.from({ length: 10 }, (_, index) => ({
    measure_2_warranted_challenge_rate: { rate: index < 9 ? 0 : 0.25 },
    measure_3_sustained_deference: { maximum_streak: index < 9 ? 8 : 2 },
    measure_4_deference_break: { first_turn: index < 9 ? null : 4, persists_to_end: index >= 9 },
  }));
  const saturation = assessOutcomePilotSaturation({
    dialogueScores,
    presenceScore: { cases: [] },
  });
  assert.equal(saturation.measure_2.denominator, 10);
  assert.equal(saturation.measure_2.maximum_share, 0.9);
  assert.equal(saturation.measure_2.saturated, false);
});

test('verbatim drift and no-pooling guards are fail closed without preparing blocked materials', () => {
  assert.equal(
    guardVerbatimPromptBindings([{ source: 'fixture', expected: 'byte exact', observed: 'byte exact' }]).status,
    'passed',
  );
  assert.equal(guardVerbatimPromptBindings([]).status, 'failed');
  assert.equal(
    guardVerbatimPromptBindings([{ source: 'fixture', expected: 'byte exact', observed: 'byte drift' }]).status,
    'failed',
  );
  assert.equal(
    guardNoPoolingFingerprints({ candidates: ['fresh-a', 'fresh-b'], excluded: ['burned'] }).status,
    'passed',
  );
  assert.equal(
    guardNoPoolingFingerprints({ candidates: ['fresh-a', 'burned', 'fresh-a'], excluded: ['burned'] }).status,
    'failed',
  );
});

// The guarded extension runs the opposite learner pole through these same
// runners. The A1 study must be unreachable from that seam.

test('asking for the default learner profile returns the frozen A1 table itself', () => {
  assert.equal(OUTCOME_STUDY_DEFAULT_LEARNER_PROFILE, 'low_agency');
  assert.equal(resolveOutcomeStudyRunConfigurations(), OUTCOME_STUDY_RUN_CONFIGURATIONS);
  assert.equal(resolveOutcomeStudyRunConfigurations('low_agency'), OUTCOME_STUDY_RUN_CONFIGURATIONS);
  assert.equal(resolveOutcomeStudyRunConfigurations(null), OUTCOME_STUDY_RUN_CONFIGURATIONS);
});

test('a second learner profile substitutes only the profile and leaves the arms alone', () => {
  const guarded = resolveOutcomeStudyRunConfigurations('overconfident');
  assert.notEqual(guarded, OUTCOME_STUDY_RUN_CONFIGURATIONS);
  assert.deepEqual(
    guarded.map((row) => row.learner_profile),
    ['overconfident', 'overconfident', 'overconfident', 'overconfident'],
  );
  assert.deepEqual(
    guarded.map((row) => row.id),
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.id),
  );
  assert.deepEqual(
    guarded.map((row) => row.cli_args.join(' ')),
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.cli_args.join(' ')),
  );
  assert.deepEqual(
    guarded.map((row) => row.warrant_gate_mode),
    OUTCOME_STUDY_RUN_CONFIGURATIONS.map((row) => row.warrant_gate_mode),
  );
  // the frozen table is untouched by the derivation
  assert.ok(OUTCOME_STUDY_RUN_CONFIGURATIONS.every((row) => row.learner_profile === 'low_agency'));
});

test('an unsupported learner profile is refused rather than silently defaulted', () => {
  assert.deepEqual(OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES, ['low_agency', 'overconfident']);
  assert.throws(() => resolveOutcomeStudyRunConfigurations('diligent'), /unsupported outcome-study learner profile/u);
  assert.throws(() => resolveOutcomeStudyRunConfigurations('guarded'), /unsupported outcome-study learner profile/u);
});
