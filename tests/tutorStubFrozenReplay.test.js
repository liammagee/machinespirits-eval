import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';
import {
  auditTutorStubFrozenLeak,
  auditTutorStubFrozenCandidate,
  refreshTutorStubFrozenFirstDraftRequest,
  summarizeTutorStubFrozenReplay,
  TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
  TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA,
} from '../services/tutorStubFrozenReplay.js';
import {
  tutorStubPerformanceAdjudicationSystemPrompt,
  tutorStubPerformanceAdjudicationUserPrompt,
} from '../services/tutorStubPerformanceAdjudication.js';
import { auditTutorStubPrompt } from '../services/tutorStubPromptAudit.js';
import { renderTutorStubDueSource } from '../services/tutorStubDueSourceRenderer.js';
import { TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA } from '../services/tutorStubFirstDraftContract.js';
import { buildTutorStubResponseCompositionFrame } from '../services/tutorStubResponseComposition.js';
import { TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA } from '../services/tutorStubTurnProgressionContract.js';
import { replaceTutorStubFrozenRequestWithJointPerformancePrompt } from '../services/tutorStubJointPerformanceFirstDraft.js';
import { replaceTutorStubFrozenRequestWithCompactNoSourcePrompt } from '../services/tutorStubCompactSpeakingPrompt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-first-draft');
const FIXTURE_PATHS = [
  path.join(FIXTURE_DIR, 'greyfen-answer-seeking-v19.json'),
  path.join(FIXTURE_DIR, 'skyway-answer-seeking-v18.json'),
  path.join(FIXTURE_DIR, 'tallow-answer-seeking-v20.json'),
  path.join(FIXTURE_DIR, 'nocturne-answer-seeking-v22.json'),
];

test('frozen replay summary totals complete token usage and preserves missing fields as null', () => {
  const summary = summarizeTutorStubFrozenReplay([
    {
      latencyMs: 10,
      usage: {
        inputTokens: 100,
        cachedInputTokens: 40,
        uncachedInputTokens: 60,
        outputTokens: 10,
        reasoningOutputTokens: 3,
        totalTokens: 110,
      },
      tokenUsageAvailable: true,
      promptSizeReport: {
        schema: 'machinespirits.tutor-stub.prompt-size-report.v1',
        tokenizer: { id: 'fixture' },
        authoredTotal: { estimatedTokens: 10 },
        observedProviderInput: { tokens: 100 },
        inferredResidual: { tokens: 90 },
      },
    },
    {
      latencyMs: 20,
      usage: {
        inputTokens: 120,
        cachedInputTokens: null,
        uncachedInputTokens: null,
        outputTokens: 12,
        reasoningOutputTokens: null,
        totalTokens: 132,
      },
      tokenUsageAvailable: true,
      promptSizeReport: {
        schema: 'machinespirits.tutor-stub.prompt-size-report.v1',
        tokenizer: { id: 'fixture' },
        authoredTotal: { estimatedTokens: 12 },
        observedProviderInput: { tokens: 120 },
        inferredResidual: { tokens: 108 },
      },
    },
  ]);

  assert.equal(summary.tokenUsageAvailable, true);
  assert.deepEqual(summary.tokenUsage, {
    inputTokens: 220,
    cachedInputTokens: null,
    uncachedInputTokens: null,
    outputTokens: 22,
    reasoningOutputTokens: null,
    totalTokens: 242,
  });
  assert.equal(summary.promptSize.calls, 2);
  assert.equal(summary.promptSize.totalAuthoredEstimatedTokens, 22);
  assert.equal(summary.promptSize.totalObservedProviderInputTokens, 220);
  assert.equal(summary.promptSize.totalInferredResidualTokens, 198);

  const unavailable = summarizeTutorStubFrozenReplay([{ latencyMs: 10, usage: null, tokenUsageAvailable: false }]);
  assert.equal(unavailable.tokenUsageAvailable, false);
  assert.deepEqual(unavailable.tokenUsage, {
    inputTokens: null,
    cachedInputTokens: null,
    uncachedInputTokens: null,
    outputTokens: null,
    reasoningOutputTokens: null,
    totalTokens: null,
  });
  assert.equal(unavailable.promptSize.calls, 0);
  assert.equal(unavailable.promptSize.totalObservedProviderInputTokens, null);
});

function readFixture(fixturePath) {
  return JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
}

function worldForId(worldId) {
  const worldDir = path.join(ROOT, 'config', 'drama-derivation');
  const matches = fs
    .readdirSync(worldDir)
    .filter((name) => /^world-.*\.yaml$/u.test(name))
    .map((name) => loadWorld(path.join(worldDir, name)))
    .filter((world) => world.id === worldId);
  assert.equal(matches.length, 1, `expected one world for ${worldId}`);
  return matches[0];
}

function frozenParityBundle({ learnerText, progression, sources = [] }) {
  return {
    guards: { responseComposition: true },
    learnerText,
    firstDraftContract: {
      schema: TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
      opening: { writable_entry_requested: false },
      evidence: { sources },
      progression,
    },
    frames: {
      responseComposition: buildTutorStubResponseCompositionFrame({
        learnerText,
        classification: { turn: { summary: learnerText } },
        registerSelection: { response_configuration: { action_family: 'stage_next_step' } },
      }),
    },
    duePremiseIds: [],
    publicPremiseIds: [],
    priorTurns: [],
    priorTutorTexts: [],
    turn: 2,
  };
}

function frozenProgressionContract({ questionAllowed, questionRequired = questionAllowed } = {}) {
  return {
    schema: TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
    complete: true,
    learner_uptake: {
      required: true,
      mode: 'direct_response',
      learner_surface: 'The badge log leaves Dario possible but unproved.',
      accepted_meaning: null,
      focus_terms: ['badge', 'log', 'dario', 'unprove'],
    },
    turn_focus_contract: {
      primary_surface: 'the visitor badge log',
      primary_terms: ['visitor', 'badge', 'log'],
      due_terms: [],
      sibling_relation_requires_explicit_bridge: false,
    },
    handoff_contract: {
      mode: questionAllowed ? 'new_unresolved_check' : 'declarative_current_limit',
      question_allowed: questionAllowed,
      question_required: questionRequired,
      question_owner: questionAllowed ? 'handoff' : null,
      terminal_if_question: questionAllowed,
      required_target_surfaces: ['the visitor badge log'],
      required_target_terms: ['visitor', 'badge', 'log'],
      prohibited_settled_surfaces: [],
    },
  };
}

test('frozen replay fixtures retain the exact public prefix and original speaker configuration', () => {
  for (const fixturePath of FIXTURE_PATHS) {
    const fixture = readFixture(fixturePath);
    assert.equal(fixture.schema, TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA);
    assert.ok(fixture.cases.length >= 3);
    for (const testCase of fixture.cases) {
      const bundle = testCase.bundle;
      assert.equal(bundle.schema, TUTOR_STUB_FROZEN_REPLAY_SCHEMA);
      assert.equal(bundle.request.provider, 'codex');
      assert.equal(bundle.request.model, 'gpt-5.6-terra');
      assert.equal(bundle.request.effort, 'low');
      assert.ok(bundle.request.messages.length >= 2);
      assert.equal(bundle.request.messages.at(-1).role, 'user');
      assert.match(bundle.request.messages.at(-1).content, /Tutor-only first-draft performance contract/u);
      assert.match(bundle.request.messages.at(-1).content, /ACT \+ ENACT/u);
      assert.ok(bundle.selectedResponseConfiguration?.actorial_part);
      assert.ok(Array.isArray(bundle.publicPremiseIds));
      assert.ok(Array.isArray(bundle.duePremiseIds));
      assert.ok(
        bundle.priorTurns.every((turn) =>
          Object.keys(turn).every((key) => ['turn', 'turnId', 'learner', 'tutor'].includes(key)),
        ),
      );
    }
  }
});

test('frozen screens recompile the current single-development contract without changing the public prefix', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const original = fixture.cases[0].bundle;
  const refreshed = refreshTutorStubFrozenFirstDraftRequest({
    bundle: original,
    world: worldForId(original.worldId),
  });

  assert.deepEqual(refreshed.priorTurns, original.priorTurns);
  assert.deepEqual(refreshed.publicPremiseIds, original.publicPremiseIds);
  assert.equal(refreshed.performanceObligationContract.complete, true);
  assert.match(refreshed.request.messages.at(-1).content, /\[Tutor-only host plan\]/u);
  assert.match(refreshed.request.messages.at(-1).content, /UPTAKE —[\s\S]*PART —[\s\S]*TACTIC —[\s\S]*HANDOFF —/u);
  assert.doesNotMatch(refreshed.request.messages.at(-1).content, /FORM —|OPEN —|DEVELOP —|END —|VOICE —/u);
  assert.deepEqual(refreshed.speakingResponseConfiguration, original.selectedResponseConfiguration);
  assert.doesNotMatch(refreshed.request.messages.at(-1).content, /use the verb “breaks”/u);
  const semanticPromptAudit = auditTutorStubPrompt({
    surface: 'performance_adjudication',
    systemPrompt: tutorStubPerformanceAdjudicationSystemPrompt(),
    userPrompt: tutorStubPerformanceAdjudicationUserPrompt({
      candidate: 'I hold the public claim against the public record.',
      contract: refreshed.performanceObligationContract,
    }),
    instructionTexts: [tutorStubPerformanceAdjudicationSystemPrompt()],
  });
  assert.equal(semanticPromptAudit.ok, true);
});

test('frozen screens can refresh an already-current typed host plan', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const original = fixture.cases[0].bundle;
  const world = worldForId(original.worldId);
  const firstRefresh = refreshTutorStubFrozenFirstDraftRequest({ bundle: original, world });
  const secondRefresh = refreshTutorStubFrozenFirstDraftRequest({ bundle: firstRefresh, world });
  const prompt = secondRefresh.request.messages.at(-1).content;

  assert.deepEqual(secondRefresh.priorTurns, original.priorTurns);
  assert.deepEqual(secondRefresh.publicPremiseIds, original.publicPremiseIds);
  assert.equal(prompt.split('[Tutor-only host plan]').length - 1, 1);
  assert.equal(prompt.split('[End tutor-only host plan]').length - 1, 1);
  assert.doesNotMatch(prompt, /Tutor-only first-draft performance contract/u);
});

test('typed causal PERFORMANCE keeps the exact public tuple inside the compact prompt budget', () => {
  const fixture = readFixture(FIXTURE_PATHS[2]);
  const source = fixture.cases.find((entry) => entry.bundle.turn === 5);
  assert.ok(source, 'Tallow fixture must preserve the hard turn-5 prefix');
  const world = worldForId(source.bundle.worldId);
  let refreshed = refreshTutorStubFrozenFirstDraftRequest({
    bundle: source.bundle,
    world,
    sourceAccessibilityPolicy: 'direct_or_compensated_v1',
  });
  refreshed = replaceTutorStubFrozenRequestWithJointPerformancePrompt(refreshed);
  refreshed = replaceTutorStubFrozenRequestWithCompactNoSourcePrompt(refreshed);

  const responseInstruction = refreshed.jointPerformanceFirstDraft.host_plan.slots.performance.response_instruction;
  assert.match(
    responseInstruction,
    /Say “The depot chargers did not cause the Tallow Street brownout; actual cause remains open/iu,
  );
  assert.match(responseInstruction, /Add no third clause or role change/iu);
  assert.match(
    refreshed.jointPerformanceFirstDraft.host_plan.slots.performance.entry_instruction,
    /public inactivity clue against the claim/iu,
  );
  assert.match(
    refreshed.jointPerformanceFirstDraft.host_plan.slots.performance.entry_instruction,
    /Say exactly “I set this against the claim:/iu,
  );
  assert.doesNotMatch(responseInstruction, /Stance operation/iu);
  assert.match(
    refreshed.jointPerformanceFirstDraft.host_plan.slots.performance.joint_instruction,
    /ENTRY owns part and stance; RESPONSE owns the typed causal-boundary tactic/iu,
  );
  assert.ok(refreshed.compactSpeakingPrompt.promptSize.authoredTotal.estimatedTokens <= 2500);
});

test('model-free frozen replay enforces live V1 question ownership and terminal placement', () => {
  const learnerText = 'The badge log leaves Dario possible but unproved.';
  const world = { premiseById: new Map(), premises: [], releaseSchedule: [], rules: [], background: [] };
  const cases = [
    {
      name: 'forbidden question',
      progression: frozenProgressionContract({ questionAllowed: false }),
      text: 'Right—the badge log leaves Dario possible but unproved. What does the visitor badge log change?',
      cluster: 'live_turn_progression_v1:question_forbidden_by_handoff_contract',
    },
    {
      name: 'nonterminal question',
      progression: frozenProgressionContract({ questionAllowed: true }),
      text: 'Right—the badge log leaves Dario possible but unproved. What does the visitor badge log change? We can wait.',
      cluster: 'live_turn_progression_v1:handoff_question_not_terminal',
    },
  ];

  for (const fixture of cases) {
    const audit = auditTutorStubFrozenCandidate({
      bundle: frozenParityBundle({ learnerText, progression: fixture.progression }),
      world,
      text: fixture.text,
      candidateKind: 'original_candidate',
    });
    assert.equal(audit.ok, false, fixture.name);
    assert.equal(audit.audits.liveTurnProgressionAudit.ok, false, fixture.name);
    assert.ok(audit.hardFailureClusters.includes(fixture.cluster), fixture.name);
    assert.ok(
      audit.deliveryDecision.hardIssues.some((issue) => issue.guard === 'live_turn_progression_v1'),
      fixture.name,
    );
  }
});

test('model-free frozen replay enforces exact due SOURCE and its nearest host carrier', () => {
  const learnerText = 'The badge log leaves Dario possible but unproved.';
  const progression = frozenProgressionContract({ questionAllowed: true });
  const source = renderTutorStubDueSource({
    premise: 'p_crew',
    mode: 'enacted_role',
    role: 'front-desk clerk reading the visitor badge log',
    surface: 'WF-11 was issued to the outside crew.',
  });
  const bundle = frozenParityBundle({ learnerText, progression, sources: [source] });
  const world = { premiseById: new Map(), premises: [], releaseSchedule: [], rules: [], background: [] };
  const cases = [
    {
      name: 'misaligned source carrier',
      text: `Right—the badge log leaves Dario possible but unproved. I set the kettle beside us. ${source.text} What does the visitor badge log change?`,
      cluster: 'live_source_action_alignment_v1:due_source_action_referent_missing',
    },
    {
      name: 'paraphrased source',
      text: 'Right—the badge log leaves Dario possible but unproved. I open the visitor badge log. “I report this: WF-11 was issued to the outside crew.” What does the visitor badge log change?',
      cluster: 'live_source_action_alignment_v1:due_source_exact_occurrence_count',
    },
  ];

  for (const fixture of cases) {
    const audit = auditTutorStubFrozenCandidate({
      bundle,
      world,
      text: fixture.text,
      candidateKind: 'original_candidate',
    });
    assert.equal(audit.ok, false, fixture.name);
    assert.equal(audit.audits.liveSourceActionAlignmentAudit.ok, false, fixture.name);
    assert.ok(audit.hardFailureClusters.includes(fixture.cluster), fixture.name);
    assert.ok(
      audit.deliveryDecision.hardIssues.some((issue) => issue.guard === 'live_source_action_alignment_v1'),
      fixture.name,
    );
  }
});

test('frozen counterpressure never binds the learner Write question as its public target', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const source = fixture.cases.find(
    (entry) => entry.bundle.selectedResponseConfiguration?.actorial_performance?.id === 'dramatic_counterpressure',
  );
  assert.ok(source);
  const refreshed = refreshTutorStubFrozenFirstDraftRequest({
    bundle: source.bundle,
    world: worldForId(source.bundle.worldId),
  });
  const pair = refreshed.performanceObligationContract.pressure_pair;

  assert.notEqual(pair?.target_span, source.bundle.learnerText);
  assert.doesNotMatch(pair?.target_span || '', /\?/u);
  if (pair) {
    assert.match(refreshed.request.messages.at(-1).content, /COUNTERPRESSURE PAIR/u);
    assert.equal(refreshed.request.messages.at(-1).content.split(pair.target_span).length - 1, 1);
  } else {
    assert.equal(refreshed.performanceObligationContract.tactic_applicability.applicable, false);
    assert.equal(refreshed.speakingResponseConfiguration.actorial_performance.id, 'evidentiary_boundary');
    assert.equal(
      refreshed.speakingResponseConfiguration.actorial_part,
      source.bundle.selectedResponseConfiguration.actorial_part,
    );
  }
});

test('frozen refresh never promotes prior tutor prose or a due clue into counterpressure', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const source = fixture.cases.find(
    (entry) => entry.bundle.selectedResponseConfiguration?.actorial_performance?.id === 'dramatic_counterpressure',
  );
  assert.ok(source, 'fixture must contain a selected counterpressure turn');

  const bundle = structuredClone(source.bundle);
  bundle.learnerText = 'What should I write next?';
  bundle.priorTurns = [
    {
      learner: 'What should I write?',
      tutor: 'My case remains open. The last clue points one way, but another record is still due.',
    },
  ];
  const refreshed = refreshTutorStubFrozenFirstDraftRequest({
    bundle,
    world: worldForId(bundle.worldId),
  });

  assert.equal(refreshed.performanceObligationContract.pressure_pair, null);
  assert.equal(refreshed.performanceObligationContract.tactic_applicability.applicable, false);
  assert.equal(refreshed.speakingResponseConfiguration.actorial_performance.id, 'evidentiary_boundary');
});

test('frozen refresh preserves an authored public counterpressure pair without exposing premise ids', () => {
  const world = worldForId('world_005_marrick');
  const bundle = {
    turn: 9,
    learnerText: 'What should I write next about whose hand cast the blanks?',
    publicPremiseIds: ['m_caster', 'p_alloy', 'p_crucible', 'p_caster'],
    duePremiseIds: ['p_caster'],
    selectedResponseConfiguration: {
      engagement_stance: 'charismatic',
      action_family: 'stage_next_step',
      audience_register: 'adult_novice',
      lexical_accessibility: 'plain',
      scene_immersion: 'immersive',
      actorial_part: 'record_keeper',
      actorial_part_label: 'keeper of the trial-book',
      actorial_performance: {
        id: 'dramatic_counterpressure',
        label: 'dramatic counterpressure',
        contract: 'Challenge the ready public verdict with contrary public evidence.',
      },
      surface_budgets: { max_average_sentence_words: 17 },
    },
    frames: {
      responseComposition: null,
      dramaticRelease: {
        active: true,
        requiresEnactment: true,
        entries: [
          {
            premise: 'p_caster',
            mode: 'enacted_role',
            role: 'leat-keeper reading the charcoal book',
            surface: world.premiseById.get('p_caster').surface,
          },
        ],
      },
      questionSupport: null,
      dialogueClosure: null,
    },
    request: {
      messages: [
        {
          role: 'user',
          content:
            '[Tutor-only first-draft performance contract]\nold contract\n[End tutor-only first-draft performance contract]',
        },
      ],
    },
  };
  const refreshed = refreshTutorStubFrozenFirstDraftRequest({ bundle, world });
  const content = refreshed.request.messages.at(-1).content;

  assert.equal(refreshed.performanceObligationContract.tactic_applicability.applicable, true);
  assert.equal(refreshed.speakingResponseConfiguration.actorial_performance.id, 'dramatic_counterpressure');
  assert.deepEqual(refreshed.firstDraftContract.evidence.committed_public_surfaces, [
    world.premiseById.get('m_caster').surface,
    world.premiseById.get('p_alloy').surface,
    world.premiseById.get('p_crucible').surface,
  ]);
  assert.equal(
    refreshed.firstDraftContract.evidence.committed_public_surfaces.includes(world.premiseById.get('p_caster').surface),
    false,
  );
  assert.equal(
    refreshed.performanceObligationContract.pressure_pair.target_span,
    world.premiseById.get('m_caster').surface,
  );
  assert.match(content, /COUNTERPRESSURE PAIR/u);
  assert.doesNotMatch(content, /\bm_caster\b|\bp_caster\b/u);
});

test('model-free corpus applies current deterministic audits and makes live-parity reclassifications explicit', () => {
  const improvements = [];
  const corrections = [];
  const contractMigrations = [];
  const liveParityReclassifications = [];
  const recognitionImprovementsMaskedByLiveParity = [];
  const recordLiveParityReclassification = ({ testCase, candidate, audit }) => {
    const unexpectedClusters = audit.hardFailureClusters.filter(
      (cluster) =>
        !cluster.startsWith('live_turn_progression_v1:') &&
        !cluster.startsWith('live_source_action_alignment_v1:') &&
        cluster !== 'response_composition:unlicensed_requested_entry',
    );
    assert.deepEqual(
      unexpectedClusters,
      [],
      `${testCase.id} ${candidate.kind} changed outside the newly enforced live-parity audits`,
    );
    liveParityReclassifications.push({
      id: testCase.id,
      kind: candidate.kind,
      clusters: audit.hardFailureClusters,
    });
  };
  for (const fixturePath of FIXTURE_PATHS) {
    const fixture = readFixture(fixturePath);
    for (const testCase of fixture.cases) {
      const world = worldForId(testCase.worldId);
      const refreshedBundle = refreshTutorStubFrozenFirstDraftRequest({ bundle: testCase.bundle, world });
      assert.deepEqual(refreshedBundle.priorTurns, testCase.bundle.priorTurns);
      assert.deepEqual(refreshedBundle.publicPremiseIds, testCase.bundle.publicPremiseIds);
      if (
        testCase.bundle.firstDraftContract?.opening?.writable_entry_requested !== true &&
        refreshedBundle.firstDraftContract.opening.writable_entry_requested === true
      ) {
        contractMigrations.push(testCase.id);
      }
      for (const candidate of testCase.candidates) {
        const audit = auditTutorStubFrozenCandidate({
          bundle: refreshedBundle,
          world,
          text: candidate.text,
          deliveryConfiguration: candidate.deliveryConfiguration,
          candidateKind: candidate.kind,
        });
        if (typeof candidate.expectedCurrentAuditOk === 'boolean') {
          const expectationAudit =
            candidate.expectationAuditScope === 'recorded_bundle'
              ? auditTutorStubFrozenCandidate({
                  bundle: testCase.bundle,
                  world,
                  text: candidate.text,
                  deliveryConfiguration: candidate.deliveryConfiguration,
                  candidateKind: candidate.kind,
                })
              : audit;
          if (candidate.expectedCurrentAuditOk === true && !expectationAudit.ok) {
            recordLiveParityReclassification({ testCase, candidate, audit });
            recognitionImprovementsMaskedByLiveParity.push(`${testCase.id}:${candidate.kind}`);
          } else {
            assert.equal(
              expectationAudit.ok,
              candidate.expectedCurrentAuditOk,
              `${testCase.id} expected correction did not hold`,
            );
          }
          for (const cluster of candidate.expectedFailureClusters || []) {
            assert.ok(
              expectationAudit.hardFailureClusters.includes(cluster),
              `${testCase.id} expected correction missing ${cluster}`,
            );
          }
          corrections.push(`${testCase.id}:${candidate.expectationReason || candidate.kind}`);
          if (
            candidate.expectationAuditScope === 'recorded_bundle' &&
            !audit.ok &&
            audit.hardFailureClusters.every(
              (cluster) =>
                cluster.startsWith('live_turn_progression_v1:') ||
                cluster.startsWith('live_source_action_alignment_v1:'),
            )
          ) {
            recordLiveParityReclassification({ testCase, candidate, audit });
          }
        } else if (candidate.recordedAuditOk && !audit.ok) {
          recordLiveParityReclassification({ testCase, candidate, audit });
        } else if (
          !candidate.recordedAuditOk &&
          !audit.ok &&
          audit.hardFailureClusters.length > 0 &&
          audit.hardFailureClusters.every(
            (cluster) =>
              cluster.startsWith('live_turn_progression_v1:') || cluster.startsWith('live_source_action_alignment_v1:'),
          )
        ) {
          recordLiveParityReclassification({ testCase, candidate, audit });
          recognitionImprovementsMaskedByLiveParity.push(`${testCase.id}:${candidate.kind}`);
        } else if (audit.ok) {
          improvements.push(`${testCase.id}:${candidate.kind}`);
        }
      }
    }
  }
  assert.ok(
    improvements.length + recognitionImprovementsMaskedByLiveParity.length > 0,
    'the corpus should identify audit-recognition improvements separately from stricter live-parity failures',
  );
  assert.ok(
    [...improvements, ...recognitionImprovementsMaskedByLiveParity].some((row) =>
      row.startsWith('2026-07-16T05-50-54-528Z:'),
    ),
    'at least one recognition improvement should come from the Greyfen corpus',
  );
  assert.ok(
    contractMigrations.includes('2026-07-16T04-44-58-444Z:t003'),
    'Skyway t003 must migrate its legacy saved contract to current writable-entry recognition',
  );
  assert.ok(
    contractMigrations.includes('2026-07-16T07-03-36-147Z:t005'),
    'Tallow t005 must migrate the exact put-in-the-minutes request without changing its public prefix',
  );
  assert.ok(
    liveParityReclassifications.some((row) =>
      row.clusters.some((cluster) => cluster.startsWith('live_turn_progression_v1:')),
    ),
    'the historical corpus must retain at least one explicit live turn-progression reclassification',
  );
  assert.ok(
    liveParityReclassifications.some((row) =>
      row.clusters.some((cluster) => cluster.startsWith('live_source_action_alignment_v1:')),
    ),
    'the historical corpus must retain at least one explicit live source-alignment reclassification',
  );
  assert.deepEqual(corrections, [
    '2026-07-16T04-44-58-444Z:t003:current_audit_correctly_rejects_verbatim_learner_echo_in_saved_fallback',
    '2026-07-16T07-03-36-147Z:t001:known_v20_false_acceptance_duplicate_due_clue',
    '2026-07-16T09-34-06-063Z:t004:full_public_prefix_proves_beside_and_corrections_are_already_public',
    '2026-07-16T09-34-06-063Z:t004:full_public_prefix_proves_beside_and_corrections_are_already_public',
  ]);
});

test('V22 public-prefix provenance clears the false handwriting leak but still catches the unreleased attribution', () => {
  const fixture = readFixture(FIXTURE_PATHS[3]);
  const testCase = fixture.cases.find((row) => row.turn === 4);
  const world = worldForId(testCase.worldId);
  const original = testCase.candidates.find((candidate) => candidate.kind === 'original_candidate');
  const current = auditTutorStubFrozenCandidate({
    bundle: testCase.bundle,
    world,
    text: original.text,
    deliveryConfiguration: original.deliveryConfiguration,
    candidateKind: original.kind,
  });
  assert.equal(current.safetyFailure, false);
  assert.equal(current.audits.leakAudit.ok, true);

  const ordinarySceneAction = auditTutorStubFrozenLeak({
    text: 'I hold the damp leaf beside its untested ink strokes; these materials may date the work, but do not establish authorship.',
    world,
    tutorTurn: testCase.turn,
    learnerText: testCase.bundle.learnerText,
    priorTurns: testCase.bundle.priorTurns,
    publicPremiseIds: testCase.bundle.publicPremiseIds,
  });
  assert.equal(
    ordinarySceneAction.ok,
    true,
    'a grammatical preposition plus one generic material word cannot reveal a private attribution',
  );

  const unsafe = auditTutorStubFrozenLeak({
    text: 'Set beside her ledger entries, the draft strokes are Liane’s own hand.',
    world,
    tutorTurn: testCase.turn,
    learnerText: testCase.bundle.learnerText,
    priorTurns: testCase.bundle.priorTurns,
    publicPremiseIds: testCase.bundle.publicPremiseIds,
  });
  assert.equal(unsafe.ok, false);
  assert.ok(unsafe.leaks.some((leak) => leak.type === 'unreleased_premise_content'));
});

test('V19 provenance replay distinguishes a due strain match from the same match before release', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const testCase = fixture.cases.find((row) => row.turn === 7);
  const world = worldForId(testCase.worldId);
  const original = testCase.candidates.find((candidate) => candidate.kind === 'original_candidate');
  const current = auditTutorStubFrozenCandidate({
    bundle: testCase.bundle,
    world,
    text: original.text,
    deliveryConfiguration: original.deliveryConfiguration,
    candidateKind: original.kind,
  });
  assert.equal(current.safetyFailure, false);
  assert.equal(current.audits.leakAudit.ok, true);

  const beforeRelease = auditTutorStubFrozenLeak({
    text: 'The ruined Corvat flasks contained G17, exactly matching the strain found in Larkin.',
    world,
    tutorTurn: 6,
    learnerText: testCase.bundle.learnerText,
    priorTurns: testCase.bundle.priorTurns.filter((turn) => Number(turn.turn) < 6),
    publicPremiseIds: testCase.bundle.publicPremiseIds.filter((premise) => premise !== 'p_strain'),
  });
  assert.equal(beforeRelease.ok, false);
  assert.ok(
    beforeRelease.leaks.some(
      (leak) =>
        leak.type === 'unreleased_premise_content' ||
        leak.type === 'unsupported_correspondence' ||
        leak.type === 'private_final_conclusion',
    ),
  );
});

test('V22 configuration calibration recognizes the concrete next check without forgiving dense language', () => {
  const fixture = readFixture(FIXTURE_PATHS[3]);
  const expected = new Map([
    [7, { action: true, audience: false, lexical: false }],
    [9, { action: true, audience: false, lexical: false }],
    [10, { action: true, audience: false, lexical: false }],
  ]);
  for (const [turn, visibility] of expected) {
    const testCase = fixture.cases.find((row) => row.turn === turn);
    const candidate = testCase.candidates.find((row) => row.kind === 'original_candidate');
    const audit = auditTutorStubFrozenCandidate({
      bundle: testCase.bundle,
      world: worldForId(testCase.worldId),
      text: candidate.text,
      deliveryConfiguration: candidate.deliveryConfiguration,
      candidateKind: candidate.kind,
    });
    assert.equal(audit.audits.responseConfigurationAudit.axes.action_family.visible, visibility.action);
    assert.equal(audit.audits.responseConfigurationAudit.axes.audience_register.visible, visibility.audience);
    assert.equal(audit.audits.responseConfigurationAudit.axes.lexical_accessibility.visible, visibility.lexical);
  }
});

test('the V20 fixture preserves the uncontaminated duplicate and records no invented fallback', () => {
  const fixture = readFixture(FIXTURE_PATHS[2]);
  const first = fixture.cases.find((row) => row.turn === 1);
  const later = fixture.cases.filter((row) => row.turn > 1);

  assert.ok(first);
  assert.equal(first.candidates.length, 1);
  assert.equal(first.candidates[0].recordedAuditOk, true);
  assert.equal(first.candidates[0].expectedCurrentAuditOk, false);
  assert.ok(later.length > 0, 'later cases remain useful but follow the contaminated first turn');
  assert.equal(
    fixture.cases.flatMap((row) => row.candidates).filter((row) => row.kind === 'deterministic_fallback').length,
    0,
  );
});

test('original-only frozen audit still rejects concealed future evidence', () => {
  const fixture = readFixture(FIXTURE_PATHS[0]);
  const testCase = fixture.cases.find((row) => row.turn === 2);
  const world = worldForId(testCase.worldId);
  const audit = auditTutorStubFrozenCandidate({
    bundle: testCase.bundle,
    world,
    text: 'The Larkin unit ruined the Corvat line because its cracked seal exposed the flasks to G17.',
    candidateKind: 'original_candidate',
  });
  assert.equal(audit.ok, false);
  assert.equal(audit.safetyFailure, true);
  assert.ok(audit.hardFailureClusters.some((cluster) => cluster.startsWith('leak:')));
});

test('frozen replay carries the typed writable-entry contract into response-composition recognition', () => {
  const learnerText = 'What should I write next about whose hand cast the blanks at the weir-forge?';
  const responseComposition = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Asks for exact wording for the next supported entry.',
        discourse_move: 'answer_seeking',
      },
    },
    registerSelection: { response_configuration: { action_family: 'answer_accountably' } },
  });
  const audit = auditTutorStubFrozenCandidate({
    bundle: {
      guards: { responseComposition: true },
      learnerText,
      firstDraftContract: {
        schema: TUTOR_STUB_FIRST_DRAFT_CONTRACT_SCHEMA,
        opening: { writable_entry_requested: true },
      },
      frames: { responseComposition },
      duePremiseIds: [],
      publicPremiseIds: [],
      priorTurns: [],
      priorTutorTexts: [],
      turn: 9,
    },
    world: { premiseById: new Map(), premises: [] },
    text: 'Write: “We have not yet learned whose hand cast blanks at the weir-forge.” I leave the caster’s line open in the forge book.',
    candidateKind: 'original_candidate',
  });

  assert.equal(audit.audits.responseCompositionAudit.requestedEntryAnswerRecognition.recognized, true);
  assert.equal(
    audit.audits.responseCompositionAudit.issues.some((issue) => issue.type === 'verbatim_learner_echo'),
    false,
  );
  assert.equal(audit.ok, true);
});
