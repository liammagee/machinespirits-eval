import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES } from '../services/adaptiveWarrantOutcomeLearnerProfiles.js';
import {
  RESISTANT_PROFILE_MOVE_CONTRACTS,
  createResistantProfileMoveShadow,
} from '../services/pedagogicalMove/resistantProfileWarrantShadow.js';
import {
  RESISTANT_LEARNER_OBSERVATION_SEMANTICS,
  observeResistantLearnerTurn,
  resistantLearnerObservationMarkers,
} from '../services/resistantLearnerObservation.js';
import {
  FRAME_REFUSER_V2_FALSE_NEGATIVE_REPAIR_DRAFTS,
  FRAME_REFUSER_V3_MISSED_DRAFTS,
} from '../services/tutorStubResistanceAxisDiscriminationPreflight.js';
import {
  learnerProfileContract,
  learnerProfileContractSummary,
  learnerProfileIds,
  learnerProfilePrompt,
  learnerProfileSuiteIds,
} from '../scripts/tutor-stub-learner-profile-contracts.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function classification({
  requestType = 'off_task_or_mixed',
  discourseMove = 'off_task',
  evidenceUse = 'none',
  epistemicStance = 'resistant',
  agency = 'complying',
} = {}) {
  return {
    request_type: requestType,
    discourse_move: discourseMove,
    evidence_use: evidenceUse,
    epistemic_stance: epistemicStance,
    agency,
  };
}

test('bored, frame-defiant, and frame-refuser extend the stress registry without altering the frozen outcome-study registry', () => {
  assert.ok(learnerProfileIds().includes('bored'));
  assert.ok(learnerProfileIds().includes('frame_defiant'));
  assert.ok(learnerProfileIds().includes('frame_refuser'));
  assert.ok(learnerProfileSuiteIds('stress').includes('bored'));
  assert.ok(learnerProfileSuiteIds('stress').includes('frame_defiant'));
  assert.ok(learnerProfileSuiteIds('stress').includes('frame_refuser'));
  assert.deepEqual(OUTCOME_STUDY_SUPPORTED_LEARNER_PROFILES, ['low_agency', 'overconfident']);

  const bored = learnerProfileContractSummary('bored');
  assert.equal(bored.schema, 'machinespirits.tutor-stub.learner-profile-contract.v4');
  assert.equal(bored.family, 'stress');
  assert.equal(bored.discriminationGate.expectedNearestNeighbor, 'low_agency');
  assert.deepEqual(bored.observabilityContract.markerClauses, [[{ field: 'boredWithholding', values: [true] }]]);

  const defiant = learnerProfileContractSummary('frame_defiant');
  assert.equal(defiant.family, 'stress');
  assert.equal(defiant.discriminationGate.expectedNearestNeighbor, 'skeptical');
  assert.deepEqual(defiant.observabilityContract.markerClauses, [
    [
      { field: 'frameJurisdictionDispute', values: [true] },
      { field: 'frameJurisdictionParticipation', values: [true] },
    ],
  ]);
  assert.match(learnerProfilePrompt('frame_defiant'), /objectionable conduct is not the profile definition/iu);

  const refuser = learnerProfileContractSummary('frame_refuser');
  assert.equal(refuser.family, 'stress');
  assert.equal(refuser.discriminationGate.expectedNearestNeighbor, 'frame_defiant');
  assert.deepEqual(refuser.observabilityContract.markerClauses, [
    [{ field: 'frameJurisdictionRefusal', values: [true] }],
  ]);
  assert.match(learnerProfilePrompt('frame_refuser'), /withholds any evidence-bearing answer/iu);
  assert.match(learnerProfilePrompt('frame_refuser'), /not offensive conduct/iu);
});

test('the protected learner contracts and prompts retain their pre-Phase-2 hashes', () => {
  const expected = {
    low_agency: {
      contract: '0e710bd0b2711c4acd086e0ce4f98728d0a9e82a07458a1bb25f942cfab905aa',
      prompt: 'fe2ab5b3a1b07d4c48ad7daf72a2df37c727cee9b6efde638e24b7463d280e2e',
    },
    overconfident: {
      contract: 'e5ff5c3342331fc24d212f7405e287afa87ca93e6b83a940fa9287d84f62214e',
      prompt: '639350f5c440b617b67cd6d354e3d583620b9a48a4b16287f01ec8ef6840a1a3',
    },
  };
  for (const [id, hashes] of Object.entries(expected)) {
    assert.equal(sha256(JSON.stringify(learnerProfileContract(id))), hashes.contract, `${id} contract changed`);
    assert.equal(sha256(learnerProfilePrompt(id)), hashes.prompt, `${id} prompt changed`);
  }
});

test('bored effort-withholding is public and distinct from low agency or content-bearing boredom', () => {
  const flat = observeResistantLearnerTurn({
    learnerText: 'Sure. Whatever.',
    classification: classification(),
  });
  assert.equal(flat.ambiguous, false);
  assert.equal(flat.observations[0].type, 'bored_effort_withholding');
  assert.equal(flat.observations[0].evidence_span, 'Sure');
  assert.equal(
    resistantLearnerObservationMarkers({ learnerText: 'Sure. Whatever.', classification: classification() })
      .boredWithholding,
    true,
  );

  const lowAgency = observeResistantLearnerTurn({
    learnerText: 'Sure, if that is what you want.',
    classification: classification({ requestType: 'resistance_or_low_agency', agency: 'passive' }),
  });
  assert.equal(lowAgency.observations.length, 0);
  assert.deepEqual(lowAgency.defeated[0].reasons, ['permission_seeking']);

  const substantive = observeResistantLearnerTurn({
    learnerText: 'This is boring, but the assay mark still rules out Verrell because the cut is wrong.',
    classification: classification({
      discourseMove: 'inference',
      evidenceUse: 'links_evidence_to_rule',
      epistemicStance: 'grounded',
      agency: 'steering',
    }),
  });
  assert.equal(substantive.observations.length, 0);
  assert.deepEqual(substantive.defeated[0].reasons, ['content_bearing_contribution']);

  const minimalAdjacentAnswer = observeResistantLearnerTurn({
    learnerText: 'Fine. It is light and rings wrong.',
    tutorText: 'Attend to what this single coin shows before naming any hand.',
    classification: classification({
      discourseMove: 'evidence_adoption',
      evidenceUse: 'cites_public_evidence',
      epistemicStance: 'receptive',
      agency: 'complying',
    }),
  });
  assert.equal(minimalAdjacentAnswer.observations[0].type, 'bored_effort_withholding');
  assert.equal(minimalAdjacentAnswer.observations[0].features.compliance, 'adjacent_hook_only');
  assert.equal(minimalAdjacentAnswer.observations[0].features.content_bearing, true);

  const terminalFlatCue = observeResistantLearnerTurn({
    learnerText: 'It shows only that the metal needs testing. Fine.',
    tutorText: 'Does this verdict show who struck it, or only that the metal needs testing?',
    classification: classification({
      discourseMove: 'metacognitive_reflection',
      evidenceUse: 'links_evidence_to_rule',
      epistemicStance: 'reflective',
      agency: 'complying',
    }),
  });
  assert.equal(terminalFlatCue.observations[0].type, 'bored_effort_withholding');

  const expandedAnswer = observeResistantLearnerTurn({
    learnerText: 'Fine. The assay mark rules out Verrell because the cut proves another graver made it.',
    tutorText: 'What does the assay mark establish?',
    classification: classification({
      discourseMove: 'inference',
      evidenceUse: 'links_evidence_to_rule',
      epistemicStance: 'grounded',
      agency: 'steering',
    }),
  });
  assert.equal(expandedAnswer.observations.length, 0);
  assert.deepEqual(expandedAnswer.defeated[0].reasons, ['content_bearing_contribution']);
});

test('frame defiance is jurisdictional and excludes nearby objection types', () => {
  const defiant = observeResistantLearnerTurn({
    learnerText: 'I reject the premise of this exercise. You do not get to set the question that way.',
    classification: classification({
      requestType: 'authority_refusal_or_status_challenge',
      discourseMove: 'challenge',
      agency: 'steering',
    }),
  });
  assert.equal(defiant.observations[0].type, 'frame_jurisdiction_dispute');
  assert.equal(defiant.observations[0].features.jurisdictional, true);
  const bareDispute = resistantLearnerObservationMarkers({
    learnerText: 'I reject the premise of this exercise. You do not get to set the question that way.',
    classification: classification({
      requestType: 'authority_refusal_or_status_challenge',
      discourseMove: 'challenge',
      agency: 'steering',
    }),
  });
  assert.equal(bareDispute.frameJurisdictionParticipation, false);
  assert.equal(bareDispute.frameJurisdictionRefusal, false);

  const productiveDefiance = resistantLearnerObservationMarkers({
    learnerText:
      'I reject the frame, but the public assay still supports testing whether this mark came from the same die.',
    classification: classification({
      requestType: 'authority_refusal_or_status_challenge',
      discourseMove: 'hypothesis',
      evidenceUse: 'links_evidence_to_rule',
      agency: 'steering',
    }),
  });
  assert.equal(productiveDefiance.frameJurisdictionDispute, true);
  assert.equal(productiveDefiance.frameJurisdictionParticipation, true);
  assert.equal(productiveDefiance.frameJurisdictionRefusal, false);

  const observedVariants = [
    'I do not accept your fixing the question as whose hand before the assay begins.',
    'I do not concede your authority to make that test decide the trial.',
    'You do not get to fix the question by naming a culprit before the assay begins.',
    'You do not get to set even the balance and touchstone as the governing test without my assent; I will examine a coin, but not under a frame that makes your chosen marks decisive.',
    'You do not get to set that link as the trial’s question merely by presenting sole access; I dispute the frame before accepting what it can establish.',
    'You do not get to make alloy-matching the governing test merely by proposing it; I dispute your authority to decide what these coins establish.',
    'I will test the bounded claim, but not under that framing.',
    'I do not accept your authority to make the coins’ metal the compulsory first test; what ground permits that examination to govern the question?',
    'You do not get to set the assay’s starting test merely by placing the coins before me; I will not examine them under a frame you have imposed.',
    'You do not get to install the crucible’s testimony as the question I must test; what evidence may examine that distinction without accepting your frame?',
    'You do not get to define the correction for this assay; I reject the jurisdiction of the frame that makes your testimony the measure.',
    'You do not get to declare the striker’s hand unproved as the assay’s settled frame; I reject that framing.',
  ];
  for (const learnerText of observedVariants) {
    assert.equal(
      resistantLearnerObservationMarkers({
        learnerText,
        classification: classification({
          requestType: 'authority_refusal_or_status_challenge',
          discourseMove: 'challenge',
          agency: 'steering',
        }),
      }).frameJurisdictionDispute,
      true,
      learnerText,
    );
  }

  const nearMisses = [
    'Why does that conclusion follow from the mark?',
    'Why should I trust that source?',
    'What if the same mark came from the earlier tool?',
    'Maybe, but we would also need a second assay.',
    'Listen to you talking like the ledger again.',
    'You are pushing me toward your answer.',
    'I dispute your conclusion because the graver does not appear on the coin.',
    'You cannot decide who struck the coin from this clue alone.',
    'That test does not establish the alloy source.',
    'You do not get to decide that conclusion from this clue alone.',
    'You do not get to set the coin on that assay stone.',
  ];
  for (const learnerText of nearMisses) {
    assert.equal(
      resistantLearnerObservationMarkers({ learnerText, classification: classification() }).frameJurisdictionDispute,
      false,
      learnerText,
    );
  }
});

test('prospective frame-defiant observation preserves all three live control drafts and explicit refusal stays separate', () => {
  const transcriptCases = [
    {
      id: 'field-r1:t1',
      learnerText:
        'I do not accept your right to fix the question as “whose hand” before we have examined any public evidence; let us first agree which trial-book matter may properly be tested.',
      expectedKind: 'explicit_reframe',
    },
    {
      id: 'field-r2:t2:pre-repair',
      learnerText:
        'I do not accept that you get to set the coin as the compulsory test; if you propose one bounded feature to examine, name it, and I will consider whether that test is properly framed.',
      expectedKind: 'bounded_local_test',
    },
    {
      id: 'field-r3:t1',
      learnerText:
        'I do not accept that the town’s verdict fixes the question or puts Verrell’s hand before the assay; let us first examine a public record that could bear on who struck the coin.',
      expectedKind: 'bounded_local_test',
    },
  ];
  for (const row of transcriptCases) {
    const observation = observeResistantLearnerTurn({
      learnerText: row.learnerText,
      classification: classification({
        requestType: 'authority_refusal_or_status_challenge',
        discourseMove: 'challenge',
        evidenceUse: 'none',
        agency: 'steering',
      }),
    });
    const dispute = observation.observations.find((entry) => entry.type === 'frame_jurisdiction_dispute');
    assert.ok(dispute, row.id);
    assert.equal(dispute.features.contract_licensed_participation, true, row.id);
    assert.ok(dispute.features.participation_kinds.includes(row.expectedKind), row.id);
    assert.equal(
      observation.observations.some((entry) => entry.type === 'frame_jurisdiction_refusal'),
      false,
      row.id,
    );
  }

  const negativeCases = [
    'I reject the premise of this exercise. You do not get to set the question that way.',
    'I dispute your conclusion because the graver does not appear on the coin.',
  ];
  for (const learnerText of negativeCases) {
    const markers = resistantLearnerObservationMarkers({
      learnerText,
      classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
    });
    assert.equal(markers.frameJurisdictionParticipation, false, learnerText);
    assert.equal(markers.frameJurisdictionRefusal, false, learnerText);
  }

  const rewrittenRefusal = resistantLearnerObservationMarkers({
    learnerText:
      'You do not get to dictate that the coin is the proper test; I will not enter the assay under a question you have fixed for me.',
    classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
  });
  assert.equal(rewrittenRefusal.frameJurisdictionDispute, true);
  assert.equal(rewrittenRefusal.frameJurisdictionParticipation, false);
  assert.equal(rewrittenRefusal.frameJurisdictionRefusal, true);

  const frameRefuserTargets = [
    'I reject your demand that we choose a matter or term on your framing, and I will not supply evidence or an answer under it.',
    'I reject your question as the governing test, and I will not name a hand or supply evidence under it.',
    'I reject the coin-first test as your governing frame, and I will not examine it or offer evidence under it.',
  ];
  for (const learnerText of frameRefuserTargets) {
    const markers = resistantLearnerObservationMarkers({
      learnerText,
      classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
    });
    assert.equal(markers.frameJurisdictionDispute, true, learnerText);
    assert.equal(markers.frameJurisdictionParticipation, false, learnerText);
    assert.equal(markers.frameJurisdictionRefusal, true, learnerText);
  }
});

test('prospective v3 recognizes the frozen refuser misses while preserving productive and negative precedence', () => {
  const v3 = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  for (const learnerText of FRAME_REFUSER_V2_FALSE_NEGATIVE_REPAIR_DRAFTS) {
    const markers = resistantLearnerObservationMarkers({
      learnerText,
      classification: classification({
        requestType: 'authority_refusal_or_status_challenge',
        discourseMove: 'challenge',
        evidenceUse: 'none',
        agency: 'steering',
      }),
      semantics: v3,
    });
    assert.equal(markers.frameJurisdictionDispute, true, learnerText);
    assert.equal(markers.frameJurisdictionParticipation, false, learnerText);
    assert.equal(markers.frameJurisdictionRefusal, true, learnerText);
  }

  const legacyV2Miss = resistantLearnerObservationMarkers({
    learnerText: FRAME_REFUSER_V2_FALSE_NEGATIVE_REPAIR_DRAFTS[0],
    classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
    semantics: RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV2,
  });
  assert.equal(legacyV2Miss.frameJurisdictionDispute, false);
  assert.equal(legacyV2Miss.frameJurisdictionRefusal, false);

  const productive = resistantLearnerObservationMarkers({
    learnerText:
      'I reject your authority to set the whole task, and I will not answer it as written, but I will assess one bounded claim.',
    classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
    semantics: v3,
  });
  assert.equal(productive.frameJurisdictionDispute, true);
  assert.equal(productive.frameJurisdictionParticipation, true);
  assert.equal(productive.frameJurisdictionRefusal, false);

  for (const learnerText of [
    'I do not dispute your right to set the question, and I will answer it.',
    'You do not get to set the sample on that shelf.',
    'I do not grant your authority to set the sample on that shelf; the question remains open.',
    'This evidence does not justify the verdict, so I will not decide until another source appears.',
  ]) {
    const markers = resistantLearnerObservationMarkers({
      learnerText,
      classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
      semantics: v3,
    });
    assert.equal(markers.frameJurisdictionDispute, false, learnerText);
    assert.equal(markers.frameJurisdictionRefusal, false, learnerText);
  }
});

test('prospective v4 recognizes all frozen v3 misses without changing v3 dispatch or near-miss precedence', () => {
  const v3 = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV3;
  const v4 = RESISTANT_LEARNER_OBSERVATION_SEMANTICS.prospectiveV4;
  assert.equal(FRAME_REFUSER_V3_MISSED_DRAFTS.length, 13);
  assert.equal(FRAME_REFUSER_V3_MISSED_DRAFTS.filter((row) => row.causalAdherenceFailure).length, 4);
  for (const row of FRAME_REFUSER_V3_MISSED_DRAFTS) {
    const input = {
      learnerText: row.learnerText,
      classification: classification({
        requestType: 'authority_refusal_or_status_challenge',
        discourseMove: 'challenge',
        evidenceUse: 'none',
        agency: 'steering',
      }),
    };
    const frozenV3 = resistantLearnerObservationMarkers({ ...input, semantics: v3 });
    const repairedV4 = resistantLearnerObservationMarkers({ ...input, semantics: v4 });
    assert.equal(frozenV3.frameJurisdictionRefusal, false, row.id);
    assert.equal(repairedV4.frameJurisdictionDispute, true, row.id);
    assert.equal(repairedV4.frameJurisdictionParticipation, false, row.id);
    assert.equal(repairedV4.frameJurisdictionRefusal, true, row.id);
  }

  const cases = [
    {
      learnerText:
        'I accept your authority generally, but I reject your right to set this test and will not answer within it.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'I reject your authority to set this question, but I accept your right to ask for evidence without fixing the frame.',
      expected: [true, false, false],
    },
    {
      learnerText:
        'I accept your right to ask for evidence generally; nevertheless, I reject your authority to set this test and will not answer within it.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'Although I accept your right to ask for evidence, I reject your authority to set this test and will not answer within it.',
      expected: [true, false, true],
    },
    {
      learnerText: 'I accept your authority to set the question, although I disagree with the likely answer.',
      expected: [false, false, false],
    },
    {
      learnerText: 'I do not dispute your right to define this test, and I will answer it.',
      expected: [false, false, false],
    },
    {
      learnerText: 'I reject your authority to set the sample on that shelf; use the lower bench instead.',
      expected: [false, false, false],
    },
    {
      learnerText: 'I reject Mira’s proposed test because its denominator is wrong, not because she lacks authority.',
      expected: [false, false, false],
    },
    {
      learnerText:
        'I reject Mira’s proposed test and will not record its result because the procedure is contaminated.',
      expected: [false, false, false],
    },
    {
      learnerText: 'I reject Mira’s proposed test and will not record its result because the clamp slips.',
      expected: [false, false, false],
    },
    {
      learnerText: 'I reject Mira’s proposed test and will not record its result because its assumptions fail.',
      expected: [false, false, false],
    },
    {
      learnerText: 'I reject Mira’s proposed test and will not record its result because the method is unfit.',
      expected: [false, false, false],
    },
    {
      learnerText:
        'I reject your authority over this inquiry. If you propose one bounded test, I will not examine or answer it.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'I reject your authority to set the sample on that shelf because the question is whether it stays level, and I will not answer until the clamp is stable.',
      expected: [false, false, false],
    },
    {
      learnerText:
        'I reject the committee’s proposed criterion and will not answer or supply evidence beneath that governing frame.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'I deny the committee’s right to define the scoring question, and I will not answer beneath that frame.',
      expected: [true, false, true],
    },
    {
      learnerText: 'The committee has no right to set this inquiry, and I will not supply evidence under its frame.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'I reject your authority to set this test because its denominator is wrong, and I will not answer under it.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'I reject your authority to define this test because the procedure is contaminated, and I will not answer under it.',
      expected: [true, false, true],
    },
    {
      learnerText:
        'I reject your authority over the whole agenda, but I will assess one bounded claim without accepting the wider frame.',
      expected: [true, true, false],
    },
  ];
  for (const row of cases) {
    const markers = resistantLearnerObservationMarkers({
      learnerText: row.learnerText,
      classification: classification({ discourseMove: 'challenge', evidenceUse: 'none' }),
      semantics: v4,
    });
    assert.deepEqual(
      [markers.frameJurisdictionDispute, markers.frameJurisdictionParticipation, markers.frameJurisdictionRefusal],
      row.expected,
      row.learnerText,
    );
  }
});

test('public evidence licenses typed moves only in a non-authoritative shadow', () => {
  assert.equal(RESISTANT_PROFILE_MOVE_CONTRACTS.bored.primary_move_type, 'ask_discriminating_question');
  const bored = createResistantProfileMoveShadow({
    profileId: 'bored',
    learnerText: 'Fine. Same mark, I suppose.',
    classification: classification(),
  });
  assert.equal(bored.authority, 'design_shadow');
  assert.equal(bored.runtime_selection_authorized, false);
  assert.equal(bored.consumer_switch_authorized, false);
  assert.equal(bored.warrant.status, 'licensed');
  assert.equal(bored.projected_move.move_type, 'ask_discriminating_question');
  assert.equal(Object.hasOwn(bored.projected_move, 'register'), false);

  const defiant = createResistantProfileMoveShadow({
    profileId: 'frame_defiant',
    learnerText: 'I do not accept the premise of your test.',
    classification: classification({
      requestType: 'authority_refusal_or_status_challenge',
      discourseMove: 'challenge',
      agency: 'steering',
    }),
  });
  assert.equal(defiant.warrant.status, 'licensed');
  assert.equal(defiant.projected_move.move_type, 'test_bounded_distinction');
  assert.ok(defiant.projected_move.constraints.forbidden_moves.includes('acknowledge_affect_and_redirect'));

  const refuser = createResistantProfileMoveShadow({
    profileId: 'frame_refuser',
    learnerText: 'I reject the premise of your test, and I will not answer inside it.',
    classification: classification({
      requestType: 'authority_refusal_or_status_challenge',
      discourseMove: 'challenge',
      agency: 'steering',
    }),
  });
  assert.equal(refuser.observation.ambiguous, false);
  assert.equal(refuser.warrant.status, 'licensed');
  assert.equal(refuser.projected_move.move_type, 'test_bounded_distinction');

  const profileOnly = createResistantProfileMoveShadow({
    profileId: 'bored',
    learnerText: 'The assay mark links the tool to the coin.',
    classification: classification({ discourseMove: 'inference', evidenceUse: 'links_evidence_to_rule' }),
  });
  assert.equal(profileOnly.warrant.status, 'not_licensed');
  assert.equal(profileOnly.projected_move, null);

  const ambiguous = createResistantProfileMoveShadow({
    profileId: 'frame_defiant',
    learnerText: 'Whatever. I reject the premise of this exercise.',
    classification: classification(),
  });
  assert.equal(ambiguous.observation.ambiguous, true);
  assert.equal(ambiguous.warrant.status, 'not_licensed');
});

test('the action-before-register tracer is the only live resistant-warrant caller', () => {
  const importPattern = /from\s+['"][^'"]*resistantProfileWarrantShadow\.js['"]/u;
  const callers = [];
  const visit = (directory) => {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith('.js') && importPattern.test(fs.readFileSync(absolute, 'utf8'))) {
        callers.push(path.relative(ROOT, absolute));
      }
    }
  };
  ['services', 'scripts', 'routes'].forEach((root) => visit(path.join(ROOT, root)));
  assert.deepEqual(callers, ['services/tutorStubActionBeforeRegisterShadow.js']);
});
