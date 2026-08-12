#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { getAdaptiveWarrantActionContract } from '../services/adaptiveWarrantActionContracts.js';
import {
  ADAPTIVE_WARRANT_SEMANTIC_REQUEST_SPEECH_ACTS,
  adaptiveWarrantSemanticComponentIsLiteral,
  adaptiveWarrantSemanticValueTypeIsLiteral,
} from '../services/adaptiveWarrantSemanticEvents.js';
import {
  validateAdaptiveWarrantSemanticPreflightArtifact,
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult,
} from '../services/adaptiveWarrantSemanticPreflight.js';
import {
  ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
  adaptiveWarrantStudySourceFingerprint,
  annotationCaseFingerprint,
  mechanismAnnotationHandbook,
} from './run-adaptive-warrant-baseline-study.js';

export const ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA =
  'machinespirits.adaptation-refinement.v3-semantic-diagnostic-freeze.v1';
export const ADAPTIVE_WARRANT_V3_SEMANTIC_SUPPORT_PLAN_SCHEMA =
  'machinespirits.adaptation-refinement.v3-semantic-diagnostic-support-plan.v1';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIMENSIONS = Object.freeze([
  'conceptual',
  'interactional',
  'engagement',
  'pacing',
  'epistemic',
  'strategy_exhaustion',
]);
const REQUEST_SPEECH_ACTS = new Set(ADAPTIVE_WARRANT_SEMANTIC_REQUEST_SPEECH_ACTS);
export const ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_MINIMA = Object.freeze({
  result_request: 4,
  proposed_test: 4,
  target_value_partition: 4,
  record_entry_request: 2,
  tutor_selection_request: 2,
  obligation_persistence: 2,
  obligation_resolution: 2,
  inquiry_complete: 2,
  inquiry_incomplete: 6,
  ...Object.fromEntries(DIMENSIONS.map((dimension) => [`divergence_${dimension}_nonaligned`, 2])),
});

const TARGETS = Object.freeze({
  pier: target(
    't01',
    'record_entry',
    'quay-five shipping ledger',
    ['quay-five'],
    ['name', 'time'],
    ['courier_name', 'dispatch_time'],
    {
      allowedValueTypes: ['name', 'time', 'record_text'],
      allowedComponents: ['courier_name', 'dispatch_time', 'bounded_finding'],
    },
  ),
  gallery: target(
    't02',
    'record_entry',
    'salon-C attendance roll',
    ['salon-C'],
    ['date', 'name'],
    ['entry_date', 'attendant_name'],
    {
      allowedValueTypes: ['date', 'name', 'record_text'],
      allowedComponents: ['entry_date', 'attendant_name', 'bounded_finding'],
    },
  ),
  medallion: target(
    't03',
    'weight_or_ring_result',
    'balance slip for brooch R7',
    ['brooch R7'],
    ['weight'],
    ['recorded_mass'],
  ),
  fibre: target(
    't04',
    'material_or_assay_result',
    'public assay for thread K4',
    ['thread K4'],
    ['material'],
    ['identified_material'],
    {
      allowedValueTypes: ['material', 'record_text'],
      allowedComponents: ['identified_material', 'bounded_finding'],
    },
  ),
  stamp: target(
    't05',
    'comparison_result',
    'seal P and die nine comparison',
    ['seal P', 'die nine'],
    ['match_status'],
    ['match_status'],
  ),
  chime: target('t06', 'weight_or_ring_result', 'acoustic log for bell H', ['bell H'], ['sound'], ['logged_tone']),
  cart: target('t07', 'record_entry', 'trolley-six passage sheet', ['trolley-six'], ['time'], ['movement_time']),
  hinge: target(
    't08',
    'mark_or_tool_result',
    'blue-door latch photograph',
    ['blue-door'],
    ['match_status'],
    ['groove_match'],
  ),
  registerChoice: target(
    't09',
    'public_exhibit_result',
    'public ledger choices',
    ['public ledger choices'],
    ['other'],
    ['next_check'],
  ),
  assayChoice: target(
    't10',
    'public_exhibit_result',
    'public swatch choices',
    ['two public swatches'],
    ['other'],
    ['next_check'],
  ),
  archiveChoice: target(
    't11',
    'public_exhibit_result',
    'public index-check choices',
    ['public index checks'],
    ['other'],
    ['next_check'],
  ),
});

function stableId(prefix, label) {
  return `${prefix}-${sha256(String(label)).slice(0, 8)}`;
}

function target(
  targetId,
  kind,
  displayLabel,
  publicIdentifiers,
  requestedValueTypes,
  requiredComponents,
  { allowedValueTypes = requestedValueTypes, allowedComponents = requiredComponents } = {},
) {
  return {
    kind,
    target_id: targetId,
    display_label: displayLabel,
    public_identifier_ids: publicIdentifiers.map((label) => stableId('p', label)),
    public_identifier_labels: publicIdentifiers,
    requested_value_types: requestedValueTypes,
    component_ids: requiredComponents,
    allowed_value_types: allowedValueTypes,
    allowed_component_ids: allowedComponents,
  };
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function action(mode, executor, actionName, object) {
  return {
    mode,
    executor,
    action: actionName,
    action_object_id: stableId('a', object),
    action_object_display_label: object,
  };
}

function eventTarget(targetValue, { valueTypes = null, componentIds = null, span = '', requestMode = false } = {}) {
  if (!targetValue) return null;
  const candidateValueTypes = requestMode ? (valueTypes ?? targetValue.requested_value_types) : [];
  const candidateComponentIds = requestMode ? (componentIds ?? targetValue.component_ids) : [];
  return {
    kind: targetValue.kind,
    target_id: targetValue.target_id,
    public_identifier_ids: [...targetValue.public_identifier_ids],
    requested_value_types: candidateValueTypes.filter((valueType) =>
      adaptiveWarrantSemanticValueTypeIsLiteral(valueType, span),
    ),
    component_ids: candidateComponentIds.filter((componentId) =>
      adaptiveWarrantSemanticComponentIsLiteral(componentId, span),
    ),
  };
}

function eventAction(actionValue) {
  if (!actionValue) return null;
  const { action_object_display_label: displayLabel, ...typed } = actionValue;
  return { ...typed, action_object_display_label: displayLabel };
}

function event(
  speechAct,
  text,
  { target: targetValue = null, action: actionValue = null, span = text, valueTypes = null, componentIds = null } = {},
) {
  const start = text.indexOf(span);
  if (start < 0) throw new Error(`semantic diagnostic span is not literal: ${span}`);
  return {
    speaker: 'learner',
    speech_act: speechAct,
    target: eventTarget(targetValue, {
      valueTypes,
      componentIds,
      span,
      requestMode: REQUEST_SPEECH_ACTS.has(speechAct),
    }),
    requested_or_proposed_action: eventAction(actionValue),
    evidence_span: { text: span, start, end: start + span.length },
  };
}

function request(text, eventTarget, object, extra = {}) {
  return {
    text,
    events: [
      event('tutor_directed_public_result_request', text, {
        target: eventTarget,
        action: action('requested', 'tutor', 'supply_public_result', object),
      }),
    ],
    support: ['result_request', 'target_value_partition', 'inquiry_incomplete', ...(extra.support || [])],
    ...extra,
  };
}

function proposal(text, eventTarget, object, extra = {}) {
  return {
    text,
    events: [
      event('learner_proposed_test', text, {
        target: eventTarget,
        action: action('proposed', 'learner', 'perform_public_test', object),
      }),
    ],
    support: ['proposed_test', 'inquiry_incomplete', ...(extra.support || [])],
    ...extra,
  };
}

function diagnosticSpecs() {
  const specs = [
    request(
      'Give me the courier name and dispatch time from the quay-five shipping ledger.',
      TARGETS.pier,
      'quay-five courier and dispatch time',
      {
        transcript: [
          {
            turn: 1,
            learner: 'I still need the shipping details from the quay-five public ledger.',
            tutor: 'Let us first consider the customs diagram instead.',
          },
        ],
        support: ['obligation_persistence', 'divergence_interactional_nonaligned'],
      },
    ),
    request(
      'Report both the entry date and attendant in the salon-C attendance roll.',
      TARGETS.gallery,
      'salon-C entry values',
      {
        transcript: [
          {
            turn: 1,
            learner: 'What does the salon-C attendance roll list?',
            tutor: 'Before that, consider the reception programme.',
          },
        ],
        support: ['obligation_persistence', 'divergence_interactional_nonaligned'],
      },
    ),
    request('What mass is written on the balance slip for brooch R7?', TARGETS.medallion, 'brooch R7 mass'),
    request('Which material does the public K4 thread assay identify?', TARGETS.fibre, 'thread K4 material'),
    request('Does the public comparison show seal P matching die nine?', TARGETS.stamp, 'seal P match status'),
    request('Read the logged tone for bell H from the acoustic table.', TARGETS.chime, 'bell H logged sound'),
    proposal('I’ll inspect trolley-six’s movement time myself next.', TARGETS.cart, 'inspect trolley-six sheet', {
      transcript: [
        {
          turn: 1,
          learner: 'What time does the trolley-six passage sheet show?',
          tutor: 'The public trolley-six sheet records 15:40.',
        },
      ],
      support: ['obligation_resolution'],
    }),
    proposal(
      'I’ll compare the blue-door latch image with the reference ridges.',
      TARGETS.hinge,
      'compare blue-door latch ridges',
      {
        transcript: [
          {
            turn: 1,
            learner: 'What does the blue-door latch photograph show?',
            tutor: 'It publicly shows three angled ridges on the latch.',
          },
        ],
        support: ['obligation_resolution'],
      },
    ),
    proposal(
      'My next test is to reconstruct the sequence in the quay-five shipping ledger.',
      TARGETS.pier,
      'inspect quay-five sequence',
    ),
    proposal('I propose weighing brooch R7 against the archive standard.', TARGETS.medallion, 'weigh brooch R7'),
    proposal('I’ll set seal P beside die nine and compare them.', TARGETS.stamp, 'compare seal P'),
    proposal('I’ll check bell H against the published acoustic entry.', TARGETS.chime, 'compare bell H tone'),
  ];

  for (const [text, analyticSpan, requestSpan, eventTarget, object] of [
    [
      'The quay-five ledger establishes departure, not arrival; enter only that bounded finding.',
      'The quay-five ledger establishes departure, not arrival',
      'enter only that bounded finding',
      TARGETS.pier,
      'record departure not arrival',
    ],
    [
      'The K4 assay identifies wool but leaves its origin open; record that limited result.',
      'The K4 assay identifies wool but leaves its origin open',
      'record that limited result',
      TARGETS.fibre,
      'record bounded thread result',
    ],
  ]) {
    specs.push({
      text,
      events: [
        event('analytic_contribution', text, {
          target: eventTarget,
          valueTypes: [],
          componentIds: [],
          span: analyticSpan,
        }),
        event('learner_record_entry_request', text, {
          target: eventTarget,
          action: action('requested', 'tutor', 'record_public_claim', object),
          valueTypes: ['record_text'],
          componentIds: ['bounded_finding'],
          span: requestSpan,
        }),
      ],
      support: ['record_entry_request', 'inquiry_incomplete', 'divergence_epistemic_nonaligned'],
    });
  }

  const selectOne = 'Select which public ledger I should examine first.';
  specs.push({
    text: selectOne,
    events: [
      event('tutor_selection_request', selectOne, {
        target: TARGETS.registerChoice,
        action: action('requested', 'tutor', 'select_next_step', 'first public ledger'),
      }),
    ],
    support: ['tutor_selection_request', 'inquiry_incomplete', 'divergence_engagement_nonaligned'],
  });
  const selectTwo = 'I cannot choose between the two public swatches; select the next check for me.';
  specs.push({
    text: selectTwo,
    events: [
      event('low_agency_deferral', selectTwo, { span: 'I cannot choose between the two public swatches' }),
      event('tutor_selection_request', selectTwo, {
        target: TARGETS.assayChoice,
        action: action('requested', 'tutor', 'select_next_step', 'next swatch check'),
        span: 'select the next check for me',
      }),
    ],
    support: ['tutor_selection_request', 'inquiry_incomplete', 'divergence_engagement_nonaligned'],
  });

  const compoundA = 'I’ll inspect the trolley-six sheet myself; then give me its movement time.';
  specs.push({
    text: compoundA,
    events: [
      event('learner_proposed_test', compoundA, {
        target: TARGETS.cart,
        action: action('proposed', 'learner', 'perform_public_test', 'inspect trolley-six sheet'),
        span: 'I’ll inspect the trolley-six sheet myself',
      }),
      event('tutor_directed_public_result_request', compoundA, {
        target: TARGETS.cart,
        action: action('requested', 'tutor', 'supply_public_result', 'trolley-six movement time'),
        span: 'give me its movement time',
      }),
    ],
    support: ['result_request', 'proposed_test', 'target_value_partition', 'compound_act', 'inquiry_incomplete'],
  });
  const compoundB = 'I’ll compare seal P myself; afterward, report whether it matches die nine.';
  specs.push({
    text: compoundB,
    events: [
      event('learner_proposed_test', compoundB, {
        target: TARGETS.stamp,
        action: action('proposed', 'learner', 'perform_public_test', 'compare seal P'),
        span: 'I’ll compare seal P myself',
      }),
      event('tutor_directed_public_result_request', compoundB, {
        target: TARGETS.stamp,
        action: action('requested', 'tutor', 'supply_public_result', 'seal P match status'),
        span: 'report whether it matches die nine',
      }),
    ],
    support: ['result_request', 'proposed_test', 'target_value_partition', 'compound_act', 'inquiry_incomplete'],
  });

  const analytic = 'The salon-C roll establishes attendance but not exhibit handling; please record just that limit.';
  specs.push({
    text: analytic,
    events: [
      event('analytic_contribution', analytic, {
        target: TARGETS.gallery,
        valueTypes: [],
        componentIds: [],
        span: 'The salon-C roll establishes attendance but not exhibit handling',
      }),
      event('learner_record_entry_request', analytic, {
        target: TARGETS.gallery,
        action: action('requested', 'tutor', 'record_public_claim', 'record salon evidential limit'),
        valueTypes: ['record_text'],
        componentIds: ['bounded_finding'],
        span: 'please record just that limit',
      }),
    ],
    support: ['record_entry_request', 'analytic_permission_suffix', 'inquiry_incomplete'],
  });
  const defer = 'Choose the next public index check for me. I refuse to decide between the listed checks.';
  specs.push({
    text: defer,
    events: [
      event('tutor_selection_request', defer, {
        target: TARGETS.archiveChoice,
        action: action('requested', 'tutor', 'select_next_step', 'next index check'),
        span: 'Choose the next public index check for me',
      }),
      event('low_agency_deferral', defer, { span: 'I refuse to decide between the listed checks' }),
    ],
    support: ['tutor_selection_request', 'low_agency_deferral', 'divergence_engagement_nonaligned'],
  });

  for (const [text, eventTarget] of [
    ['Which visible feature would distinguish a copied seal from seal P?', TARGETS.stamp],
    ['What public record would connect the quay-five departure to later arrival?', TARGETS.pier],
  ]) {
    specs.push({
      text,
      events: [event('criterion_question', text, { target: eventTarget })],
      support: ['criterion_question', 'inquiry_incomplete', 'divergence_conceptual_nonaligned'],
    });
  }

  const repairText = 'Explain why a departure entry still falls short of proving arrival; I am missing that step.';
  specs.push({
    text: repairText,
    events: [
      event('repair_request', repairText, {
        action: action('requested', 'tutor', 'explain_wording', 'departure versus arrival distinction'),
      }),
    ],
    support: ['repair_request', 'inquiry_incomplete', 'divergence_conceptual_nonaligned'],
  });
  const stalledText = 'I have run out of approaches and cannot devise another public check.';
  specs.push({
    text: stalledText,
    events: [event('stall', stalledText)],
    support: [
      'stall',
      'inquiry_incomplete',
      'divergence_pacing_nonaligned',
      'divergence_strategy_exhaustion_nonaligned',
    ],
    contractDefeated: true,
  });

  // Two public frames are deliberately complete even though the speech acts
  // remain semantic-boundary probes. Decision readers, not construction tags,
  // determine whether closure follows.
  specs[12].complete = true;
  specs[18].complete = true;
  specs[12].support = specs[12].support.filter((name) => name !== 'inquiry_incomplete');
  specs[18].support = specs[18].support.filter((name) => name !== 'inquiry_incomplete');
  specs[10].support.push('divergence_strategy_exhaustion_nonaligned');
  specs[10].contractDefeated = true;
  specs[4].support.push('divergence_pacing_nonaligned');
  return specs;
}

function blankDivergence() {
  return Object.fromEntries(
    DIMENSIONS.map((dimension) => [
      dimension,
      { interpretation: null, magnitude: null, persistence: null, note: null },
    ]),
  );
}

function publicCase(spec, index) {
  const transcript = spec.transcript || [];
  const turn = transcript.length + 1;
  const total = spec.complete ? 6 : index % 3 === 0 ? 3 : 2;
  return {
    public_inquiry_brief: {
      opening_text: 'A public evidence inquiry compares records, exhibits, and bounded claims.',
      public_situation:
        'The tutor and learner must distinguish what each public record establishes from what remains unresolved.',
      public_question: 'What does the currently public evidence establish, and what public check remains?',
      opening_evidence: spec.complete
        ? ['The listed public exhibits are complete.', 'The release ledger states that no licensed evidence remains.']
        : ['The named records are public.', 'Additional licensed public evidence remains available.'],
      public_requirements: ['Use only public evidence.', 'Keep direct result requests visible until resolved.'],
    },
    transcript_before_decision: transcript,
    current_learner_turn: { turn, learner: spec.text },
    public_evidence_at_decision: spec.complete
      ? ['All named public exhibits are available.', 'No licensed public evidence remains.']
      : ['The named public target is available to inspect.', 'Further public evidence remains licensed.'],
    learner_record_at_decision: { grounded_count: total, voiced_derived_count: 0, total },
    learner_record_trajectory: [
      {
        turn: Math.max(1, turn - 1),
        grounded_count: Math.max(1, total - 1),
        voiced_derived_count: 0,
        total: Math.max(1, total - 1),
      },
      { turn, grounded_count: total, voiced_derived_count: 0, total },
    ],
    strategy_in_force: 'stage_next_step',
    prior_delivered_action_family: 'stage_next_step',
    pre_gate_proposed_action_family: spec.complete ? 'close_inquiry' : 'stage_next_step',
    public_evidence_availability: {
      known: true,
      authored_release_count: spec.complete ? 2 : 4,
      released_before_decision_count: spec.complete ? 2 : 2,
      due_now_count: 0,
      future_licensed_count: spec.complete ? 0 : 2,
      remaining_licensed_count: spec.complete ? 0 : 2,
      release_scope_exhausted: spec.complete,
    },
    normative_action_contract: getAdaptiveWarrantActionContract('stage_next_step'),
    normative_action_contract_instance: {
      started_turn: Math.max(1, turn - 1),
      response_count: spec.contractDefeated ? 2 : 1,
      from_family: null,
    },
    descriptive_evidence_at_decision: {
      dag_growth: spec.contractDefeated ? 0 : 1,
      turns_since_dag_growth: spec.contractDefeated ? 3 : 0,
      trouble_turns: spec.contractDefeated
        ? [
            { turn: Math.max(1, turn - 1), defeaters: ['expected_uptake_missing'] },
            { turn, defeaters: ['expected_uptake_missing'] },
          ]
        : [],
      complaint_turns: [],
      prior_tutor_outcome: null,
      pacing_signal: spec.support.includes('divergence_pacing_nonaligned')
        ? { direction: 'slower', strength: 0.9, source: 'public_turn' }
        : null,
      epistemic_checks: {
        strict_grounded_asserted: spec.complete,
        answer_entailed_unasserted: false,
        released_evidence_integrated: true,
        unsupported_assertion_count: spec.support.includes('divergence_epistemic_nonaligned') ? 1 : 0,
        active_dropped_fact_count: 0,
      },
    },
    speech_act: null,
    open_obligation_source_turns: null,
    obligation_state: null,
    inquiry_state: null,
    commitment_transition_warranted: null,
    current_candidate_override_required: null,
    primary_warrant_basis: null,
    revision_warranted: null,
    recommended_action_family: null,
    divergence_by_dimension: blankDivergence(),
    note: null,
  };
}

export function adaptiveWarrantSemanticReaderHandbook() {
  return `# Frozen V3 semantic-event reader handbook

Label only the current public learner utterance in its supplied public context.

## Mechanical fields

The harness knows the current speaker is learner. Do not return speaker. The harness derives target kind and public identifiers from target_id, action mode and operation from action_object_id, and event offsets/order from literal spans. Do not return or infer those mechanical fields.

## Event multiplicity

Return one event per independent clause-level act that would change a distinct typed state. Explanatory or politeness wording inside a clause is not another event. The compound licence is general: any separate clause stating an inference, evidential limit, request, proposal, complaint, or deferral receives its own event unless it is merely the grammatical complement of another event. A single clause otherwise receives one event under the precedence below. Separate events have distinct non-overlapping spans and are ordered by surface position. One request for several values is one event, except that one clause coordinating several catalogue targets receives one event per target using the smallest non-overlapping identifier-bearing spans; this is the sole waiver of the complete-clause rule.

A rhetorical question answered by the learner in the same turn creates no question event; annotate the answer clause. A conditional antecedent is never an event. A negated or deferred request is withdrawal only when the public transcript contains a matching prior request, otherwise it creates no event. Third-party reported speech is analytic; only a matrix-clause first-person commitment is a proposed test. Politeness is a modifier: a clause with its own imperative or performative verb remains an act.

Each reader event has speech_act, target, requested_or_proposed_action, and evidence_span. Every field is required and non-null. evidence_span is the literal span string; the harness supplies offsets. The closed speech-act vocabulary is tutor_directed_public_result_request, learner_proposed_test, criterion_question, tutor_selection_request, learner_record_entry_request, learner_wording_request, withdrawal, transfer_to_learner, repair_request, stall, register_complaint, repetition_complaint, low_agency_deferral, analytic_contribution, and other.

A result request asks the tutor to supply what a named public check, record, or comparison shows. A first-person declaration that the learner still needs a named public record is also a result request with tutor executor; without a public-record object it is analytic. A confirmation sayback of already-public content is analytic, and becomes a result request only when it asks for content not yet public. A proposed test is a new learner or joint plan. Transfer_to_learner instead explicitly takes responsibility for a previously tutor-owned or requested action. A criterion question asks what evidence would establish a link. A record-entry request asks to write an already-public bounded claim, not discover a missing result.

A tutor-selection request is the clause that asks or directs the tutor to choose an enumerated next step. A separate declarative clause saying the learner cannot, refuses to, or leaves that choice to the tutor is low_agency_deferral with target and action both state="none". When one clause contains both delegation and inability language, tutor_selection_request wins and no second event is added. Learner_wording_request asks for restatement or the meaning of words; repair_request asks why an evidential or inferential relation holds or names a missing reasoning step. Stall states inability to continue or propose a check; register_complaint criticises tone or style; repetition_complaint says content was repeated; analytic_contribution states an inference or evidential limit; other is reserved for a distinct state-changing act fitting none of those definitions.

Speech-act precedence within one clause is: repair request versus wording request under the distinction above; register complaint, repetition complaint, or stall under their distinct objects; withdrawal or transfer; tutor-selection request; low-agency deferral; result request; record-entry request; proposed test; criterion question; analytic contribution; other. Do not add a lower-precedence event for the same clause.

## Target fields

target_id identifies the public object, relation, or enumerated choice set under inquiry. Target is always a tagged object: return state="catalog" with target_id, requested_value_types, and component_ids, or return the sole field state="none" when the act itself names no catalogue entity. Never return null or omit target. A catalogue target is required for result requests, proposed tests, criterion questions, record-entry requests, and tutor-selection requests. For request acts whose words name no catalogue item, use the literal string "unspecified" for both target_id and action_object_id; "unspecified" is invalid on non-request acts and the empty string is always invalid. For tutor selection, choose the catalogue target naming the publicly enumerated choices, never the requested value or the tutor. Wording/repair, stall, complaint, and low-agency acts use target state="none". For analytic_contribution, withdrawal, transfer_to_learner, and other, the target belongs to that act itself: choose the catalogue entity its clause is about, independent of any accompanying event; use state="none" only when that clause names no catalogue entity.

An anaphoric target may resolve through the supplied public transcript to the most recently mentioned catalogue entity. Abstain with ambiguity_reason="referent" only on an equal-recency tie. Requested values are never targets or target kinds. The harness adds target kind and public identifiers from target_id.

## Action fields

requested_or_proposed_action is always a tagged object: return state="catalog" with executor and action_object_id, or the sole field state="none" when no action applies. Never return null or omit the field. Executor is the party who must perform the action, never the utterance speaker. For a request where the tutor is the only other party, use tutor. Use joint only when the span explicitly says we, our, or let's; use unspecified only for an explicitly impersonal or passive construction. A first-person singular proposal uses learner. The harness rejects any executor that does not follow this surface rule.

When several action objects share the required operation and target, choose the most specific one whose display-label content words all occur in the span; break a remaining tie lexicographically by action_object_id.

Use exact target_id, component_ids, and action_object_id values from the supplied corpus-wide semantic_annotation_catalog. Display labels explain IDs but never determine identity or agreement. The catalogue standardises public identities across readers; it does not identify which entry applies to any case. Choose only entries supported by current public text.

Return evidence_span as a string. Start with the shortest complete literal clause that supports the event. If it occurs more than once, extend it leftward by whole tokens until unique; if no unique literal span exists, abstain with ambiguity_reason="span". Spans do not overlap except for the coordinated-target waiver above. Do not calculate offsets.

Set genuinely_ambiguous=true only when two complete typed readings remain after every rule above; then return events=[] and one typed ambiguity_reason: speech_act, executor, target, action_object, multiplicity, referent, span, or context. Otherwise set genuinely_ambiguous=false and ambiguity_reason="none". Give every case a short case-specific public-evidence rationale. Do not see or infer model predictions, private support tags, downstream decisions, or another reader response.
`;
}

export function buildAdaptiveWarrantV3SemanticDiagnostic({ studyId } = {}) {
  const specs = diagnosticSpecs();
  if (specs.length !== 24) throw new Error(`V3 semantic diagnostic requires 24 cases, got ${specs.length}`);
  const paired = specs.map((spec, index) => {
    const row = publicCase(spec, index);
    const sampleId = `v3-semantic-${sha256(JSON.stringify({ studyId, index, row })).slice(0, 24)}`;
    row.sample_id = sampleId;
    return { row, spec, sampleId };
  });
  paired.sort((left, right) => left.sampleId.localeCompare(right.sampleId));
  const actionCatalogRows = [
    ...specs.flatMap((spec) =>
      spec.events
        .filter((eventRow) => eventRow.requested_or_proposed_action)
        .map((eventRow) => ({
          action: eventRow.requested_or_proposed_action,
          target_id: eventRow.target?.target_id || null,
        })),
    ),
    {
      action: eventAction(action('requested', 'tutor', 'explain_wording', 'explain public wording')),
      target_id: null,
    },
    {
      action: eventAction(action('requested', 'learner', 'withdraw_request', 'withdraw current request')),
      target_id: null,
    },
  ];
  const targetRows = Object.values(TARGETS);
  const publicIdentifierRows = targetRows.flatMap((entry) =>
    entry.public_identifier_ids.map((publicIdentifierId, index) => ({
      public_identifier_id: publicIdentifierId,
      display_label: entry.public_identifier_labels[index],
    })),
  );
  const semanticAnnotationCatalog = {
    schema: 'machinespirits.adaptation-refinement.semantic-event-reader-catalog.v3',
    targets: targetRows
      .map((entry) => ({
        target_id: entry.target_id,
        kind: entry.kind,
        public_identifier_ids: [...entry.public_identifier_ids],
        allowed_value_types: [...entry.allowed_value_types],
        component_ids: [...entry.allowed_component_ids],
        display_label: entry.display_label,
      }))
      .toSorted((left, right) => left.target_id.localeCompare(right.target_id)),
    public_identifiers: [
      ...new Map(publicIdentifierRows.map((entry) => [entry.public_identifier_id, entry])).values(),
    ].toSorted((left, right) => left.public_identifier_id.localeCompare(right.public_identifier_id)),
    components: [...new Set(targetRows.flatMap((entry) => entry.allowed_component_ids))]
      .sort()
      .map((componentId) => ({ component_id: componentId, display_label: componentId.replaceAll('_', ' ') })),
    action_objects: [
      ...new Map(
        actionCatalogRows.map(({ action: entry, target_id: targetId }) => [
          entry.action_object_id,
          {
            action_object_id: entry.action_object_id,
            mode: entry.mode,
            action: entry.action,
            target_id: targetId,
            display_label: entry.action_object_display_label,
          },
        ]),
      ).values(),
    ].toSorted((left, right) => left.action_object_id.localeCompare(right.action_object_id)),
  };
  const corpus = {
    schema: ADAPTIVE_WARRANT_ANNOTATION_SCHEMA,
    study_id: studyId,
    blinded: true,
    instructions:
      'This is a fresh diagnostic-only V3 public decision-time corpus. Extraction and decision readers work in separate contexts. Do not infer private construction strata or treat these rows as gate evidence.',
    allowed_recommended_action_families: [
      'clarify_term',
      'repair_explanation',
      'clarify_distinction',
      'stage_next_step',
      'answer_accountably',
      'compress_sayback',
      'reanchor_lived_stake',
      'reanchor_public_evidence',
      'ground_in_material',
      'challenge_resistance',
      'receive_vulnerability',
      'close_inquiry',
      'baseline_plain_response',
      'hold',
      'uncertain',
    ],
    sampling: {
      role: 'targeted_challenge',
      diagnostic_only: true,
      gate_eligible: false,
      total_cases: paired.length,
      natural_prevalence_estimation_forbidden: true,
    },
    semantic_annotation_catalog: semanticAnnotationCatalog,
    cases: paired.map(({ row }) => row),
  };
  const key = {
    schema: 'machinespirits.adaptation-refinement.v3-semantic-diagnostic-private-key.v1',
    study_id: studyId,
    cases: paired.map(({ sampleId, spec, row }) => ({
      sample_id: sampleId,
      source_fingerprint: annotationCaseFingerprint(row),
      expected_semantic_events: spec.events.map((eventRow) => ({
        ...eventRow,
        requested_or_proposed_action: eventRow.requested_or_proposed_action
          ? Object.fromEntries(
              Object.entries(eventRow.requested_or_proposed_action).filter(
                ([field]) => field !== 'action_object_display_label',
              ),
            )
          : null,
      })),
      construction_support: spec.support,
    })),
  };
  const supportNames = Object.keys(ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_MINIMA);
  const supportPlan = {
    schema: ADAPTIVE_WARRANT_V3_SEMANTIC_SUPPORT_PLAN_SCHEMA,
    study_id: studyId,
    corpus_sha256: null,
    strata: Object.fromEntries(
      supportNames.map((name) => [
        name,
        paired
          .filter(({ spec }) => (name === 'inquiry_complete' ? spec.complete : spec.support.includes(name)))
          .map(({ sampleId }) => sampleId),
      ]),
    ),
  };
  return { corpus, key, supportPlan, handbook: adaptiveWarrantSemanticReaderHandbook() };
}

export function writeAdaptiveWarrantV3SemanticDiagnostic({
  outputDir,
  excludedCorpusPaths = [],
  preflightPath,
  schemaAcceptancePath,
} = {}) {
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`V3 semantic diagnostic output is not empty: ${resolvedOutput}`);
  }
  if (!excludedCorpusPaths.length) throw new Error('V3 semantic diagnostic requires explicit prior-corpus exclusions');
  const provenance = adaptiveWarrantStudySourceFingerprint();
  if (provenance.gitStatus) throw new Error('V3 semantic diagnostic freeze requires a clean committed worktree');
  if (!/^[0-9a-f]{40}$/u.test(provenance.gitCommit || ''))
    throw new Error('V3 semantic diagnostic requires exact commit');
  if (!preflightPath) throw new Error('V3 semantic diagnostic requires a passing brittleness preflight');
  const resolvedPreflight = path.resolve(preflightPath);
  const preflight = readJson(resolvedPreflight);
  validateAdaptiveWarrantSemanticPreflightArtifact({
    artifact: preflight,
    expectedSourceCommit: provenance.gitCommit,
  });
  if (!schemaAcceptancePath) throw new Error('V3 semantic diagnostic requires a passing schema-acceptance ping');
  const resolvedSchemaAcceptance = path.resolve(schemaAcceptancePath);
  const schemaAcceptance = readJson(resolvedSchemaAcceptance);
  validateAdaptiveWarrantSemanticSchemaAcceptanceResult({
    artifact: schemaAcceptance,
    expectedSourceCommit: provenance.gitCommit,
    expectedPreflightSha256: fileSha256(resolvedPreflight),
  });
  fs.mkdirSync(resolvedOutput, { recursive: true });
  const studyId = `adaptive-warrant-v3-semantic-diagnostic-${provenance.gitCommit.slice(0, 12)}`;
  const built = buildAdaptiveWarrantV3SemanticDiagnostic({ studyId });
  const handbookPath = path.join(resolvedOutput, 'semantic-event-reader-handbook.md');
  fs.writeFileSync(handbookPath, built.handbook);
  const decisionHandbookPath = path.join(resolvedOutput, 'decision-reader-handbook.md');
  fs.writeFileSync(decisionHandbookPath, mechanismAnnotationHandbook());
  const corpusPath = path.join(resolvedOutput, 'annotation-sample.blinded.json');
  writeJson(corpusPath, built.corpus);
  const keyPath = path.join(resolvedOutput, 'semantic-key.private.json');
  writeJson(keyPath, built.key);
  built.supportPlan.corpus_sha256 = fileSha256(corpusPath);
  const supportPath = path.join(resolvedOutput, 'diagnostic-support-plan.private.json');
  writeJson(supportPath, built.supportPlan);
  const currentFingerprints = new Set(built.corpus.cases.map(annotationCaseFingerprint));
  const excluded = excludedCorpusPaths.map((filePath) => {
    const resolved = path.resolve(filePath);
    const prior = readJson(resolved);
    const overlap = (prior.cases || []).filter((row) => currentFingerprints.has(annotationCaseFingerprint(row)));
    if (overlap.length) throw new Error(`V3 semantic diagnostic overlaps ${overlap.length} cases in ${resolved}`);
    return { path: resolved, sha256: fileSha256(resolved), overlap_count: 0 };
  });
  const designPath = path.join(ROOT, 'docs/adaptation-refinement/v3-semantic-extraction-design.md');
  const manifest = {
    schema: ADAPTIVE_WARRANT_V3_SEMANTIC_DIAGNOSTIC_FREEZE_SCHEMA,
    status: 'frozen',
    study_id: studyId,
    corpus_role: 'targeted_challenge',
    inferential_role: 'diagnostic_only',
    gate_eligible: false,
    frozen_at: new Date().toISOString(),
    source_commit: provenance.gitCommit,
    design: { path: designPath, sha256: fileSha256(designPath) },
    corpus: { path: corpusPath, sha256: fileSha256(corpusPath), cases: built.corpus.cases.length },
    handbook: { path: handbookPath, sha256: fileSha256(handbookPath) },
    decision_handbook: { path: decisionHandbookPath, sha256: fileSha256(decisionHandbookPath) },
    private_key: { path: keyPath, sha256: fileSha256(keyPath) },
    private_support_plan: { path: supportPath, sha256: fileSha256(supportPath) },
    zero_overlap: { excluded_corpora: excluded, verified_overlap_count: 0 },
    brittleness_preflight: {
      path: resolvedPreflight,
      sha256: fileSha256(resolvedPreflight),
      status: preflight.status,
      source_commit: preflight.bindings.source_commit,
      bindings_digest: sha256(JSON.stringify(preflight.bindings)),
    },
    schema_acceptance_ping: {
      path: resolvedSchemaAcceptance,
      sha256: fileSha256(resolvedSchemaAcceptance),
      status: schemaAcceptance.status,
      source_commit: provenance.gitCommit,
      preflight_sha256: fileSha256(resolvedPreflight),
    },
    provenance,
  };
  const manifestPath = path.join(resolvedOutput, 'diagnostic-freeze-manifest.json');
  writeJson(manifestPath, manifest);
  return {
    ...built,
    manifest,
    manifestPath,
    corpusPath,
    handbookPath,
    decisionHandbookPath,
    keyPath,
    supportPath,
  };
}

function usage() {
  return 'Usage: node scripts/build-adaptive-warrant-v3-semantic-diagnostic.js --out <empty-dir> --preflight <passing-artifact> --schema-acceptance <passing-result> --exclude-corpus <prior-corpus> [--exclude-corpus <prior-corpus> ...]\n';
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      preflight: { type: 'string' },
      'schema-acceptance': { type: 'string' },
      'exclude-corpus': { type: 'string', multiple: true, default: [] },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
  });
  if (values.help) {
    process.stdout.write(usage());
    return;
  }
  if (!values.out) throw new Error(`--out is required\n${usage()}`);
  const result = writeAdaptiveWarrantV3SemanticDiagnostic({
    outputDir: values.out,
    excludedCorpusPaths: values['exclude-corpus'],
    preflightPath: values.preflight,
    schemaAcceptancePath: values['schema-acceptance'],
  });
  process.stdout.write(`${result.manifestPath}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try {
    main();
  } catch (error) {
    console.error(`[v3-semantic-diagnostic] error: ${error.message}`);
    process.exitCode = 1;
  }
}
