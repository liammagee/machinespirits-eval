import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA,
  TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA,
  auditTutorStubTurnProgression,
  compileTutorStubTurnProgressionContract,
  deterministicTutorStubTurnProgressionHandoff,
  tutorStubLearnerRequestsWritableEntry,
  tutorStubTurnProgressionContractPrompt,
} from '../services/tutorStubTurnProgressionContract.js';
import { buildTutorStubWorldScaffold } from '../services/tutorStubWorldScaffold.js';

function composition({
  uptake = 'Your distinction keeps the seal separate from its custody.',
  entry = 'I hold the seal beside the custody sheet.',
  response = 'The mark identifies the seal while the sheet leaves custody open.',
  handoff = 'The next check must connect the blue seal to its custody chain.',
} = {}) {
  return {
    slots: {
      uptake,
      performance: { entry, response },
      handoff,
    },
  };
}

test('a writable-entry turn compiles a declarative handoff on the learner requested relation', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I record about the blue seal and its custody chain?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks how the blue seal relates to its custody chain.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  assert.equal(contract.schema, TUTOR_STUB_TURN_PROGRESSION_CONTRACT_SCHEMA);
  assert.equal(contract.complete, true);
  assert.equal(contract.learner_uptake.mode, 'writable_entry');
  assert.equal(contract.handoff_contract.mode, 'declarative_missing_support');
  assert.equal(contract.handoff_contract.question_allowed, false);
  assert.equal(contract.handoff_contract.question_required, false);
  assert.deepEqual(contract.turn_focus_contract.primary_groups.map((row) => row.terms), [
    ['blue', 'seal'],
    ['custody', 'chain'],
  ]);
  assert.match(tutorStubTurnProgressionContractPrompt(contract), /Keep the learner’s requested focus primary/iu);

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The blue seal is identified, but its custody chain remains unproved.”',
    }),
  });
  assert.equal(accepted.schema, TUTOR_STUB_TURN_PROGRESSION_AUDIT_SCHEMA);
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The blue seal is identified, but its custody chain remains unproved.”',
      response: 'The ink pattern gives us another clue.',
      handoff: 'What does the ink pattern show?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract'));
  assert.ok(rejected.issues.some((issue) => issue.type === 'handoff_loses_turn_focus'));
});

test('a resolved point gives the only new question to the final handoff', () => {
  const due = 'The second dispatch closes the south bridge after dusk.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'No, the first dispatch already closes the north bridge.',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner correctly closes the north route.' },
      conversational_completion: {
        resolved: true,
        sourceTutorQuestion: 'Does the first dispatch leave the north bridge open?',
        acceptedMeaning: 'The first dispatch closes the north bridge.',
      },
      due_evidence_surfaces: [due],
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'stage_next_step',
    tactic: 'shared_scene_invitation',
  });

  assert.equal(contract.handoff_contract.mode, 'new_unresolved_check');
  assert.equal(contract.handoff_contract.question_allowed, true);
  assert.equal(contract.handoff_contract.question_required, true);
  assert.equal(contract.handoff_contract.question_owner, 'handoff');
  assert.deepEqual(contract.handoff_contract.prohibited_settled_surfaces, [
    'Does the first dispatch leave the north bridge open?',
    'The first dispatch closes the north bridge.',
  ]);

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Right—the first dispatch closes the north bridge.',
      entry: 'I set the second dispatch beside it.',
      response: 'With that answered, the second dispatch now closes the south bridge after dusk.',
      handoff: 'What does the second dispatch change about the south bridge after dusk?',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Right—the first dispatch closes the north bridge.',
      response: 'Does that mean the first dispatch closes the north bridge?',
      handoff: 'What does the second dispatch change about the south bridge?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'question_in_non_owner_slot'));
  assert.ok(rejected.issues.some((issue) => issue.type === 'settled_point_requestioned'));
});

test('a neighbouring due relation needs an explicit bridge back to the learner question', () => {
  const due = 'The courier seal appears beside the unsigned dispatch.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Who signed the dispatch?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks who signed the dispatch.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: { relationship: 'sibling' },
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, true);
  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who signed the dispatch.',
      entry: 'I turn the unsigned dispatch toward us.',
      response: 'Before we answer who signed it, the courier seal gives us a narrower link.',
      handoff: 'What does the courier seal beside the unsigned dispatch establish?',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who signed the dispatch.',
      entry: 'I turn the unsigned dispatch toward us.',
      response: 'The courier seal gives us another clue.',
      handoff: 'What does the courier seal establish?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'sibling_relation_without_explicit_bridge'));
});

test('a detailed due clue containing the learner focus is not misclassified as a sibling relation', () => {
  const due =
    'The depot’s new chargers were dark throughout the stocktake while Tallow Street still browned out.';
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I write next about the depot’s new chargers?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks what to record about the depot’s new chargers.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: { relationship: 'direct' },
    },
    dramaticReleaseFrame: { active: true, entries: [{ surface: due }] },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  assert.deepEqual(contract.turn_focus_contract.primary_terms, ['depot', 'new', 'charger']);
  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
  assert.doesNotMatch(contract.handoff_contract.instruction, /connect SOURCE/iu);
});

test('the focus audit distinguishes a requested relation from a sibling relation', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Who assembled the sample?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks who assembled the sample.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'clarify_distinction',
    tactic: 'unadorned_report',
  });

  const accepted = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who assembled the sample.',
      handoff: 'Which public mark could connect the assembled sample to a person?',
    }),
  });
  assert.equal(accepted.ok, true, JSON.stringify(accepted.issues));

  const rejected = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'You are asking who assembled the sample.',
      handoff: 'Which mark identifies who inspected it?',
    }),
  });
  assert.equal(rejected.ok, false);
  assert.ok(rejected.issues.some((issue) => issue.type === 'handoff_loses_turn_focus'));
});

test('closure and accountable answers cannot acquire a shared-scene question', () => {
  for (const input of [
    { dialogueClosureFrame: { mandatory: true }, actionFamily: 'close_inquiry', expected: 'closure' },
    { dialogueClosureFrame: { mandatory: false }, actionFamily: 'answer_accountably', expected: 'declarative_current_limit' },
  ]) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: 'The measured result settles the comparison.',
      responseCompositionFrame: {
        learner_move: { summary: 'The learner settles the measured comparison.' },
        conversational_completion: { resolved: false },
      },
      dialogueClosureFrame: input.dialogueClosureFrame,
      actionFamily: input.actionFamily,
      tactic: 'shared_scene_invitation',
    });
    assert.equal(contract.handoff_contract.mode, input.expected);
    assert.equal(contract.handoff_contract.question_allowed, false);
  }
});

test('generic praise does not satisfy typed learner uptake', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'The blue seal identifies the packet, not its keeper.',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner separates packet identity from custody.' },
      conversational_completion: { resolved: false },
    },
    actionFamily: 'ground_in_material',
    tactic: 'unadorned_report',
  });
  const audit = auditTutorStubTurnProgression({
    contract,
    composition: composition({ uptake: 'Good.', handoff: 'The blue seal still does not identify the keeper.' }),
  });
  assert.equal(audit.ok, false);
  assert.ok(audit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));

  for (const uptake of ['That moves us forward.', 'Your objection is noted.', 'Right.']) {
    const genericAudit = auditTutorStubTurnProgression({
      contract,
      composition: composition({ uptake, handoff: 'The blue seal still does not identify the keeper.' }),
    });
    assert.equal(genericAudit.ok, false, uptake);
    assert.ok(genericAudit.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
  }
});

test('frozen structured uptake accepts substantive semantic linkage across worlds, not generic or unrelated assent', () => {
  const fixtures = [
    {
      learnerText: 'The blue seal identifies the packet, not its keeper.',
      summary: 'The learner separates packet identity from custody.',
      linked: 'The seal identifies the packet while custody remains unresolved.',
      unrelated: 'The lunchbox ledger remains unresolved.',
      handoff: 'The blue seal still does not identify the keeper.',
    },
    {
      learnerText: 'The lunchbox ledger proves recovery, not who moved it.',
      summary: 'The learner separates recovery from who moved the lunchbox.',
      linked: 'The ledger establishes recovery while the mover remains unknown.',
      unrelated: 'The blue seal still leaves custody open.',
      handoff: 'The lunchbox ledger still does not identify who moved it.',
    },
  ];

  for (const fixture of fixtures) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: fixture.learnerText,
      responseCompositionFrame: {
        learner_move: { summary: fixture.summary },
        conversational_completion: { resolved: false },
      },
      actionFamily: 'ground_in_material',
      tactic: 'unadorned_report',
    });
    const linked = auditTutorStubTurnProgression({
      contract,
      composition: composition({ uptake: fixture.linked, handoff: fixture.handoff }),
    });
    assert.equal(linked.ok, true, `${fixture.linked}: ${JSON.stringify(linked.issues)}`);
    assert.equal(linked.learner_uptake.visible, true);

    for (const uptake of ['Good.', fixture.unrelated]) {
      const rejected = auditTutorStubTurnProgression({
        contract,
        composition: composition({ uptake, handoff: fixture.handoff }),
      });
      assert.equal(rejected.ok, false, uptake);
      assert.ok(rejected.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
    }
  }
});

test('a typed Marrick rule link does not falsely classify the due premise as a sibling relation', () => {
  const due =
    "The leat-keeper's book is exact. Since the forge was shut, one hand alone has drawn the weir crucible and signed for its charcoal: Edony.";
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'What should I write next about whose hand cast the blanks at the weir-forge?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks whose hand cast the blanks at the weir-forge.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [due],
      public_focus_mapping: {
        source: 'world_scaffold_rule',
        rule_id: 'R2',
        premise_id: 'p_caster',
        evidence_predicate: 'soleCasterAt',
        input_predicates: ['blankFrom', 'soleCasterAt'],
        conclusion_predicates: ['castBlankFor'],
      },
    },
    dramaticReleaseFrame: {
      active: true,
      entries: [{ premise: 'p_caster', fact: ['soleCasterAt', 'weirCrucible', 'edony'], surface: due }],
    },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.turn_focus_contract.relation_kind, 'direct');
  assert.equal(contract.turn_focus_contract.relation_basis, 'typed_world_rule');
  assert.equal(contract.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
  assert.doesNotMatch(contract.handoff_contract.instruction, /connect SOURCE/iu);
});

test('the public world scaffold exposes a typed rule relation for progression', () => {
  const evidence = {
    premise: 'p_caster',
    fact: ['soleCasterAt', 'weirCrucible', 'edony'],
    surface: 'The charcoal book names Edony as the sole caster at the weir crucible.',
  };
  const scaffold = buildTutorStubWorldScaffold({
    world: {
      title: 'The Light Shillings',
      question: 'Whose hand cast the blanks?',
      questionPattern: ['castBlankFor', '?coin', '?person'],
      rules: [
        {
          id: 'R2',
          if: [
            ['blankFrom', '?coin', '?crucible'],
            ['soleCasterAt', '?crucible', '?person'],
          ],
          then: [['castBlankFor', '?coin', '?person']],
          gloss: 'A blank from a crucible was cast by that crucible’s sole caster.',
        },
      ],
    },
    evidence,
  });

  assert.deepEqual(scaffold.publicRelationMap, {
    source: 'world_scaffold_rule',
    rule_id: 'R2',
    evidence_predicate: 'soleCasterAt',
    premise_id: 'p_caster',
    input_predicates: ['blankFrom', 'soleCasterAt'],
    conclusion_predicates: ['castBlankFor'],
    relationship: null,
    authored_focus_surface: '',
  });
});

test('typed rule matching requires the whole multi-term relation across worlds', () => {
  const due = 'The dispatch seal identifies the noon clerk.';
  const release = {
    active: true,
    entries: [{ premise: 'p_seal', fact: ['sealKeeper', 'dispatchSeal', 'noonClerk'], surface: due }],
  };
  const mapping = (conclusionPredicate) => ({
    source: 'world_scaffold_rule',
    rule_id: 'R_dispatch',
    premise_id: 'p_seal',
    evidence_predicate: 'sealKeeper',
    input_predicates: ['sealKeeper'],
    conclusion_predicates: [conclusionPredicate],
  });
  const compile = (conclusionPredicate) =>
    compileTutorStubTurnProgressionContract({
      learnerText: 'Who signed the dispatch?',
      responseCompositionFrame: {
        learner_move: { summary: 'The learner asks who signed the dispatch.' },
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [due],
        public_focus_mapping: mapping(conclusionPredicate),
      },
      dramaticReleaseFrame: release,
      actionFamily: 'stage_next_step',
      tactic: 'unadorned_report',
    });

  const direct = compile('signedDispatchBy');
  assert.equal(direct.turn_focus_contract.relation_kind, 'direct');
  assert.equal(direct.turn_focus_contract.relation_basis, 'typed_world_rule');

  const crossWorldCollision = compile('signedPermitBy');
  assert.equal(crossWorldCollision.turn_focus_contract.relation_kind, 'unmapped');
  assert.equal(crossWorldCollision.turn_focus_contract.relation_basis, 'typed_world_rule_ambiguous');
  assert.equal(crossWorldCollision.turn_focus_contract.sibling_relation_requires_explicit_bridge, false);
});

test('authored public focus relationship overrides ambiguous predicate vocabulary', () => {
  const evidence = {
    premise: 'p_seal',
    fact: ['sealKeeper', 'dispatchSeal', 'noonClerk'],
    surface: 'The dispatch seal identifies the noon clerk.',
  };
  const scaffold = buildTutorStubWorldScaffold({
    world: {
      title: 'The Noon Dispatch',
      question: 'Who signed the dispatch?',
      rules: [
        {
          id: 'R_dispatch',
          public_focus: {
            relationship: 'direct',
            surface: 'which person signed the dispatch',
          },
          if: [['sealKeeper', '?seal', '?person']],
          then: [['authoredBy', '?dispatch', '?person']],
          gloss: 'The keeper of this seal signed this dispatch.',
        },
      ],
    },
    evidence,
  });
  assert.equal(scaffold.publicRelationMap.relationship, 'direct');
  assert.equal(scaffold.publicRelationMap.authored_focus_surface, 'which person signed the dispatch');

  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'Who signed the dispatch?',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks who signed the dispatch.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [evidence.surface],
      public_focus_mapping: scaffold.publicRelationMap,
    },
    dramaticReleaseFrame: { active: true, entries: [evidence] },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });
  assert.equal(contract.turn_focus_contract.relation_kind, 'direct');
  assert.equal(contract.turn_focus_contract.relation_basis, 'explicit_public_focus_mapping');
});

test('new unresolved check permits a declarative handoff when its question is optional', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'The blue seal may belong to another packet.',
    responseCompositionFrame: {
      learner_move: { summary: 'The learner keeps ownership of the blue seal open.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'clarify_distinction',
    tactic: 'unadorned_report',
  });

  assert.equal(contract.handoff_contract.mode, 'new_unresolved_check');
  assert.equal(contract.handoff_contract.question_allowed, true);
  assert.equal(contract.handoff_contract.question_required, false);
  assert.match(contract.handoff_contract.instruction, /may ask one final question/iu);
  assert.doesNotMatch(contract.handoff_contract.instruction, /alone asks/iu);

  const audit = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Right—the blue seal may belong to another packet.',
      handoff: 'The blue seal may still belong to another packet.',
    }),
  });
  assert.equal(audit.ok, true, JSON.stringify(audit.issues));
});

test('elliptical confusion and affect use typed semantic focus while retaining the raw learner surface', () => {
  const fixtures = [
    {
      learnerText: 'dunno',
      move: {
        summary: 'The learner is unsure what the visitor badge log establishes.',
        epistemic_stance: 'uncertain',
        pedagogical_need: 'Reanchor the visitor badge log in plain language.',
      },
      expectedSource: 'learner_move_summary',
      expectedTerms: ['unsure', 'visitor', 'badge', 'log', 'establish'],
      uptake: 'Fair—the visitor badge log still leaves what it establishes open.',
      handoff: 'The visitor badge log still leaves what it establishes open.',
    },
    {
      learnerText: 'sorry what',
      move: {
        summary: null,
        request_type: 'clarification',
        pedagogical_need: 'Explain the visitor badge log in plain language.',
      },
      expectedSource: 'pedagogical_need',
      expectedTerms: ['explain', 'visitor', 'badge', 'log', 'plain', 'language'],
      uptake: 'Fair—the visitor badge log needs plain language.',
      handoff: 'The visitor badge log is now in plain language.',
    },
    {
      learnerText: 'move it along',
      move: {
        summary: 'The learner asks to accelerate the clue pace.',
        affect: 'bored',
        pedagogical_need: 'Increase the release pace.',
      },
      expectedSource: 'learner_move_summary',
      expectedTerms: ['accelerate', 'clue', 'pace'],
      uptake: 'Fair—we will accelerate the clue pace.',
      handoff: 'The clue pace accelerates now.',
    },
    {
      learnerText: 'no',
      move: { summary: 'The learner gives an elliptical answer.' },
      completion: {
        resolved: true,
        sourceTutorQuestion: 'Does the first dispatch leave the north bridge open?',
        acceptedMeaning: 'The first dispatch closes the north bridge.',
      },
      expectedSource: 'conversational_completion',
      expectedTerms: ['first', 'dispatch', 'clos', 'north', 'bridge'],
      uptake: 'Right—the first dispatch closes the north bridge.',
      handoff: 'The first dispatch closes the north bridge.',
    },
  ];

  for (const fixture of fixtures) {
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: fixture.learnerText,
      responseCompositionFrame: {
        learner_move: fixture.move,
        conversational_completion: fixture.completion || { resolved: false },
        due_evidence_surfaces: [],
      },
      actionFamily: 'reanchor_public_evidence',
      tactic: 'rapid_handoff',
    });
    assert.equal(contract.turn_focus_contract.raw_learner_surface, fixture.learnerText);
    assert.equal(contract.learner_uptake.learner_surface, fixture.learnerText);
    assert.equal(contract.turn_focus_contract.primary_source, fixture.expectedSource);
    assert.deepEqual(contract.turn_focus_contract.primary_terms, fixture.expectedTerms);
    assert.notEqual(contract.turn_focus_contract.primary_surface, fixture.learnerText);

    const audit = auditTutorStubTurnProgression({
      contract,
      composition: composition({ uptake: fixture.uptake, handoff: fixture.handoff }),
    });
    assert.equal(audit.ok, true, `${fixture.learnerText}: ${JSON.stringify(audit.issues)}`);
  }
});

test('rapid handoff cannot take a question owned or forbidden by the handoff contract', () => {
  const cases = [
    {
      learnerText: 'Can you answer what the visitor code means?',
      questionSupport: { responsiveRepairRequired: true },
      expectedMode: 'direct_answer',
    },
    {
      learnerText: 'The evidence settles the finding.',
      dialogueClosureFrame: { mandatory: true },
      expectedMode: 'closure',
    },
    {
      learnerText: 'What should I put in the minutes about the visitor code?',
      expectedMode: 'declarative_missing_support',
    },
  ];

  for (const fixture of cases) {
    const contract = compileTutorStubTurnProgressionContract({
      ...fixture,
      responseCompositionFrame: {
        learner_move: { summary: 'The learner keeps the visitor code in view.' },
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [],
      },
      actionFamily: 'stage_next_step',
      tactic: 'rapid_handoff',
    });
    assert.equal(contract.handoff_contract.mode, fixture.expectedMode);
    assert.equal(contract.handoff_contract.question_allowed, false);

    const audit = auditTutorStubTurnProgression({
      contract,
      composition: composition({
        uptake: tutorStubLearnerRequestsWritableEntry(fixture.learnerText)
          ? 'Write: “The visitor code remains unproved.”'
          : 'Fair—the visitor code remains open.',
        response: 'What does the visitor code show?',
        handoff: 'The visitor code remains open.',
      }),
    });
    assert.equal(audit.ok, false);
    assert.ok(audit.issues.some((issue) => issue.type === 'question_forbidden_by_handoff_contract'));
  }
});

test('typed writable requests include adding a fact to a public record without licensing ordinary echoes', () => {
  const learner = 'What should I put in the minutes about the chargers being dark during the stocktake?';
  assert.equal(tutorStubLearnerRequestsWritableEntry(learner), true);
  assert.equal(tutorStubLearnerRequestsWritableEntry('The chargers were dark during the stocktake.'), false);

  const contract = compileTutorStubTurnProgressionContract({
    learnerText: learner,
    responseCompositionFrame: {
      learner_move: { summary: 'The learner asks how to record the chargers being dark during the stocktake.' },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    actionFamily: 'stage_next_step',
    tactic: 'unadorned_report',
  });
  assert.equal(contract.learner_uptake.mode, 'writable_entry');
  assert.deepEqual(contract.turn_focus_contract.primary_terms, ['charger', 'being', 'dark', 'during', 'stocktake']);

  const directEntry = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'Write: “The chargers were dark during the stocktake, so they did not cause that dip.”',
      handoff: 'The next check must keep the dark chargers and stocktake timing together.',
    }),
  });
  assert.equal(directEntry.ok, true, JSON.stringify(directEntry.issues));

  const ordinaryEcho = auditTutorStubTurnProgression({
    contract,
    composition: composition({
      uptake: 'The chargers were dark during the stocktake.',
      handoff: 'The next check must keep the dark chargers and stocktake timing together.',
    }),
  });
  assert.equal(ordinaryEcho.ok, false);
  assert.ok(ordinaryEcho.issues.some((issue) => issue.type === 'learner_uptake_not_realized'));
});

test('typed writable requests include ordinary modal inversion but exclude declarative record echoes', () => {
  for (const learner of [
    'Can I put that in the minutes?',
    'Should I add that to the record?',
    'Could I enter this in the ledger?',
    'May I write that in the trial-book?',
  ]) {
    assert.equal(tutorStubLearnerRequestsWritableEntry(learner), true, learner);
    const contract = compileTutorStubTurnProgressionContract({
      learnerText: learner,
      responseCompositionFrame: {
        learner_move: { summary: 'The learner asks whether to add the current point to the public record.' },
        conversational_completion: { resolved: false },
        due_evidence_surfaces: [],
      },
      actionFamily: 'answer_accountably',
      tactic: 'unadorned_report',
    });
    assert.equal(contract.learner_uptake.mode, 'writable_entry', learner);
  }

  for (const echo of [
    'I can put that in the minutes.',
    'I should add that to the record.',
    'That was added to the record.',
    'The minutes include that point.',
  ]) {
    assert.equal(tutorStubLearnerRequestsWritableEntry(echo), false, echo);
  }
});

test('deterministic V1 recovery makes a bounded pacing choice declarative when questions are forbidden', () => {
  const contract = compileTutorStubTurnProgressionContract({
    learnerText: 'I have no idea. Slow down.',
    responseCompositionFrame: {
      learner_move: {
        summary: 'Learner is confused and explicitly asks for slower pacing.',
        affect: 'overwhelmed',
        pedagogical_need: 'Slow down and offer one concrete starting point.',
      },
      conversational_completion: { resolved: false },
      due_evidence_surfaces: [],
    },
    questionSupport: {
      answerability: 'direction_only_until_evidence_is_public',
      responsiveRepairRequired: false,
    },
  });
  assert.equal(contract.handoff_contract.question_allowed, false);
  const handoff = deterministicTutorStubTurnProgressionHandoff({
    contract,
    support: {
      modality: 'bounded_directional_choice',
      clarificationInvitationRequired: true,
    },
    defaultQuestion: 'What would you like to inspect?',
    publicObject: 'incident log',
  });
  assert.doesNotMatch(handoff, /\?/u);
  assert.match(handoff, /slow the pace/iu);
  assert.match(handoff, /either begin with the incident log, or ask me to unpack/iu);
});
