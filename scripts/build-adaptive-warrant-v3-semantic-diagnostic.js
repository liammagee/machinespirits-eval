#!/usr/bin/env node

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { getAdaptiveWarrantActionContract } from '../services/adaptiveWarrantActionContracts.js';
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
  quay: target(
    'record_entry',
    'quay-nine visitor ledger',
    ['quay-nine'],
    ['name', 'time'],
    ['visitor_name', 'clock_time'],
  ),
  lamp: target(
    'record_entry',
    'lamp-room sign-in book',
    ['lamp-room'],
    ['date', 'name'],
    ['sign_in_date', 'visitor_name'],
  ),
  token: target(
    'weight_or_ring_result',
    'archive scale record for token K-17',
    ['K-17'],
    ['weight'],
    ['measured_weight'],
  ),
  sample: target(
    'material_or_assay_result',
    'public assay for sample C-4',
    ['C-4'],
    ['material'],
    ['assayed_material'],
  ),
  seal: target(
    'comparison_result',
    'seal imprint Q comparison',
    ['imprint Q', 'mould three'],
    ['match_status'],
    ['match_status'],
  ),
  ring: target('weight_or_ring_result', 'bell-test record for ring H', ['ring H'], ['sound'], ['recorded_sound']),
  ferry: target('record_entry', 'ferry-seven movement log', ['ferry-seven'], ['time'], ['movement_time']),
  latch: target(
    'mark_or_tool_result',
    'blue-door latch photograph',
    ['blue-door'],
    ['match_status'],
    ['scratch_match'],
  ),
});

function target(kind, subject, publicIdentifiers, requestedValueTypes, requiredComponents) {
  return {
    kind,
    subject,
    public_identifiers: publicIdentifiers,
    requested_value_types: requestedValueTypes,
    required_components: requiredComponents,
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

function action(mode, actor, actionName, object) {
  return { mode, actor, action: actionName, object };
}

function event(speechAct, text, { target: eventTarget = null, action: eventAction = null, span = text } = {}) {
  const start = text.indexOf(span);
  if (start < 0) throw new Error(`semantic diagnostic span is not literal: ${span}`);
  return {
    speech_act: speechAct,
    target: eventTarget,
    requested_or_proposed_action: eventAction,
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
      "Read out the quay-nine ledger's recorded visitor and clock time.",
      TARGETS.quay,
      'quay-nine visitor and time',
      {
        transcript: [
          {
            turn: 1,
            learner: 'I need the visitor details from the quay-nine public ledger.',
            tutor: 'Let us first discuss the harbor map instead.',
          },
        ],
        support: ['obligation_persistence', 'divergence_interactional_nonaligned'],
      },
    ),
    request('Which date and name appear in the lamp-room sign-in book?', TARGETS.lamp, 'lamp-room sign-in values', {
      transcript: [
        {
          turn: 1,
          learner: 'What does the lamp-room sign-in book list?',
          tutor: 'Before that, consider the lighting schedule.',
        },
      ],
      support: ['obligation_persistence', 'divergence_interactional_nonaligned'],
    }),
    request('Tell me the weight registered for token K-17 in the archive scale record.', TARGETS.token, 'K-17 weight'),
    request('What material did the public assay identify in sample C-4?', TARGETS.sample, 'C-4 material'),
    request(
      'Does the seal comparison record whether imprint Q matches mould three?',
      TARGETS.seal,
      'imprint Q match status',
    ),
    request('Give me the sound recorded by the bell test for ring H.', TARGETS.ring, 'ring H recorded sound'),
    proposal('I will cross-check the ferry-seven movement log next.', TARGETS.ferry, 'inspect ferry-seven log', {
      transcript: [
        {
          turn: 1,
          learner: 'What time does the ferry-seven movement log show?',
          tutor: 'The public ferry-seven log records 14:20.',
        },
      ],
      support: ['obligation_resolution'],
    }),
    proposal(
      'My next test is to compare the blue-door latch photograph with the tool marks.',
      TARGETS.latch,
      'compare blue-door latch marks',
      {
        transcript: [
          {
            turn: 1,
            learner: 'What does the blue-door latch photograph show?',
            tutor: 'It publicly shows three diagonal scratches on the latch.',
          },
        ],
        support: ['obligation_resolution'],
      },
    ),
    proposal(
      'I will inspect the quay-nine ledger for a sequence before drawing a conclusion.',
      TARGETS.quay,
      'inspect quay-nine sequence',
    ),
    proposal('I propose weighing token K-17 against the calibrated reference.', TARGETS.token, 'weigh K-17'),
    proposal('Let me compare imprint Q with mould three as the next public test.', TARGETS.seal, 'compare imprint Q'),
    proposal(
      'I will listen to ring H and compare its tone with the public bell-test record.',
      TARGETS.ring,
      'compare ring H tone',
    ),
  ];

  for (const [text, eventTarget, object] of [
    [
      'Please enter that the quay-nine ledger establishes access, not removal.',
      TARGETS.quay,
      'record access not removal',
    ],
    [
      'Record that sample C-4 contains tin while leaving its source unresolved.',
      TARGETS.sample,
      'record bounded assay claim',
    ],
  ]) {
    specs.push({
      text,
      events: [
        event('learner_record_entry_request', text, {
          target: eventTarget,
          action: action('requested', 'joint', 'record_public_claim', object),
        }),
        event('analytic_contribution', text),
      ],
      support: ['record_entry_request', 'inquiry_incomplete', 'divergence_epistemic_nonaligned'],
    });
  }

  for (const text of [
    'Would you choose which public exhibit I should examine first?',
    'Could you select the next check for me because I cannot choose one?',
  ]) {
    specs.push({
      text,
      events: [
        event('tutor_selection_request', text, {
          action: action('requested', 'tutor', 'select_next_step', 'next public check'),
        }),
        event('low_agency_deferral', text),
      ],
      support: ['tutor_selection_request', 'inquiry_incomplete', 'divergence_engagement_nonaligned'],
    });
  }

  const compoundA = 'I will inspect the ferry-seven log; then tell me which time it records.';
  specs.push({
    text: compoundA,
    events: [
      event('learner_proposed_test', compoundA, {
        target: TARGETS.ferry,
        action: action('proposed', 'learner', 'perform_public_test', 'inspect ferry-seven log'),
        span: 'I will inspect the ferry-seven log',
      }),
      event('tutor_directed_public_result_request', compoundA, {
        target: TARGETS.ferry,
        action: action('requested', 'tutor', 'supply_public_result', 'ferry-seven recorded time'),
        span: 'tell me which time it records',
      }),
    ],
    support: ['result_request', 'proposed_test', 'target_value_partition', 'compound_act', 'inquiry_incomplete'],
  });
  const compoundB = 'I propose comparing imprint Q, and I want you to report whether it matches mould three.';
  specs.push({
    text: compoundB,
    events: [
      event('learner_proposed_test', compoundB, {
        target: TARGETS.seal,
        action: action('proposed', 'learner', 'perform_public_test', 'compare imprint Q'),
        span: 'I propose comparing imprint Q',
      }),
      event('tutor_directed_public_result_request', compoundB, {
        target: TARGETS.seal,
        action: action('requested', 'tutor', 'supply_public_result', 'imprint Q match status'),
        span: 'I want you to report whether it matches mould three',
      }),
    ],
    support: ['result_request', 'proposed_test', 'target_value_partition', 'compound_act', 'inquiry_incomplete'],
  });

  const analytic = 'The lamp-room entry proves presence only, not who moved the lamp; may I record that limit?';
  specs.push({
    text: analytic,
    events: [
      event('analytic_contribution', analytic, {
        span: 'The lamp-room entry proves presence only, not who moved the lamp',
      }),
      event('learner_record_entry_request', analytic, {
        target: TARGETS.lamp,
        action: action('requested', 'joint', 'record_public_claim', 'record evidential limit'),
        span: 'may I record that limit',
      }),
    ],
    support: ['record_entry_request', 'analytic_permission_suffix', 'inquiry_incomplete'],
  });
  const defer = 'Would you decide the next move for me? I do not want to choose.';
  specs.push({
    text: defer,
    events: [
      event('tutor_selection_request', defer, {
        action: action('requested', 'tutor', 'select_next_step', 'next move'),
        span: 'Would you decide the next move for me?',
      }),
      event('low_agency_deferral', defer, { span: 'I do not want to choose' }),
    ],
    support: ['tutor_selection_request', 'low_agency_deferral', 'divergence_engagement_nonaligned'],
  });

  for (const [text, eventTarget] of [
    ['What public observation would distinguish a copied seal from an original imprint Q?', TARGETS.seal],
    ['Which evidence would connect the quay-nine visit to the later removal?', TARGETS.quay],
  ]) {
    specs.push({
      text,
      events: [event('criterion_question', text, { target: eventTarget })],
      support: ['criterion_question', 'inquiry_incomplete', 'divergence_conceptual_nonaligned'],
    });
  }

  const repairText =
    'I cannot follow the distinction between a recorded visit and proof of removal; explain it plainly.';
  specs.push({
    text: repairText,
    events: [
      event('repair_request', repairText, {
        action: action('requested', 'tutor', 'explain_wording', 'visit versus removal distinction'),
      }),
    ],
    support: ['repair_request', 'inquiry_incomplete', 'divergence_conceptual_nonaligned'],
  });
  const stalledText = 'I have no idea.';
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

Label only the current public learner utterance in its supplied public context. Preserve ordered multiplicity.

Each event has speech_act, target, requested_or_proposed_action, and an exact literal evidence_span. The closed speech-act vocabulary is tutor_directed_public_result_request, learner_proposed_test, criterion_question, tutor_selection_request, learner_record_entry_request, learner_wording_request, withdrawal, transfer_to_learner, repair_request, stall, register_complaint, repetition_complaint, low_agency_deferral, analytic_contribution, and other.

A result request asks the tutor to supply what a named public check, record, or comparison shows. A proposed test commits or proposes that the learner or joint inquiry perform a check; it does not create tutor result debt merely because the sentence says check, inspect, compare, test, listen, or weigh. A criterion question asks what evidence would establish a link. A record-entry request asks to write an already-public bounded claim, not discover a missing result. A tutor-selection request delegates the choice of next step and may coexist with low_agency_deferral. Analytic reasoning may coexist with a polite permission suffix; preserve both acts and do not convert the analytic clause into deference.

target.subject is the public object or relation under inquiry. requested_value_types contains values sought about it: name, time, date, weight, sound, material, match_status, record_text, or other. Requested values are not subject terms. public_identifiers contain exact public identifiers. required_components names the answer components.

Action mode is requested, proposed, or none. Actor is learner, tutor, joint, unspecified, or none. Action is supply_public_result, perform_public_test, select_next_step, record_public_claim, explain_wording, withdraw_request, or none. Use null when target or action does not apply.

Return only evidence_span.text: a non-empty literal substring that occurs exactly once in current_learner_turn.learner. Do not calculate offsets; the assembler derives JavaScript UTF-16 start and exclusive end offsets mechanically and records them in its audit. Mark genuinely_ambiguous only when two material readings remain plausible after applying this handbook. Give every case a short case-specific public-evidence rationale. Do not see or infer model predictions, private support tags, downstream decisions, or another reader response.
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
    cases: paired.map(({ row }) => row),
  };
  const key = {
    schema: 'machinespirits.adaptation-refinement.v3-semantic-diagnostic-private-key.v1',
    study_id: studyId,
    cases: paired.map(({ sampleId, spec, row }) => ({
      sample_id: sampleId,
      source_fingerprint: annotationCaseFingerprint(row),
      expected_semantic_events: spec.events,
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

export function writeAdaptiveWarrantV3SemanticDiagnostic({ outputDir, excludedCorpusPaths = [] } = {}) {
  const resolvedOutput = path.resolve(outputDir);
  if (fs.existsSync(resolvedOutput) && fs.readdirSync(resolvedOutput).length) {
    throw new Error(`V3 semantic diagnostic output is not empty: ${resolvedOutput}`);
  }
  if (!excludedCorpusPaths.length) throw new Error('V3 semantic diagnostic requires explicit prior-corpus exclusions');
  const provenance = adaptiveWarrantStudySourceFingerprint();
  if (provenance.gitStatus) throw new Error('V3 semantic diagnostic freeze requires a clean committed worktree');
  if (!/^[0-9a-f]{40}$/u.test(provenance.gitCommit || ''))
    throw new Error('V3 semantic diagnostic requires exact commit');
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
  return 'Usage: node scripts/build-adaptive-warrant-v3-semantic-diagnostic.js --out <empty-dir> --exclude-corpus <prior-corpus> [--exclude-corpus <prior-corpus> ...]\n';
}

function main() {
  const { values } = parseArgs({
    options: {
      out: { type: 'string' },
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
