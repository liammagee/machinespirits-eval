#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { getAdaptiveWarrantActionContract } from '../services/adaptiveWarrantActionContracts.js';
import { validateAdaptiveWarrantSemanticPreflightArtifact } from '../services/adaptiveWarrantSemanticPreflight.js';
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
    'target-pier-four-dispatch-register',
    'record_entry',
    'pier-four dispatch register',
    ['pier-four'],
    ['name', 'time'],
    ['courier_name', 'dispatch_time'],
    {
      allowedValueTypes: ['name', 'time', 'record_text'],
      allowedComponents: ['courier_name', 'dispatch_time', 'bounded_finding'],
    },
  ),
  gallery: target(
    'target-gallery-b-entry-register',
    'record_entry',
    'gallery-B entry register',
    ['gallery-B'],
    ['date', 'name'],
    ['entry_date', 'attendant_name'],
    {
      allowedValueTypes: ['date', 'name', 'record_text'],
      allowedComponents: ['entry_date', 'attendant_name', 'bounded_finding'],
    },
  ),
  medallion: target(
    'target-medallion-m8-balance-note',
    'weight_or_ring_result',
    'balance note for medallion M8',
    ['medallion M8'],
    ['weight'],
    ['recorded_mass'],
  ),
  fibre: target(
    'target-fibre-v2-public-assay',
    'material_or_assay_result',
    'public assay for fibre V2',
    ['fibre V2'],
    ['material'],
    ['identified_fibre'],
    {
      allowedValueTypes: ['material', 'record_text'],
      allowedComponents: ['identified_fibre', 'bounded_finding'],
    },
  ),
  stamp: target(
    'target-stamp-l-die-six-comparison',
    'comparison_result',
    'stamp L and die six comparison',
    ['stamp L', 'die six'],
    ['match_status'],
    ['match_status'],
  ),
  chime: target(
    'target-chime-j-acoustic-log',
    'weight_or_ring_result',
    'acoustic log for chime J',
    ['chime J'],
    ['sound'],
    ['logged_tone'],
  ),
  cart: target(
    'target-cart-three-movement-sheet',
    'record_entry',
    'cart-three movement sheet',
    ['cart-three'],
    ['time'],
    ['movement_time'],
  ),
  hinge: target(
    'target-green-gate-hinge-photograph',
    'mark_or_tool_result',
    'green-gate hinge photograph',
    ['green-gate'],
    ['match_status'],
    ['groove_match'],
  ),
  registerChoice: target(
    'target-public-register-choice-set',
    'public_exhibit_result',
    'public register choices',
    ['public register choices'],
    ['other'],
    ['next_check'],
  ),
  assayChoice: target(
    'target-public-assay-choice-set',
    'public_exhibit_result',
    'public assay choices',
    ['two public assays'],
    ['other'],
    ['next_check'],
  ),
  archiveChoice: target(
    'target-public-archive-check-choice-set',
    'public_exhibit_result',
    'public archive-check choices',
    ['public archive checks'],
    ['other'],
    ['next_check'],
  ),
});

function stableId(prefix, label) {
  return `${prefix}-${String(label)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')}`;
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
    public_identifier_ids: publicIdentifiers.map((label) => stableId('public-id', label)),
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
    action_object_id: stableId('action-object', object),
    action_object_display_label: object,
  };
}

function eventTarget(targetValue, { valueTypes = null, componentIds = null } = {}) {
  if (!targetValue) return null;
  return {
    kind: targetValue.kind,
    target_id: targetValue.target_id,
    public_identifier_ids: [...targetValue.public_identifier_ids],
    requested_value_types: [...(valueTypes ?? targetValue.requested_value_types)],
    component_ids: [...(componentIds ?? targetValue.component_ids)],
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
    target: eventTarget(targetValue, { valueTypes, componentIds }),
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
      'Read me the courier name and dispatch time in the pier-four register.',
      TARGETS.pier,
      'pier-four courier and dispatch time',
      {
        transcript: [
          {
            turn: 1,
            learner: 'I need the dispatch details from the pier-four public register.',
            tutor: 'Let us first discuss the warehouse sketch instead.',
          },
        ],
        support: ['obligation_persistence', 'divergence_interactional_nonaligned'],
      },
    ),
    request(
      'State both the entry date and attendant in the gallery-B register.',
      TARGETS.gallery,
      'gallery-B entry values',
      {
        transcript: [
          {
            turn: 1,
            learner: 'What does the gallery-B entry register list?',
            tutor: 'Before that, consider the exhibition timetable.',
          },
        ],
        support: ['obligation_persistence', 'divergence_interactional_nonaligned'],
      },
    ),
    request('What mass is written in the balance note for medallion M8?', TARGETS.medallion, 'medallion M8 mass'),
    request('Which fibre does the public V2 assay identify?', TARGETS.fibre, 'fibre V2 material'),
    request('Does the public comparison mark stamp L as matching die six?', TARGETS.stamp, 'stamp L match status'),
    request('Read out the logged tone for chime J from the acoustic sheet.', TARGETS.chime, 'chime J logged sound'),
    proposal('I’ll inspect cart-three’s movement time myself next.', TARGETS.cart, 'inspect cart-three sheet', {
      transcript: [
        {
          turn: 1,
          learner: 'What time does the cart-three movement sheet show?',
          tutor: 'The public cart-three sheet records 16:10.',
        },
      ],
      support: ['obligation_resolution'],
    }),
    proposal(
      'I’ll compare the green-gate hinge image with the reference grooves.',
      TARGETS.hinge,
      'compare green-gate hinge grooves',
      {
        transcript: [
          {
            turn: 1,
            learner: 'What does the green-gate hinge photograph show?',
            tutor: 'It publicly shows two curved grooves on the hinge.',
          },
        ],
        support: ['obligation_resolution'],
      },
    ),
    proposal(
      'My next test is to reconstruct the sequence in the pier-four dispatch register.',
      TARGETS.pier,
      'inspect pier-four sequence',
    ),
    proposal('I propose weighing medallion M8 against the archive standard.', TARGETS.medallion, 'weigh medallion M8'),
    proposal('I’ll set stamp L beside die six and compare them.', TARGETS.stamp, 'compare stamp L'),
    proposal('I’ll check chime J against the published acoustic entry.', TARGETS.chime, 'compare chime J tone'),
  ];

  for (const [text, analyticSpan, requestSpan, eventTarget, object] of [
    [
      'The pier-four register proves dispatch, not receipt; enter only that bounded finding.',
      'The pier-four register proves dispatch, not receipt',
      'enter only that bounded finding',
      TARGETS.pier,
      'record dispatch not receipt',
    ],
    [
      'The V2 assay names linen but leaves its source open; record that limited result.',
      'The V2 assay names linen but leaves its source open',
      'record that limited result',
      TARGETS.fibre,
      'record bounded fibre result',
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
          action: action('requested', 'joint', 'record_public_claim', object),
          valueTypes: ['record_text'],
          componentIds: ['bounded_finding'],
          span: requestSpan,
        }),
      ],
      support: ['record_entry_request', 'inquiry_incomplete', 'divergence_epistemic_nonaligned'],
    });
  }

  const selectOne = 'Select which public register I should examine first.';
  specs.push({
    text: selectOne,
    events: [
      event('tutor_selection_request', selectOne, {
        target: TARGETS.registerChoice,
        action: action('requested', 'tutor', 'select_next_step', 'first public register'),
      }),
    ],
    support: ['tutor_selection_request', 'inquiry_incomplete', 'divergence_engagement_nonaligned'],
  });
  const selectTwo = 'I cannot choose between the two assays; select the next test for me.';
  specs.push({
    text: selectTwo,
    events: [
      event('low_agency_deferral', selectTwo, { span: 'I cannot choose between the two assays' }),
      event('tutor_selection_request', selectTwo, {
        target: TARGETS.assayChoice,
        action: action('requested', 'tutor', 'select_next_step', 'next assay test'),
        span: 'select the next test for me',
      }),
    ],
    support: ['tutor_selection_request', 'inquiry_incomplete', 'divergence_engagement_nonaligned'],
  });

  const compoundA = 'I’ll inspect the cart-three sheet myself; then give me its movement time.';
  specs.push({
    text: compoundA,
    events: [
      event('learner_proposed_test', compoundA, {
        target: TARGETS.cart,
        action: action('proposed', 'learner', 'perform_public_test', 'inspect cart-three sheet'),
        span: 'I’ll inspect the cart-three sheet myself',
      }),
      event('tutor_directed_public_result_request', compoundA, {
        target: TARGETS.cart,
        action: action('requested', 'tutor', 'supply_public_result', 'cart-three movement time'),
        span: 'give me its movement time',
      }),
    ],
    support: ['result_request', 'proposed_test', 'target_value_partition', 'compound_act', 'inquiry_incomplete'],
  });
  const compoundB = 'I’ll compare stamp L myself; afterward, report whether it matches die six.';
  specs.push({
    text: compoundB,
    events: [
      event('learner_proposed_test', compoundB, {
        target: TARGETS.stamp,
        action: action('proposed', 'learner', 'perform_public_test', 'compare stamp L'),
        span: 'I’ll compare stamp L myself',
      }),
      event('tutor_directed_public_result_request', compoundB, {
        target: TARGETS.stamp,
        action: action('requested', 'tutor', 'supply_public_result', 'stamp L match status'),
        span: 'report whether it matches die six',
      }),
    ],
    support: ['result_request', 'proposed_test', 'target_value_partition', 'compound_act', 'inquiry_incomplete'],
  });

  const analytic = 'The gallery entry establishes attendance but not object handling; please record just that limit.';
  specs.push({
    text: analytic,
    events: [
      event('analytic_contribution', analytic, {
        target: TARGETS.gallery,
        valueTypes: [],
        componentIds: [],
        span: 'The gallery entry establishes attendance but not object handling',
      }),
      event('learner_record_entry_request', analytic, {
        target: TARGETS.gallery,
        action: action('requested', 'tutor', 'record_public_claim', 'record gallery evidential limit'),
        valueTypes: ['record_text'],
        componentIds: ['bounded_finding'],
        span: 'please record just that limit',
      }),
    ],
    support: ['record_entry_request', 'analytic_permission_suffix', 'inquiry_incomplete'],
  });
  const defer = 'Choose the next archive check for me. I do not want to decide between them.';
  specs.push({
    text: defer,
    events: [
      event('tutor_selection_request', defer, {
        target: TARGETS.archiveChoice,
        action: action('requested', 'tutor', 'select_next_step', 'next move'),
        span: 'Choose the next archive check for me',
      }),
      event('low_agency_deferral', defer, { span: 'I do not want to decide between them' }),
    ],
    support: ['tutor_selection_request', 'low_agency_deferral', 'divergence_engagement_nonaligned'],
  });

  for (const [text, eventTarget] of [
    ['Which visible feature would distinguish a copied stamp from stamp L?', TARGETS.stamp],
    ['What public record would connect the pier-four dispatch to later receipt?', TARGETS.pier],
  ]) {
    specs.push({
      text,
      events: [event('criterion_question', text, { target: eventTarget })],
      support: ['criterion_question', 'inquiry_incomplete', 'divergence_conceptual_nonaligned'],
    });
  }

  const repairText = 'Explain why a dispatch entry still falls short of proving receipt; I am missing that step.';
  specs.push({
    text: repairText,
    events: [
      event('repair_request', repairText, {
        action: action('requested', 'tutor', 'explain_wording', 'dispatch versus receipt distinction'),
      }),
    ],
    support: ['repair_request', 'inquiry_incomplete', 'divergence_conceptual_nonaligned'],
  });
  const stalledText = 'I have exhausted my approaches and cannot propose another public check.';
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

function semanticHandbook() {
  return `# Frozen V3 semantic-event reader handbook

Label only the current public learner utterance in its supplied public context.

## Mechanical fields

The harness knows the current speaker is learner. Do not return speaker. The harness derives target kind and public identifiers from target_id, action mode and operation from action_object_id, and event offsets/order from literal spans. Do not return or infer those mechanical fields.

## Event multiplicity

Return one event per independent clause-level act that would change a distinct typed state. Explanatory or politeness wording inside a clause is not another event. A single clause receives one event under the speech-act precedence below. Separate events must have distinct non-overlapping minimal literal spans and are ordered by their surface position. One request for several values is one event with several value/component IDs.

A record-entry request receives a second analytic_contribution only when another clause independently states an inference or evidential limit. A tutor-selection request receives a second low_agency_deferral only when another clause explicitly refuses, cannot make, or delegates the choice. A proposal followed by a request for its result is two events.

Each reader event has speech_act, target, requested_or_proposed_action, and evidence_span.text. Every field is required and non-null. The closed speech-act vocabulary is tutor_directed_public_result_request, learner_proposed_test, criterion_question, tutor_selection_request, learner_record_entry_request, learner_wording_request, withdrawal, transfer_to_learner, repair_request, stall, register_complaint, repetition_complaint, low_agency_deferral, analytic_contribution, and other.

A result request asks the tutor to supply what a named public check, record, or comparison shows. A proposed test commits or proposes that the learner or joint inquiry perform a check; it does not create tutor result debt merely because the sentence says check, inspect, compare, test, listen, or weigh. A criterion question asks what evidence would establish a link. A record-entry request asks to write an already-public bounded claim, not discover a missing result. A tutor-selection request delegates the choice of next step and may coexist with low_agency_deferral. Analytic reasoning may coexist with a polite permission suffix; preserve both acts and do not convert the analytic clause into deference.

Speech-act precedence within one clause is: explicit repair or wording request; explicit complaint or stall; explicit withdrawal/transfer; tutor-selection delegation; result request; record-entry request; proposed test; criterion question; analytic contribution; other. Do not add a lower-precedence event for the same clause.

## Target fields

target_id identifies the public object, relation, or enumerated choice set under inquiry. Return the exact string target="none" when the act itself names no catalogue entity; never return null or omit target. A catalogue target is required for result requests, proposed tests, criterion questions, record-entry requests, and tutor-selection requests. For tutor selection, choose the catalogue target naming the publicly enumerated choices, never the requested value or the tutor. Wording/repair, stall, complaint, and low-agency acts use target="none". For analytic_contribution, the target belongs to the analysis itself: choose the catalogue entity the analytic clause is about independently of any accompanying request event, and use target="none" only when the analysis names no catalogue entity. Co-occurring request events keep their own targets. Apply the same catalogue-entity-or-none rule to other.

requested_value_types contains only values explicitly requested or produced by the clause: name, time, date, weight, sound, material, match_status, record_text, or other. Requested values are never targets or target kinds. component_ids contains only the catalogue answer components explicitly requested or produced. The harness adds target kind and public identifiers from the selected target_id.

## Action fields

Return only executor and action_object_id, or the exact string requested_or_proposed_action="none" when no action applies. Never return null or omit the field. Executor is the party who must perform the action, never the utterance speaker. Because the speaker is learner, a request-type act must use executor=tutor, joint, or unspecified; it must never use learner. Tutor-directed result, tutor-selection, wording, and repair requests use tutor when directly addressed to the tutor. Learner proposals use learner when the learner commits to act. The harness derives mode and operation from action_object_id and rejects incompatible speech-act/action/executor combinations.

Use exact target_id, component_ids, and action_object_id values from the supplied corpus-wide semantic_annotation_catalog. Display labels explain IDs but never determine identity or agreement. The catalogue standardises public identities across readers; it does not identify which entry applies to any case. Choose only entries supported by current public text.

Return only evidence_span.text: the shortest complete literal clause that supports the event, occurs exactly once in current_learner_turn.learner, and does not overlap another event span. Do not calculate offsets.

Set genuinely_ambiguous=true only when two complete typed readings remain after every rule above; then return events=[]. Ordinary uncertainty about wording strength uses the precedence rules and is not genuine ambiguity. Give every case a short case-specific public-evidence rationale. Do not see or infer model predictions, private support tags, downstream decisions, or another reader response.
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
  return { corpus, key, supportPlan, handbook: semanticHandbook() };
}

export function writeAdaptiveWarrantV3SemanticDiagnostic({ outputDir, excludedCorpusPaths = [], preflightPath } = {}) {
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
  return 'Usage: node scripts/build-adaptive-warrant-v3-semantic-diagnostic.js --out <empty-dir> --preflight <passing-artifact> --exclude-corpus <prior-corpus> [--exclude-corpus <prior-corpus> ...]\n';
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
      preflight: { type: 'string' },
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
