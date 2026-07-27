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
  tutorStubSubstantiveLearnerEcho,
} from '../services/tutorStubResponseComposition.js';
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
