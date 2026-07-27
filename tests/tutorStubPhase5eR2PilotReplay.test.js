import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { loadWorld } from '../services/dramaticDerivation/world.js';

import {
  auditTutorStubDialogueClosureResponse,
  deterministicTutorStubClosureResponse,
} from '../services/tutorStubDialogueClosure.js';
import {
  auditTutorStubResponseComposition,
  buildTutorStubResponseCompositionFrame,
  composeTutorStubFallbackWithUptake,
  deterministicTutorStubConfiguredContinuationFallback,
  tutorStubSubstantiveLearnerEcho,
} from '../services/tutorStubResponseComposition.js';
import { buildTutorStubFirstDraftContract } from '../services/tutorStubFirstDraftContract.js';
import {
  buildTutorStubResponseConfiguration,
  selectTutorStubActionFamily,
} from '../services/tutorStubResponseConfiguration.js';
import {
  auditTutorStubTurnProgression,
  compileTutorStubTurnProgressionContract,
  deterministicTutorStubTurnProgressionHandoff,
  deterministicTutorStubTurnProgressionUptake,
} from '../services/tutorStubTurnProgressionContract.js';
import {
  applyTutorStubPublicLearnerRecordUpdate,
  createTutorStubPublicLearnerRecord,
} from '../services/tutorStubPublicLearnerAnalysis.js';

const PUBLIC_QUESTION = 'What makes every east-terrace loaf arrive cold on windless mornings?';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('Phase 5e R2 proof-skipper assertion gap requires the public question instead of a declarative loop', () => {
  const learnerText = 'The ledger clears Tibbin; the long spiral leaves every windless-morning loaf cold.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText,
    publicQuestion: PUBLIC_QUESTION,
    responseCompositionFrame: {
      learner_move: { summary: 'Clears Tibbin and names only the long spiral as the cause.' },
      learner_dag: {
        bottleneck: 'assertion_gap',
        final_secret_entailed: true,
        asserted_secret: false,
      },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'compress_sayback',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.handoff_contract.mode, 'assertion_gap_prompt');
  assert.equal(contract.handoff_contract.question_allowed, true);
  assert.equal(contract.handoff_contract.question_required, true);
  assert.deepEqual(contract.handoff_contract.required_target_surfaces, [PUBLIC_QUESTION]);
  assert.equal(deterministicTutorStubTurnProgressionHandoff({ contract }), PUBLIC_QUESTION);

  const audit = auditTutorStubTurnProgression({
    contract,
    composition: {
      slots: {
        uptake: 'Your ledger entry correctly clears Tibbin and identifies the long spiral.',
        performance: {
          entry: 'I keep the delivery ledger open at the missing causal source.',
          response: 'The final entry still needs to name what forces that longer crossing.',
        },
        handoff: PUBLIC_QUESTION,
      },
    },
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
});

test('Phase 5e R2 grounded closure fallback carries the frozen learner finding through the final sentence', () => {
  const learnerText = 'I’d enter: Tibbin is cleared, and Piper’s Gullet’s bolted shutter caused the cold deliveries.';
  const closureFrame = {
    enabled: true,
    mandatory: true,
    available: true,
    phase: 'grounded_terminal_close',
    allowCheckIn: false,
  };
  const responseFrame = buildTutorStubResponseCompositionFrame({
    learnerText,
    classification: {
      turn: {
        summary: 'Clears Tibbin and names the bolted shutter as cause.',
        discourse_move: 'inference',
        evidence_use: 'omits_warrant',
      },
    },
    registerSelection: { response_configuration: { action_family: 'close_inquiry' } },
    dialogueClosureFrame: closureFrame,
  });
  const contract = compileTutorStubTurnProgressionContract({
    learnerText,
    publicQuestion: PUBLIC_QUESTION,
    responseCompositionFrame: responseFrame,
    dialogueClosureFrame: closureFrame,
    actionFamily: 'close_inquiry',
    tactic: 'evidentiary_boundary',
  });
  const uptake = deterministicTutorStubTurnProgressionUptake({
    contract,
    defaultUptake: '',
    recentTutorTexts: Array(11).fill('prior tutor turn'),
    variationKey: 'phase5e-r2-pilot-job2-attempt1-turn12',
    learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, learnerText),
  });
  const focusHandoff = deterministicTutorStubTurnProgressionHandoff({
    contract,
    publicObject: 'delivery ledger',
  });
  const close = deterministicTutorStubClosureResponse(closureFrame, {
    responseConfiguration: { actorial_performance: { id: 'evidentiary_boundary' } },
    focusHandoff,
  });
  const text = composeTutorStubFallbackWithUptake({ text: close, uptake });

  const compositionAudit = auditTutorStubResponseComposition({
    text,
    frame: responseFrame,
    learnerText,
  });
  assert.equal(compositionAudit.ok, true, JSON.stringify(compositionAudit.issues));
  assert.doesNotMatch(uptake, /^That follows from what we can see/iu);
  assert.match(close, /Tibbin/iu);
  assert.match(close, /Piper’s Gullet’s bolted shutter/iu);
  assert.match(close, /inquiry is complete/iu);

  const progressionAudit = auditTutorStubTurnProgression({
    contract,
    composition: {
      slots: {
        uptake,
        performance: { entry: '', response: '' },
        handoff: close,
      },
    },
  });
  assert.equal(progressionAudit.ok, true, JSON.stringify(progressionAudit.issues));

  const closureAudit = auditTutorStubDialogueClosureResponse({ text, frame: closureFrame });
  assert.equal(closureAudit.ok, true, JSON.stringify(closureAudit.issues));
  assert.equal(closureAudit.closesDialogue, true);
});

test('Phase 5e R2 pilot A2 fallback replaces both rejected uptake forms with an auditable learner-specific opening', () => {
  for (const fixture of [
    {
      learnerText:
        'With the shutter bolted, Piper’s Gullet cannot provide the east crossing’s only lift on windless mornings.',
      summary: 'Infers the shutter blocks the sole still-air lift.',
      evidenceUse: 'links_evidence_to_rule',
      actionFamily: 'reanchor_public_evidence',
      defaultUptake: 'I hear the focus: “With the shutter bolted”; that stays at the centre of this turn.',
      variationKey: 'phase5e-r2-pilot-a2-job1-attempt1-turn8',
      dueEvidence:
        'Without lift on the direct line, a still-morning courier glides the long spiral — a crossing twice as long.',
    },
    {
      learnerText: 'The long spiral is why the east-terrace loaves arrive cold, with Tibbin cleared.',
      summary: 'Attributes cold loaves to the long spiral and clears Tibbin.',
      evidenceUse: 'omits_warrant',
      actionFamily: 'compress_sayback',
      defaultUptake: 'That follows from what we can see; I’ll carry just that much.',
      variationKey: 'phase5e-r2-pilot-a2-job2-attempt1-turn9',
      dueEvidence: 'The ovenloft launch log says the morning batch leaves the racks warm.',
    },
  ]) {
    const responseFrame = buildTutorStubResponseCompositionFrame({
      learnerText: fixture.learnerText,
      classification: {
        turn: {
          summary: fixture.summary,
          request_type: 'off_task_or_mixed',
          discourse_move: 'inference',
          evidence_use: fixture.evidenceUse,
        },
      },
      registerSelection: { response_configuration: { action_family: fixture.actionFamily } },
      dramaticReleaseFrame: { active: true },
    });
    responseFrame.due_evidence_surfaces = [fixture.dueEvidence];
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: fixture.learnerText,
      publicQuestion: PUBLIC_QUESTION,
      responseCompositionFrame: responseFrame,
      actionFamily: fixture.actionFamily,
      tactic: 'unadorned_report',
    });
    const uptake = deterministicTutorStubTurnProgressionUptake({
      contract,
      defaultUptake: fixture.defaultUptake,
      recentTutorTexts: Array(10).fill('prior tutor turn'),
      variationKey: fixture.variationKey,
      learnerEchoGuard: (candidate) => tutorStubSubstantiveLearnerEcho(candidate, fixture.learnerText),
    });
    const text = composeTutorStubFallbackWithUptake({
      uptake,
      text: `I write this public line into the delivery ledger: ${fixture.dueEvidence} What can we safely say from that?`,
    });
    const audit = auditTutorStubResponseComposition({
      text,
      frame: responseFrame,
      learnerText: fixture.learnerText,
      firstDraftContract: { progression: contract },
    });

    assert.notEqual(uptake, fixture.defaultUptake);
    assert.doesNotMatch(uptake, /^That follows from what we can see/iu);
    assert.equal(audit.ok, true, `${fixture.variationKey}: ${JSON.stringify(audit.issues)}`);
  }
});

test('Phase 5e R2 pilot A2 declarative fallback preserves the whole learner finding instead of only its ledger noun', () => {
  const learnerText = 'The ledger records Tibbin cleared and the bolted shutter as the cause of the cold loaves.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText,
    publicQuestion: PUBLIC_QUESTION,
    responseCompositionFrame: {
      learner_move: { summary: 'Clears Tibbin and names the shutter as cause.' },
      learner_dag: {
        bottleneck: 'learner_integration_gap',
        final_secret_entailed: false,
        asserted_secret: false,
      },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'compress_sayback',
    tactic: 'unadorned_report',
  });
  const handoff = deterministicTutorStubTurnProgressionHandoff({
    contract,
    publicObject: 'delivery ledger',
  });

  assert.match(handoff, /Tibbin cleared/iu);
  assert.match(handoff, /bolted shutter/iu);
  assert.match(handoff, /cause of the cold loaves/iu);
  assert.doesNotMatch(handoff, /^We will keep the ledger as the current public check/iu);
  const audit = auditTutorStubTurnProgression({
    contract,
    composition: {
      slots: {
        uptake: 'Your reading of the bolted shutter as the cause is the point I will carry forward.',
        performance: { entry: '', response: '' },
        handoff,
      },
    },
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
});

test('Phase 5e R2 pilot A1 replay reaches grounded closure from the missed natural-language premise and answer', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
  const record = createTutorStubPublicLearnerRecord(world);
  const stagedThrough = (turn) =>
    world.releaseSchedule
      .filter((entry) => entry.turn < turn)
      .map((entry) => {
        const premise = world.premiseById.get(entry.premise);
        return {
          premise: entry.premise,
          turn: entry.turn,
          via: entry.via,
          surface: premise.surface,
          fact: premise.fact,
        };
      });
  const apply = (turn, learnerText, { adopt = [], derive = [], assertAnswer = null } = {}) => {
    const publicEvidence = stagedThrough(turn);
    return applyTutorStubPublicLearnerRecordUpdate({
      update: { adopt, retract: [], derive, hypothesis: null, assert_answer: assertAnswer },
      world,
      record,
      tutorTurn: turn,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });
  };

  apply(4, 'The bolted frost shutter at Piper’s Gullet is behind the cold windless deliveries, not Tibbin.', {
    adopt: ['p_bolt'],
  });
  const soleLift = apply(
    6,
    'On windless mornings, every east-terrace glider depends on Piper’s Gullet, leaving the bolted shutter responsible for the cold loaves.',
  );
  apply(9, 'No—Tibbin has no place in the ledger; the bolted shutter and long spiral account for the cold loaves.', {
    adopt: ['p_spiral'],
  });
  apply(11, 'I’ll carry it forward: the flight, not Tibbin’s baking, is where the loaves turn cold.', {
    adopt: ['p_warm'],
  });
  const answer = apply(
    14,
    'The ledger’s final entry is clear: the bolted shutter forces the twice-long route on windless mornings, so the warm loaves cool before reaching the east terrace.',
    {
      derive: [world.secret.fact],
      assertAnswer: 'The bolted shutter caused the cold east-terrace deliveries.',
    },
  );

  assert.deepEqual(soleLift.accepted.authoredRecognition.adoptedPremises, ['p_soleLift']);
  assert.equal(answer.model.assessment.bestPathCoverage, 1);
  assert.equal(answer.model.assessment.finalSecretEntailed, true);
  assert.equal(answer.model.assessment.assertedSecret, true);
  assert.equal(answer.model.assessment.bottleneck, 'grounded_asserted_secret');
  assert.match(answer.accepted.authoredRecognition.assertedSurface, /twice-long route/u);
});

test('Phase 5e R2 pilot A3 turn 8 does not award the unstated spiral-length relation', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
  const record = createTutorStubPublicLearnerRecord(world);
  const stagedThrough = (turn) =>
    world.releaseSchedule
      .filter((entry) => entry.turn < turn)
      .map((entry) => {
        const premise = world.premiseById.get(entry.premise);
        return { premise: entry.premise, turn: entry.turn, via: entry.via, surface: premise.surface, fact: premise.fact };
      });
  const apply = (turn, learnerText, adopt = []) => {
    const publicEvidence = stagedThrough(turn);
    return applyTutorStubPublicLearnerRecordUpdate({
      update: { adopt, retract: [], derive: [], hypothesis: null, assert_answer: null },
      world,
      record,
      tutorTurn: turn,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });
  };

  apply(7, 'The shutter is bolted and Piper’s Gullet is the only windless lift.', ['p_bolt', 'p_soleLift']);
  const turn8 = apply(8, 'The long spiral route leaves the east-terrace loaves cold, not Tibbin’s dough.');

  assert.equal(turn8.accepted.adopt.includes('p_spiral'), false);
  assert.equal(turn8.accepted.authoredRecognition.adoptedPremises.includes('p_spiral'), false);
  assert.equal(turn8.model.assessment.bestPathCoverage, 0.5);
  assert.equal(turn8.assessment.missingPremises.some((row) => row.premiseId === 'p_spiral'), true);
});

test('Phase 5e R2 pilot A3 frozen-prefix replay targets the missing spiral relation and reaches closure', () => {
  const world = loadWorld(path.join(ROOT, 'config/drama-derivation/world-026-skyway-bakery.yaml'));
  const record = createTutorStubPublicLearnerRecord(world);
  const stagedThrough = (turn) =>
    world.releaseSchedule
      .filter((entry) => entry.turn < turn)
      .map((entry) => {
        const premise = world.premiseById.get(entry.premise);
        return { premise: entry.premise, turn: entry.turn, via: entry.via, surface: premise.surface, fact: premise.fact };
      });
  const apply = (turn, learnerText, adopt = []) => {
    const publicEvidence = stagedThrough(turn);
    return applyTutorStubPublicLearnerRecordUpdate({
      update: { adopt, retract: [], derive: [], hypothesis: null, assert_answer: null },
      world,
      record,
      tutorTurn: turn,
      learnerText,
      publicStagedEvidence: publicEvidence,
      publicReleaseLedger: publicEvidence,
    });
  };

  apply(10, 'The bread leaves warm; its cooling belongs to the journey, not Tibbin.', [
    'p_bolt',
    'p_soleLift',
    'p_warm',
  ]);
  const turn13Text = 'I enter it: Tibbin is cleared; the cold loaves cool on the windless journey.';
  const turn16Text = 'I enter it: Tibbin is clear; the windless crossing chills the loaves.';
  const turn13 = apply(13, turn13Text);
  const turn16 = apply(16, turn16Text);
  const releasePacing = { direction: 'steady', dueNow: [], nextRelease: null, schedule: [] };

  for (const [turn, learnerText, result] of [
    [13, turn13Text, turn13],
    [16, turn16Text, turn16],
  ]) {
    const action = selectTutorStubActionFamily({
      classification: { turn: { request_type: 'off_task_or_mixed' } },
      tutorLearnerDag: result,
      comprehension: { pressure: 0, unresolvedTerms: [] },
      releasePacing,
      world,
    });
    const configuration = buildTutorStubResponseConfiguration({
      engagementStance: 'plain',
      learnerText,
      classification: {
        turn: {
          request_type: 'off_task_or_mixed',
          summary: 'States the downstream windless-journey verdict without the route-length relation.',
        },
      },
      tutorLearnerDag: result,
      comprehension: { pressure: 0, unresolvedTerms: [] },
      releasePacing,
      world,
    });
    const responseFrame = buildTutorStubResponseCompositionFrame({
      learnerText,
      classification: {
        turn: {
          request_type: 'off_task_or_mixed',
          summary: 'States the downstream windless-journey verdict without the route-length relation.',
        },
      },
      tutorLearnerDag: result.model,
      registerSelection: { response_configuration: configuration },
    });
    const firstDraftContract = buildTutorStubFirstDraftContract({
      learnerText,
      publicQuestion: PUBLIC_QUESTION,
      responseConfiguration: configuration,
      responseCompositionFrame: responseFrame,
    });
    const fallback = deterministicTutorStubConfiguredContinuationFallback({
      uptake: `Your reading of “${learnerText}” is the one I will answer now.`,
      responseConfiguration: configuration,
      world,
      learnerText,
      turnProgressionContract: firstDraftContract.progression,
      recentTutorTexts: [],
      variationKey: `phase5e-a3-turn-${turn}`,
    });
    const audit = auditTutorStubResponseComposition({
      text: fallback,
      frame: responseFrame,
      learnerText,
      firstDraftContract,
    });

    assert.equal(result.model.assessment.bestPathCoverage, 0.75);
    assert.deepEqual(result.assessment.missingOnBestPath, ['p_spiral']);
    assert.equal(action.actionFamily, 'stage_next_step');
    assert.equal(configuration.action_family, 'stage_next_step');
    assert.equal(firstDraftContract.development.action_family, 'stage_next_step');
    assert.equal(firstDraftContract.progression.handoff_contract.mode, 'missing_relation_recovery');
    assert.equal(
      deterministicTutorStubTurnProgressionHandoff({ contract: firstDraftContract.progression }),
      'What does taking the long spiral do to the length of the crossing?',
    );
    assert.doesNotMatch(fallback, /I enter it/iu);
    assert.match(fallback, /What does taking the long spiral do to the length of the crossing\?$/u);
    assert.equal(audit.ok, true, `turn ${turn}: ${JSON.stringify(audit.issues)}`);
  }

  const recovered = apply(
    17,
    'The long spiral doubles the crossing; the bolted shutter forces that route, so the extra travel cools the loaves.',
  );
  assert.deepEqual(recovered.accepted.authoredRecognition.adoptedPremises, ['p_spiral']);
  assert.equal(recovered.model.assessment.bestPathCoverage, 1);
  assert.equal(recovered.model.assessment.finalSecretEntailed, true);
  assert.equal(recovered.model.assessment.assertedSecret, true);
  assert.equal(recovered.model.assessment.bottleneck, 'grounded_asserted_secret');
});
