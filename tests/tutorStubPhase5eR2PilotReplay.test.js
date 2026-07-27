import assert from 'node:assert/strict';
import test from 'node:test';

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

const PUBLIC_QUESTION = 'What makes every east-terrace loaf arrive cold on windless mornings?';

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
