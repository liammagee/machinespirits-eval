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
  TUTOR_STUB_FROZEN_REPLAY_SCHEMA,
  TUTOR_STUB_REGRESSION_FIXTURE_SCHEMA,
} from '../services/tutorStubFrozenReplay.js';
import {
  tutorStubPerformanceAdjudicationSystemPrompt,
  tutorStubPerformanceAdjudicationUserPrompt,
} from '../services/tutorStubPerformanceAdjudication.js';
import { auditTutorStubPrompt } from '../services/tutorStubPromptAudit.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'fixtures', 'tutor-stub-first-draft');
const FIXTURE_PATHS = [
  path.join(FIXTURE_DIR, 'greyfen-answer-seeking-v19.json'),
  path.join(FIXTURE_DIR, 'skyway-answer-seeking-v18.json'),
  path.join(FIXTURE_DIR, 'tallow-answer-seeking-v20.json'),
  path.join(FIXTURE_DIR, 'nocturne-answer-seeking-v22.json'),
];

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
  assert.equal(
    refreshed.performanceObligationContract.pressure_pair.target_span,
    world.premiseById.get('m_caster').surface,
  );
  assert.match(content, /COUNTERPRESSURE PAIR/u);
  assert.doesNotMatch(content, /\bm_caster\b|\bp_caster\b/u);
});

test('model-free corpus re-audits every saved candidate without regressing accepted deliveries', () => {
  const improvements = [];
  const corrections = [];
  for (const fixturePath of FIXTURE_PATHS) {
    const fixture = readFixture(fixturePath);
    for (const testCase of fixture.cases) {
      const world = worldForId(testCase.worldId);
      for (const candidate of testCase.candidates) {
        const audit = auditTutorStubFrozenCandidate({
          bundle: testCase.bundle,
          world,
          text: candidate.text,
          deliveryConfiguration: candidate.deliveryConfiguration,
          candidateKind: candidate.kind,
        });
        if (typeof candidate.expectedCurrentAuditOk === 'boolean') {
          assert.equal(audit.ok, candidate.expectedCurrentAuditOk, `${testCase.id} expected correction did not hold`);
          for (const cluster of candidate.expectedFailureClusters || []) {
            assert.ok(
              audit.hardFailureClusters.includes(cluster),
              `${testCase.id} expected correction missing ${cluster}`,
            );
          }
          corrections.push(`${testCase.id}:${candidate.expectationReason || candidate.kind}`);
        } else if (candidate.recordedAuditOk) {
          assert.equal(
            audit.ok,
            true,
            `${testCase.id} ${candidate.kind} regressed: ${audit.hardFailureClusters.join(', ')}`,
          );
        } else if (audit.ok) {
          improvements.push(`${testCase.id}:${candidate.kind}`);
        }
      }
    }
  }
  assert.ok(
    improvements.length > 0,
    'the corpus should identify audit-recognition improvements without calling them generation',
  );
  assert.ok(
    improvements.some((row) => row.startsWith('2026-07-16T05-50-54-528Z:')),
    'at least one recognition improvement should come from the Greyfen corpus',
  );
  assert.deepEqual(corrections, [
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
