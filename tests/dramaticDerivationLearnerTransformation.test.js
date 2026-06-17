import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  auditLearnerTransformationPublicInput,
  deriveLearnerTransformationState,
  LEARNER_TRANSFORMATION_REQUIRED_FAMILIES,
  LEARNER_TRANSFORMATION_SCHEMA,
  learnerTransformationLines,
  loadWorld,
  makeLlmTutor,
  runDrama,
  summarizeLearnerTransformationDurability,
} from '../services/dramaticDerivation/index.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = loadWorld(path.join(ROOT, 'config/drama-derivation/world-012-hethel-complex-resistant.yaml'));
const WORLD_015 = loadWorld(path.join(ROOT, 'config/drama-derivation/world-015-hethel-public-reversal.yaml'));
const SCRIPT = 'You are the tutor in the assize. Guide without giving the answer.';

function stubClient(replies) {
  const calls = [];
  const remaining = new Map(Object.entries(replies).map(([role, list]) => [role, [...list]]));
  return {
    calls,
    client: {
      mode: 'mock',
      usage: () => ({}),
      async call(role, payload) {
        calls.push({ role, ...payload });
        const queue = remaining.get(role);
        if (!queue || !queue.length) throw new Error(`stubClient: no reply queued for ${role}`);
        const next = queue.shift();
        return typeof next === 'string' ? next : JSON.stringify(next);
      },
    },
  };
}

test('learner transformation exposes the compact ownership proof family set', () => {
  assert.deepEqual([...LEARNER_TRANSFORMATION_REQUIRED_FAMILIES], [
    'own_words',
    'use_in_path',
    'discriminate_wrong_route',
    'purpose_link',
  ]);
});

test('learner transformation audit rejects hidden proof-state inputs recursively', () => {
  const audit = auditLearnerTransformationPublicInput({
    target: WORLD.ownershipTarget,
    transcript: [{ role: 'learner', text: 'I can say the split in my own words.' }],
    hiddenBoard: [['failedAt', 'hethelSpan', 'crownJoint']],
    nested: { proofPath: ['p_point'], D: 3, predicateName: 'felledBy' },
  });

  assert.equal(audit.ok, false);
  assert.deepEqual(
    audit.leaks.map((leak) => leak.key).sort(),
    ['D', 'hiddenBoard', 'predicateName', 'proofPath'],
  );

  const state = deriveLearnerTransformationState({
    target: WORLD.ownershipTarget,
    transcript: [],
    proofPath: ['p_point'],
  });
  assert.equal(state.schema, LEARNER_TRANSFORMATION_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.status, 'rejected');
  assert.equal(state.nonLeakAudit.ok, true);
  assert.doesNotMatch(JSON.stringify(state), /p_point/u);
});

test('echo leaves the ownership proof incomplete', () => {
  const state = deriveLearnerTransformationState({
    target: WORLD.ownershipTarget,
    transcript: [
      {
        role: 'learner',
        text: 'As you said, liability is separate from cause and the bond is the liability line.',
      },
    ],
    turn: 8,
  });

  assert.equal(state.schema, LEARNER_TRANSFORMATION_SCHEMA);
  assert.equal(state.publicOnly, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.status, 'echo_without_ownership');
  assert.equal(state.complete, false);
  assert.ok(state.missingFamilies.includes('own_words'));
  assert.equal(state.recommendedMode, 'teach_back');
  assert.equal(state.nonLeakAudit.ok, true);
});

test('owned revision completes the public transformation proof', () => {
  const state = deriveLearnerTransformationState({
    target: WORLD.ownershipTarget,
    transcript: [
      {
        role: 'learner',
        text: 'I would say the Reyner bond is not the fall cause but the liability line, because it shows who answers for the work.',
      },
      {
        role: 'learner',
        text: 'That means the draft can keep Reyner for payment, while the causal fall line has to follow the material trace to Oswin.',
      },
      {
        role: 'learner',
        text: 'It matters because without that split I would turn a public bond into a claim about whose hand pulled the props.',
      },
    ],
    turn: 21,
  });

  assert.equal(state.status, 'transformed');
  assert.equal(state.complete, true);
  assert.deepEqual(state.missingFamilies, []);
  for (const family of WORLD.ownershipTarget.required_families) {
    assert.ok(state.passedFamilies.includes(family), family);
  }
  assert.equal(state.recommendedMode, 'hold_proof_course');
});

test('Hethel structural restatement completes without explicit in-my-words cue', () => {
  const state = deriveLearnerTransformationState({
    target: WORLD.ownershipTarget,
    transcript: [
      {
        role: 'learner',
        text: "The bond line says who must answer if the work fails; that's Reyner. A cause line would say what actually brought the arch down. I can see those aren't the same sentence.",
      },
      {
        role: 'learner',
        text: "The draft has to carry two lines, not one: Reyner's bond says he pays when the span fails, and that line holds; but the cause is the centering drawn early, and that's a different question with a different answer. I can write that split without abandoning the surety.",
      },
    ],
    turn: 20,
  });

  assert.equal(state.status, 'transformed');
  assert.equal(state.complete, true);
  assert.deepEqual(state.missingFamilies, []);
  assert.equal(state.recommendedMode, 'hold_proof_course');
});

test('late ownership check asks for restatement without changing proof authority', () => {
  const state = deriveLearnerTransformationState({
    target: WORLD.ownershipTarget,
    transcript: [
      {
        role: 'learner',
        text: "Reyner's bond is separate from the cause, so Oswin is still in view.",
      },
    ],
    finalAssertionAvailable: true,
    turn: 20,
  });

  assert.equal(state.complete, false);
  assert.equal(state.lateOwnershipCheck, true);
  assert.equal(state.mayOverrideProofControl, false);
  assert.ok(state.missingFamilies.every((family) => family === 'own_words' || family === 'purpose_link'));
  assert.match(state.nextTutorConduct.join(' '), /Before inviting closure/u);
  assert.match(learnerTransformationLines(state).join('\n'), /late ownership check/u);
});

test('transfer gate activates only when near transfer is the sole closure-time gap', () => {
  const transcript = [
    {
      role: 'learner',
      text: 'I would say the Reyner bond is a liability line: it says who answers if the bridge failed, not what hand brought the fall down.',
    },
    {
      role: 'learner',
      text: 'That means the public minute can keep Reyner in one column for payment, because the cause line has to follow what actually brought it down.',
    },
    {
      role: 'learner',
      text: 'Back to the bond: it still matters because it answers who pays; it does not settle the cause.',
    },
  ];
  const state = deriveLearnerTransformationState({
    target: WORLD_015.ownershipTarget,
    transcript,
    finalAssertionAvailable: true,
    transferGate: true,
    turn: 20,
  });

  assert.equal(state.complete, false);
  assert.equal(state.mayOverrideProofControl, false);
  assert.equal(state.nearTransferRequired, true);
  assert.equal(state.transferGate, true);
  assert.equal(state.transferGateActive, true);
  assert.equal(state.recommendedMode, 'analogy_bridge');
  assert.deepEqual(state.missingFamilies, ['near_transfer']);
  assert.match(state.nextTutorConduct.join(' '), /compact parallel case/u);
  assert.match(learnerTransformationLines(state).join('\n'), /transfer gate/u);
  assert.match(learnerTransformationLines(state).join('\n'), /near transfer is still missing/u);
  assert.equal(state.nonLeakAudit.ok, true);
});

test('transfer gate stays inactive before closure or when the flag is off', () => {
  const transcript = [
    {
      role: 'learner',
      text: 'I would say the Reyner bond is a liability line: it says who answers if the bridge failed, not what hand brought the fall down.',
    },
    {
      role: 'learner',
      text: 'That means the public minute can keep Reyner in one column for payment, because the cause line has to follow what actually brought it down.',
    },
    {
      role: 'learner',
      text: 'Back to the bond: it still matters because it answers who pays; it does not settle the cause.',
    },
  ];
  const beforeClosure = deriveLearnerTransformationState({
    target: WORLD_015.ownershipTarget,
    transcript,
    finalAssertionAvailable: false,
    transferGate: true,
  });
  const flagOff = deriveLearnerTransformationState({
    target: WORLD_015.ownershipTarget,
    transcript,
    finalAssertionAvailable: true,
    transferGate: false,
  });

  assert.deepEqual(beforeClosure.missingFamilies, ['near_transfer']);
  assert.equal(beforeClosure.transferGateActive, false);
  assert.equal(flagOff.transferGateActive, false);
  assert.doesNotMatch(learnerTransformationLines(beforeClosure).join('\n'), /transfer gate/u);
  assert.doesNotMatch(learnerTransformationLines(flagOff).join('\n'), /transfer gate/u);
});

test('different-file transfer evidence closes the transfer gap before the next tutor turn', () => {
  const state = deriveLearnerTransformationState({
    target: WORLD_015.ownershipTarget,
    finalAssertionAvailable: true,
    transferGate: true,
    transcript: [
      {
        role: 'learner',
        text: 'I would say the Reyner bond is a liability line: it says who answers if the bridge failed, not what hand brought the fall down.',
      },
      {
        role: 'learner',
        text: 'Back to the bond: it still matters because it answers who pays; it does not settle the cause.',
      },
      {
        role: 'learner',
        text: "All right, try it on a different file. First line: the bonded builder holds the warranty, so that line is liability. Second line: the yard-mark and toll book put the removed supports in one carrier's hands, so that line is cause.",
      },
    ],
  });

  assert.equal(state.status, 'transformed');
  assert.equal(state.complete, true);
  assert.equal(state.transferGateActive, false);
  assert.equal(state.missingFamilies.includes('near_transfer'), false);
  assert.equal(state.recommendedMode, 'hold_proof_course');
  assert.doesNotMatch(learnerTransformationLines(state).join('\n'), /transfer gate/u);
});

test('durability summary requires ownership to survive later public releases and final turn', () => {
  const summary = summarizeLearnerTransformationDurability({
    rows: [
      {
        turn: 2,
        status: 'transformed',
        complete: true,
        missingFamilies: [],
      },
      {
        turn: 4,
        status: 'transformed',
        complete: true,
        missingFamilies: [],
      },
      {
        turn: 20,
        status: 'transformed',
        complete: true,
        missingFamilies: [],
      },
    ],
    releaseTurns: [2, 4, 20],
    finalTurn: 20,
  });

  assert.equal(summary.status, 'durable_transformation');
  assert.equal(summary.durable, true);
  assert.equal(summary.firstCompleteTurn, 2);
  assert.equal(summary.releaseChallengeCount, 2);
  assert.equal(summary.survivedAllReleaseChallenges, true);
  assert.equal(summary.finalComplete, true);
  assert.equal(summary.nonLeakAudit.ok, true);
});

test('durability summary rejects early ownership that does not survive later material evidence', () => {
  const summary = summarizeLearnerTransformationDurability({
    rows: [
      {
        turn: 2,
        status: 'transformed',
        complete: true,
        missingFamilies: [],
      },
      {
        turn: 4,
        status: 'partial_ownership',
        complete: false,
        missingFamilies: ['use_in_path'],
      },
      {
        turn: 20,
        status: 'transformed',
        complete: true,
        missingFamilies: [],
      },
    ],
    releaseTurns: [2, 4, 20],
    finalTurn: 20,
  });

  assert.equal(summary.status, 'non_durable_transformation');
  assert.equal(summary.durable, false);
  assert.equal(summary.firstCompleteTurn, 2);
  assert.equal(summary.releaseChallengeCount, 2);
  assert.equal(summary.survivedAllReleaseChallenges, false);
  assert.equal(summary.releaseChallenges[0].releaseTurn, 4);
  assert.equal(summary.releaseChallenges[0].complete, false);
  assert.deepEqual(summary.releaseChallenges[0].missingFamilies, ['use_in_path']);
  assert.equal(summary.finalComplete, true);
});

test('tutor prompt projection carries ownership proof target and metadata without proof authority', async () => {
  const { client, calls } = stubClient({
    tutor: [
      {
        dialogue: 'Put that split in your own words, keeping the bond as a real line.',
        move: { figure: 'erotema', target_premise: null, intent: 'test' },
      },
    ],
  });
  const tutor = makeLlmTutor(WORLD, client, {
    script: SCRIPT,
    ownershipTarget: WORLD.ownershipTarget,
    ownershipProof: true,
  });
  const out = await tutor({
    turn: 9,
    role: 'tutor',
    world: WORLD,
    ledger: [],
    releasedFacts: [],
    transcript: [
      {
        turn: 8,
        role: 'learner',
        text: 'As you said, liability is separate from cause and the bond is the liability line.',
      },
    ],
    staging: { phase: null },
    trajectory: [],
    learnerAbox: { grounded: WORLD.background, hypotheses: [] },
    inference: { frontier: [], voiced: [], overreachCount: 0 },
    scene: { index: 1, goal: 'test learner ownership', exchangesSoFar: 1 },
    publicRegister: 'default',
  });

  const tutorCall = calls.find((call) => call.role === 'tutor');
  assert.ok(tutorCall.system.includes('# Learner ownership proof'));
  assert.ok(tutorCall.user.includes('LEARNER OWNERSHIP PROOF'));
  assert.ok(tutorCall.user.includes('transformation trigger to cultivate'));
  assert.ok(tutorCall.user.includes('missing now: own_words'));
  assert.doesNotMatch(tutorCall.user, /hiddenBoard|proofPath|predicateName|D=/u);
  assert.equal(tutorCall.meta.learnerTransformation.schema, LEARNER_TRANSFORMATION_SCHEMA);
  assert.equal(tutorCall.meta.learnerTransformation.mayOverrideProofControl, false);
  assert.equal(out.learnerTransformation.status, 'echo_without_ownership');
  assert.equal(out.move.intent, 'test');
});

test('tutor prompt projection carries the transfer gate without proof authority', async () => {
  const { client, calls } = stubClient({
    tutor: [
      {
        dialogue: 'Give me one compact public parallel before you close the assize-book.',
        move: { figure: 'analogia', target_premise: null, intent: 'test' },
      },
    ],
  });
  const tutor = makeLlmTutor(WORLD_015, client, {
    script: SCRIPT,
    ownershipTarget: WORLD_015.ownershipTarget,
    ownershipProof: true,
    ownershipTransferGate: true,
  });
  const out = await tutor({
    turn: 20,
    role: 'tutor',
    world: WORLD_015,
    ledger: [],
    releasedFacts: [],
    transcript: [
      {
        turn: 17,
        role: 'learner',
        text: 'I would say the Reyner bond is a liability line: it says who answers if the bridge failed, not what hand brought the fall down.',
      },
      {
        turn: 18,
        role: 'learner',
        text: 'That means the public minute can keep Reyner in one column for payment, because the cause line has to follow what actually brought it down.',
      },
      {
        turn: 19,
        role: 'learner',
        text: 'Back to the bond: it still matters because it answers who pays; it does not settle the cause.',
      },
    ],
    staging: { phase: null },
    trajectory: [],
    learnerAbox: { grounded: WORLD_015.background, hypotheses: [] },
    inference: { frontier: [], voiced: [], overreachCount: 0 },
    scene: { index: 3, goal: 'test transfer before closure', exchangesSoFar: 2 },
    publicRegister: 'modern',
    conductEntitlement: { canAssertFinal: true },
  });

  const tutorCall = calls.find((call) => call.role === 'tutor');
  assert.ok(tutorCall.system.includes('When the transfer gate appears'));
  assert.ok(tutorCall.user.includes('transfer gate: proof closure may be available'));
  assert.ok(tutorCall.user.includes('missing now: near_transfer'));
  assert.ok(tutorCall.user.includes('compact nearby parallel'));
  assert.doesNotMatch(tutorCall.user, /hiddenBoard|proofPath|predicateName|D=/u);
  assert.equal(tutorCall.meta.learnerTransformation.transferGateActive, true);
  assert.equal(tutorCall.meta.learnerTransformation.mayOverrideProofControl, false);
  assert.equal(out.learnerTransformation.transferGateActive, true);
  assert.equal(out.move.figure, 'analogia');
});

test('engine records post-learner ownership proof separately from tutor advisory', async () => {
  const result = await runDrama({
    world: WORLD,
    options: { maxTurns: 1 },
    roles: {
      async director() {
        return { direction: 'Hold the public question.' };
      },
      async tutor(view) {
        return {
          dialogue: 'Put the liability and cause split in your own words.',
          move: { figure: 'erotema', targetPremise: null, intent: 'test' },
          learnerTransformation: deriveLearnerTransformationState({
            target: WORLD.ownershipTarget,
            transcript: view.transcript,
            turn: view.turn,
            enabled: true,
          }),
        };
      },
      async learner() {
        return {
          dialogue:
            "The bond line says who must answer if the work fails; that's Reyner. A cause line would say what actually brought the arch down. I can see those aren't the same sentence.",
          adopt: [],
          retract: [],
          derive: [],
        };
      },
    },
  });

  assert.equal(result.learnerTransformation?.[0]?.phase, 'pre_tutor');
  assert.equal(result.learnerTransformation[0].complete, false);
  assert.equal(result.learnerTransformationPost?.[0]?.phase, 'post_learner');
  assert.equal(result.learnerTransformationPost[0].complete, true);
  assert.equal(result.learnerTransformationPost[0].mayOverrideProofControl, false);
  assert.equal(result.learnerTransformationDurability.status, 'single_point_transformation');
  assert.equal(result.learnerTransformationDurability.durable, false);
  assert.equal(result.learnerTransformationDurability.mayOverrideProofControl, false);
});
